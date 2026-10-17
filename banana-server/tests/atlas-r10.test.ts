/**
 * R10: domain cliches rank lower, the twist comes from another world than its lead, and the twist
 * and reduced motion lines never name a flow or part the page does not have.
 */
import { describe, expect, it } from "vitest";
import { CLICHE_BASE, CLICHE_STEP, clichePenalty, rankSeconds, sameWorld } from "@/lib/atlas/bend";
import { leadReduced, motionLine, onPageFlows, textureLine, twistWhy, type SpecPart } from "@/lib/atlas/spec-coherence";
import type { IngredientCard } from "@/lib/atlas/types";
import { CARDS } from "./fixtures/atlas";

const card = (id: string, name: string, family: string, worlds?: string[]): IngredientCard => ({ ...CARDS[0]!, id, name, family, region: "global", worlds });

describe("R10 domain cliches", () => {
  it("costs a cliche about two fit steps, more on a wilder brief, and nothing when the fit has no cliche", () => {
    expect(clichePenalty({ cliche: "ring or arc gauges for data left" }, 1)).toBeCloseTo(CLICHE_BASE);
    expect(clichePenalty({ cliche: "ring or arc gauges for data left" }, 5)).toBeCloseTo(CLICHE_BASE + 4 * CLICHE_STEP);
    expect(clichePenalty({}, 5)).toBe(0);
    expect(clichePenalty(undefined, 3)).toBe(0);
  });
});

describe("R10 the twist comes from another world", () => {
  const felt = card("wool-felt", "Wool Felt", "textile and fiber", ["textile and stitch", "games and play"]);
  const badges = card("badges", "Badges", "marks and stamps", ["textile and stitch"]);
  const kraft = card("kraft-paper", "Kraft Paper", "paper", ["paper and print"]);
  const bare = card("bare", "Bare Card", "symbols and signs");

  it("tells cards of one world apart from cards of another", () => {
    expect(sameWorld(felt, badges)).toBe(true);
    expect(sameWorld(felt, kraft)).toBe(false);
    // A second world counts only against the other card's main world.
    expect(sameWorld({ worlds: ["games and play"] }, felt)).toBe(true);
    expect(sameWorld({ worlds: ["paper and print", "games and play"] }, { worlds: ["wood and woodwork", "games and play"] })).toBe(false);
    expect(sameWorld(felt, bare)).toBe(false);
  });

  it("ranks a card from the lead's world after every other card, even a better scored one", () => {
    const ranked = rankSeconds(felt, [badges, kraft], { brief: "kids reading app home screen", market: null, score: (c) => (c.id === "badges" ? 3 : 1), used: new Set(), seed: "s" });
    expect(ranked.map((c) => c.id)).toEqual(["kraft-paper", "badges"]);
  });
});

const parts: SpecPart[] = [
  { element: "empty-state", label: "empty illustration", how: "An attract screen with one start button" },
  { element: "cta", label: "primary action button", how: "The button is a lit start button" },
];
const task = "The main task, taking the first step, now runs through the primary action button: the button is a lit start button.";
const ctx = { brief: "fitness app empty state", pageLabel: "fitness app empty state", parts, task };

describe("R10 lines name only what the page has", () => {
  it("makes flows the page does not have the page, and keeps the ones it has", () => {
    expect(onPageFlows("this one turns onboarding and checkout into calm assembly steps", ctx)).toBe("this one turns the fitness app empty state into calm assembly steps");
    expect(onPageFlows("rows that move together give carousels and filters a physical feel", ctx)).toBe("rows that move together give the fitness app empty state a physical feel");
    const rental = { ...ctx, brief: "property search results: filter by district", pageLabel: "rental search results" };
    expect(onPageFlows("give carousels and filters a physical feel", rental)).toBe("give filters a physical feel");
    expect(onPageFlows("a calm wordless guide", ctx)).toBe("a calm wordless guide");
  });

  it("explains the twist without another page's flows", () => {
    const manual = { surprise: "UI rarely trusts pictures over words, and this one turns onboarding and checkout into calm assembly steps.", idea: "" };
    expect(twistWhy(manual, ctx.pageLabel, "texture", ctx)).toBe("UI rarely trusts pictures over words, and this one turns the fitness app empty state into calm assembly steps");
    const second: IngredientCard = { ...CARDS[1]!, name: "Flat-Pack Instruction Manual", surprise: manual.surprise, texture: "The parts list card carries a 1 px hairline grid." };
    const { line } = textureLine({ lead: CARDS[0]!, second, adds: "texture", platform: "mobile", ...ctx });
    expect(line).not.toMatch(/onboarding|checkout/);
  });

  it("makes the lead's own reduced motion subject 'it' when the page never names it", () => {
    const arcade: IngredientCard = { ...CARDS[0]!, name: "Arcade Cabinet", motion: { verb: "blinks three times, then holds", ms: 500, reduced: "No blinking: the new initials appear at once in the pink highlight and stay that way until saved." } };
    const c = { lead: arcade, second: null, adds: null, platform: "mobile" as const, ...ctx };
    expect(leadReduced(arcade.motion.reduced, c)).toBe("no blinking: it appears at once in the pink highlight and stays that way until saved");
    expect(motionLine(c)).not.toContain("initials");
    // A subject any page has, or one the page's parts name, stays.
    expect(leadReduced("The final number appears instantly.", c)).toBe("the final number appears instantly");
    expect(leadReduced("The start button lights at once.", c)).toBe("the start button lights at once");
    expect(leadReduced("Instant placement with no scale change.", c)).toBe("instant placement with no scale change");
  });
});
