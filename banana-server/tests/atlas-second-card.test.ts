/**
 * Gate 2 round 3b (bench/GATE2-DIAGNOSIS.md): the second card is ranked by the lead's own brief, page
 * and region relevance, keeps the Gulf region rules, never shares the lead's family, and is
 * deterministic. Round 3 drew it by jitter: a tiffin carrier on a Saudi souq sign, an Ankara 1930s
 * texture on Dubai wind towers.
 */
import { describe, expect, it } from "vitest";
import { bendBriefAtlas, rankSeconds, secondRegionOk } from "@/lib/atlas/bend";
import { buildFixtureAtlas, countingFetcher } from "./fixtures/atlas-shards";
import { CARDS } from "./fixtures/atlas";
import { createAtlasLoader } from "@/lib/atlas/loader";
import { loaderSource } from "@/lib/atlas/source";
import type { IngredientCard } from "@/lib/atlas/types";

type C = Pick<IngredientCard, "id" | "name" | "family" | "kind" | "region" | "idea" | "surprise" | "culturalNotes">;
const card = (id: string, name: string, family: string, kind: IngredientCard["kind"], region?: string, notes = ""): C => ({
  id,
  name,
  family,
  kind,
  ...(region ? { region } : {}),
  idea: `${name} as one part of the page.`,
  surprise: "Unexpected in an app.",
  culturalNotes: notes,
});

const souqSign = card("hand-painted-souq-shop-sign", "Hand-Painted Souq Shop Sign", "board or sign", "object", "gulf");
const barjeel = card("emirati-barjeel-wind-towers", "Emirati Barjeel Wind Towers", "architecture and woodwork", "tradition", "gulf");
const tiffin = card("tiffin-carrier", "Tiffin Carrier", "tool, vessel or keepsake", "object", "south-asia", "The stacked steel tiffin carries a home-cooked meal across South Asia.");
const ankara = card("ankara-republic-1930s", "Ankara Republic 1930s", "regional modernism", "era", "mena", "The young Turkish Republic used modernist architecture.");
const milk = card("milk-carton", "Milk Carton", "packaging", "object", "global");
const marble = card("polished-marble", "Polished Marble", "stone and mineral", "material", "global");
const baqala = card("bilingual-baqala-receipt", "Bilingual Baqala Receipt", "paper and print", "object", "gulf");
const fanous = card("fanous", "Fanous Lantern", "light", "object", "mena", "The lantern of Ramadan nights in Cairo.");
const otherSign = card("neon-sign", "Neon Diner Sign", "board or sign", "object", "global");
const rule = card("bars-instead-of-numbers", "Bars Instead of Numbers", "rule", "constraint", "global");

const RAMADAN = "Ramadan offers page for a Saudi food delivery app";
const DUBAI = "luxury real estate listing page for Dubai apartments";

/** Scores that put the foreign card first, as the old jitter could. */
const scoreOf = (best: string) => (c: C) => (c.id === best ? 10 : c.id === "milk-carton" || c.id === "polished-marble" ? 5 : 1);
const pick = (lead: C, pool: C[], brief: string, market: "gulf" | "mena" | null, best: string, used = new Set<string>(), others: C[] = []) =>
  rankSeconds(lead, pool, { brief, market, score: scoreOf(best), used, seed: "k|second|0", others })[0];

describe("second card region rules", () => {
  it("no South Asian tiffin carrier on a Saudi souq sign", () => {
    expect(secondRegionOk(tiffin, RAMADAN, "gulf")).toBe(false);
    expect(pick(souqSign, [tiffin, milk], RAMADAN, "gulf", "tiffin-carrier")!.id).toBe("milk-carton");
  });

  it("no Ankara 1930s texture on the Dubai wind towers", () => {
    expect(secondRegionOk(ankara, DUBAI, "gulf")).toBe(false);
    expect(pick(barjeel, [ankara, marble], DUBAI, "gulf", "ankara-republic-1930s")!.id).toBe("polished-marble");
  });

  it("Gulf and global cards pass on a Gulf brief, and a foreign card passes when the brief asks for it", () => {
    expect(secondRegionOk(baqala, RAMADAN, "gulf")).toBe(true);
    expect(secondRegionOk(milk, RAMADAN, "gulf")).toBe(true);
    expect(secondRegionOk(ankara, "Dubai apartments listing page in an Ankara 1930s style", "gulf")).toBe(true);
    expect(secondRegionOk(tiffin, "lunch box page for a South Asia meal app in Dubai", "gulf")).toBe(true);
    // A card that names the brief's occasion (a Ramadan lantern on a Ramadan brief).
    expect(secondRegionOk(fanous, RAMADAN, "gulf")).toBe(true);
    expect(secondRegionOk(fanous, DUBAI, "gulf")).toBe(false);
  });

  it("a MENA brief takes MENA cards; a brief with no market takes any region", () => {
    expect(secondRegionOk(ankara, "offers page for an Egyptian grocery app", "mena")).toBe(true);
    expect(secondRegionOk(tiffin, "offers page for an Egyptian grocery app", "mena")).toBe(false);
    expect(secondRegionOk(tiffin, "coffee shop landing page", null)).toBe(true);
  });
});

describe("second card ranking", () => {
  it("ranks by the lead's relevance score, not by jitter", () => {
    expect(pick(souqSign, [milk, baqala, rule], RAMADAN, "gulf", "bilingual-baqala-receipt")!.id).toBe("bilingual-baqala-receipt");
    expect(pick(souqSign, [milk, baqala, rule], RAMADAN, "gulf", "milk-carton")!.id).toBe("milk-carton");
  });

  it("never the lead's family or a card sharing a name word with it; rule cards are allowed", () => {
    const r = rankSeconds(souqSign, [otherSign, rule], { brief: RAMADAN, market: "gulf", score: () => 1, used: new Set(), seed: "s" });
    expect(r.map((c) => c.id)).toEqual(["bars-instead-of-numbers"]);
    const shopName = card("shop-shutter", "Shop Shutter", "metal", "object", "global");
    expect(rankSeconds(souqSign, [shopName], { brief: RAMADAN, market: "gulf", score: () => 1, used: new Set(), seed: "s" })).toEqual([]);
  });

  it("a card another direction took, or one sharing a name word with another lead, comes after", () => {
    expect(pick(souqSign, [milk, baqala], RAMADAN, "gulf", "milk-carton", new Set(["milk-carton"]))!.id).toBe("bilingual-baqala-receipt");
    const milkLead = card("milk-bottle", "Milk Bottle", "glass", "object", "global");
    expect(pick(souqSign, [milk, baqala], RAMADAN, "gulf", "milk-carton", new Set(), [milkLead])!.id).toBe("bilingual-baqala-receipt");
  });

  it("is deterministic: equal scores break by the seed, then the id", () => {
    const pool = [milk, marble, baqala, rule];
    const a = rankSeconds(souqSign, pool, { brief: RAMADAN, market: "gulf", score: () => 1, used: new Set(), seed: "x" }).map((c) => c.id);
    const b = rankSeconds(souqSign, [...pool].reverse(), { brief: RAMADAN, market: "gulf", score: () => 1, used: new Set(), seed: "x" }).map((c) => c.id);
    expect(a).toEqual(b);
  });
});

describe("second card in the bend", () => {
  async function source() {
    const { manifest, files } = await buildFixtureAtlas();
    return loaderSource(createAtlasLoader({ manifest, fetchShard: countingFetcher(files).fetchShard, budget: 400 }));
  }

  it("never shares the lead's family and repeats exactly for the same brief", async () => {
    const cards = new Map<string, IngredientCard>(CARDS.map((c) => [c.id, c]));
    let seconds = 0;
    for (const brief of ["eSIM plan picker for a GCC travel app", "coffee shop landing page"]) {
      const run = async () => (await bendBriefAtlas({ brief, wildness: 4, count: 6 }, await source()))!.directions.map((d) => d.cardIds!);
      const ids = await run();
      expect(await run()).toEqual(ids);
      for (const [lead, second] of ids) {
        if (!second) continue;
        seconds++;
        expect(cards.get(second)!.family).not.toBe(cards.get(lead!)!.family);
        if (brief.includes("GCC")) expect(["gulf", "global", undefined]).toContain(cards.get(second)!.region);
      }
    }
    expect(seconds).toBeGreaterThan(0);
  });
});
