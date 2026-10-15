/**
 * Field report (2026-10-12, GCC mobile flight checkout at wildness 4 with the Mobbin connector):
 * P5 mechanics and short titles, P6 the curated cultural lens library, P7 better search queries,
 * and the nudges that make agents use them. Pure; Serper is never called.
 */
import { describe, expect, it } from "vitest";
import {
  LENSES,
  LENS_IDS,
  MAX_TITLE_WORDS,
  MECHANIC_ELEMENTS,
  bendBrief,
  brokenMustKeep,
  componentQueries,
  fidelityQuery,
  formatDirections,
  parseBendInput,
  pickMechanic,
  protectedElements,
  suggestLenses,
} from "@/lib/bend";
import { extractSubject } from "@/lib/bend/subject";
import { SERVER_INSTRUCTIONS } from "@/lib/mcp/instructions";
import { dropLine } from "@/lib/mcp/tools/search_references";
import {
  DEFAULT_IMAGE_HOSTS,
  artDropReason,
  artRequests,
  isArtJunk,
  lensExcludeWords,
  lensNegatives,
  mapSerperImagesWithStats,
  parseAllowlist,
  sumWhy,
} from "@/lib/sources";
import { EMPTY_TAKEDOWNS } from "@/lib/takedown";

const BRIEF = "GCC mobile flight checkout";
const words = (s: string) => s.split(/\s+/).filter(Boolean);
const BRIEFS = ["flight checkout screen", "podcast player", "banking app onboarding", "food delivery cart", "government e-services portal", BRIEF];

describe("P5 mechanic", () => {
  it("gives every direction a mechanic: a known element and one plain line", () => {
    for (const brief of BRIEFS) {
      for (const wildness of [1, 3, 4, 5] as const) {
        for (const lens of [undefined, "sadu", "talli"]) {
          for (const d of bendBrief({ brief, wildness, count: 8, ...(lens ? { lens } : {}) }).directions) {
            expect(MECHANIC_ELEMENTS).toContain(d.mechanic.element);
            expect(d.mechanic.how.length, d.mechanic.how).toBeGreaterThan(10);
            expect(d.mechanic.how.length, d.mechanic.how).toBeLessThan(160);
            expect(d.mechanic.how).not.toMatch(/[—–\n]/);
          }
        }
      }
    }
  });

  it("maps woven and braided ideas to dividers and progress bars", () => {
    const entry = (label: string) => ({ label, query: label, key: label, leads: true, hints: { tone: [], weird: 1 as const, notOn: [], style: [] } });
    const pick = (label: string, lead: "lens" | "transplant" | "scale" = "lens") =>
      pickMechanic({ lead, entry: entry(label), others: [], protect: new Set(), used: new Map() });
    expect(pick("talli gold braid")).toEqual({ element: "progress", how: "Talli gold braid as the progress bar: one segment fills per step, step names stay readable" });
    expect(pick("Sadu geometric bands").element).toBe("divider");
    expect(pick("subway map", "transplant").element).toBe("section-nav");
    expect(pick("numerals", "scale")).toMatchObject({ element: "total", how: expect.stringMatching(/^Giant numerals frames the total/) });
    // Protected, the total goes to the next part; a bend spreads its ideas over several parts.
    expect(pickMechanic({ lead: "scale", entry: entry("numerals"), others: [], protect: new Set(["total"]), used: new Map() }).element).not.toBe("total");
    const ds = bendBrief({ brief: BRIEF, wildness: 4, lens: "talli", count: 8 }).directions;
    expect(new Set(ds.map((d) => d.mechanic.element)).size).toBeGreaterThan(1);
    expect(ds.some((d) => d.mechanic.element === "progress")).toBe(true);
  });

  it("never lands a mechanic on a protected total or main button", () => {
    for (const brief of ["flight checkout screen", "food delivery cart", BRIEF]) {
      for (const wildness of [3, 4, 5] as const) {
        for (const d of bendBrief({ brief, wildness, count: 8 }).directions) expect(["total", "cta"]).not.toContain(d.mechanic.element);
      }
    }
    // A brief that pays nothing may use them (a giant numerals total on a podcast stats card).
    const els = bendBrief({ brief: "podcast player stats", wildness: 5, count: 8, moves: ["scale"] }).directions.map((d) => d.mechanic.element);
    expect(els).toContain("total");
  });

  it("reads must-keeps from the agent and from transaction briefs", () => {
    expect([...protectedElements("flight checkout")].sort()).toEqual(["cta", "total"]);
    expect([...protectedElements("podcast player")]).toEqual([]);
    expect([...protectedElements("podcast player", ["step indicator", "clear fare summary"])].sort()).toEqual(["progress", "total"]);
    expect(brokenMustKeep({ mood: "calm", constraint: "no buttons, only tappable words" }, new Set(["cta"]))).toBe("cta");
    expect(brokenMustKeep({ mood: "calm", constraint: "no buttons, only tappable words" }, new Set(["total"]))).toBeNull();
  });

  it("drops a direction that breaks a must-keep, without moving any other id", () => {
    const free = bendBrief({ brief: "podcast player", wildness: 5, count: 8 }).directions;
    const kept = bendBrief({ brief: "podcast player", wildness: 5, count: 8, mustKeep: ["one primary button", "clear total"] }).directions;
    expect(kept.map((d) => d.id)).toEqual(free.map((d) => d.id).filter((id) => kept.some((k) => k.id === id)));
    for (const d of kept) expect(brokenMustKeep(d.ingredients, new Set(["cta", "total"]))).toBeNull();
    for (const d of kept) expect(["total", "cta"]).not.toContain(d.mechanic.element);
  });

  it("validates mustKeep input", () => {
    expect(parseBendInput({ brief: "x", wildness: 3, mustKeep: ["clear total"] })).toMatchObject({ ok: true, input: { mustKeep: ["clear total"] } });
    expect(parseBendInput({ brief: "x", wildness: 3, mustKeep: [] })).toMatchObject({ ok: false });
    const bad = parseBendInput({ brief: "x", wildness: 3, mustKeep: ["a", "b", "c", "d", "e", "f", "g"] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toMatch(/^mustKeep/);
  });

  it("tells the agent to build around the mechanic and search for that element", () => {
    const text = formatDirections(bendBrief({ brief: BRIEF, wildness: 4 }));
    expect(text).toMatch(/Mechanic: build this direction around (progress|total|cta|divider|section-nav|header|empty-state) = /);
    expect(text).toContain("Search for UI that has this element.");
    expect(text).not.toMatch(/[—–]/);
  });
});

describe("P5 titles", () => {
  it("are at most 4 words, name the idea and never the brief", () => {
    expect(MAX_TITLE_WORDS).toBe(4);
    for (const brief of BRIEFS) {
      const subject = extractSubject(brief, 3).title.toLowerCase();
      for (const wildness of [1, 2, 3, 4, 5] as const) {
        for (const lens of [undefined, "qatt-asiri"]) {
          const ds = bendBrief({ brief, wildness, count: 8, ...(lens ? { lens } : {}) }).directions;
          for (const d of ds) {
            expect(words(d.title).length, d.title).toBeLessThanOrEqual(MAX_TITLE_WORDS);
            expect(d.title, d.title).toMatch(/^[A-Z0-9]/);
            expect(d.title.toLowerCase(), d.title).not.toContain(subject);
            expect(d.title).not.toMatch(/\b(drawn from|through the eyes of|in the language of)\b/i);
          }
          expect(new Set(ds.map((d) => d.title.toLowerCase())).size).toBe(ds.length);
        }
      }
    }
  });
});

describe("P6 lens library", () => {
  it("adds talli and Al Qatt Al Asiri next to the GCC lenses", () => {
    for (const id of ["sadu", "najdi", "kufic", "mashrabiya", "talli", "qatt-asiri"]) expect(LENS_IDS).toContain(id);
    expect(parseBendInput({ brief: "x", wildness: 3, lens: "talli" }).ok).toBe(true);
    expect(parseBendInput({ brief: "x", wildness: 3, lens: "qatt-asiri" }).ok).toBe(true);
  });

  it("gives every lens phrasings, exclusions that never hit its own terms, and a Google Fonts Arabic face", () => {
    for (const lens of LENSES) {
      expect(lens.terms.length, lens.id).toBeGreaterThanOrEqual(8);
      expect(lens.exclude.length, lens.id).toBeGreaterThan(0);
      expect(lens.arabicFont.url).toBe(`https://fonts.google.com/specimen/${lens.arabicFont.family.replace(/ /g, "+")}`);
      expect(lens.name.ar).toMatch(/\p{Script=Arabic}/u);
      for (const t of lens.terms) {
        expect(lensExcludeWords(t), `${lens.id}: ${t}`).toEqual(expect.arrayContaining(lens.exclude));
        for (const x of lens.exclude) expect(t.toLowerCase(), `${lens.id}: ${t} vs ${x}`).not.toMatch(new RegExp(`\\b${x}\\b`));
      }
      // The talli lens never searches the phrasing that returned Egyptian tulle-bi-telli.
      if (lens.id === "talli") expect(lens.terms.map((t) => t.toLowerCase())).not.toContain("talli embroidery");
    }
  });

  it("drops off-tradition results in the art gate and adds negatives to the art query", () => {
    expect(lensExcludeWords("talli embroidery")).toEqual(expect.arrayContaining(["tulle", "assiut", "egyptian"]));
    expect(lensExcludeWords("crushed velvet texture")).toEqual([]);
    expect(lensNegatives("Emirati talli braiding")).toContain("-tulle");
    expect(artDropReason("Assiut tulle bi telli shawl", "talli embroidery")).toBe("lens");
    expect(artDropReason("Egyptian tulle-bi-telli", "Emirati talli")).toBe("lens");
    expect(artDropReason("Emirati talli braid on a kandura sleeve", "Emirati talli")).toBeNull();
    expect(artDropReason("Sadu weaving in Sibiu, Romania", "Sadu weaving")).toBe("lens");
    expect(isArtJunk("Assiut tulle bi telli shawl", "talli embroidery")).toBe(false); // the lens rule is its own reason
    const [pin] = artRequests(["talli gold braid"]);
    expect(pin!.query).toMatch(/^talli gold braid -tulle -assiut -asyut -egyptian -egypt -telli -etsy/);
    expect(artRequests(["crushed velvet"])[0]!.query).toBe("crushed velvet -etsy -amazon -aliexpress -sale -buy");
  });

  it("counts lens drops in both zones", () => {
    const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);
    const images = [
      { title: "Egyptian tulle bi telli pattern", link: "https://www.behance.net/gallery/190000001/a", imageUrl: "https://mir-s3-cdn-cf.behance.net/a.jpg", imageWidth: 1400, imageHeight: 1000 },
      { title: "Emirati talli braid pattern", link: "https://www.behance.net/gallery/190000002/b", imageUrl: "https://mir-s3-cdn-cf.behance.net/b.jpg", imageWidth: 1400, imageHeight: 1000 },
    ];
    const art = mapSerperImagesWithStats(images, { sources: ["behance"], allowlist, takedowns: EMPTY_TAKEDOWNS, count: 10, gate: "art", artQuery: "talli braid" });
    expect(art.references.map((r) => r.title)).toEqual(["Emirati talli braid pattern"]);
    expect(art.why).toEqual({ lens: 1 });
    const uiImages = images.map((i) => ({ ...i, title: `${i.title} app ui` }));
    const ui = mapSerperImagesWithStats(uiImages, { sources: ["behance"], allowlist, takedowns: EMPTY_TAKEDOWNS, count: 10, lensQuery: "talli braid ui design" });
    expect(ui.references).toHaveLength(1);
    expect(ui.why).toEqual({ lens: 1 });
    expect(sumWhy([{ lens: 1 }, undefined, { offTopic: 2 }])).toEqual({ lens: 1, offTopic: 2 });
    expect(sumWhy([undefined])).toBeUndefined();
    const junk = mapSerperImagesWithStats(
      [{ title: "Talli braid bracelet for sale $12", link: "https://www.behance.net/gallery/190000003/c", imageUrl: "https://mir-s3-cdn-cf.behance.net/c.jpg", imageWidth: 1400, imageHeight: 1000 }],
      { sources: ["behance"], allowlist, takedowns: EMPTY_TAKEDOWNS, count: 10, gate: "art", artQuery: "talli braid" },
    );
    expect(junk.why).toEqual({ junk: 1 });
  });

  it("suggests a matching lens for Gulf and Arabic briefs with none set", () => {
    expect(suggestLenses(BRIEF)).toEqual(["sadu", "talli", "qatt-asiri"]);
    expect(suggestLenses("Dubai hotel booking app")[0]).toBe("talli");
    expect(suggestLenses("Abha tourism app")[0]).toBe("qatt-asiri");
    expect(suggestLenses("podcast player")).toEqual([]);
    const r = bendBrief({ brief: BRIEF, wildness: 4 });
    expect(r.suggestedLenses).toEqual(["sadu", "talli", "qatt-asiri"]);
    expect(formatDirections(r)).toContain('Try bend_brief again with lens "sadu", "talli", "qatt-asiri"');
    const withLens = bendBrief({ brief: BRIEF, wildness: 4, lens: "qatt-asiri" });
    expect(withLens.suggestedLenses).toEqual([]);
    expect(withLens.lens?.arabicFont.family).toBe("Rakkas");
    expect(formatDirections(withLens)).toContain("Arabic display font: Rakkas (https://fonts.google.com/specimen/Rakkas)");
  });
});

describe("P7 search queries", () => {
  it("interface lanes search page plus component, not the bare domain", () => {
    expect(fidelityQuery(BRIEF)).toBe("flight checkout app ui");
    expect(componentQueries(BRIEF, "mobile", ["fare summary", "payment bottom sheet"])).toEqual([
      "flight checkout fare summary app ui",
      "flight checkout payment bottom sheet app ui",
    ]);
    const d = bendBrief({ brief: BRIEF, wildness: 4, pages: ["fare summary"] }).directions[0]!;
    expect(d.searchQueries).toContain("flight checkout fare summary app ui");
    expect(d.searchQueries).not.toContain("flight app ui");
  });

  it("art lanes phrase a visual and drop music and merch titles", () => {
    for (const d of bendBrief({ brief: BRIEF, wildness: 5, count: 8, moves: ["scale"] }).directions) {
      // P0-16: the concrete element, one word plus "graphic" or two and more bare; never stacked.
      expect(d.artQueries[0]).not.toMatch(/oversized|close-up|graphic print/);
      expect(d.artQueries[0]).toMatch(/^\S+ graphic$|^\S+ \S+/);
    }
    const q = "stripes graphic";
    for (const t of ["The White Stripes band poster", "White Stripes 2007 world tour", "Stripes merch drop", "Concert stripes poster"]) {
      expect(artDropReason(t, q), t).not.toBeNull();
    }
    expect(artDropReason("Bold stripes screen print", q)).toBeNull();
    // A query about music keeps music titles; a textile query keeps its own bands.
    expect(artDropReason("Jazz band gig poster", "gig poster")).toBeNull();
    expect(artDropReason("Sadu geometric bands", "Sadu geometric bands")).toBeNull();
  });

  it("says in one line how many results the lens and junk filters dropped", () => {
    expect(dropLine(undefined)).toBe("");
    const line = dropLine({ lens: 3, offTopic: 2 });
    expect(line).toMatch(/^Dropped 3 from a look-alike tradition .* and 2 art results about music, bands, tours or merch\./);
    expect(dropLine({ lens: 1, offTopic: 1, junk: 4 })).toMatch(/talli\), 1 art results about music, bands, tours or merch and 4 art results that were shop, stock or product listings\./);
    expect(line).not.toMatch(/[—–\n]/);
  });
});

describe("server instructions", () => {
  it("ask for taste first and point at mechanics and lenses, within the cap", () => {
    expect(SERVER_INSTRUCTIONS).toContain("Taste first: ask the user for 3 to 5 style words or a reference board before bend_brief; never invent them.");
    expect(SERVER_INSTRUCTIONS).toMatch(/mechanic/);
    expect(SERVER_INSTRUCTIONS).toMatch(/talli/);
    expect(SERVER_INSTRUCTIONS.length).toBeLessThan(2500);
  });
});
