import { describe, expect, it } from "vitest";
import { contrastPairs, contrastRatio, evaluatePair } from "@/lib/palette/contrast";
import {
  formatOklch,
  hexToOklab,
  hexToOklch,
  hexToOklchColor,
  normalizeHex,
  oklabDistance,
  oklchToHex,
} from "@/lib/palette/color";

describe("contrast math (WCAG 2.x)", () => {
  it("black on white is 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 6);
    const pair = evaluatePair("#000", "#fff");
    expect(pair).toEqual({ fg: "#000000", bg: "#ffffff", ratio: 21, passesText: true, passesUi: true, tag: "ship" });
  });

  it("same color is 1:1", () => {
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 6);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#1d3557", "#f4a261")).toBeCloseTo(contrastRatio("#f4a261", "#1d3557"), 10);
  });

  it("#777 on white is about 4.48: fails text, passes UI, tagged explore", () => {
    const pair = evaluatePair("#777", "#ffffff");
    expect(pair.ratio).toBeCloseTo(4.48, 2);
    expect(pair.passesText).toBe(false);
    expect(pair.passesUi).toBe(true);
    expect(pair.tag).toBe("explore");
  });

  it("#767676 on white just passes text (4.54)", () => {
    const pair = evaluatePair("#767676", "#ffffff");
    expect(pair.ratio).toBeCloseTo(4.54, 2);
    expect(pair.passesText).toBe(true);
    expect(pair.tag).toBe("ship");
  });

  it("#959595 on white fails UI: raw 2.995 shows as 3 but does not pass", () => {
    const pair = evaluatePair("#959595", "#ffffff");
    expect(contrastRatio("#959595", "#ffffff")).toBeLessThan(3);
    expect(pair.ratio).toBe(3);
    expect(pair.passesUi).toBe(false);
  });

  it("uses unrounded values for pass/fail", () => {
    // Raw ratio 4.478..., which would round to 4.48 but must still fail 4.5.
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
  });

  it("builds pairs against surface, on-surface, white and black without duplicates", () => {
    const pairs = contrastPairs(["#e63946", "#ffffff", "#111111"], "#ffffff", "#111111");
    const keys = pairs.map((p) => [p.fg, p.bg].sort().join("|"));
    expect(new Set(keys).size).toBe(keys.length);
    expect(pairs.some((p) => p.fg === p.bg)).toBe(false);
    // red vs surface (white), on-surface, black
    expect(pairs.filter((p) => p.fg === "#e63946").map((p) => p.bg)).toEqual(["#ffffff", "#111111", "#000000"]);
    // on-surface shown as text on surface
    expect(pairs).toContainEqual(expect.objectContaining({ fg: "#111111", bg: "#ffffff" }));
  });
});

describe("color conversion", () => {
  it("formats OKLCH like oklch(L C H)", () => {
    expect(hexToOklch("#ffffff")).toBe("oklch(1 0 0)");
    expect(hexToOklch("#000000")).toBe("oklch(0 0 0)");
    expect(hexToOklch("#ff0000")).toMatch(/^oklch\(0\.628 0\.258 29\.2\)$/);
    expect(formatOklch({ l: 0.62, c: 0.18, h: 250 })).toBe("oklch(0.62 0.18 250)");
  });

  it("round-trips hex through OKLCH within rounding", () => {
    // The OKLCH string is rounded for reading (3, 3, 1 decimals); hex stays the source of truth.
    for (const hex of ["#e63946", "#1d3557", "#2a9d8f", "#777777", "#ffbe0b", "#ffffff", "#000000"]) {
      const back = oklchToHex(hexToOklch(hex));
      expect(oklabDistance(hexToOklab(back), hexToOklab(hex))).toBeLessThan(0.005);
    }
    expect(oklchToHex("oklch(0.62 0.18 250)")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("normalizes short hex and reads OKLCH numbers", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    const c = hexToOklchColor("#808080");
    expect(c.c).toBeLessThan(0.001);
    expect(c.h).toBe(0);
  });
});
