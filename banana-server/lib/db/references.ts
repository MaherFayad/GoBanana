/**
 * `references` table: search results saved for a canvas. URLs and metadata only,
 * never image bytes (hard rule 2). `references.canvas_id` is NOT NULL, so results
 * are saved only when a search names a canvas.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { references } from "@/db/schema";
import type { Reference } from "@/lib/sources/types";
import { isUuid, referenceRowId } from "./ids";
import type { ReferenceRecord, ReferenceRepo } from "./types";

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
};

function intOrNull(n: number | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export async function insertReferences(db: Db, canvasId: string, refs: readonly Reference[]): Promise<void> {
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
    })),
  );
  await db.insert(references).values(values).onConflictDoNothing({ target: references.id });
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

export function referenceRepo(db: Db): ReferenceRepo {
  return {
    insertMany: (canvasId, refs) => insertReferences(db, canvasId, refs),
    getByIds: (canvasId, ids) => getReferencesByIds(db, canvasId, ids),
  };
}
