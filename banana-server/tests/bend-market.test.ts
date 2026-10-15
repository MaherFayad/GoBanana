/**
 * Field report, 2026-10-12, a GCC flight checkout bend (mobile, wildness 4). The agent dropped:
 * "film noir index card" (too close to the vinyl record sleeve, and its Wayuu weaving has no link
 * to the GCC), "sandstone with serif type only" (text on texture fails contrast, serif only fights
 * Arabic) and "paper clips with Icelandic knitwear" (off brief).
 */
import { describe, expect, it } from "vitest";
import { bendBrief, LISTS, MOVES } from "@/lib/bend";
import { OBJECT_FAMILIES, familyOf } from "@/lib/bend/families";
import { briefMarket, LATIN_ONLY_CONSTRAINTS, MARKET_TRADITIONS, needsArabic, WIDER_REGION_FROM_WILDNESS } from "@/lib/bend/market";
import { mulberry32 } from "@/lib/bend/prng";
import type { Wildness } from "@/lib/bend/types";

const GCC = "flight checkout screen for a GCC travel OTA";
const keys = (list: keyof typeof LISTS) => new Set(LISTS[list].map((e) => e.key));
const keyOf = (list: keyof typeof LISTS, label: string) => LISTS[list].find((e) => e.label === label)?.key ?? label;

describe("market and script words", () => {
  it("reads the market and the need for Arabic from the brief", () => {
    expect(briefMarket(GCC)).toBe("gulf");
    expect(briefMarket("Retail banking app for Saudi customers")).toBe("gulf");
    expect(briefMarket("food delivery app in Cairo")).toBe("mena");
    expect(briefMarket("Arabic news reader")).toBe("mena");
    expect(needsArabic("food delivery app in Cairo")).toBe(true);
    expect(briefMarket("podcast player")).toBeNull();
    expect(briefMarket("a woman's running app in Romania")).toBeNull();
    expect(needsArabic(GCC)).toBe(true);
    expect(needsArabic("Bilingual EN and AR, RTL ready wallet")).toBe(true);
    expect(needsArabic("podcast player")).toBe(false);
  });

  it("names only real list entries", () => {
    for (const k of MARKET_TRADITIONS.mena) expect(keys("traditions").has(k), k).toBe(true);
    for (const k of MARKET_TRADITIONS.gulf) expect(MARKET_TRADITIONS.mena.has(k), k).toBe(true);
    for (const k of LATIN_ONLY_CONSTRAINTS) expect(keys("constraints").has(k), k).toBe(true);
    for (const list of Object.values(OBJECT_FAMILIES)) for (const k of list) expect(keys("objects").has(k), k).toBe(true);
  });
});

describe("a market brief bends within its region and its script", () => {
  const LEVELS: Wildness[] = [1, 2, 3, 4, 5];
  const bends = LEVELS.flatMap((wildness) =>
    (["mobile", "website", undefined] as const).map((platform) => bendBrief({ brief: GCC, wildness, count: 8, ...(platform ? { platform } : {}) })),
  );

  it("draws cultural ingredients from the region only", () => {
    for (const b of bends) {
      for (const d of b.directions) {
        const t = d.ingredients.tradition;
        if (t) expect(MARKET_TRADITIONS.mena.has(keyOf("traditions", t)), `${t} (w${b.wildness})`).toBe(true);
      }
    }
    expect(bends.some((b) => b.directions.some((d) => d.ingredients.tradition))).toBe(true);
  });

  it("leaves out Latin-only type rules and names an Arabic face for every type voice", () => {
    for (const b of bends) {
      for (const d of b.directions) {
        const c = d.ingredients.constraint;
        if (c) expect(LATIN_ONLY_CONSTRAINTS.has(keyOf("constraints", c)), c).toBe(false);
        expect(d.spec.typography).toMatch(/; Arabic in .+ at the same sizes, right to left\.$/);
      }
    }
  });

  it("keeps text off busy surfaces", () => {
    for (const b of bends) {
      for (const d of b.directions.filter((x) => x.ingredients.material)) {
        expect(d.spec.texture).toContain("text sits on solid panels, never on the texture");
      }
    }
  });

  it("holds at most one object per family on a platform brief (no index card next to a record sleeve)", () => {
    for (const b of bends.filter((x) => x.platform !== "any")) {
      const families = b.directions.flatMap((d) => (d.ingredients.object ? [familyOf("objects", keyOf("objects", d.ingredients.object))] : [])).filter(Boolean);
      expect(new Set(families).size, `w${b.wildness} ${b.platform}`).toBe(families.length);
    }
    const field = bendBrief({ brief: GCC, wildness: 4, platform: "mobile" }).directions.map((d) => d.ingredients.object);
    expect(field.includes("index card") && field.includes("vinyl record sleeve")).toBe(false);
  });

  it("keeps wildness meaningful: the levels still bend differently", () => {
    const ideas = (w: Wildness) => bendBrief({ brief: GCC, wildness: w, platform: "mobile" }).directions.map((d) => d.searchQuery).join("|");
    expect(new Set(LEVELS.map(ideas)).size).toBe(LEVELS.length);
    const w5 = bendBrief({ brief: GCC, wildness: 5, platform: "mobile" }).directions;
    expect(w5.every((d) => d.twist.length > 0)).toBe(true);
  });
});

describe("P0-07 Gulf lenses first for Gulf briefs", () => {
  const GULF_BRIEFS = [
    GCC,
    "eSIM plan picker for a GCC travel app: pick a destination data plan, compare GB and days, buy",
    "Riyadh metro ticket app",
    "Dubai hotel booking website",
    "Kuwait bank onboarding",
  ];

  it("over 200 seeds, a GCC brief at wildness 3 never gets a non-Gulf tradition", () => {
    const rng = mulberry32(20261015);
    const problems: string[] = [];
    let traditions = 0;
    for (let seed = 0; seed < 200; seed++) {
      const brief = GULF_BRIEFS[seed % GULF_BRIEFS.length]!;
      // Seeds vary the moves (lens heavy ones too), the platform and the count.
      const moves = seed % 4 === 0 ? (["lens"] as const) : MOVES.filter(() => rng() < 0.6);
      const platform = (["mobile", "website", "webapp", undefined] as const)[Math.floor(rng() * 4)];
      const r = bendBrief({ brief, wildness: 3, count: 8, ...(moves.length ? { moves: [...moves] } : {}), ...(platform ? { platform } : {}) });
      for (const d of r.directions) {
        const t = d.ingredients.tradition;
        if (!t) continue;
        traditions++;
        if (!MARKET_TRADITIONS.gulf.has(keyOf("traditions", t))) problems.push(`${brief} seed ${seed}: ${t}`);
      }
    }
    expect(problems).toEqual([]);
    expect(traditions).toBeGreaterThan(200);
  });

  it("keeps Gulf crafts at wildness 1 to 3 and may add the wider region at 4 and 5", () => {
    const wider = new Set<string>();
    for (const wildness of [1, 2, 3, 4, 5] as Wildness[]) {
      for (const d of bendBrief({ brief: GCC, wildness, count: 8, moves: ["lens", "material"] }).directions) {
        const t = d.ingredients.tradition;
        if (!t) continue;
        const k = keyOf("traditions", t);
        if (wildness < WIDER_REGION_FROM_WILDNESS) expect(MARKET_TRADITIONS.gulf.has(k), `${t} w${wildness}`).toBe(true);
        else {
          expect(MARKET_TRADITIONS.mena.has(k), `${t} w${wildness}`).toBe(true);
          if (!MARKET_TRADITIONS.gulf.has(k)) wider.add(k);
        }
      }
    }
    expect(wider.size).toBeGreaterThan(0);
  });

  it("a wider region brief still draws the region", () => {
    for (const d of bendBrief({ brief: "food delivery app in Cairo", wildness: 3, count: 8, moves: ["lens"] }).directions) {
      if (d.ingredients.tradition) expect(MARKET_TRADITIONS.mena.has(keyOf("traditions", d.ingredients.tradition))).toBe(true);
    }
  });
});

describe("briefs without a market are unchanged", () => {
  it("draws traditions from anywhere and adds no Arabic line", () => {
    const traditions = new Set<string>();
    for (const w of [3, 4, 5] as Wildness[]) {
      for (const d of bendBrief({ brief: "podcast player", wildness: w, count: 8, platform: "mobile" }).directions) {
        if (d.ingredients.tradition) traditions.add(keyOf("traditions", d.ingredients.tradition));
        expect(d.spec.typography).not.toContain("Arabic");
      }
    }
    expect([...traditions].some((t) => !MARKET_TRADITIONS.mena.has(t))).toBe(true);
  });
});
