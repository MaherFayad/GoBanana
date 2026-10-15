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
  /**
   * Public origin of the site, no trailing slash. PUBLIC_ORIGIN (the custom domain) wins over
   * APP_URL (the workers.dev URL). Undefined means "derive from the request".
   */
  appUrl?: string;
  /** Custom domain origin. Undefined while the custom domain is switched off (the default). */
  publicOrigin?: string;
  /** Origin that serves the MCP endpoint: MCP_ORIGIN, else PUBLIC_ORIGIN. Undefined while off. */
  mcpOrigin?: string;
  /** The workers.dev APP_URL, only while a custom domain is on: it still works and redirects. */
  legacyAppUrl?: string;
  /** The workers.dev MCP resource URL, only while a custom domain is on: old tokens keep working. */
  legacyMcpResourceUrl?: string;
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

/** The https origin of a URL, or undefined for anything else (so a typo leaves the custom domain off). */
export function httpsOrigin(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The site origin from the environment: PUBLIC_ORIGIN (custom domain) when set, else APP_URL.
 * For code that cannot call getConfig (module scope, the Worker entry).
 */
export function readAppUrl(): string | undefined {
  const origin = httpsOrigin(read("PUBLIC_ORIGIN"));
  const url = origin ?? read("APP_URL");
  return url ? stripSlash(url) : undefined;
}

export function getConfig(): ServerConfig {
  const appUrlEnv = read("APP_URL");
  const publicOrigin = httpsOrigin(read("PUBLIC_ORIGIN"));
  const mcpOrigin = httpsOrigin(read("MCP_ORIGIN")) ?? publicOrigin;
  const appUrl = publicOrigin ?? (appUrlEnv ? stripSlash(appUrlEnv) : undefined);
  const resourceEnv = read("MCP_RESOURCE_URL");
  const oldResource = resourceEnv ? stripSlash(resourceEnv) : appUrlEnv ? `${stripSlash(appUrlEnv)}/api/mcp` : undefined;
  const mcpResourceUrl = mcpOrigin ? `${mcpOrigin}/api/mcp` : oldResource;
  const authkit = read("WORKOS_AUTHKIT_DOMAIN");
  const customOn = !!(publicOrigin || mcpOrigin);
  return {
    appName: APP_NAME,
    appUrl,
    ...(publicOrigin ? { publicOrigin } : {}),
    ...(mcpOrigin ? { mcpOrigin } : {}),
    ...(customOn && appUrlEnv && stripSlash(appUrlEnv) !== appUrl ? { legacyAppUrl: stripSlash(appUrlEnv) } : {}),
    ...(customOn && oldResource && oldResource !== mcpResourceUrl ? { legacyMcpResourceUrl: oldResource } : {}),
    mcpResourceUrl,
    authkitIssuer: authkit ? normalizeIssuer(authkit) : undefined,
    workosClientId: read("WORKOS_CLIENT_ID"),
    workosApiKey: read("WORKOS_API_KEY"),
    databaseUrl: read("DATABASE_URL"),
  };
}
