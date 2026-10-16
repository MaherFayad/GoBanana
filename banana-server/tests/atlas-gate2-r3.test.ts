/**
 * Gate 2 round 3 (bench/GATE2-DIAGNOSIS.md, round 3): brief-level fit, Gulf places, must-keep
 * conflicts and the plan cards mechanic, search hints from J1 and J2, and the recipe guard.
 */
import { describe, expect, it } from "vitest";
import { aimsAtProtected, bendBriefAtlas, ELEMENT_TO_MECHANIC, parseTheme, similarity } from "@/lib/atlas/bend";
import { briefFit, briefWorld, cardPlaces, occasionsIn, placesIn, OFF_BRIEF, REGIONAL_UNTIED, STYLE_ONLY_DROP, TIE_STEP, type BriefWorld } from "@/lib/atlas/brief-fit";
import { beatsPhase0, MIN_JUDGED } from "@/lib/atlas/recipe-fit";
import { atlasSearchPlan } from "@/lib/atlas/search";
import { applySearchHints, searchHints } from "@/lib/atlas/search-hints";
import { buildFixtureAtlas, countingFetcher } from "./fixtures/atlas-shards";
import { createAtlasLoader } from "@/lib/atlas/loader";
import { loaderSource } from "@/lib/atlas/source";
import type { DomainEntry, IngredientCard, PageAnatomy } from "@/lib/atlas/types";
import { forbiddenElement, protectedElements } from "@/lib/bend/mechanic";
import { PART } from "@/lib/bend/spec";
import { ELEMENT_NOUN, tasteQuery } from "@/lib/bend/queries";

async function fixtureSource() {
  const { manifest, files } = await buildFixtureAtlas();
  return loaderSource(createAtlasLoader({ manifest, fetchShard: countingFetcher(files).fetchShard, budget: 400 }));
}

function card(p: Partial<IngredientCard> & Pick<IngredientCard, "id" | "kind" | "name">): IngredientCard {
  return {
    family: "misc",
    idea: `${p.name} as one part of the page.`,
    surprise: "Unexpected in an app.",
    palette: [],
    shipPairs: [],
    type: { voice: "grotesk", latin: { display: "Inter", body: "Inter" }, arabic: { display: "Noto Sans Arabic", body: "Noto Sans Arabic" } },
    texture: "flat",
    imagery: "photos",
    motion: { verb: "slide", ms: 200, reduced: "fade" },
    radius: "small",
    density: "balanced",
    avoid: [],
    artQueries: [],
    ...p,
  };
}

const domain = (id: string, names: string[], productNouns: string[], extra: Partial<DomainEntry> = {}): DomainEntry => ({
  id,
  names: { en: names, ar: [] },
  productNouns,
  audience: "",
  fitsFamilies: [],
  clashFamilies: [],
  ...extra,
});

const FOOD = domain("food-delivery", ["food delivery", "meal delivery"], ["restaurant menu", "promo code", "courier"], { regionNotes: "Orders peak around iftar and suhoor in Ramadan." });
const FAITH = domain("faith-lifestyle", ["faith lifestyle", "prayer times apps", "Ramadan planners", "Muslim daily life apps"], ["prayer times", "qibla compass", "adhan alert", "Quran reading plan", "iftar countdown"]);
const SAAS = domain("analytics-saas", ["B2B analytics", "analytics SaaS"], ["dashboard", "KPI", "chart", "report", "widget"]);
const COFFEE = domain("coffee", ["coffee shop", "specialty coffee"], ["cold brew", "barista", "pour-over"]);
const REAL_ESTATE = domain("real-estate", ["real estate", "property"], ["listing", "floor plan"]);
const KIDS = domain("kids-learning", ["kids learning", "children's reading apps"], ["storybook", "sticker"]);
const HOMES = domain("home-decor", ["home decor"], ["home"]);
const DOMAINS = [FOOD, FAITH, SAAS, COFFEE, REAL_ESTATE, KIDS, HOMES];

const page = (id: string, names: string[], queryNouns: string[] = []): PageAnatomy => ({
  id,
  names: { en: names, ar: [] },
  platforms: ["mobile"],
  sections: [],
  baseline: "",
  mustKeep: [],
  wildSpots: [],
  mobbinTerms: [],
  queryNouns,
});
const OFFERS = page("offers-page", ["offers page", "deals page"], ["offers page", "sale banner"]);
const PRICING = page("pricing-page", ["pricing page", "plans page"], ["pricing table", "plan cards"]);
const LISTING = page("property-listing", ["property listing page", "listing detail"]);
const LANDING = page("landing-page", ["landing page", "home page"]);

const najdi = card({ id: "najdi-mud", kind: "tradition", name: "Najdi Mud Architecture", region: "gulf", culturalNotes: "Mud-brick building of central Arabia." });
const emirati = card({ id: "barjeel", kind: "tradition", name: "Emirati Barjeel Wind Towers", region: "gulf", culturalNotes: "Wind towers on coastal houses." });
const coral = card({ id: "coral", kind: "material", name: "Coral Stone Blocks", region: "gulf", culturalNotes: "Old coastal towns such as historic Jeddah and Muharraq in Bahrain, built by masons of the Hejaz and Gulf shores." });
const dallah = card({ id: "dallah", kind: "object", name: "Dallah Coffee Pot", region: "gulf", culturalNotes: "Arabic coffee across the Gulf." });
const iceCream = card({ id: "ice-cream", kind: "object", name: "Ice Cream Truck Menu", region: "north-america" });
const beer = card({ id: "beer", kind: "object", name: "Craft Beer Can", region: "global" });
const qamar = card({ id: "qamar", kind: "material", name: "Qamar al-Din Apricot Sheet", region: "mena", culturalNotes: "Apricot paste soaked into a drink during Ramadan." });
const swiss = card({ id: "swiss", kind: "era", name: "Swiss Style 1960s", region: "europe" });
const scandi = card({ id: "scandi", kind: "era", name: "Scandinavian Modern 1955", region: "europe" });
const jebena = card({ id: "jebena", kind: "object", name: "Ethiopian Jebena Coffee Pot", region: "east-africa", idea: "A coffee ceremony pot." });
const stoneware = card({ id: "stoneware", kind: "material", name: "Stoneware", region: "global" });
const felt = card({ id: "felt", kind: "material", name: "Wool Felt", idea: "A kids' learning app with felt shapes." });

const world = (brief: string, d: DomainEntry, p: PageAnatomy, market: BriefWorld["market"]) => briefWorld(brief, market, d, DOMAINS, p);

describe("Gulf places", () => {
  it("map cities and countries to a Gulf country, and Saudi cities to a region", () => {
    expect(placesIn("luxury real estate listing page for Dubai apartments")).toEqual([{ country: "ae" }]);
    expect(placesIn("Abu Dhabi")).toEqual([{ country: "ae" }]);
    expect(placesIn("government services dashboard for Qatar residents")).toEqual([{ country: "qa" }]);
    expect(placesIn("a Doha cafe")).toEqual([{ country: "qa" }]);
    expect(placesIn("a Riyadh bank")).toEqual([{ country: "sa", area: "najd" }]);
    expect(placesIn("Jeddah food delivery")).toEqual([{ country: "sa", area: "hejaz" }]);
    expect(placesIn("Saudi food delivery")).toEqual([{ country: "sa" }]);
    expect(placesIn("Saudi app for Riyadh")).toEqual([{ country: "sa", area: "najd" }]);
    expect(placesIn("Kuwait, Bahrain and Muscat")).toEqual([{ country: "kw" }, { country: "bh" }, { country: "om" }]);
    expect(placesIn("a GCC travel app")).toEqual([]);
  });

  it("a card's place comes from its name first, else its text unless the text names the whole Gulf", () => {
    expect(cardPlaces(najdi)).toEqual([{ country: "sa", area: "najd" }]);
    expect(cardPlaces(emirati)).toEqual([{ country: "ae" }]);
    expect(cardPlaces(coral)).toEqual([]);
    expect(cardPlaces(dallah)).toEqual([]);
  });

  it("never puts a Najdi card on a UAE or Qatar brief, unless a lens asks for it", () => {
    const dubai = world("luxury real estate listing page for Dubai apartments", REAL_ESTATE, LISTING, "gulf");
    const qatar = world("services dashboard for Qatar residents", REAL_ESTATE, LISTING, "gulf");
    expect(briefFit(najdi, ["Najdi homes suit property"], dubai).drop).toBe(true);
    expect(briefFit(najdi, [], qatar).drop).toBe(true);
    expect(briefFit(najdi, [], dubai, { lensAsked: true }).drop).toBe(false);
    expect(briefFit(emirati, [], dubai).drop).toBe(false);
    expect(briefFit(coral, [], dubai).drop).toBe(false);
  });

  it("keeps a Najdi card on a Riyadh brief, and costs a step less a region of the same country", () => {
    const riyadh = world("Riyadh real estate listing", REAL_ESTATE, LISTING, "gulf");
    const jeddah = world("Jeddah real estate listing", REAL_ESTATE, LISTING, "gulf");
    expect(briefFit(najdi, [], riyadh)).toMatchObject({ drop: false, delta: 0 });
    const j = briefFit(najdi, [], jeddah);
    expect(j.drop).toBe(false);
    expect(j.delta).toBeLessThan(0);
  });

  it("Gulf cards only on Gulf briefs: the dallah leaves a global coffee shop brief", () => {
    const coffee = world("coffee shop landing page", COFFEE, LANDING, null);
    expect(briefFit(dallah, ["Arabic coffee is the product"], coffee).drop).toBe(true);
    expect(briefFit(dallah, [], world("coffee shop landing page in Kuwait", COFFEE, LANDING, "gulf")).drop).toBe(false);
  });

  it("a fit reason that names another Gulf country costs a step", () => {
    const qatar = world("services dashboard for Qatar residents", REAL_ESTATE, LISTING, "gulf");
    const plain = card({ id: "folder", kind: "object", name: "Manila Folder" });
    expect(briefFit(plain, ["Folders suit Saudi services"], qatar).delta).toBeLessThan(0);
    expect(briefFit(plain, ["Folders suit records"], qatar).delta).toBe(0);
  });
});

describe("brief-level fit", () => {
  const ramadan = world("Ramadan offers page for a Saudi food delivery app", FOOD, OFFERS, "gulf");

  it("a card from another named region costs a step on a Gulf brief", () => {
    expect(briefFit(iceCream, ["Price bubbles show deal prices"], ramadan)).toMatchObject({ drop: false, delta: -OFF_BRIEF });
  });

  it("drink, pork and gambling cards never go on a Gulf, occasion or kids brief", () => {
    expect(briefFit(beer, [], ramadan).drop).toBe(true);
    expect(briefFit(beer, [], world("kids reading app home screen", KIDS, LANDING, null)).drop).toBe(true);
    expect(briefFit(beer, [], world("coffee shop landing page", COFFEE, LANDING, null)).drop).toBe(false);
  });

  it("a card that names the brief's occasion gains, one that names another loses", () => {
    expect(occasionsIn("Ramadan offers")).toEqual(["ramadan"]);
    expect(briefFit(qamar, [], ramadan).delta).toBeGreaterThan(0);
    const xmas = card({ id: "xmas", kind: "object", name: "Christmas Cracker" });
    expect(briefFit(xmas, [], ramadan).delta).toBeLessThan(0);
  });

  it("a regional style whose fit reason names only a style drops more than a step on a brief with no market", () => {
    const pricing = world("pricing page for a B2B analytics SaaS", SAAS, PRICING, null);
    expect(briefFit(swiss, ["Visible grid suits dashboards", "Visible grid orders plan table"], pricing).delta).toBe(-STYLE_ONLY_DROP);
    // A concrete reason is not a style-only reason.
    expect(briefFit(swiss, ["Swiss railway timetables suit KPIs"], pricing).delta).toBe(-REGIONAL_UNTIED);
  });

  it("a regional card with no tie to a brief with no market costs, a tied one gains", () => {
    const coffee = world("coffee shop landing page", COFFEE, LANDING, null);
    expect(briefFit(scandi, ["Birch and oak suit coffee shops"], coffee).delta).toBe(-REGIONAL_UNTIED);
    expect(briefFit(jebena, ["Coffee ceremony fit"], coffee).delta).toBe(TIE_STEP);
    expect(briefFit(stoneware, ["Ceramic mugs suit coffee"], coffee).delta).toBe(0);
  });

  it("telling words count once each, and multi-word nouns only whole", () => {
    const coffee = world("coffee shop landing page", COFFEE, LANDING, null);
    expect(coffee.tie.has("coffee")).toBe(true);
    expect(coffee.tie.has("cold")).toBe(false);
    expect(coffee.tiePhrases).toContain("cold brew");
    const brew = card({ id: "brew", kind: "object", name: "Cold Brew Bottle", region: "global" });
    expect(briefFit(brew, [], coffee).delta).toBe(TIE_STEP);
  });

  it("kids cards gain on a kids brief", () => {
    const kids = world("kids reading app home screen", KIDS, LANDING, null);
    expect(briefFit(felt, [], kids).delta).toBeGreaterThan(0);
  });
});

describe("theme parsing", () => {
  it("a theme comes from a whole domain name or an occasion word, never one shared word", () => {
    expect(parseTheme("Ramadan offers page for a Saudi food delivery app", DOMAINS, OFFERS)?.id).toBe("faith-lifestyle");
    expect(parseTheme("kids reading app home screen", DOMAINS, LANDING)?.id).toBeUndefined();
  });
});

describe("must-keep conflicts and the plan cards mechanic", () => {
  it("plan cards are their own mechanic part, not the main button", () => {
    expect(ELEMENT_TO_MECHANIC["paywall-plan"]).toBe("plan");
    expect(PART.plan).toBe("plan cards");
    expect(ELEMENT_NOUN.plan).toBe("plan cards");
  });

  it("one primary action protects the button, not the plan cards; a plan cards must-keep protects them", () => {
    const keep = protectedElements("eSIM plan picker", ["clear price", "one primary action"]);
    expect(forbiddenElement("cta", keep)).toBe(true);
    expect(forbiddenElement("total", keep)).toBe(true);
    expect(forbiddenElement("plan", keep)).toBe(false);
    expect(forbiddenElement("plan", protectedElements("x", ["clear plan cards"]))).toBe(true);
    expect(forbiddenElement("progress", protectedElements("x", ["clear progress"]))).toBe(false);
  });

  it("a reason aimed only at protected parts gives way to the next card", () => {
    const keep = protectedElements("x", ["clear plan cards", "clear price", "one primary action"]);
    expect(aimsAtProtected("Plans as stepped shades to pick", keep)).toBe(true);
    expect(aimsAtProtected("Plans as stepped shades to pick", protectedElements("x", ["clear price"]))).toBe(false);
    expect(aimsAtProtected("Stop line shows checkout steps", keep)).toBe(false);
    expect(aimsAtProtected("Wood board suits coffee", keep)).toBe(false);
  });

  it("the bend leads with another card when a lead's reason aims at a protected part", async () => {
    const source = await fixtureSource();
    const open = (await bendBriefAtlas({ brief: "eSIM plan picker", wildness: 3, count: 8 }, source))!;
    const closed = (await bendBriefAtlas({ brief: "eSIM plan picker", wildness: 3, count: 8, mustKeep: ["clear plan cards", "clear price", "one primary action"] }, source))!;
    for (const d of closed.directions) expect(["total", "cta", "plan"]).not.toContain(d.mechanic.element);
    expect(open.directions.length).toBeGreaterThan(0);
  });

  it("cards that share a name word count as similar for MMR", () => {
    expect(similarity({ family: "a", kind: "object", name: "Manila File Folder" }, { family: "b", kind: "element", name: "Folder Tabs" })).toBe(1);
    expect(similarity({ family: "a", kind: "object", name: "Stickers" }, { family: "b", kind: "object", name: "Sticker Sheet" })).toBe(1.4);
    expect(similarity({ family: "a", kind: "object", name: "Punch Card" }, { family: "b", kind: "element", name: "Wax Seals" })).toBe(0);
  });
});

describe("Gulf cards in the fixture bend", () => {
  it("a brief with no Gulf market never draws a Gulf card; a Dubai brief never draws a Saudi one", async () => {
    const source = await fixtureSource();
    for (const wildness of [1, 3, 5] as const) {
      const global = (await bendBriefAtlas({ brief: "eSIM plan picker for travellers", wildness, count: 8 }, source))!;
      for (const d of global.directions) for (const id of d.cardIds ?? []) expect(["sadu-weaving", "talli-braid", "qatt-asiri"]).not.toContain(id);
      const dubai = await bendBriefAtlas({ brief: "eSIM plan picker for Dubai travellers", wildness, count: 8 }, source);
      for (const d of dubai?.directions ?? []) for (const id of d.cardIds ?? []) expect(["sadu-weaving", "qatt-asiri"]).not.toContain(id);
    }
  });
});

describe("search hints from J1 and J2", () => {
  it("an occasion topic gets the product back, and the theme domain's look words are dropped", () => {
    const h = searchHints({ brief: "Ramadan offers page for a Saudi food delivery app", domain: FOOD, theme: FAITH, page: OFFERS, topic: "food delivery", phase0Topic: "ramadan offers" });
    expect(h.searchTopic).toBe("ramadan food delivery");
    expect(h.avoidWords).toEqual(expect.arrayContaining(["prayer", "qibla", "adhan", "quran"]));
    // Words the main domain says (iftar, suhoor) and the occasion itself are never dropped.
    expect(h.avoidWords).not.toContain("iftar");
    expect(h.avoidWords).not.toContain("ramadan");
  });

  it("a surface noun of the domain (dashboard, chart) is dropped on another page, kept on its own", () => {
    const h = searchHints({ brief: "pricing page for a B2B analytics SaaS", domain: SAAS, theme: null, page: PRICING, topic: "analytics SaaS", phase0Topic: "analytics saas" });
    expect(h.searchTopic).toBeUndefined();
    expect(h.avoidWords).toEqual(expect.arrayContaining(["dashboard", "chart"]));
    const own = searchHints({ brief: "analytics dashboard", domain: SAAS, theme: null, page: page("analytics-dashboard", ["analytics dashboard"]), topic: "analytics", phase0Topic: "analytics dashboard" });
    expect(own.avoidWords ?? []).not.toContain("dashboard");
  });

  it("a brief whose topic already names the product gets no hints", () => {
    expect(searchHints({ brief: "coffee shop landing page", domain: COFFEE, theme: null, page: LANDING, topic: "coffee shop", phase0Topic: "coffee shop" })).toEqual({});
  });

  it("applySearchHints swaps the topic in every UI lane and adds the title filter", () => {
    const lanes = { idea: "x", topic: "ramadan offers", taste: "dark ramadan offers ui ios app", fidelity: "ramadan offers app ui", component: ["ramadan offers header app ui"], bridge: "x ui design", avoid: ["web"] };
    const out = applySearchHints(lanes, { searchTopic: "ramadan food delivery offers", avoidWords: ["prayer"] });
    expect(out.taste).toBe("dark ramadan food delivery offers ui ios app");
    expect(out.fidelity).toBe("ramadan food delivery offers app ui");
    expect(out.component).toEqual(["ramadan food delivery offers header app ui"]);
    expect(out.bridge).toBe("x ui design");
    expect(out.topic).toBe("ramadan food delivery offers");
    expect(out.avoid).toEqual(["web", "prayer"]);
    expect(applySearchHints(lanes, undefined)).toBe(lanes);
  });

  it("the search plan applies the hints a direction saved", async () => {
    const source = await fixtureSource();
    const base = { idea: "luggage tag", topic: "esim plan", fidelity: "esim plan app ui", platform: "mobile" as const };
    const plan = (await atlasSearchPlan(base, { cardIds: ["luggage-tag"], recipeIds: [], pageId: "plan-picker", searchTopic: "travel esim plan", avoidWords: ["dashboard"] }, source, { market: null, allowImage: () => true, withArt: false }))!;
    expect(plan.lanes.topic).toBe("travel esim plan");
    expect(plan.lanes.avoid).toContain("dashboard");
  });
});

describe("recipe guard (fix 5)", () => {
  it("a fidelity recipe with style words, or judged on too few results, keeps the Phase 0 wording", () => {
    expect(beatsPhase0({ query: "dark minimal coffee shop landing page website ui", precision: 0.875, judged: 8 }, "fidelity")).toBe(false);
    expect(beatsPhase0({ query: "real estate property listing website ui", precision: 0.875, judged: 8 }, "fidelity")).toBe(true);
    expect(beatsPhase0({ query: "real estate property listing website ui", precision: 0.875, judged: MIN_JUDGED - 1 }, "fidelity")).toBe(false);
    expect(beatsPhase0({ query: "flight checkout app ui", precision: 0.625, judged: 8 }, "fidelity")).toBe(false);
    // Style words are fine in a component recipe.
    expect(beatsPhase0({ query: "dark plan cards app ui", precision: 0.7, judged: 8 }, "component")).toBe(true);
  });

  it("the taste lane keeps the domain whole before it cuts the style", () => {
    expect(tasteQuery("coffee shop landing page", "dark mode")).toBe("dark coffee shop landing page ui design");
  });
});
