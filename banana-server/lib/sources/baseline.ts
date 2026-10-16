/**
 * One baseline lane per canvas (plan P0-03). The fidelity lane (the page as apps ship it, worded
 * for the platform) is the same for every direction of one brief, so it runs once per canvas. The
 * ids of its results are saved on the canvas as `baseline`; later direction searches on the same
 * canvas and key within BASELINE_TTL_MS skip the lane. The reference rows already exist in the
 * `references` table (purged after 30 days), so nothing new is stored. Baseline results go to a
 * "Shipped today" section, never into a direction. Pure.
 */
import { MAX_BASELINE_SENT, type CanvasBaseline } from "@/canvas/types";
import type { LaneTexts, PlannedRequest } from "./plan";
import type { LaneName } from "./types";

export type { CanvasBaseline };

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
  return withSent({ ...existing, referenceIds: ids }, [...(existing.sent ?? []), ...(next.sent ?? [])]);
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
