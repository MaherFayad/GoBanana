import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HAIKU, OPUS, budgetKey } from "../config.ts";
import { checkBudget, estimateCost, logUsage, readLedger, spentByKey, usageCost, type LedgerRow } from "../lib/guard.ts";

const row = (job: string, usd: number): LedgerRow => ({
  time: "t",
  job,
  request: "r",
  model: OPUS,
  mode: "batch",
  input_tokens: 0,
  cache_write_tokens: 0,
  cache_read_tokens: 0,
  output_tokens: 0,
  usd,
});

describe("usageCost", () => {
  it("prices input, cache write, cache read and output, and halves batch", () => {
    const u = { input_tokens: 1_000_000, cache_creation_input_tokens: 1_000_000, cache_read_input_tokens: 1_000_000, output_tokens: 1_000_000 };
    expect(usageCost(OPUS, u, false)).toBeCloseTo(4 + 5 + 0.2 + 20);
    expect(usageCost(OPUS, u, true)).toBeCloseTo((4 + 5 + 0.2 + 20) / 2);
    expect(usageCost(HAIKU, { input_tokens: 1_000_000, output_tokens: 0 }, false)).toBeCloseTo(0.1);
  });
});

describe("estimateCost", () => {
  it("counts text by characters / 3, images as 1600, the system as a cache write", () => {
    const e = estimateCost(OPUS, [{ systemChars: 3000, userChars: 300, images: 2, outputTokens: 500 }], false);
    expect(e.inputTokens).toBe(1000 + 100 + 3200);
    expect(e.outputTokens).toBe(500);
    expect(e.usd).toBeCloseTo((1000 * 5 + 3300 * 4 + 500 * 20) / 1e6);
  });
});

describe("checkBudget", () => {
  const budgets = { j1: 10, j2: 3 };
  const blocks = [{ name: "B", jobs: ["j1", "j2"], cap: 12 }];

  it("passes a run inside the job budget", () => {
    const r = checkBudget("j1-anatomy", 4, [row("j1-anatomy", 5)], { budgets, blocks, totalCap: 100 });
    expect(r.ok).toBe(true);
  });

  it("refuses when spent plus the estimate passes the job budget", () => {
    const r = checkBudget("j1-anatomy", 6, [row("j1-anatomy", 5)], { budgets, blocks, totalCap: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/j1 budget/);
  });

  it("refuses when the block cap would pass even inside the job budget", () => {
    const r = checkBudget("j1-x", 2, [row("j2-domains", 3), row("j1-x", 8)], { budgets, blocks, totalCap: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/"B" cap/);
  });

  it("refuses over the total cap and refuses jobs with no budget", () => {
    const total = checkBudget("j2", 1, [row("other", 50)], { budgets, blocks, totalCap: 50.5 });
    expect(total.ok).toBe(false);
    expect(checkBudget("j99", 0.01, [], { budgets, blocks }).ok).toBe(false);
  });

  it("uses the part before the first hyphen as the budget key", () => {
    expect(budgetKey("J3-cards-v2")).toBe("j3");
    expect(spentByKey([row("j3-a", 1), row("j3-b", 2), row("j4", 1)]).get("j3")).toBe(3);
  });
});

describe("ledger", () => {
  it("writes a header once and reads rows back", () => {
    const path = join(mkdtempSync(join(tmpdir(), "atlas-")), "costs.csv");
    logUsage(path, { job: "j1", request: "a,b", model: OPUS, mode: "batch", input_tokens: 10, cache_write_tokens: 2, cache_read_tokens: 3, output_tokens: 4, usd: 0.5 });
    logUsage(path, { job: "j1", request: "c", model: OPUS, mode: "direct", input_tokens: 1, cache_write_tokens: 0, cache_read_tokens: 0, output_tokens: 1, usd: 0.25 });
    expect(readFileSync(path, "utf8").split("\n")[0]).toMatch(/^time,job,request/);
    const rows = readLedger(path);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.request).toBe("a b");
    expect(rows[1]!.mode).toBe("direct");
    expect(spentByKey(rows).get("j1")).toBeCloseTo(0.75);
  });
});
