/**
 * 12-month retention for search ratings (`search_feedback`, personal data under PDPL: a user id
 * plus what they rated). Runs from the daily Cloudflare cron next to the reference purge
 * (custom-worker.ts). Relative imports only: wrangler bundles this file straight from the custom
 * worker entry, outside Next's alias setup.
 *
 * Arm stats are computed from these rows on read, so once a row is gone it no longer counts
 * anywhere. Blocked items (`blocked_items`) are a standing preference and stay until the user
 * deletes the account.
 */
import { sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

export const FEEDBACK_RETENTION_MONTHS = 12;

export interface FeedbackPurgeStore {
  /** Deletes up to `limit` ratings created before `cutoff`. Returns how many were deleted. */
  deleteBefore(cutoff: Date, limit: number): Promise<number>;
}

export type FeedbackPurgeResult = { deleted: number; batches: number; cutoff: Date; done: boolean };

/** Same day and time, 12 calendar months earlier (UTC). */
export function feedbackCutoff(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() - FEEDBACK_RETENTION_MONTHS);
  return d;
}

export async function purgeOldFeedback(
  store: FeedbackPurgeStore,
  opts: { now?: Date; batchSize?: number; maxBatches?: number } = {},
): Promise<FeedbackPurgeResult> {
  const cutoff = feedbackCutoff(opts.now ?? new Date());
  const batchSize = Math.max(1, Math.floor(opts.batchSize ?? 1000));
  const maxBatches = Math.max(1, Math.floor(opts.maxBatches ?? 50));
  let deleted = 0;
  let batches = 0;
  while (batches < maxBatches) {
    const n = await store.deleteBefore(cutoff, batchSize);
    batches++;
    deleted += n;
    if (n < batchSize) return { deleted, batches, cutoff, done: true };
  }
  return { deleted, batches, cutoff, done: false };
}

/** The batch delete statement. Exported so tests can check the SQL without a database. */
export function feedbackPurgeSql(cutoff: Date, limit: number) {
  return sql`
    delete from "search_feedback" where "id" in (
      select "id" from "search_feedback"
      where "created_at" < ${cutoff.toISOString()}
      order by "created_at"
      limit ${limit}
    )
    returning "id"`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any schema; only `execute` is used
export function createDbFeedbackPurgeStore(db: NeonHttpDatabase<any>): FeedbackPurgeStore {
  return {
    async deleteBefore(cutoff, limit) {
      const result = await db.execute(feedbackPurgeSql(cutoff, limit));
      return result.rows.length;
    },
  };
}
