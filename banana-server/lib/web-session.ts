/**
 * Who is signed in on the web (`/c/:id`, `/api/canvas/*`, account and pricing pages).
 *
 * The session lives in AuthKit's encrypted HttpOnly cookie (`wos-session`, iron-session
 * sealed with WORKOS_COOKIE_PASSWORD). proxy.ts runs `authkit()` on every path that calls
 * this, which reads the cookie, refreshes the access token when it is about to expire and
 * hands the session to `withAuth()`. On first sight the user gets a `users` row
 * (lib/users.ts `ensureUser`), same as the MCP bearer path.
 *
 * Never log the session, tokens or cookies.
 */
import type { Plan } from "@/lib/quota";
import { e2eAuthBypass, SESSION_COOKIE, webAuthConfig } from "@/lib/web-auth";

export type WebUser = {
  /** users.id */
  userId: string;
  /** WorkOS user id (`user_...`). */
  workosId: string;
  email: string | null;
  /** Read from the database on each call, so a plan change shows at once. */
  plan: Plan;
};

/** What the AuthKit session says about the user. */
export type SessionIdentity = { workosId: string; email: string | null };

export type WebSessionDeps = {
  /** The signed-in WorkOS user, or null. May throw; a throw means signed out. */
  readSession(): Promise<SessionIdentity | null>;
  ensureUser(workosId: string, email: string | null): Promise<{ id: string; email: string | null; plan: Plan }>;
  /** Fresh plan from the database (lib/users.ts caches rows for 5 minutes). */
  getPlan?(userId: string): Promise<Plan>;
  bypass?(): WebUser | null;
};

/** Fixed user for Playwright when E2E_AUTH_BYPASS=1 outside production (see lib/web-auth.ts). */
export const E2E_USER: WebUser = {
  userId: "00000000-0000-4000-8000-0000000000e2",
  workosId: "user_e2e",
  email: "e2e@example.test",
  plan: "pro_monthly",
};

export async function resolveWebUser(deps: WebSessionDeps): Promise<WebUser | null> {
  const bypassed = deps.bypass?.();
  if (bypassed) return bypassed;

  let identity: SessionIdentity | null;
  try {
    identity = await deps.readSession();
  } catch {
    // Not covered by the proxy, cookie sealed with an old password, and so on: signed out.
    return null;
  }
  if (!identity?.workosId) return null;

  // A database failure is not "signed out": let it surface so pages show an error
  // instead of a sign-in loop.
  const row = await deps.ensureUser(identity.workosId, identity.email);
  let plan = row.plan;
  if (deps.getPlan) {
    try {
      plan = await deps.getPlan(row.id);
    } catch {
      // Keep the cached plan.
    }
  }
  return { userId: row.id, workosId: identity.workosId, email: row.email ?? identity.email, plan };
}

/** Reads the session that proxy.ts verified (and refreshed). Null when signed out. */
async function readAuthKitSession(): Promise<SessionIdentity | null> {
  if (!webAuthConfig()) return null;
  const { withAuth } = await import("@workos-inc/authkit-nextjs");
  const { user } = await withAuth();
  if (!user?.id) return null;
  return { workosId: user.id, email: typeof user.email === "string" && user.email ? user.email : null };
}

export const liveWebSessionDeps: WebSessionDeps = {
  readSession: readAuthKitSession,
  ensureUser: async (workosId, email) => {
    const { ensureUser } = await import("@/lib/users");
    return ensureUser(workosId, email);
  },
  getPlan: async (userId) => {
    const { getRepos } = await import("@/lib/db");
    return getRepos().users.getPlan(userId);
  },
  bypass: () => (e2eAuthBypass() ? E2E_USER : null),
};

/** The signed-in web user, creating their `users` row on first sight. Null when signed out. */
export function getWebUser(deps: WebSessionDeps = liveWebSessionDeps): Promise<WebUser | null> {
  return resolveWebUser(deps);
}

/**
 * Drops the web session cookie (for example after account deletion). Call from a server
 * action or route handler. Does not end the WorkOS session; use the sign-out route for that.
 */
export async function clearWebSession(): Promise<void> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
