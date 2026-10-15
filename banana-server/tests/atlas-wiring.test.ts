/**
 * W2: the Atlas outputs are connected to the loader. cut_parts guesses crops from the page
 * anatomy, export_kit reads the lead and second cards, the bend and search engines weight their
 * draws with atlasStats, atlasWeights, pickRecipe and the nightly atlas_weights table, and the
 * taste profile breaks ties in the Atlas bend. With an empty manifest everything falls back.
 */
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeAll, describe, expect, it } from "vitest";
import { bendBriefAtlas, tieBreaks } from "@/lib/atlas/bend";
import { atlasLearning, chooseRecipe, nightlyStats, NO_LEARNING, OWN_ONLY_K, readAtlasLearning } from "@/lib/atlas/learning";
import { createAtlasLoader, recipeId, type AtlasManifest } from "@/lib/atlas/loader";
import { loaderSource, type AtlasSource } from "@/lib/atlas/source";
import type { IngredientCard, QueryRecipe } from "@/lib/atlas/types";
import { directionCardIds, loadCutAnatomy } from "@/lib/atlas/wiring";
import { nightlyAtlasSql } from "@/lib/db/feedback";
import { K_ANON } from "@/lib/learning/arms";
import { weightCountsSql } from "@/lib/learning/nightly";
import { createCutPartsTool } from "@/lib/mcp/tools/cut_parts";
import { createExportKitTool } from "@/lib/mcp/tools/export_kit";
import { defaultCrop, ROLE_BANDS } from "@/lib/stitch/crop";
import { memorySwipeRepo } from "@/lib/swipe/repo";
import type { BendInput } from "@/lib/bend";
import { CARDS, PAGES } from "./fixtures/atlas";
import { buildFixtureAtlas, countingFetcher, type ShardFiles } from "./fixtures/atlas-shards";
import { ALICE, imageNode, makeDeps, sectionNode, seedCanvas, state, text } from "./tools-fixtures";

let manifest: AtlasManifest;
let files: ShardFiles;
beforeAll(async () => {
  ({ manifest, files } = await buildFixtureAtlas());
});
const source = (): AtlasSource => loaderSource(createAtlasLoader({ manifest, fetchShard: countingFetcher(files).fetchShard, budget: 200 }));
const emptySource = (): AtlasSource => loaderSource(createAtlasLoader({ manifest: { version: "v1", hash: "", shards: [] }, fetchShard: async () => null }));

const ESIM: BendInput = { brief: "eSIM plan picker for a GCC travel app", wildness: 3, platform: "mobile" };
const stat = (termKey: string, great: number, bad: number, users = 5) => ({ termKey, great, bad, users, ownGreat: 0, ownBad: 0 });

describe("Atlas learning (nightly table plus own ratings)", () => {
  it("turns nightly Beta rows into counts and lets live rows win", () => {
    expect(nightlyStats([{ termKey: "card|a", alpha: 7, beta: 3 }, { termKey: "card|b", alpha: 2, beta: 2 }])).toEqual([
      { termKey: "card|a", great: 5, bad: 1, users: K_ANON, ownGreat: 0, ownBad: 0 },
    ]);
    const l = atlasLearning([{ termKey: "card|a", alpha: 2, beta: 12 }], [{ ...stat("card|a", 0, 0, 1), ownGreat: 4 }], true);
    expect(l.stats).toHaveLength(1);
    expect(l.weights.get("card|a")!).toBeGreaterThan(1);
    // GLOBAL_LEARNING off: pooled nightly rows never reach the user.
    expect(atlasLearning([{ termKey: "card|a", alpha: 2, beta: 12 }], [], false).weights.size).toBe(0);
  });

  it("reads the nightly table, then only the user's own stats; fails open", async () => {
    const ks: number[] = [];
    const repo = {
      nightlyAtlas: async () => [{ termKey: "card|a", alpha: 2, beta: 12 }],
      atlasStats: async (_u: string, k: number) => (ks.push(k), []),
    };
    const l = await readAtlasLearning(repo, ALICE, true);
    expect(ks).toEqual([OWN_ONLY_K]);
    expect(l.weights.get("card|a")!).toBeLessThan(1);
    // No nightly table: the live query brings the pooled counts (K_ANON).
    await readAtlasLearning({ ...repo, nightlyAtlas: async () => Promise.reject(new Error("no table")) }, ALICE, true);
    expect(ks).toEqual([OWN_ONLY_K, K_ANON]);
    const broken = { nightlyAtlas: async () => Promise.reject(new Error("x")), atlasStats: async () => Promise.reject(new Error("x")) };
    expect((await readAtlasLearning(broken, ALICE, true)).weights.size).toBe(0);
    expect(await readAtlasLearning(repo, undefined, true)).toBe(NO_LEARNING);
  });

  it("the nightly job writes Atlas ids under kind atlas, and the reader asks for that kind", () => {
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(weightCountsSql(3)).sql).toContain("when lane = 'atlas' then 'atlas'");
    expect(dialect.sqlToQuery(nightlyAtlasSql()).sql).toContain("kind = 'atlas'");
  });

  it("chooseRecipe keeps the best judged recipe without ratings and follows great ratings", () => {
    const r = (q: string, precision: number): QueryRecipe => ({ key: { lane: "concept", cardId: "c" }, query: q, source: "dribbble", precision, judged: 8, at: "2026-10-01" });
    const ranked = [r("best judged", 0.8), r("second", 0.6)];
    expect(chooseRecipe(ranked, null, "s")).toBe(ranked[0]);
    expect(chooseRecipe(ranked, NO_LEARNING, "s")).toBe(ranked[0]);
    const learning = atlasLearning([], [stat(`recipe|${recipeId(ranked[1]!)}`, 40, 0), stat(`recipe|${recipeId(ranked[0]!)}`, 0, 40)], true);
    const picks = Array.from({ length: 50 }, (_, i) => chooseRecipe(ranked, learning, `seed-${i}`)!.query);
    expect(picks.filter((q) => q === "second").length).toBeGreaterThan(40);
  });
});

describe("the Atlas bend weights its draws", () => {
  it("with no learning and no profile the bend is unchanged", async () => {
    const a = await bendBriefAtlas(ESIM, source());
    const b = await bendBriefAtlas(ESIM, source(), { learning: NO_LEARNING, taste: { likedCardIds: [], styleWords: [] } });
    expect(b).toEqual(a);
  });

  it("a dropped lead card sinks, so the next draw changes", async () => {
    const before = (await bendBriefAtlas(ESIM, source()))!;
    const lead = before.directions[0]!.cardIds![0]!;
    const learning = atlasLearning([], [stat(`card|${lead}`, 0, 30)], true);
    const after = (await bendBriefAtlas(ESIM, source(), { learning }))!;
    expect(after.directions[0]!.cardIds![0]).not.toBe(lead);
  });

  it("taste breaks ties between cards of equal fit, never beats a better fit", () => {
    const base = CARDS[0]!;
    const cards: IngredientCard[] = ["a", "b", "c"].map((id) => ({ ...base, id, name: id }));
    const fit = new Map([["a", 2], ["b", 2], ["c", 3]]);
    const plain = tieBreaks(cards, (c) => fit.get(c.id)!, "k", null);
    const liked = tieBreaks(cards, (c) => fit.get(c.id)!, "k", { likedCardIds: ["b"] });
    expect(liked.get("b")!).toBeGreaterThan(liked.get("a")!);
    expect([...plain.keys()].sort()).toEqual(["a", "b", "c"]);
    // relevance = fit / 3 + 0.3 * tie: the liked card stays under the better fit.
    const rel = (id: string) => fit.get(id)! / 3 + 0.3 * liked.get(id)!;
    expect(rel("c")).toBeGreaterThan(rel("b"));
    expect(Math.max(...liked.values())).toBeLessThan(1);
  });
});

describe("cut_parts guesses from the page anatomy", () => {
  async function cutCta(atlas: (() => AtlasSource | null) | undefined) {
    const { deps, repos } = makeDeps();
    const canvas = await seedCanvas(repos, ALICE, state([sectionNode("sec_1", { directionId: "bd-1" }), imageNode("img_1", 1, { parentId: "sec_1" } as never)]));
    await repos.directions.upsertMany(canvas.id, [
      { bendId: "bd-1", move: "material", title: "Kraft", searchQuery: "kraft", detail: { atlas: { cardIds: ["limestone"], recipeIds: [], pageId: "checkout" } } },
    ]);
    const res = await createCutPartsTool({ ...deps, ...(atlas ? { atlasSource: atlas } : {}) })({ canvasId: canvas.id, cuts: [{ itemId: "img_1", role: "cta" }] }, ALICE);
    expect(res.isError).toBeFalsy();
    return (res.structuredContent as { parts: { crop: { x: number; y: number; w: number; h: number } }[] }).parts[0]!.crop;
  }

  it("uses the direction's page bands", async () => {
    const checkout = PAGES.find((p) => p.id === "checkout")!;
    const crop = await cutCta(source);
    expect(crop).toEqual(defaultCrop("cta", { imageWidth: 400, imageHeight: 300, single: false, anatomy: checkout }));
    expect(crop.y).toBeCloseTo(0.85);
  });

  it("falls back to ROLE_BANDS with no Atlas or an empty manifest", async () => {
    expect((await cutCta(undefined)).y).toBeCloseTo(ROLE_BANDS.cta.y);
    expect((await cutCta(emptySource)).y).toBeCloseTo(ROLE_BANDS.cta.y);
    expect((await cutCta(() => null)).y).toBeCloseTo(ROLE_BANDS.cta.y);
  });

  it("a saved swipe part takes the direction's lead card when the agent gives none", async () => {
    const { deps, repos } = makeDeps();
    const swipe = memorySwipeRepo();
    const canvas = await seedCanvas(repos, ALICE, state([sectionNode("sec_1", { directionId: "bd-1" }), imageNode("img_1", 1, { parentId: "sec_1" } as never)]));
    await repos.directions.upsertMany(canvas.id, [
      { bendId: "bd-1", move: "material", title: "Stone", searchQuery: "stone", detail: { atlas: { cardIds: ["limestone"], recipeIds: [] } } },
    ]);
    await createCutPartsTool({ ...deps, swipe: () => swipe })({ canvasId: canvas.id, save: true, cuts: [{ itemId: "img_1", role: "nav", crop: { x: 0, y: 0, w: 1, h: 0.1 } }] }, ALICE);
    expect(swipe.rows[0]).toMatchObject({ cardId: "limestone" });
  });

  it("finds the page from the brief when no direction names one", async () => {
    const cut = await loadCutAnatomy(source(), [], "flight checkout screen");
    expect(cut?.board?.id).toBe("checkout");
    expect(await loadCutAnatomy(emptySource(), [], "flight checkout screen")).toBeNull();
  });
});

describe("export_kit reads the direction's cards", () => {
  async function exportDesign(atlas: (() => AtlasSource | null) | undefined) {
    const { deps, repos } = makeDeps({ plans: { [ALICE]: "pro_monthly" } });
    const canvas = await seedCanvas(repos, ALICE);
    await repos.directions.upsertMany(canvas.id, [
      { bendId: "bd-1", move: "era", title: "Deco", searchQuery: "deco", detail: { platform: "mobile", verdict: "keep", atlas: { cardIds: ["art-deco", "limestone"], recipeIds: [] } } },
    ]);
    const res = await createExportKitTool({ ...deps, ...(atlas ? { atlasSource: atlas } : {}) })({ canvasId: canvas.id, formats: ["design_md"] }, ALICE);
    expect(res.isError).toBeFalsy();
    return text(res);
  }

  it("lists the lead and second card ids", () => {
    expect(directionCardIds([{ detail: { atlas: { cardIds: ["a", "b", "c"], recipeIds: [] } } }, { detail: { atlas: { cardIds: ["b", "d"], recipeIds: [] } } }, { detail: null }])).toEqual(["a", "b", "d"]);
  });

  it("exports the lead card's fonts", async () => {
    expect(await exportDesign(source)).toContain("Poiret One");
  });

  it("falls back to the type voice with no Atlas", async () => {
    expect(await exportDesign(undefined)).not.toContain("Poiret One");
    expect(await exportDesign(emptySource)).not.toContain("Poiret One");
  });
});
