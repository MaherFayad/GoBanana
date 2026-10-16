/** Refinement R3: the pure parts of the judge calibration and crop jobs (folds, examples, agreement, split, pixel crops). */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { drawShots, folds, relevanceRow, rng, SYSTEM_R3, type R3Record } from "../jobs/r3-judge.ts";
import { disagreements, finalRelevance } from "../jobs/r3-judge-adj.ts";
import { askList, readPxCrops, splitImages, DEV_SIZE } from "../jobs/r3-crops.ts";
import { loadGoldImages } from "../jobs/j11-crops.ts";
import { GOLD_FILE, type GoldDirection } from "../jobs/j10-judge.ts";

const gold = (n: number, relevance: number): GoldDirection => ({ run: "r", briefId: `b${n}`, directionId: `d${n}`, relevance, coherence: 3, wow: 3 });
const rec = (n: number, vote: "a" | "b", relevance: number, g = 3): R3Record => ({
  stage: "fewshot",
  seed: 1,
  vote,
  run: "r",
  briefId: `b${n}`,
  directionId: `d${n}`,
  relevance,
  coherence: 3,
  wow: 3,
  reason: "x",
  gold: { relevance: g, coherence: 3, wow: 3 },
});

describe("R3 judge folds and examples", () => {
  const pool = [gold(0, 4), gold(1, 4), gold(2, 4), ...Array.from({ length: 27 }, (_, i) => gold(i + 3, 3))];

  it("splits into 3 stratified folds, the same for the same seed", () => {
    const f = folds(pool, 1);
    expect(f).toEqual(folds(pool, 1));
    expect(new Set(f.slice(0, 3))).toEqual(new Set([0, 1, 2])); // the 3 on-brief items land in 3 different folds
    for (const k of [0, 1, 2]) expect(f.filter((x) => x === k).length).toBe(10);
    expect(folds(pool, 2)).not.toEqual(f);
  });

  it("draws every on-brief item (up to half) and fills with the rest, seeded", () => {
    const s = drawShots(pool, 7, 8);
    expect(s).toHaveLength(8);
    expect(s.filter((g) => g.relevance >= 4)).toHaveLength(3);
    expect(drawShots(pool, 7, 8)).toEqual(s);
    expect(new Set(s).size).toBe(8);
  });

  it("never shows a held-out item among its own examples", async () => {
    const { r3Inputs } = await import("../jobs/r3-judge.ts");
    const g = JSON.parse(readFileSync(GOLD_FILE, "utf8"));
    for (const input of r3Inputs(g, null, ["fewshot"])) expect(input.shots.some((s) => s.directionId === input.direction.id && s.run === input.run)).toBe(false);
  });

  it("rng is deterministic and in [0, 1)", () => {
    const a = rng(5);
    const b = rng(5);
    for (let i = 0; i < 20; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("puts the rubric in the system prompt in place of J10's relevance line", () => {
    expect(SYSTEM_R3).toContain("Check three things");
    expect(SYSTEM_R3).not.toContain("caps relevance at 3.\n- coherence");
  });
});

describe("R3 judge agreement", () => {
  it("counts the on-brief call and the hits on each side", () => {
    const row = relevanceRow("x", [
      { judge: 4, gold: 5 },
      { judge: 3, gold: 4 },
      { judge: 2, gold: 3 },
      { judge: 4, gold: 3 },
    ]);
    expect(row.agree).toBe(2);
    expect(row.share).toBe(0.5);
    expect(row.tpr).toBe("1 of 2");
    expect(row.tnr).toBe("1 of 2");
  });

  it("sends only split votes to the second pass and uses its answer there", () => {
    const records = [rec(1, "a", 4), rec(1, "b", 3), rec(2, "a", 3), rec(2, "b", 2)];
    const d = disagreements(records);
    expect(d).toHaveLength(1);
    expect(d[0]!.a.directionId).toBe("d1");
    const fin = finalRelevance(records, [{ stage: "fewshot", seed: 1, run: "r", briefId: "b1", directionId: "d1", relevance: 3, reason: "y" }]);
    expect([...fin.values()].map((x) => [x.a.directionId, x.relevance, x.adjudicated])).toEqual([
      ["d1", 3, true],
      ["d2", 3, false],
    ]);
  });
});

describe("R3 crops", () => {
  it("splits the gold images once: dev and held, no overlap, weak roles on both sides", () => {
    const images = loadGoldImages();
    const split = splitImages(images);
    expect([...split.values()].filter((s) => s === "dev")).toHaveLength(DEV_SIZE);
    expect(splitImages(images)).toEqual(split);
    const weak = (k: string) => images.find((i) => i.key === k)!.parts.some((p) => ["toolbar", "content", "status-header", "tabbar"].includes(p.role));
    expect([...split].filter(([k, s]) => s === "held" && weak(k)).length).toBeGreaterThan(3);
  });

  it("reads pixel edges as fractions and drops bad boxes", () => {
    const got = readPxCrops('{"parts": [{"role": "tabbar", "left": 0, "top": 800, "right": 400, "bottom": 900}, {"role": "cta", "left": 10, "top": 10, "right": 5, "bottom": 20}]}', 400, 1000);
    expect(got).toEqual([{ role: "tabbar", crop: { x: 0, y: 0.8, w: 1, h: 0.09999999999999998 } }]);
  });

  it("asks for parts grouped (as J11) or in the gold's order", () => {
    const image = { key: "k", imageUrl: "u", parts: [{ role: "cta" }, { role: "hero" }, { role: "cta" }] } as never;
    expect(askList(image, "grouped")).toBe("Cut these parts: cta x2, hero.");
    expect(askList(image, "ordered")).toContain("in this order: cta, hero, cta.");
  });
});
