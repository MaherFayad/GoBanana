/**
 * P1-I4: when the page is known, default crops come from the Atlas page anatomy bands, and the
 * phone detection for presentation shots stays. The anatomy here is a small hand-written fixture
 * shard (the Atlas data does not exist yet).
 */
import { describe, expect, it } from "vitest";
import type { PageAnatomy } from "@/lib/atlas/types";
import { anatomyBand, defaultCrop, ROLE_BANDS } from "@/lib/stitch/crop";
import { evaluateCrops, iou, parseGold } from "@/lib/stitch/crop-iou";

const CHECKOUT: PageAnatomy = {
  id: "checkout",
  names: { en: ["checkout"], ar: ["الدفع"] },
  platforms: ["mobile", "website"],
  sections: [
    { role: "status-header", element: "header", label: "Header", required: true, bands: { mobile: { y0: 0, y1: 0.1 } } },
    { role: "detail", element: "price-breakdown", label: "Order summary", required: true, bands: { mobile: { y0: 0.12, y1: 0.5 }, website: { y0: 0.2, y1: 0.6 } } },
    { role: "form", element: "form-field", label: "Card form", required: true, bands: { mobile: { y0: 0.5, y1: 0.82 } } },
    { role: "cta", element: "cta", label: "Pay button", required: true, bands: { mobile: { y0: 0.86, y1: 0.95 } } },
    // A broken band is ignored: the role keeps ROLE_BANDS.
    { role: "footer", element: "divider", label: "Footer", required: false, bands: { mobile: { y0: 0.9, y1: 0.9 } } },
  ],
  baseline: "Summary on top, card form, one pay button.",
  mustKeep: ["total", "pay button"],
  wildSpots: [{ element: "total", why: "the number people check" }],
  mobbinTerms: ["checkout"],
  queryNouns: ["checkout"],
};

const PHONE_SCREEN = { imageWidth: 390, imageHeight: 844, platform: "mobile" as const };

describe("crops from page anatomy", () => {
  it("takes the role's rows from the anatomy and keeps the role's width", () => {
    expect(defaultCrop("cta", { ...PHONE_SCREEN, anatomy: CHECKOUT })).toEqual({ x: ROLE_BANDS.cta.x, y: 0.86, w: ROLE_BANDS.cta.w, h: expect.closeTo(0.09, 5) });
    const detail = defaultCrop("detail", { ...PHONE_SCREEN, anatomy: CHECKOUT });
    expect(detail.y).toBe(0.12);
    expect(detail.h).toBeCloseTo(0.38, 5);
  });

  it("uses the band for the image's platform", () => {
    const web = defaultCrop("detail", { imageWidth: 1440, imageHeight: 900, platform: "website", anatomy: CHECKOUT });
    expect(web.y).toBe(0.2);
    // No band for the platform: back to ROLE_BANDS.
    expect(defaultCrop("form", { imageWidth: 1440, imageHeight: 900, platform: "website", anatomy: CHECKOUT })).toEqual(ROLE_BANDS.form);
  });

  it("falls back to ROLE_BANDS for roles the anatomy does not name or has a broken band for", () => {
    expect(anatomyBand("hero", { ...PHONE_SCREEN, anatomy: CHECKOUT })).toBeNull();
    expect(anatomyBand("footer", { ...PHONE_SCREEN, anatomy: CHECKOUT })).toBeNull();
    expect(defaultCrop("hero", { ...PHONE_SCREEN, anatomy: CHECKOUT })).toEqual(defaultCrop("hero", PHONE_SCREEN));
  });

  it("is unchanged without an anatomy", () => {
    expect(defaultCrop("cta", PHONE_SCREEN)).toEqual(ROLE_BANDS.cta);
  });

  it("keeps the phone detection: a presentation shot is cut from the middle phone", () => {
    const crop = defaultCrop("cta", { imageWidth: 3200, imageHeight: 2400, platform: "mobile", anatomy: CHECKOUT });
    expect(crop.x).toBeGreaterThanOrEqual(0.34);
    expect(crop.x + crop.w).toBeLessThanOrEqual(0.66 + 1e-9);
    expect(crop.y).toBeCloseTo(0.05 + 0.86 * 0.9, 5);
  });
});

describe("crop IoU evaluator", () => {
  it("scores boxes", () => {
    const a = { x: 0, y: 0, w: 0.5, h: 0.5 };
    expect(iou(a, a)).toBe(1);
    expect(iou(a, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 })).toBe(0);
    expect(iou(a, { x: 0, y: 0, w: 0.5, h: 0.25 })).toBeCloseTo(0.5, 5);
  });

  it("reads gold parts, drops malformed ones, and shows the anatomy bands beating ROLE_BANDS", () => {
    const { parts, dropped } = parseGold({
      parts: [
        { id: "p1", role: "cta", page: "checkout", platform: "mobile", imageWidth: 390, imageHeight: 844, crop: { x: 0.06, y: 0.86, w: 0.88, h: 0.09 }, agentCrop: { x: 0.06, y: 0.85, w: 0.88, h: 0.1 } },
        { id: "p2", role: "detail", page: "checkout", platform: "mobile", imageWidth: 390, imageHeight: 844, crop: { x: 0, y: 0.12, w: 1, h: 0.38 } },
        { id: "p3", role: "nav", platform: "mobile", crop: { x: 0, y: 0, w: 1, h: 0.08 } },
        { id: "bad", role: "not-a-role", crop: { x: 0, y: 0, w: 1, h: 1 } },
        { id: "bad2", role: "cta" },
      ],
    });
    expect(parts).toHaveLength(3);
    expect(dropped).toBe(2);
    const report = evaluateCrops(parts, new Map([["checkout", CHECKOUT]]));
    expect(report.withAnatomy.anatomy.n).toBe(2);
    expect(report.withAnatomy.anatomy.mean!).toBeGreaterThan(report.withAnatomy.roleBands.mean!);
    expect(report.agent.n).toBe(1);
    expect(report.agent.mean!).toBeGreaterThanOrEqual(0.8);
  });
});
