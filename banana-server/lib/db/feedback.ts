/**
 * `search_feedback` and `blocked_items` (migration 0003). Ratings are personal data: they hold
 * the user id, cascade away with the user and expire after 12 months (lib/purge/feedback.ts).
 * Arm stats are computed from these rows on read, grouped so that each user counts once per
 * term key and arm; user ids never leave the query (DECISIONS.md).
 */
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { blockedItems, searchFeedback } from "@/db/schema";
import { isUuid } from "./ids";
import type { ArmStatRow, BlocklistRepo, FeedbackRepo, IngredientStatRow, NewFeedback } from "./types";

/** Most rows one armStats read groups (term keys of one search, a handful of arms each). */
const MAX_TERM_KEYS = 16;

export async function insertFeedback(db: Db, rows: readonly NewFeedback[]): Promise<void> {
  const valid = rows.filter((r) => isUuid(r.userId));
  if (valid.length === 0) return;
  await db.insert(searchFeedback).values(valid.map((r) => ({ ...r, reasons: [...r.reasons] })));
}

export async function listCreatorRatings(db: Db, userId: string, limit = 500) {
  if (!isUuid(userId)) return [];
  return db
    .select({ itemKey: searchFeedback.itemKey, verdict: searchFeedback.verdict, creator: searchFeedback.creator })
    .from(searchFeedback)
    .where(and(eq(searchFeedback.userId, userId), isNotNull(searchFeedback.creator)))
    .orderBy(desc(searchFeedback.createdAt))
    .limit(limit);
}

/** The grouped stats query. Exported so tests can check the SQL without a database. */
export function armStatsSql(userId: string, termKeys: readonly string[]) {
  const keys = sql.join(
    termKeys.map((k) => sql`${k}`),
    sql`, `,
  );
  return sql`
    select term_key, arm,
      count(*) filter (where g > b)::int as great,
      count(*) filter (where b > g)::int as bad,
      count(*)::int as users,
      coalesce(sum(g) filter (where user_id = ${userId}::uuid), 0)::int as own_great,
      coalesce(sum(b) filter (where user_id = ${userId}::uuid), 0)::int as own_bad
    from (
      select term_key, arm, user_id,
        count(*) filter (where verdict = 'great') as g,
        count(*) filter (where verdict = 'bad') as b
      from "search_feedback"
      where term_key in (${keys}) and arm is not null
      group by term_key, arm, user_id
    ) per_user
    group by term_key, arm`;
}

export async function readArmStats(db: Db, userId: string, termKeys: readonly string[]): Promise<ArmStatRow[]> {
  const keys = [...new Set(termKeys)].slice(0, MAX_TERM_KEYS);
  if (!isUuid(userId) || keys.length === 0) return [];
  const result = await db.execute(armStatsSql(userId, keys));
  return (result.rows as Record<string, unknown>[]).map((r) => ({
    termKey: String(r.term_key),
    arm: String(r.arm),
    great: Number(r.great ?? 0),
    bad: Number(r.bad ?? 0),
    users: Number(r.users ?? 0),
    ownGreat: Number(r.own_great ?? 0),
    ownBad: Number(r.own_bad ?? 0),
  }));
}

/** Most ingredient rows one directionStats read returns (the word lists hold a few hundred). */
const MAX_INGREDIENTS = 5000;

/**
 * The grouped direction stats query (rate_directions rows: lane "direction"), one row per
 * ingredient term key. Same per-user grouping as armStatsSql, arms (moves) pooled. Exported so
 * tests can check the SQL without a database.
 */
export function directionStatsSql(userId: string, k: number) {
  return sql`
    select term_key,
      count(*) filter (where g > b)::int as great,
      count(*) filter (where b > g)::int as bad,
      count(*)::int as users,
      coalesce(sum(g) filter (where user_id = ${userId}::uuid), 0)::int as own_great,
      coalesce(sum(b) filter (where user_id = ${userId}::uuid), 0)::int as own_bad
    from (
      select term_key, user_id,
        count(*) filter (where verdict = 'great') as g,
        count(*) filter (where verdict = 'bad') as b
      from "search_feedback"
      where lane = 'direction' and term_key like 'direction|%'
      group by term_key, user_id
    ) per_user
    group by term_key
    having count(*) >= ${k} or bool_or(user_id = ${userId}::uuid)
    limit ${MAX_INGREDIENTS}`;
}

export async function readDirectionStats(db: Db, userId: string, k: number): Promise<IngredientStatRow[]> {
  if (!isUuid(userId)) return [];
  const result = await db.execute(directionStatsSql(userId, k));
  return (result.rows as Record<string, unknown>[]).map((r) => ({
    termKey: String(r.term_key),
    great: Number(r.great ?? 0),
    bad: Number(r.bad ?? 0),
    users: Number(r.users ?? 0),
    ownGreat: Number(r.own_great ?? 0),
    ownBad: Number(r.own_bad ?? 0),
  }));
}

export function feedbackRepo(db: Db): FeedbackRepo {
  return {
    insertMany: (rows) => insertFeedback(db, rows),
    listCreatorRatings: (userId, limit) => listCreatorRatings(db, userId, limit),
    armStats: (userId, termKeys) => readArmStats(db, userId, termKeys),
    directionStats: (userId, k) => readDirectionStats(db, userId, k),
  };
}

/** Most blocked keys read per search. */
const MAX_BLOCKED = 5000;

export function blocklistRepo(db: Db): BlocklistRepo {
  return {
    async add(userId, itemKeys) {
      const keys = [...new Set(itemKeys)].filter(Boolean);
      if (!isUuid(userId) || keys.length === 0) return;
      await db
        .insert(blockedItems)
        .values(keys.map((itemKey) => ({ userId, itemKey })))
        .onConflictDoNothing();
    },
    async list(userId) {
      if (!isUuid(userId)) return [];
      const rows = await db
        .select({ itemKey: blockedItems.itemKey })
        .from(blockedItems)
        .where(eq(blockedItems.userId, userId))
        .orderBy(desc(blockedItems.createdAt))
        .limit(MAX_BLOCKED);
      return rows.map((r) => r.itemKey);
    },
  };
}
