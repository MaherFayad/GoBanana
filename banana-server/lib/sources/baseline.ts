/**
 * One baseline lane per canvas (plan P0-03). The fidelity lane (the page as apps ship it, worded
 * for the platform) is the same for every direction of one brief, so it runs once per canvas. The
 * ids of its results are saved on the canvas as `baseline`; later direction searches on the same
 * canvas and key within BASELINE_TTL_MS skip the lane. The reference rows already exist in the
 * `references` table (purged after 30 days), so nothing new is stored. Baseline results go to a
 * "Shipped today" section, never into a direction. Pure.
 */
import { MAX_BASELINE_POOL, MAX_BASELINE_SENT, type CanvasBaseline, type PooledReference } from "@/canvas/types";
import type { LaneTexts, PlannedRequest } from "./plan";
import type { LaneName, Reference } from "./types";
import { itemKey } from "./web-search";

export type { CanvasBaseline, PooledReference };

/** The lane that runs once per canvas. */
export const BASELINE_LANE: LaneName = "fidelity";
/** A saved baseline is reused for this long. */
export const BASELINE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Most result ids one baseline keeps. */
export const MAX_BASELINE_IDS = 24;

/** What the baseline searched: the platform and the fidelity words. Null when there is no fidelity lane. */
export function baselineKey(lanes: Pick<LaneTexts, "fidelity" | "platform">): string | null {
  const words = lanes.fidelity?.trim().toLowerCase().replace(/\s+/g, " ");
  return words ? `${lanes.platform ?? "any"}|${words}` : null;
}

/** True when `baseline` is for `key` and younger than BASELINE_TTL_MS at `now`. */
export function isFreshBaseline(baseline: CanvasBaseline | null | undefined, key: string | null, now: Date): baseline is CanvasBaseline {
  if (!baseline || !key || baseline.key !== key) return false;
  const at = Date.parse(baseline.at);
  return Number.isFinite(at) && now.getTime() - at >= 0 && now.getTime() - at < BASELINE_TTL_MS;
}

/** The plan without the baseline lane's requests (it already ran on this canvas). */
export function withoutBaselineLane<T extends Pick<PlannedRequest, "lane">>(plan: readonly T[]): T[] {
  return plan.filter((r) => r.lane !== BASELINE_LANE);
}

/**
 * The baseline to save: a fresh one for the same key gains the new ids (two direction searches
 * that ran at once both searched the lane), anything else is replaced.
 */
export function mergeBaseline(existing: CanvasBaseline | null | undefined, next: CanvasBaseline, now: Date): CanvasBaseline {
  if (!isFreshBaseline(existing, next.key, now)) return withSent({ ...next, referenceIds: next.referenceIds.slice(0, MAX_BASELINE_IDS) }, next.sent ?? []);
  const ids = [...new Set([...existing.referenceIds, ...next.referenceIds])].slice(0, MAX_BASELINE_IDS);
  const pool = existing.pool?.length ? existing.pool : next.pool;
  return withSent({ ...existing, referenceIds: ids, ...(pool?.length ? { pool } : {}) }, [...(existing.sent ?? []), ...(next.sent ?? [])]);
}

/**
 * One key per search request: its query, source and page. Requests with the same key on one canvas return
 * the same results, which are already on the canvas, so a later direction search skips them (Gate 2:
 * brief-level lanes such as the mobile taste lane and the topic galleries repeated across directions).
 */
export function sentKey(r: Pick<PlannedRequest, "query" | "site" | "page">): string {
  return `${r.site ?? "web"}|${r.page ?? 1}|${r.query.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

/** The plan without requests this canvas already sent for the baseline key. */
export function withoutSent<T extends Pick<PlannedRequest, "query" | "site" | "page">>(plan: readonly T[], baseline: CanvasBaseline | null | undefined): T[] {
  const sent = new Set(baseline?.sent ?? []);
  return sent.size === 0 ? [...plan] : plan.filter((r) => !sent.has(sentKey(r)));
}

/** The baseline with `sent` set to these keys (deduped, the newest MAX_BASELINE_SENT kept). */
export function withSent(baseline: CanvasBaseline, sent: readonly string[]): CanvasBaseline {
  const keys = [...new Set(sent)].slice(-MAX_BASELINE_SENT);
  const { sent: _drop, ...rest } = baseline;
  return keys.length > 0 ? { ...rest, sent: keys } : rest;
}

// ---------------------------------------------------------------------------------------------
// One deep shared request per board (Gate 2 round 2, bench/GATE2-DIAGNOSIS.md cause 4).
//
// With no request sent twice on a board, the board's second and third directions lost the
// brief-level lanes (fidelity and the mobile taste lane), which hold most of the good and great
// results. Now the first direction search goes one page deeper on the fidelity lane, and what the
// brief-level lanes found but it did not place is kept on the baseline as a pool; each later
// direction takes its share of the pool, so it gets the precise results with no request sent again.

/** The brief-level lanes whose unplaced results go to the pool. */
export const POOL_LANES: readonly LaneName[] = [BASELINE_LANE, "taste"];
/** Pooled results one later direction search takes. */
export const POOL_SHARE = 4;

/**
 * The first direction search's plan with the fidelity request one page deeper: its page 2 right
 * after it, so a later direction never sends it. The plan stays within `max` requests (the last
 * request gives way). Unchanged when the plan has no fidelity request or already has its page 2.
 */
export function deepenBaseline<T extends PlannedRequest>(plan: readonly T[], max: number): T[] {
  const at = plan.findIndex((r) => r.lane === BASELINE_LANE && (r.page ?? 1) === 1);
  if (at < 0) return plan.slice(0, max);
  const first = plan[at]!;
  if (plan.some((r) => r.lane === BASELINE_LANE && r.query === first.query && r.site === first.site && r.page === 2)) return plan.slice(0, max);
  const page2 = { ...first, page: 2 } as T;
  delete (page2 as { fallback?: string }).fallback;
  return [...plan.slice(0, at + 1), page2, ...plan.slice(at + 1)].slice(0, max);
}

/** Pooled form of a result (the fields the canvas tray needs). */
export function toPooled(r: Reference): PooledReference {
  return {
    id: r.id,
    thumbUrl: r.thumbUrl,
    imageUrl: r.imageUrl,
    sourceUrl: r.sourceUrl,
    sourceSite: r.sourceSite,
    ...(r.title ? { title: r.title } : {}),
    ...(r.width ? { width: r.width } : {}),
    ...(r.height ? { height: r.height } : {}),
    ...(r.lane === "fidelity" || r.lane === "taste" ? { lane: r.lane } : {}),
    ...(r.query ? { query: r.query } : {}),
  };
}

/** The pool to save: the leftovers in order, at most MAX_BASELINE_POOL. */
export function poolOf(leftover: readonly Reference[] | undefined): PooledReference[] {
  return (leftover ?? []).slice(0, MAX_BASELINE_POOL).map(toPooled);
}

/**
 * A later direction's share of the pool: the first `n` pooled results not on the canvas yet (another
 * direction took them) and not blocked by the user (item keys).
 */
export function takeFromPool(pool: readonly PooledReference[] | undefined, onCanvas: readonly string[], blocked: readonly string[], n = POOL_SHARE): Reference[] {
  const skip = new Set([...onCanvas.map(itemKey), ...blocked]);
  return (pool ?? [])
    .filter((r) => !skip.has(itemKey(r.sourceUrl)))
    .slice(0, n)
    .map((r) => ({ ...r, lane: r.lane ?? BASELINE_LANE, zone: "ui" as const }));
}

/**
 * The direction's results with its pool share: UI results alternate, pooled first, and the UI keeps
 * at most `count` minus the art results (pooled ones push out the direction's last UI results, never
 * its art). Results that repeat one already there are left out.
 */
export function withPoolShare(refs: readonly Reference[], pooled: readonly Reference[], count: number): Reference[] {
  if (pooled.length === 0) return [...refs];
  const ui = refs.filter((r) => r.zone !== "art");
  const art = refs.filter((r) => r.zone === "art");
  const have = new Set(refs.flatMap((r) => [itemKey(r.sourceUrl), r.id]));
  const fresh = pooled.filter((r) => !have.has(itemKey(r.sourceUrl)) && !have.has(r.id));
  const mixed: Reference[] = [];
  for (let i = 0; i < Math.max(ui.length, fresh.length); i++) {
    if (fresh[i]) mixed.push(fresh[i]!);
    if (ui[i]) mixed.push(ui[i]!);
  }
  const room = Math.max(ui.length, count - art.length);
  return [...mixed.slice(0, room), ...art];
}
