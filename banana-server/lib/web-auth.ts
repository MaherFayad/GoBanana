/**
 * Web sign-in config (WorkOS AuthKit through @workos-inc/authkit-nextjs).
 *
 * Pure: reads process.env at call time only, no Next or WorkOS imports, so proxy.ts,
 * routes and Vitest can all use it. Never log the cookie password or any session data.
 */
import { getConfig } from "@/lib/config";

/** Where "Sign in" links point. Takes an optional `returnTo` (a path on this site). */
export const SIGN_IN_PATH = "/auth/sign-in";
/** POST here to sign out. */
export const SIGN_OUT_PATH = "/auth/sign-out";
/** AuthKit redirects here with `code` and `state`. Add `${APP_URL}/auth/callback` in WorkOS. */
export const CALLBACK_PATH = "/auth/callback";
/** Where a user lands after signing in when no `returnTo` was given. */
export const DEFAULT_RETURN_PATH = "/en/account";
/** The library's default session cookie name (WORKOS_COOKIE_NAME is not set). */
export const SESSION_COOKIE = "wos-session";

export const MIN_COOKIE_PASSWORD = 32;

export type WebAuthConfig = {
  clientId: string;
  /** Callback URL registered in WorkOS. */
  redirectUri: string;
  /** Public origin, used as the callback's redirect base. Undefined means "use the request URL". */
  appUrl?: string;
};

function read(name: string): string | undefined {
  // Dynamic access on purpose: Next inlines `process.env.NEXT_PUBLIC_*` member reads at
  // build time, and the Worker gets its values at run time.
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/**
 * Web sign-in settings, or null when any required value is missing (then every page acts
 * signed out and the sign-in route says sign-in is not set up). Required:
 * WORKOS_CLIENT_ID, WORKOS_API_KEY, WORKOS_COOKIE_PASSWORD (32+ characters), and a
 * redirect URI (NEXT_PUBLIC_WORKOS_REDIRECT_URI, or APP_URL + /auth/callback).
 */
export function webAuthConfig(): WebAuthConfig | null {
  const { appUrl, workosClientId, workosApiKey } = getConfig();
  const password = read("WORKOS_COOKIE_PASSWORD");
  if (!workosClientId || !workosApiKey || !password || password.length < MIN_COOKIE_PASSWORD) return null;
  const redirectUri = read("NEXT_PUBLIC_WORKOS_REDIRECT_URI") ?? (appUrl ? `${appUrl}${CALLBACK_PATH}` : undefined);
  if (!redirectUri) return null;
  try {
    new URL(redirectUri);
  } catch {
    return null;
  }
  return { clientId: workosClientId, redirectUri, ...(appUrl ? { appUrl } : {}) };
}

/**
 * Test-only sign-in bypass for Playwright. Can never be on in production: Next inlines
 * `process.env.NODE_ENV` at build time, so this is constant false in a production build
 * (and on the Worker) whatever E2E_AUTH_BYPASS says.
 */
export function e2eAuthBypass(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.E2E_AUTH_BYPASS === "1";
}

/**
 * A safe place to send the user after sign-in: a path on this site, or null.
 * Rejects absolute URLs, protocol-relative `//host` and backslash tricks (open redirect).
 */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  // Control characters (tabs and newlines are stripped by URL parsers, turning "/\t/x" into "//x").
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return null;
  }
  try {
    const url = new URL(value, "https://placeholder.invalid");
    if (url.origin !== "https://placeholder.invalid") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** `/auth/sign-in?returnTo=<path>` for a page that needs a signed-in user. */
export function signInHref(returnTo?: string | null): string {
  const safe = safeReturnTo(returnTo);
  return safe ? `${SIGN_IN_PATH}?returnTo=${encodeURIComponent(safe)}` : SIGN_IN_PATH;
}

/**
 * Paths where proxy.ts runs AuthKit (reads the session cookie, refreshes it when it is
 * about to expire). Everything that calls getWebUser() must be covered.
 */
export function needsWebSession(pathname: string): boolean {
  return /^\/(c|en|ar)(\/|$)/.test(pathname) || /^\/api\/(canvas|uploads)(\/|$)/.test(pathname) || pathname === SIGN_OUT_PATH;
}

/** Paths where a signed-out visitor goes straight to AuthKit. */
export function requiresSignIn(pathname: string): boolean {
  return /^\/c\/[^/]+/.test(pathname);
}

/** Small HTML page for sign-in errors (fixed copy only, never request data). */
export function messagePage(title: string, body: string, status: number, link = { href: "/en", label: "Go to the home page" }): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><meta name="color-scheme" content="dark"><title>${title}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;color:#f4f4f5;background:#000}a{color:#9bdcff}a:focus-visible{outline:2px solid #9bdcff;outline-offset:2px}@media (prefers-color-scheme:dark){body{color:#eee;background:#111}a{color:#8ab4ff}}</style></head><body><main><h1>${title}</h1><p>${body}</p><p><a href="${link.href}">${link.label}</a></p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
