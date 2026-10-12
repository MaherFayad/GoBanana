/** `directions` table: bend_brief output saved for a canvas (spec section 11). */
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { canvases, directions } from "@/db/schema";
import { parseDirectionDetail } from "./detail";
import { isUuid } from "./ids";
import type { DirectionDetail } from "@/lib/direction-detail";
import type { DirectionRecord, DirectionRepo, NewDirection } from "./types";

const columns = {
  id: directions.id,
  bendId: directions.bendId,
  canvasId: directions.canvasId,
  move: directions.move,
  title: directions.title,
  searchQuery: directions.searchQuery,
  detail: directions.detail,
};

type Row = Omit<DirectionRecord, "detail"> & { detail: unknown };

/** Row to record: the jsonb detail is validated, invalid shapes read as null. */
function toRecord(row: Row): DirectionRecord {
  return { ...row, detail: parseDirectionDetail(row.detail) };
}

/** Insert or refresh directions, keyed by (canvas_id, bend_id). */
export async function upsertDirections(db: Db, canvasId: string, rows: readonly NewDirection[]): Promise<void> {
  if (!isUuid(canvasId) || rows.length === 0) return;
  await db
    .insert(directions)
    .values(
      rows.map((d) => ({
        canvasId,
        bendId: d.bendId,
        move: d.move,
        title: d.title,
        searchQuery: d.searchQuery,
        detail: parseDirectionDetail(d.detail),
      })),
    )
    .onConflictDoUpdate({
      target: [directions.canvasId, directions.bendId],
      set: {
        move: sql`excluded.move`,
        title: sql`excluded.title`,
        searchQuery: sql`excluded.search_query`,
        // A new detail replaces the old one but keeps the stored verdict; no detail keeps the old one.
        detail: sql`case when excluded.detail is null then ${directions.detail}
          else excluded.detail || jsonb_strip_nulls(jsonb_build_object('verdict', ${directions.detail} -> 'verdict')) end`,
      },
    });
}

/** A direction on one of the user's canvases, by row uuid or bend id. Ownership is checked through the canvas. */
export async function findDirectionForUser(
  db: Db,
  userId: string,
  directionId: string,
  canvasId?: string,
): Promise<DirectionRecord | null> {
  if (!isUuid(userId) || !directionId) return null;
  if (canvasId !== undefined && !isUuid(canvasId)) return null;
  const match = isUuid(directionId) ? eq(directions.id, directionId) : eq(directions.bendId, directionId);
  const [row] = await db
    .select(columns)
    .from(directions)
    .innerJoin(canvases, eq(directions.canvasId, canvases.id))
    .where(and(eq(canvases.userId, userId), match, canvasId ? eq(directions.canvasId, canvasId) : undefined))
    .limit(1);
  return row ? toRecord(row) : null;
}

export async function listDirections(db: Db, canvasId: string): Promise<DirectionRecord[]> {
  if (!isUuid(canvasId)) return [];
  const rows = await db.select(columns).from(directions).where(eq(directions.canvasId, canvasId));
  return rows.map(toRecord);
}

/** Set `detail.verdict` (rate_directions), keeping the rest of the detail. Ownership is checked by the caller. */
export async function setDirectionVerdict(
  db: Db,
  canvasId: string,
  ids: readonly string[],
  verdict: "keep" | "drop",
): Promise<number> {
  const rowIds = [...new Set(ids)].filter(isUuid);
  if (!isUuid(canvasId) || rowIds.length === 0) return 0;
  const changed = await db
    .update(directions)
    .set({ detail: sql`coalesce(${directions.detail}, '{}'::jsonb) || jsonb_build_object('verdict', ${verdict}::text)` })
    .where(and(eq(directions.canvasId, canvasId), inArray(directions.id, rowIds)))
    .returning({ id: directions.id });
  return changed.length;
}

/** Merge reconcile_direction output into one direction's detail (validated first). Ownership is checked by the caller. */
export async function setDirectionReconciled(
  db: Db,
  canvasId: string,
  id: string,
  patch: Pick<DirectionDetail, "spec" | "reconciled">,
): Promise<boolean> {
  if (!isUuid(canvasId) || !isUuid(id)) return false;
  const clean = parseDirectionDetail(patch) ?? {};
  const merge: Record<string, unknown> = {};
  if (clean.spec) merge.spec = clean.spec;
  if (clean.reconciled) merge.reconciled = clean.reconciled;
  const changed = await db
    .update(directions)
    .set({ detail: sql`coalesce(${directions.detail}, '{}'::jsonb) || ${JSON.stringify(merge)}::jsonb` })
    .where(and(eq(directions.canvasId, canvasId), eq(directions.id, id)))
    .returning({ id: directions.id });
  return changed.length > 0;
}

/** Delete directions of one canvas by row uuid (rate_directions drop). Ownership is checked by the caller. */
export async function deleteDirections(db: Db, canvasId: string, ids: readonly string[]): Promise<number> {
  const rowIds = [...new Set(ids)].filter(isUuid);
  if (!isUuid(canvasId) || rowIds.length === 0) return 0;
  const gone = await db
    .delete(directions)
    .where(and(eq(directions.canvasId, canvasId), inArray(directions.id, rowIds)))
    .returning({ id: directions.id });
  return gone.length;
}

/** Search texts of directions on the user's most recently updated canvases (see DirectionRepo). */
export async function recentDirectionQueries(
  db: Db,
  userId: string,
  opts: { canvasLimit: number; excludeCanvasId?: string },
): Promise<string[]> {
  if (!isUuid(userId) || opts.canvasLimit <= 0) return [];
  const exclude = opts.excludeCanvasId && isUuid(opts.excludeCanvasId) ? opts.excludeCanvasId : null;
  const recent = await db
    .select({ id: canvases.id })
    .from(canvases)
    .where(and(eq(canvases.userId, userId), exclude ? ne(canvases.id, exclude) : undefined))
    .orderBy(desc(canvases.updatedAt))
    .limit(opts.canvasLimit);
  if (recent.length === 0) return [];
  const rows = await db
    .select({ q: directions.searchQuery })
    .from(directions)
    .where(inArray(directions.canvasId, recent.map((r) => r.id)));
  return rows.map((r) => r.q);
}

export function directionRepo(db: Db): DirectionRepo {
  return {
    upsertMany: (canvasId, rows) => upsertDirections(db, canvasId, rows),
    findForUser: (userId, directionId, canvasId) => findDirectionForUser(db, userId, directionId, canvasId),
    listForCanvas: (canvasId) => listDirections(db, canvasId),
    deleteMany: (canvasId, ids) => deleteDirections(db, canvasId, ids),
    setVerdict: (canvasId, ids, verdict) => setDirectionVerdict(db, canvasId, ids, verdict),
    setReconciled: (canvasId, id, patch) => setDirectionReconciled(db, canvasId, id, patch),
    recentQueriesForUser: (userId, opts) => recentDirectionQueries(db, userId, opts),
  };
}
