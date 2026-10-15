import { describe, expect, it } from "vitest";
import { bendBrief, checkCoherence, LISTS, MOVES, type Wildness } from "@/lib/bend";
import { leadIngredient } from "@/lib/bend/coherence";
import { mulberry32 } from "@/lib/bend/prng";
import { PART } from "@/lib/bend/spec";
import type { Direction } from "@/lib/bend/types";
import { PLATFORMS } from "@/lib/direction-detail";
import { PLATFORM_PROFILES } from "@/lib/platform";

const BRIEFS = [
  "eSIM plan picker for a GCC travel app: pick a destination data plan, compare GB and days, buy",
  "flight checkout for a GCC OTA",
  "coffee shop landing page",
  "banking onboarding",
  "fitness app empty state",
  "meditation app onboarding",
  "food delivery cart",
  "Retail banking mobile app homepage: balance, quick actions, recent transactions",
  "logistics fleet management dashboard",
  "poster for a jazz festival",
];

describe("P0-08 one spec engine and a coherence check", () => {
  it("finds zero coherence problems over 500 seeds and 10 briefs", () => {
    const rng = mulberry32(20261015);
    const problems: string[] = [];
    let directions = 0;
    for (const brief of BRIEFS) {
      for (let seed = 0; seed < 500; seed++) {
        const wildness = (1 + Math.floor(rng() * 5)) as Wildness;
        const moves = MOVES.filter(() => rng() < 0.7);
        const platform = PLATFORMS[Math.floor(rng() * PLATFORMS.length)]!;
        const lens = rng() < 0.15 ? "sadu" : undefined;
        const r = bendBrief({ brief, wildness, count: 8, platform, ...(moves.length ? { moves } : {}), ...(lens ? { lens } : {}) });
        for (const d of r.directions) {
          directions++;
          for (const p of checkCoherence(d, r.directions)) problems.push(`${brief} w${wildness} ${platform}: ${p}`);
        }
      }
    }
    expect(problems.slice(0, 20)).toEqual([]);
    expect(directions).toBeGreaterThan(20_000);
  }, 300_000);

  it("writes the pattern and layout on the mechanic's part, the grid only as a suffix", () => {
    for (const d of bendBrief({ brief: BRIEFS[0]!, wildness: 3, count: 8, platform: "mobile" }).directions) {
      const part = PART[d.mechanic.element];
      expect(d.spec.pattern.toLowerCase(), d.spec.pattern).toContain(part);
      expect(d.spec.layout).toMatch(new RegExp(`, on ${PLATFORM_PROFILES.mobile.gridShort}\\.$`));
      expect(d.spec.layout).not.toBe(PLATFORM_PROFILES.mobile.grid);
    }
  });

  it("writes whyItFits from the ingredient and the page, never one generic line", () => {
    const r = bendBrief({ brief: BRIEFS[0]!, wildness: 3, count: 8, platform: "mobile" });
    const whys = r.directions.map((d) => d.spec.whyItFits);
    expect(new Set(whys).size).toBe(whys.length);
    for (const d of r.directions) {
      expect(d.spec.whyItFits).not.toMatch(/a look no competitor has/);
      const lead = leadIngredient(d)!;
      expect(lead, d.id).toBeDefined();
      if (!d.spec.whyItFits.startsWith("A deliberate clash")) expect(d.spec.whyItFits).toContain("eSIM plan picker");
      expect(d.spec.whyItFits.toLowerCase()).toContain(lead.entry.label.toLowerCase());
    }
  });

  it("takes color from the lead ingredient; the mood only shifts it", () => {
    const r = bendBrief({ brief: "banking onboarding", wildness: 3, count: 8, platform: "mobile", moves: ["era", "lens"] });
    for (const d of r.directions) {
      const lead = leadIngredient(d)!;
      if (lead.entry.hints.color) expect(d.spec.color.toLowerCase()).toContain(lead.entry.hints.color.toLowerCase().replace(/[.\s]+$/, "").slice(0, 20));
      const mood = LISTS.moods.find((m) => m.label === d.ingredients.mood)!;
      if (mood.hints.color && mood.hints.color !== lead.entry.hints.color) expect(d.spec.color).not.toContain(mood.hints.color);
    }
  });

  it("flags a pattern off the mechanic, a color that fights the ingredient, and shared lines", () => {
    const d = bendBrief({ brief: "flight checkout for a GCC OTA", wildness: 3, count: 2, platform: "mobile" }).directions[0]!;
    expect(checkCoherence(d)).toEqual([]);
    const offPart: Direction = { ...d, spec: { ...d.spec, pattern: "Layered glass as the bottom sheet." } };
    expect(checkCoherence(offPart)[0]).toMatch(/^The pattern is not on the mechanic's/);
    const twin: Direction = { ...d, id: "bd-twin" };
    expect(checkCoherence(d, [d, twin]).some((p) => p.startsWith("Same layout line"))).toBe(true);
    expect(checkCoherence(d, [d, twin]).some((p) => p.startsWith("Same whyItFits line"))).toBe(true);
    // A warm lead with cool words the engine added.
    const warm = LISTS.objects.find((e) => e.hints.tone.includes("warm") && !e.hints.tone.includes("cold"))!;
    const warmDir: Direction = {
      ...d,
      moves: ["transplant"],
      ingredients: { mood: d.ingredients.mood, object: warm.label },
      searchQuery: warm.query,
      spec: { ...d.spec, color: `The colors of real ${warm.label}, one base and one accent; cool grays, text at 4.5 to 1 or more.` },
    };
    expect(checkCoherence(warmDir).some((p) => p.startsWith("The color line fights the warm palette"))).toBe(true);
  });
});
