/**
 * P2-01 nightly weights. Once a night the Workers cron turns the ratings in `search_feedback`
 * (rate_references lane arms, rate_directions ingredients) into one Beta(alpha, beta) per id in
 * `atlas_weights`. Pure counting, no AI. Pooled across users and only for ids that at least
 * K_ANON distinct users rated, each user counted once (their net verdict), so the table holds no
 * user id and no per-user count.
 *
 * Relative imports only: wrangler bundles this straight from the custom worker entry, outside
 * Next's alias setup (same as lib/purge).
 */
import { sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

/** Distinct users who must rate an id before it gets a weight (same as lib/learning/arms.ts K_ANON). */
export const WEIGHT_K_ANON = 3;
/** Beta(2, 2) prior, same as lib/learning/directions.ts INGREDIENT_PRIOR. */
export const WEIGHT_PRIOR = { alpha: 2, beta: 2 } as const;
/** Most weight rows one run writes (the word lists hold a few hundred ingredients). */
export const MAX_WEIGHT_ROWS = 5000;
const CHUNK = 500;

export type WeightKind = "ingredient" | "arm";

/** One grouped count: users who net-kept (great) and net-dropped (bad) an id. */
export type WeightCount = { kind: WeightKind; id: string; great: number; bad: number; users: number };
export type WeightRow = { kind: WeightKind; id: string; alpha: number; beta: number };

export interface WeightsStore {
  /** Grouped ratings for ids that at least `k` distinct users rated. */
  readCounts(k: number): Promise<WeightCount[]>;
  /** Writes the rows, then removes every row not written in this run. */
  replaceAll(rows: readonly WeightRow[], now: Date): Promise<void>;
}

export type NightlyResult = { written: number; ingredients: number; arms: number };

/** Pure: counts to Beta parameters. Drops counts below k users or without any usable verdict. */
export function weightsFromCounts(counts: readonly WeightCount[], k = WEIGHT_K_ANON): WeightRow[] {
  const out: WeightRow[] = [];
  for (const c of counts) {
    if (c.users < k || c.great + c.bad === 0 || !c.id) continue;
    out.push({
      kind: c.kind,
      id: c.id,
      alpha: WEIGHT_PRIOR.alpha + Math.max(0, c.great),
      beta: WEIGHT_PRIOR.beta + Math.max(0, c.bad),
    });
  }
  return out.slice(0, MAX_WEIGHT_ROWS);
}

export async function runNightlyWeights(store: WeightsStore, opts: { now?: Date; k?: number } = {}): Promise<NightlyResult> {
  const now = opts.now ?? new Date();
  const k = opts.k ?? WEIGHT_K_ANON;
  const rows = weightsFromCounts(await store.readCounts(k), k);
  await store.replaceAll(rows, now);
  const ingredients = rows.filter((r) => r.kind === "ingredient").length;
  return { written: rows.length, ingredients, arms: rows.length - ingredients };
}

/** The grouped read. Exported so tests can check the SQL without a database. */
export function weightCountsSql(k: number) {
  return sql`
    select kind, id,
      count(*) filter (where g > b)::int as great,
      count(*) filter (where b > g)::int as bad,
      count(*)::int as users
    from (
      select
        case when lane = 'direction' then 'ingredient' else 'arm' end as kind,
        case when lane = 'direction' then term_key else term_key || '#' || arm end as id,
        user_id,
        count(*) filter (where verdict = 'great') as g,
        count(*) filter (where verdict = 'bad') as b
      from "search_feedback"
      where term_key is not null and (lane = 'direction' or arm is not null)
      group by 1, 2, user_id
    ) per_user
    group by kind, id
    having count(*) >= ${k}
    limit ${MAX_WEIGHT_ROWS}`;
}

export function weightsUpsertSql(rows: readonly WeightRow[], now: Date) {
  const values = sql.join(
    rows.map((r) => sql`(${r.kind}, ${r.id}, ${r.alpha}, ${r.beta}, ${now.toISOString()}::timestamptz)`),
    sql`, `,
  );
  return sql`
    insert into "atlas_weights" ("kind", "id", "alpha", "beta", "updated_at") values ${values}
    on conflict ("kind", "id") do update set
      "alpha" = excluded."alpha", "beta" = excluded."beta", "updated_at" = excluded."updated_at"`;
}

export function weightsStaleSql(now: Date) {
  return sql`delete from "atlas_weights" where "updated_at" < ${now.toISOString()}::timestamptz`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any schema; only `execute` is used
export function createDbWeightsStore(db: NeonHttpDatabase<any>): WeightsStore {
  return {
    async readCounts(k) {
      const result = await db.execute(weightCountsSql(k));
      return (result.rows as Record<string, unknown>[]).map((r) => ({
        kind: r.kind === "arm" ? "arm" : "ingredient",
        id: String(r.id),
        great: Number(r.great ?? 0),
        bad: Number(r.bad ?? 0),
        users: Number(r.users ?? 0),
      }));
    },
    async replaceAll(rows, now) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        await db.execute(weightsUpsertSql(rows.slice(i, i + CHUNK), now));
      }
      // Ids that fell below K_ANON or whose ratings were purged are not rewritten, so they go.
      await db.execute(weightsStaleSql(now));
    },
  };
}
