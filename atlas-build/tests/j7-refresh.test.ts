/** P2-04 recipe refresh: which recipes are rejudged, how verdicts become precision, how results merge. */
import { describe, expect, it } from "vitest";
import { recipeId } from "../../banana-server/lib/atlas/loader.ts";
import job, { isFalling, mergeRefreshed, parseVerdicts, refreshTargets, rejudged, serperQuery, MAX_AGE_DAYS } from "../jobs/j7-refresh.ts";
import { QueryRecipeSchema, type QueryRecipe } from "../schema.ts";

const TODAY = new Date("2026-10-15T12:00:00Z");
const r = (query: string, at: string, precision = 0.75, page = "checkout"): QueryRecipe => ({
  key: { lane: "component", page, platform: "mobile", element: "total" },
  query,
  source: "dribbble",
  precision,
  judged: 8,
  at,
});

describe("refreshTargets", () => {
  it("picks recipes older than 90 days, oldest first", () => {
    const old = r("checkout total app ui", "2026-06-01");
    const fresh = r("checkout total card", "2026-10-01");
    const edge = r("checkout total sheet", new Date(TODAY.getTime() - (MAX_AGE_DAYS - 1) * 86_400_000).toISOString().slice(0, 10));
    const older = r("checkout total mobile", "2026-05-01");
    const t = refreshTargets([old, fresh, edge, older], [], TODAY);
    expect(t.map((x) => x.recipe.query)).toEqual(["checkout total mobile", "checkout total app ui"]);
    expect(t[0]!.reasons).toEqual(["age"]);
  });

  it("picks recipes whose feedback precision is falling, with enough recent ratings", () => {
    const rec = r("checkout total card", "2026-10-01", 0.75);
    const id = recipeId(rec);
    expect(isFalling(rec, { recipeId: id, recent: { great: 2, bad: 6 } })).toBe(true); // 0.25 against judged 0.75
    expect(isFalling(rec, { recipeId: id, recent: { great: 1, bad: 2 } })).toBe(false); // too few ratings
    expect(isFalling(rec, { recipeId: id, recent: { great: 5, bad: 3 }, before: { great: 6, bad: 4 } })).toBe(false); // 0.63 vs 0.6
    expect(isFalling(rec, { recipeId: id, recent: { great: 2, bad: 6 }, before: { great: 9, bad: 1 } })).toBe(true);
    expect(refreshTargets([rec], [{ recipeId: id, recent: { great: 2, bad: 6 } }], TODAY).map((x) => x.reasons)).toEqual([["falling"]]);
  });

  it("caps the run", () => {
    const many = Array.from({ length: 10 }, (_, i) => r(`checkout total ${i}`, "2026-01-01"));
    expect(refreshTargets(many, [], TODAY, 4)).toHaveLength(4);
  });
});

describe("judging", () => {
  it("reads one verdict per image and turns them into precision", () => {
    const v = parseVerdicts('```json\n{"verdicts": ["great", "good", "bad", "bad"]}\n```');
    expect(v).toEqual(["great", "good", "bad", "bad"]);
    const out = rejudged(r("q", "2026-01-01", 0.9), v, "2026-10-15");
    expect(out).toMatchObject({ precision: 0.5, judged: 4, at: "2026-10-15" });
    expect(QueryRecipeSchema.safeParse(out).success).toBe(true);
    expect(() => parseVerdicts('{"verdicts": ["meh"]}')).toThrow();
    expect(rejudged(r("q", "2026-01-01"), [], "2026-10-15").precision).toBe(0);
  });

  it("scopes the search to the recipe's source", () => {
    expect(serperQuery({ query: "checkout total", source: "dribbble" })).toBe("checkout total site:dribbble.com/shots");
    expect(serperQuery({ query: "checkout total", source: "nope" })).toBe("checkout total");
  });
});

describe("mergeRefreshed", () => {
  it("replaces rejudged recipes, drops weak ones when the key has a strong wording, logs keys with none", () => {
    const a = r("checkout total app ui", "2026-01-01", 0.8);
    const b = r("checkout total card", "2026-01-01", 0.7);
    const other = r("plan picker cards", "2026-01-01", 0.6, "plan-picker");
    const { recipes, dropped, weak } = mergeRefreshed([a, b, other], [{ ...a, precision: 0.25, at: "2026-10-15" }, { ...other, precision: 0.3, at: "2026-10-15" }]);
    expect(dropped).toEqual([recipeId(a)]);
    expect(recipes.map((x) => x.query).sort()).toEqual(["checkout total card", "plan picker cards"]);
    expect(recipes.find((x) => x.query === "plan picker cards")!.precision).toBe(0.3);
    expect(weak).toHaveLength(1);
  });
});

describe("the job definition", () => {
  it("follows the job interface", () => {
    expect(job.id).toBe("j7-refresh");
    expect(job.kind).toBe("recipes");
    expect(job.mode).toBe("batch");
    expect(job.requestId({ recipe: r("q", "2026-01-01"), id: "rc-abc", reasons: ["age"] }, 0)).toBe("refresh-rc-abc");
  });

  it("builds a dry prompt with no network: the recipe line and 8 placeholder images", async () => {
    const blocks = (await job.buildPrompt({ recipe: r("q", "2026-01-01"), id: "rc-abc", reasons: ["age"] }, { dry: true, fonts: () => ({}) as never, log: () => {} })) as { type: string }[];
    expect(blocks[0]!.type).toBe("text");
    expect(blocks.filter((b) => b.type === "image")).toHaveLength(8);
  });
});
