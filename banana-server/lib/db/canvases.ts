/** `canvases` table (spec section 11). Every read and write is scoped to the owner. */
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { canvases, directions } from "@/db/schema";
import { isStateObject, stateHasTaste } from "@/lib/taste";
import { isUuid } from "./ids";
import { clampListLimit, cleanPreviews } from "./summary";
import {
  SUMMARY_PREVIEWS,
  type CanvasRecord,
  type CanvasRepo,
  type CanvasSummary,
  type NewCanvas,
  type SaveOptions,
  type SaveResult,
} from "./types";

const columns = {
  id: canvases.id,
  userId: canvases.userId,
  title: canvases.title,
  brief: canvases.brief,
  wildness: canvases.wildness,
  lens: canvases.lens,
  state: canvases.state,
  shareToken: canvases.shareToken,
  updatedAt: canvases.updatedAt,
};

/** Timestamps are written from JS (millisecond precision) and compared at millisecond precision. */
const updatedAtMs = sql`date_trunc('milliseconds', ${canvases.updatedAt})`;

export async function createCanvas(db: Db, input: NewCanvas): Promise<CanvasRecord> {
  const [row] = await db
    .insert(canvases)
    .values({
      userId: input.userId,
      title: input.title,
      brief: input.brief ?? null,
      wildness: input.wildness ?? null,
      lens: input.lens ?? null,
      state: input.state,
      updatedAt: new Date(),
    })
    .returning(columns);
  if (!row) throw new Error("Could not create canvas");
  return row;
}

export async function getCanvasForOwner(db: Db, userId: string, canvasId: string): Promise<CanvasRecord | null> {
  if (!isUuid(canvasId) || !isUuid(userId)) return null;
  const [row] = await db
    .select(columns)
    .from(canvases)
    .where(and(eq(canvases.id, canvasId), eq(canvases.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function countCanvases(db: Db, userId: string): Promise<number> {
  if (!isUuid(userId)) return 0;
  const [row] = await db.select({ n: count() }).from(canvases).where(eq(canvases.userId, userId));
  return Number(row?.n ?? 0);
}

/** `state.nodes` as a jsonb array, or an empty one when the state has none. */
const stateNodes = sql`(CASE WHEN jsonb_typeof(${canvases.state} -> 'nodes') = 'array' THEN ${canvases.state} -> 'nodes' ELSE '[]'::jsonb END)`;

/**
 * The user's canvases for the dashboard, newest first. Reads counts and the first few reference
 * URLs out of the state JSON in SQL, so the full state never leaves the database here.
 */
export async function listOwnedCanvases(db: Db, userId: string, opts: { limit?: number } = {}): Promise<CanvasSummary[]> {
  if (!isUuid(userId)) return [];
  const limit = clampListLimit(opts.limit);
  const rows = await db
    .select({
      id: canvases.id,
      title: canvases.title,
      brief: canvases.brief,
      shareToken: canvases.shareToken,
      updatedAt: canvases.updatedAt,
      referenceCount: sql<number>`(SELECT count(*)::int FROM jsonb_array_elements(${stateNodes}) AS e(n) WHERE e.n ->> 'type' IN ('image', 'upload'))`,
      directionCount: sql<number>`(SELECT count(*)::int FROM ${directions} WHERE ${directions.canvasId} = ${canvases.id})`,
      previews: sql<unknown>`(SELECT coalesce(jsonb_agg(p.v ORDER BY p.i), '[]'::jsonb) FROM (SELECT e.i, jsonb_build_object('thumbUrl', e.n -> 'data' -> 'thumbUrl', 'imageUrl', e.n -> 'data' -> 'imageUrl', 'sourceUrl', e.n -> 'data' -> 'sourceUrl') AS v FROM jsonb_array_elements(${stateNodes}) WITH ORDINALITY AS e(n, i) WHERE e.n ->> 'type' IN ('image', 'upload') ORDER BY e.i LIMIT ${SUMMARY_PREVIEWS}) AS p)`,
    })
    .from(canvases)
    .where(eq(canvases.userId, userId))
    .orderBy(desc(canvases.updatedAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    brief: r.brief,
    shareToken: r.shareToken,
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt : new Date(r.updatedAt),
    referenceCount: Number(r.referenceCount ?? 0),
    directionCount: Number(r.directionCount ?? 0),
    previews: cleanPreviews(r.previews),
  }));
}

/**
 * New state for a save. The canvas UI does not know about `taste` (lib/taste.ts), so a save
 * without it keeps the stored one, in the same statement (no extra read, no race).
 */
function keepTaste(state: unknown): unknown {
  if (!isStateObject(state) || stateHasTaste(state)) return state;
  const json = JSON.stringify(state);
  return sql`CASE WHEN ${canvases.state} ? 'taste' THEN ${json}::jsonb || jsonb_build_object('taste', ${canvases.state} -> 'taste') ELSE ${json}::jsonb END`;
}

export async function saveCanvasState(
  db: Db,
  userId: string,
  canvasId: string,
  state: unknown,
  opts: SaveOptions = {},
): Promise<SaveResult> {
  if (!isUuid(canvasId) || !isUuid(userId)) return { ok: false, reason: "not_found" };
  const updatedAt = new Date();
  const owner = and(eq(canvases.id, canvasId), eq(canvases.userId, userId));
  const where = opts.ifUpdatedAt ? and(owner, sql`${updatedAtMs} = ${opts.ifUpdatedAt.toISOString()}`) : owner;
  const rows = await db
    .update(canvases)
    .set({ state: keepTaste(state), updatedAt })
    .where(where)
    .returning({ id: canvases.id });
  if (rows.length > 0) return { ok: true, updatedAt };
  if (!opts.ifUpdatedAt) return { ok: false, reason: "not_found" };
  const exists = await getCanvasForOwner(db, userId, canvasId);
  return { ok: false, reason: exists ? "conflict" : "not_found" };
}

export async function updateCanvas(
  db: Db,
  userId: string,
  canvasId: string,
  patch: { title?: string; brief?: string | null; wildness?: number | null; lens?: string | null },
): Promise<boolean> {
  if (!isUuid(canvasId) || !isUuid(userId)) return false;
  const set: Partial<typeof canvases.$inferInsert> = {};
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.brief !== undefined) set.brief = patch.brief;
  if (patch.wildness !== undefined) set.wildness = patch.wildness;
  if (patch.lens !== undefined) set.lens = patch.lens;
  if (Object.keys(set).length === 0) return (await getCanvasForOwner(db, userId, canvasId)) !== null;
  // Title and brief changes do not touch updated_at, so they never race a state save.
  const rows = await db
    .update(canvases)
    .set(set)
    .where(and(eq(canvases.id, canvasId), eq(canvases.userId, userId)))
    .returning({ id: canvases.id });
  return rows.length > 0;
}

export function canvasRepo(db: Db): CanvasRepo {
  return {
    create: (input) => createCanvas(db, input),
    getOwned: (userId, canvasId) => getCanvasForOwner(db, userId, canvasId),
    countOwned: (userId) => countCanvases(db, userId),
    listOwned: (userId, opts) => listOwnedCanvases(db, userId, opts),
    saveState: (userId, canvasId, state, opts) => saveCanvasState(db, userId, canvasId, state, opts),
    update: (userId, canvasId, patch) => updateCanvas(db, userId, canvasId, patch),
  };
}
