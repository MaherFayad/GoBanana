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
  "object_only",
  "no_translation",
] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

/**
 * Bad reasons for art direction results only (V4.3): `object_only` is a product or object photo
 * with no graphic system to take, `no_translation` means nothing maps to a UI part. Learning
 * stores them like any other reason; where reasons are weighed they count as off_topic.
 */
export const ART_ONLY_REASONS = ["object_only", "no_translation"] as const satisfies readonly FeedbackReason[];

export function isArtOnlyReason(r: FeedbackReason): boolean {
  return (ART_ONLY_REASONS as readonly string[]).includes(r);
}

const RETRY = (lane: LaneName) => `search_references with directionId, lane "${lane}" and new query words`;

/** One short hint for a bad rating. */
export function badHint(lane: LaneName | null, reasons: readonly FeedbackReason[]): string {
  const has = (r: FeedbackReason) => reasons.includes(r);
  if (has("duplicate")) return "Duplicate: it is blocked now, nothing else to do.";
  // Art only reasons always point at the art lane (a plain query art result has no lane).
  if (has("object_only")) return `Try ${RETRY("art")}: name a graphic system, not an object, for example "sadu identity system" or "departure board typography". A photo of the thing has nothing to take.`;
  if (has("no_translation")) return `Keep an art reference only if you can name the UI part it becomes. Try ${RETRY("art")}: a pattern, poster or signage system the page can use, for example "ticket rail signage system".`;
  if (!lane) return "It will not come back. To steer the next search, try other words or a directionId.";
  if (lane === "component") {
    return `Try ${RETRY(lane)}: name the product and one part of the screen, for example "banking quick actions ui".`;
  }
  if (lane === "art") {
    if (has("stock_or_shop")) return `Try ${RETRY(lane)}: name the thing itself, not a product, for example "korean bojagi patchwork". Shop listings are left out.`;
    return `Try ${RETRY(lane)}: raw words for the idea, no UI words, for example "persian carpet pattern" or "synthwave poster".`;
  }
  if (lane === "gallery") {
    return `Try ${RETRY(lane)}: one or two topic words, for example "fintech" or "analytics". Galleries match topics, not "app ui".`;
  }
  if (lane === "bridge") {
    return `Try ${RETRY(lane)}: keep the idea's main word and name a screen, for example "vending machine checkout ui". Titles without the idea's main word are left out.`;
  }
  if (has("not_ui") || has("off_topic")) return `Try ${RETRY(lane)}: name the domain and the screen, for example "flight checkout ui design".`;
  if (has("cluttered")) return `Try ${RETRY(lane)}: ask for one screen, for example add "single screen" or a component such as card or widget.`;
  if (has("wrong_style")) return `Try ${RETRY(lane)} with the user's style words, or pass taste.`;
  if (has("stock_or_shop")) return `Try ${RETRY(lane)}: add "ui design" and avoid words like template or kit.`;
  if (has("low_craft")) return `Try ${RETRY(lane)}: add a style word that signals polish, such as minimal or editorial.`;
  return `If more of this lane is off, try ${RETRY(lane)}.`;
}
