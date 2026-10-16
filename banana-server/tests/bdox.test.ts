/**
 * Best Designs on X (lib/sources/bdox.ts, owner request 2026-10-16): a curated local index of design
 * posts from X, searched by component words, linked out to the X post with the designer credited,
 * and never a model input.
 */
import { describe, expect, it, vi } from "vitest";
import { createSearchReferencesTool, bdoxWords, type Direction, type SearchReferencesDeps } from "@/lib/mcp/tools/search_references";
import { createMemoryUsageStore } from "@/lib/quota";
import { BDOX_IMAGE_HOSTS, DEFAULT_IMAGE_HOSTS, NO_MODEL_IMAGE_HOSTS, isAllowedImageUrl, parseAllowlist } from "@/lib/sources/allowlist";
import { BDOX_PARTS, MAX_BDOX_RESULTS, bdoxParts, bdoxReference, mergeBdox, searchBdox } from "@/lib/sources/bdox";
import index from "@/lib/sources/bdox-index.json";
import { laneTexts } from "@/lib/bend/queries";
import { SOURCE_REGISTRY, noModelInputHosts } from "@/lib/sources/registry";
import type { Reference } from "@/lib/sources/types";
import { referenceId, type WebSearchResult } from "@/lib/sources/web-search";
import { EMPTY_TAKEDOWNS, compileTakedowns } from "@/lib/takedown";
import { pickThumbUrl, thumbAllowlist } from "@/lib/vision/thumbs";
import candidates from "../bench/taste/candidates.json";
import picks from "../bench/taste/picks.default.json";

const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);
const allowImage = (url: string) => isAllowedImageUrl(url, allowlist);

describe("the curated index", () => {
  it("holds URLs only: X posts, the designer, images on the site's own CDN", () => {
    expect(index.items.length).toBeGreaterThanOrEqual(40);
    for (const i of index.items) {
      expect(i.postUrl).toMatch(/^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/status\/\d+$/);
      expect(i.postUrl.split("/")[3]).toBe(i.handle);
      for (const u of [i.imageUrl, i.thumbUrl]) expect(BDOX_IMAGE_HOSTS).toContain(new URL(u).hostname);
      expect(Object.keys(BDOX_PARTS)).toContain(i.component);
      expect(["mobile", "web"]).toContain(i.platform);
    }
  });

  it("matches the bx candidates the owner sees in the picker", () => {
    const bx = new Map(candidates.candidates.filter((c) => c.id.startsWith("bx")).map((c) => [c.id, c as { sourceUrl: string; component?: string; group?: string }]));
    for (const i of index.items) {
      expect(bx.get(i.id)).toMatchObject({ sourceUrl: i.postUrl, component: i.component, group: "Best Designs on X" });
    }
  });

  it("is not a Serper source: no registry entry, so no site: request and no J7 wording can name it", () => {
    const domains: string[] = SOURCE_REGISTRY.map((s) => s.domain);
    expect(domains.some((d) => d.includes("bestdesignsonx") || d === "x.com")).toBe(false);
  });

  it("is on the no-model list every Atlas judging job reads", () => {
    for (const h of ["cdn.bestdesignsonx.com", "bestdesignsonx.com", "x.com"]) expect(noModelInputHosts()).toContain(h);
  });
});

describe("never a model input", () => {
  const item = index.items[0]!;

  it("shows on the canvas (image allowlist) but is never passed to the agent as a thumbnail", () => {
    expect(DEFAULT_IMAGE_HOSTS).toContain("cdn.bestdesignsonx.com");
    expect(NO_MODEL_IMAGE_HOSTS).toContain("cdn.bestdesignsonx.com");
    expect(allowImage(item.imageUrl)).toBe(true);
    const thumbs = thumbAllowlist(allowlist);
    expect(thumbs.entries).not.toContain("cdn.bestdesignsonx.com");
    expect(pickThumbUrl({ imageUrl: item.imageUrl, thumbUrl: item.thumbUrl }, thumbs)).toBeNull();
    // Other sources still pass through.
    expect(pickThumbUrl({ imageUrl: "https://cdn.dribbble.com/userupload/1.png", thumbUrl: null }, thumbs)).not.toBeNull();
  });

  it("is never a taste exemplar by default for a model: its default picks are marked by group", () => {
    const bx = picks.picks.filter((p) => p.id.startsWith("bx"));
    expect(bx).toHaveLength(10);
    for (const p of bx) expect(p).toMatchObject({ group: "Best Designs on X" });
  });
});

describe("matching", () => {
  it("reads parts from component words, whole words, singular or plural", () => {
    expect(bdoxParts("toggles settings sliders app ui")).toEqual(["toggle", "slider"]);
    expect(bdoxParts("music player empty state app ui | music player notification app ui")).toEqual(["empty state", "notification"]);
    expect(bdoxParts("flight checkout itinerary app ui")).toEqual([]);
    expect(bdoxParts("platform informs")).toEqual([]);
    expect(bdoxParts("")).toEqual([]);
  });

  it("returns nothing when no part is named", () => {
    for (const t of ["saas analytics dashboard", "meditation timer", "coffee shop landing page", undefined, null]) {
      expect(searchBdox(t, { allowImage })).toEqual([]);
    }
  });

  it("puts the first named part first, one per designer, at most two", () => {
    const got = searchBdox("toggles and sliders", { platform: "mobile", allowImage });
    expect(got).toHaveLength(MAX_BDOX_RESULTS);
    expect(got[0]!.component).toBe("toggle");
    expect(new Set(got.map((g) => g.handle)).size).toBe(got.length);
    const all = searchBdox("toggle switch", { allowImage, limit: 10 });
    expect(all.every((g) => g.component === "toggle")).toBe(true);
  });

  it("keeps web-only parts off phone briefs and puts the brief's platform first", () => {
    expect(searchBdox("sidebar", { platform: "mobile", allowImage })).toEqual([]);
    expect(searchBdox("sidebar", { platform: "webapp", allowImage }).length).toBeGreaterThan(0);
    const cards = searchBdox("cards", { platform: "mobile", allowImage, limit: 10 });
    expect(cards[0]!.platform).toBe("mobile");
  });

  it("drops items whose image host is not allowed (an IMAGE_HOST_ALLOWLIST without the CDN)", () => {
    expect(searchBdox("button", { allowImage: () => false })).toEqual([]);
  });

  it("links the X post, credits the designer and is a UI result", () => {
    const item = searchBdox("button", { allowImage })[0]!;
    const ref = bdoxReference(item, referenceId);
    expect(ref).toMatchObject({ sourceUrl: item.postUrl, sourceSite: "x.com", creditUrl: `https://x.com/${item.handle}`, zone: "ui", imageUrl: item.imageUrl });
    expect(ref.title).toContain(`@${item.handle}`);
    expect(ref.title).toMatch(/on X, via Best Designs on X$/);
    expect(ref.title!.length).toBeLessThanOrEqual(200);
    expect(ref.lane).toBeUndefined();
  });
});

describe("mergeBdox", () => {
  const r = (id: string, zone: "ui" | "art" = "ui"): Reference => ({ id, imageUrl: "", thumbUrl: "", sourceUrl: `https://dribbble.com/shots/${id}`, sourceSite: "dribbble.com", zone });
  it("adds after the first two UI results, the last UI results make room, art keeps its places", () => {
    const refs = [r("u1"), r("u2"), r("u3"), r("u4"), r("a1", "art")];
    const extra = [r("x1"), r("x2")];
    expect(mergeBdox(refs, extra, 5).map((x) => x.id)).toEqual(["u1", "u2", "x1", "x2", "a1"]);
    expect(mergeBdox(refs, extra, 12).map((x) => x.id)).toEqual(["u1", "u2", "x1", "x2", "u3", "u4", "a1"]);
    expect(mergeBdox(refs, [], 5)).toEqual(refs);
  });
});

describe("bdoxWords", () => {
  it("takes component lanes, a component re-search or a plain query; never a genre", () => {
    const lanes = laneTexts("Settings screen with toggles, sliders and a save button", "sadu weaving", [], "d1", { platform: "mobile" });
    expect(bdoxWords({ lanes })).toContain("toggles");
    expect(bdoxWords({ lanes, lane: "bridge", laneUiWords: "toggle app ui" })).toBeNull();
    expect(bdoxWords({ lanes, lane: "component", laneUiWords: "toggle app ui" })).toBe("toggle app ui");
    expect(bdoxWords({ lanes: laneTexts("meditation timer", "sadu weaving", [], "d1", {}) })).toBeNull();
    expect(bdoxWords({ lanes: { ...lanes, genre: "presentation" } })).toBeNull();
    expect(bdoxWords({ query: "dark toggle switch" })).toBe("dark toggle switch");
    expect(bdoxWords({ query: "pitch deck for a fintech startup with charts" })).toBeNull();
  });
});

describe("search_references", () => {
  const web: Reference = {
    id: "ref_0000000000000001",
    thumbUrl: "https://cdn.dribbble.com/userupload/1.png",
    imageUrl: "https://cdn.dribbble.com/userupload/1.png",
    sourceUrl: "https://dribbble.com/shots/1-a",
    sourceSite: "dribbble.com",
    title: "Toggle by A on Dribbble",
    lane: "component",
  };
  const direction = (brief: string): Direction => ({ id: "row-1", bendId: "bd-1", canvasId: "c1", searchQuery: "sadu weaving", brief, detail: { platform: "mobile", brief } as never });

  function setup(brief: string, over: Partial<SearchReferencesDeps> = {}) {
    const result: WebSearchResult = { references: [web], ok: true };
    const deps: SearchReferencesDeps = {
      adapter: { run: vi.fn(async () => result), runPlan: vi.fn(async () => result) },
      usage: createMemoryUsageStore(),
      getPlan: async () => "free",
      getDirection: async () => direction(brief),
      addToTray: async () => true,
      upgradeUrl: () => "https://example.test/pricing",
      now: () => new Date("2026-10-16T12:00:00Z"),
      allowImage,
      loadTakedowns: async () => EMPTY_TAKEDOWNS,
      ...over,
    };
    return createSearchReferencesTool(deps);
  }
  const refsOf = (res: { structuredContent?: unknown }) => (res.structuredContent as { references: Reference[] }).references;

  it("adds index matches for a brief that names a part", async () => {
    const res = await setup("Settings screen with toggles, sliders and a save button")({ directionId: "bd-1", count: 8, zone: "ui" }, "u1");
    const refs = refsOf(res);
    expect(refs[0]!.id).toBe(web.id);
    const bx = refs.filter((r) => r.sourceSite === "x.com");
    expect(bx).toHaveLength(2);
    expect(bx.every((r) => r.zone === "ui" && r.creditUrl?.startsWith("https://x.com/"))).toBe(true);
  });

  it("leaves a brief that names no part exactly as the adapter returned it", async () => {
    const res = await setup("meditation timer")({ directionId: "bd-1", count: 8, zone: "ui" }, "u1");
    expect(refsOf(res)).toEqual([{ ...web, zone: "ui" }]);
  });

  it("adds nothing when the caller picked sources, or the takedown list fails or blocks it", async () => {
    const brief = "Settings screen with toggles, sliders and a save button";
    const picked = await setup(brief)({ directionId: "bd-1", count: 8, zone: "ui", sources: ["dribbble"] }, "u1");
    expect(refsOf(picked).some((r) => r.sourceSite === "x.com")).toBe(false);
    const failing = await setup(brief, { loadTakedowns: async () => Promise.reject(new Error("db down")) })({ directionId: "bd-1", count: 8, zone: "ui" }, "u1");
    expect(refsOf(failing).some((r) => r.sourceSite === "x.com")).toBe(false);
    const all = compileTakedowns(index.items.map((i) => i.postUrl));
    const blocked = await setup(brief, { loadTakedowns: async () => all })({ directionId: "bd-1", count: 8, zone: "ui" }, "u1");
    expect(refsOf(blocked).some((r) => r.sourceSite === "x.com")).toBe(false);
  });

  it("answers a plain component query too", async () => {
    const res = await setup("meditation timer")({ query: "dark toggle switch", count: 8 }, "u1");
    expect(refsOf(res).filter((r) => r.sourceSite === "x.com").length).toBeGreaterThan(0);
  });
});
