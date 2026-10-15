/**
 * Spend guard (plan 6.1): estimate a run before it is submitted, refuse it when the estimate plus
 * what the ledger already shows for the job (and its section 6.4 block, and all of atlas-build)
 * would pass the budget, and log the real usage of every response to costs.csv.
 *
 * The estimate is deliberately on the high side: text tokens are characters / 3 (English runs
 * about 4, Arabic and JSON lower), every image counts as 1,600 tokens (the most one image costs
 * after resizing), the cached system prefix is priced as a cache write on every request (no
 * credit for cache reads), and output is the job's expected output per request.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { BATCH_DISCOUNT, BLOCKS, BUDGETS, PRICES, TOTAL_CAP, budgetKey, type ModelId } from "../config.ts";

export const CHARS_PER_TOKEN = 3;
export const TOKENS_PER_IMAGE = 1600;

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** USD for one response's usage. */
export function usageCost(model: ModelId, usage: Usage, batch: boolean): number {
  const p = PRICES[model];
  const usd =
    (usage.input_tokens * p.input +
      (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
      usage.output_tokens * p.output) /
    1_000_000;
  return batch ? usd * BATCH_DISCOUNT : usd;
}

export function textTokens(s: string): number {
  return Math.ceil(s.length / CHARS_PER_TOKEN);
}

/** The parts of one request the estimate needs. */
export type RequestShape = { systemChars: number; userChars: number; images: number; outputTokens: number };

export type Estimate = { requests: number; inputTokens: number; outputTokens: number; usd: number };

export function estimateCost(model: ModelId, shapes: readonly RequestShape[], batch: boolean): Estimate {
  let systemTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const s of shapes) {
    systemTokens += Math.ceil(s.systemChars / CHARS_PER_TOKEN);
    inputTokens += Math.ceil(s.userChars / CHARS_PER_TOKEN) + s.images * TOKENS_PER_IMAGE;
    outputTokens += s.outputTokens;
  }
  const usd = usageCost(model, { input_tokens: inputTokens, cache_creation_input_tokens: systemTokens, output_tokens: outputTokens }, batch);
  return { requests: shapes.length, inputTokens: inputTokens + systemTokens, outputTokens, usd };
}

// ---------------------------------------------------------------------------------------------
// Ledger: costs.csv

export const LEDGER_HEADER = "time,job,request,model,mode,input_tokens,cache_write_tokens,cache_read_tokens,output_tokens,usd";

export type LedgerRow = {
  time: string;
  job: string;
  request: string;
  model: string;
  mode: "batch" | "direct";
  input_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
  output_tokens: number;
  usd: number;
};

export function logUsage(path: string, row: Omit<LedgerRow, "time"> & { time?: string }): void {
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, LEDGER_HEADER + "\n");
  }
  const r: LedgerRow = { time: row.time ?? new Date().toISOString(), ...row } as LedgerRow;
  const cells = [r.time, r.job, r.request, r.model, r.mode, r.input_tokens, r.cache_write_tokens, r.cache_read_tokens, r.output_tokens, r.usd.toFixed(6)];
  appendFileSync(path, cells.map((c) => String(c).replace(/[,\n]/g, " ")).join(",") + "\n");
}

export function readLedger(path: string): LedgerRow[] {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split(/\r?\n/).slice(1).filter(Boolean);
  return lines.map((line) => {
    const c = line.split(",");
    return {
      time: c[0] ?? "",
      job: c[1] ?? "",
      request: c[2] ?? "",
      model: c[3] ?? "",
      mode: (c[4] === "direct" ? "direct" : "batch") as LedgerRow["mode"],
      input_tokens: Number(c[5]),
      cache_write_tokens: Number(c[6]),
      cache_read_tokens: Number(c[7]),
      output_tokens: Number(c[8]),
      usd: Number(c[9]),
    };
  });
}

/** Spent so far, in USD, by budget key ("j3"), from ledger rows. */
export function spentByKey(rows: readonly LedgerRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = budgetKey(r.job);
    m.set(k, (m.get(k) ?? 0) + (Number.isFinite(r.usd) ? r.usd : 0));
  }
  return m;
}

export type GuardResult = { ok: true; lines: string[] } | { ok: false; lines: string[]; reason: string };

/**
 * Checks a run against the job budget, its block cap and the total cap. `budgets` and `blocks`
 * default to config.ts; tests pass their own.
 */
export function checkBudget(
  jobId: string,
  estimateUsd: number,
  ledger: readonly LedgerRow[],
  opts: { budgets?: Record<string, number>; blocks?: typeof BLOCKS; totalCap?: number } = {},
): GuardResult {
  const budgets = opts.budgets ?? BUDGETS;
  const blocks = opts.blocks ?? BLOCKS;
  const totalCap = opts.totalCap ?? TOTAL_CAP;
  const key = budgetKey(jobId);
  const budget = budgets[key];
  const spent = spentByKey(ledger);
  const fmt = (n: number) => `$${n.toFixed(4)}`;
  const lines: string[] = [];
  if (budget === undefined) return { ok: false, lines, reason: `no budget for "${key}" in config.ts BUDGETS` };

  const jobSpent = spent.get(key) ?? 0;
  lines.push(`job ${key}: spent ${fmt(jobSpent)} + estimate ${fmt(estimateUsd)} of budget ${fmt(budget)}`);
  if (jobSpent + estimateUsd > budget) return { ok: false, lines, reason: `over the ${key} budget of ${fmt(budget)}` };

  const block = blocks.find((b) => b.jobs.includes(key));
  if (block) {
    const blockSpent = block.jobs.reduce((s, j) => s + (spent.get(j) ?? 0), 0);
    lines.push(`block "${block.name}": spent ${fmt(blockSpent)} + estimate ${fmt(estimateUsd)} of cap ${fmt(block.cap)}`);
    if (blockSpent + estimateUsd > block.cap) return { ok: false, lines, reason: `over the "${block.name}" cap of ${fmt(block.cap)}` };
  }

  const total = [...spent.values()].reduce((s, n) => s + n, 0);
  lines.push(`all jobs: spent ${fmt(total)} + estimate ${fmt(estimateUsd)} of cap ${fmt(totalCap)}`);
  if (total + estimateUsd > totalCap) return { ok: false, lines, reason: `over the total cap of ${fmt(totalCap)}` };
  return { ok: true, lines };
}
