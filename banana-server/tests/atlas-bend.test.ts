import { beforeAll, describe, expect, it } from "vitest";
import { bendBriefAtlas, parseDomain, parsePage } from "@/lib/atlas/bend";
import { createAtlasLoader, recipeId, ShardLru, type AtlasManifest } from "@/lib/atlas/loader";
import { loaderSource, type AtlasSource } from "@/lib/atlas/source";
import { bendBrief, checkCoherence, queryKey, type BendInput, type BendResult } from "@/lib/bend";
import { CARDS, DOMAINS, PAGES, RECIPES } from "./fixtures/atlas";
import { buildFixtureAtlas, countingFetcher, type ShardFiles } from "./fixtures/atlas-shards";

let manifest: AtlasManifest;
let files: ShardFiles;

beforeAll(async () => {
  ({ manifest, files } = await buildFixtureAtlas());
});

/** One LRU for the file, as one isolate keeps it. */
const lru = new ShardLru();
const source = (budget = 200): AtlasSource => loaderSource(createAtlasLoader({ manifest, fetchShard: countingFetcher(files).fetchShard, budget, ...(budget >= 200 ? { lru } : {}) }));
const cardById = new Map(CARDS.map((c) => [c.id, c]));

const ESIM: BendInput = { brief: "eSIM plan picker for a GCC travel app", wildness: 3, platform: "mobile" };

/** Every check the Phase 0 guarantees ask of one bend. */
function phase0Problems(result: BendResult): string[] {
  const out: string[] = [];
  for (const d of result.directions) out.push(...checkCoherence(d, result.directions));
  const seen = new Map<string, string>();
  for (const d of result.directions) {
    for (const q of d.searchQueries) {
      const k = queryKey(q);
      if (seen.has(k) && seen.get(k) !== d.id) out.push(`shared query ${q}`);
      seen.set(k, d.id);
    }
  }
  return out;
}

describe("bend engine v2 (P1-I2)", () => {
  it("parses the brief into a page, a domain and the product noun", () => {
    expect(parsePage("eSIM plan picker for a GCC travel app", PAGES)?.id).toBe("plan-picker");
    expect(parsePage("flight checkout", PAGES)?.id).toBe("checkout");
    expect(parseDomain("eSIM plan picker for a GCC travel app", DOMAINS)).toMatchObject({ domain: { id: "telecom-travel" }, productNoun: "eSIM" });
    expect(parseDomain("landing page for a coffee shop", DOMAINS)?.domain.id).toBe("food");
    expect(parseDomain("banking onboarding", DOMAINS)).toBeNull();
  });

  it("keeps the lists engine's shape and adds cardIds, mechanicId and recipeIds", async () => {
    const atlas = (await bendBriefAtlas(ESIM, source()))!;
    const lists = bendBrief(ESIM);
    expect(atlas).not.toBeNull();
    expect(atlas.atlas).toEqual({ pageId: "plan-picker", domainId: "telecom-travel", productNoun: "eSIM" });
    expect(atlas.directions).toHaveLength(6);
    const listKeys = Object.keys(lists.directions[0]!).sort();
    for (const d of atlas.directions) {
      for (const k of listKeys) expect(d).toHaveProperty(k);
      expect(Object.keys(d.spec).sort()).toEqual(Object.keys(lists.directions[0]!.spec).sort());
      expect(d.cardIds!.length).toBeGreaterThan(0);
      expect(d.mechanicId).toMatch(/^[a-z-]+-[ab]$/);
      expect(Array.isArray(d.recipeIds)).toBe(true);
      expect(d.id).toMatch(/^bd-[0-9a-z]{8}$/);
      expect(d.title.split(" ").length).toBeLessThanOrEqual(4);
      expect(d.artQueries.length).toBeGreaterThan(0);
    }
    for (const k of Object.keys(lists)) expect(atlas).toHaveProperty(k);
  });

  it("keeps the product noun and Gulf-first, and passes checkCoherence with no shared query", async () => {
    const r = (await bendBriefAtlas(ESIM, source()))!;
    expect(r.subject).toContain("eSIM plan picker");
    expect(phase0Problems(r)).toEqual([]);
    const traditions = r.directions.flatMap((d) => d.cardIds!).map((id) => cardById.get(id)!).filter((c) => c.kind === "tradition");
    expect(traditions.length).toBeGreaterThan(0);
    for (const t of traditions) expect(t.region).toBe("gulf");
    // Gulf-first: the first direction leads with a Gulf craft.
    expect(cardById.get(r.directions[0]!.cardIds![0]!)!.region).toBe("gulf");
    // A recipe without the product or page noun never becomes a query.
    for (const d of r.directions) expect(d.searchQueries).not.toContain("big header app ui");
  });

  it("takes queries and art from recipes, with their ids", async () => {
    const r = (await bendBriefAtlas(ESIM, source()))!;
    const tag = r.directions.find((d) => d.cardIds![0] === "sadu-weaving");
    expect(tag).toBeDefined();
    const art = RECIPES.find((x) => x.key.lane === "art" && x.key.cardId === "sadu-weaving")!;
    expect(tag!.artQueries[0]).toBe(art.query);
    expect(tag!.recipeIds).toContain(recipeId(art));
    const baseline = RECIPES.find((x) => x.key.lane === "baseline")!;
    for (const d of r.directions) expect(d.recipeIds).toContain(recipeId(baseline));
    // Every recipe id points at a real recipe.
    const ids = new Set(RECIPES.map(recipeId));
    for (const d of r.directions) for (const id of d.recipeIds!) expect(ids.has(id)).toBe(true);
  });

  it("is deterministic", async () => {
    expect(await bendBriefAtlas(ESIM, source())).toEqual(await bendBriefAtlas(ESIM, source()));
  });

  it("over many briefs, wildness levels and moves: zero coherence problems, zero shared queries", async () => {
    const briefs = [
      "eSIM plan picker for a GCC travel app",
      "eSIM plan picker",
      "roaming data plan checkout for a Saudi travel app",
      "travel app checkout",
      "landing page for a coffee shop",
      "coffee shop checkout",
      "cafe menu plan picker",
      "eSIM checkout for travellers in Dubai",
    ];
    const moveSets: BendInput["moves"][] = [undefined, ["transplant", "material"], ["lens", "era", "scale"], ["constraint", "transplant"]];
    let bends = 0;
    for (const brief of briefs) {
      for (const wildness of [1, 2, 3, 4, 5] as const) {
        for (const moves of moveSets) {
          const r = await bendBriefAtlas({ brief, wildness, ...(moves ? { moves } : {}), count: 8 }, source());
          if (!r) continue;
          bends++;
          expect(phase0Problems(r), `${brief} w${wildness} ${moves?.join(",")}`).toEqual([]);
        }
      }
    }
    expect(bends).toBeGreaterThan(60);
  }, 30_000);

  it("allows fit 1 only at wildness 4 and 5, and clash families only at 5", async () => {
    const cards = async (w: 1 | 2 | 3 | 4 | 5) =>
      ((await bendBriefAtlas({ brief: "eSIM plan picker", wildness: w, count: 8 }, source()))?.directions ?? []).flatMap((d) => d.cardIds!);
    // exam-sheet: fit 1 for travel and a clash family (printed page).
    for (const w of [1, 2, 3, 4] as const) expect(await cards(w)).not.toContain("exam-sheet");
    // Food: departure board is a clash family with fit 1.
    const food = async (w: 1 | 2 | 3 | 4 | 5) =>
      ((await bendBriefAtlas({ brief: "coffee shop landing page", wildness: w, count: 8 }, source()))?.directions ?? []).flatMap((d) => d.cardIds![0]);
    for (const w of [1, 2, 3, 4] as const) expect(await food(w)).not.toContain("departure-board");
  });

  it("a Gulf brief adds the wider region only from wildness 4, never other regions", async () => {
    for (const w of [1, 2, 3, 4, 5] as const) {
      const r = await bendBriefAtlas({ brief: "eSIM plan picker for a Saudi travel app", wildness: w, count: 8 }, source());
      const regions = (r?.directions ?? []).flatMap((d) => d.cardIds!).map((id) => cardById.get(id)!).filter((c) => c.kind === "tradition").map((c) => c.region);
      for (const region of regions) expect(w < 4 ? ["gulf"] : ["gulf", "mena"]).toContain(region);
    }
  });

  it("a lens pulls its tradition into every direction", async () => {
    const r = (await bendBriefAtlas({ ...ESIM, lens: "sadu" }, source()))!;
    expect(r.lens?.id).toBe("sadu");
    for (const d of r.directions) expect(d.cardIds).toContain("sadu-weaving");
    expect(phase0Problems(r)).toEqual([]);
  });

  it("never puts the mechanic on a protected total or main button", async () => {
    const r = (await bendBriefAtlas({ brief: "eSIM checkout for a travel app", wildness: 4, platform: "mobile", count: 8 }, source()))!;
    for (const d of r.directions) expect(["total", "cta"]).not.toContain(d.mechanic.element);
  });

  it("returns null (lists take over) when the Atlas cannot answer", async () => {
    expect(await bendBriefAtlas({ brief: "banking onboarding", wildness: 3 }, source())).toBeNull();
    const empty = loaderSource(createAtlasLoader({ manifest: { version: "v1", hash: "", shards: [] }, fetchShard: async () => null }));
    expect(await bendBriefAtlas(ESIM, empty)).toBeNull();
    // A spent budget reads as missing shards.
    expect(await bendBriefAtlas(ESIM, source(3))).toBeNull();
  });

  it("missing recipes fall back to the Phase 0 lanes", async () => {
    const noRecipes: AtlasSource = { ...source(), recipes: async () => null };
    const r = (await bendBriefAtlas(ESIM, noRecipes))!;
    expect(r).not.toBeNull();
    for (const d of r.directions) {
      expect(d.recipeIds).toEqual([]);
      expect(d.searchQueries.length).toBeGreaterThan(0);
    }
    expect(phase0Problems(r)).toEqual([]);
  });
});
