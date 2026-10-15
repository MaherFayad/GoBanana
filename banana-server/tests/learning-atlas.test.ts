/**
 * P1-I6: feedback updates Beta weights on Atlas ids (cardId, mechanicId, recipeId), stored as
 * search_feedback rows with lane "atlas" (no new table). "Great" on a reference boosts the card
 * and recipe that found it; a great rating raises the recipe's weight and changes the next draw.
 * Recipe and card ids are a small hand-written fixture (the Atlas data does not exist yet).
 */
import { describe, expect, it } from "vitest";
import { atlasStatsSql } from "@/lib/db/feedback";
import type { IngredientStatRow } from "@/lib/db/types";
import { atlasTermKey, pickRecipe, recipePrior, type RecipeCandidate } from "@/lib/learning/arms";
import { atlasFeedbackRows, atlasWeights, ingredientWeights, referenceAtlasIds, weightedOrder } from "@/lib/learning/directions";
import { createRateDirectionsTool } from "@/lib/mcp/tools/rate_directions";
import { createRateReferencesTool } from "@/lib/mcp/tools/rate_references";
import { PgDialect } from "drizzle-orm/pg-core";
import { ALICE, makeDeps, ref, seedCanvas } from "./tools-fixtures";

const RECIPES: RecipeCandidate[] = [
  { id: "checkout-mobile-concept-1", precision: 0.6, judged: 8 },
  { id: "checkout-mobile-concept-2", precision: 0.6, judged: 8 },
];
const SEEDS = Array.from({ length: 300 }, (_, i) => `alice|2026-10-${i}`);

async function rateGreatOnAtlasReference() {
  const { deps, repos } = makeDeps();
  const canvas = await seedCanvas(repos, ALICE);
  const r = ref(7, { lane: "concept", query: "q", termKey: "concept|q", arm: "default" } as never);
  await repos.references.insertMany(canvas.id, [r]);
  // Search plan v2 (P1-I3) stores the provenance on the row; set it here.
  const row = [...repos.data.references.values()].find((x) => x.resultId === r.id)!;
  row.recipeId = "checkout-mobile-concept-2";
  row.cardId = "kraft-paper";
  const rate = createRateReferencesTool(deps);
  const res = await rate({ canvasId: canvas.id, ratings: [{ referenceId: r.id, verdict: "great" }] }, ALICE);
  expect(res.isError).toBeFalsy();
  return repos;
}

describe("feedback on Atlas ids", () => {
  it("builds one atlas row per id with the rating's verdict", () => {
    const rows = atlasFeedbackRows(
      { userId: ALICE, itemKey: "bd-1", verdict: "great", reasons: [] },
      { cardIds: ["kraft-paper", "neon-sign", "kraft-paper"], mechanicId: "progress-stamp", recipeIds: ["r1"] },
    );
    expect(rows.map((r) => r.termKey)).toEqual(["card|kraft-paper", "card|neon-sign", "mechanic|progress-stamp", "recipe|r1"]);
    for (const r of rows) expect(r).toMatchObject({ lane: "atlas", arm: "atlas", sourceSite: "atlas", verdict: "great", userId: ALICE });
    expect(atlasFeedbackRows({ userId: ALICE, itemKey: "x", verdict: "bad", reasons: [] }, {})).toEqual([]);
  });

  it("a great on a reference boosts its card and recipe; a bad lowers only the recipe", () => {
    expect(referenceAtlasIds({ cardId: "c", recipeId: "r" }, "great")).toEqual({ cardIds: ["c"], recipeIds: ["r"] });
    expect(referenceAtlasIds({ cardId: "c", recipeId: "r" }, "bad")).toEqual({ recipeIds: ["r"] });
    expect(referenceAtlasIds({}, "great")).toEqual({});
  });

  it("rate_references writes atlas rows for the card and recipe that found the result", async () => {
    const repos = await rateGreatOnAtlasReference();
    const atlas = repos.data.feedback.filter((f) => f.lane === "atlas");
    expect(atlas.map((f) => [f.termKey, f.verdict])).toEqual([
      ["card|kraft-paper", "great"],
      ["recipe|checkout-mobile-concept-2", "great"],
    ]);
    // The lane row is still there, and atlas rows never reach the direction stats.
    expect(repos.data.feedback.filter((f) => f.lane === "concept")).toHaveLength(1);
    expect(await repos.feedback.directionStats(ALICE, 3)).toEqual([]);
  });

  it("a great rating raises the recipe's weight and changes the next draw", async () => {
    const before: { stats: IngredientStatRow[] } = { stats: [] };
    const repos = await rateGreatOnAtlasReference();
    const stats = await repos.feedback.atlasStats(ALICE, 3);
    const recipeKey = atlasTermKey("recipe", "checkout-mobile-concept-2");
    expect(stats.find((s) => s.termKey === recipeKey)).toMatchObject({ users: 1, great: 1, ownGreat: 1 });

    // Weight: 1 with no ratings, above 1 after the great one.
    expect(atlasWeights(before.stats, { global: true }).get(recipeKey) ?? 1).toBe(1);
    const weights = atlasWeights(stats, { global: true });
    expect(weights.get(recipeKey)!).toBeGreaterThan(1);
    expect(weights.get(atlasTermKey("card", "kraft-paper"))!).toBeGreaterThan(1);

    // Draw: the rated recipe wins more draws, and for some seeds the very next draw flips to it.
    const draw = (s: typeof stats, seed: string) => pickRecipe({ candidates: RECIPES, stats: s, global: true, seed })!;
    const picks = (s: typeof stats) => SEEDS.filter((seed) => draw(s, seed).id === "checkout-mobile-concept-2").length;
    expect(picks(stats)).toBeGreaterThan(picks(before.stats));
    const flipped = SEEDS.filter((seed) => draw(before.stats, seed).id !== draw(stats, seed).id);
    expect(flipped.length).toBeGreaterThan(0);
    for (const seed of flipped) expect(draw(stats, seed).id).toBe("checkout-mobile-concept-2");
    expect(draw(stats, SEEDS[0]!).learned).toBe(true);
    // Same seed and stats, same draw.
    expect(draw(stats, "fixed")).toEqual(draw(stats, "fixed"));
  });

  it("card weights feed the weighted card order", () => {
    // Twenty users kept kraft-paper and dropped neon-sign: kraft-paper moves ahead of it.
    const weights = atlasWeights(
      [
        { termKey: "card|kraft-paper", great: 20, bad: 0, users: 20, ownGreat: 0, ownBad: 0 },
        { termKey: "card|neon-sign", great: 0, bad: 20, users: 20, ownGreat: 0, ownBad: 0 },
      ],
      { global: true },
    );
    const cards = ["neon-sign", "kraft-paper"];
    expect(weightedOrder(cards, (c) => weights.get(atlasTermKey("card", c)) ?? 1)).toEqual(["kraft-paper", "neon-sign"]);
  });

  it("rate_directions writes atlas rows for the direction's cards, mechanic and recipes", async () => {
    const { deps, repos } = makeDeps();
    const canvas = await seedCanvas(repos, ALICE);
    // The saved detail keeps the Atlas ids (lib/db/detail.ts parseDirectionDetail).
    await repos.directions.upsertMany(canvas.id, [
      {
        bendId: "bd-kraft",
        move: "material",
        title: "Checkout as kraft paper",
        searchQuery: "kraft paper ui",
        detail: { cardIds: ["kraft-paper"], mechanicId: "total-stamp", recipeIds: ["checkout-mobile-concept-1"] },
      },
    ]);
    expect(repos.data.directions[0]!.detail).toMatchObject({ cardIds: ["kraft-paper"], mechanicId: "total-stamp" });
    const rate = createRateDirectionsTool(deps);
    const res = await rate({ canvasId: canvas.id, ratings: [{ directionId: "bd-kraft", verdict: "drop" }] }, ALICE);
    expect(res.isError).toBeFalsy();
    const atlas = repos.data.feedback.filter((f) => f.lane === "atlas");
    expect(atlas.map((f) => [f.termKey, f.verdict])).toEqual([
      ["card|kraft-paper", "bad"],
      ["mechanic|total-stamp", "bad"],
      ["recipe|checkout-mobile-concept-1", "bad"],
    ]);
    const weights = atlasWeights(await repos.feedback.atlasStats(ALICE, 3), { global: true });
    expect(weights.get("card|kraft-paper")!).toBeLessThan(1);
  });

  it("keeps the K_ANON and GLOBAL_LEARNING rules of the other learning", () => {
    const stat = { termKey: "recipe|r", great: 2, bad: 0, users: 2, ownGreat: 0, ownBad: 0 };
    // Two other users: below K_ANON, so nothing reaches this user.
    expect(atlasWeights([stat], { global: true }).size).toBe(0);
    expect(atlasWeights([{ ...stat, users: 3 }], { global: true }).get("recipe|r")!).toBeGreaterThan(1);
    expect(atlasWeights([{ ...stat, users: 3 }], { global: false }).size).toBe(0);
    // Lane and direction keys are not Atlas keys.
    expect(atlasWeights([{ ...stat, users: 3, termKey: "direction|kraft" }], { global: true }).size).toBe(0);
    expect(ingredientWeights([{ ...stat, users: 3, termKey: "direction|kraft" }], { global: true }).size).toBe(1);
  });

  it("uses the recipe's judged precision as its prior", () => {
    expect(recipePrior()).toEqual({ a: 1, b: 1 });
    expect(recipePrior(0.75, 100)).toEqual({ a: 4, b: 2 });
  });

  it("reads atlas stats in one grouped query", () => {
    const q = new PgDialect().sqlToQuery(atlasStatsSql(ALICE, 3));
    expect(q.sql).toContain("lane = 'atlas'");
    expect(q.sql).toContain("group by term_key, user_id");
    expect(q.params).toContain(ALICE);
  });
});
