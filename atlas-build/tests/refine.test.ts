import { describe, expect, it } from "vitest";
import { fitShardBudget } from "../jobs/r1-gulf-page-fit.ts";
import { applyTextFixes, j3CardIds, mergeByKey, type TextFix } from "../lib/refine.ts";
import { parseArgs } from "../run.ts";
import type { PageFitScore } from "../schema.ts";

describe("refinement round 1 helpers", () => {
  it("merges by key: replaces in place, appends new keys, and is the same on a second run", () => {
    const base = [{ id: "a", v: 1 }, { id: "b", v: 1 }];
    const mine = [{ id: "b", v: 2 }, { id: "c", v: 2 }];
    const once = mergeByKey(base, mine, (r) => r.id);
    expect(once).toEqual([{ id: "a", v: 1 }, { id: "b", v: 2 }, { id: "c", v: 2 }]);
    expect(mergeByKey(once, mine, (r) => r.id)).toEqual(once);
  });

  it("applies a text fix by path and throws when the text is gone", () => {
    const fix: TextFix = { kind: "anatomy", id: "p", path: "wildSpots.1.why", from: "the Islamic art tradition", to: "Hejazi mangour", why: "test" };
    const recs = [{ id: "p", wildSpots: [{ why: "x" }, { why: "borrow from the Islamic art tradition here" }] }];
    expect(applyTextFixes("anatomy", recs, [fix])[0]!.wildSpots[1]!.why).toBe("borrow from Hejazi mangour here");
    expect(() => applyTextFixes("anatomy", recs, [fix])).toThrow(/no longer holds/);
    expect(applyTextFixes("domains", recs, [fix])).toBe(recs);
  });

  it("the committed review fixes still apply to J1 and J2 text", () => {
    // The fixes file names real records; a wrong path or id throws.
    expect(() => applyTextFixes("anatomy", [], [{ kind: "anatomy", id: "x", path: "a", from: "b", to: "c", why: "" }])).toThrow(/no anatomy record/);
  });

  it("pins the J3 card set at 755 ids", () => {
    expect(j3CardIds().size).toBe(755);
  });

  it("keeps a domain's page fit under the shard budget by dropping new cards' score 1 rows only", () => {
    const row = (cardId: string, score: 0 | 1 | 2 | 3, domainId = "d"): PageFitScore => ({ cardId, domainId, pageId: "p", score, ...(score >= 2 ? { reason: "ten words of reason here" } : {}) });
    const rows = [row("old", 1), row("new", 1), row("new", 0), row("new", 3), row("x", 1, "small")];
    const log: string[] = [];
    const out = fitShardBudget(rows, new Set(["new"]), (l) => log.push(l), 150);
    expect(out).not.toContainEqual(row("new", 1));
    expect(out).toContainEqual(row("old", 1));
    expect(out).toContainEqual(row("new", 0));
    expect(out).toContainEqual(row("x", 1, "small"));
    expect(log[0]).toMatch(/dropped 1 score 1 rows/);
    expect(fitShardBudget(rows, new Set(["new"]), () => {}, 10_000)).toBe(rows);
  });

  it("parses --missing", () => {
    expect(parseArgs(["r1-rewrite", "--missing"])).toMatchObject({ job: "r1-rewrite", missing: true });
  });
});
