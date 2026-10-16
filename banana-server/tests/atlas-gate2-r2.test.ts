/**
 * Gate 2 round 2 (bench/GATE2-DIAGNOSIS.md): page fit (J4b) picks the lead card, rule and layout
 * cards are never the lead, J7 page recipes carry a topic slot, one deep shared request per board,
 * and the Bench wires the CC0 index as the live tool does.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { emptyState, parseState } from "@/canvas/state";
import { MAX_BASELINE_POOL, type CanvasState } from "@/canvas/types";
import { bendBriefAtlas, briefTopic, cardSpec, isRuleCard, leadFit, PAGE_UNJUDGED_DROP } from "@/lib/atlas/bend";
import { bucketOf, createAtlasLoader, recipeId, recipeKeyString, sha256Hex, shardPath, type AtlasKind, type AtlasManifest, type ManifestShard } from "@/lib/atlas/loader";
import { fillRecipes, fillTopic, recipeHoldsTopic, TOPIC_SLOT, topicTemplate } from "@/lib/atlas/recipe-fit";
import { atlasSearchPlan, searchCc0 } from "@/lib/atlas/search";
import { loaderSource, type AtlasSource } from "@/lib/atlas/source";
import type { CC0Item, DomainEntry, PageFitScore, QueryRecipe } from "@/lib/atlas/types";
import { createSearchReferencesTool, type Direction, type SearchReferencesDeps } from "@/lib/mcp/tools/search_references";
import { createMemoryUsageStore } from "@/lib/quota";
import { deepenBaseline, mergeBaseline, POOL_LANES, POOL_SHARE, poolOf, takeFromPool, withPoolShare } from "@/lib/sources/baseline";
import type { LaneTexts, PlannedRequest } from "@/lib/sources/plan";
import { writeSearchTray } from "@/lib/sources/tray";
import type { LaneName, Reference } from "@/lib/sources/types";
import { leftoverOf, type PlanSearchResult, type RunPlanOptions } from "@/lib/sources/web-search";
import { CARDS, RECIPES } from "./fixtures/atlas";
import { countingFetcher, FIXTURE_BUCKETS, fixtureShardRows } from "./fixtures/atlas-shards";

const cardById = new Map(CARDS.map((c) => [c.id, c]));

/** The fixture Atlas with extra or replaced shards of a kind. */
async function atlasWith(extra: Partial<Record<AtlasKind, Map<string, unknown[]>>>): Promise<AtlasSource> {
  const rows = fixtureShardRows();
  for (const [kind, byName] of Object.entries(extra)) rows.set(kind as AtlasKind, byName!);
  const files = new Map<string, string>();
  const shards: ManifestShard[] = [];
  for (const [kind, byName] of rows) {
    for (const [shard, list] of byName) {
      const text = JSON.stringify(list);
      files.set(shardPath("v1", kind, shard), text);
      shards.push({ kind, shard, sha256: await sha256Hex(text), bytes: text.length });
    }
  }
  const manifest: AtlasManifest = { version: "v1", hash: await sha256Hex(shards.map((s) => s.sha256).join("")), shards };
  return loaderSource(createAtlasLoader({ manifest, fetchShard: countingFetcher(files).fetchShard, budget: 400 }));
}

const pf = (cardId: string, score: PageFitScore["score"], reason?: string, pageId = "plan-picker"): PageFitScore => ({ cardId, domainId: "telecom-travel", pageId, score, ...(reason ? { reason } : {}) });

describe("rule and layout cards", () => {
  it("a constraint, or an element card that is a UI part, is a rule card", () => {
    expect(isRuleCard({ kind: "constraint", family: "layout rule" })).toBe(true);
    expect(isRuleCard({ kind: "element", family: "controls and UI bits" })).toBe(true);
    expect(isRuleCard({ kind: "element", family: "glyphs and punctuation" })).toBe(false);
    expect(isRuleCard({ kind: "object", family: "printed card, cover or ticket" })).toBe(false);
  });

  it("never leads a direction, at any wildness, even when its page fit is the best", async () => {
    const source = await atlasWith({ "page-fit": new Map([["telecom-travel", [pf("one-typeface", 3, "one face for every plan row"), pf("giant-numerals", 1)]]]) });
    for (const wildness of [1, 2, 3, 4, 5] as const) {
      const r = (await bendBriefAtlas({ brief: "eSIM plan picker", wildness, count: 8 }, source))!;
      for (const d of r.directions) expect(d.cardIds![0]).not.toBe("one-typeface");
    }
  });

  it("as the second card it adds its rule to the layout, not its texture or motion", () => {
    const lead = cardById.get("luggage-tag")!;
    const rule = cardById.get("one-typeface")!;
    const spec = cardSpec({ pick: { lead, second: rule, adds: "rule" }, platform: "mobile", arabic: false, element: "header", mechanic: null, how: "Tag strings hold the header", pageLabel: "plan picker", why: "Tags fit trips" });
    expect(spec.layout).toContain("one rule from One typeface only");
    expect(spec.texture).not.toContain("One typeface only");
    expect(spec.motion).not.toContain("One typeface only");
  });
});

describe("page fit (J4b) picks the lead card", () => {
  it("leadFit: the page score when judged, the domain fit less one when not, the domain fit with no page fit", () => {
    expect(leadFit(2, 3)).toBe(3);
    expect(leadFit(3, 1)).toBe(1);
    expect(leadFit(3, null)).toBe(3 - PAGE_UNJUDGED_DROP);
    expect(leadFit(3, undefined)).toBe(3);
    expect(leadFit(0, null)).toBe(0);
  });

  it("the card judged 3 for the page leads, and its page reason is the why", async () => {
    // Domain fit: boarding pass, luggage tag and departure board are all 3; the page fit sets them apart.
    const rows = [pf("boarding-pass", 3, "boarding pass rows list each plan"), pf("luggage-tag", 1), pf("departure-board", 2, "split flap price per plan")];
    const source = await atlasWith({ "page-fit": new Map([["telecom-travel", rows]]) });
    const r = (await bendBriefAtlas({ brief: "eSIM plan picker", wildness: 2, count: 3 }, source))!;
    expect(r.directions[0]!.cardIds![0]).toBe("boarding-pass");
    expect(r.directions[0]!.spec.whyItFits).toBe("Boarding pass rows list each plan.");
    // A card judged 1 on the page does not lead the first direction any more.
    expect(r.directions[0]!.cardIds![0]).not.toBe("luggage-tag");
  });

  it("rows for another page change nothing, and no page fit shard keeps the bend as it was", async () => {
    const plain = await atlasWith({});
    const other = await atlasWith({ "page-fit": new Map([["telecom-travel", [pf("boarding-pass", 3, "boarding pass as the pay step", "checkout")]]]) });
    const input = { brief: "eSIM plan picker", wildness: 2 as const, count: 3 };
    expect(await bendBriefAtlas(input, other)).toEqual(await bendBriefAtlas(input, plain));
  });
});

describe("J7 topic slot", () => {
  it("puts the slot before the page words, longest phrase first, else in front", () => {
    expect(topicTemplate("dark minimal pricing page website ui", ["pricing page"])).toBe(`dark minimal ${TOPIC_SLOT} pricing page website ui`);
    expect(topicTemplate("pricing page", ["pricing page"])).toBe(`${TOPIC_SLOT} pricing page`);
    expect(topicTemplate("dark bank onboarding ui ios app", ["bank account opening", "bank onboarding"])).toBe(`dark ${TOPIC_SLOT} bank onboarding ui ios app`);
    expect(topicTemplate("welcome screen ui ios app", ["bank onboarding"])).toBe(`${TOPIC_SLOT} welcome screen ui ios app`);
    expect(topicTemplate(`${TOPIC_SLOT} pricing page`, ["pricing page"])).toBe(`${TOPIC_SLOT} pricing page`);
  });

  it("fills the slot with the topic, leaving out words the wording already says", () => {
    expect(fillTopic(`dark minimal ${TOPIC_SLOT} pricing page website ui`, "analytics SaaS")).toBe("dark minimal analytics SaaS pricing page website ui");
    expect(fillTopic(`${TOPIC_SLOT} flight checkout app ui`, "flight")).toBe("flight checkout app ui");
    expect(fillTopic(`${TOPIC_SLOT} offers page ui ios app`, null)).toBe("offers page ui ios app");
    expect(fillTopic("no slot here", "coffee")).toBe("no slot here");
  });

  it("a filled template passes the round 1 recipe guard that a page-only wording fails", () => {
    const ok = recipeHoldsTopic({ productNoun: "coffee shop", topic: "coffee shop", pageId: "landing-page" });
    expect(ok("dark minimal landing page website ui")).toBe(false);
    expect(ok(fillTopic(`dark minimal ${TOPIC_SLOT} landing page website ui`, "coffee shop"))).toBe(true);
    const filled = fillRecipes([{ query: `${TOPIC_SLOT} landing page` }, { query: "brass dallah" }], "coffee shop");
    expect(filled.map((r) => r.query)).toEqual(["coffee shop landing page", "brass dallah"]);
  });

  it("the bend and the search plan fill the same wording, so the plan uses the recipe the bend chose", async () => {
    const templated: QueryRecipe[] = RECIPES.map((r) => (r.key.lane === "baseline" ? { ...r, query: `${TOPIC_SLOT} plan picker app ui` } : r));
    const byBucket = new Map<string, unknown[]>();
    for (let i = 0; i < FIXTURE_BUCKETS.recipes; i++) byBucket.set(String(i).padStart(2, "0"), []);
    for (const r of templated) byBucket.get(bucketOf(recipeKeyString(r.key), FIXTURE_BUCKETS.recipes))!.push(r);
    const source = await atlasWith({ recipes: byBucket });
    const bend = (await bendBriefAtlas({ brief: "eSIM plan picker for a GCC travel app", wildness: 3, platform: "mobile" }, source))!;
    const filled = { ...templated.find((r) => r.key.lane === "baseline")!, query: "eSIM plan picker app ui" };
    for (const d of bend.directions) expect(d.recipeIds).toContain(recipeId(filled));
    const d = bend.directions[0]!;
    const base: LaneTexts = { idea: d.searchQuery, platform: "mobile", fidelity: "esim plan picker app ui", topic: "eSIM plan" } as LaneTexts;
    const plan = (await atlasSearchPlan(base, { cardIds: d.cardIds!, recipeIds: d.recipeIds!, pageId: "plan-picker", domainId: "telecom-travel", productNoun: "eSIM" }, source, { market: "gulf", allowImage: () => true, withArt: false }))!;
    expect(plan.lanes.fidelity).toBe("eSIM plan picker app ui");
    expect(plan.provenance.find((p) => p.lane === "fidelity")?.recipeId).toBe(recipeId(filled));
  });
});

describe("the topic a template is filled with", () => {
  const dom = (names: string[]): DomainEntry => ({ id: "d", names: { en: names, ar: [] }, productNouns: [], audience: "", fitsFamilies: [], clashFamilies: [] });
  it("the product noun, else the longest domain name, else shared name words, else the subject", () => {
    expect(briefTopic("eSIM plan picker for a GCC travel app", dom(["telecom"]), "esim", "esim plan")).toBe("eSIM");
    expect(briefTopic("Ramadan offers page for a Saudi food delivery app", dom(["food delivery", "meal delivery"]), null, "ramadan offers")).toBe("food delivery");
    expect(briefTopic("luxury real estate listing page for Dubai apartments", dom(["real estate", "property"]), null, "estate listing")).toBe("real estate");
    expect(briefTopic("kids reading app home screen", dom(["kids learning", "children's reading apps"]), null, "kids reading")).toBe("kids reading");
    expect(briefTopic("fitness app empty state", dom(["fitness and gyms", "gym app"]), null, "fitness empty")).toBe("fitness");
    expect(briefTopic("a page", dom(["coffee shop"]), null, "page")).toBe("page");
  });
});

describe("CC0 index matching", () => {
  const item = (title: string, motif: string[], culture = ""): CC0Item => ({ id: title, museum: "met", title, culture, imageUrl: `https://images.metmuseum.org/${encodeURIComponent(title)}.jpg`, pageUrl: `https://www.metmuseum.org/art/${encodeURIComponent(title)}`, steal: [], motif, rights: { flag: "isPublicDomain", value: "true" } });
  it("needs two shared words or one telling word; weak museum words and years never match alone", () => {
    const items = [item("Pierced Globe", ["medallion"]), item("Single Leaf Excised from a Gospel Book", ["figures"]), item("Millefiori Glass Tile Fragments", ["checker"]), item("Woven band with stripes", ["sadu", "weaving"])];
    const titles = (art: string[]) => searchCc0(items, art, () => true, 4).map((r) => r.title);
    expect(titles(["desk globe"])).toEqual(["Pierced Globe"]);
    expect(titles(["saz leaf tile"])).toEqual([]);
    expect(titles(["karak tea glass"])).toEqual([]);
    expect(titles(["Swiss Style 1960s"])).toEqual([]);
    expect(titles(["al sadu weaving bands"])).toEqual(["Woven band with stripes"]);
  });
});

// ---------------------------------------------------------------------------------------------
// One deep shared request per board

const req = (lane: LaneName, query: string, page?: number): PlannedRequest => ({ lane, query, site: "dribbble", ...(page ? { page } : {}) }) as PlannedRequest;
const r = (id: string, lane: LaneName = "fidelity", zone: "ui" | "art" = "ui"): Reference => ({
  id,
  thumbUrl: `https://cdn.dribbble.com/t/${id}.png`,
  imageUrl: `https://cdn.dribbble.com/i/${id}.png`,
  sourceUrl: `https://dribbble.com/shots/${id}`,
  sourceSite: "dribbble.com",
  title: id,
  lane,
  zone,
});

describe("one deep shared request per board: helpers", () => {
  it("deepenBaseline adds the fidelity page 2 right after page 1, within the request cap", () => {
    const plan = [req("taste", "t"), req("fidelity", "f"), req("component", "c"), req("bridge", "b")];
    expect(deepenBaseline(plan, 8).map((x) => `${x.lane}:${x.page ?? 1}`)).toEqual(["taste:1", "fidelity:1", "fidelity:2", "component:1", "bridge:1"]);
    expect(deepenBaseline(plan, 4).map((x) => x.lane)).toEqual(["taste", "fidelity", "fidelity", "component"]);
    expect(deepenBaseline([req("taste", "t")], 8)).toHaveLength(1);
    const twice = deepenBaseline(deepenBaseline(plan, 8), 8);
    expect(twice.filter((x) => x.lane === "fidelity")).toHaveLength(2);
  });

  it("leftoverOf keeps the pool lanes' unplaced results, best first, nothing placed or repeated", () => {
    const lists = new Map<LaneName, Reference[]>([
      ["fidelity", [r("f1"), r("f2"), r("f3")]],
      ["taste", [r("t1", "taste"), r("f2", "taste")]],
      ["component", [r("c1", "component")]],
    ]);
    // Lane by lane in rank order: f1 is placed, so the taste lane's first comes first.
    expect(leftoverOf(lists, POOL_LANES, [r("f1")]).map((x) => x.id)).toEqual(["t1", "f2", "f3"]);
  });

  it("takeFromPool skips what is on the canvas or blocked and takes POOL_SHARE", () => {
    const pool = poolOf([r("p1"), r("p2"), r("p3"), r("p4"), r("p5"), r("p6")]);
    const taken = takeFromPool(pool, ["https://dribbble.com/shots/p1"], [], POOL_SHARE);
    expect(taken.map((x) => x.id)).toEqual(["p2", "p3", "p4", "p5"]);
    expect(taken.every((x) => x.lane === "fidelity" && x.zone === "ui")).toBe(true);
    expect(poolOf(Array.from({ length: 40 }, (_, i) => r(`x${i}`)))).toHaveLength(MAX_BASELINE_POOL);
  });

  it("withPoolShare alternates pooled and own UI results, keeps every art result and the count", () => {
    const own = [r("u1", "component"), r("u2", "component"), r("u3", "bridge"), r("a1", "art", "art")];
    const out = withPoolShare(own, [r("p1"), r("p2")], 5);
    expect(out.map((x) => x.id)).toEqual(["p1", "u1", "p2", "u2", "a1"]);
    expect(withPoolShare(own, [], 5)).toEqual(own);
    // With no UI of its own, pooled results push out art past the art quota (a third of count, at least 3).
    const artOnly = Array.from({ length: 11 }, (_, i) => r(`a${i}`, "art", "art"));
    const filled = withPoolShare(artOnly, [r("p1"), r("p2"), r("p3"), r("p4")], 12);
    expect(filled.filter((x) => x.zone === "ui").map((x) => x.id)).toEqual(["p1", "p2", "p3", "p4"]);
    expect(filled.filter((x) => x.zone === "art")).toHaveLength(8);
    // A pooled result the direction already found is not added twice.
    expect(withPoolShare(own, [r("u1", "fidelity")], 12).filter((x) => x.id === "u1")).toHaveLength(1);
  });

  it("the canvas state keeps the pool (https only) and a fresh merge does not lose it", () => {
    const pool = poolOf([r("p1"), r("p2")]);
    const state: CanvasState = { ...emptyState(), baseline: { key: "mobile|x", referenceIds: ["a"], at: "2026-10-16T00:00:00.000Z", pool: [...pool, { ...pool[0]!, id: "bad", imageUrl: "http://x.test/a.png" }] } };
    const back = parseState(JSON.parse(JSON.stringify(state))).baseline!;
    expect(back.pool!.map((p) => p.id)).toEqual(["p1", "p2"]);
    const merged = mergeBaseline(back, { key: "mobile|x", referenceIds: ["b"], at: "2026-10-16T01:00:00.000Z" }, new Date("2026-10-16T02:00:00.000Z"));
    expect(merged.pool!.map((p) => p.id)).toEqual(["p1", "p2"]);
  });
});

describe("one deep shared request per board: on a canvas", () => {
  const BRIEF = "eSIM plan picker for a GCC travel app: pick a destination data plan, compare GB and days, buy";
  const direction = (bendId: string, idea: string): Direction => ({
    id: `row-${bendId}`,
    bendId,
    canvasId: "c1",
    searchQuery: idea,
    brief: BRIEF,
    detail: { platform: "mobile", brief: BRIEF, artQueries: [idea] } as never,
  });
  const DIRS: Record<string, Direction> = { "bd-a": direction("bd-a", "letterpress texture"), "bd-b": direction("bd-b", "exhibition catalog"), "bd-c": direction("bd-c", "ruler ticks") };

  /** Each request answers 3 results; the merge places only the first of each fidelity and taste request. */
  function answer(plan: readonly PlannedRequest[], opts: RunPlanOptions): PlanSearchResult {
    const all = plan.flatMap((q, i) => [0, 1, 2].map((j) => r(`ref_${q.lane}_${q.page ?? 1}_${i}_${j}`, q.lane, q.lane === "art" ? "art" : "ui")));
    const placed = all.filter((x) => !(POOL_LANES.includes(x.lane!) && !x.id.endsWith("_0")));
    const lists = new Map<LaneName, Reference[]>();
    for (const x of all) lists.set(x.lane!, [...(lists.get(x.lane!) ?? []), x]);
    return { references: placed, ok: true, requests: plan.length, ...(opts.poolLanes ? { leftover: leftoverOf(lists, opts.poolLanes, placed) } : {}) };
  }

  function board() {
    let state: CanvasState = emptyState();
    const runPlan = vi.fn(async (plan: readonly PlannedRequest[], opts: RunPlanOptions) => answer(plan, opts));
    const deps: SearchReferencesDeps = {
      adapter: { run: vi.fn(), runPlan } as never,
      usage: createMemoryUsageStore(),
      getPlan: async () => "free",
      getDirection: async (_u, id) => DIRS[id] ?? null,
      addToTray: async (_u, _c, refs, directionId, opts) => {
        const written = writeSearchTray(state, refs, directionId, opts?.baseline);
        state = written.state;
        return { dropped: written.dropped };
      },
      getBaseline: async () => parseState(JSON.parse(JSON.stringify(state))).baseline ?? null,
      getCanvasSourceUrls: async () => state.tray.map((t) => t.sourceUrl),
      upgradeUrl: () => "https://example.test/pricing",
      now: () => new Date("2026-10-16T12:00:00Z"),
    };
    return { tool: createSearchReferencesTool(deps), runPlan, state: () => state };
  }

  it("the first search asks the fidelity page 2 and pools what it did not place; later ones take a share and send it again never", async () => {
    const { tool, runPlan, state } = board();
    await tool({ directionId: "bd-a", canvasId: "c1" }, "u1");
    const first = runPlan.mock.calls[0]!;
    const at = first[0].findIndex((x) => x.lane === "fidelity");
    expect(first[0][at + 1]).toMatchObject({ lane: "fidelity", query: first[0][at]!.query, site: first[0][at]!.site, page: 2 });
    expect(first[0].filter((x) => x.page === 2)).toHaveLength(1);
    expect(first[1].poolLanes).toEqual(POOL_LANES);
    const pool = state().baseline!.pool!;
    expect(pool.length).toBeGreaterThan(POOL_SHARE);

    const b = await tool({ directionId: "bd-b", canvasId: "c1" }, "u1");
    const c = await tool({ directionId: "bd-c", canvasId: "c1" }, "u1");
    const sent = runPlan.mock.calls.slice(1).flatMap((call) => call[0]);
    expect(sent.some((x) => x.lane === "fidelity")).toBe(false);
    expect(runPlan.mock.calls.slice(1).every((call) => call[1].poolLanes === undefined)).toBe(true);
    const idsOf = (res: Awaited<ReturnType<typeof tool>>) => (res.structuredContent as { references: Reference[] }).references.map((x) => x.id);
    const poolIds = new Set(pool.map((p) => p.id));
    const bPooled = idsOf(b).filter((id) => poolIds.has(id));
    const cPooled = idsOf(c).filter((id) => poolIds.has(id));
    // Pooled and own UI results alternate within the UI room, so up to POOL_SHARE land.
    for (const list of [bPooled, cPooled]) {
      expect(list.length).toBeGreaterThan(1);
      expect(list.length).toBeLessThanOrEqual(POOL_SHARE);
    }
    // Each pooled result goes to one direction.
    expect(bPooled.filter((id) => cPooled.includes(id))).toEqual([]);
    expect(state().tray.filter((t) => bPooled.includes(t.id)).every((t) => t.directionId === "bd-b")).toBe(true);
  });
});

describe("an empty fidelity lane is still saved", () => {
  it("a later direction never sends the empty lane again", async () => {
    // Reuse the board of the block above through a fresh describe: the same directions and fake adapter.
    const BRIEF = "eSIM plan picker for a GCC travel app: pick a destination data plan, compare GB and days, buy";
    const dirs: Record<string, Direction> = {
      "bd-a": { id: "row-a", bendId: "bd-a", canvasId: "c1", searchQuery: "letterpress texture", brief: BRIEF, detail: { platform: "mobile", brief: BRIEF, artQueries: ["letterpress"] } as never },
      "bd-b": { id: "row-b", bendId: "bd-b", canvasId: "c1", searchQuery: "ruler ticks", brief: BRIEF, detail: { platform: "mobile", brief: BRIEF, artQueries: ["ruler"] } as never },
    };
    let state: CanvasState = emptyState();
    const runPlan = vi.fn(async (plan: readonly PlannedRequest[]) => ({
      references: plan.filter((q) => q.lane !== "fidelity").map((q, i) => r(`x_${q.lane}_${i}_${q.query.length}`, q.lane, q.lane === "art" ? "art" : "ui")),
      ok: true,
      requests: plan.length,
    }));
    const tool = createSearchReferencesTool({
      adapter: { run: vi.fn(), runPlan } as never,
      usage: createMemoryUsageStore(),
      getPlan: async () => "free",
      getDirection: async (_u, id) => dirs[id] ?? null,
      addToTray: async (_u, _c, refs, directionId, opts) => {
        const written = writeSearchTray(state, refs, directionId, opts?.baseline);
        state = written.state;
        return { dropped: written.dropped };
      },
      getBaseline: async () => parseState(JSON.parse(JSON.stringify(state))).baseline ?? null,
      upgradeUrl: () => "https://example.test/pricing",
      now: () => new Date("2026-10-16T12:00:00Z"),
    } as SearchReferencesDeps);
    await tool({ directionId: "bd-a", canvasId: "c1" }, "u1");
    expect(state.baseline?.referenceIds).toEqual([]);
    const res = await tool({ directionId: "bd-b", canvasId: "c1" }, "u1");
    expect(runPlan.mock.calls[1]![0].some((q) => q.lane === "fidelity")).toBe(false);
    expect(res.content.map((c) => c.text).join("\n")).not.toContain("Shipped today");
  });
});

describe("the Bench wires the CC0 index as the live tool does", () => {
  it("passes the image host check and the takedown list to search_references", () => {
    const src = readFileSync(join(__dirname, "..", "scripts", "bench-run.mjs"), "utf8");
    expect(src).toMatch(/allowImage: \(url\) => isAllowedImageUrl\(url, allowlistFromEnv\(\)\)/);
    expect(src).toMatch(/loadTakedowns: async \(\) => matcher/);
  });

  it("museum hosts pass the default image host check", async () => {
    const { allowlistFromEnv, isAllowedImageUrl } = await import("@/lib/sources/allowlist");
    expect(isAllowedImageUrl("https://images.metmuseum.org/CRDImages/is/web-large/band.jpg", allowlistFromEnv(""))).toBe(true);
    expect(isAllowedImageUrl("https://openaccess-cdn.clevelandart.org/1916.1/1916.1_web.jpg", allowlistFromEnv(""))).toBe(true);
  });
});

