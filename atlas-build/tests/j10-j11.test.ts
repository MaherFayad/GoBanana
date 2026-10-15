/** P1-J10 judge agreement and P1-J11 crop matching: the pure parts of the two job files. */
import { describe, expect, it } from "vitest";
import { agreement, calibrationInputs, parseReferences, ratingsJson, TRUST, type JudgeRecord } from "../jobs/j10-judge.ts";
import { loadGoldImages, matchCrops, partList, readCrops, suggestedBands } from "../jobs/j11-crops.ts";
import type { GoldPart } from "../../banana-server/lib/stitch/crop-iou.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../config.ts";

const dir = (relevance: number, coherence: number, wow: number, gold: [number, number, number]): JudgeRecord => ({
  mode: "calibrate",
  run: "r",
  kind: "direction",
  briefId: "b",
  directionId: "d",
  relevance,
  coherence,
  wow,
  reason: "x",
  gold: { relevance: gold[0], coherence: gold[1], wow: gold[2] },
});
const ref = (verdict: "great" | "good" | "bad", gold: "great" | "good" | "bad"): JudgeRecord => ({ mode: "calibrate", run: "r", kind: "reference", briefId: "b", directionId: "d", refId: "x", verdict, reason: "x", gold: { verdict: gold } });

describe("J10 agreement", () => {
  it("trusts a metric only at 75% agreement or more", () => {
    const recs = [dir(4, 3, 2, [5, 3, 4]), dir(2, 2, 2, [3, 4, 2]), dir(4, 3, 3, [3, 3, 3]), dir(5, 4, 4, [4, 4, 5])];
    const a = Object.fromEntries(agreement(recs).map((x) => [x.metric, x]));
    expect(a["Brief relevance"]!.share).toBe(0.75);
    expect(a["Brief relevance"]!.trusted).toBe(true);
    expect(a["Spec coherence"]!.share).toBe(0.75);
    expect(a["Wow"]!.share).toBe(0.75);
    expect(TRUST).toBe(0.75);
  });

  it("scores references on the precision call, the great call and the exact verdict", () => {
    const a = Object.fromEntries(agreement([ref("good", "great"), ref("bad", "bad"), ref("great", "great"), ref("good", "bad")]).map((x) => [x.metric, x]));
    expect(a["Reference precision"]!.share).toBe(0.75);
    expect(a["Great share"]!.share).toBe(0.75);
    expect(a["Reference verdict"]!.share).toBe(0.5);
    expect(a["Reference verdict"]!.trusted).toBe(false);
  });

  it("needs one verdict per image", () => {
    expect(parseReferences('{"verdicts":[{"verdict":"Great","reason":"a"},"bad"]}', 2)).toEqual([
      { verdict: "great", reason: "a" },
      { verdict: "bad", reason: "" },
    ]);
    expect(() => parseReferences('{"verdicts":["good"]}', 2)).toThrow();
  });

  it("writes scored runs in the ratings.json shape", () => {
    const recs: JudgeRecord[] = [
      { mode: "score", run: "x", kind: "direction", briefId: "b", directionId: "d", relevance: 4, coherence: 3, wow: 5, reason: "fine" },
      { mode: "score", run: "x", kind: "reference", briefId: "b", directionId: "d", refId: "ref_1", verdict: "great", reason: "" },
    ];
    const r = ratingsJson("x", recs);
    expect(r.directions["b/d"]).toMatchObject({ relevance: 4, coherence: 3, wow: 5 });
    expect(r.references["b/d/ref_1"]).toBe("great");
  });

  it("builds calibration requests from the gold file", () => {
    const gold = JSON.parse(readFileSync(join(ROOT, "..", "banana-server", "bench", "gold", "ratings-gold.json"), "utf8"));
    const inputs = calibrationInputs(gold);
    expect(inputs.filter((i) => i.kind === "direction")).toHaveLength(gold.directions.length);
    const refs = inputs.flatMap((i) => (i.kind === "references" ? i.refs : []));
    expect(refs).toHaveLength(gold.references.length);
  });
});

const part = (id: string, role: GoldPart["role"], x: number, y: number, w: number, h: number): GoldPart => ({ id, role, crop: { x, y, w, h } });

describe("J11 crops", () => {
  it("pairs each gold part with the best box of its role", () => {
    const gold = [part("a", "cta", 0.1, 0.8, 0.2, 0.05), part("b", "cta", 0.6, 0.8, 0.2, 0.05), part("c", "nav", 0, 0, 1, 0.1)];
    const m = matchCrops(gold, [
      { role: "cta", crop: { x: 0.6, y: 0.8, w: 0.2, h: 0.05 } },
      { role: "cta", crop: { x: 0.1, y: 0.8, w: 0.2, h: 0.05 } },
    ]);
    expect(m[0]!.iou).toBeCloseTo(1);
    expect(m[1]!.iou).toBeCloseTo(1);
    expect(m[2]!.iou).toBe(0);
    expect(m[2]!.agent).toBeNull();
  });

  it("reads and clamps the model's boxes, dropping broken ones", () => {
    const got = readCrops('{"parts":[{"role":"hero","x":0.9,"y":0.5,"w":0.3,"h":0.2},{"role":"cta","x":"a"}]}');
    expect(got).toHaveLength(1);
    expect(got[0]!.role).toBe("hero");
    expect(got[0]!.crop.w).toBeCloseTo(0.1);
    expect(got[0]!.crop.h).toBe(0.2);
  });

  it("asks for each role as many times as the gold has it", () => {
    expect(partList([part("a", "cta", 0, 0, 1, 1), part("b", "hero", 0, 0, 1, 1), part("c", "cta", 0, 0, 1, 1)])).toBe("cta x2, hero");
  });

  it("reads the 200 gold parts and suggests bands from single screens", () => {
    const images = loadGoldImages();
    expect(images.reduce((n, i) => n + i.parts.length, 0)).toBe(200);
    const bands = suggestedBands(images);
    for (const b of Object.values(bands)) {
      expect(b.x + b.w).toBeLessThanOrEqual(1.001);
      expect(b.y + b.h).toBeLessThanOrEqual(1.001);
    }
  });
});
