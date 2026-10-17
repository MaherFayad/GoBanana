/**
 * R6: screens found in code on presentation images (lib/vision/screens.ts), from synthetic RGBA.
 */
import { describe, expect, it } from "vitest";
import { detectScreens, screensLine } from "@/lib/vision/screens";

type Rect = { x: number; y: number; w: number; h: number; rgb: [number, number, number] };

/** A w x h RGBA image: a backdrop (flat, or a soft left to right gradient) with rectangles drawn on it. */
function image(w: number, h: number, backdrop: [number, number, number], rects: Rect[], gradient = 0): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const g = Math.round((gradient * x) / w);
      out.set([backdrop[0] - g, backdrop[1] - g, backdrop[2], 255], i);
    }
  for (const r of rects)
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        // A content stripe every 40 rows, like UI rows inside a screen.
        const stripe = (y - r.y) % 40 < 6 ? 60 : 0;
        out.set([Math.max(0, r.rgb[0] - stripe), Math.max(0, r.rgb[1] - stripe), Math.max(0, r.rgb[2] - stripe), 255], (y * w + x) * 4);
      }
  return out;
}

const near = (a: number, b: number) => Math.abs(a - b) <= 0.02;

describe("detectScreens", () => {
  it("finds three phones side by side on a flat backdrop, counted from the left", () => {
    const W = 1200;
    const H = 900;
    const phones = [90, 460, 830].map((x) => ({ x, y: 100, w: 280, h: 700, rgb: [250, 250, 250] as [number, number, number] }));
    const boxes = detectScreens(image(W, H, [200, 205, 215], phones), W, H);
    expect(boxes).toHaveLength(3);
    phones.forEach((p, i) => {
      expect(near(boxes[i]!.x, p.x / W)).toBe(true);
      expect(near(boxes[i]!.w, p.w / W)).toBe(true);
      expect(near(boxes[i]!.y, p.y / H)).toBe(true);
      expect(near(boxes[i]!.h, p.h / H)).toBe(true);
    });
  });

  it("works on a soft gradient backdrop with light screens", () => {
    const W = 1200;
    const H = 900;
    const phones = [240, 650].map((x) => ({ x, y: 130, w: 300, h: 650, rgb: [255, 255, 255] as [number, number, number] }));
    const boxes = detectScreens(image(W, H, [235, 238, 245], phones, 30), W, H);
    expect(boxes).toHaveLength(2);
    expect(near(boxes[1]!.x, 650 / W)).toBe(true);
  });

  it("gives no hint for a full bleed screenshot", () => {
    const W = 600;
    const H = 1300;
    expect(detectScreens(image(W, H, [255, 255, 255], [{ x: 0, y: 0, w: W, h: H, rgb: [20, 30, 40] }]), W, H)).toEqual([]);
  });

  it("gives no hint when the found shapes are not one screen size (overlap, odd sizes)", () => {
    const W = 1200;
    const H = 900;
    const rects = [
      { x: 60, y: 100, w: 280, h: 700, rgb: [250, 250, 250] as [number, number, number] },
      { x: 600, y: 300, w: 120, h: 400, rgb: [30, 30, 30] as [number, number, number] },
    ];
    expect(detectScreens(image(W, H, [200, 205, 215], rects), W, H)).toEqual([]);
  });

  it("refuses bad input", () => {
    expect(detectScreens(new Uint8Array(10), 100, 100)).toEqual([]);
    expect(detectScreens(new Uint8Array(0), 0, 0)).toEqual([]);
  });
});

describe("screensLine", () => {
  it("lists each screen's edges, or nothing", () => {
    expect(screensLine([])).toBeNull();
    const line = screensLine([
      { x: 0.076, y: 0.111, w: 0.233, h: 0.778 },
      { x: 0.383, y: 0.111, w: 0.233, h: 0.778 },
    ]);
    expect(line).toContain("screen 1: x 0.08 to 0.31, y 0.11 to 0.89");
    expect(line).toContain("screen 2: x 0.38 to 0.62");
  });
});
