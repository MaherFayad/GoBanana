import { describe, expect, it } from "vitest";
import {
  bendBrief,
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
} from "@/lib/bend";
import { lensEntries } from "@/lib/bend/lists";
import { MOVE_DEFS } from "@/lib/bend/moves";
import { cleanTaste, DEFAULT_TASTE } from "@/lib/taste";

const words = (s: string) => s.split(/\s+/).filter(Boolean);
const CANVAS_BRIEF = "Flight checkout screen for a GCC travel OTA (mobile, bilingual Arabic/English)";

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
    expect(fidelityQuery("poster for a jazz festival")).toBe("jazz festival poster design");
  });

  it("taste: {style} {component} ui with no domain; the default component follows the surface", () => {
    expect(tasteQuery(CANVAS_BRIEF, "minimal")).toBe("minimal checkout ui");
    expect(tasteQuery("banking app onboarding", "dark mode")).toBe("dark mode onboarding ui");
    expect(tasteQuery("saudi fintech app", "glassmorphism")).toBe("glassmorphism card ui");
    expect(tasteQuery("luxury hotel website", "editorial")).toBe("editorial hero section ui");
    expect(tasteQuery("pricing page for a saas tool", "swiss style")).toBe("swiss style pricing page ui");
    expect(tasteQuery("logistics dashboard", "dark with one accent")).toBe("dark accent dashboard ui");
    expect(tasteQuery("poster for a jazz festival", "grainy")).toBe("grainy jazz festival poster");
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

  it("builds every lane for a direction, two styles per direction, only inspiration without a brief", () => {
    const lanes = laneTexts(CANVAS_BRIEF, "crushed velvet", DEFAULT_TASTE, "bd-8dti7s7c");
    expect(lanes).toEqual({
      inspiration: "crushed velvet",
      taste: `${pickStyle(DEFAULT_TASTE, "bd-8dti7s7c")} checkout ui`,
      fidelity: "flight app ui",
      hero: `${pickStyle(DEFAULT_TASTE, "bd-8dti7s7c", 1)} flight app single screen`,
      locale: "arabic app ui",
    });
    expect(laneTexts(null, "crushed velvet", DEFAULT_TASTE, "bd-1")).toEqual({ inspiration: "crushed velvet" });
    for (const brief of [CANVAS_BRIEF, "saudi fintech app", "Dashboard for a fleet management company", "pricing page for a saas tool"]) {
      for (const q of Object.values(laneTexts(brief, "x", ["dark with one accent", "very soft studio 3d light"], "bd-2"))) {
        expect(words(q!).length, q).toBeLessThanOrEqual(MAX_FOCUSED_QUERY_WORDS);
      }
    }
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
      expect(d.searchQueries).toEqual(
        Object.values(laneTexts("Flight checkout screen", d.searchQuery, DEFAULT_TASTE, id)).filter((q) => q !== undefined),
      );
    }
  });

  it("uses the given taste for the taste and hero lanes without moving any id", () => {
    const base = bendBrief({ brief: "flight checkout screen", wildness: 4, count: 8 });
    const tasted = bendBrief({ brief: "flight checkout screen", wildness: 4, count: 8, taste: ["monochrome"] });
    expect(tasted.directions.map((d) => d.id)).toEqual(base.directions.map((d) => d.id));
    for (const d of tasted.directions) {
      expect(d.searchQueries).toEqual([d.searchQuery, "monochrome checkout ui", "flight app ui", "monochrome flight app single screen"]);
    }
  });
});
