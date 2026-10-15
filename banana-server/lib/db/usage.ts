/**
 * `usage` table: searches, canvases and Serper credits per user per `YYYY-MM` period (spec section 11).
 * Increments are one atomic upsert, so parallel calls never lose a count.
 */
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { usage } from "@/db/schema";
import type { Usage } from "@/lib/quota";
import { isUuid } from "./ids";
import type { UsageRepo } from "./types";

export async function readUsage(db: Db, userId: string, period: string): Promise<Usage> {
  if (!isUuid(userId)) return { searches: 0, canvases: 0 };
  const [row] = await db
    .select({ searches: usage.searches, canvases: usage.canvases })
    .from(usage)
    .where(and(eq(usage.userId, userId), eq(usage.period, period)))
    .limit(1);
  return row ?? { searches: 0, canvases: 0 };
}

export async function incrementUsage(
  db: Db,
  userId: string,
  period: string,
  by: { searches?: number; canvases?: number; serperCredits?: number },
): Promise<void> {
  const searches = Math.max(0, Math.floor(by.searches ?? 0));
  const canvasCount = Math.max(0, Math.floor(by.canvases ?? 0));
  const credits = Math.max(0, Math.floor(by.serperCredits ?? 0));
  if (!isUuid(userId) || (searches === 0 && canvasCount === 0 && credits === 0)) return;
  await db
    .insert(usage)
    .values({ userId, period, searches, canvases: canvasCount, serperCredits: credits })
    .onConflictDoUpdate({
      target: [usage.userId, usage.period],
      set: {
        searches: sql`${usage.searches} + ${searches}`,
        canvases: sql`${usage.canvases} + ${canvasCount}`,
        serperCredits: sql`${usage.serperCredits} + ${credits}`,
      },
    });
}

/** Serper credits all users spent in the period (one small sum over the period's rows). */
export async function sumCredits(db: Db, period: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string | number | null>`coalesce(sum(${usage.serperCredits}), 0)` })
    .from(usage)
    .where(eq(usage.period, period));
  return Number(row?.total ?? 0);
}

export function usageRepo(db: Db): UsageRepo {
  return {
    get: (userId, period) => readUsage(db, userId, period),
    addSearches: (userId, period, by) => incrementUsage(db, userId, period, { searches: by }),
    addCanvases: (userId, period, by) => incrementUsage(db, userId, period, { canvases: by }),
    addCredits: (userId, period, by) => incrementUsage(db, userId, period, { serperCredits: by }),
    creditsUsed: (period) => sumCredits(db, period),
  };
}
