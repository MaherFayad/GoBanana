/**
 * AuthKit access token verification for the MCP endpoint.
 *
 * Tokens are JWTs signed by AuthKit. We check the signature against the
 * AuthKit JWKS (https://<authkit domain>/oauth2/jwks), the issuer (the AuthKit
 * domain) and the audience (MCP_RESOURCE_URL, the RFC 8707 resource the client
 * asked for). Never log tokens or keys: failures log a reason code only.
 */
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { getConfig } from "@/lib/config";

export type AccessClaims = JWTPayload & {
  sub: string;
  client_id?: string;
  scope?: string;
  org_id?: string;
  sid?: string;
  email?: string;
};

export type VerifyOptions = {
  issuer: string;
  audience: string;
  /** More accepted audiences: the workers.dev resource URL while a custom domain is on. */
  extraAudiences?: string[];
  /** Key set. Defaults to the AuthKit remote JWKS; tests inject a local one. */
  jwks?: JWTVerifyGetKey;
  /** Seconds of clock skew to allow. */
  clockTolerance?: number;
};

/** What tools read from `ctx.http?.authInfo?.extra`. */
export type AuthExtra = {
  /** users.id, or undefined if the user row could not be loaded. */
  userId?: string;
  workosId: string;
  email?: string;
};

const jwksByIssuer = new Map<string, JWTVerifyGetKey>();

/** Remote JWKS for an AuthKit issuer, cached per isolate (jose also caches keys). */
export function authkitJwks(issuer: string): JWTVerifyGetKey {
  let jwks = jwksByIssuer.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL("/oauth2/jwks", issuer));
    jwksByIssuer.set(issuer, jwks);
  }
  return jwks;
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Verifies an access token. Returns its claims, or null if the token is
 * missing, malformed, badly signed, expired, or has the wrong issuer or audience.
 */
export async function verifyAccessToken(
  token: string | undefined,
  opts: VerifyOptions,
): Promise<AccessClaims | null> {
  if (!token) return null;
  const audiences = [opts.audience, ...(opts.extraAudiences ?? [])].map(stripSlash);
  try {
    const { payload } = await jwtVerify(token, opts.jwks ?? authkitJwks(opts.issuer), {
      issuer: [stripSlash(opts.issuer), `${stripSlash(opts.issuer)}/`],
      audience: audiences.flatMap((a) => [a, `${a}/`]),
      algorithms: ["RS256"],
      clockTolerance: opts.clockTolerance ?? 5,
      requiredClaims: ["sub", "exp"],
    });
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return payload as AccessClaims;
  } catch (err) {
    const code = err instanceof joseErrors.JOSEError ? err.code : "ERR_UNKNOWN";
    console.warn(`[auth] token rejected: ${code}`);
    return null;
  }
}

export type ResolvedUser = { id: string; email: string | null };

export type TokenVerifierDeps = {
  /** Issuer, audience and key set; read per request so Worker env is available. */
  options: () => VerifyOptions | null;
  /** Maps the token subject to a users row (create on first sight). */
  resolveUser?: (claims: AccessClaims) => Promise<ResolvedUser>;
};

/** Builds AuthInfo for the MCP SDK from verified claims. */
export function toAuthInfo(token: string, claims: AccessClaims, audience: string, user?: ResolvedUser): AuthInfo {
  const email = user?.email ?? (typeof claims.email === "string" ? claims.email : undefined);
  const extra: AuthExtra = { workosId: claims.sub, userId: user?.id, email: email ?? undefined };
  let resource: URL | undefined;
  try {
    resource = new URL(audience);
  } catch {
    resource = undefined;
  }
  return {
    token,
    clientId: typeof claims.client_id === "string" ? claims.client_id : "",
    scopes: typeof claims.scope === "string" ? claims.scope.split(" ").filter(Boolean) : [],
    expiresAt: claims.exp,
    resource,
    extra,
  };
}

/**
 * Returns a `verifyToken` callback for mcp-handler's `withMcpAuth`.
 * Resolves to undefined for any bad token, so withMcpAuth answers 401 with a
 * WWW-Authenticate challenge that points at the protected resource metadata.
 */
export function createTokenVerifier(deps: TokenVerifierDeps) {
  return async (_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
    if (!bearerToken) return undefined;
    const opts = deps.options();
    if (!opts) {
      console.error("[auth] WORKOS_AUTHKIT_DOMAIN or MCP_RESOURCE_URL is not set");
      return undefined;
    }
    const claims = await verifyAccessToken(bearerToken, opts);
    if (!claims) return undefined;

    let user: ResolvedUser | undefined;
    if (deps.resolveUser) {
      try {
        user = await deps.resolveUser(claims);
      } catch (err) {
        // Keep the request authenticated; tools that need a user row say so plainly.
        console.error(`[auth] user lookup failed: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }
    return toAuthInfo(bearerToken, claims, opts.audience, user);
  };
}

/** Verify options from env, or null when auth is not configured. */
export function authkitOptionsFromEnv(): VerifyOptions | null {
  const { authkitIssuer, mcpResourceUrl, legacyMcpResourceUrl } = getConfig();
  if (!authkitIssuer || !mcpResourceUrl) return null;
  return { issuer: authkitIssuer, audience: mcpResourceUrl, ...(legacyMcpResourceUrl ? { extraAudiences: [legacyMcpResourceUrl] } : {}) };
}

/** The production verifier: AuthKit JWKS + users row upsert. */
export const verifyAuthKitToken = createTokenVerifier({
  options: authkitOptionsFromEnv,
  resolveUser: async (claims) => {
    const { ensureUser } = await import("@/lib/users");
    return ensureUser(claims.sub, typeof claims.email === "string" ? claims.email : null);
  },
});

/** Reads our auth extras from a tool handler context. */
export function authExtra(ctx: { http?: { authInfo?: AuthInfo } }): AuthExtra | undefined {
  const extra = ctx.http?.authInfo?.extra as AuthExtra | undefined;
  return extra?.workosId ? extra : undefined;
}
