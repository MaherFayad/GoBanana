/** `uploads` table (spec section 11) over Drizzle. The db is read per call so imports never need DATABASE_URL. */
import { and, eq, sql } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { canvases, uploads } from "@/db/schema";
import { isUuid } from "@/lib/db/ids";
import { isValidShareToken } from "@/lib/share";
import type { UploadRecord, UploadRepo } from "./types";

const columns = {
  id: uploads.id,
  userId: uploads.userId,
  r2Key: uploads.r2Key,
  mime: uploads.mime,
  bytes: uploads.bytes,
};

export function createDbUploadRepo(db: () => Db = getDb): UploadRepo {
  return {
    async totalBytes(userId) {
      if (!isUuid(userId)) return 0;
      const [row] = await db()
        .select({ total: sql<string | number>`coalesce(sum(${uploads.bytes}), 0)` })
        .from(uploads)
        .where(eq(uploads.userId, userId));
      return Number(row?.total ?? 0);
    },
    async insert(row: UploadRecord) {
      await db().insert(uploads).values(row);
    },
    async get(id) {
      if (!isUuid(id)) return null;
      const [row] = await db().select(columns).from(uploads).where(eq(uploads.id, id)).limit(1);
      return row ?? null;
    },
    async deleteOwned(userId, id) {
      if (!isUuid(userId) || !isUuid(id)) return false;
      const rows = await db()
        .delete(uploads)
        .where(and(eq(uploads.id, id), eq(uploads.userId, userId)))
        .returning({ id: uploads.id });
      return rows.length > 0;
    },
    async findSharedCanvas(token) {
      if (!isValidShareToken(token)) return null;
      const [row] = await db()
        .select({ userId: canvases.userId, state: canvases.state })
        .from(canvases)
        .where(eq(canvases.shareToken, token))
        .limit(1);
      return row ?? null;
    },
  };
}
