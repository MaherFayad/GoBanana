import { beforeAll, describe, expect, it, vi } from "vitest";
import { createAtlasLoader, recipeId, type AtlasManifest } from "@/lib/atlas/loader";
import { atlasSearchPlan, cc0Regions, elementsFor, provenanceFor, searchCc0, SEARCH_SHARD_BUDGET, type AtlasIds } from "@/lib/atlas/search";
import { loaderSource, type AtlasSource } from "@/lib/atlas/source";
import { laneTexts } from "@/lib/bend/queries";
import { queryWords } from "@/lib/learning/terms";
import { createSearchReferencesTool, mergeCc0, type Direction, type SearchReferencesDeps } from "@/lib/mcp/tools/search_references";
import { createMemoryUsageStore } from "@/lib/quota";
import { planRequests, type PlannedRequest } from "@/lib/sources/plan";
import type { Reference } from "@/lib/sources/types";
import type { WebSearchResult } from "@/lib/sources/web-search";
import { compileTakedowns } from "@/lib/takedown";
import type { SavedReference } from "@/lib/db/types";
import { CC0, RECIPES } from "./fixtures/atlas";
import { buildFixtureAtlas, countingFetcher, type ShardFiles } from "./fixtures/atlas-shards";

let manifest: AtlasManifest;
let files: ShardFiles;
beforeAll(async () => {
  ({ manifest, files } = await buildFixtureAtlas());
});

const BRIEF = "eSIM plan picker for a GCC travel app";
const IDS: AtlasIds = { cardIds: ["luggage-tag"], recipeIds: [], pageId: "plan-picker", domainId: "telecom-travel", productNoun: "eSIM" };
const base = () => ({ ...laneTexts(BRIEF, "luggage tag", [], "bd-test", { platform: "mobile", mechanic: "header" }), art: ["luggage tag"] });
const loaderFor = (budget = SEARCH_SHARD_BUDGET) => createAtlasLoader({ manifest, fetchShard: countingFetcher(files).fetchShard, budget });
const recipe = (lane: string, cardId?: string, element?: string) =>
  RECIPES.find((r) => r.key.lane === lane && (!cardId || r.key.cardId === cardId) && (!element || r.key.element === element))!;
const OPTS = { mechanic: "header", market: "gulf" as const, allowImage: () => true, withArt: true };

describe("search plan v2 (P1-I3)", () => {
  it("words the baseline, concept, component and art lanes from recipes", async () => {
    const plan = (await atlasSearchPlan(base(), IDS, loaderSource(loaderFor()), OPTS))!;
    expect(plan.lanes.fidelity).toBe(recipe("baseline").query);
    expect(plan.lanes.bridge).toBe(recipe("concept", "luggage-tag").query);
    expect(plan.lanes.bridgeTitleFilter).toBe(false);
    expect(plan.lanes.component?.[0]).toBe("esim plan picker header app ui");
    // The recipe with no product or page noun never words a UI lane, however precise.
    expect(plan.lanes.component).not.toContain("big header app ui");
    expect(plan.lanes.art?.[0]).toBe(recipe("art", "luggage-tag").query);
    // The taste lane (P0-17) stays as Phase 0 wrote it.
    expect(plan.lanes.taste).toBe(base().taste);
    expect(plan.provenance.map((p) => p.lane).sort()).toEqual(["art", "bridge", "component", "fidelity"]);
    expect(plan.provenance.find((p) => p.lane === "fidelity")?.cardId).toBeUndefined();
    expect(plan.provenance.find((p) => p.lane === "bridge")).toMatchObject({ recipeId: recipeId(recipe("concept", "luggage-tag")), cardId: "luggage-tag" });
  });

  it("the bridge recipe is not filtered by the idea's head word", async () => {
    const plan = (await atlasSearchPlan(base(), IDS, loaderSource(loaderFor()), OPTS))!;
    const bridge = planRequests(plan.lanes, undefined, { zone: "ui" }).find((r) => r.lane === "bridge");
    expect(bridge?.titleWord).toBeUndefined();
    expect(planRequests(base(), undefined, { zone: "ui" }).find((r) => r.lane === "bridge")?.titleWord).toBeDefined();
  });

  it("sends a lane's first request to its recipe's source", () => {
    const lanes = { ...base(), recipeSites: { component: "pinterest" as const } };
    const comps = planRequests(lanes, undefined, { zone: "ui" }).filter((r) => r.lane === "component");
    expect(comps[0]?.site).toBe("pinterest");
    expect(comps.slice(1).every((r) => r.site === "dribbble")).toBe(true);
  });

  it("falls back to the Phase 0 lanes when recipes are missing", async () => {
    const none: AtlasSource = { ...loaderSource(loaderFor()), recipes: async () => [] };
    const plan = (await atlasSearchPlan(base(), { ...IDS, cardIds: ["limestone"], pageId: "landing" }, none, OPTS))!;
    const b = base();
    for (const lane of ["fidelity", "taste", "component", "art"] as const) expect(plan.lanes[lane]).toEqual(b[lane]);
    // R5: with no concept recipe the Phase 0 bridge ("{idea} ui design") is not searched.
    expect(b.bridge).toBeDefined();
    expect(plan.lanes.bridge).toBeUndefined();
    expect(plan.provenance).toEqual([]);
    const unreadable: AtlasSource = { ...loaderSource(loaderFor()), recipes: async () => null };
    expect(await atlasSearchPlan(base(), IDS, unreadable, OPTS)).toBeNull();
  });

  it("searches the CC0 index shards locally, only on allowed image hosts", async () => {
    expect(cc0Regions("gulf")).toEqual(["gulf", "mena", "global"]);
    expect(cc0Regions(null)).toEqual(["global"]);
    const hit = searchCc0(CC0, ["luggage tag"], () => true);
    expect(hit.map((r) => r.title)).toEqual(["Travel label for a steamship line"]);
    expect(hit[0]).toMatchObject({ zone: "art", lane: "art", sourceUrl: "https://www.artic.edu/artworks/2", sourceSite: "artic.edu" });
    expect(searchCc0(CC0, ["luggage tag"], () => false)).toEqual([]);
    const plan = (await atlasSearchPlan(base(), { ...IDS, cardIds: ["sadu-weaving"] }, loaderSource(loaderFor()), { ...OPTS, mechanic: "divider" }))!;
    expect(plan.cc0.map((r) => r.sourceUrl)).toContain("https://www.metmuseum.org/art/collection/search/1");
  });

  it("maps provenance to results by lane and words", async () => {
    const plan = (await atlasSearchPlan(base(), IDS, loaderSource(loaderFor()), OPTS))!;
    expect(provenanceFor({ lane: "bridge", query: queryWords(plan.lanes.bridge!) }, plan, "luggage-tag")).toEqual({ recipeId: recipeId(recipe("concept", "luggage-tag")), cardId: "luggage-tag" });
    expect(provenanceFor({ lane: "taste", query: "dark esim plan ui ios app" }, plan, "luggage-tag")).toEqual({ cardId: "luggage-tag" });
    expect(provenanceFor({ lane: "fidelity", query: "something else" }, plan, "luggage-tag")).toEqual({});
  });

  it("maps elements back from the saved mechanic part", () => {
    expect(elementsFor("header").sort()).toEqual(["header", "hero"]);
    expect(elementsFor(undefined)).toEqual([]);
  });

  it("merges CC0 results into the art zone without going over count", () => {
    const r = (id: string, zone: "ui" | "art"): Reference => ({ id, zone, thumbUrl: "", imageUrl: "", sourceUrl: id, sourceSite: "x" });
    const out = mergeCc0([r("u1", "ui"), r("u2", "ui"), r("a1", "art"), r("a2", "art")], [r("c1", "art")], 4);
    expect(out.map((x) => x.id)).toEqual(["u1", "u2", "c1", "a1"]);
  });
});

describe("search_references with an Atlas direction (P1-I3)", () => {
  const direction: Direction = {
    id: "row-1",
    bendId: "bd-atlas",
    canvasId: "c1",
    searchQuery: "luggage tag",
    brief: BRIEF,
    detail: { platform: "mobile", brief: BRIEF, artQueries: ["luggage tag"], mechanic: { element: "header", how: "Luggage tag as the header" }, atlas: IDS },
  };

  function setup(withAtlas: boolean) {
    const calls = { deps: 0, requests: 0 };
    const saved: SavedReference[] = [];
    const loader = loaderFor();
    const count = <T extends (...a: never[]) => unknown>(fn: T): T => ((...a: never[]) => (calls.deps++, fn(...a))) as T;
    const runPlan = vi.fn(async (plan: readonly PlannedRequest[]): Promise<WebSearchResult> => {
      calls.requests += plan.length;
      const references: Reference[] = plan.flatMap((req, i) =>
        [1, 2].map((n) => ({
          id: `ref_${i}_${n}_${req.lane}`,
          thumbUrl: `https://cdn.dribbble.com/t/${i}-${n}.png`,
          imageUrl: `https://cdn.dribbble.com/i/${i}-${n}.png`,
          sourceUrl: `https://dribbble.com/shots/${req.lane}-${i}-${n}`,
          sourceSite: "dribbble.com",
          title: `shot ${i}`,
          lane: req.lane,
          query: queryWords(req.query),
          zone: req.lane === "art" ? ("art" as const) : ("ui" as const),
        })),
      );
      return { references, ok: true, requests: plan.length };
    });
    const deps: SearchReferencesDeps = {
      adapter: { run: vi.fn(), runPlan } as never,
      usage: createMemoryUsageStore(),
      getPlan: count(async () => "free" as const),
      getDirection: count(async () => direction),
      getCanvasSourceUrls: count(async () => []),
      getBaseline: count(async () => null),
      getUserLearning: count(async () => ({ blocked: [], creatorRatings: [] })),
      getArmStats: count(async () => []),
      addToTray: count(async (_u: string, _c: string, refs: SavedReference[]) => {
        saved.push(...refs);
        return { dropped: [] };
      }),
      loadTakedowns: count(async () => compileTakedowns([])),
      allowImage: () => true,
      upgradeUrl: () => "https://app.example.test/pricing",
      now: () => new Date("2026-10-15T12:00:00Z"),
      ...(withAtlas ? { atlasSource: () => loaderSource(loader) } : {}),
    };
    return { deps, calls, saved, loader };
  }

  it("stores recipe and card provenance on the saved rows and adds CC0 art", async () => {
    const { deps, saved } = setup(true);
    const res = await createSearchReferencesTool(deps)({ directionId: "bd-atlas", canvasId: "c1", count: 16 }, "11111111-1111-4111-8111-111111111111");
    const out = res.structuredContent as { references: Reference[]; lanes: { bridge: string } };
    expect(out.lanes.bridge).toBe(recipe("concept", "luggage-tag").query);
    const bridge = saved.find((r) => r.lane === "bridge");
    expect(bridge).toMatchObject({ recipeId: recipeId(recipe("concept", "luggage-tag")), cardId: "luggage-tag" });
    expect(saved.find((r) => r.lane === "fidelity")?.recipeId).toBe(recipeId(recipe("baseline")));
    expect(saved.find((r) => r.lane === "fidelity")?.cardId).toBeUndefined();
    const cc0 = out.references.find((r) => r.sourceSite === "artic.edu");
    expect(cc0).toMatchObject({ zone: "art", cardId: "luggage-tag" });
    expect(saved.some((r) => r.sourceSite === "artic.edu")).toBe(true);
  });

  it("stays under 50 subrequests per call: Serper requests, database calls and Atlas shards", async () => {
    const { deps, calls, loader } = setup(true);
    await createSearchReferencesTool(deps)({ directionId: "bd-atlas", canvasId: "c1", count: 24 }, "11111111-1111-4111-8111-111111111111");
    // The usage store and quota reads are database calls too: count them generously (4).
    const total = calls.requests + calls.deps + 4 + loader.spent();
    console.log(`[atlas] search subrequests: ${calls.requests} Serper, ${calls.deps + 4} database, ${loader.spent()} Atlas, ${total} in all`);
    expect(loader.spent()).toBeLessThanOrEqual(SEARCH_SHARD_BUDGET);
    expect(total).toBeLessThan(50);
  });

  it("without an Atlas the Phase 0 lanes run and nothing carries provenance", async () => {
    const { deps, saved } = setup(false);
    const res = await createSearchReferencesTool(deps)({ directionId: "bd-atlas", canvasId: "c1" }, "11111111-1111-4111-8111-111111111111");
    const out = res.structuredContent as { lanes: { bridge?: string } };
    expect(out.lanes.bridge).not.toBe(recipe("concept", "luggage-tag").query);
    expect(saved.every((r) => r.recipeId === undefined && r.cardId === undefined)).toBe(true);
  });

  it("R5: a component lane worded for a whole dashboard is not searched", async () => {
    const none: AtlasSource = { ...loaderSource(loaderFor()), recipes: async () => [] };
    const dash = { ...base(), component: ["government services progress bar dashboard ui", "government services status card web app ui"] };
    const plan = (await atlasSearchPlan(dash, { ...IDS, cardIds: ["limestone"], pageId: "landing" }, none, OPTS))!;
    expect(plan.lanes.component).toEqual(["government services status card web app ui"]);
    const only = (await atlasSearchPlan({ ...base(), component: ["services empty state dashboard ui"] }, { ...IDS, cardIds: ["limestone"], pageId: "landing" }, none, OPTS))!;
    expect(only.lanes.component).toBeUndefined();
    expect(planRequests(only.lanes, undefined, { zone: "ui" }).some((r) => r.lane === "component")).toBe(false);
  });
});
