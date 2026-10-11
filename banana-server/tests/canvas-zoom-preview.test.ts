/** Node chrome under zoom, the sharp-image switch, click versus drag, and the image preview's zoom math. */
import { describe, expect, it } from "vitest";
import {
  canPan,
  clampPan,
  fitScale,
  fitView,
  panBy,
  percent,
  scaleRange,
  PREVIEW_MAX_SCALE,
  PREVIEW_MIN_SCALE,
  swipeDirection,
  toggleFit,
  wheelZoom,
  zoomStep,
  zoomTo,
} from "@/canvas/preview-zoom";
import { chromeMode, chromeScale, isClick, isPlainClick, wantFullImage } from "@/canvas/zoom-chrome";

describe("chrome keeps one on-screen size", () => {
  it("counter-scales by 1 / zoom", () => {
    expect(chromeScale(1)).toBe(1);
    expect(chromeScale(3)).toBeCloseTo(1 / 3);
    expect(chromeScale(0.25)).toBe(4);
    // A 24px button at zoom 3: 24 * 3 (viewport) * 1/3 (counter-scale) = 24 on screen.
    expect(24 * 3 * chromeScale(3)).toBeCloseTo(24);
    expect(chromeScale(0)).toBe(1);
    expect(chromeScale(Number.NaN)).toBe(1);
  });

  it("picks the chrome mode from the tile's on-screen width", () => {
    expect(chromeMode(280, 1)).toBe("full");
    expect(chromeMode(280, 3)).toBe("full");
    expect(chromeMode(280, 0.6)).toBe("icon"); // 168 px
    expect(chromeMode(280, 0.4)).toBe("tiny"); // 112 px
    expect(chromeMode(120, 1)).toBe("icon");
  });
});

describe("sharp images when zoomed", () => {
  it("keeps the thumbnail at 100% when it covers the tile", () => {
    expect(wantFullImage({ nodeWidth: 280, zoom: 1, thumbNaturalWidth: 236 })).toBe(false);
  });

  it("switches when zoomed in past 100%", () => {
    expect(wantFullImage({ nodeWidth: 280, zoom: 1.01, thumbNaturalWidth: 2000 })).toBe(true);
    expect(wantFullImage({ nodeWidth: 280, zoom: 3, thumbNaturalWidth: 236 })).toBe(true);
  });

  it("switches when the tile is wider than 1.2 x the thumbnail's pixels", () => {
    expect(wantFullImage({ nodeWidth: 400, zoom: 1, thumbNaturalWidth: 236 })).toBe(true);
    expect(wantFullImage({ nodeWidth: 283, zoom: 1, thumbNaturalWidth: 236 })).toBe(false);
    expect(wantFullImage({ nodeWidth: 284, zoom: 1, thumbNaturalWidth: 236 })).toBe(true);
  });

  it("before the thumbnail loads, big tiles want the full image", () => {
    expect(wantFullImage({ nodeWidth: 280, zoom: 1 })).toBe(false);
    expect(wantFullImage({ nodeWidth: 560, zoom: 1, thumbNaturalWidth: null })).toBe(true);
  });

  it("zoomed out never needs the full image", () => {
    expect(wantFullImage({ nodeWidth: 560, zoom: 0.25, thumbNaturalWidth: 236 })).toBe(false);
  });
});

describe("click versus drag", () => {
  it("under 4 px is a click, 4 px or more is a drag", () => {
    expect(isClick({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(true);
    expect(isClick({ x: 10, y: 10 }, { x: 12, y: 12 })).toBe(true); // 2.8 px
    expect(isClick({ x: 10, y: 10 }, { x: 14, y: 10 })).toBe(false);
    expect(isClick({ x: 10, y: 10 }, { x: 13, y: 13 })).toBe(false); // 4.2 px
  });

  it("modifier keys and other buttons are never a preview click", () => {
    const base = { button: 0, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false };
    expect(isPlainClick(base)).toBe(true);
    expect(isPlainClick({ ...base, shiftKey: true })).toBe(false);
    expect(isPlainClick({ ...base, metaKey: true })).toBe(false);
    expect(isPlainClick({ ...base, ctrlKey: true })).toBe(false);
    expect(isPlainClick({ ...base, button: 2 })).toBe(false);
  });
});

describe("preview zoom and pan", () => {
  const image = { w: 2000, h: 1000 };
  const stage = { w: 1000, h: 800 };

  it("fits and centers", () => {
    expect(fitScale(image, stage)).toBe(0.5);
    expect(fitView(image, stage)).toEqual({ scale: 0.5, x: 0, y: 150 });
    expect(fitScale({ w: 0, h: 0 }, stage)).toBe(1);
  });

  it("zooms around a fixed point", () => {
    const v = zoomTo({ scale: 1, x: 0, y: 0 }, 2, { w: 4000, h: 4000 }, stage, { x: 100, y: 100 });
    // The image pixel under (100, 100) stays under it.
    expect(v).toEqual({ scale: 2, x: -100, y: -100 });
  });

  it("steps in and out by 1.25 and clamps", () => {
    const fit = fitView(image, stage);
    expect(zoomStep(fit, 1, image, stage).scale).toBeCloseTo(0.625);
    expect(zoomStep(fit, -1, image, stage).scale).toBeCloseTo(0.4);
    expect(zoomTo(fit, 100, image, stage).scale).toBe(PREVIEW_MAX_SCALE);
    expect(zoomTo(fit, 0, image, stage).scale).toBe(PREVIEW_MIN_SCALE);
  });

  it("a tiny image can still zoom past its fit size", () => {
    const tiny = { w: 64, h: 48 };
    const fit = fitView(tiny, stage);
    expect(fit.scale).toBeGreaterThan(PREVIEW_MAX_SCALE);
    expect(scaleRange(tiny, stage).max).toBe(fit.scale * 2);
    expect(zoomStep(fit, 1, tiny, stage).scale).toBeGreaterThan(fit.scale);
  });

  it("wheel up zooms in, wheel down zooms out", () => {
    const fit = fitView(image, stage);
    expect(wheelZoom(fit, -100, image, stage, { x: 500, y: 400 }).scale).toBeGreaterThan(0.5);
    expect(wheelZoom(fit, 100, image, stage, { x: 500, y: 400 }).scale).toBeLessThan(0.5);
  });

  it("pans only inside the image's edges, and centers a small side", () => {
    const v = { scale: 1, x: 0, y: 0 };
    expect(panBy(v, 50, 0, image, stage).x).toBe(0); // no gap at the start edge
    expect(panBy(v, -5000, 0, image, stage).x).toBe(stage.w - image.w);
    expect(clampPan({ scale: 0.25, x: 0, y: 0 }, image, stage)).toEqual({ scale: 0.25, x: 250, y: 275 });
    expect(canPan(fitView(image, stage), image, stage)).toBe(false);
    expect(canPan(v, image, stage)).toBe(true);
  });

  it("double click toggles fit and 100%", () => {
    const fit = fitView(image, stage);
    expect(toggleFit(fit, image, stage).scale).toBe(1);
    expect(toggleFit({ scale: 1, x: -10, y: -10 }, image, stage)).toEqual(fit);
  });

  it("reads as a percentage", () => {
    expect(percent(0.5)).toBe("50%");
    expect(percent(1.25)).toBe("125%");
  });

  it("swipes left for next, right for previous, mirrored in rtl", () => {
    expect(swipeDirection(-80, 5)).toBe(1);
    expect(swipeDirection(80, 5)).toBe(-1);
    expect(swipeDirection(80, 5, true)).toBe(1);
    expect(swipeDirection(30, 0)).toBe(0);
    expect(swipeDirection(-80, 90)).toBe(0); // mostly vertical
  });
});
