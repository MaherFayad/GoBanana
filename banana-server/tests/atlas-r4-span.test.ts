/**
 * Refinement R4 (bench/BASELINE.md, "Refinement R4"): the mechanic spans the page. It names 2 or 3
 * J1 parts with at least one flow or structure part, says how the main task works differently, keeps
 * the must keeps, never reskins a protected part, and is deterministic.
 */
import { describe, expect, it } from "vitest";
import { bendBriefAtlas, parsePage } from "@/lib/atlas/bend";
import { createAtlasLoader } from "@/lib/atlas/loader";
import { loaderSource } from "@/lib/atlas/source";
import { buildFixtureAtlas, countingFetcher } from "./fixtures/atlas-shards";
import { keepLine, partKind, platformSections, spanLayout, spanPage, taskSentence, type SpanInput } from "@/lib/atlas/page-span";
import type { CardElementLine, Mechanic, PageAnatomy, UiElement } from "@/lib/atlas/types";
import { protectedElements } from "@/lib/bend/mechanic";

const section = (role: string, element: UiElement, label: string, required = true, bands: PageAnatomy["sections"][number]["bands"] = {}) => ({ role, element, label, required, bands });

const CHECKOUT: PageAnatomy = {
  id: "flight-checkout",
  names: { en: ["flight checkout"], ar: [] },
  platforms: ["mobile", "website"],
  sections: [
    section("status-header", "header", "Trip header with back", true, { mobile: { y0: 0, y1: 0.1 } }),
    section("nav", "header", "Airline header", true, { website: { y0: 0, y1: 0.1 } }),
    section("toolbar", "stepper", "Booking steps"),
    section("cards", "card", "Flight summary"),
    section("other", "map", "Seat map"),
    section("list", "list-row", "Bag options"),
    section("sidebar", "price-breakdown", "Fare and extras summary"),
    section("cta", "total", "Total and continue bar"),
  ],
  baseline: "",
  mustKeep: [],
  wildSpots: [
    { element: "map", why: "" },
    { element: "card", why: "" },
    { element: "stepper", why: "" },
  ],
  mobbinTerms: [],
  queryNouns: [],
};

const line = (element: UiElement, how: string, buildability: CardElementLine["buildability"] = 4): CardElementLine => ({ cardId: "stamp", element, how, buildability });
const LINES = new Map<UiElement, CardElementLine>(
  [
    line("header", "Header is a pale visa page strip."),
    line("stepper", "Each step is a blank stamp frame that gets a dated stamp when done."),
    line("card", "Each card is a page with a visa-style border."),
    line("map", "Map is tinted grey-green with small stamp pins.", 2),
    line("list-row", "Rows are ruled lines with a small date stamp at right."),
    line("price-breakdown", "Rows are ruled lines with a stamped total line.", 5),
    line("total", "Total is a large figure inside a red stamp box.", 5),
  ].map((l) => [l.element, l]),
);

const BRIEF = "flight checkout for a GCC OTA: review the itinerary, add bags and seats, pay";
const protect = protectedElements(BRIEF, ["clear total", "one primary action"]);

function input(over: Partial<SpanInput> = {}): SpanInput {
  return {
    brief: BRIEF,
    page: CHECKOUT,
    platform: "mobile",
    main: { element: "header", mechanic: "header", how: "Header is a pale visa page strip" },
    lineOf: (el) => LINES.get(el),
    named: [],
    // The bend passes forbiddenElement over ELEMENT_TO_MECHANIC: a protected total covers price-breakdown too.
    forbidden: (el) => el === "total" || el === "price-breakdown" || el === "cta",
    used: new Map(),
    mustKeep: ["clear total", "one primary action"],
    protect,
    ...over,
  };
}

describe("spanPage", () => {
  it("names 2 or 3 parts, the mechanic's own first, with at least one flow or structure part", () => {
    const span = spanPage(input())!;
    expect(span.parts.length).toBeGreaterThanOrEqual(2);
    expect(span.parts.length).toBeLessThanOrEqual(3);
    expect(span.parts[0]!.element).toBe("header");
    expect(span.parts.some((p) => p.kind !== "surface")).toBe(true);
  });

  it("never names a part a must-keep protects", () => {
    const span = spanPage(input())!;
    for (const p of span.parts) expect(["total", "price-breakdown", "cta"]).not.toContain(p.element);
  });

  it("says how the main task works, in the brief's own task words, through the flow part", () => {
    const span = spanPage(input())!;
    expect(span.task).toContain("review the itinerary, add bags and seats, pay");
    expect(span.task).toContain("booking steps");
    expect(span.keep).toBe("Must keep: clear total, one primary action.");
  });

  it("skips a part whose J4 line is hard to build, and a section of another platform", () => {
    const span = spanPage(input())!;
    expect(span.parts.map((p) => p.element)).not.toContain("map"); // buildability 2, no J5 mechanic loaded
    expect(span.parts.map((p) => p.label)).not.toContain("airline header");
    expect(platformSections(CHECKOUT, "mobile").map((s) => s.label)).not.toContain("Airline header");
  });

  it("uses a loaded J5 mechanic when the lead has no usable line", () => {
    const mech: Mechanic = { id: "map-pins", element: "map", name: "Stamp pins", how: "Seats are pins on a grid, the chosen one stamped", buildability: 4, rtl: "", a11y: "", pages: ["flight-checkout"] };
    const span = spanPage(input({ mechanicsOf: (el) => (el === "map" ? [mech] : []), named: ["map"] }))!;
    expect(span.parts.find((p) => p.element === "map")?.how).toBe("Stamp pins: seats are pins on a grid");
  });

  it("treats a progress mechanic and the page's stepper as one part", () => {
    const span = spanPage(input({ main: { element: "progress", mechanic: "progress", how: "Progress is a row of stamp slots" } }))!;
    expect(span.parts[0]!.label).toBe("booking steps");
    expect(span.parts.filter((p) => p.element === "stepper")).toHaveLength(0);
  });

  it("spreads parts over a bend's directions (a part two earlier directions named gives way)", () => {
    const first = spanPage(input())!;
    const used = new Map<UiElement, number>(first.parts.slice(1).map((p) => [p.element, 2]));
    const second = spanPage(input({ used }))!;
    expect(second.parts.slice(1).map((p) => p.element)).not.toEqual(first.parts.slice(1).map((p) => p.element));
  });

  it("is deterministic and returns null when the page has no other part", () => {
    expect(spanPage(input())).toEqual(spanPage(input()));
    expect(spanPage(input({ page: { ...CHECKOUT, sections: [CHECKOUT.sections[0]!], wildSpots: [] } }))).toBeNull();
  });

  it("writes one layout line with the parts, the task and the must keeps", () => {
    const span = spanPage(input())!;
    const layout = spanLayout("Passport Stamp Page", "flight checkout", span, " on a 4 column grid");
    expect(layout.startsWith("Passport Stamp Page runs the flight checkout across the trip header with back, ")).toBe(true);
    expect(layout).toContain(span.task);
    expect(layout.endsWith("Must keep: clear total, one primary action.")).toBe(true);
    expect(layout).not.toContain(String.fromCharCode(0x2014));
  });
});

describe("task and keep lines", () => {
  it("falls back to the part's task when the brief lists none", () => {
    expect(taskSentence("pricing page for a B2B analytics SaaS", { element: "paywall-plan", label: "plan cards", how: "Plans are keycaps" })).toBe("The main task, comparing and picking a plan, now runs through the plan cards: plans are keycaps.");
    expect(taskSentence("kids reading app home screen", { element: "progress", label: "daily goal and sticker path", how: "A row of felt dots" })).toContain("making progress");
  });

  it("keeps the brief's must keeps, else the protected parts", () => {
    expect(keepLine([], protectedElements("cart checkout"))).toBe("The total and the main button stay plain and readable.");
    expect(keepLine([], new Set())).toBe("");
  });

  it("reads a footer or a top bar as framing, not structure", () => {
    expect(partKind("section-nav", "footer")).toBe("surface");
    expect(partKind("card", "cards")).toBe("structure");
    expect(partKind("stepper")).toBe("flow");
  });
});

describe("parsePage (R4)", () => {
  const page = (id: string, names: string[]): PageAnatomy => ({ ...CHECKOUT, id, names: { en: names, ar: [] } });
  const pages = [page("app-home", ["app home screen", "home tab"]), page("kids-home", ["kids app home screen", "kids home"]), page("landing-page", ["landing page"])];

  it("prefers a narrower page whose name holds more of the brief", () => {
    expect(parsePage("kids reading app home screen", pages)?.id).toBe("kids-home");
    expect(parsePage("recipe app home screen", pages)?.id).toBe("app-home");
    expect(parsePage("coffee shop landing page", pages)?.id).toBe("landing-page");
  });
});

describe("bendBriefAtlas (R4)", () => {
  it("every direction that spans the page names a flow or structure part, never a protected one, and shows the task in its layout", async () => {
    const { manifest, files } = await buildFixtureAtlas();
    const source = () => loaderSource(createAtlasLoader({ manifest, fetchShard: countingFetcher(files).fetchShard, budget: 200 }));
    const input = { brief: "eSIM plan picker for a GCC travel app: pick a plan, buy", wildness: 3 as const, platform: "mobile" as const, mustKeep: ["clear price per plan", "one primary action"] };
    const r = (await bendBriefAtlas(input, source()))!;
    expect(r).toEqual(await bendBriefAtlas(input, source()));
    const spanning = r.directions.filter((d) => d.mechanic.parts);
    expect(spanning.length).toBeGreaterThan(0);
    for (const d of spanning) {
      expect(d.mechanic.parts!.length).toBeGreaterThanOrEqual(2);
      expect(d.mechanic.parts!.some((p) => partKind(p.element as UiElement) !== "surface")).toBe(true);
      expect(d.mechanic.parts!.map((p) => p.element)).not.toContain("cta");
      expect(d.spec.layout).toContain(d.mechanic.task!);
      expect(d.spec.layout).toContain("Must keep: clear price per plan, one primary action.");
      expect(d.prompt).toContain("Across the page:");
    }
  });
});
