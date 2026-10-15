/**
 * Learning for the Atlas engines (W2): what the bend (P1-I2) and search plan v2 (P1-I3) read to
 * weight their draws. Two sources, both pooled under the same rules (each user once, K_ANON,
 * GLOBAL_LEARNING):
 *
 *   nightly   `atlas_weights` kind "atlas" (P2-01): Beta(alpha, beta) per Atlas id, computed once a
 *             night from every user's ratings, so a call does not group the feedback table.
 *   live      `atlasStats` (P1-I6) for this user's own ratings, which count at once (the nightly
 *             table holds no user ids). When the nightly table could not be read, live also
 *             brings the pooled counts.
 *
 * Cards and mechanics are weighted with `atlasWeights` (Beta mean over the prior, floor 0.15);
 * recipes are drawn with `pickRecipe` (Thompson sampling) only when one of the candidates has
 * usable ratings, else the best judged recipe wins as before. Pure apart from `readAtlasLearning`,
 * which fails open: any error gives no learning and the engines behave as without feedback.
 */
import type { FeedbackRepo, NightlyAtlasRow } from "@/lib/db/types";
import { atlasTermKey, K_ANON, pickRecipe, usableCounts, type AtlasStat } from "@/lib/learning/arms";
import { atlasWeights } from "@/lib/learning/directions";
import { WEIGHT_PRIOR } from "@/lib/learning/nightly";
import { recipeId } from "./loader";
import type { QueryRecipe } from "./types";

export type AtlasLearning = {
  /** Pooled and own counts per Atlas term key (`card|...`, `mechanic|...`, `recipe|...`). */
  stats: AtlasStat[];
  /** atlasWeights over `stats`: only ids whose weight is not 1. */
  weights: Map<string, number>;
  /** GLOBAL_LEARNING: false keeps only the user's own ratings. */
  global: boolean;
};

export const NO_LEARNING: AtlasLearning = { stats: [], weights: new Map(), global: true };

/** A k so high only the user's own rows pass the atlasStats filter (the pooled part is nightly). */
export const OWN_ONLY_K = 1_000_000;

/** Nightly rows as counts: alpha and beta minus the prior, counted as K_ANON users, never own. */
export function nightlyStats(rows: readonly NightlyAtlasRow[]): AtlasStat[] {
  return rows.flatMap((r) => {
    const great = Math.max(0, Math.round(r.alpha - WEIGHT_PRIOR.alpha));
    const bad = Math.max(0, Math.round(r.beta - WEIGHT_PRIOR.beta));
    if (!r.termKey || great + bad === 0) return [];
    return [{ termKey: r.termKey, great, bad, users: K_ANON, ownGreat: 0, ownBad: 0 }];
  });
}

/** Live rows win over nightly rows of the same key (they are fresher and carry the user's own counts). */
export function atlasLearning(nightly: readonly NightlyAtlasRow[], live: readonly AtlasStat[], global: boolean): AtlasLearning {
  const byKey = new Map<string, AtlasStat>(nightlyStats(nightly).map((s) => [s.termKey, s]));
  for (const s of live) byKey.set(s.termKey, s);
  const stats = [...byKey.values()];
  return { stats, weights: atlasWeights(stats, { global }), global };
}

/** The weight of one Atlas id (1 when nothing is learned). */
export function idWeight(learning: AtlasLearning | null | undefined, termKey: string): number {
  return learning?.weights.get(termKey) ?? 1;
}

/** Reads the nightly table and the user's own stats. Fails open per source. */
export async function readAtlasLearning(
  feedback: Pick<FeedbackRepo, "atlasStats" | "nightlyAtlas">,
  userId: string | undefined,
  global: boolean,
): Promise<AtlasLearning> {
  if (!userId) return NO_LEARNING;
  let nightly: NightlyAtlasRow[] | null = null;
  if (global) {
    try {
      nightly = await feedback.nightlyAtlas();
    } catch {
      console.error("[atlas] could not read the nightly weights");
    }
  }
  let live: AtlasStat[] = [];
  try {
    live = await feedback.atlasStats(userId, nightly ? OWN_ONLY_K : K_ANON);
  } catch {
    console.error("[atlas] could not read the Atlas stats");
  }
  if (!nightly && live.length === 0) return { ...NO_LEARNING, global };
  return atlasLearning(nightly ?? [], live, global);
}

/**
 * One recipe from `ranked` (best judged first): Thompson sampling over the candidates when any of
 * them has usable ratings, else the first. Same seed and stats, same pick.
 */
export function chooseRecipe(ranked: readonly QueryRecipe[], learning: AtlasLearning | null | undefined, seed: string): QueryRecipe | null {
  if (ranked.length === 0) return null;
  if (!learning || learning.stats.length === 0) return ranked[0]!;
  const byKey = new Map(learning.stats.map((s) => [s.termKey, s]));
  const ids = ranked.map((r) => recipeId(r));
  const learned = ids.some((id) => {
    const s = byKey.get(atlasTermKey("recipe", id));
    const c = s ? usableCounts(s, { global: learning.global }) : null;
    return Boolean(c && c.great + c.bad > 0);
  });
  if (!learned) return ranked[0]!;
  const pick = pickRecipe({
    candidates: ranked.map((r, i) => ({ id: ids[i]!, precision: r.precision, judged: r.judged })),
    stats: learning.stats,
    global: learning.global,
    seed,
  });
  return ranked[ids.indexOf(pick?.id ?? ids[0]!)] ?? ranked[0]!;
}
