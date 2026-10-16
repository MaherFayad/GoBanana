/**
 * R2: style tags on Atlas records (docs/styles) steer the Atlas bend. A brief or taste that names a
 * style prefers cards and mechanics tagged with it; with none named, the directions spread over
 * different main styles (diversity rule 5, lib/styles/diversity.ts).
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  bendBriefAtlas,
  MECHANIC_STYLE_BONUS,
  mechanicStyleScore,
  spreadByStyle,
  STYLE_MAIN_BONUS,
  STYLE_NEAR_BONUS,
  styleFit,
  stunningScore,
} from "@/lib/atlas/bend";
import { createAtlasLoader, ShardLru, type AtlasManifest } from "@/lib/atlas/loader";
import { loaderSource, type AtlasSource } from "@/lib/atlas/source";
import type { BendInput } from "@/lib/bend";
import type { IngredientCard, Mechanic } from "@/lib/atlas/types";
import { directionStyleIds } from "@/lib/styles/directions";
import { buildFixtureAtlas, countingFetcher, type ShardFiles } from "./fixtures/atlas-shards";

let manifest: AtlasManifest;
let files: ShardFiles;

beforeAll(async () => {
  ({ manifest, files } = await buildFixtureAtlas());
});

const lru = new ShardLru();
const base = (): AtlasSource => loaderSource(createAtlasLoader({ manifest, fetchShard: countingFetcher(files).fetchShard, budget: 200, lru }));

/** The fixture Atlas with style tags laid over its cards and mechanics. */
function styled(cardStyles: (c: IngredientCard) => string[] | undefined, mech: (m: Mechanic) => Mechanic = (m) => m): AtlasSource {
  const src = base();
  return {
    ...src,
    async cards(ids) {
      const m = await src.cards(ids);
      if (!m) return m;
      return new Map([...m].map(([k, c]) => {
        const s = cardStyles(c);
        return [k, s ? { ...c, styles: s } : c];
      }));
    },
    async mechanics(el) {
      const list = await src.mechanics(el);
      return list ? list.map(mech) : list;
    },
  };
}

const ESIM: BendInput = { brief: "eSIM plan picker for a GCC travel app", wildness: 3, platform: "mobile", count: 3 };

describe("style scores (R2)", () => {
  it("styleFit rewards an asked main style, then a second tag or the neighbour, else nothing", () => {
    expect(styleFit(["retro-pixel-halftone"], ["retro-pixel-halftone"])).toBe(STYLE_MAIN_BONUS);
    expect(styleFit(["editorial-serif", "retro-pixel-halftone"], ["retro-pixel-halftone"])).toBe(STYLE_NEAR_BONUS);
    // retro-pixel-halftone's nearest neighbour is type-led-brand-system.
    expect(styleFit(["type-led-brand-system"], ["retro-pixel-halftone"])).toBe(STYLE_NEAR_BONUS);
    expect(styleFit(["dark-luminous"], ["retro-pixel-halftone"])).toBe(0);
    expect(styleFit(undefined, ["retro-pixel-halftone"])).toBe(0);
    expect(styleFit(["retro-pixel-halftone"], [])).toBe(0);
  });

  it("mechanicStyleScore gives a full step for the target main style, half for any other overlap", () => {
    expect(mechanicStyleScore(["hero-numeral"], ["hero-numeral"])).toBe(MECHANIC_STYLE_BONUS);
    expect(mechanicStyleScore(["glass-frosted", "hero-numeral"], ["hero-numeral"])).toBe(MECHANIC_STYLE_BONUS / 2);
    expect(mechanicStyleScore(["glass-frosted"], ["hero-numeral"])).toBe(0);
    expect(mechanicStyleScore(undefined, ["hero-numeral"])).toBe(0);
  });

  it("spreadByStyle gives the first leads different main styles, keeps untagged leads and drops nothing", () => {
    const leads = [
      { id: "a", styles: ["dark-quiet-matte"] },
      { id: "b", styles: ["dark-quiet-matte"] },
      { id: "c" },
      { id: "d", styles: ["editorial-serif"] },
      { id: "e", styles: ["dark-quiet-matte"] },
    ];
    expect(spreadByStyle(leads, 3).map((l) => l.id)).toEqual(["a", "c", "d", "b", "e"]);
    // Not enough distinct styles: the front fills in the original order.
    const same = [{ id: "a", styles: ["hero-numeral"] }, { id: "b", styles: ["hero-numeral"] }];
    expect(spreadByStyle(same, 2).map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("a stunning recipe tagged with the direction's style scores one more, only when it already fits", () => {
    const r = { id: "s", use: ["hero" as const], cardIds: ["luggage-tag"], families: [], lensIds: [], styles: ["dark-luminous"] };
    const card = { id: "luggage-tag", family: "label or tag" } as IngredientCard;
    expect(stunningScore(r, [card], undefined, "hero", ["dark-luminous"]) - stunningScore(r, [card], undefined, "hero")).toBe(1);
    expect(stunningScore({ ...r, cardIds: [] }, [card], undefined, "hero", ["dark-luminous"])).toBe(0);
  });
});

describe("the Atlas bend reads style tags (R2)", () => {
  it("with no style asked, the directions lead with cards of different main styles", async () => {
    // Every card shares one main style except a few, so only the spread can tell them apart.
    const plain = (await bendBriefAtlas(ESIM, base()))!;
    const firstLead = plain.directions[0]!.cardIds![0]!;
    const others = new Set(["boarding-pass", "brushed-brass", "limestone", "giant-numerals", "exam-sheet", "art-deco", "one-typeface", "diner-menu"]);
    const r = (await bendBriefAtlas(ESIM, styled((c) => (c.id === firstLead ? ["dark-quiet-matte"] : others.has(c.id) ? [`${["editorial-serif", "hero-numeral", "flat-color-field"][c.id.length % 3]}`] : ["dark-quiet-matte"]))))!;
    const mains = r.directions.map((d) => d.cardStyles?.[0]);
    expect(mains).toHaveLength(3);
    expect(new Set(mains).size).toBe(3);
    // The first direction keeps its lead (Gulf-first and the best fit still lead).
    expect(r.directions[0]!.cardIds![0]).toBe(firstLead);
  });

  it("a taste that names a style moves the cards tagged with it ahead", async () => {
    const plain = (await bendBriefAtlas({ ...ESIM, count: 6 }, base()))!;
    const leads = plain.directions.map((d) => d.cardIds![0]!);
    const late = leads[leads.length - 1]!;
    const tags = (c: IngredientCard) => (c.id === late ? ["retro-pixel-halftone"] : ["minimal-mono-light"]);
    const asked = (await bendBriefAtlas({ ...ESIM, count: 6, taste: ["halftone"] }, styled(tags)))!;
    const before = leads.indexOf(late);
    const after = asked.directions.map((d) => d.cardIds![0]!).indexOf(late);
    expect(after).toBeGreaterThanOrEqual(0);
    expect(after).toBeLessThan(before);
    // The same tags with no style asked change nothing about who leads first.
    const none = (await bendBriefAtlas({ ...ESIM, count: 6 }, styled(tags)))!;
    expect(none.directions[0]!.cardIds![0]).toBe(leads[0]);
  });

  it("a brief that names a style picks the mechanic tagged with it among equal mechanics", async () => {
    // Make the "-b" mechanic as buildable and on the same pages as "-a", tagged hero-numeral.
    const even = (m: Mechanic): Mechanic => (m.id.endsWith("-b") ? { ...m, buildability: 5, pages: ["checkout", "plan-picker"], styles: ["hero-numeral"] } : m);
    const asked = (await bendBriefAtlas({ ...ESIM, brief: "eSIM plan picker with big numbers for a GCC travel app" }, styled(() => undefined, even)))!;
    for (const d of asked.directions) expect(d.mechanicId).toMatch(/-b$/);
    const plain = (await bendBriefAtlas(ESIM, styled(() => undefined, even)))!;
    expect(plain.directions[0]!.mechanicId).toMatch(/-a$/);
  });

  it("directionStyleIds names each direction by its lead card's main style first", () => {
    const ids = directionStyleIds(
      [
        { platform: "mobile", cardStyles: ["editorial-serif"], spec: { styleWords: ["dark"] } },
        { platform: "mobile", cardStyles: ["hero-numeral"], spec: { styleWords: [] } },
        { platform: "mobile", spec: { styleWords: ["glass"] } },
      ],
      { brief: "eSIM plan picker", platform: "mobile" },
    );
    expect(ids.ids).toEqual(["editorial-serif", "hero-numeral", "glass-frosted"]);
  });
});
