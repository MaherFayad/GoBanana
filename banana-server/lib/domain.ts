/**
 * Custom domain redirect (DIST-02). Off until PUBLIC_ORIGIN is set. The workers.dev URL keeps
 * serving the MCP endpoint, OAuth, the canvas view assets and icons so current connectors keep
 * working; every other page request on a workers.dev host (GET or HEAD) redirects to the
 * same path on PUBLIC_ORIGIN.
 */
import { httpsOrigin } from "@/lib/config";

/** Paths that stay on the workers.dev host: machine clients and in-flight sign-ins. */
const STAY_PREFIXES = ["/api/", "/.well-known/", "/auth/", "/mcp-app/", "/brand/", "/_next/"];

export function legacyRedirect(requestUrl: string, method: string, env: { PUBLIC_ORIGIN?: string }): string | null {
  const target = httpsOrigin(env.PUBLIC_ORIGIN);
  if (!target) return null;
  if (method !== "GET" && method !== "HEAD") return null;
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (!url.hostname.endsWith(".workers.dev")) return null;
  if (url.origin === target) return null;
  if (STAY_PREFIXES.some((p) => url.pathname.startsWith(p))) return null;
  return `${target}${url.pathname}${url.search}`;
}
