import { describe, expect, it } from "vitest";
import { contrastPairs, contrastRatio, evaluatePair, shipPairs } from "../lib/contrast.ts";
import { checkFamily, checkTypeSpec, indexFonts, loadFonts } from "../lib/fonts.ts";
import { withShipPairs } from "../lib/job.ts";

describe("contrast (copy of banana-server/lib/palette/contrast.ts)", () => {
  it("matches the WCAG endpoints", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21);
    expect(contrastRatio("#777", "#777")).toBeCloseTo(1);
    const p = evaluatePair("#767676", "#ffffff");
    expect(p.passesText).toBe(true);
    expect(p.tag).toBe("ship");
    expect(evaluatePair("#888888", "#ffffff").passesText).toBe(false);
  });

  it("contrastPairs skips self and repeated pairs", () => {
    const pairs = contrastPairs(["#ffffff", "#000000"], "#ffffff", "#000000");
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ fg: "#000000", bg: "#ffffff" });
  });
});

describe("shipPairs", () => {
  const palette = [
    { hex: "#F4EFE6", role: "surface" as const, name: "cream" },
    { hex: "#1F1B16", role: "ink" as const, name: "soot" },
    { hex: "#E0A458", role: "accent" as const, name: "amber" },
    { hex: "#2B4C7E", role: "support" as const, name: "navy" },
  ];

  it("keeps only pairs at 4.5:1 or more, with the surface as background", () => {
    const pairs = shipPairs(palette);
    for (const [fg, bg] of pairs) expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    expect(pairs).toContainEqual(["#1f1b16", "#f4efe6"]);
    expect(pairs).toContainEqual(["#2b4c7e", "#f4efe6"]);
    expect(pairs.find(([fg]) => fg === "#e0a458" && false)).toBeUndefined();
    expect(pairs.some(([a, b]) => (a === "#e0a458" && b === "#f4efe6") || (a === "#f4efe6" && b === "#e0a458"))).toBe(false);
  });

  it("puts the lighter color behind when neither is a surface", () => {
    expect(shipPairs([{ hex: "#000000", role: "ink", name: "a" }, { hex: "#ffffff", role: "accent", name: "b" }])).toEqual([["#000000", "#ffffff"]]);
  });

  it("withShipPairs replaces the model's pairs", () => {
    const out = withShipPairs({ palette, shipPairs: [["#E0A458", "#F4EFE6"]] }) as { shipPairs: unknown };
    expect(out.shipPairs).toEqual(shipPairs(palette));
  });
});

describe("Google Fonts check", () => {
  const fonts = indexFonts({
    source: "test",
    fetched: "2026-10-15",
    families: [
      { family: "Inter", category: "Sans Serif", subsets: ["latin"] },
      { family: "Cairo", category: "Sans Serif", subsets: ["arabic", "latin"] },
    ],
  });

  it("rejects unknown names, wrong spelling and missing Arabic support", () => {
    expect(checkFamily("Inter", fonts)).toEqual([]);
    expect(checkFamily("Helvetica Neue", fonts)[0]).toMatch(/not a Google Fonts family/);
    expect(checkFamily("inter", fonts)[0]).toMatch(/spelled "Inter"/);
    expect(checkFamily("Inter", fonts, "arabic")[0]).toMatch(/no arabic subset/);
    expect(checkFamily("Cairo", fonts, "arabic")).toEqual([]);
  });

  it("checks all four slots of a type spec", () => {
    const problems = checkTypeSpec({ latin: { display: "Inter", body: "Futura" }, arabic: { display: "Inter", body: "Cairo" } }, fonts);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/^type\.latin\.body/);
    expect(problems[1]).toMatch(/^type\.arabic\.display/);
  });

  it("the cached list in data/ knows common families", () => {
    const real = loadFonts();
    expect(checkFamily("Noto Kufi Arabic", real, "arabic")).toEqual([]);
    expect(checkFamily("IBM Plex Sans Arabic", real, "arabic")).toEqual([]);
    expect(checkFamily("Fraunces", real)).toEqual([]);
    expect(checkFamily("Comic Sans MS", real)).not.toEqual([]);
  });
});
