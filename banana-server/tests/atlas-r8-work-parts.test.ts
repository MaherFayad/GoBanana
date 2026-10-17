/**
 * Refinement R8 (bench/BASELINE.md, "Refinement R8"): the bend can land a direction's mechanic on
 * the parts where a search, listing, browse or form page's work happens (list rows, result cards,
 * the map, form fields, filters), a work part stands for its required section, and on a page with a
 * required work part the empty state is no longer where the idea goes.
 */
import { describe, expect, it } from "vitest";
import { ELEMENT_TO_MECHANIC, reasonElements } from "@/lib/atlas/bend";
import { spanPage, type SpanInput } from "@/lib/atlas/page-span";
import type { CardElementLine, PageAnatomy, UiElement } from "@/lib/atlas/types";
import { MECHANIC_ELEMENTS, pickMechanic, protectedElements, WORK_ELEMENTS } from "@/lib/bend/mechanic";
import { PART } from "@/lib/bend/spec";
import { ELEMENT_NOUN } from "@/lib/bend/queries";

const section = (role: string, element: UiElement, label: string, required = true) => ({ role, element, label, required, bands: {} });

const SEARCH: PageAnatomy = {
  id: "search",
  names: { en: ["search results"], ar: [] },
  platforms: ["mobile"],
  sections: [
    section("status-header", "header", "Top bar with back"),
    section("toolbar", "search", "Search field"),
    section("chips", "chip-filter", "Filters and sort", false),
    section("list", "list-row", "Recent searches", false),
    section("list", "list-row", "Result list"),
    section("other", "empty-state", "No results message", false),
  ],
  baseline: "",
  mustKeep: [],
  wildSpots: [
    { element: "empty-state", why: "" },
    { element: "search", why: "" },
  ],
  mobbinTerms: [],
  queryNouns: [],
};

const line = (element: UiElement, how: string): CardElementLine => ({ cardId: "tags", element, how, buildability: 4 });
const LINES = new Map<UiElement, CardElementLine>(
  [
    line("list-row", "Each listing hangs as a luggage tag on one rail, rent and district printed plainly on the face"),
    line("chip-filter", "Filters are tags threaded on a cord, a picked tag swings forward with an x to clear"),
    line("search", "The search field is a tag blank where the typed district prints in plain mono"),
    line("empty-state", "An empty rail with one loose tag and a clear next step"),
  ].map((l) => [l.element, l]),
);

function input(over: Partial<SpanInput> = {}): SpanInput {
  return {
    brief: "property search results for Riyadh rentals",
    page: SEARCH,
    platform: "mobile",
    main: { element: "list-row", mechanic: "list-row", how: LINES.get("list-row")!.how },
    lineOf: (el) => LINES.get(el),
    named: [],
    forbidden: () => false,
    used: new Map(),
    mustKeep: [],
    protect: new Set(),
    ...over,
  };
}

describe("R8 work parts", () => {
  it("are mechanic elements the Atlas bend can land on, with a part name and a search noun", () => {
    for (const el of WORK_ELEMENTS) {
      expect(MECHANIC_ELEMENTS).toContain(el);
      expect(ELEMENT_TO_MECHANIC[el as UiElement]).toBe(el);
      expect(PART[el]).toBeTruthy();
      expect(ELEMENT_NOUN[el]).toBeTruthy();
    }
  });

  it("are never picked by the lists engine", () => {
    for (const label of ["map of the souq", "list of rows", "card catalog", "form", "filter"]) {
      const m = pickMechanic({ lead: "transplant", entry: { label, query: label, hints: {} } as never, others: [], protect: new Set(), used: new Map() });
      expect(WORK_ELEMENTS.has(m.element)).toBe(false);
    }
  });

  it("are named by a page fit reason, but plan cards stay the plan choice", () => {
    expect(reasonElements("listings hang like tags on a rail")).toContain("list-row");
    expect(reasonElements("homes stamped on the map")).toContain("map");
    expect(reasonElements("sign-up fields fill like a pass")).toContain("form-field");
    expect(reasonElements("filters as threaded tags")).toContain("chip-filter");
    expect(reasonElements("prices on the plan cards")).not.toContain("card");
    expect(reasonElements("restaurant cards as crates")).toContain("card");
  });

  it("stand for their required section and leave the empty state out on a work page", () => {
    const span = spanPage(input())!;
    expect(span.parts[0]).toMatchObject({ element: "list-row", label: "result list" });
    expect(span.parts.map((p) => p.element)).not.toContain("empty-state");
    expect(span.task).toContain("result list");
  });

  it("keep the must keeps of a paying brief", () => {
    const protect = protectedElements("food delivery checkout: pay", []);
    expect(protect.has("list-row" as never)).toBe(false);
    expect(protect.has("total")).toBe(true);
  });
});
