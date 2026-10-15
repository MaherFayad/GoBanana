/**
 * In-memory repositories with the same behavior as the Drizzle ones: ownership checks,
 * upserts, deterministic reference ids and optimistic saves. For tests and local runs
 * only; nothing is shared across Workers isolates.
 */
import { planOf, type Plan, type Usage } from "@/lib/quota";
import { isStateObject } from "@/lib/taste";
import { KEEP_STORED } from "./keep";
import { parseDirectionDetail } from "./detail";
import { isUuid, referenceRowId } from "./ids";
import { clampListLimit, referencesFromState } from "./summary";
import type {
  ArmStatRow,
  CanvasRecord,
  DirectionRecord,
  IngredientStatRow,
  NewFeedback,
  PaletteRecord,
  ReferenceRecord,
  Repos,
} from "./types";

export type MemoryFeedback = NewFeedback & { createdAt: Date };

export type MemoryRepos = Repos & {
  data: {
    canvases: Map<string, CanvasRecord>;
    directions: DirectionRecord[];
    references: Map<string, ReferenceRecord>;
    palettes: PaletteRecord[];
    usage: Map<string, Usage>;
    /** Serper credits per `user|period`. */
    credits: Map<string, number>;
    takedowns: string[];
    plans: Map<string, Plan>;
    feedback: MemoryFeedback[];
    /** user id to blocked item keys */
    blocked: Map<string, Set<string>>;
  };
};

function uuid(): string {
  return crypto.randomUUID();
}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

export function createMemoryRepos(seed: { takedowns?: string[]; plans?: Record<string, Plan> } = {}): MemoryRepos {
  const data: MemoryRepos["data"] = {
    canvases: new Map(),
    directions: [],
    references: new Map(),
    palettes: [],
    usage: new Map(),
    credits: new Map(),
    takedowns: [...(seed.takedowns ?? [])],
    plans: new Map(Object.entries(seed.plans ?? {})),
    feedback: [],
    blocked: new Map(),
  };
  let clock = Date.UTC(2026, 9, 1);
  const tick = () => new Date((clock += 1000));
  const usageKey = (u: string, p: string) => `${u}|${p}`;
  /** Row creation times for references (newest first in findOwned). */
  const created = new Map<string, Date>();
  const owned = (userId: string, canvasId: string) => {
    const c = data.canvases.get(canvasId);
    return c && c.userId === userId ? c : null;
  };
  const bump = (userId: string, period: string, field: keyof Usage, by: number) => {
    const row = data.usage.get(usageKey(userId, period)) ?? { searches: 0, canvases: 0 };
    data.usage.set(usageKey(userId, period), { ...row, [field]: row[field] + Math.max(0, Math.floor(by)) });
  };

  return {
    data,
    canvases: {
      async create(input) {
        const row: CanvasRecord = {
          id: uuid(),
          userId: input.userId,
          title: input.title,
          brief: input.brief ?? null,
          wildness: input.wildness ?? null,
          lens: input.lens ?? null,
          state: clone(input.state),
          shareToken: null,
          updatedAt: tick(),
        };
        data.canvases.set(row.id, row);
        return { ...row, state: clone(row.state) };
      },
      async getOwned(userId, canvasId) {
        const c = owned(userId, canvasId);
        return c ? { ...c, state: clone(c.state) } : null;
      },
      async getVersion(userId, canvasId) {
        const c = owned(userId, canvasId);
        return c ? new Date(c.updatedAt) : null;
      },
      async countOwned(userId) {
        return [...data.canvases.values()].filter((c) => c.userId === userId).length;
      },
      async listOwned(userId, opts = {}) {
        return [...data.canvases.values()]
          .filter((c) => c.userId === userId)
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .slice(0, clampListLimit(opts.limit))
          .map((c) => {
            const refs = referencesFromState(c.state);
            return {
              id: c.id,
              title: c.title,
              brief: c.brief,
              shareToken: c.shareToken,
              updatedAt: new Date(c.updatedAt),
              referenceCount: refs.count,
              directionCount: data.directions.filter((d) => d.canvasId === c.id).length,
              previews: refs.previews,
            };
          });
      },
      async saveState(userId, canvasId, state, opts = {}) {
        const c = owned(userId, canvasId);
        if (!c) return { ok: false, reason: "not_found" };
        if (opts.ifUpdatedAt && opts.ifUpdatedAt.getTime() !== c.updatedAt.getTime()) {
          return { ok: false, reason: "conflict" };
        }
        // Same as saveCanvasState: a save without `taste` or `parts` keeps the stored one.
        const prev = c.state;
        const next = clone(state);
        if (isStateObject(next) && isStateObject(prev)) {
          for (const key of KEEP_STORED) if (!Object.hasOwn(next, key) && Object.hasOwn(prev, key)) next[key] = clone(prev[key]);
        }
        c.state = next;
        c.updatedAt = tick();
        return { ok: true, updatedAt: c.updatedAt };
      },
      async update(userId, canvasId, patch) {
        const c = owned(userId, canvasId);
        if (!c) return false;
        if (patch.title !== undefined) c.title = patch.title;
        if (patch.brief !== undefined) c.brief = patch.brief;
        if (patch.wildness !== undefined) c.wildness = patch.wildness;
        if (patch.lens !== undefined) c.lens = patch.lens;
        return true;
      },
    },
    directions: {
      async upsertMany(canvasId, rows) {
        for (const { detail: rawDetail, ...d } of rows) {
          // Same as the SQL upsert: a new detail replaces the old one but keeps its verdict.
          const detail = parseDirectionDetail(rawDetail);
          const existing = data.directions.find((x) => x.canvasId === canvasId && x.bendId === d.bendId);
          if (existing) {
            Object.assign(existing, { move: d.move, title: d.title, searchQuery: d.searchQuery });
            if (detail) {
              const verdict = existing.detail?.verdict;
              existing.detail = verdict ? { ...detail, verdict } : detail;
            }
          } else {
            data.directions.push({ id: uuid(), canvasId, ...d, ...(detail ? { detail } : {}) });
          }
        }
      },
      async findForUser(userId, directionId, canvasId) {
        const hit = data.directions.find(
          (d) =>
            (isUuid(directionId) ? d.id === directionId : d.bendId === directionId) &&
            (!canvasId || d.canvasId === canvasId) &&
            owned(userId, d.canvasId) !== null,
        );
        return hit ? { ...hit } : null;
      },
      async listForCanvas(canvasId) {
        return data.directions.filter((d) => d.canvasId === canvasId).map((d) => ({ ...d }));
      },
      async deleteMany(canvasId, ids) {
        const drop = new Set(ids);
        const before = data.directions.length;
        data.directions = data.directions.filter((d) => !(d.canvasId === canvasId && drop.has(d.id)));
        return before - data.directions.length;
      },
      async setVerdict(canvasId, ids, verdict) {
        const set = new Set(ids);
        let n = 0;
        for (const d of data.directions) {
          if (d.canvasId !== canvasId || !set.has(d.id)) continue;
          d.detail = { ...(d.detail ?? {}), verdict };
          n++;
        }
        return n;
      },
      async setReconciled(canvasId, id, patch) {
        const d = data.directions.find((x) => x.canvasId === canvasId && x.id === id);
        if (!d) return false;
        const clean = parseDirectionDetail(clone(patch)) ?? {};
        d.detail = {
          ...(d.detail ?? {}),
          ...(clean.spec ? { spec: clean.spec } : {}),
          ...(clean.reconciled ? { reconciled: clean.reconciled } : {}),
        };
        return true;
      },
      async recentQueriesForUser(userId, opts) {
        const recent = [...data.canvases.values()]
          .filter((c) => c.userId === userId && c.id !== opts.excludeCanvasId)
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .slice(0, Math.max(0, opts.canvasLimit))
          .map((c) => c.id);
        return data.directions.filter((d) => recent.includes(d.canvasId)).map((d) => d.searchQuery);
      },
    },
    references: {
      async insertMany(canvasId, refs) {
        for (const r of refs) {
          const id = await referenceRowId(canvasId, r.id);
          const existing = data.references.get(id);
          if (existing) {
            // Same as the SQL upsert: URLs stay, search details follow the newer search.
            existing.resultId = existing.resultId ?? r.id;
            existing.lane = r.lane ?? existing.lane;
            existing.query = r.query ?? existing.query;
            existing.termKey = r.termKey ?? existing.termKey;
            existing.arm = r.arm ?? existing.arm;
            continue;
          }
          data.references.set(id, {
            id,
            canvasId,
            sourceSite: r.sourceSite,
            sourceUrl: r.sourceUrl,
            imageUrl: r.imageUrl,
            thumbUrl: r.thumbUrl,
            title: r.title ?? null,
            width: r.width ?? null,
            height: r.height ?? null,
            resultId: r.id,
            lane: r.lane ?? null,
            query: r.query ?? null,
            termKey: r.termKey ?? null,
            arm: r.arm ?? null,
          });
          created.set(id, tick());
        }
      },
      async getByIds(canvasId, ids) {
        const out = new Map<string, ReferenceRecord>();
        for (const id of ids) {
          const rowId = isUuid(id) ? id : await referenceRowId(canvasId, id);
          const row = data.references.get(rowId);
          if (row && row.canvasId === canvasId) out.set(id, { ...row });
        }
        return out;
      },
      async findOwned(userId, ids) {
        const out = new Map<string, ReferenceRecord>();
        const rows = [...data.references.values()]
          .filter((r) => owned(userId, r.canvasId) !== null)
          .sort((a, b) => (created.get(b.id)?.getTime() ?? 0) - (created.get(a.id)?.getTime() ?? 0));
        for (const id of new Set(ids)) {
          const row = rows.find((r) => (isUuid(id) ? r.id === id.toLowerCase() : r.resultId === id));
          if (row) out.set(id, { ...row });
        }
        return out;
      },
    },
    palettes: {
      async insert(canvasId, colors, contrast) {
        const id = uuid();
        data.palettes.push({ id, canvasId, colors: clone(colors), contrast: clone(contrast) });
        return id;
      },
      async listForCanvas(canvasId) {
        return data.palettes.filter((p) => p.canvasId === canvasId).map((p) => clone(p));
      },
    },
    usage: {
      async get(userId, period) {
        return { ...(data.usage.get(usageKey(userId, period)) ?? { searches: 0, canvases: 0 }) };
      },
      async addSearches(userId, period, by) {
        bump(userId, period, "searches", by);
      },
      async addCanvases(userId, period, by) {
        bump(userId, period, "canvases", by);
      },
      async addCredits(userId, period, by) {
        const k = usageKey(userId, period);
        data.credits.set(k, (data.credits.get(k) ?? 0) + Math.max(0, Math.floor(by)));
      },
      async creditsUsed(period) {
        let total = 0;
        for (const [k, n] of data.credits) if (k.endsWith(`|${period}`)) total += n;
        return total;
      },
    },
    takedowns: {
      async list() {
        return [...data.takedowns];
      },
      async hash() {
        // Same contract as the Postgres one (count plus a digest of the sorted entries), not the same digest.
        const sorted = [...data.takedowns].sort();
        let h = 0x811c9dc5;
        for (const ch of sorted.join("\n")) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
        return `${sorted.length}-${h.toString(16)}`;
      },
    },
    users: {
      async getPlan(userId) {
        return planOf(data.plans.get(userId));
      },
    },
    feedback: {
      async insertMany(rows) {
        for (const r of rows) data.feedback.push({ ...r, reasons: [...r.reasons], createdAt: tick() });
      },
      async listCreatorRatings(userId, limit = 500) {
        return data.feedback
          .filter((f) => f.userId === userId && f.creator !== null)
          .reverse()
          .slice(0, limit)
          .map((f) => ({ itemKey: f.itemKey, verdict: f.verdict, creator: f.creator }));
      },
      async armStats(userId, termKeys) {
        // Same grouping as lib/db/feedback.ts armStatsSql.
        const keys = new Set(termKeys);
        const perUser = new Map<string, { termKey: string; arm: string; userId: string; g: number; b: number }>();
        for (const f of data.feedback) {
          if (!f.termKey || !f.arm || !keys.has(f.termKey)) continue;
          const k = `${f.termKey}\n${f.arm}\n${f.userId}`;
          const row = perUser.get(k) ?? { termKey: f.termKey, arm: f.arm, userId: f.userId, g: 0, b: 0 };
          if (f.verdict === "great") row.g++;
          else row.b++;
          perUser.set(k, row);
        }
        const out = new Map<string, ArmStatRow>();
        for (const u of perUser.values()) {
          const k = `${u.termKey}\n${u.arm}`;
          const s = out.get(k) ?? { termKey: u.termKey, arm: u.arm, great: 0, bad: 0, users: 0, ownGreat: 0, ownBad: 0 };
          s.users++;
          if (u.g > u.b) s.great++;
          if (u.b > u.g) s.bad++;
          if (u.userId === userId) {
            s.ownGreat += u.g;
            s.ownBad += u.b;
          }
          out.set(k, s);
        }
        return [...out.values()];
      },
      async directionStats(userId, k) {
        // Same grouping as lib/db/feedback.ts directionStatsSql.
        const perUser = new Map<string, { termKey: string; userId: string; g: number; b: number }>();
        for (const f of data.feedback) {
          if (f.lane !== "direction" || !f.termKey?.startsWith("direction|")) continue;
          const key = `${f.termKey}\n${f.userId}`;
          const row = perUser.get(key) ?? { termKey: f.termKey, userId: f.userId, g: 0, b: 0 };
          if (f.verdict === "great") row.g++;
          else row.b++;
          perUser.set(key, row);
        }
        const out = new Map<string, IngredientStatRow & { mine: boolean }>();
        for (const u of perUser.values()) {
          const s = out.get(u.termKey) ?? { termKey: u.termKey, great: 0, bad: 0, users: 0, ownGreat: 0, ownBad: 0, mine: false };
          s.users++;
          if (u.g > u.b) s.great++;
          if (u.b > u.g) s.bad++;
          if (u.userId === userId) {
            s.ownGreat += u.g;
            s.ownBad += u.b;
            s.mine = true;
          }
          out.set(u.termKey, s);
        }
        return [...out.values()].filter((s) => s.users >= k || s.mine).map(({ mine: _mine, ...s }) => s);
      },
      async verdictsFor(userId, itemKeys) {
        const keys = new Set(itemKeys);
        const out = new Map<string, "great" | "bad">();
        // Newest first, so the latest verdict per key wins.
        for (const f of [...data.feedback].reverse()) {
          if (f.userId === userId && keys.has(f.itemKey) && !out.has(f.itemKey)) out.set(f.itemKey, f.verdict);
        }
        return out;
      },
    },
    blocklist: {
      async add(userId, itemKeys) {
        const set = data.blocked.get(userId) ?? new Set<string>();
        for (const k of itemKeys) if (k) set.add(k);
        data.blocked.set(userId, set);
      },
      async list(userId) {
        return [...(data.blocked.get(userId) ?? [])];
      },
    },
  };
}
