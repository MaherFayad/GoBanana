/** `directions` table: bend_brief output saved for a canvas (spec section 11). */
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { canvases, directions } from "@/db/schema";
import { isUuid } from "./ids";
import type { DirectionRecord, DirectionRepo, NewDirection } from "./types";

const columns = {
  id: directions.id,
  bendId: directions.bendId,
  canvasId: directions.canvasId,
  move: directions.move,
  title: directions.title,
  searchQuery: directions.searchQuery,
};

/** Insert or refresh directions, keyed by (canvas_id, bend_id). */
export async function upsertDirections(db: Db, canvasId: string, rows: readonly NewDirection[]): Promise<void> {
  if (!isUuid(canvasId) || rows.length === 0) return;
  await db
    .insert(directions)
    .values(rows.map((d) => ({ canvasId, bendId: d.bendId, move: d.move, title: d.title, searchQuery: d.searchQuery })))
    .onConflictDoUpdate({
      target: [directions.canvasId, directions.bendId],
      set: {
        move: sql`excluded.move`,
        title: sql`excluded.title`,
        searchQuery: sql`excluded.search_query`,
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
  return row ?? null;
}

export async function listDirections(db: Db, canvasId: string): Promise<DirectionRecord[]> {
  if (!isUuid(canvasId)) return [];
  return db.select(columns).from(directions).where(eq(directions.canvasId, canvasId));
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

export function directionRepo(db: Db): DirectionRepo {
  return {
    upsertMany: (canvasId, rows) => upsertDirections(db, canvasId, rows),
    findForUser: (userId, directionId, canvasId) => findDirectionForUser(db, userId, directionId, canvasId),
    listForCanvas: (canvasId) => listDirections(db, canvasId),
    deleteMany: (canvasId, ids) => deleteDirections(db, canvasId, ids),
  };
}
