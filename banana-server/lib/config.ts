/**
 * App config read from the environment. This is the only place the product
 * name lives: use APP_NAME everywhere, never a hardcoded string.
 *
 * On Cloudflare Workers, OpenNext copies Worker vars and secrets into
 * process.env per request, so read request-time values through getConfig()
 * (not at module load). APP_NAME is a build-time constant so static pages
 * can use it.
 */

export const APP_NAME: string = process.env.APP_NAME?.trim() || "GoBanana";

/** Path of the RFC 9728 protected resource metadata document. */
export const RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource";

export type ServerConfig = {
  appName: string;
  /** Public origin, no trailing slash. Undefined means "derive from the request". */
  appUrl?: string;
  /** RFC 8707 resource id of the MCP endpoint. Tokens must carry it as `aud`. */
  mcpResourceUrl?: string;
  /** AuthKit issuer, for example https://example.authkit.app (no trailing slash). */
  authkitIssuer?: string;
  workosClientId?: string;
  workosApiKey?: string;
  databaseUrl?: string;
};

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Accepts "example.authkit.app" or "https://example.authkit.app/" and returns the https origin. */
export function normalizeIssuer(domain: string): string {
  const withScheme = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  return stripSlash(withScheme);
}

export function getConfig(): ServerConfig {
  const appUrl = read("APP_URL");
  const resource = read("MCP_RESOURCE_URL");
  const authkit = read("WORKOS_AUTHKIT_DOMAIN");
  return {
    appName: APP_NAME,
    appUrl: appUrl ? stripSlash(appUrl) : undefined,
    mcpResourceUrl: resource ? stripSlash(resource) : appUrl ? `${stripSlash(appUrl)}/api/mcp` : undefined,
    authkitIssuer: authkit ? normalizeIssuer(authkit) : undefined,
    workosClientId: read("WORKOS_CLIENT_ID"),
    workosApiKey: read("WORKOS_API_KEY"),
    databaseUrl: read("DATABASE_URL"),
  };
}
