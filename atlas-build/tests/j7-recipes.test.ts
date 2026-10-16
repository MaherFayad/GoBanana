/** P1-J7 query recipes: the wordings, the input order, the Serper query, the selection and the credit helpers. */
import { describe, expect, it } from "vitest";
import { recipeKeyString } from "../../banana-server/lib/atlas/loader.ts";
import { CUSTOM_ID } from "../lib/job.ts";
import { estimateCost, TOKENS_PER_IMAGE } from "../lib/guard.ts";
import { DEFAULT_SERPER_FLOOR, SERPER_FLOOR, creditRoom, envValue, floorFrom } from "../lib/serper.ts";
import { QueryRecipeSchema, type QueryRecipe } from "../schema.ts";
import { ART_NEG, MAX_WORDS, SHOWCASE_RECIPE_STYLES, UI_NEG, artWordings, buildInputs, pagePhrases, pageWordings, requestIdOf, searchQueryFor, selectBest, showcaseWordings, type Input } from "../jobs/j7-recipes.ts";

const page = (id: string, platforms: Array<"mobile" | "tablet" | "website" | "webapp">, en: string[] = [id.replace(/-/g, " ")], nouns: string[] = []) => ({
  id,
  names: { en, ar: [] },
  platforms,
  queryNouns: nouns,
});
const card = (id: string, artQueries: string[]) => ({ id, name: id, texture: "grain", imagery: "stone", artQueries });
const rec = (query: string, precision: number, page = "paywall", judged = 8): QueryRecipe => ({
  key: { lane: "baseline", page, platform: "mobile" },
  query,
  source: "pinterest",
  precision,
  judged,
  at: "2026-10-16",
});

describe("page wordings", () => {
  it("builds phrases from the page id, with a longer synonym when there is one", () => {
    expect(pagePhrases(page("onboarding", ["mobile"], ["onboarding"], ["onboarding screen", "welcome slide"]))).toEqual({ p0: "onboarding", p1: "onboarding screen" });
    expect(pagePhrases(page("empty-state", ["mobile"], ["empty state"], ["no results page"]))).toEqual({ p0: "empty state", p1: "empty state" });
  });

  it("gives 6 distinct wordings per platform, each with the page words, at most 7 words", () => {
    for (const platform of ["mobile", "tablet", "webapp", "website"] as const) {
      const p = page("plan-picker", [platform], ["plan picker"], ["plan picker screen"]);
      const ws = pageWordings(p, platform);
      expect(ws).toHaveLength(6);
      expect(new Set(ws.map((w) => `${w.source}|${w.query}`)).size).toBe(6);
      for (const w of ws) {
        expect(w.query).toContain("plan picker");
        expect(w.query.split(/\s+/).length).toBeLessThanOrEqual(MAX_WORDS);
        expect(w.query).not.toMatch(/2025|product design|saas|single screen/);
      }
    }
  });

  it("leads mobile with the Pinterest dark series wording and web apps with Dribbble dark minimal", () => {
    expect(pageWordings(page("paywall", ["mobile"]), "mobile")[0]).toEqual({ source: "pinterest", query: "dark paywall ui ios app" });
    expect(pageWordings(page("analytics-dashboard", ["webapp"]), "webapp")[0]).toEqual({ source: "dribbble", query: "dark mode minimal analytics dashboard ui" });
  });
});

describe("art wordings", () => {
  it("takes the card's own queries in order, 3 at most, no repeats", () => {
    expect(artWordings(card("c", ["limestone texture", "Limestone  texture", "quarry wall", "stone mason", "fourth"]))).toEqual([
      { query: "limestone texture", source: "pinterest" },
      { query: "quarry wall", source: "behance" },
      { query: "stone mason", source: "pinterest" },
    ]);
    expect(artWordings(card("c", ["only one"]))).toHaveLength(1);
  });
});

describe("inputs", () => {
  const pages = [page("a-page", ["mobile", "webapp"]), page("b-bench", ["mobile"]), page("c-wild", ["tablet"])];
  const meta = [{ id: "a-page", from: "common" }, { id: "b-bench", from: "bench" }, { id: "c-wild", from: "wild-spots" }];
  const inputs = buildInputs(pages, meta, [card("k1", ["x one", "x two", "x three"]), card("k2", ["y one", "y two", "y three"])]);

  it("counts 6 per pair and 3 per card", () => {
    expect(inputs.filter((i) => i.kind === "page")).toHaveLength(6 * 4);
    expect(inputs.filter((i) => i.kind === "art")).toHaveLength(6);
  });

  it("orders by value: bench pages, wild spots, other pages, then art; a key's wordings stay together", () => {
    const keys = inputs.map((i) => recipeKeyString(i.key));
    expect(keys[0]).toBe("baseline|b-bench|mobile|-|-");
    expect(inputs.slice(0, 6).every((i) => i.priority === 0)).toBe(true);
    expect(inputs.slice(6, 12).every((i) => i.key.page === "c-wild")).toBe(true);
    expect(inputs.slice(12, 24).every((i) => i.key.page === "a-page")).toBe(true);
    expect(inputs.slice(24).every((i) => i.kind === "art")).toBe(true);
    // contiguous keys
    const seen = new Set<string>();
    let prev = "";
    for (const k of keys) {
      if (k !== prev) {
        expect(seen.has(k)).toBe(false);
        seen.add(k);
        prev = k;
      }
    }
  });

  it("gives every wording a unique, valid request id that does not change", () => {
    const ids = inputs.map(requestIdOf);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(CUSTOM_ID);
    expect(requestIdOf(inputs[0]!)).toBe(ids[0]);
  });

  it("builds recipes that pass the schema", () => {
    for (const i of inputs) {
      const r = { key: i.key, query: i.wording.query, source: i.wording.source, precision: 0.5, judged: 8, at: "2026-10-16" };
      expect(QueryRecipeSchema.safeParse(r).success).toBe(true);
    }
  });
});

describe("serper query", () => {
  const input = (lane: "baseline" | "art", source: string, query: string): Pick<Input, "key" | "wording"> => ({ key: { lane }, wording: { source, query } });
  it("adds the server's negatives on core and art searches, and the source scope", () => {
    expect(searchQueryFor(input("baseline", "pinterest", "dark paywall ui ios app"))).toBe(`dark paywall ui ios app ${UI_NEG} site:pinterest.com/pin`);
    expect(searchQueryFor(input("baseline", "awwwards", "paywall"))).toBe("paywall site:awwwards.com/sites");
    expect(searchQueryFor(input("art", "behance", "limestone texture"))).toBe(`limestone texture ${ART_NEG} site:behance.net/gallery`);
  });
});

describe("selectBest", () => {
  it("keeps the best 2 per key at 0.5 or more, ties by great verdicts, and lists keys with none", () => {
    const ranked = [
      { recipe: rec("a", 0.875), great: 2 },
      { recipe: rec("b", 0.875), great: 5 },
      { recipe: rec("c", 0.75), great: 6 },
      { recipe: rec("d", 0.4), great: 0 },
      { recipe: rec("e", 0.375, "weak-page"), great: 0 },
      { recipe: rec("f", 0.5, "edge-page"), great: 1 },
    ];
    const { recipes, weak } = selectBest(ranked);
    expect(recipes.filter((r) => r.key.page === "paywall").map((r) => r.query)).toEqual(["b", "a"]);
    expect(recipes.filter((r) => r.key.page === "edge-page").map((r) => r.query)).toEqual(["f"]);
    expect(recipes.some((r) => r.key.page === "weak-page")).toBe(false);
    expect(weak).toEqual(["baseline|weak-page|mobile|-|-"]);
  });
});

describe("serper floor override", () => {
  it("reads SERPER_FLOOR, else 2,500", () => {
    expect(floorFrom(undefined)).toBe(DEFAULT_SERPER_FLOOR);
    expect(floorFrom("300")).toBe(300);
    expect(floorFrom("0")).toBe(0);
    expect(floorFrom("abc")).toBe(2500);
    expect(floorFrom("-5")).toBe(2500);
    expect(creditRoom(2500, floorFrom("300"))).toBe(2200);
  });
});

describe("serper helpers", () => {
  it("reads one value from dotenv text without touching the others", () => {
    const text = "# note\nOTHER=1\nSERPER_API_KEY=\"abc123\"\nexport X=y\n";
    expect(envValue(text, "SERPER_API_KEY")).toBe("abc123");
    expect(envValue(text, "MISSING")).toBeUndefined();
  });

  it("leaves the product's 2,500 credits alone", () => {
    expect(creditRoom(169)).toBe(0);
    expect(creditRoom(2500)).toBe(0);
    expect(creditRoom(6692)).toBe(6692 - SERPER_FLOOR);
  });
});

describe("estimate with measured image tokens", () => {
  it("prices images at the job's own token count, 1,600 by default", () => {
    const base = { systemChars: 0, userChars: 0, images: 8, outputTokens: 0 };
    const worst = estimateCost("claude-opus-5-5", [base], true);
    const measured = estimateCost("claude-opus-5-5", [{ ...base, imageTokens: 200 }], true);
    expect(worst.inputTokens).toBe(8 * TOKENS_PER_IMAGE);
    expect(measured.inputTokens).toBe(8 * 200);
  });
});

describe("web showcase wordings (2026-10-16)", () => {
  const pages = [page("pricing", ["website", "webapp"]), page("paywall", ["mobile"]), page("hero", ["website"])];
  const meta = [{ id: "paywall", from: "bench" }];
  const cards = [card("k1", ["x one", "x two", "x three"])];
  const inputs = buildInputs(pages, meta, cards);
  const plain = inputs.filter((i) => !i.key.style);

  it("adds 3 wordings per showcase style for website pages only, after every older input", () => {
    const show = inputs.filter((i) => i.key.style);
    expect(show).toHaveLength(2 * SHOWCASE_RECIPE_STYLES.length * 3);
    expect(show.every((i) => i.key.platform === "website" && i.key.lane === "baseline" && i.priority === 4)).toBe(true);
    expect(show.some((i) => i.key.page === "paywall")).toBe(false);
    // Older inputs keep their positions (chunked runs resume by offset).
    expect(inputs.slice(0, plain.length)).toEqual(plain);
    expect(inputs.slice(plain.length).every((i) => i.key.style)).toBe(true);
  });

  it("words them for Awwwards and Dribbble, never Craftwork, within the word cap", () => {
    expect(showcaseWordings("pricing page", "playful")).toEqual([
      { source: "awwwards", query: "playful pricing page" },
      { source: "awwwards", query: "playful pricing page website" },
      { source: "dribbble", query: "playful pricing page website ui" },
    ]);
    expect(showcaseWordings("x", "nope")).toEqual([]);
    for (const i of inputs.filter((i) => i.key.style)) {
      expect(i.wording.source).not.toBe("craftwork");
      expect(i.wording.query.split(/\s+/).length).toBeLessThanOrEqual(MAX_WORDS);
    }
    expect(searchQueryFor({ key: { lane: "baseline", page: "pricing", platform: "website", style: "3d" }, wording: { source: "awwwards", query: "3d pricing" } })).toBe("3d pricing site:awwwards.com/sites");
  });

  it("keys a style apart from the page's plain baseline key, and older keys do not change", () => {
    expect(recipeKeyString({ lane: "baseline", page: "pricing", platform: "website" })).toBe("baseline|pricing|website|-|-");
    expect(recipeKeyString({ lane: "baseline", page: "pricing", platform: "website", style: "3d" })).toBe("baseline|pricing|website|-|-|3d");
    const ids = inputs.map(requestIdOf);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("passes the schema with a style, and refuses an unknown style", () => {
    const r = { key: { lane: "baseline", page: "pricing", platform: "website", style: "playful" }, query: "playful pricing", source: "awwwards", precision: 0.5, judged: 8, at: "2026-10-16" };
    expect(QueryRecipeSchema.safeParse(r).success).toBe(true);
    expect(QueryRecipeSchema.safeParse({ ...r, key: { ...r.key, style: "spooky" } }).success).toBe(false);
  });
});
