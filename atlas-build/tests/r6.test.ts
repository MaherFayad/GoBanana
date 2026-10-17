/** Refinement R6: the pure parts of r6-crops (screens list), r6-weak-pages (shard trim) and r6-page-names (guard). */
import { describe, expect, it } from "vitest";
import type { GoldImage } from "../jobs/j11-crops.ts";
import { partScreens, segAskList } from "../jobs/r6-crops.ts";
import { guardNames } from "../jobs/r6-page-names.ts";
import { NEW_PAGES, trimNewPages } from "../jobs/r6-weak-pages.ts";
import { pageFitKey } from "../jobs/r1-gulf-page-fit.ts";
import type { PageAnatomy, PageFitScore } from "../schema.ts";

const part = (role: string, x: number, w: number) => ({ id: `${role}${x}`, role, crop: { x, y: 0.2, w, h: 0.1 } }) as unknown as GoldImage["parts"][number];

describe("r6-crops screens list", () => {
  const image = { key: "k", imageUrl: "u", parts: [part("cards", 0.4, 0.2), part("status-header", 0.05, 0.25), part("cta", 0.9, 0.05)] } as GoldImage;
  const boxes = [
    { x: 0.03, y: 0.1, w: 0.3, h: 0.8 },
    { x: 0.36, y: 0.1, w: 0.3, h: 0.8 },
  ];

  it("puts each part on the found screen that holds its center, or none", () => {
    expect(partScreens(image, boxes)).toEqual([1, 0, -1]);
  });

  it("names the screens from the found boxes and lists the rest elsewhere", () => {
    expect(segAskList(image, boxes)).toBe("Cut these parts. The image shows 2 screens; each part is named with the screen it sits on, counted from the left: screen 1 of 2: status-header; screen 2 of 2: cards; elsewhere on the image: cta.");
  });
});

describe("r6-weak-pages", () => {
  it("anchors every new page on a judged page of the same domain", () => {
    for (const [, pages] of Object.entries(NEW_PAGES)) for (const [page, near] of Object.entries(pages)) expect(page).not.toBe(near);
  });

  it("drops only the low rows of new pages in a domain over the shard budget", () => {
    const row = (pageId: string, score: 0 | 1 | 2 | 3, domainId = "d"): PageFitScore => ({ cardId: "c", domainId, pageId, score, ...(score >= 2 ? { reason: "ten words of reason here" } : {}) });
    const rows = [row("old", 1), row("new", 1), row("new2", 3), row("new", 1, "small")];
    const fresh = new Set([pageFitKey(rows[1]!), pageFitKey(rows[2]!)]);
    const out = trimNewPages(rows, fresh, () => {}, 200);
    expect(out).toEqual([row("old", 1), row("new2", 3), row("new", 1, "small")]);
  });
});

describe("r6-page-names guard", () => {
  const page = (id: string, en: string[]) => ({ id, names: { en, ar: ["x"] } }) as unknown as PageAnatomy;
  const base = [page("property-listing", ["property details page"]), page("pricing-page", ["pricing page", "plans page"])];

  it("keeps a name that moves no guard brief and drops one that does", () => {
    const { kept, dropped } = guardNames(base, new Map([["property-listing", ["apartment detail page", "pricing page for homes"]]]), ["pricing page for homes in a SaaS", "coffee shop landing page"]);
    expect(kept.get("property-listing")).toEqual(["apartment detail page"]);
    expect(dropped).toEqual(["property-listing: pricing page for homes"]);
  });
});
