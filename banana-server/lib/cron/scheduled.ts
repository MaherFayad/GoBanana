/**
 * What each Cloudflare cron trigger runs (wrangler.jsonc `triggers.crons`), kept out of
 * custom-worker.ts so Vitest can cover it with a fake database. Relative imports only.
 *
 *   17 3 * * *  purge: unplaced references (30 days) and search ratings (12 months)
 *   37 3 * * *  weights: search_feedback to atlas_weights (P2-01)
 */
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { createDbWeightsStore, runNightlyWeights } from "../learning/nightly";
import { createDbFeedbackPurgeStore, purgeOldFeedback } from "../purge/feedback";
import { createDbPurgeStore, purgeUnplacedReferences } from "../purge/references";

export const PURGE_CRON = "17 3 * * *";
export const WEIGHTS_CRON = "37 3 * * *";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any schema
export type CronDb = NeonHttpDatabase<any>;
export type CronEnv = { DATABASE_URL?: string };
export type CronJob = { name: string; run(): Promise<void> };

/** Jobs a trigger runs. An unknown expression (a manual `wrangler dev --test-scheduled`) runs the purges. */
export function jobsFor(cron: string | undefined, db: CronDb): CronJob[] {
  if (cron === WEIGHTS_CRON) {
    return [
      {
        name: "weights",
        async run() {
          const r = await runNightlyWeights(createDbWeightsStore(db));
          console.info(`[weights] written: ${r.written} (${r.ingredients} ingredients, ${r.arms} arms)`);
        },
      },
    ];
  }
  return [
    {
      name: "purge",
      async run() {
        const r = await purgeUnplacedReferences(createDbPurgeStore(db));
        console.info(`[purge] references deleted: ${r.deleted} in ${r.batches} batches${r.done ? "" : " (more left)"}`);
      },
    },
    {
      // Separate so one failing purge never stops the other.
      name: "ratings purge",
      async run() {
        const r = await purgeOldFeedback(createDbFeedbackPurgeStore(db));
        console.info(`[purge] ratings deleted: ${r.deleted} in ${r.batches} batches${r.done ? "" : " (more left)"}`);
      },
    },
  ];
}

/**
 * The `scheduled` handler body. Every job runs under ctx.waitUntil and logs only its name and the
 * error class, never a message (it could carry a connection string).
 */
export function handleScheduled(
  controller: { cron?: string },
  env: CronEnv,
  ctx: { waitUntil(p: Promise<unknown>): void },
  makeDb: (url: string) => CronDb = (url) => drizzle({ client: neon(url) }),
): void {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    console.warn("[cron] DATABASE_URL is not set; skipped");
    return;
  }
  for (const job of jobsFor(controller.cron, makeDb(url))) {
    ctx.waitUntil(
      job.run().catch((err: unknown) => {
        console.error(`[cron] ${job.name} failed: ${err instanceof Error ? err.name : "Error"}`);
      }),
    );
  }
}
