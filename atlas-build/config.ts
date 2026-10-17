/**
 * atlas-build settings: model ids, list prices, budgets and paths.
 *
 * Models were checked against GET /v1/models with the project key on 2026-10-15
 * (`npm run models` re-checks and writes data/models.json, including a 1 image test call).
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = dirname(fileURLToPath(import.meta.url));

export const OPUS = "claude-opus-5-5";
export const SONNET = "claude-sonnet-5-5";
export const HAIKU = "claude-haiku-5-5";
/** The model that judges images (J7, J9, J10). It must accept image input: `npm run models` checks. */
export const JUDGE = OPUS;

export type ModelId = typeof OPUS | typeof SONNET | typeof HAIKU;

/**
 * List prices in USD per million tokens (standard, not batch). Batch is 50% off everything.
 * Cache writes (5 minute TTL) cost 1.25x input; cache reads 0.05x on Opus 5.5 and 0.1x elsewhere.
 * Haiku 5.5 prices hold for prompts up to 100K tokens.
 */
export const PRICES: Record<ModelId, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  [OPUS]: { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  [SONNET]: { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  [HAIKU]: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
};
export const BATCH_DISCOUNT = 0.5;

/**
 * Job budgets in USD from docs/next-step-plan.md sections 6.3 and 6.4. The spend guard refuses a
 * run whose estimate plus what costs.csv already shows for the job is over its budget.
 * "example" is the tiny infra test job.
 */
export const BUDGETS: Record<string, number> = {
  example: 0.05,
  j1: 10,
  j2: 3,
  j3: 17,
  j4: 9,
  /** Gate 2 round 2: page fit (j4b-page-fit.ts), top 40 cards per domain on its pages. */
  j4b: 12,
  j5: 8,
  j6: 7,
  j7: 25,
  j8: 20,
  j9: 10,
  j10: 18,
  j11: 3,
  j12: 3,
  j13: 45,
  /** Owner 2026-10-17: refinement rounds with the rest of the D7 budget (cards and Gulf, styles and shaders, judge and fit). */
  r1: 15,
  r2: 22,
  r3: 14,
  /** Owner 2026-10-17: spend the rest of the quota refining. R1 to R3 left about $46 unspent; R5 checks the merged bend live, R6 crops and weak domains. */
  r5: 4,
  r6: 3,
  /** Unlocked only if R5 and R6 show good results (owner 2026-10-17). */
  r7: 4,
  /** R8: page mechanics for list rows, result cards, maps and forms (R6 finding); R5 and R6 left about $36 unspent. */
  r8: 30,
  /** R9: draft spec quality (second-card texture and motion lines, palette and density coherence), from R7's findings. */
  r9: 16,
};
/** Section 6.4 block caps: the guard also refuses when a block's total would pass its cap. */
export const BLOCKS: Array<{ name: string; jobs: string[]; cap: number }> = [
  { name: "Atlas v1 and search fix", jobs: ["j1", "j2", "j3", "j4", "j4b", "j5", "j6", "j7"], cap: 79 },
  { name: "Measure", jobs: ["j8", "j9", "j10", "j11", "j12"], cap: 54 },
  { name: "Stunning layer", jobs: ["j13"], cap: 45 },
  { name: "Refine", jobs: ["r1", "r2", "r3", "r5", "r6", "r7", "r8", "r9"], cap: 113 },
];
/** Hard ceiling on all Claude spend in atlas-build (D7: about $180, keep about $20 for reruns). */
/** Owner 2026-10-17: the cap may go to $200 when the refinement results are good; R7 gets the extra $20 only then. */
export const TOTAL_CAP = 200;

/** The budget key for a job id: "j3-cards" uses "j3". */
export function budgetKey(jobId: string): string {
  return jobId.split("-")[0]!.toLowerCase();
}

/** The main checkout's atlas-build folder (worktrees share its .env and spend ledger). */
export const MAIN_ATLAS = "C:\\Users\\Admin\\Documents\\GitHub\\Gobanana\\atlas-build";

/**
 * The spend ledger. One file for every checkout, so budgets hold across worktrees: ATLAS_COSTS
 * when set, else the main checkout's atlas-build/costs.csv when that folder exists, else local.
 */
function costsPath(): string {
  if (process.env.ATLAS_COSTS) return process.env.ATLAS_COSTS;
  if (existsSync(MAIN_ATLAS)) return join(MAIN_ATLAS, "costs.csv");
  return join(ROOT, "costs.csv");
}

export const PATHS = {
  out: join(ROOT, "out", "v1"),
  manifest: join(ROOT, "out", "v1", "manifest.json"),
  serverManifest: resolve(ROOT, "..", "banana-server", "lib", "atlas", "manifest.json"),
  rejects: join(ROOT, "rejects"),
  review: join(ROOT, "review"),
  raw: join(ROOT, "raw"),
  state: process.env.ATLAS_STATE ?? join(ROOT, "state"),
  costs: costsPath(),
  fonts: join(ROOT, "data", "google-fonts.json"),
  models: join(ROOT, "data", "models.json"),
};

/** Shards stay under this many bytes each (plan 6.1). */
export const SHARD_MAX_BYTES = 100 * 1024;
/** Share of records written to the review page. */
export const REVIEW_SHARE = 0.1;

/**
 * Loads ANTHROPIC_API_KEY (and SERPER_API_KEY) into process.env from atlas-build/.env, or from
 * the main checkout's atlas-build/.env when this is a worktree without one. Never prints values.
 */
export function loadEnv(): void {
  const candidates = [
    join(ROOT, ".env"),
    process.env.ATLAS_ENV_FILE,
    join(MAIN_ATLAS, ".env"),
  ].filter((p): p is string => typeof p === "string" && p.length > 0);
  for (const file of candidates) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      break;
    }
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Put it in atlas-build/.env (git-ignored).");
  }
}
