/** Web sign-in: session to users row, config, safe return paths, the E2E bypass, account data. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAccountUsage, getSiteUser } from "@/lib/site/session";
import {
  e2eAuthBypass,
  messagePage,
  needsWebSession,
  requiresSignIn,
  safeReturnTo,
  SIGN_IN_PATH,
  signInHref,
  webAuthConfig,
} from "@/lib/web-auth";
import { E2E_USER, resolveWebUser, type WebSessionDeps } from "@/lib/web-session";
import { createMemoryRepos } from "@/lib/db/memory";
import { ALICE } from "./tools-fixtures";

afterEach(() => {
  vi.unstubAllEnvs();
});

function deps(over: Partial<WebSessionDeps> = {}): WebSessionDeps & { ensureUser: ReturnType<typeof vi.fn> } {
  const ensureUser = vi.fn(async (_workosId: string, email: string | null) => ({ id: ALICE, email, plan: "free" as const }));
  return {
    readSession: async () => ({ workosId: "user_01ABC", email: "a@example.test" }),
    ensureUser,
    ...over,
  } as WebSessionDeps & { ensureUser: ReturnType<typeof vi.fn> };
}

describe("getWebUser (resolveWebUser)", () => {
  it("maps the AuthKit session to the users row, creating it on first sight", async () => {
    const d = deps();
    const user = await resolveWebUser(d);
    expect(user).toEqual({ userId: ALICE, workosId: "user_01ABC", email: "a@example.test", plan: "free" });
    expect(d.ensureUser).toHaveBeenCalledWith("user_01ABC", "a@example.test");
  });

  it("reads the plan fresh from the database when it can", async () => {
    const user = await resolveWebUser(deps({ getPlan: async () => "pro_yearly" }));
    expect(user?.plan).toBe("pro_yearly");
    const fallback = await resolveWebUser(
      deps({
        getPlan: async () => {
          throw new Error("db down");
        },
      }),
    );
    expect(fallback?.plan).toBe("free");
  });

  it("is null when signed out or the session cannot be read", async () => {
    expect(await resolveWebUser(deps({ readSession: async () => null }))).toBeNull();
    const broken = deps({
      readSession: async () => {
        throw new Error("You are calling 'withAuth' on a route that isn't covered by the AuthKit middleware");
      },
    });
    expect(await resolveWebUser(broken)).toBeNull();
    expect(broken.ensureUser).not.toHaveBeenCalled();
  });

  it("lets a database failure surface instead of looking signed out", async () => {
    const d = deps({
      ensureUser: async () => {
        throw new Error("DATABASE_URL is not set");
      },
    });
    await expect(resolveWebUser(d)).rejects.toThrow("DATABASE_URL");
  });

  it("uses the bypass user only when the bypass says so", async () => {
    const d = deps({ bypass: () => E2E_USER });
    expect(await resolveWebUser(d)).toEqual(E2E_USER);
    expect(d.ensureUser).not.toHaveBeenCalled();
    expect(await resolveWebUser(deps({ bypass: () => null }))).toMatchObject({ userId: ALICE });
  });
});

describe("E2E auth bypass", () => {
  it("needs E2E_AUTH_BYPASS=1 and is never on in production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_AUTH_BYPASS", "");
    expect(e2eAuthBypass()).toBe(false);
    vi.stubEnv("E2E_AUTH_BYPASS", "1");
    expect(e2eAuthBypass()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(e2eAuthBypass()).toBe(false);
  });
});

describe("webAuthConfig", () => {
  const base = {
    WORKOS_CLIENT_ID: "client_123",
    WORKOS_API_KEY: "sk_test_123",
    WORKOS_COOKIE_PASSWORD: "x".repeat(32),
    APP_URL: "https://app.example.test/",
    NEXT_PUBLIC_WORKOS_REDIRECT_URI: "",
  };
  const stub = (env: Record<string, string>) => {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  };

  it("derives the redirect URI from APP_URL", () => {
    stub(base);
    expect(webAuthConfig()).toEqual({
      clientId: "client_123",
      redirectUri: "https://app.example.test/auth/callback",
      appUrl: "https://app.example.test",
    });
  });

  it("prefers NEXT_PUBLIC_WORKOS_REDIRECT_URI", () => {
    stub({ ...base, NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://other.example.test/auth/callback" });
    expect(webAuthConfig()?.redirectUri).toBe("https://other.example.test/auth/callback");
  });

  it("is off when a value is missing or the cookie password is short", () => {
    stub({ ...base, WORKOS_COOKIE_PASSWORD: "short" });
    expect(webAuthConfig()).toBeNull();
    stub({ ...base, WORKOS_API_KEY: "" });
    expect(webAuthConfig()).toBeNull();
    stub({ ...base, APP_URL: "" });
    expect(webAuthConfig()).toBeNull();
  });
});

describe("safeReturnTo", () => {
  it("keeps paths on this site", () => {
    expect(safeReturnTo("/c/abc")).toBe("/c/abc");
    expect(safeReturnTo("/en/account?x=1#top")).toBe("/en/account?x=1#top");
  });

  it.each([
    "https://evil.example/",
    "//evil.example/x",
    "/\\evil.example",
    "/\t/evil.example",
    "javascript:alert(1)",
    "c/abc",
    "",
    null,
    undefined,
    `/${"a".repeat(600)}`,
  ])("rejects %s", (value) => {
    expect(safeReturnTo(value)).toBeNull();
  });

  it("builds sign-in links", () => {
    expect(signInHref("/c/abc")).toBe(`${SIGN_IN_PATH}?returnTo=%2Fc%2Fabc`);
    expect(signInHref("//evil.example")).toBe(SIGN_IN_PATH);
  });
});

describe("proxy path rules", () => {
  it("runs AuthKit where getWebUser is called", () => {
    for (const p of ["/c/x", "/en", "/ar/account", "/api/canvas/x", "/api/canvas/x/share", "/api/uploads", "/api/uploads/abc", "/auth/sign-out"]) {
      expect(needsWebSession(p)).toBe(true);
    }
    for (const p of ["/s/token", "/api/mcp", "/", "/auth/callback", "/english"]) {
      expect(needsWebSession(p)).toBe(false);
    }
  });

  it("sends signed-out visitors to AuthKit only on the canvas editor", () => {
    expect(requiresSignIn("/c/x")).toBe(true);
    expect(requiresSignIn("/en/account")).toBe(false);
    expect(requiresSignIn("/api/canvas/x")).toBe(false);
  });
});

describe("messagePage", () => {
  it("is a noindex, no-store HTML page", async () => {
    const res = messagePage("Sign in is not available", "Try again later.", 503);
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const html = await res.text();
    expect(html).toContain("<h1>Sign in is not available</h1>");
    expect(html).not.toMatch(/—/);
  });
});

describe("account data (lib/site/session.ts)", () => {
  it("getSiteUser maps the web user and its Paddle customer id", async () => {
    const user = await getSiteUser({
      getWebUser: async () => ({ userId: ALICE, workosId: "user_1", email: "a@example.test", plan: "founding" }),
      paddleCustomerId: async () => "ctm_1",
    });
    expect(user).toEqual({ id: ALICE, email: "a@example.test", plan: "founding", paddleCustomerId: "ctm_1" });
    expect(await getSiteUser({ getWebUser: async () => null })).toBeNull();
  });

  it("getAccountUsage reads this month's searches and counts owned canvases", async () => {
    const repos = createMemoryRepos();
    await repos.usage.addSearches(ALICE, "2026-10", 7);
    await repos.canvases.create({ userId: ALICE, title: "A", state: {} });
    await repos.canvases.create({ userId: ALICE, title: "B", state: {} });
    const usage = await getAccountUsage(ALICE, { repos: () => repos, now: new Date("2026-10-20T00:00:00Z") });
    expect(usage).toEqual({ period: "2026-10", searches: 7, canvases: 2 });
  });

  it("getAccountUsage is null when storage fails", async () => {
    const usage = await getAccountUsage(ALICE, {
      repos: () => {
        throw new Error("DATABASE_URL is not set");
      },
    });
    expect(usage).toBeNull();
  });
});
