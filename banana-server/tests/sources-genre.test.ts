import { describe, expect, it } from "vitest";
import { laneTexts } from "@/lib/bend/queries";
import { planLane } from "@/lib/learning/arms";
import { DEFAULT_IMAGE_HOSTS, parseAllowlist } from "@/lib/sources/allowlist";
import { GENRE_NEG, GENRE_PROFILES, detectGenre, genreRequests, genreSubject, isGenreTitle, laneGenre } from "@/lib/sources/genre";
import { genreQueryPlan, hasUiLanes, laneValue, plainGenre, plainQueryPlan, planRequests } from "@/lib/sources/plan";
import { SOURCE_REGISTRY, pickGalleries, registryItemPath, sourceEntry } from "@/lib/sources/registry";
import { LANE_NAMES } from "@/lib/sources/types";
import { createWebSearchAdapter, mapSerperImagesWithStats } from "@/lib/sources/web-search";
import { EMPTY_TAKEDOWNS } from "@/lib/takedown";

const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);

describe("genre detection", () => {
  it("finds a deck or a brand in the brief's words", () => {
    expect(detectGenre("pitch deck for a saudi fintech startup")).toBe("presentation");
    expect(detectGenre("keynote slides for a design conference")).toBe("presentation");
    expect(detectGenre("annual report layout for a museum")).toBe("presentation");
    expect(detectGenre("brand identity for a coffee roaster")).toBe("branding");
    expect(detectGenre("logo system for a sports club")).toBe("branding");
    expect(detectGenre("packaging for an olive oil brand")).toBe("branding");
    expect(detectGenre("jazz festival poster")).toBe("branding");
    expect(detectGenre("meditation timer")).toBeNull();
    expect(detectGenre("")).toBeNull();
  });

  it("presentation words win over brand words", () => {
    expect(detectGenre("brand guidelines deck")).toBe("presentation");
  });

  it("keeps the subject, not the genre words", () => {
    expect(genreSubject("pitch deck for a saudi fintech startup")).toBe("saudi fintech");
    expect(genreSubject("brand identity for a coffee roaster")).toBe("coffee roaster");
    expect(genreSubject("investor update with big numbers")).toBe("");
  });

  it("lists the style keywords per genre", () => {
    expect(GENRE_PROFILES.presentation.keywords).toEqual(["pitch deck", "keynote", "slide layout", "data slide", "editorial deck", "dark deck", "big number slide"]);
    expect(GENRE_PROFILES.branding.keywords).toEqual(["brand identity", "logo system", "brand guidelines", "visual identity", "poster", "packaging", "typographic"]);
  });
});

describe("a deck or brand brief pulls its genre lane", () => {
  it("a pitch deck brief plans the deck lane, dark by default, Dribbble first then the Pitch gallery", () => {
    const lanes = laneTexts("pitch deck for a saudi fintech startup", "sadu weaving", [], "d1");
    expect(lanes.genre).toBe("presentation");
    expect(lanes.fidelity).toBeUndefined();
    expect(hasUiLanes(lanes)).toBe(true);
    const plan = planRequests(lanes);
    expect(plan.every((r) => r.lane === "deck")).toBe(true);
    expect(plan[0]).toEqual({ lane: "deck", site: "dribbble", query: `dark saudi fintech pitch deck presentation design ${GENRE_NEG}` });
    expect(plan[1]).toEqual({ lane: "deck", site: "pitch", query: "saudi fintech pitch deck" });
  });

  it("the user's taste word replaces the default style", () => {
    const lanes = laneTexts("pitch deck for a bakery", "x", ["brutalist"], "d1");
    expect(planRequests(lanes)[0]!.query).toMatch(/^brutalist bakery pitch deck/);
  });

  it("names the measured wordings for numbers and reports", () => {
    const big = genreRequests("investor update with big numbers", "presentation");
    expect(big[0]).toEqual({ lane: "deck", site: "pinterest", query: `big number data slide presentation design ${GENRE_NEG}` });
    const report = genreRequests("annual report for a museum", "presentation");
    expect(report[0]!.site).toBe("behance");
    expect(report[0]!.query).toContain("editorial annual report presentation layout");
  });

  it("a brand brief leads with the curated galleries", () => {
    expect(planRequests(laneTexts("brand identity for a coffee roaster", "x", [], "d1"))[0]).toEqual({ lane: "brand", site: "brandidentity", query: "coffee roaster identity" });
    expect(planRequests(laneTexts("logo system for a sports club", "x", [], "d1"))[0]).toEqual({ lane: "brand", site: "brandnew", query: "sports club logo" });
    expect(planRequests(laneTexts("packaging for an olive oil brand", "x", [], "d1"))[0]!.site).toBe("bpando");
    expect(planRequests(laneTexts("jazz festival poster", "x", [], "d1"))[0]!.site).toBe("typoposters");
  });

  it("an art lane still rides along in a both-zones search", () => {
    const lanes = { ...laneTexts("brand identity for a coffee roaster", "x", [], "d1"), art: ["sadu weaving"] };
    const plan = planRequests(lanes, undefined, { zone: "both" });
    expect(plan.some((r) => r.lane === "art")).toBe(true);
    expect(plan.some((r) => r.lane === "brand")).toBe(true);
  });

  it("never applies to a brief with a device or web surface: those stay UI briefs", () => {
    for (const brief of ["logo screen for a coffee app", "pitch deck builder web app", "poster shop landing page", "brand page on iPhone"]) {
      const lanes = laneTexts(brief, "x", [], "d1");
      expect(lanes.genre).toBeUndefined();
      expect(planRequests(lanes).some((r) => r.lane === "deck" || r.lane === "brand")).toBe(false);
    }
  });

  it("a caller can name the genre for any brief", () => {
    expect(laneTexts("coffee roaster", "x", [], "d1", { genre: "branding" }).genre).toBe("branding");
  });

  it("genre lanes have no learned arms yet, and a lane re-search plans the genre wordings", () => {
    const lanes = laneTexts("pitch deck for a bakery", "x", [], "d1");
    expect(laneValue(lanes, "deck")).toBeUndefined();
    expect(LANE_NAMES).toContain("deck");
    expect(laneGenre("brand")).toBe("branding");
    expect(laneGenre("taste")).toBeNull();
    const plan = planLane("deck", "keynote slides", undefined, "x", lanes);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.every((r) => r.lane === "deck")).toBe(true);
  });
});

describe("plain queries", () => {
  it("a query naming a genre and no UI gets the genre plan", () => {
    expect(plainGenre("pitch deck for a fintech")).toBe("presentation");
    expect(plainGenre("pitch deck app ui")).toBeNull();
    expect(plainGenre("teletext 1980s")).toBeNull();
    expect(plainGenre("teletext", "branding")).toBe("branding");
    const plan = genreQueryPlan("brand identity coffee", "branding");
    expect(plan[0]).toEqual({ query: "coffee identity", site: "brandidentity" });
    expect(plan.length).toBeLessThanOrEqual(4);
  });

  it("picked sources move the genre requests", () => {
    const plan = genreQueryPlan("pitch deck", "presentation", ["behance"]);
    expect(plan.every((r) => r.site === "behance")).toBe(true);
  });

  it("UI queries keep their plain plan", () => {
    expect(plainQueryPlan("fintech app ui", [])).toEqual([
      { query: "fintech app ui", site: "pinterest" },
      { query: "fintech app ui", site: "dribbble" },
    ]);
  });
});

describe("registry: genre galleries", () => {
  it("Pitch and Brand New are registered with measured hosts and item pages", () => {
    const pitch = sourceEntry("pitch");
    expect(pitch.imageHosts).toEqual(["imgproxy.services.pitch.com", "pitch-static-assets.imgix.net"]);
    expect(registryItemPath("pitch", "pitch.com", "/templates/Investor-Pitch-Deck-52NJt62Vk3cZ5g7Hgb3XGSPG")).toBe(true);
    expect(registryItemPath("pitch", "pitch.com", "/templates/collections/Pitch-deck")).toBe(false);
    expect(registryItemPath("brandnew", "www.underconsideration.com", "/brandnew/archives/new_identity_for_sonos_by_bruce_mau_design.php")).toBe(true);
    expect(registryItemPath("brandnew", "www.underconsideration.com", "/brandnew/archives/tag/kit")).toBe(false);
    for (const h of ["imgproxy.services.pitch.com", "pitch-static-assets.imgix.net", "www.underconsideration.com"]) expect(DEFAULT_IMAGE_HOSTS).toContain(h);
  });

  it("genre galleries are never picked for a UI brief", () => {
    const genreOnly = SOURCE_REGISTRY.filter((s) => "genres" in s && s.platforms.length === 0 && s.tags.length === 0).map((s) => s.id);
    expect(genreOnly).toEqual(["pitch", "brandnew"]);
    for (const platform of ["mobile", "tablet", "website", "webapp", "any"] as const) {
      const p = pickGalleries({ platform, styleWords: ["pitch deck", "brand identity", "logo"], key: "k", artText: ["logo", "pitch deck"] });
      expect([...p.ui, ...p.art, ...p.baseline]).not.toContain("pitch");
      expect([...p.ui, ...p.art, ...p.baseline]).not.toContain("brandnew");
    }
  });
});

describe("genre gate", () => {
  const img = (link: string, title: string, imageUrl: string) => ({ link, title, imageUrl, imageWidth: 1600, imageHeight: 1000 });

  it("core site titles must name the genre; the UI gate is not used", () => {
    const images = [
      img("https://dribbble.com/shots/1-Pitch-Deck", "Pitch Deck Presentation Design", "https://cdn.dribbble.com/a.png"),
      img("https://dribbble.com/shots/2-Bank-App", "Banking App UI", "https://cdn.dribbble.com/b.png"),
      img("https://dribbble.com/shots/3-Deck-Template", "Pitch Deck Template", "https://cdn.dribbble.com/c.png"),
    ];
    const out = mapSerperImagesWithStats(images, { sources: ["dribbble"], allowlist, takedowns: EMPTY_TAKEDOWNS, count: 10, gate: "genre", genre: "presentation" });
    expect(out.references.map((r) => r.title)).toEqual(["Pitch Deck Presentation Design"]);
    expect(out.dropped).toBe(2);
    expect(isGenreTitle("New Logo and Identity for Kiss", "branding")).toBe(true);
    expect(isGenreTitle("Banking App UI", "branding")).toBe(false);
  });

  it("Pitch template pages pass the kit filter; Brand New http images come back over https", () => {
    const pitch = mapSerperImagesWithStats(
      [img("https://pitch.com/templates/Investor-Pitch-Deck-52NJt62Vk3cZ5g7Hgb3XGSPG", "Free Investor Pitch Deck Template | Pitch", "https://imgproxy.services.pitch.com/_/plain/x.jpg")],
      { sources: ["pitch"], allowlist, takedowns: EMPTY_TAKEDOWNS, count: 10, gate: "genre", genre: "presentation" },
    );
    expect(pitch.references).toHaveLength(1);
    const bn = mapSerperImagesWithStats(
      [img("https://www.underconsideration.com/brandnew/archives/new_identity_for_sonos_by_bruce_mau_design.php", "Brand New: New Identity for Sonos", "http://www.underconsideration.com/brandnew/archives/sonos_logo.png")],
      { sources: ["brandnew"], allowlist, takedowns: EMPTY_TAKEDOWNS, count: 10, gate: "genre", genre: "branding" },
    );
    expect(bn.references[0]!.imageUrl).toBe("https://www.underconsideration.com/brandnew/archives/sonos_logo.png");
  });

  it("runPlan gates deck lane results by the genre and puts them in the UI zone", async () => {
    const fetch = async (_url: string, init?: RequestInit) => {
      const q = JSON.parse(String(init?.body)).q as string;
      const images = q.includes("site:dribbble.com")
        ? [img("https://dribbble.com/shots/9-Dark-Deck", "Dark Pitch Deck Slides", "https://cdn.dribbble.com/d.png"), img("https://dribbble.com/shots/8-App", "Fitness App UI", "https://cdn.dribbble.com/e.png")]
        : [];
      return new Response(JSON.stringify({ images }), { status: 200 });
    };
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch, allowlist });
    const plan = planRequests(laneTexts("pitch deck for a bakery", "x", [], "d1"));
    const result = await adapter.runPlan(plan, { count: 8, userId: "u1" });
    expect(result.references.map((r) => [r.title, r.lane, r.zone])).toEqual([["Dark Pitch Deck Slides", "deck", "ui"]]);
  });

  it("a plain genre query is gated by the genre and never retried in UI forms", async () => {
    const sent: string[] = [];
    const fetch = async (_url: string, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)).q as string);
      return new Response(JSON.stringify({ images: [] }), { status: 200 });
    };
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch, allowlist });
    await adapter.run({ query: "brand identity for a coffee roaster", count: 8, userId: "u1" });
    expect(sent[0]).toBe("coffee roaster identity site:the-brandidentity.com/project");
    expect(sent.some((q) => / ui design| app ui/.test(q))).toBe(false);
  });
});
