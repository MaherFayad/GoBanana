/**
 * In-memory repositories with the same behavior as the Drizzle ones: ownership checks,
 * upserts, deterministic reference ids and optimistic saves. For tests and local runs
 * only; nothing is shared across Workers isolates.
 */
import { planOf, type Plan, type Usage } from "@/lib/quota";
import { isStateObject, stateHasTaste } from "@/lib/taste";
import { isUuid, referenceRowId } from "./ids";
import type {
  CanvasRecord,
  DirectionRecord,
  PaletteRecord,
  ReferenceRecord,
  Repos,
} from "./types";

export type MemoryRepos = Repos & {
  data: {
    canvases: Map<string, CanvasRecord>;
    directions: DirectionRecord[];
    references: Map<string, ReferenceRecord>;
    palettes: PaletteRecord[];
    usage: Map<string, Usage>;
    takedowns: string[];
    plans: Map<string, Plan>;
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
    takedowns: [...(seed.takedowns ?? [])],
    plans: new Map(Object.entries(seed.plans ?? {})),
  };
  let clock = Date.UTC(2026, 9, 1);
  const tick = () => new Date((clock += 1000));
  const usageKey = (u: string, p: string) => `${u}|${p}`;
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
      async countOwned(userId) {
        return [...data.canvases.values()].filter((c) => c.userId === userId).length;
      },
      async saveState(userId, canvasId, state, opts = {}) {
        const c = owned(userId, canvasId);
        if (!c) return { ok: false, reason: "not_found" };
        if (opts.ifUpdatedAt && opts.ifUpdatedAt.getTime() !== c.updatedAt.getTime()) {
          return { ok: false, reason: "conflict" };
        }
        // Same as saveCanvasState: a save without `taste` keeps the stored one.
        const prev = c.state;
        const keep = isStateObject(state) && !stateHasTaste(state) && isStateObject(prev) && stateHasTaste(prev);
        c.state = keep ? { ...clone(state), taste: clone(prev.taste) } : clone(state);
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
        for (const d of rows) {
          const existing = data.directions.find((x) => x.canvasId === canvasId && x.bendId === d.bendId);
          if (existing) Object.assign(existing, { move: d.move, title: d.title, searchQuery: d.searchQuery });
          else data.directions.push({ id: uuid(), canvasId, ...d });
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
    },
    references: {
      async insertMany(canvasId, refs) {
        for (const r of refs) {
          const id = await referenceRowId(canvasId, r.id);
          if (data.references.has(id)) continue;
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
          });
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
    },
    takedowns: {
      async list() {
        return [...data.takedowns];
      },
    },
    users: {
      async getPlan(userId) {
        return planOf(data.plans.get(userId));
      },
    },
  };
}
