/**
 * Web session and account data for the site pages. Stubs until the web login
 * (AuthKit session cookie, owned by lib/auth.ts) and the db layer are wired.
 */
import type { Plan } from "@/lib/quota";

export type SiteUser = { id: string; email: string | null; plan: Plan; paddleCustomerId: string | null };

export type AccountUsage = {
  /** `YYYY-MM` (UTC). */
  period: string;
  searches: number;
  canvases: number;
};

/** Where the "Sign in" links point. TODO(auth): set to the AuthKit web login route once it exists. */
export const SIGN_IN_PATH = "/login";

/**
 * TODO(auth): read the AuthKit session cookie (lib/auth.ts), then load the row
 * with ensureUser() from lib/users.ts. Returns null when signed out.
 */
export async function getSiteUser(): Promise<SiteUser | null> {
  return null;
}

/** TODO(db): select from `usage` for (user_id, currentPeriod()) and count `canvases` for the user. */
export async function getAccountUsage(_userId: string): Promise<AccountUsage | null> {
  return null;
}
