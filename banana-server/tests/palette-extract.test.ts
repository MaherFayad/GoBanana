import { describe, expect, it } from "vitest";
import { extractPalette, MAX_SIZE, MIN_SIZE } from "@/lib/palette";
import { decodeImage, detectFormat } from "@/lib/palette/decode";
import { medianCut, quantize, samplePixels } from "@/lib/palette/quantize";
import { assignRoles, ROLES } from "@/lib/palette/roles";
import { contrastRatio } from "@/lib/palette/contrast";
import { hexToOklab, oklabDistance } from "@/lib/palette/color";
import { RICH_COLORS, type RGBA, bandsRgba, encodeJpeg, encodePng, fakeWebp, hexToRgba, richImage } from "./fixtures/palette-images";

const near = (a: string, b: string) => oklabDistance(hexToOklab(a), hexToOklab(b));

describe("decode", () => {
  it("detects formats by magic bytes", () => {
    const img = bandsRgba([[hexToRgba("#ff0000"), 4]], 4);
    expect(detectFormat(encodePng(img))).toBe("png");
    expect(detectFormat(encodeJpeg(img))).toBe("jpeg");
    expect(detectFormat(fakeWebp())).toBe("webp");
    expect(detectFormat(new Uint8Array([1, 2, 3]))).toBe("unknown");
  });

  it("decodes PNG and JPEG to RGBA", () => {
    const img = bandsRgba([[hexToRgba("#2a9d8f"), 16]], 16);
    const png = decodeImage(encodePng(img));
    expect(png.ok && png.width === 16 && png.height === 16 && png.rgba.length === 16 * 16 * 4).toBe(true);
    if (png.ok) expect(Array.from(png.rgba.slice(0, 4))).toEqual([0x2a, 0x9d, 0x8f, 255]);
    const jpg = decodeImage(encodeJpeg(img));
    expect(jpg.ok && jpg.width === 16).toBe(true);
  });

  it("returns unsupported_format for WebP and decode_failed for broken bytes", () => {
    expect(decodeImage(fakeWebp())).toEqual({ ok: false, format: "webp", reason: "unsupported_format" });
    const broken = encodePng(bandsRgba([[hexToRgba("#000000"), 8]], 8)).slice(0, 40);
    expect(decodeImage(broken)).toMatchObject({ ok: false, reason: "decode_failed" });
  });
});

describe("quantize", () => {
  it("skips near-transparent pixels", () => {
    const img = bandsRgba([[hexToRgba("#ff0000", 255), 8], [hexToRgba("#0000ff", 10), 8]], 8);
    const s = samplePixels(img.data, img.width, img.height, 1000);
    for (let i = 0; i < s.length; i += 3) expect([s[i], s[i + 1], s[i + 2]]).toEqual([255, 0, 0]);
  });

  it("downsamples to the budget", () => {
    const img = bandsRgba([[hexToRgba("#ff0000"), 400]], 400);
    expect(samplePixels(img.data, 400, 400, 1000).length / 3).toBeLessThanOrEqual(1000);
  });

  it("keeps identical colors in one box", () => {
    const rgb = Uint8Array.from([10, 10, 10, 10, 10, 10, 200, 0, 0, 200, 0, 0]);
    const boxes = medianCut(rgb, 8);
    expect(boxes).toHaveLength(2);
  });

  it("returns exact colors for a lossless two-color image", () => {
    const img = bandsRgba([[hexToRgba("#e63946"), 48], [hexToRgba("#1d3557"), 16]], 32);
    const decoded = decodeImage(encodePng(img));
    if (!decoded.ok) throw new Error("decode failed");
    const colors = quantize(samplePixels(decoded.rgba, decoded.width, decoded.height, 5000), { size: 6 });
    expect(colors.map((c) => c.hex)).toEqual(["#e63946", "#1d3557"]);
    expect(colors[0]?.share).toBeCloseTo(0.75, 1);
  });
});

describe("extractPalette", () => {
  it("finds the two colors of a two-color PNG and assigns surface and on-surface", () => {
    const img = bandsRgba([[hexToRgba("#ffffff"), 48], [hexToRgba("#1d3557"), 16]], 32);
    const result = extractPalette({ images: [encodePng(img)] });
    expect(result.palette).toEqual([
      { hex: "#ffffff", oklch: "oklch(1 0 0)", role: "surface" },
      expect.objectContaining({ hex: "#1d3557", role: "on-surface" }),
    ]);
    expect(result.skipped).toEqual([]);
  });

  it("finds four colors in a JPEG within a small tolerance", () => {
    const expected = ["#f1faee", "#e63946", "#1d3557", "#2a9d8f"];
    // Bands aligned to 16 px blocks so JPEG does not blend neighbours much.
    const widths = [64, 48, 32, 16];
    const img = bandsRgba(expected.map((hex, i): [RGBA, number] => [hexToRgba(hex), widths[i] ?? 16]), 32);
    const result = extractPalette({ images: [encodeJpeg(img, 95)], size: 5 });
    for (const hex of expected) {
      const best = Math.min(...result.palette.map((p) => near(p.hex, hex)));
      expect(best, `missing ${hex}`).toBeLessThan(0.03);
    }
    expect(result.palette.length).toBeLessThanOrEqual(5);
  });

  it("merges colors across several images", () => {
    const a = encodePng(bandsRgba([[hexToRgba("#ffbe0b"), 32]], 32));
    const b = encodePng(bandsRgba([[hexToRgba("#8338ec"), 32]], 32));
    const hexes = extractPalette({ images: [a, b] }).palette.map((p) => p.hex).sort();
    expect(hexes).toEqual(["#8338ec", "#ffbe0b"]);
  });

  it("returns exactly `size` colors for a rich image, for every size 5..9", () => {
    const bytes = encodePng(richImage());
    for (let size = MIN_SIZE; size <= MAX_SIZE; size++) {
      const { palette } = extractPalette({ images: [bytes], size });
      expect(palette).toHaveLength(size);
      expect(new Set(palette.map((p) => p.hex)).size).toBe(size);
      for (const p of palette) expect(RICH_COLORS).toContain(p.hex);
    }
  });

  it("defaults to 6 colors and rejects sizes outside 5..9", () => {
    const bytes = encodePng(richImage());
    expect(extractPalette({ images: [bytes] }).palette).toHaveLength(6);
    for (const size of [4, 10, 5.5, Number.NaN]) {
      expect(() => extractPalette({ images: [bytes], size })).toThrow(RangeError);
    }
  });

  it("uses all six roles exactly once at size 6", () => {
    const { palette } = extractPalette({ images: [encodePng(richImage())], size: 6 });
    expect(palette.map((p) => p.role)).toEqual([...ROLES]);
  });

  it("is deterministic", () => {
    const bytes = encodeJpeg(richImage(), 80);
    const a = extractPalette({ images: [bytes], size: 7 });
    const b = extractPalette({ images: [bytes.slice()], size: 7 });
    expect(b).toEqual(a);
  });

  it("builds contrast pairs vs surface, on-surface, white and black", () => {
    const { palette, contrast } = extractPalette({ images: [encodePng(richImage())] });
    const surface = palette.find((p) => p.role === "surface")!.hex;
    const onSurface = palette.find((p) => p.role === "on-surface")!.hex;
    expect(contrast.length).toBeGreaterThan(0);
    for (const p of palette) {
      for (const bg of [surface, onSurface, "#ffffff", "#000000"]) {
        if (bg === p.hex) continue;
        expect(
          contrast.some((c) => (c.fg === p.hex && c.bg === bg) || (c.fg === bg && c.bg === p.hex)),
          `${p.hex} vs ${bg}`,
        ).toBe(true);
      }
    }
    for (const c of contrast) {
      expect(c.ratio).toBeCloseTo(contrastRatio(c.fg, c.bg), 2);
      expect(c.tag).toBe(c.passesText ? "ship" : "explore");
      expect(c.passesUi).toBe(contrastRatio(c.fg, c.bg) >= 3);
    }
  });

  it("skips WebP and other unsupported bytes and still uses the rest", () => {
    const png = encodePng(bandsRgba([[hexToRgba("#06d6a0"), 16]], 16));
    const result = extractPalette({ images: [fakeWebp(), png, new Uint8Array([0, 1, 2])] });
    expect(result.skipped).toEqual([
      { index: 0, format: "webp", reason: "unsupported_format" },
      { index: 2, format: "unknown", reason: "unsupported_format" },
    ]);
    expect(result.palette.map((p) => p.hex)).toEqual(["#06d6a0"]);
  });

  it("returns an empty palette when nothing decodes", () => {
    expect(extractPalette({ images: [fakeWebp()] })).toMatchObject({ palette: [], contrast: [] });
    expect(extractPalette({ images: [] })).toEqual({ palette: [], contrast: [], skipped: [] });
  });
});

describe("assignRoles", () => {
  const input = [
    { hex: "#f8f9fa", weight: 500 },
    { hex: "#212529", weight: 120 },
    { hex: "#e63946", weight: 200 },
    { hex: "#ff006e", weight: 30 },
    { hex: "#8d99ae", weight: 80 },
    { hex: "#2a9d8f", weight: 90 },
  ];

  it("assigns roles from lightness and chroma", () => {
    const roles = Object.fromEntries(assignRoles(input).map((c) => [c.role, c.hex]));
    expect(roles).toEqual({
      surface: "#f8f9fa",
      "on-surface": "#212529",
      primary: "#e63946",
      accent: "#ff006e",
      neutral: "#8d99ae",
      secondary: "#2a9d8f",
    });
  });

  it("is stable under input order", () => {
    const a = assignRoles(input);
    const b = assignRoles([...input].reverse());
    const c = assignRoles([input[3]!, input[0]!, input[5]!, input[1]!, input[4]!, input[2]!]);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("picks a dark surface for a mostly dark image", () => {
    const roles = assignRoles([
      { hex: "#0b0c10", weight: 900 },
      { hex: "#f5f5f5", weight: 100 },
      { hex: "#66fcf1", weight: 50 },
    ]);
    expect(roles.map((r) => [r.role, r.hex])).toEqual([
      ["primary", "#66fcf1"],
      ["surface", "#0b0c10"],
      ["on-surface", "#f5f5f5"],
    ]);
  });

  it("gives extra colors neutral or secondary roles", () => {
    const extras = assignRoles([
      ...input,
      { hex: "#adb5bd", weight: 40 },
      { hex: "#ffbe0b", weight: 35 },
    ]);
    expect(extras).toHaveLength(8);
    expect(extras.find((c) => c.hex === "#adb5bd")?.role).toBe("neutral");
    expect(extras.find((c) => c.hex === "#ffbe0b")?.role).toBe("secondary");
  });
});
