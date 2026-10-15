import { describe, expect, it } from "vitest";
import {
  bendBrief,
  bridgeQuery,
  componentQueries,
  fidelityCoreQuery,
  fidelityQuery,
  heroQuery,
  inspirationFromQuery,
  inspirationQuery,
  isArabicBrief,
  isUiBrief,
  laneTexts,
  LENSES,
  LISTS,
  MAX_FOCUSED_QUERY_WORDS,
  MAX_LANE_WORDS,
  localeQuery,
  MOVES,
  pickStyle,
  tasteQuery,
  tasteVariants,
  type Wildness,
} from "@/lib/bend";
import { briefComponents, componentAppText, ELEMENT_NOUN, ideaMechanicQuery, mechanicQuery, queryKey } from "@/lib/bend/queries";
import { mulberry32 } from "@/lib/bend/prng";
import { lensEntries } from "@/lib/bend/lists";
import type { LaneTexts } from "@/lib/sources";
import { MOVE_DEFS } from "@/lib/bend/moves";
import { cleanTaste, DEFAULT_TASTE } from "@/lib/taste";

const words = (s: string) => s.split(/\s+/).filter(Boolean);
const CANVAS_BRIEF = "Flight checkout screen for a GCC travel OTA (mobile, bilingual Arabic/English)";
/** The searched lanes of a direction, in bend_brief's searchQueries order (the idea is never searched). */
const uiLaneWords = (l: LaneTexts) =>
  [l.fidelity, l.taste, ...(l.component ?? []), l.hero, l.bridge, l.locale].filter((q): q is string => Boolean(q));

describe("inspiration lane", () => {
  it("is the raw ingredient, at most 5 words, never with UI words", () => {
    expect(inspirationQuery("lens", "Sadu weaving")).toBe("Sadu weaving");
    expect(inspirationQuery("material", "crushed velvet")).toBe("crushed velvet");
    expect(inspirationQuery("transplant", "garment care label")).toBe("garment care label");
    expect(inspirationQuery("scale", "film frames")).toBe("oversized film frames");
    for (const move of MOVES) {
      for (const e of LISTS[MOVE_DEFS[move].list]) {
        const q = inspirationQuery(move, e.query);
        expect(words(q).length, q).toBeLessThanOrEqual(MAX_LANE_WORDS);
        expect(q).not.toMatch(/\b(app|ui)\b/i);
      }
    }
  });

  it("pulls the lead ingredient out of the stacked queries stored by older directions", () => {
    // The real stored queries from the first live board.
    expect(inspirationFromQuery("crushed velvet texture ui design garment care label packaging")).toBe("crushed velvet");
    expect(inspirationFromQuery("Art Nouveau 1900 graphic design Sadu red stripes pattern")).toBe("Art Nouveau 1900");
    expect(inspirationFromQuery("oversized film frames poster gold leaf texture")).toBe("oversized film frames");
    expect(inspirationFromQuery("eerie vintage car dashboard packaging design")).toBe("vintage car dashboard");
    expect(inspirationFromQuery("  melted   chrome type ")).toBe("melted chrome type");
  });

  it("is stable: an inspiration query maps back to itself, for every list entry and lens term", () => {
    for (const move of MOVES) {
      for (const e of LISTS[MOVE_DEFS[move].list]) {
        const q = inspirationQuery(move, e.query);
        expect(inspirationFromQuery(q), q).toBe(q);
      }
    }
    for (const lens of LENSES) {
      for (const e of lensEntries(lens)) {
        const q = inspirationQuery("lens", e.query);
        expect(inspirationFromQuery(q), q).toBe(q);
      }
    }
  });
});

describe("brief lanes", () => {
  it("detects UI and Arabic briefs", () => {
    expect(isUiBrief(CANVAS_BRIEF)).toBe(true);
    expect(isUiBrief("fitness tracker dashboard")).toBe(true);
    expect(isUiBrief("poster for a jazz festival")).toBe(false);
    expect(isArabicBrief(CANVAS_BRIEF)).toBe(true);
    expect(isArabicBrief("RTL banking app")).toBe(true);
    expect(isArabicBrief("تطبيق بنكي")).toBe(true);
    expect(isArabicBrief("banking app")).toBe(false);
  });

  it("fidelity: {domain} {page} {surface}, with a core-noun fallback for compound domains", () => {
    // The page the brief names keeps results on that screen: "flight app ui" pulled tracking,
    // search and seat screens for a checkout (field report, 2026-10-12).
    expect(fidelityQuery(CANVAS_BRIEF)).toBe("flight checkout app ui");
    expect(fidelityQuery("GCC mobile flight checkout")).toBe("flight checkout app ui");
    expect(fidelityQuery("saudi fintech app")).toBe("saudi fintech app ui");
    expect(fidelityCoreQuery("saudi fintech app")).toBe("fintech app ui");
    expect(fidelityQuery("luxury hotel website")).toBe("luxury hotel website ui");
    expect(fidelityQuery("logistics dashboard")).toBe("logistics dashboard ui");
    expect(fidelityQuery("Dashboard for a fleet management company")).toBe("fleet management dashboard ui");
    expect(fidelityCoreQuery("Dashboard for a fleet management company")).toBe("fleet dashboard ui");
    expect(fidelityQuery("banking app onboarding")).toBe("banking onboarding app ui");
    // A part is not a page: "data table" never joins the fidelity lane.
    expect(fidelityQuery("Logistics fleet management dashboard with fleet map, data table")).toBe("fleet management dashboard ui");
    expect(fidelityCoreQuery("banking app onboarding")).toBeNull();
    // A brief that names no UI is still searched in UI forms.
    expect(fidelityQuery("poster for a jazz festival")).toBe("jazz festival poster app ui");
  });

  it("taste: {style} {domain} {component} ui design; the default component follows the surface", () => {
    expect(tasteQuery(CANVAS_BRIEF, "big typography")).toBe("big typography flight checkout ui design");
    expect(tasteQuery(CANVAS_BRIEF, "minimal")).toBe("minimal flight checkout ui design");
    expect(tasteQuery("banking app onboarding", "dark mode")).toBe("dark mode banking onboarding ui design");
    expect(tasteQuery("saudi fintech app", "glassmorphism")).toBe("glassmorphism saudi fintech card ui design");
    expect(tasteQuery("luxury hotel website", "editorial")).toBe("editorial luxury hotel hero section ui design");
    expect(tasteQuery("pricing page for a saas tool", "swiss style")).toBe("swiss style saas pricing page ui design");
    expect(tasteQuery("logistics dashboard", "dark with one accent")).toBe("dark accent logistics dashboard ui design");
    expect(tasteQuery("poster for a jazz festival", "grainy")).toBe("grainy jazz festival poster ui design");
    // Too long: the domain drops to its core noun, then style words go; "ui design" stays.
    expect(tasteQuery("Dashboard for a fleet management company", "very soft studio 3d light")).toBe(
      "soft studio 3d fleet dashboard ui design",
    );
  });

  it("taste variants for the search learner: app wording and the core domain noun", () => {
    expect(tasteVariants(CANVAS_BRIEF, "big typography")).toEqual({ app: "big typography flight app checkout ui" });
    expect(tasteVariants("saudi fintech app", "glassmorphism")).toEqual({
      app: "glassmorphism saudi fintech app card ui",
      core: "glassmorphism fintech card ui design",
    });
    expect(tasteVariants("luxury hotel website", "editorial")).toEqual({ core: "editorial hotel hero section ui design" });
    expect(tasteVariants("logistics dashboard", "minimal")).toEqual({});
    expect(tasteVariants("poster for a jazz festival", "grainy")).toEqual({});
  });

  it("bridges the idea to UI for UI briefs whose idea has a head word", () => {
    expect(bridgeQuery(CANVAS_BRIEF, "vending machine")).toBe("vending machine ui design");
    expect(bridgeQuery("flight checkout screen", "Sadu weaving")).toBe("Sadu weaving ui design");
    expect(bridgeQuery("poster for a jazz festival", "vending machine")).toBeNull();
    expect(bridgeQuery(CANVAS_BRIEF, "3d ui")).toBeNull();
    expect(laneTexts("poster for a jazz festival", "vending machine", DEFAULT_TASTE, "bd-1").bridge).toBeUndefined();
  });

  it("hero for app briefs only, locale for Arabic briefs only", () => {
    expect(heroQuery(CANVAS_BRIEF, "dark mode")).toBe("dark mode flight app single screen");
    expect(heroQuery("saudi fintech app", "luxury")).toBe("luxury fintech app single screen");
    expect(heroQuery("luxury hotel website", "minimal")).toBeNull();
    expect(heroQuery("logistics dashboard", "minimal")).toBeNull();
    expect(localeQuery(CANVAS_BRIEF)).toBe("arabic flight app ui");
    expect(localeQuery("arabic admin dashboard")).toBe("arabic admin dashboard ui");
    expect(localeQuery("banking app")).toBeNull();
    // No subject, no lane: a bare "arabic app ui" returns Quran and calligraphy apps.
    expect(localeQuery("arabic app")).toBeNull();
  });

  it("builds every lane for a direction, two styles per direction, only the idea without a brief", () => {
    const lanes = laneTexts(CANVAS_BRIEF, "crushed velvet", DEFAULT_TASTE, "bd-8dti7s7c");
    expect(lanes).toMatchObject({
      idea: "crushed velvet",
      taste: `${pickStyle(DEFAULT_TASTE, "bd-8dti7s7c")} flight checkout ui design`,
      fidelity: "flight checkout app ui",
      component: ["flight checkout fare summary app ui", "flight checkout payment bottom sheet app ui"],
      bridge: "crushed velvet ui design",
      hero: `${pickStyle(DEFAULT_TASTE, "bd-8dti7s7c", 1)} flight app single screen`,
      locale: "arabic flight app ui",
      localeWord: "flight",
      // The brief says mobile: UI lanes drop web titles, and mobile galleries join.
      platform: "mobile",
      topic: "flight",
    });
    expect(lanes.avoid).toEqual(expect.arrayContaining(["web", "website", "dashboard", "landing", "desktop", "saas"]));
    expect(lanes.galleries?.length).toBeGreaterThan(0);
    expect(laneTexts(null, "crushed velvet", DEFAULT_TASTE, "bd-1")).toEqual({ idea: "crushed velvet" });
    for (const brief of [CANVAS_BRIEF, "saudi fintech app", "Dashboard for a fleet management company", "pricing page for a saas tool"]) {
      const lanes = laneTexts(brief, "x", ["dark with one accent", "very soft studio 3d light"], "bd-2");
      for (const q of [lanes.taste, lanes.fidelity, lanes.fidelityCore, lanes.hero, lanes.locale, lanes.bridge, ...(lanes.component ?? [])].filter(Boolean)) {
        expect(words(q!).length, q).toBeLessThanOrEqual(MAX_FOCUSED_QUERY_WORDS);
      }
    }
  });

  it("reads the components a brief names: its list first, then known components", () => {
    expect(briefComponents("Retail banking mobile app homepage: balance, quick actions, recent transactions, into bold, unexpected territory.")).toEqual([
      "balance",
      "quick actions",
      "recent transactions",
    ]);
    expect(briefComponents("Flight booking app with seat selection and boarding pass")).toEqual(["seat selection", "boarding pass", "booking"]);
    expect(briefComponents("Real estate website: property listings, search filters")).toEqual(["property listing", "search filters"]);
    expect(briefComponents("Meditation app onboarding")).toEqual(["onboarding"]);
    // An item that is not a component ends the list.
    expect(briefComponents("Fintech app: loyalty points, into something bold and new")).toEqual(["loyalty points"]);
    expect(briefComponents("Flight checkout screen for a GCC travel OTA")).toEqual(["checkout"]);
  });

  it("component lanes: {core} {page} {component} {surface}, at most 2, never just the surface", () => {
    expect(componentQueries("Retail banking mobile app homepage: balance, quick actions, recent transactions")).toEqual([
      "banking balance app ui",
      "banking quick actions app ui",
    ]);
    expect(componentQueries("Flight booking app with seat selection and boarding pass")).toEqual([
      "flight booking seat selection app ui",
      "flight booking boarding pass app ui",
    ]);
    expect(componentQueries("Crypto wallet app: portfolio, swap, price chart")).toEqual(["crypto wallet portfolio app ui", "crypto wallet swap app ui"]);
    expect(componentQueries("Logistics fleet management dashboard with fleet map, data table")).toEqual(["fleet map dashboard ui", "fleet data table dashboard ui"]);
    expect(componentQueries("Food delivery app order tracking screen")).toEqual(["order tracking app ui"]);
    // Pages given to bend_brief lead, with the brief's page: the part on the right screen.
    expect(componentQueries("GCC mobile flight checkout", "mobile", ["fare summary", "payment bottom sheet"])).toEqual([
      "flight checkout fare summary app ui",
      "flight checkout payment bottom sheet app ui",
    ]);
    // Only the page named: its standard parts, a fare summary for travel.
    expect(componentQueries("GCC mobile flight checkout")).toEqual(["flight checkout fare summary app ui", "flight checkout payment bottom sheet app ui"]);
    expect(componentQueries("food delivery cart")).toEqual(["delivery cart order summary app ui", "delivery cart promo code app ui"]);
    expect(componentQueries("logistics dashboard")).toEqual([]);
    expect(componentQueries("poster for a jazz festival")).toEqual([]);
    expect(componentAppText("banking quick actions ui")).toBe("banking quick actions app ui");
    expect(componentAppText("flight app ui")).toBe("flight app ui");
    expect(componentAppText("fleet map dashboard ui")).toBe("fleet map dashboard ui");
  });

  it("picks styles by direction id, deterministically", () => {
    expect(pickStyle(DEFAULT_TASTE, "bd-8dti7s7c")).toBe(pickStyle([...DEFAULT_TASTE], "bd-8dti7s7c"));
    expect(DEFAULT_TASTE).toContain(pickStyle(DEFAULT_TASTE, "bd-x"));
    expect(pickStyle(DEFAULT_TASTE, "bd-x", 1)).not.toBe(pickStyle(DEFAULT_TASTE, "bd-x"));
    expect(pickStyle([], "bd-x")).toBe(pickStyle(DEFAULT_TASTE, "bd-x"));
    expect(pickStyle(["only"], "bd-x", 3)).toBe("only");
    expect(DEFAULT_TASTE).toEqual(["minimal", "glassmorphism", "big typography", "dark mode"]);
  });

  it("cleans taste words", () => {
    expect(cleanTaste(["Dark Mode!", "dark mode", "", 4, "dark, with one accent and more words"])).toEqual([
      "dark mode",
      "dark with one accent",
    ]);
    expect(cleanTaste(["a", "b", "c", "d", "e", "f"])).toHaveLength(5);
    expect(cleanTaste("minimal")).toEqual([]);
  });
});

describe("bend output", () => {
  it("reproduces the first live board's directions with raw ingredients", () => {
    const w5 = bendBrief({ brief: "Flight checkout screen", wildness: 5, count: 8 }).directions;
    const w4 = bendBrief({ brief: "Flight checkout screen", wildness: 4, lens: "sadu", count: 8 }).directions;
    const byId = new Map([...w5, ...w4].map((d) => [d.id, d]));
    expect(byId.get("bd-8dti7s7c")?.searchQuery).toBe("crushed velvet");
    expect(byId.get("bd-8hfupzvw")?.searchQuery).toBe("vintage car dashboard");
    // Titles hold 4 words: "Art Nouveau 1900 Sadu red stripes" does not fit, so the lens (the stronger move) leads alone.
    expect(byId.get("bd-mwz3t0yp")?.searchQuery).toBe("Sadu red stripes");
    // Its ingredients break a checkout must-keep (a clear total or one primary action), so it is dropped.
    expect(byId.has("bd-dwyo4stn")).toBe(false);
    for (const id of ["bd-8dti7s7c", "bd-8hfupzvw", "bd-mwz3t0yp"]) {
      const d = byId.get(id)!;
      // No taste given: the taste lane gets the direction's own style words, never DEFAULT_TASTE as the user's taste.
      const lanes = laneTexts("Flight checkout screen", d.searchQuery, [], id, { platform: d.platform, styleWords: d.spec.styleWords, mechanic: d.mechanic.element });
      const allowed = [...uiLaneWords(lanes), ideaMechanicQuery(d.searchQuery, d.mechanic.element), `${d.searchQuery} interface`];
      for (const q of d.searchQueries) expect(allowed, q).toContain(q);
      expect(d.searchQueries).not.toContain(lanes.fidelity);
      expect(d.searchQueries).not.toContain(d.searchQuery);
    }
  });

  it("uses the given taste for the taste and hero lanes without moving any id", () => {
    const base = bendBrief({ brief: "flight checkout screen", wildness: 4, count: 8 });
    const tasted = bendBrief({ brief: "flight checkout screen", wildness: 4, count: 8, taste: ["monochrome"] });
    expect(tasted.directions.map((d) => d.id)).toEqual(base.directions.map((d) => d.id));
    const all = tasted.directions.flatMap((d) => d.searchQueries);
    // The taste lane is the brief's, so only the first direction keeps it (P0-05: no shared queries).
    expect(all.filter((q) => q === "monochrome flight checkout ui design")).toHaveLength(1);
    expect(all).toContain("monochrome flight app single screen");
    expect(all).not.toContain("flight checkout app ui");
    // Every direction searches its own idea.
    for (const d of tasted.directions) expect(d.searchQueries.some((q) => q.toLowerCase().startsWith(d.searchQuery.toLowerCase()))).toBe(true);
  });
});

describe("P0-05 mechanic and ingredient in direction queries", () => {
  const BRIEFS = [
    "eSIM plan picker for a GCC travel app: pick a destination data plan, compare GB and days, buy",
    "flight checkout for a GCC OTA",
    "coffee shop landing page",
    "banking onboarding",
    "fitness app empty state",
    "meditation app onboarding",
    "food delivery cart",
    "Retail banking mobile app homepage: balance, quick actions, recent transactions",
    "logistics fleet management dashboard",
    "poster for a jazz festival",
  ];
  const LENS_POOL = [undefined, undefined, "sadu", "talli"] as const;

  it("no two directions of a bend share a query, in any word order (200 seeds x 10 briefs)", () => {
    const rng = mulberry32(20261015);
    const problems: string[] = [];
    for (const brief of BRIEFS) {
      for (let seed = 0; seed < 200; seed++) {
        const wildness = (1 + Math.floor(rng() * 5)) as Wildness;
        const moves = MOVES.filter(() => rng() < 0.7);
        const lens = LENS_POOL[Math.floor(rng() * LENS_POOL.length)];
        const r = bendBrief({ brief, wildness, count: 4, ...(moves.length ? { moves } : {}), ...(lens ? { lens } : {}) });
        const seen = new Map<string, string>();
        for (const d of r.directions) {
          if (d.searchQueries.length === 0) problems.push(`${brief}: ${d.id} has no query`);
          if (d.searchQueries.includes(fidelityQuery(brief, d.platform))) problems.push(`${brief}: ${d.id} searches the fidelity lane`);
          for (const q of d.searchQueries) {
            const k = queryKey(q);
            if (seen.has(k)) problems.push(`${brief} w${wildness}: "${q}" in ${d.id} and ${seen.get(k)}`);
            seen.set(k, d.id);
            if (words(q).length > MAX_FOCUSED_QUERY_WORDS) problems.push(`too long: ${q}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  }, 120_000);

  it("leads with the page plus the mechanic's part, then the idea on that part", () => {
    const brief = "flight checkout for a GCC OTA";
    const r = bendBrief({ brief, wildness: 3, count: 4, platform: "mobile" });
    for (const [i, d] of r.directions.entries()) {
      const noun = ELEMENT_NOUN[d.mechanic.element]!;
      if (i === 0) expect(d.searchQueries[0]).toBe(mechanicQuery(brief, d.mechanic.element, "mobile"));
      expect(d.searchQueries.some((q) => q.includes(noun)), d.searchQueries.join(" | ")).toBe(true);
    }
    expect(mechanicQuery("flight checkout screen", "progress", "mobile")).toBe("flight checkout progress bar app ui");
    expect(mechanicQuery("poster for a jazz festival", "progress")).toBeNull();
    expect(ideaMechanicQuery("Sadu weaving", "divider")).toBe("sadu weaving section divider ui");
    expect(queryKey("plan picker app ui")).toBe(queryKey("picker plan app ui"));
  });

  it("puts the mechanic lane first among a saved direction's component lanes", () => {
    const lanes = laneTexts("GCC mobile flight checkout", "crushed velvet", [], "bd-1", { mechanic: "progress" });
    expect(lanes.component).toEqual(["flight checkout progress bar app ui", "flight checkout fare summary app ui"]);
    expect(laneTexts("GCC mobile flight checkout", "crushed velvet", [], "bd-1").component).toEqual([
      "flight checkout fare summary app ui",
      "flight checkout payment bottom sheet app ui",
    ]);
  });
});
