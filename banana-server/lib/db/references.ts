/**
 * `references` table: search results saved for a canvas. URLs and metadata only,
 * never image bytes (hard rule 2). `references.canvas_id` is NOT NULL, so results
 * are saved only when a search names a canvas.
 */
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { canvases, references } from "@/db/schema";
import { isUuid, referenceRowId } from "./ids";
import type { ReferenceRecord, ReferenceRepo, SavedReference } from "./types";

const columns = {
  id: references.id,
  canvasId: references.canvasId,
  sourceSite: references.sourceSite,
  sourceUrl: references.sourceUrl,
  imageUrl: references.imageUrl,
  thumbUrl: references.thumbUrl,
  title: references.title,
  width: references.width,
  height: references.height,
  resultId: references.resultId,
  lane: references.lane,
  query: references.query,
  termKey: references.termKey,
  arm: references.arm,
};

/** On conflict: keep the stored value unless the new search has one. */
const newer = (col: string) => sql.raw(`coalesce(excluded."${col}", "references"."${col}")`);

function intOrNull(n: number | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export async function insertReferences(db: Db, canvasId: string, refs: readonly SavedReference[]): Promise<void> {
  if (!isUuid(canvasId) || refs.length === 0) return;
  const values = await Promise.all(
    refs.map(async (r) => ({
      id: await referenceRowId(canvasId, r.id),
      canvasId,
      sourceSite: r.sourceSite,
      sourceUrl: r.sourceUrl,
      imageUrl: r.imageUrl,
      thumbUrl: r.thumbUrl,
      title: r.title ?? null,
      width: intOrNull(r.width),
      height: intOrNull(r.height),
      resultId: r.id,
      lane: r.lane ?? null,
      query: r.query ?? null,
      termKey: r.termKey ?? null,
      arm: r.arm ?? null,
    })),
  );
  // URLs never change for a row id; the search details follow the latest search that found it.
  await db
    .insert(references)
    .values(values)
    .onConflictDoUpdate({
      target: references.id,
      set: {
        resultId: newer("result_id"),
        lane: newer("lane"),
        query: newer("query"),
        termKey: newer("term_key"),
        arm: newer("arm"),
      },
    });
}

/** Keyed by the id as passed (`ref_...` search id or row uuid). */
export async function getReferencesByIds(
  db: Db,
  canvasId: string,
  ids: readonly string[],
): Promise<Map<string, ReferenceRecord>> {
  const out = new Map<string, ReferenceRecord>();
  if (!isUuid(canvasId) || ids.length === 0) return out;
  const pairs = await Promise.all(
    [...new Set(ids)].map(async (id) => [id, isUuid(id) ? id.toLowerCase() : await referenceRowId(canvasId, id)] as const),
  );
  const rows = await db
    .select(columns)
    .from(references)
    .where(and(eq(references.canvasId, canvasId), inArray(references.id, pairs.map(([, rowId]) => rowId))));
  const byRowId = new Map(rows.map((r) => [r.id.toLowerCase(), r]));
  for (const [id, rowId] of pairs) {
    const row = byRowId.get(rowId);
    if (row) out.set(id, row);
  }
  return out;
}

/** References on any of the user's canvases, by result id or row uuid; newest row wins. */
export async function findOwnedReferences(
  db: Db,
  userId: string,
  ids: readonly string[],
): Promise<Map<string, ReferenceRecord>> {
  const out = new Map<string, ReferenceRecord>();
  if (!isUuid(userId) || ids.length === 0) return out;
  const unique = [...new Set(ids)];
  const uuids = unique.filter(isUuid).map((id) => id.toLowerCase());
  const resultIds = unique.filter((id) => !isUuid(id));
  const match = [
    ...(resultIds.length > 0 ? [inArray(references.resultId, resultIds)] : []),
    ...(uuids.length > 0 ? [inArray(references.id, uuids)] : []),
  ];
  const rows = await db
    .select(columns)
    .from(references)
    .innerJoin(canvases, eq(canvases.id, references.canvasId))
    .where(and(eq(canvases.userId, userId), or(...match)))
    .orderBy(desc(references.createdAt))
    .limit(unique.length * 10);
  for (const id of unique) {
    const row = rows.find((r) => (isUuid(id) ? r.id.toLowerCase() === id.toLowerCase() : r.resultId === id));
    if (row) out.set(id, row);
  }
  return out;
}

export function referenceRepo(db: Db): ReferenceRepo {
  return {
    insertMany: (canvasId, refs) => insertReferences(db, canvasId, refs),
    getByIds: (canvasId, ids) => getReferencesByIds(db, canvasId, ids),
    findOwned: (userId, ids) => findOwnedReferences(db, userId, ids),
  };
}
