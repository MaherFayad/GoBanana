/** `canvases` table (spec section 11). Every read and write is scoped to the owner. */
import { and, count, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { canvases } from "@/db/schema";
import { isUuid } from "./ids";
import type { CanvasRecord, CanvasRepo, NewCanvas, SaveOptions, SaveResult } from "./types";

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
  const rows = await db.update(canvases).set({ state, updatedAt }).where(where).returning({ id: canvases.id });
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
    saveState: (userId, canvasId, state, opts) => saveCanvasState(db, userId, canvasId, state, opts),
    update: (userId, canvasId, patch) => updateCanvas(db, userId, canvasId, patch),
  };
}
