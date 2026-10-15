/**
 * Caller identity for the canvas API routes (`/api/canvas/:id`, `/api/canvas/:id/share`).
 * Bearer first: `Authorization: Bearer <AuthKit access token>` (the inline MCP Apps canvas,
 * same verifier as /api/mcp). A request that sends an Authorization header is judged on
 * that header alone, with no cookie fallback. Otherwise the web session cookie
 * (lib/web-session.ts; proxy.ts runs AuthKit on /api/canvas/*).
 */
import { authkitOptionsFromEnv, verifyAuthKitToken, type AuthExtra } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { getWebUser } from "@/lib/web-session";

/** users.id of the caller, or null when signed out or the token is bad. */
export async function authenticateRequest(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (header !== null) {
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match?.[1] || !authkitOptionsFromEnv()) return null;
    const info = await verifyAuthKitToken(req, match[1].trim());
    return (info?.extra as AuthExtra | undefined)?.userId ?? null;
  }
  return (await getWebUser())?.userId ?? null;
}

/**
 * For cookie-authenticated writes: true when the request comes from this site. The session
 * cookie is SameSite=Lax, which already keeps it off cross-site POST, PUT and DELETE; this
 * is a second check. Requests without an Origin header (non-browser clients) pass.
 */
export function isSameOrigin(req: Request, appUrl?: string): boolean {
  const { legacyAppUrl } = getConfig();
  if (req.headers.has("authorization")) return true;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const allowed = new Set<string>([new URL(req.url).origin]);
  // While a custom domain is on, the workers.dev site is still the same site (it redirects).
  for (const url of [appUrl, legacyAppUrl]) {
    if (!url) continue;
    try {
      allowed.add(new URL(url).origin);
    } catch {
      // ignore a malformed APP_URL
    }
  }
  return allowed.has(origin);
}
