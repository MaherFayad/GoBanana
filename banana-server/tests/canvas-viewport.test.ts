import { describe, expect, it } from "vitest";
import {
  clampZoom,
  clearanceAbove,
  clearanceBelow,
  FIT_PADDING,
  MAX_ZOOM,
  MIN_ZOOM,
  nextZoomStep,
  ZOOM_DURATION,
  ZOOM_STEPS,
  zoomAround,
  zoomPercent,
} from "@/canvas/viewport";

describe("zoom ladder (spec 6.1)", () => {
  it("runs from 10% to 400%", () => {
    expect(ZOOM_STEPS).toEqual([0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]);
    expect(MIN_ZOOM).toBe(0.1);
    expect(MAX_ZOOM).toBe(4);
    expect(FIT_PADDING).toBe("64px");
    expect(ZOOM_DURATION).toBe(220);
  });

  it("steps up and down from a step", () => {
    expect(nextZoomStep(1, 1)).toBe(1.25);
    expect(nextZoomStep(1, -1)).toBe(0.75);
    expect(nextZoomStep(3, 1)).toBe(4);
    expect(nextZoomStep(0.25, -1)).toBe(0.1);
  });

  it("goes to the nearest step from between steps (after a pinch)", () => {
    expect(nextZoomStep(1.1, 1)).toBe(1.25);
    expect(nextZoomStep(1.1, -1)).toBe(1);
    expect(nextZoomStep(0.7499999, 1)).toBe(1);
    expect(nextZoomStep(0.7500001, -1)).toBe(0.5);
  });

  it("stays put at the ends and clamps odd input", () => {
    expect(nextZoomStep(4, 1)).toBe(4);
    expect(nextZoomStep(0.1, -1)).toBe(0.1);
    expect(nextZoomStep(9, 1)).toBe(4);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampZoom(0.01)).toBe(0.1);
  });

  it("formats the percentage", () => {
    expect(zoomPercent(1)).toBe("100%");
    expect(zoomPercent(0.333)).toBe("33%");
    expect(zoomPercent(12)).toBe("400%");
  });

  it("zooms around a screen point", () => {
    const vp = zoomAround({ x: 0, y: 0, zoom: 1 }, 2, { x: 100, y: 50 });
    expect(vp).toEqual({ x: -100, y: -50, zoom: 2 });
    // The anchor stays on the same board point: (100 - x) / zoom is unchanged.
    expect((100 - vp.x) / vp.zoom).toBe(100);
  });
});

describe("focus not obscured by the notch (SC 2.4.11)", () => {
  const bar = { left: 400, top: 0, right: 700, bottom: 40 };
  it("returns 0 when the item is clear", () => {
    expect(clearanceBelow({ left: 0, top: 0, right: 100, bottom: 100 }, bar)).toBe(0);
    expect(clearanceBelow({ left: 450, top: 60, right: 600, bottom: 200 }, bar)).toBe(0);
  });
  it("pans by the overlap plus 8 px", () => {
    expect(clearanceBelow({ left: 450, top: 10, right: 600, bottom: 200 }, bar)).toBe(38);
    expect(clearanceBelow({ left: 450, top: -50, right: 600, bottom: 20 }, bar)).toBe(98);
  });
});

describe("focus not obscured by the bottom tool dock (SC 2.4.11)", () => {
  const dock = { left: 400, top: 800, right: 700, bottom: 850 };
  it("returns 0 when the item is clear", () => {
    expect(clearanceAbove({ left: 0, top: 700, right: 100, bottom: 840 }, dock)).toBe(0);
    expect(clearanceAbove({ left: 450, top: 600, right: 600, bottom: 780 }, dock)).toBe(0);
  });
  it("pans up by the overlap plus 8 px", () => {
    expect(clearanceAbove({ left: 450, top: 700, right: 600, bottom: 820 }, dock)).toBe(28);
  });
});
