/** Refinement R4: the pure parts of r4-judge-dirs (final scores, report) and the crop test's screens list. */
import { describe, expect, it } from "vitest";
import { finalScores, report, type R4Record } from "../jobs/r4-judge-dirs.ts";
import { askList, screensOf } from "../jobs/r3-crops.ts";
import type { GoldImage } from "../jobs/j11-crops.ts";

const rec = (n: number, vote: "a" | "b" | "adj", relevance: number): R4Record => ({ tag: "t", pass: vote === "adj" ? "adj" : "votes", vote, briefId: `b${n}`, directionId: `d${n}`, title: `T${n}`, relevance, reason: "x" });

describe("r4-judge-dirs", () => {
  it("keeps vote a when the votes agree on the on-brief call, else the second pass, else undecided", () => {
    const votes = [rec(1, "a", 4), rec(1, "b", 5), rec(2, "a", 3), rec(2, "b", 4), rec(3, "a", 2), rec(3, "b", 4)];
    const fin = finalScores(votes, [rec(2, "adj", 4)]);
    expect(fin.map((f) => f.relevance)).toEqual([4, 4, null]);
    expect(fin.map((f) => f.adjudicated)).toEqual([false, true, true]);
  });

  it("reports the on-brief share over decided items", () => {
    const votes = [rec(1, "a", 4), rec(1, "b", 4), rec(2, "a", 3), rec(2, "b", 3)];
    expect(report("t", { briefs: [] }, votes, [])).toContain("**1 of 2** (50.0%)");
  });
});

describe("crop test screens (R4)", () => {
  const part = (role: string, x: number, w: number) => ({ id: `${role}${x}`, role, crop: { x, y: 0.1, w, h: 0.1 } }) as unknown as GoldImage["parts"][number];

  it("groups parts into screens by horizontal overlap, counted from the left", () => {
    const parts = [part("cards", 0.4, 0.2), part("status-header", 0.05, 0.25), part("tabbar", 0.4, 0.2), part("hero", 0.06, 0.24)];
    expect(screensOf(parts)).toEqual({ screen: [1, 0, 1, 0], count: 2 });
  });

  it("names each part's screen, and falls back to the plain list on one screen", () => {
    const two = { key: "k", imageUrl: "u", parts: [part("status-header", 0.05, 0.25), part("cards", 0.4, 0.2), part("cards", 0.42, 0.18)] } as GoldImage;
    expect(askList(two, "screens")).toBe("Cut these parts. The image shows 2 screens; each part is named with the screen it sits on, counted from the left: screen 1 of 2: status-header; screen 2 of 2: cards x2.");
    const one = { ...two, parts: [part("nav", 0, 1), part("hero", 0.1, 0.8)] } as GoldImage;
    expect(askList(one, "screens")).toBe("Cut these parts: nav, hero.");
  });
});
