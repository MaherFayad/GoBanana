/**
 * Web showcase styles (2026-10-16): playful, 3D, WebGL and motion-led website briefs search the
 * showcase galleries (Awwwards, Craftwork) with the style's own words. Mobile, tablet and web app
 * briefs are unchanged. Pure.
 */
import { describe, expect, it } from "vitest";
import { laneTexts } from "@/lib/bend/queries";
import { DEFAULT_IMAGE_HOSTS, isAllowedImageUrl, parseAllowlist } from "@/lib/sources/allowlist";
import { isItemPage } from "@/lib/sources/item-page";
import { galleryWords, planRequests, showcaseWords } from "@/lib/sources/plan";
import { buildSourceQuery } from "@/lib/sources/query";
import { SOURCE_REGISTRY, pickGalleries, sourceEntry } from "@/lib/sources/registry";
import { SHOWCASE_STYLES, SHOWCASE_TAGS, showcaseLane, showcaseStyles } from "@/lib/sources/showcase";
import { SOURCE_SITES } from "@/lib/sources/types";

const COFFEE = "coffee shop landing page";
const KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];

describe("registry", () => {
  it("adds Craftwork as a style-only website showcase gallery", () => {
    const c = sourceEntry("craftwork");
    expect(SOURCE_SITES).toContain("craftwork");
    expect(c).toMatchObject({ domain: "craftwork.design", scope: "craftwork.design/curated/website", role: "gallery", zone: "ui", platforms: ["website"], showcase: "word", styleOnly: true });
    expect(c.imageHosts).toEqual(["craftwork-products.b-cdn.net", "marketstorage.b-cdn.net", "curated-images.b-cdn.net"]);
    expect(c.measured.date).toBe("2026-10-16");
    expect(buildSourceQuery("playful", "craftwork")).toBe("playful site:craftwork.design/curated/website");
  });

  it("Craftwork item pages are one site each", () => {
    const ok = (u: string) => isItemPage(new URL(u), "craftwork");
    expect(ok("https://craftwork.design/curated/website/utopia-tokyo")).toBe(true);
    expect(ok("https://craftwork.design/curated/website/loaf-d312cb/")).toBe(true);
    expect(ok("https://craftwork.design/inspiration/websites")).toBe(false);
    expect(ok("https://craftwork.design/curated/website")).toBe(false);
    expect(ok("https://craftwork.design/templates/foo")).toBe(false);
    expect(ok("https://curated.design/curated/website/utopia-tokyo")).toBe(false);
  });

  it("Awwwards carries every showcase tag and searches phrases; MotionSites is not a source", () => {
    const a = sourceEntry("awwwards");
    expect(a.showcase).toBe("phrase");
    for (const t of SHOWCASE_TAGS) expect(a.tags).toContain(t);
    expect(a.tags).toEqual(expect.arrayContaining(["award", "immersive"]));
    expect(SOURCE_REGISTRY.some((s) => s.domain.includes("motionsites"))).toBe(false);
    // Craftwork only carries the tags of styles with a one-word search.
    for (const s of SHOWCASE_STYLES) expect(sourceEntry("craftwork").tags.includes(s.id)).toBe(Boolean(s.word));
  });
});

describe("allowlist", () => {
  const allow = parseAllowlist(DEFAULT_IMAGE_HOSTS);
  it("allows Craftwork's exact CDN hosts, never the shared b-cdn.net zone or its icon host", () => {
    for (const h of ["craftwork-products.b-cdn.net", "marketstorage.b-cdn.net", "curated-images.b-cdn.net"]) {
      expect(DEFAULT_IMAGE_HOSTS).toContain(h);
      expect(isAllowedImageUrl(`https://${h}/objects/a/b/card-image-1600.webp?token=x&expires=1`, allow)).toBe(true);
    }
    expect(isAllowedImageUrl("https://cfw6.b-cdn.net/icon.png", allow)).toBe(false);
    expect(isAllowedImageUrl("https://someone-else.b-cdn.net/x.png", allow)).toBe(false);
    expect(DEFAULT_IMAGE_HOSTS.some((h) => h.includes("*"))).toBe(false);
  });
});

describe("showcase styles", () => {
  it("maps style words and synonyms to one style, whole words only", () => {
    expect(showcaseStyles(["too fun"]).map((s) => s.id)).toEqual(["playful"]);
    expect(showcaseStyles(["Motion-first"]).map((s) => s.id)).toEqual(["animation"]);
    expect(showcaseStyles(["three.js"]).map((s) => s.id)).toEqual(["webgl"]);
    expect(showcaseStyles(["immersive scroll"]).map((s) => s.id)).toEqual(["storytelling"]);
    expect(showcaseStyles(["kinetic type"]).map((s) => s.id)).toEqual(["kinetic typography"]);
    expect(showcaseStyles([], "fund management landing page")).toEqual([]);
    expect(showcaseStyles(["dark mode", "minimal", "editorial"])).toEqual([]);
  });

  it("the lane takes the first style's phrase and the first one word any style has", () => {
    expect(showcaseLane(["playful"])).toEqual({ phrase: "playful illustration", word: "playful", ids: ["playful"] });
    expect(showcaseLane(["kinetic typography", "3d"])).toEqual({ phrase: "kinetic typography", word: "3d", ids: ["kinetic typography", "3d"] });
    expect(showcaseLane(["experimental"])).toEqual({ phrase: "experimental", ids: ["experimental"] });
    expect(showcaseLane([], "a playful 3D portfolio")?.ids).toEqual(["playful", "3d"]);
    expect(showcaseLane(["minimal"], COFFEE)).toBeNull();
  });
});

describe("website lanes and query building", () => {
  it("a playful website brief searches the showcase galleries with the style's words", () => {
    for (const key of KEYS) {
      const lanes = laneTexts(COFFEE, "x", [], key, { platform: "website", styleWords: ["too fun"] });
      expect(lanes).toMatchObject({ showcase: "playful illustration", showcaseWord: "playful" });
      const galleries = lanes.galleries ?? [];
      // "landing page" in the brief also tags Lapa and landing.love; the showcase style goes first.
      expect([...galleries].sort()).toEqual(["awwwards", "craftwork"]);
      const reqs = planRequests(lanes);
      for (const r of reqs.filter((r) => r.site === "awwwards")) expect(r.query).toBe("playful illustration");
      for (const r of reqs.filter((r) => r.site === "craftwork")) expect(r.query).toBe("playful");
      // The other lanes keep the brief's topic.
      expect(reqs.find((r) => r.lane === "fidelity")?.query).toContain("coffee");
    }
  });

  it("the brief's own words count too (\"3D\" in the brief)", () => {
    const lanes = laneTexts("3D portfolio website for a motion designer", "x", [], "k", { platform: "website" });
    expect(lanes.showcase).toBe("3d landing page");
    expect(lanes.showcaseWord).toBe("3d");
  });

  it("a style without a one word never sends topic words to Craftwork through the showcase", () => {
    expect(showcaseWords("craftwork", { showcase: "experimental" })).toBeNull();
    expect(showcaseWords("awwwards", { showcase: "experimental" })).toBe("experimental");
    expect(showcaseWords("lapa", { showcase: "experimental", showcaseWord: "playful" })).toBeNull();
    expect(showcaseWords("awwwards", {})).toBeNull();
  });

  it("a website brief without a showcase style is unchanged: no showcase words, Craftwork never picked, topic words on galleries", () => {
    for (const key of KEYS) {
      for (const styleWords of [[], ["minimal"], ["dark mode"], ["editorial"], ["award"]]) {
        const lanes = laneTexts(COFFEE, "x", [], key, { platform: "website", styleWords });
        expect(lanes.showcase).toBeUndefined();
        expect(lanes.showcaseWord).toBeUndefined();
        expect(lanes.galleries ?? []).not.toContain("craftwork");
        for (const r of planRequests(lanes).filter((r) => r.lane === "gallery")) expect(r.query).toBe(galleryWords(r.site, lanes.topic ?? ""));
      }
    }
    // Craftwork is style-only: never a platform default.
    for (const key of KEYS) expect(pickGalleries({ platform: "website", key }).ui).not.toContain("craftwork");
  });
});

describe("mobile, tablet and web app briefs are unchanged", () => {
  const SHOW = ["playful", "too fun", "3d", "webgl", "motion", "kinetic type", "immersive scroll", "experimental", "interactive"];
  it("mobile and web app lanes are the same with or without showcase style words", () => {
    for (const key of KEYS) {
      for (const [brief, platform] of [
        ["meditation app onboarding", "mobile"],
        ["flight checkout for a GCC OTA", "mobile"],
        ["analytics dashboard for a fleet", "webapp"],
      ] as const) {
        const plain = laneTexts(brief, "x", [], key, { platform });
        const styled = laneTexts(brief, "x", [], key, { platform, styleWords: SHOW });
        expect(styled).toEqual(plain);
        expect(planRequests(styled)).toEqual(planRequests(plain));
      }
    }
  });

  it("a playful 3D mobile, tablet or web app brief gets no showcase words or showcase galleries", () => {
    for (const key of KEYS) {
      for (const platform of ["mobile", "tablet", "webapp"] as const) {
        const lanes = laneTexts("playful 3D kids learning app home", "x", [], key, { platform, styleWords: SHOW });
        expect(lanes.showcase).toBeUndefined();
        expect(lanes.showcaseWord).toBeUndefined();
        expect(lanes.galleries ?? []).not.toContain("craftwork");
        expect(lanes.galleries ?? []).not.toContain("awwwards");
        expect(pickGalleries({ platform, key, styleWords: SHOW }).ui).not.toContain("craftwork");
      }
    }
  });
});
