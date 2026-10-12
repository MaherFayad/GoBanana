/**
 * Drizzle side of canvas deletion (lib/canvas-delete/delete.ts). Every query is scoped to the
 * owner. Kept out of lib/db so the CanvasRepo port stays as it is; foreign keys cascade from
 * `canvases` to directions, references and palettes. The db is read per call so imports never
 * need DATABASE_URL.
 */
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { canvases } from "@/db/schema";
import { isUuid } from "@/lib/db/ids";
import { uploadPath } from "@/lib/uploads/rules";
import { createDbUploadRepo } from "@/lib/uploads/db";
import { getUploadsBucket } from "@/lib/uploads/bucket";
import type { CanvasDeleteDeps, CanvasDeleteRepo } from "./delete";

export function createDbCanvasDeleteRepo(db: () => Db = getDb): CanvasDeleteRepo {
  const owned = (userId: string, canvasId: string) => and(eq(canvases.id, canvasId), eq(canvases.userId, userId));
  return {
    async findOwned(userId, canvasId) {
      if (!isUuid(userId) || !isUuid(canvasId)) return null;
      const [row] = await db()
        .select({ title: canvases.title, state: canvases.state })
        .from(canvases)
        .where(owned(userId, canvasId))
        .limit(1);
      return row ?? null;
    },
    async uploadsShownElsewhere(userId, canvasId, uploadIds) {
      const found = new Set<string>();
      if (!isUuid(userId) || !isUuid(canvasId)) return found;
      // A plain text match on the state JSON: it can only over-report (keep an upload), never under-report.
      await Promise.all(
        uploadIds.filter(isUuid).map(async (id) => {
          const [row] = await db()
            .select({ id: canvases.id })
            .from(canvases)
            .where(
              and(
                eq(canvases.userId, userId),
                ne(canvases.id, canvasId),
                sql`${canvases.state}::text LIKE ${`%${uploadPath(id)}%`}`,
              ),
            )
            .limit(1);
          if (row) found.add(id);
        }),
      );
      return found;
    },
    async deleteOwned(userId, canvasId) {
      if (!isUuid(userId) || !isUuid(canvasId)) return false;
      const rows = await db().delete(canvases).where(owned(userId, canvasId)).returning({ id: canvases.id });
      return rows.length > 0;
    },
  };
}

/** Live deps: Drizzle repos and the R2 binding. */
export function liveCanvasDeleteDeps(): CanvasDeleteDeps {
  return { canvases: createDbCanvasDeleteRepo(), uploads: createDbUploadRepo(), bucket: getUploadsBucket };
}
