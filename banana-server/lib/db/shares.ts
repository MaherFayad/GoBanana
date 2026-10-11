/**
 * Share links on `canvases.share_token` (spec section 12: Pro only; hard rule 6: unlisted,
 * view only). Kept apart from the main CanvasRepo port so share code has its own small
 * surface: set or clear a token for an owned canvas, and read a shared canvas by token.
 *
 * `getShared` selects only what the view-only page shows (title and state), plus the
 * owner's plan so a lapsed plan stops serving the link. Never user ids or emails.
 */
import { and, eq } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { canvases, users } from "@/db/schema";
import { planOf, type Plan } from "@/lib/quota";
import { isValidShareToken } from "@/lib/share";
import { isUuid } from "./ids";
import type { CanvasRecord } from "./types";

export type SharedCanvas = { title: string; state: unknown; ownerPlan: Plan };

export interface ShareRepo {
  /** Current token of an owned canvas. `undefined` when the canvas is missing or not the user's. */
  getToken(userId: string, canvasId: string): Promise<string | null | undefined>;
  /** Set (or clear with null) the token. False when the canvas is missing or not the user's. */
  setToken(userId: string, canvasId: string, token: string | null): Promise<boolean>;
  getShared(token: string): Promise<SharedCanvas | null>;
}

export function shareRepo(db: Db): ShareRepo {
  const owned = (userId: string, canvasId: string) => and(eq(canvases.id, canvasId), eq(canvases.userId, userId));
  return {
    async getToken(userId, canvasId) {
      if (!isUuid(userId) || !isUuid(canvasId)) return undefined;
      const [row] = await db.select({ token: canvases.shareToken }).from(canvases).where(owned(userId, canvasId)).limit(1);
      return row ? row.token : undefined;
    },
    async setToken(userId, canvasId, token) {
      if (!isUuid(userId) || !isUuid(canvasId)) return false;
      // updated_at is left alone so a share change never makes the open editor see a conflict.
      const rows = await db
        .update(canvases)
        .set({ shareToken: token })
        .where(owned(userId, canvasId))
        .returning({ id: canvases.id });
      return rows.length > 0;
    },
    async getShared(token) {
      if (!isValidShareToken(token)) return null;
      const [row] = await db
        .select({ title: canvases.title, state: canvases.state, plan: users.plan })
        .from(canvases)
        .innerJoin(users, eq(users.id, canvases.userId))
        .where(eq(canvases.shareToken, token))
        .limit(1);
      return row ? { title: row.title, state: row.state, ownerPlan: planOf(row.plan) } : null;
    },
  };
}

/** In-memory version over the canvases map of lib/db/memory.ts (tests). */
export function memoryShareRepo(canvasMap: Map<string, CanvasRecord>, plans: Map<string, Plan> = new Map()): ShareRepo {
  const owned = (userId: string, canvasId: string) => {
    const c = canvasMap.get(canvasId);
    return c && c.userId === userId ? c : null;
  };
  return {
    async getToken(userId, canvasId) {
      const c = owned(userId, canvasId);
      return c ? c.shareToken : undefined;
    },
    async setToken(userId, canvasId, token) {
      const c = owned(userId, canvasId);
      if (!c) return false;
      if (token !== null) {
        for (const other of canvasMap.values()) {
          if (other.id !== canvasId && other.shareToken === token) throw new Error("share token already used");
        }
      }
      canvasMap.set(canvasId, { ...c, shareToken: token });
      return true;
    },
    async getShared(token) {
      if (!isValidShareToken(token)) return null;
      for (const c of canvasMap.values()) {
        if (c.shareToken === token) {
          return { title: c.title, state: JSON.parse(JSON.stringify(c.state ?? null)) as unknown, ownerPlan: plans.get(c.userId) ?? "free" };
        }
      }
      return null;
    },
  };
}

let cached: { db: Db; repo: ShareRepo } | undefined;

/** Share repo over the live database. Throws when DATABASE_URL is not set. */
export function getShareRepo(): ShareRepo {
  const db = getDb();
  if (cached?.db !== db) cached = { db, repo: shareRepo(db) };
  return cached.repo;
}
