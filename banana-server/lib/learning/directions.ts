/**
 * Direction triage learning (pure, deterministic, no AI). The agent keeps or drops each bend_brief
 * direction with rate_directions; every rating is one search_feedback row (lane "direction",
 * source site "bend", term key `direction|{ingredient}`, arm the move, keep as great and drop as
 * bad). bend_brief then weights each candidate ingredient by its keep rate, so ideas agents keep
 * dropping turn up less often but never vanish.
 *
 * Rules (same as the lane arms in lib/learning/arms.ts):
 * - Ratings reach other users only when at least K_ANON distinct users rated the ingredient, each
 *   user counted once (their net verdict). Below that only the user's own ratings apply, to them.
 * - GLOBAL_LEARNING=off: only the user's own ratings apply.
 * - Weight = keep rate under a Beta(2, 2) prior, divided by the prior mean, floored at 0.15:
 *   an unseen ingredient weighs 1, a kept one up to about 2, an often dropped one 0.15.
 */
import type { NewFeedback } from "../db/types";
import type { FeedbackVerdict } from "./hints";
import { ATLAS_ARM, ATLAS_KINDS, ATLAS_LANE, ATLAS_SOURCE, atlasTermKey, K_ANON, usableCounts, type AtlasKind, type CountStat } from "./arms";

export const DIRECTION_VERDICTS = ["keep", "drop"] as const;
export type DirectionVerdict = (typeof DIRECTION_VERDICTS)[number];

export const DIRECTION_REASONS = [
  "no_ui_path",
  "no_usable_refs",
  "off_brief",
  "duplicate_idea",
  "too_literal",
  "strong_salvage",
  "great_refs",
] as const;
export type DirectionReason = (typeof DIRECTION_REASONS)[number];

/** search_feedback.lane of a direction rating. */
export const DIRECTION_LANE = "direction";
/** search_feedback.source_site of a direction rating. */
export const DIRECTION_SOURCE = "bend";

/** keep is stored as great, drop as bad, so the feedback table needs no new verdict. */
export function directionVerdict(verdict: DirectionVerdict): FeedbackVerdict {
  return verdict === "keep" ? "great" : "bad";
}

/** Beta prior of an ingredient's keep rate: keep + 2, drop + 2. */
export const INGREDIENT_PRIOR = { keep: 2, drop: 2 } as const;
/** Lowest weight an ingredient can have: rare, never impossible. */
export const INGREDIENT_FLOOR = 0.15;

/** Ratings of one ingredient term key (`direction|{ingredient}`), grouped like ArmStat. */
export type IngredientStat = CountStat & { termKey: string };

/** Weight of one ingredient from its usable keep and drop counts (1 when there are none). */
export function ingredientWeight(counts: { great: number; bad: number } | null): number {
  if (!counts || counts.great + counts.bad === 0) return 1;
  const { keep: a, drop: b } = INGREDIENT_PRIOR;
  const mean = (a + counts.great) / (a + b + counts.great + counts.bad);
  return Math.max(INGREDIENT_FLOOR, mean / (a / (a + b)));
}

/**
 * Weight per ingredient term key, for the ingredients whose weight is not 1. Empty means no
 * learning applies, and bend_brief behaves exactly as without feedback.
 */
export function ingredientWeights(
  stats: readonly IngredientStat[],
  opts: { global: boolean; k?: number },
): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of stats) {
    const w = ingredientWeight(usableCounts(s, { global: opts.global, k: opts.k ?? K_ANON }));
    if (w !== 1) out.set(s.termKey, w);
  }
  return out;
}

/**
 * Weighted reorder of an already shuffled list, with no extra random draws: item i gets the
 * stratified uniform u = 1 - (i + 0.5) / n and the key ln(u) / weight (Efraimidis and Spirakis),
 * highest first. With every weight 1 the order is unchanged; a low weight sinks an item, so it
 * is picked less often. Same list and weights, same order.
 */
export function weightedOrder<T>(items: readonly T[], weightOf: (item: T) => number): T[] {
  const n = items.length;
  const weights = items.map(weightOf);
  if (weights.every((w) => w === 1)) return [...items];
  return items
    .map((item, i) => {
      const u = 1 - (i + 0.5) / n;
      const w = weights[i]! > 0 ? weights[i]! : INGREDIENT_FLOOR;
      return { item, i, key: Math.log(u) / w };
    })
    .sort((x, y) => y.key - x.key || x.i - y.i)
    .map((x) => x.item);
}

// ---------- Atlas ids (P1-I6) ----------

/** The Atlas ids a rating lands on: a direction's cards, mechanic and recipes, or a result's card and recipe. */
export type AtlasIds = { cardIds?: readonly string[]; mechanicId?: string | null; recipeIds?: readonly string[] };

/** True for a term key of an Atlas id (`card|...`, `mechanic|...`, `recipe|...`). */
export function isAtlasTermKey(key: string): boolean {
  return ATLAS_KINDS.some((k) => key.startsWith(`${k}|`));
}

/**
 * Extra search_feedback rows for the Atlas ids behind one rating: one row per distinct id, lane
 * "atlas", arm "atlas", the same user, item, verdict and reasons as the rating itself.
 */
export function atlasFeedbackRows(
  rating: Pick<NewFeedback, "userId" | "itemKey" | "verdict" | "reasons">,
  ids: AtlasIds,
): NewFeedback[] {
  const keys = new Set<string>();
  const add = (kind: AtlasKind, id: string | null | undefined) => {
    if (typeof id === "string" && id.trim()) keys.add(atlasTermKey(kind, id));
  };
  for (const id of ids.cardIds ?? []) add("card", id);
  add("mechanic", ids.mechanicId);
  for (const id of ids.recipeIds ?? []) add("recipe", id);
  return [...keys].map((termKey) => ({
    userId: rating.userId,
    itemKey: rating.itemKey,
    sourceSite: ATLAS_SOURCE,
    lane: ATLAS_LANE,
    query: null,
    termKey,
    arm: ATLAS_ARM,
    verdict: rating.verdict,
    reasons: [...rating.reasons],
    creator: null,
  }));
}

/**
 * The Atlas ids a rated search result found it by: a great boosts the card and the recipe ("more
 * like this"); a bad lowers only the recipe, since one junk result says little about the idea.
 */
export function referenceAtlasIds(ref: { cardId?: string | null; recipeId?: string | null }, verdict: FeedbackVerdict): AtlasIds {
  return {
    ...(verdict === "great" && ref.cardId ? { cardIds: [ref.cardId] } : {}),
    ...(ref.recipeId ? { recipeIds: [ref.recipeId] } : {}),
  };
}

/**
 * Beta weight per Atlas term key (card, mechanic, recipe) that is not 1, with the same prior,
 * floor and K_ANON rule as ingredients. Bend engine v2 orders cards and mechanics with
 * `weightedOrder(items, (c) => weights.get(atlasTermKey("card", c.id)) ?? 1)`.
 */
export function atlasWeights(stats: readonly IngredientStat[], opts: { global: boolean; k?: number }): Map<string, number> {
  return ingredientWeights(
    stats.filter((s) => isAtlasTermKey(s.termKey)),
    opts,
  );
}
