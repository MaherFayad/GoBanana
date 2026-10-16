/**
 * Web showcase styles (2026-10-16): playful, 3D, WebGL and motion-led website briefs search the
 * showcase galleries (Awwwards) with the style's own words. Mobile, tablet and web app
 * briefs are unchanged. Pure.
 */
import { describe, expect, it } from "vitest";
import { laneTexts } from "@/lib/bend/queries";
import { DEFAULT_IMAGE_HOSTS, NO_MODEL_IMAGE_HOSTS } from "@/lib/sources/allowlist";
import { galleryWords, planRequests, showcaseWords } from "@/lib/sources/plan";
import { SOURCE_REGISTRY, noModelInputHosts, sourceEntry } from "@/lib/sources/registry";
import { SHOWCASE_TAGS, showcaseLane, showcaseStyles } from "@/lib/sources/showcase";

const COFFEE = "coffee shop landing page";
const KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];

describe("registry", () => {
  it("Craftwork is not a source: removed from search, kept only as a picker reference", () => {
    expect(SOURCE_REGISTRY.some((s) => s.domain.includes("craftwork"))).toBe(false);
    expect(noModelInputHosts()).toContain("craftwork.design");
  });

  it("Awwwards carries every showcase tag and searches phrases; MotionSites is not a source", () => {
    const a = sourceEntry("awwwards");
    expect(a.showcase).toBe("phrase");
    for (const t of SHOWCASE_TAGS) expect(a.tags).toContain(t);
    expect(a.tags).toEqual(expect.arrayContaining(["award", "immersive"]));
    expect(SOURCE_REGISTRY.some((s) => s.domain.includes("motionsites"))).toBe(false);
  });
});

describe("allowlist", () => {
  it("no Craftwork or Best Designs on X host is an image host the canvas may load", () => {
    for (const h of NO_MODEL_IMAGE_HOSTS) expect(DEFAULT_IMAGE_HOSTS).not.toContain(h);
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

  it("the lane takes the first style's phrase", () => {
    expect(showcaseLane(["playful"])).toEqual({ phrase: "playful illustration", ids: ["playful"] });
    expect(showcaseLane(["kinetic typography", "3d"])).toEqual({ phrase: "kinetic typography", ids: ["kinetic typography", "3d"] });
    expect(showcaseLane(["experimental"])).toEqual({ phrase: "experimental", ids: ["experimental"] });
    expect(showcaseLane([], "a playful 3D portfolio")?.ids).toEqual(["playful", "3d"]);
    expect(showcaseLane(["minimal"], COFFEE)).toBeNull();
  });
});

describe("website lanes and query building", () => {
  it("a playful website brief searches the showcase galleries with the style's words", () => {
    for (const key of KEYS) {
      const lanes = laneTexts(COFFEE, "x", [], key, { platform: "website", styleWords: ["too fun"] });
      expect(lanes).toMatchObject({ showcase: "playful illustration" });
      const galleries = lanes.galleries ?? [];
      expect(galleries).toContain("awwwards");
      const reqs = planRequests(lanes);
      for (const r of reqs.filter((r) => r.site === "awwwards")) expect(r.query).toBe("playful illustration");
      // The other lanes keep the brief's topic.
      expect(reqs.find((r) => r.lane === "fidelity")?.query).toContain("coffee");
    }
  });

  it("the brief's own words count too (\"3D\" in the brief)", () => {
    const lanes = laneTexts("3D portfolio website for a motion designer", "x", [], "k", { platform: "website" });
    expect(lanes.showcase).toBe("3d landing page");
  });

  it("only showcase galleries take the style's phrase", () => {
    expect(showcaseWords("awwwards", { showcase: "experimental" })).toBe("experimental");
    expect(showcaseWords("lapa", { showcase: "experimental" })).toBeNull();
    expect(showcaseWords("awwwards", {})).toBeNull();
  });

  it("a website brief without a showcase style is unchanged: no showcase words, topic words on galleries", () => {
    for (const key of KEYS) {
      for (const styleWords of [[], ["minimal"], ["dark mode"], ["editorial"], ["award"]]) {
        const lanes = laneTexts(COFFEE, "x", [], key, { platform: "website", styleWords });
        expect(lanes.showcase).toBeUndefined();
        for (const r of planRequests(lanes).filter((r) => r.lane === "gallery")) expect(r.query).toBe(galleryWords(r.site, lanes.topic ?? ""));
      }
    }
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
        expect(lanes.galleries ?? []).not.toContain("awwwards");
      }
    }
  });
});
