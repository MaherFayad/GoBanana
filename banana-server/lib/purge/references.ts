/**
 * 30-day purge of unplaced references (spec section 11). Runs from the daily Cloudflare
 * cron (custom-worker.ts). Relative imports only: wrangler bundles this file straight
 * from the custom worker entry, outside Next's alias setup.
 *
 * "Placed" means a node on the reference's own canvas shows it. Canvas nodes do not
 * carry the reference row id (they copy its URLs), so a reference is placed when
 * `canvases.state -> 'nodes'` contains a node whose `data.imageUrl` equals the row's
 * `image_url`. That is one jsonb containment check against one canvas per row,
 * driven by the `references_created_at_idx` index, in batches.
 */
import { sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

export const PURGE_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PurgeStore {
  /** Deletes up to `limit` unplaced references created before `cutoff`. Returns how many were deleted. */
  deleteUnplacedBefore(cutoff: Date, limit: number): Promise<number>;
}

export type PurgeOptions = {
  now?: Date;
  batchSize?: number;
  /** Stops after this many batches so one run stays inside the Worker's time limit; the next run continues. */
  maxBatches?: number;
};

export type PurgeResult = { deleted: number; batches: number; cutoff: Date; done: boolean };

export function purgeCutoff(now: Date): Date {
  return new Date(now.getTime() - PURGE_AFTER_DAYS * DAY_MS);
}

export async function purgeUnplacedReferences(store: PurgeStore, opts: PurgeOptions = {}): Promise<PurgeResult> {
  const cutoff = purgeCutoff(opts.now ?? new Date());
  const batchSize = Math.max(1, Math.floor(opts.batchSize ?? 500));
  const maxBatches = Math.max(1, Math.floor(opts.maxBatches ?? 100));
  let deleted = 0;
  let batches = 0;
  while (batches < maxBatches) {
    const n = await store.deleteUnplacedBefore(cutoff, batchSize);
    batches++;
    deleted += n;
    if (n < batchSize) return { deleted, batches, cutoff, done: true };
  }
  return { deleted, batches, cutoff, done: false };
}

/**
 * True when a stored canvas state has a node showing this image URL. The SQL in
 * createDbPurgeStore is the same rule; the in-memory test store uses this.
 */
export function isImagePlaced(state: unknown, imageUrl: string): boolean {
  const nodes = (state as { nodes?: unknown } | null)?.nodes;
  if (!Array.isArray(nodes)) return false;
  return nodes.some((n) => (n as { data?: { imageUrl?: unknown } } | null)?.data?.imageUrl === imageUrl);
}

/** The batch delete statement. Exported so tests can check the SQL without a database. */
export function purgeBatchSql(cutoff: Date, limit: number) {
  return sql`
    delete from "references" where "id" in (
      select r."id" from "references" r
      where r."created_at" < ${cutoff.toISOString()}
        and not exists (
          select 1 from "canvases" c
          where c."id" = r."canvas_id"
            and coalesce(c."state" -> 'nodes', '[]'::jsonb)
              @> jsonb_build_array(jsonb_build_object('data', jsonb_build_object('imageUrl', r."image_url")))
        )
      order by r."created_at"
      limit ${limit}
    )
    returning "id"`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any schema; only `execute` is used
export function createDbPurgeStore(db: NeonHttpDatabase<any>): PurgeStore {
  return {
    async deleteUnplacedBefore(cutoff, limit) {
      const result = await db.execute(purgeBatchSql(cutoff, limit));
      return result.rows.length;
    },
  };
}
