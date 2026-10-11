import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type CryptoKey, type JWTVerifyGetKey } from "jose";
import { createTokenVerifier, verifyAccessToken, type VerifyOptions } from "@/lib/auth";
import { buildAuthedMcpHandler } from "@/app/api/[transport]/handler";
import { GET as metadataGET } from "@/app/.well-known/oauth-protected-resource/route";

const ISSUER = "https://test.authkit.app";
const AUDIENCE = "https://banana.example.com/api/mcp";
const KID = "test-key-1";

let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;
let jwks: JWTVerifyGetKey;
let opts: VerifyOptions;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  otherPrivateKey = (await generateKeyPair("RS256")).privateKey;
  const jwk = await exportJWK(pair.publicKey);
  // Local key set: no network, stands in for https://<authkit>/oauth2/jwks.
  jwks = createLocalJWKSet({ keys: [{ ...jwk, kid: KID, alg: "RS256", use: "sig" }] });
  opts = { issuer: ISSUER, audience: AUDIENCE, jwks, clockTolerance: 0 };
});

afterEach(() => {
  vi.restoreAllMocks();
});

type TokenOverrides = { iss?: string; aud?: string; exp?: number; sub?: string; key?: CryptoKey; email?: string };

async function makeToken(o: TokenOverrides = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = { client_id: "client_abc", scope: "openid profile" };
  if (o.email) claims.email = o.email;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuer(o.iss ?? ISSUER)
    .setAudience(o.aud ?? AUDIENCE)
    .setSubject(o.sub ?? "user_01TEST")
    .setIssuedAt(now - 60)
    .setExpirationTime(o.exp ?? now + 300)
    .sign(o.key ?? privateKey);
}

describe("verifyAccessToken", () => {
  it("accepts a valid token", async () => {
    const claims = await verifyAccessToken(await makeToken(), opts);
    expect(claims?.sub).toBe("user_01TEST");
    expect(claims?.client_id).toBe("client_abc");
  });

  it("rejects the wrong issuer", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await verifyAccessToken(await makeToken({ iss: "https://evil.authkit.app" }), opts)).toBeNull();
  });

  it("rejects the wrong audience", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await verifyAccessToken(await makeToken({ aud: "https://other.example.com/api/mcp" }), opts)).toBeNull();
  });

  it("rejects an expired token", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const exp = Math.floor(Date.now() / 1000) - 120;
    expect(await verifyAccessToken(await makeToken({ exp }), opts)).toBeNull();
  });

  it("rejects a token signed by another key", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await verifyAccessToken(await makeToken({ key: otherPrivateKey }), opts)).toBeNull();
  });

  it("rejects missing and malformed tokens", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await verifyAccessToken(undefined, opts)).toBeNull();
    expect(await verifyAccessToken("not-a-jwt", opts)).toBeNull();
  });

  it("never logs the token", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const token = await makeToken({ aud: "https://other.example.com" });
    await verifyAccessToken(token, opts);
    const logged = warn.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain(token);
    expect(logged).not.toContain(token.split(".")[2]);
  });
});

describe("createTokenVerifier", () => {
  it("builds AuthInfo with the user row in extra", async () => {
    const verify = createTokenVerifier({
      options: () => opts,
      resolveUser: async (c) => ({ id: "uuid-1", email: `${c.sub}@example.com` }),
    });
    const info = await verify(new Request(AUDIENCE), await makeToken());
    expect(info?.clientId).toBe("client_abc");
    expect(info?.scopes).toEqual(["openid", "profile"]);
    expect(info?.resource?.href).toBe(AUDIENCE);
    expect(info?.extra).toEqual({ workosId: "user_01TEST", userId: "uuid-1", email: "user_01TEST@example.com" });
  });

  it("returns undefined when auth is not configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const verify = createTokenVerifier({ options: () => null });
    expect(await verify(new Request(AUDIENCE), await makeToken())).toBeUndefined();
  });
});

describe("MCP endpoint", () => {
  const authed = () =>
    buildAuthedMcpHandler({
      verifyToken: createTokenVerifier({
        options: () => opts,
        resolveUser: async () => ({ id: "uuid-1", email: "maher@example.com" }),
      }),
      publicOrigin: () => "https://banana.example.com",
    });

  const rpc = (body: unknown, token?: string) =>
    new Request(AUDIENCE, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  it("answers 401 with a WWW-Authenticate challenge pointing at the metadata", async () => {
    const res = await authed()(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }));
    expect(res.status).toBe(401);
    const challenge = res.headers.get("www-authenticate") ?? "";
    expect(challenge).toMatch(/^Bearer /);
    expect(challenge).toContain(
      'resource_metadata="https://banana.example.com/.well-known/oauth-protected-resource"',
    );
  });

  it("answers 401 for a token with the wrong audience", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await authed()(
      rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, await makeToken({ aud: "https://x.example" })),
    );
    expect(res.status).toBe(401);
  });

  it("runs ping and returns the signed-in email", async () => {
    const res = await authed()(
      rpc(
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "ping", arguments: {} } },
        await makeToken(),
      ),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    // JSON or a single SSE event, depending on the transport's response mode.
    const json = text.trim().startsWith("{")
      ? JSON.parse(text)
      : JSON.parse(text.split("\n").find((l) => l.startsWith("data:"))!.slice(5));
    expect(json.result.structuredContent).toEqual({ ok: true, app: expect.any(String), email: "maher@example.com" });
    expect(json.result.content[0].text).toContain("maher@example.com");
  });
});

describe("protected resource metadata", () => {
  it("lists the AuthKit domain as the authorization server", async () => {
    vi.stubEnv("WORKOS_AUTHKIT_DOMAIN", "test.authkit.app");
    vi.stubEnv("MCP_RESOURCE_URL", AUDIENCE);
    try {
      const res = metadataGET(new Request("https://banana.example.com/.well-known/oauth-protected-resource"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ resource: AUDIENCE, authorization_servers: [ISSUER] });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
