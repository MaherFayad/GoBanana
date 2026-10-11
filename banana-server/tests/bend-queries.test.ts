import { describe, expect, it } from "vitest";
import {
  bendBrief,
  fidelityQuery,
  inspirationFromQuery,
  inspirationQuery,
  isUiBrief,
  LENSES,
  LISTS,
  MAX_FOCUSED_QUERY_WORDS,
  MAX_LANE_WORDS,
  MOVES,
  pickStyle,
  tasteQuery,
} from "@/lib/bend";
import { lensEntries, LAYOUT_WORDS } from "@/lib/bend/lists";
import { MOVE_DEFS } from "@/lib/bend/moves";
import { cleanTaste, DEFAULT_TASTE } from "@/lib/taste";

const words = (s: string) => s.split(/\s+/).filter(Boolean);
const CANVAS_BRIEF = "Flight checkout screen for a GCC travel OTA (mobile, bilingual Arabic/English)";

describe("inspiration lane", () => {
  it("is one raw ingredient with one anchor word, at most 5 words, no UI words", () => {
    expect(inspirationQuery("lens", "Sadu weaving")).toBe("Sadu weaving pattern");
    expect(inspirationQuery("lens", "squiggle pattern")).toBe("squiggle pattern");
    expect(inspirationQuery("material", "crushed velvet")).toBe("crushed velvet texture");
    expect(inspirationQuery("transplant", "garment care label")).toBe("garment care label design");
    expect(inspirationQuery("era", "Art Nouveau 1900")).toBe("Art Nouveau 1900 graphic design");
    expect(inspirationQuery("scale", "film frames")).toBe("oversized film frames poster");
    for (const move of MOVES) {
      for (const e of LISTS[MOVE_DEFS[move].list]) {
        const q = inspirationQuery(move, e.query);
        expect(words(q).length, q).toBeLessThanOrEqual(MAX_LANE_WORDS);
        for (const w of words(q.toLowerCase())) {
          if (!words(e.query.toLowerCase()).includes(w)) expect(w === "design" || !LAYOUT_WORDS.has(w), q).toBe(true);
        }
      }
    }
  });

  it("pulls the lead ingredient out of the stacked queries stored by older directions", () => {
    // The real stored queries from the first live board.
    expect(inspirationFromQuery("crushed velvet texture ui design garment care label packaging")).toBe("crushed velvet texture");
    expect(inspirationFromQuery("Art Nouveau 1900 graphic design Sadu red stripes pattern")).toBe("Art Nouveau 1900 graphic design");
    expect(inspirationFromQuery("oversized film frames poster gold leaf texture")).toBe("oversized film frames poster");
    expect(inspirationFromQuery("eerie vintage car dashboard packaging design")).toBe("vintage car dashboard design");
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

describe("fidelity and taste lanes", () => {
  it("detects UI briefs from a small word list", () => {
    expect(isUiBrief(CANVAS_BRIEF)).toBe(true);
    expect(isUiBrief("fitness tracker dashboard")).toBe(true);
    expect(isUiBrief("poster for a jazz festival")).toBe(false);
  });

  it("names the domain and screen type in common words", () => {
    expect(fidelityQuery(CANVAS_BRIEF)).toBe("flight checkout app ui");
    expect(fidelityQuery("flight checkout screen")).toBe("flight checkout app ui");
    expect(fidelityQuery("fitness tracker dashboard")).toBe("fitness tracker dashboard ui");
    expect(fidelityQuery("Dashboard for a fleet management company")).toBe("fleet management dashboard ui");
    expect(fidelityQuery("banking app onboarding")).toBe("banking onboarding app ui");
    expect(fidelityQuery("coffee shop landing page")).toBe("coffee shop website design");
    expect(fidelityQuery("checkout and payment flow for a shoe store")).toBe("shoe store checkout app ui");
    expect(fidelityQuery("poster for a jazz festival")).toBe("jazz festival poster design");
  });

  it("adds one style word to the domain and component", () => {
    expect(tasteQuery(CANVAS_BRIEF, "soft 3d")).toBe("flight checkout ui soft 3d");
    expect(tasteQuery("boarding pass card for an airline app", "soft 3d")).toBe("boarding pass card soft 3d");
    expect(tasteQuery("banking app onboarding", "glassmorphism")).toBe("banking app ui glassmorphism");
    expect(tasteQuery("weather widget", "dark with one accent")).toBe("weather widget dark accent");
    expect(tasteQuery("poster for a jazz festival", "minimal")).toBe("jazz festival poster minimal");
    for (const style of [...DEFAULT_TASTE, "dark with one accent", "very soft studio 3d light"]) {
      for (const brief of [CANVAS_BRIEF, "fitness tracker dashboard", "Dashboard for a fleet management company"]) {
        expect(words(tasteQuery(brief, style)).length).toBeLessThanOrEqual(MAX_FOCUSED_QUERY_WORDS);
      }
    }
  });

  it("picks a style by direction id, deterministically", () => {
    expect(pickStyle(DEFAULT_TASTE, "bd-8dti7s7c")).toBe(pickStyle([...DEFAULT_TASTE], "bd-8dti7s7c"));
    expect(DEFAULT_TASTE).toContain(pickStyle(DEFAULT_TASTE, "bd-x"));
    expect(pickStyle([], "bd-x")).toBe(pickStyle(DEFAULT_TASTE, "bd-x"));
    expect(pickStyle(["only"], "bd-x")).toBe("only");
  });

  it("cleans taste words", () => {
    expect(cleanTaste(["Soft 3D!", "soft 3d", "", 4, "dark, with one accent and more words"])).toEqual([
      "soft 3d",
      "dark with one accent",
    ]);
    expect(cleanTaste(["a", "b", "c", "d", "e", "f"])).toHaveLength(5);
    expect(cleanTaste("minimal")).toEqual([]);
  });
});

describe("bend output", () => {
  it("reproduces the first live board's directions with focused queries", () => {
    const w5 = bendBrief({ brief: "Flight checkout screen", wildness: 5, count: 8 }).directions;
    const w4 = bendBrief({ brief: "Flight checkout screen", wildness: 4, lens: "sadu", count: 8 }).directions;
    const byId = new Map([...w5, ...w4].map((d) => [d.id, d]));
    expect(byId.get("bd-8dti7s7c")?.searchQuery).toBe("crushed velvet texture");
    expect(byId.get("bd-8hfupzvw")?.searchQuery).toBe("vintage car dashboard design");
    expect(byId.get("bd-mwz3t0yp")?.searchQuery).toBe("Art Nouveau 1900 graphic design");
    expect(byId.get("bd-dwyo4stn")?.searchQuery).toBe("oversized film frames poster");
    for (const id of ["bd-8dti7s7c", "bd-8hfupzvw", "bd-mwz3t0yp", "bd-dwyo4stn"]) {
      expect(byId.get(id)?.searchQueries.at(-1)).toBe("flight checkout app ui");
    }
  });

  it("uses the given taste for the taste lane without moving any id", () => {
    const base = bendBrief({ brief: "flight checkout screen", wildness: 4, count: 8 });
    const tasted = bendBrief({ brief: "flight checkout screen", wildness: 4, count: 8, taste: ["claymorphism"] });
    expect(tasted.directions.map((d) => d.id)).toEqual(base.directions.map((d) => d.id));
    for (const d of tasted.directions) expect(d.searchQueries[1]).toBe("flight checkout ui claymorphism");
    for (const d of base.directions) expect(DEFAULT_TASTE.some((t) => d.searchQueries[1]!.endsWith(t))).toBe(true);
  });
});
