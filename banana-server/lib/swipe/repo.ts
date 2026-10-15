/** Swipe file repos: Drizzle over Neon (swipe_items, migration 0009) and an in-memory twin for tests. */
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { swipeItems } from "@/db/schema";
import { isUuid } from "@/lib/db/ids";
import {
  MAX_SWIPE_ITEMS,
  cleanNewSwipe,
  clampLimit,
  likePattern,
  swipeItemKey,
  type NewSwipe,
  type SwipeCrop,
  type SwipeItem,
  type SwipeKind,
  type SwipeRepo,
} from "./index";

const cols = {
  id: swipeItems.id,
  kind: swipeItems.kind,
  role: swipeItems.role,
  cardId: swipeItems.cardId,
  sourceSite: swipeItems.sourceSite,
  sourceUrl: swipeItems.sourceUrl,
  imageUrl: swipeItems.imageUrl,
  thumbUrl: swipeItems.thumbUrl,
  title: swipeItems.title,
  crop: swipeItems.crop,
  note: swipeItems.note,
  fromCanvasId: swipeItems.fromCanvasId,
  createdAt: swipeItems.createdAt,
};

function toItem(r: { [K in keyof typeof cols]: unknown }): SwipeItem {
  return { ...(r as Omit<SwipeItem, "kind" | "crop">), kind: r.kind as SwipeKind, crop: (r.crop as SwipeCrop | null) ?? null };
}

export function swipeRepo(db: Db): SwipeRepo {
  const countOf = async (userId: string) => {
    if (!isUuid(userId)) return 0;
    const [row] = await db.select({ n: count() }).from(swipeItems).where(eq(swipeItems.userId, userId));
    return Number(row?.n ?? 0);
  };
  return {
    async addMany(userId, items) {
      if (!isUuid(userId)) return { added: 0, skipped: items.length, full: false };
      const clean = items.map(cleanNewSwipe).filter((x): x is NewSwipe => x !== null);
      const room = Math.max(0, MAX_SWIPE_ITEMS - (await countOf(userId)));
      const take = clean.slice(0, room);
      if (take.length === 0) return { added: 0, skipped: items.length, full: clean.length > 0 };
      const rows = await db
        .insert(swipeItems)
        .values(
          take.map((i) => ({
            userId,
            itemKey: swipeItemKey(i),
            kind: i.kind,
            role: i.role ?? null,
            cardId: i.cardId ?? null,
            sourceSite: i.sourceSite,
            sourceUrl: i.sourceUrl,
            imageUrl: i.imageUrl,
            thumbUrl: i.thumbUrl ?? i.imageUrl,
            title: i.title ?? null,
            crop: i.crop ?? null,
            note: i.note ?? null,
            fromCanvasId: i.fromCanvasId && isUuid(i.fromCanvasId) ? i.fromCanvasId : null,
          })),
        )
        .onConflictDoNothing({ target: [swipeItems.userId, swipeItems.itemKey] })
        .returning({ id: swipeItems.id });
      return { added: rows.length, skipped: items.length - rows.length, full: clean.length > take.length };
    },
    async search(userId, q = {}) {
      if (!isUuid(userId)) return [];
      const where = [eq(swipeItems.userId, userId)];
      if (q.role) where.push(eq(swipeItems.role, q.role.toLowerCase()));
      if (q.cardId) where.push(eq(swipeItems.cardId, q.cardId));
      if (q.kind) where.push(eq(swipeItems.kind, q.kind));
      const words = q.query?.trim().slice(0, 80);
      if (words) {
        const like = likePattern(words);
        where.push(or(ilike(swipeItems.title, like), ilike(swipeItems.sourceSite, like), ilike(swipeItems.note, like))!);
      }
      const rows = await db
        .select(cols)
        .from(swipeItems)
        .where(and(...where))
        .orderBy(desc(swipeItems.createdAt))
        .limit(clampLimit(q.limit))
        .offset(Math.max(0, Math.floor(q.offset ?? 0)));
      return rows.map(toItem);
    },
    count: countOf,
    async remove(userId, id) {
      if (!isUuid(userId) || !isUuid(id)) return false;
      const rows = await db
        .delete(swipeItems)
        .where(and(eq(swipeItems.id, id), eq(swipeItems.userId, userId)))
        .returning({ id: swipeItems.id });
      return rows.length > 0;
    },
  };
}

/** In-memory repo with the same rules (cap, dedupe, filters). */
export function memorySwipeRepo(): SwipeRepo & { rows: (SwipeItem & { userId: string; itemKey: string })[] } {
  const rows: (SwipeItem & { userId: string; itemKey: string })[] = [];
  let clock = Date.UTC(2026, 9, 1);
  const mine = (userId: string) => rows.filter((r) => r.userId === userId);
  return {
    rows,
    async addMany(userId, items) {
      const clean = items.map(cleanNewSwipe).filter((x): x is NewSwipe => x !== null);
      let added = 0;
      let full = false;
      for (const i of clean) {
        const itemKey = swipeItemKey(i);
        if (mine(userId).some((r) => r.itemKey === itemKey)) continue;
        if (mine(userId).length >= MAX_SWIPE_ITEMS) {
          full = true;
          break;
        }
        rows.push({
          id: crypto.randomUUID(),
          userId,
          itemKey,
          kind: i.kind,
          role: i.role ?? null,
          cardId: i.cardId ?? null,
          sourceSite: i.sourceSite,
          sourceUrl: i.sourceUrl,
          imageUrl: i.imageUrl,
          thumbUrl: i.thumbUrl ?? i.imageUrl,
          title: i.title ?? null,
          crop: i.crop ?? null,
          note: i.note ?? null,
          fromCanvasId: i.fromCanvasId ?? null,
          createdAt: new Date((clock += 1000)),
        });
        added++;
      }
      return { added, skipped: items.length - added, full };
    },
    async search(userId, q = {}) {
      const words = q.query?.trim().toLowerCase();
      return mine(userId)
        .filter(
          (r) =>
            (!q.role || r.role === q.role.toLowerCase()) &&
            (!q.cardId || r.cardId === q.cardId) &&
            (!q.kind || r.kind === q.kind) &&
            (!words || [r.title, r.sourceSite, r.note].some((f) => f?.toLowerCase().includes(words))),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(Math.max(0, Math.floor(q.offset ?? 0)), Math.max(0, Math.floor(q.offset ?? 0)) + clampLimit(q.limit))
        .map(({ userId: _u, itemKey: _k, ...item }) => item);
    },
    async count(userId) {
      return mine(userId).length;
    },
    async remove(userId, id) {
      const at = rows.findIndex((r) => r.id === id && r.userId === userId);
      if (at < 0) return false;
      rows.splice(at, 1);
      return true;
    },
  };
}

let cached: { db: Db; repo: SwipeRepo } | undefined;

/** Swipe repo over the live database. Throws when DATABASE_URL is not set. */
export function getSwipeRepo(): SwipeRepo {
  const db = getDb();
  if (cached?.db !== db) cached = { db, repo: swipeRepo(db) };
  return cached.repo;
}
