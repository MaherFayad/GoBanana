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
} from "@/lib/bend";
import { briefComponents, componentAppText } from "@/lib/bend/queries";
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

  it("fidelity: {domain} {surface}, with a core-noun fallback for compound domains", () => {
    expect(fidelityQuery(CANVAS_BRIEF)).toBe("flight app ui");
    expect(fidelityQuery("saudi fintech app")).toBe("saudi fintech app ui");
    expect(fidelityCoreQuery("saudi fintech app")).toBe("fintech app ui");
    expect(fidelityQuery("luxury hotel website")).toBe("luxury hotel website ui");
    expect(fidelityQuery("logistics dashboard")).toBe("logistics dashboard ui");
    expect(fidelityQuery("Dashboard for a fleet management company")).toBe("fleet management dashboard ui");
    expect(fidelityCoreQuery("Dashboard for a fleet management company")).toBe("fleet dashboard ui");
    expect(fidelityQuery("banking app onboarding")).toBe("banking app ui");
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
    expect(localeQuery(CANVAS_BRIEF)).toBe("arabic app ui");
    expect(localeQuery("arabic admin dashboard")).toBe("arabic dashboard ui");
    expect(localeQuery("banking app")).toBeNull();
  });

  it("builds every lane for a direction, two styles per direction, only the idea without a brief", () => {
    const lanes = laneTexts(CANVAS_BRIEF, "crushed velvet", DEFAULT_TASTE, "bd-8dti7s7c");
    expect(lanes).toEqual({
      idea: "crushed velvet",
      taste: `${pickStyle(DEFAULT_TASTE, "bd-8dti7s7c")} flight checkout ui design`,
      fidelity: "flight app ui",
      component: ["flight checkout ui"],
      bridge: "crushed velvet ui design",
      hero: `${pickStyle(DEFAULT_TASTE, "bd-8dti7s7c", 1)} flight app single screen`,
      locale: "arabic app ui",
    });
    expect(laneTexts(null, "crushed velvet", DEFAULT_TASTE, "bd-1")).toEqual({ idea: "crushed velvet" });
    for (const brief of [CANVAS_BRIEF, "saudi fintech app", "Dashboard for a fleet management company", "pricing page for a saas tool"]) {
      for (const q of Object.values(laneTexts(brief, "x", ["dark with one accent", "very soft studio 3d light"], "bd-2")).flat()) {
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

  it("component lanes: {core} {component} ui, at most 2, never just the surface", () => {
    expect(componentQueries("Retail banking mobile app homepage: balance, quick actions, recent transactions")).toEqual([
      "banking balance ui",
      "banking quick actions ui",
    ]);
    expect(componentQueries("Flight booking app with seat selection and boarding pass")).toEqual(["flight seat selection ui", "flight boarding pass ui"]);
    expect(componentQueries("Crypto wallet app: portfolio, swap, price chart")).toEqual(["crypto portfolio ui", "crypto swap ui"]);
    expect(componentQueries("Logistics fleet management dashboard with fleet map, data table")).toEqual(["fleet map ui", "fleet data table ui"]);
    expect(componentQueries("Food delivery app order tracking screen")).toEqual(["order tracking ui"]);
    expect(componentQueries("logistics dashboard")).toEqual([]);
    expect(componentQueries("poster for a jazz festival")).toEqual([]);
    expect(componentAppText("banking quick actions ui")).toBe("banking quick actions app ui");
    expect(componentAppText("flight app ui")).toBe("flight app ui");
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
    expect(byId.get("bd-mwz3t0yp")?.searchQuery).toBe("Art Nouveau 1900");
    expect(byId.get("bd-dwyo4stn")?.searchQuery).toBe("oversized film frames");
    for (const id of ["bd-8dti7s7c", "bd-8hfupzvw", "bd-mwz3t0yp", "bd-dwyo4stn"]) {
      const d = byId.get(id)!;
      expect(d.searchQueries).toEqual(uiLaneWords(laneTexts("Flight checkout screen", d.searchQuery, DEFAULT_TASTE, id)));
      expect(d.searchQueries).not.toContain(d.searchQuery);
    }
  });

  it("uses the given taste for the taste and hero lanes without moving any id", () => {
    const base = bendBrief({ brief: "flight checkout screen", wildness: 4, count: 8 });
    const tasted = bendBrief({ brief: "flight checkout screen", wildness: 4, count: 8, taste: ["monochrome"] });
    expect(tasted.directions.map((d) => d.id)).toEqual(base.directions.map((d) => d.id));
    for (const d of tasted.directions) {
      expect(d.searchQueries).toEqual([
        "flight app ui",
        "monochrome flight checkout ui design",
        "flight checkout ui",
        "monochrome flight app single screen",
        `${d.searchQuery} ui design`,
      ]);
    }
  });
});
