/**
 * Gate 2 round 2: the J4b page fit job (cards, pages, reply parsing, budget, server layout) and the
 * J7 topic slot.
 */
import { describe, expect, it } from "vitest";
import { recipeKeyString } from "../../banana-server/lib/atlas/loader.ts";
import { TOPIC_SLOT } from "../../banana-server/lib/atlas/recipe-fit.ts";
import { BLOCKS, BUDGETS, budgetKey } from "../config.ts";
import job, { CORE_PAGES, domainPages, MAX_PAGES, topCards, TOP_CARDS, type Input } from "../jobs/j4b-page-fit.ts";
import { withTopicSlot } from "../jobs/j7-recipes.ts";
import { serverLayout } from "../lib/layout.ts";
import { PageFitScoreSchema, type DomainEntry, type FitScore, type IngredientCard, type PageAnatomy, type QueryRecipe } from "../schema.ts";

const card = (id: string, kind: IngredientCard["kind"] = "object", family = "printed card"): IngredientCard => ({ id, kind, family }) as IngredientCard;
const domain = (id: string, names: string[], productNouns: string[] = []): DomainEntry => ({ id, names: { en: names, ar: [] }, productNouns, audience: "People.", fitsFamilies: [], clashFamilies: [] });
const page = (id: string, names: string[]): PageAnatomy => ({ id, names: { en: names, ar: [] }, platforms: ["mobile"], sections: [], baseline: "A page.", mustKeep: [], wildSpots: [], mobbinTerms: [], queryNouns: [] }) as unknown as PageAnatomy;

describe("J4b page fit: inputs", () => {
  it("topCards: the domain's best fits that may lead, rule and layout cards left out, at most TOP_CARDS", () => {
    const cards = new Map(
      [card("a"), card("b"), card("rule", "constraint", "layout rule"), card("bar", "element", "controls and UI bits"), card("low"), ...Array.from({ length: 50 }, (_, i) => card(`x${i}`))].map((c) => [c.id, c]),
    );
    const fit: FitScore[] = [
      { cardId: "a", domainId: "d", score: 3, reason: "r" },
      { cardId: "b", domainId: "d", score: 2, reason: "r" },
      { cardId: "rule", domainId: "d", score: 3, reason: "r" },
      { cardId: "bar", domainId: "d", score: 3, reason: "r" },
      { cardId: "low", domainId: "d", score: 1, reason: "r" },
      { cardId: "a", domainId: "other", score: 3, reason: "r" },
    ];
    expect(topCards(fit, cards, "d").map((c) => c.id)).toEqual(["a", "b"]);
    const many: FitScore[] = Array.from({ length: 50 }, (_, i) => ({ cardId: `x${i}`, domainId: "d", score: 2, reason: "r" }));
    const top = topCards(many, cards, "d");
    expect(top).toHaveLength(TOP_CARDS);
    expect(topCards(many, cards, "d").map((c) => c.id)).toEqual(top.map((c) => c.id));
  });

  it("domainPages: Bench brief pages first, then pages named like the domain, then core pages, at most MAX_PAGES", () => {
    const pages = [page("flight-checkout", ["flight checkout"]), page("boarding-pass", ["boarding pass"]), page("plan-picker", ["plan picker"]), ...CORE_PAGES.map((id) => page(id, [id.replace(/-/g, " ")]))];
    const travel = domain("travel", ["flights and travel", "airline booking"], ["flight", "boarding pass"]);
    const out = domainPages(travel, pages, [travel], [{ brief: "eSIM plan picker for a travel app", pages: ["plan-picker"] }]);
    expect(out[0]).toBe("plan-picker");
    expect(out[1]).toBe("flight-checkout");
    // Product nouns ("boarding pass") never pull a page in: only the domain's names do.
    expect(out).not.toContain("boarding-pass");
    expect(out.length).toBeLessThanOrEqual(MAX_PAGES);
    expect(new Set(out).size).toBe(out.length);
  });
});

describe("J4b page fit: replies and records", () => {
  const input: Input = { domain: domain("coffee", ["coffee shop"]), cards: [card("cupping-card"), card("surfboard")], pages: ["landing-page", "checkout"] };

  it("expands the compact reply: [score, reason] for 2 and 3, a bare number for 0 and 1", () => {
    const text = '```json\n{"cards": [{"n": 1, "p": {"1": [3, "cupping notes as the menu"], "2": 1}}, {"n": 2, "p": {"1": 0, "2": [2, "wave lines on steps"]}}, {"n": 9, "p": {"1": 3}}]}\n```';
    const out = job.parse!(text, input) as Array<Record<string, unknown>>;
    expect(out).toEqual([
      { cardId: "cupping-card", domainId: "coffee", pageId: "landing-page", score: 3, reason: "cupping notes as the menu" },
      { cardId: "cupping-card", domainId: "coffee", pageId: "checkout", score: 1 },
      { cardId: "surfboard", domainId: "coffee", pageId: "landing-page", score: 0 },
      { cardId: "surfboard", domainId: "coffee", pageId: "checkout", score: 2, reason: "wave lines on steps" },
    ]);
    for (const r of out) expect(PageFitScoreSchema.safeParse(r).success).toBe(true);
  });

  it("a 3 needs a reason; a reason is at most 10 words", () => {
    expect(job.check!({ cardId: "a", domainId: "d", pageId: "p", score: 3 }, {} as never)).toHaveLength(1);
    expect(job.check!({ cardId: "a", domainId: "d", pageId: "p", score: 2 }, {} as never)).toEqual([]);
    expect(PageFitScoreSchema.safeParse({ cardId: "a", domainId: "d", pageId: "p", score: 3, reason: "one two three four five six seven eight nine ten eleven" }).success).toBe(false);
  });

  it("has its own budget of $12 in the Atlas block, and lays out one server shard per domain", () => {
    expect(budgetKey(job.id)).toBe("j4b");
    expect(BUDGETS.j4b).toBe(12);
    expect(BLOCKS.find((b) => b.jobs.includes("j4"))!.jobs).toContain("j4b");
    const rows = [
      { cardId: "a", domainId: "coffee", pageId: "landing-page", score: 3, reason: "cupping notes as the menu" },
      { cardId: "a", domainId: "travel", pageId: "flight-checkout", score: 1 },
    ];
    const layout = serverLayout(new Map([["page-fit", rows]]));
    expect(layout.manifest.shards.map((s) => `${s.kind}/${s.shard}`).sort()).toEqual(["page-fit/coffee", "page-fit/travel"]);
    expect(layout.skipped).toEqual([]);
  });
});

describe("J7 topic slot", () => {
  const pages = new Map([["pricing-page", { id: "pricing-page", names: { en: ["pricing page", "plans and pricing"], ar: [] }, queryNouns: ["pricing page"], platforms: ["website"] } as never]]);
  const rec = (query: string, key: QueryRecipe["key"]): QueryRecipe => ({ key, query, source: "dribbble", precision: 0.88, judged: 8, at: "2026-10-16" });

  it("page recipes become templates; the key, source and precision stay", () => {
    const r = rec("dark minimal pricing page website ui", { lane: "baseline", page: "pricing-page", platform: "website" });
    const t = withTopicSlot(r, pages);
    expect(t.query).toBe(`dark minimal ${TOPIC_SLOT} pricing page website ui`);
    expect(recipeKeyString(t.key)).toBe(recipeKeyString(r.key));
    expect(t.precision).toBe(r.precision);
    expect(withTopicSlot(rec("pricing page", { lane: "baseline", page: "pricing-page", platform: "website" }), pages).query).toBe(`${TOPIC_SLOT} pricing page`);
  });

  it("gallery recipes keep their page-only wording (a gallery's own search finds little for a topic phrase)", () => {
    const r = { ...rec("pricing page", { lane: "baseline", page: "pricing-page", platform: "website" }), source: "awwwards" };
    expect(withTopicSlot(r, pages)).toEqual(r);
  });

  it("art, genre and page-less recipes are unchanged", () => {
    for (const r of [rec("brass dallah", { lane: "art", cardId: "dallah" }), rec("pitch deck slides", { lane: "deck", page: "pitch" }), rec("big header app ui", { lane: "component", platform: "mobile", element: "header" })]) {
      expect(withTopicSlot(r, pages)).toEqual(r);
    }
  });
});
