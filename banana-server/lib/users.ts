/**
 * Maps an AuthKit token subject to a `users` row, creating it on first sight
 * (spec section 12, flow step 1).
 *
 * AuthKit access tokens carry `sub` but no `email`, so on first sight (or while
 * the stored email is still empty) we look the user up once with the WorkOS
 * User Management API. Results are cached per isolate for a few minutes so most
 * requests cost no database query at all.
 */
import { eq, sql } from "drizzle-orm";
import { getConfig } from "@/lib/config";
import { getDb } from "@/db/client";
import { users, type Plan } from "@/db/schema";

export type AppUser = { id: string; workosId: string; email: string | null; plan: Plan };

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { user: AppUser; expires: number }>();

function remember(user: AppUser): AppUser {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(user.workosId, { user, expires: Date.now() + CACHE_TTL_MS });
  return user;
}

/** Drops the cached row, for example after a plan change from a webhook. */
export function forgetUser(workosId: string): void {
  cache.delete(workosId);
}

/** Fetches the user's email from WorkOS. Returns null on any failure; never logs the key. */
export async function fetchWorkosEmail(
  workosId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const apiKey = getConfig().workosApiKey;
  if (!apiKey) return null;
  try {
    const res = await fetchImpl(
      `https://api.workos.com/user_management/users/${encodeURIComponent(workosId)}`,
      { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } },
    );
    if (!res.ok) {
      console.warn(`[users] WorkOS user lookup failed with status ${res.status}`);
      return null;
    }
    const body = (await res.json()) as { email?: unknown };
    return typeof body.email === "string" && body.email ? body.email : null;
  } catch {
    console.warn("[users] WorkOS user lookup failed");
    return null;
  }
}

/**
 * Returns the user row for a WorkOS user id, creating it if needed.
 * `emailHint` is used when the token already carries an email claim.
 */
export async function ensureUser(workosId: string, emailHint?: string | null): Promise<AppUser> {
  const hit = cache.get(workosId);
  if (hit && hit.expires > Date.now() && hit.user.email) return hit.user;

  const db = getDb();
  const select = { id: users.id, workosId: users.workosId, email: users.email, plan: users.plan };
  const [existing] = await db.select(select).from(users).where(eq(users.workosId, workosId)).limit(1);
  if (existing?.email) return remember(existing);

  const email = emailHint ?? (await fetchWorkosEmail(workosId));
  if (existing) {
    if (!email) return remember(existing);
    const [updated] = await db
      .update(users)
      .set({ email })
      .where(eq(users.workosId, workosId))
      .returning(select);
    return remember(updated ?? { ...existing, email });
  }

  const [created] = await db
    .insert(users)
    .values({ workosId, email })
    // A parallel first request may have won the race; keep any email it stored.
    .onConflictDoUpdate({
      target: users.workosId,
      set: { email: sql`coalesce(excluded.email, ${users.email})` },
    })
    .returning(select);
  if (!created) throw new Error("Could not create user row");
  return remember(created);
}
