/**
 * `user_taste` (migration 0007) behind a port, so tests pass an in-memory fake. One row per user;
 * the row cascades away with the user. Words, card ids and links only.
 */
import { eq, sql } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { userTaste } from "@/db/schema";
import { isUuid } from "@/lib/db/ids";
import {
  EMPTY_TASTE,
  MAX_PROFILE_IDS,
  MAX_PROFILE_URLS,
  MAX_PROFILE_WORDS,
  type UserTasteProfile,
} from "./index";

export interface TasteStore {
  get(userId: string): Promise<UserTasteProfile>;
  /** Replaces the whole profile. */
  save(userId: string, profile: Omit<UserTasteProfile, "updatedAt">): Promise<void>;
  /** Deletes the profile. */
  clear(userId: string): Promise<void>;
}

function clip(profile: Omit<UserTasteProfile, "updatedAt">) {
  return {
    likedCardIds: profile.likedCardIds.slice(0, MAX_PROFILE_IDS),
    styleWords: profile.styleWords.slice(0, MAX_PROFILE_WORDS),
    sourceUrls: profile.sourceUrls.slice(0, MAX_PROFILE_URLS),
  };
}

export function createDbTasteStore(db: () => Db = getDb): TasteStore {
  return {
    async get(userId) {
      if (!isUuid(userId)) return EMPTY_TASTE;
      const [row] = await db().select().from(userTaste).where(eq(userTaste.userId, userId)).limit(1);
      if (!row) return EMPTY_TASTE;
      return {
        likedCardIds: row.likedCardIds,
        styleWords: row.styleWords,
        sourceUrls: row.sourceUrls,
        updatedAt: row.updatedAt,
      };
    },
    async save(userId, profile) {
      if (!isUuid(userId)) return;
      const values = clip(profile);
      await db()
        .insert(userTaste)
        .values({ userId, ...values })
        .onConflictDoUpdate({ target: userTaste.userId, set: { ...values, updatedAt: sql`now()` } });
    },
    async clear(userId) {
      if (!isUuid(userId)) return;
      await db().delete(userTaste).where(eq(userTaste.userId, userId));
    },
  };
}
