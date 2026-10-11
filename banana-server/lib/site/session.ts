/**
 * Web session and account data for the site pages (account, pricing).
 * The session itself is lib/web-session.ts (AuthKit cookie, verified in proxy.ts).
 */
import { eq } from "drizzle-orm";
import { currentPeriod, type Plan } from "@/lib/quota";
import type { Repos } from "@/lib/db/types";
import { getWebUser, type WebUser } from "@/lib/web-session";
import { SIGN_IN_PATH as WEB_SIGN_IN_PATH } from "@/lib/web-auth";

export type SiteUser = { id: string; email: string | null; plan: Plan; paddleCustomerId: string | null };

export type AccountUsage = {
  /** `YYYY-MM` (UTC). */
  period: string;
  searches: number;
  /** Canvases the user owns now (the plan limit counts owned canvases, spec section 12). */
  canvases: number;
};

/** Where the "Sign in" links point. Takes `?returnTo=<path on this site>`. */
export const SIGN_IN_PATH = WEB_SIGN_IN_PATH;

async function paddleCustomerIdOf(userId: string): Promise<string | null> {
  try {
    const [{ getDb }, { users }, { isUuid }] = await Promise.all([
      import("@/db/client"),
      import("@/db/schema"),
      import("@/lib/db/ids"),
    ]);
    if (!isUuid(userId)) return null;
    const [row] = await getDb()
      .select({ paddleCustomerId: users.paddleCustomerId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.paddleCustomerId ?? null;
  } catch {
    return null;
  }
}

/** The signed-in user for site pages, or null when signed out. */
export async function getSiteUser(
  deps: { getWebUser?: () => Promise<WebUser | null>; paddleCustomerId?: (userId: string) => Promise<string | null> } = {},
): Promise<SiteUser | null> {
  const user = await (deps.getWebUser ?? getWebUser)();
  if (!user) return null;
  const paddleCustomerId = await (deps.paddleCustomerId ?? paddleCustomerIdOf)(user.userId);
  return { id: user.userId, email: user.email, plan: user.plan, paddleCustomerId };
}

/** This month's searches and the number of canvases the user owns. Null when the data cannot load. */
export async function getAccountUsage(
  userId: string,
  deps: { repos?: () => Repos | Pick<Repos, "usage" | "canvases">; now?: Date } = {},
): Promise<AccountUsage | null> {
  try {
    const repos = deps.repos ? deps.repos() : (await import("@/lib/db")).getRepos();
    const period = currentPeriod(deps.now);
    const [usage, canvases] = await Promise.all([repos.usage.get(userId, period), repos.canvases.countOwned(userId)]);
    return { period, searches: usage.searches, canvases };
  } catch {
    console.error("[account] usage could not load");
    return null;
  }
}
