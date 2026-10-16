import { describe, expect, it } from "vitest";
import { contentWords, parseDomain, parsePage, parseTheme } from "@/lib/atlas/bend";
import { PHASE0_PRECISION, recipeHoldsTopic } from "@/lib/atlas/recipe-fit";
import { cc0Regions } from "@/lib/atlas/search";
import { cc0Shards, loaderSource, MAX_CC0_PARTS } from "@/lib/atlas/source";
import type { DomainEntry, PageAnatomy } from "@/lib/atlas/types";

// Gate 2 diagnosis (bench/GATE2-DIAGNOSIS.md): the domain and page parsing and the recipe rule.

const domain = (id: string, names: string[], productNouns: string[] = []): DomainEntry => ({
  id,
  names: { en: names, ar: [] },
  productNouns,
  audience: "",
  fitsFamilies: [],
  clashFamilies: [],
});
const page = (id: string, names: string[]): PageAnatomy => ({
  id,
  names: { en: names, ar: [] },
  platforms: ["mobile", "website"],
  sections: [],
  baseline: "",
  mustKeep: [],
  wildSpots: [],
  mobbinTerms: [],
  queryNouns: [],
});

// Trimmed from the J2 domains: the names and nouns that decided the Gate 2 briefs.
const DOMAINS = [
  domain("retail-banking", ["retail banking", "personal banking", "mobile banking"], ["balance", "IBAN"]),
  domain("fintech", ["fintech", "neobank", "digital bank", "mobile banking"], ["virtual card"]),
  domain("food-delivery", ["food delivery", "food ordering", "restaurant delivery"], ["order", "courier"]),
  domain("restaurants", ["restaurants and cafes", "dining", "coffee shops"], ["menu"]),
  domain("coffee", ["specialty coffee", "coffee shop", "coffee roaster"], ["single origin"]),
  domain("fitness", ["fitness and gyms", "gym app", "fitness tracker"], ["membership"]),
  domain("kids-learning", ["kids learning", "children's reading apps", "kids story apps"], ["storybook"]),
  domain("government", ["government services", "e-government", "public services"], ["national ID"]),
  domain("analytics-saas", ["B2B analytics", "business dashboards", "analytics SaaS"], ["dashboard", "KPI"]),
  domain("productivity", ["productivity", "notes", "task management"], ["note", "page", "task"]),
  domain("faith-lifestyle", ["faith lifestyle", "prayer times apps", "Ramadan planners"], ["iftar countdown"]),
];
const LANDING = page("landing-page", ["landing page", "marketing site"]);
const OFFERS = page("offers-page", ["seasonal offers page", "deals page"]);
const GOV = page("gov-services-dashboard", ["government services dashboard", "citizen portal"]);
const ONBOARDING = page("bank-onboarding", ["bank account opening", "banking onboarding"]);
const EMPTY = page("empty-state", ["empty state", "zero state"]);
const HOME = page("app-home", ["app home screen", "home tab"]);

describe("Gate 2 fix: domain parsing", () => {
  it("a page word in the brief never picks the domain (the old 'page' noun sent three briefs to notes apps)", () => {
    expect(parseDomain("coffee shop landing page", DOMAINS, LANDING)?.domain.id).toBe("coffee");
    expect(parseDomain("Ramadan offers page for a Saudi food delivery app", DOMAINS, OFFERS)?.domain.id).toBe("food-delivery");
    expect(parseDomain("pricing page for a B2B analytics SaaS", DOMAINS, page("pricing-page", ["pricing page"]))?.domain.id).toBe("analytics-saas");
    expect(parseDomain("government services dashboard for Qatar residents: renew ID, pay fines", DOMAINS, GOV)?.domain.id).toBe("government");
  });

  it("finds the domain from a single telling word (the three briefs that fell back to the word lists)", () => {
    expect(parseDomain("banking onboarding", DOMAINS, ONBOARDING)?.domain.id).toBe("retail-banking");
    expect(parseDomain("fitness app empty state", DOMAINS, EMPTY)?.domain.id).toBe("fitness");
    expect(parseDomain("kids reading app home screen", DOMAINS, HOME)?.domain.id).toBe("kids-learning");
  });

  it("a word shared by many domains, or a stop word, finds nothing", () => {
    const many = [domain("a", ["mobile apps"]), domain("b", ["mobile games"]), domain("c", ["mobile banking"]), domain("d", ["mobile maps"])];
    expect(parseDomain("mobile app", many)).toBeNull();
    expect(parseDomain("an app for the web", DOMAINS)).toBeNull();
  });

  it("keeps the product noun when the brief names one", () => {
    expect(parseDomain("virtual card screen for a neobank", DOMAINS)).toMatchObject({ domain: { id: "fintech" }, productNoun: "virtual card" });
  });

  it("a second domain the brief names is its theme; a product noun alone is not", () => {
    expect(parseTheme("Ramadan offers page for a Saudi food delivery app", DOMAINS, OFFERS)?.id).toBe("faith-lifestyle");
    expect(parseTheme("coffee shop landing page", DOMAINS, LANDING)?.id).not.toBe("productivity");
    expect(parseTheme("fitness app empty state", DOMAINS, EMPTY)).toBeNull();
  });

  it("content words drop stop words and plurals", () => {
    expect(contentWords("Coffee shops for the web")).toEqual(["coffee", "shop"]);
  });
});

describe("Gate 2 fix: nearest page", () => {
  it("an exact name still wins, then the page with the most shared words", () => {
    const pages = [ONBOARDING, EMPTY, page("plan-picker", ["data plan picker", "mobile data plans"])];
    expect(parsePage("banking onboarding", pages)?.id).toBe("bank-onboarding");
    expect(parsePage("bank account opening flow for students", pages)?.id).toBe("bank-onboarding");
    expect(parsePage("pick a data plan", pages)?.id).toBe("plan-picker");
    expect(parsePage("weather radar", pages)).toBeNull();
  });
});

describe("Gate 2 fix: CC0 regions split into parts", () => {
  it("reads a region's own shard or its numbered parts, in region order", () => {
    const names = ["europe_00", "europe_01", "gulf", "mena_00", "mena_01", "global_00", "mena-old", "menace"];
    expect(cc0Shards(names, ["gulf", "mena", "global"])).toEqual(["gulf", "mena_00", "mena_01", "global_00"]);
    expect(cc0Shards(names, ["persia"])).toEqual([]);
  });

  it("a Gulf brief reads the Gulf, then MENA, then untagged items; the source stops at MAX_CC0_PARTS shards", async () => {
    expect(cc0Regions("gulf")).toEqual(["gulf", "mena", "global"]);
    const rows = (n: string) => [{ id: n }];
    const read: string[] = [];
    const loader = {
      names: () => ["gulf", "mena_00", "mena_01", "global_00"],
      shard: async (_k: string, s: string) => (read.push(s), rows(s)),
    } as never;
    const items = await loaderSource(loader).cc0(cc0Regions("gulf"));
    expect(read).toEqual(["gulf", "mena_00", "mena_01"].slice(0, MAX_CC0_PARTS));
    expect(items).toHaveLength(Math.min(3, MAX_CC0_PARTS));
  });
});

describe("Gate 2 fix: recipes keep the brief's topic and beat Phase 0", () => {
  const coffee = recipeHoldsTopic({ productNoun: null, topic: "coffee shop", pageId: "landing-page" });

  it("a page-only recipe never replaces a lane that names the topic", () => {
    expect(coffee("dark minimal landing page website ui")).toBe(false);
    expect(coffee("coffee shop landing page website ui")).toBe(true);
    const gov = recipeHoldsTopic({ productNoun: null, topic: "government services", pageId: "gov-services-dashboard" });
    expect(gov("dark mode minimal gov services dashboard ui")).toBe(false);
    expect(gov("government services dashboard ui")).toBe(true);
  });

  it("with no topic beyond the page, a recipe that names the page passes", () => {
    const plain = recipeHoldsTopic({ productNoun: null, topic: "landing page", pageId: "landing-page" });
    expect(plain("dark minimal landing page website ui")).toBe(true);
    expect(plain("hero section ui")).toBe(false);
  });

  it("the product noun counts as the topic", () => {
    const esim = recipeHoldsTopic({ productNoun: "eSIM", topic: "", pageId: "plan-picker" });
    expect(esim("esim plan ui ios app")).toBe(true);
    expect(esim("plan picker app ui")).toBe(false);
  });

  it("thresholds are the Phase 0 bench precision of each lane", () => {
    expect(PHASE0_PRECISION.fidelity).toBeCloseTo(52 / 68, 2);
    expect(PHASE0_PRECISION.component).toBeCloseTo(16 / 27, 2);
  });
});
