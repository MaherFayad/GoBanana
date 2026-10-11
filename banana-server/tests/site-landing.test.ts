/**
 * Landing page logic that does not need a browser: the hero field geometry (lib/site/pan.ts),
 * the move tiles (lib/site/moves.ts), plan copy (lib/site/plans.ts) and the copy rules the
 * redesign added (both languages, same shape, APP_NAME never hardcoded, Arabic comma).
 */
import { describe, expect, it } from "vitest";
import { PLAN_PRICES } from "@/lib/billing/plans";
import { APP_NAME } from "@/lib/config";
import { ar } from "@/lib/site/dict/ar";
import { en } from "@/lib/site/dict/en";
import { ART_KINDS, GALLERY_BOARDS, HERO_TILES } from "@/lib/site/moves";
import {
  centerOffset,
  clampOffset,
  DRAG_THRESHOLD,
  inertiaStep,
  keyDelta,
  KEY_STEP,
  KEY_STEP_LARGE,
  revealOffset,
} from "@/lib/site/pan";
import { planFeatures, priceText, yearlySavingPercent } from "@/lib/site/plans";

const view = { w: 1000, h: 800 };
const plane = { w: 2000, h: 1600 };

describe("hero field geometry", () => {
  it("keeps the plane covering the view", () => {
    expect(clampOffset({ x: 50, y: 20 }, view, plane)).toEqual({ x: 0, y: 0 });
    expect(clampOffset({ x: -5000, y: -5000 }, view, plane)).toEqual({ x: -1000, y: -800 });
    expect(clampOffset({ x: -300, y: -200 }, view, plane)).toEqual({ x: -300, y: -200 });
  });

  it("centers a plane smaller than the view instead of clamping it", () => {
    expect(clampOffset({ x: -50, y: 0 }, { w: 1000, h: 800 }, { w: 600, h: 400 })).toEqual({ x: 200, y: 200 });
  });

  it("starts in the middle (Home), which matches the CSS start position of -25%", () => {
    expect(centerOffset(view, plane)).toEqual({ x: -500, y: -400 });
    expect(centerOffset(view, plane).x).toBe(-0.25 * plane.w);
  });

  it("pans with arrow keys in screen directions, three times as far with Shift", () => {
    expect(keyDelta("ArrowLeft", false)).toEqual({ x: KEY_STEP, y: 0 });
    expect(keyDelta("ArrowRight", false)).toEqual({ x: -KEY_STEP, y: 0 });
    expect(keyDelta("ArrowUp", true)).toEqual({ x: 0, y: KEY_STEP_LARGE });
    expect(keyDelta("ArrowDown", false)).toEqual({ x: 0, y: -KEY_STEP });
    expect(keyDelta("Enter", false)).toBeNull();
    expect(keyDelta("Home", false)).toBeNull();
    expect(KEY_STEP_LARGE).toBe(KEY_STEP * 3);
  });

  it("slows a fling down and stops it", () => {
    let offset = { x: 0, y: 0 };
    let velocity = { x: 2, y: -1 };
    let steps = 0;
    for (;;) {
      const r = inertiaStep(offset, velocity, 16);
      expect(Math.hypot(r.velocity.x, r.velocity.y)).toBeLessThan(Math.hypot(velocity.x, velocity.y));
      offset = r.offset;
      velocity = r.velocity;
      steps++;
      if (r.done) break;
      expect(steps).toBeLessThan(500);
    }
    expect(offset.x).toBeGreaterThan(100);
    expect(offset.y).toBeLessThan(-50);
  });

  it("pans a focused tile into view with a margin, and leaves a visible one alone", () => {
    const at = { x: -500, y: -400 };
    // Tile at plane x 1550: screen x 1050, past the end of a 1000px view.
    expect(revealOffset(at, { x: 1550, y: 500, w: 120, h: 100 }, view)).toEqual({ x: -694, y: -400 });
    // Tile at plane y 300: screen y -100, above the view.
    expect(revealOffset(at, { x: 700, y: 300, w: 120, h: 100 }, view)).toEqual({ x: -500, y: -276 });
    expect(revealOffset(at, { x: 700, y: 600, w: 120, h: 100 }, view)).toEqual(at);
  });

  it("treats small pointer moves as clicks", () => {
    expect(DRAG_THRESHOLD).toBeGreaterThanOrEqual(3);
  });
});

describe("move tiles", () => {
  it("has 12 to 16 hero tiles, each a known art kind, once, inside the plane", () => {
    expect(HERO_TILES.length).toBeGreaterThanOrEqual(12);
    expect(HERO_TILES.length).toBeLessThanOrEqual(16);
    expect(new Set(HERO_TILES.map((t) => t.art)).size).toBe(HERO_TILES.length);
    for (const t of HERO_TILES) {
      expect(ART_KINDS).toContain(t.art);
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThan(90);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeLessThan(90);
    }
  });

  it("has words for every tile in both languages, in the same order", () => {
    expect(en.landing.moves).toHaveLength(HERO_TILES.length);
    expect(ar.landing.moves).toHaveLength(HERO_TILES.length);
    for (const dict of [en, ar]) for (const m of dict.landing.moves) for (const v of Object.values(m)) expect(v.trim()).not.toBe("");
  });

  it("has four gallery boards of four tiles, matching the four gallery cards", () => {
    expect(GALLERY_BOARDS).toHaveLength(4);
    expect(en.landing.gallery.cards).toHaveLength(4);
    expect(ar.landing.gallery.cards).toHaveLength(4);
    for (const b of GALLERY_BOARDS) for (const k of b) expect(ART_KINDS).toContain(k);
  });
});

describe("plan copy", () => {
  it("formats prices from lib/billing/plans.ts", () => {
    expect(priceText("pro_monthly", en.pricing)).toEqual({ amount: `$${PLAN_PRICES.pro_monthly.amountUsd}`, period: en.pricing.perMonth });
    expect(priceText("free", ar.pricing).period).toBe(ar.pricing.free);
  });

  it("lists features from the plan limits", () => {
    const free = planFeatures("free", en.pricing);
    expect(free[0]).toBe("30 searches per month");
    expect(free).toContain(en.pricing.features.noShare);
    expect(planFeatures("pro_yearly", en.pricing)).toContain(en.pricing.features.canvasesUnlimited);
  });

  it("matches the advertised yearly saving", () => {
    expect(`Save ${yearlySavingPercent()}%`).toBe(en.pricing.yearlySave);
    expect(en.landing.pricing.yearlySave).toBe(en.pricing.yearlySave);
  });
});

describe("site copy rules for the redesign", () => {
  const strings = (v: unknown, out: string[] = []): string[] => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
    else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
    return out;
  };

  it("never hardcodes the product name (it comes from APP_NAME through {app})", () => {
    for (const s of [...strings(en), ...strings(ar)]) {
      expect(s).not.toMatch(/\bGo ?Banana\b/i);
      expect(s).not.toMatch(/\bBanana\b/);
    }
    expect(APP_NAME).toBeTruthy();
  });

  it("uses the Arabic comma in Arabic tile captions", () => {
    expect(ar.landing.field.caption).toContain("،");
    expect(en.landing.field.caption).toContain(",");
  });

  it("does not reuse the reference site's 404 headline", () => {
    expect(en.notFound.title.toLowerCase()).not.toContain("page was not found");
  });
});
