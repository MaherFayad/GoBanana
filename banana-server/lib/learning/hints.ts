/**
 * Feedback types and the plain next-step hint rate_references gives for a bad result (pure).
 * The hint tells the agent how to re-search that lane with better words; it never says the
 * result was looked at by the server.
 */
import type { LaneName } from "../sources/types";

export const FEEDBACK_VERDICTS = ["great", "bad"] as const;
export type FeedbackVerdict = (typeof FEEDBACK_VERDICTS)[number];

export const FEEDBACK_REASONS = [
  "off_topic",
  "low_craft",
  "stock_or_shop",
  "cluttered",
  "duplicate",
  "wrong_style",
  "not_ui",
  "great_craft",
  "on_style",
  "on_brief",
] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

const RETRY = (lane: LaneName) => `search_references with directionId, lane "${lane}" and new query words`;

/** One short hint for a bad rating. */
export function badHint(lane: LaneName | null, reasons: readonly FeedbackReason[]): string {
  const has = (r: FeedbackReason) => reasons.includes(r);
  if (has("duplicate")) return "Duplicate: it is blocked now, nothing else to do.";
  if (!lane) return "It will not come back. To steer the next search, try other words or a directionId.";
  if (lane === "inspiration") {
    if (has("stock_or_shop")) return `Try ${RETRY(lane)}: add a craft word such as "poster" or "graphic design".`;
    return `Try ${RETRY(lane)}: describe the visual, not the object, for example "35mm film strip macro" instead of "oversized film frames".`;
  }
  if (has("not_ui") || has("off_topic")) return `Try ${RETRY(lane)}: name the domain and the screen, for example "flight checkout ui design".`;
  if (has("cluttered")) return `Try ${RETRY(lane)}: ask for one screen, for example add "single screen" or a component such as card or widget.`;
  if (has("wrong_style")) return `Try ${RETRY(lane)} with the user's style words, or pass taste.`;
  if (has("stock_or_shop")) return `Try ${RETRY(lane)}: add "ui design" and avoid words like template or kit.`;
  if (has("low_craft")) return `Try ${RETRY(lane)}: add a style word that signals polish, such as minimal or editorial.`;
  return `If more of this lane is off, try ${RETRY(lane)}.`;
}
