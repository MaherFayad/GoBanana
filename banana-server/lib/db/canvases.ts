/** `canvases` table (spec section 11). Every read and write is scoped to the owner. */
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { canvases } from "@/db/schema";
import { isStateObject } from "@/lib/taste";
import { KEEP_STORED } from "./keep";
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
      // Spelled out with table names: on a single-table select Drizzle renders column references
      // bare ("canvas_id" = "id"), which Postgres reads as directions.canvas_id = directions.id, so
      // the count was always 0 (a field agent saw 0 directions on every board, 2026-10-12).
      directionCount: sql<number>`(SELECT count(*)::int FROM "directions" AS d WHERE d."canvas_id" = "canvases"."id")`,
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
 * New state for a save. Keys in KEEP_STORED (`taste`, which the canvas UI does not know about, and
 * the stitch `parts` library, which an older canvas UI leaves out) keep their stored value when the
 * save omits them, in the same statement (no extra read, no race). A save that sets a key, even to
 * an empty list, replaces it.
 */
function keepStored(state: unknown): unknown {
  if (!isStateObject(state)) return state;
  const missing = KEEP_STORED.filter((k) => !Object.hasOwn(state, k));
  if (missing.length === 0) return state;
  // Keys are constants from KEEP_STORED, never user input. The new JSON goes in once as a parameter.
  const keys = sql.raw(missing.map((k) => `'${k}'`).join(", "));
  return sql`${JSON.stringify(state)}::jsonb || (SELECT coalesce(jsonb_object_agg(kept.key, kept.value), '{}'::jsonb) FROM jsonb_each(${canvases.state}) AS kept WHERE kept.key IN (${keys}))`;
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
    .set({ state: keepStored(state), updatedAt })
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
