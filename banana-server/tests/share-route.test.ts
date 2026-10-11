/** Share links: /api/canvas/:id/share, the /s/:token loader and the /c/:id page loader. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildShareRoute, SHARE_PRO_MESSAGE } from "@/app/api/canvas/[id]/share/handler";
import { loadCanvasForPage, loadSharedCanvas } from "@/canvas/server-load";
import { createMemoryRepos, type MemoryRepos } from "@/lib/db/memory";
import { memoryShareRepo } from "@/lib/db/shares";
import { memoTakedowns } from "@/lib/db/takedowns";
import type { Plan } from "@/lib/quota";
import { isSameOrigin } from "@/lib/request-auth";
import { isValidShareToken } from "@/lib/share";
import type { WebUser } from "@/lib/web-session";
import { ALICE, APP, BOB, imageNode, seedCanvas, state } from "./tools-fixtures";

beforeEach(() => {
  // These tests are about the stored plan; the beta override has its own test.
  vi.stubEnv("BETA_PLAN", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

function setup(plans: Record<string, Plan> = { [ALICE]: "pro_monthly" }, takedowns: string[] = []) {
  const repos: MemoryRepos = createMemoryRepos({ plans, takedowns });
  const shares = memoryShareRepo(repos.data.canvases, repos.data.plans);
  const authenticate = vi.fn(async (req: Request) => {
    const who = req.headers.get("x-test-user");
    return who === "alice" ? ALICE : who === "bob" ? BOB : null;
  });
  let n = 0;
  const route = buildShareRoute({
    repos: () => repos,
    shares: () => shares,
    authenticate,
    appUrl: () => APP,
    sameOrigin: (req) => isSameOrigin(req, APP),
    newToken: () => `tok_${String(++n).padStart(22, "0")}`,
  });
  return { repos, shares, route };
}

const req = (user: string | null, method: string, headers: Record<string, string> = {}) =>
  new Request(`${APP}/api/canvas/x/share`, { method, headers: { ...(user ? { "x-test-user": user } : {}), ...headers } });

describe("POST /api/canvas/:id/share", () => {
  it("creates a view-only link for a Pro owner, then replaces it", async () => {
    const { repos, route } = setup();
    const c = await seedCanvas(repos, ALICE);
    const res = await route.POST(req("alice", "POST"), c.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const first = (await res.json()) as { token: string; url: string };
    expect(first.url).toBe(`${APP}/s/${first.token}`);
    expect(repos.data.canvases.get(c.id)?.shareToken).toBe(first.token);

    const again = (await (await route.POST(req("alice", "POST"), c.id)).json()) as { token: string };
    expect(again.token).not.toBe(first.token);
    expect(repos.data.canvases.get(c.id)?.shareToken).toBe(again.token);
  });

  it("uses real random tokens by default", async () => {
    const repos = createMemoryRepos({ plans: { [ALICE]: "founding" } });
    const route = buildShareRoute({
      repos: () => repos,
      shares: () => memoryShareRepo(repos.data.canvases),
      authenticate: async () => ALICE,
      appUrl: () => undefined,
      sameOrigin: () => true,
    });
    const c = await seedCanvas(repos, ALICE);
    const body = (await (await route.POST(req("alice", "POST"), c.id)).json()) as { token: string; url: string };
    expect(isValidShareToken(body.token)).toBe(true);
    // No APP_URL: the link uses the request origin.
    expect(body.url).toBe(`${APP}/s/${body.token}`);
  });

  it("refuses the free plan with an upgrade link and stores nothing", async () => {
    const { repos, route } = setup({ [ALICE]: "free" });
    const c = await seedCanvas(repos, ALICE);
    const res = await route.POST(req("alice", "POST"), c.id);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: SHARE_PRO_MESSAGE, upgradeUrl: `${APP}/en/pricing` });
    expect(repos.data.canvases.get(c.id)?.shareToken).toBeNull();
  });

  it("lets free users share while BETA_PLAN is on", async () => {
    vi.stubEnv("BETA_PLAN", "pro");
    const { repos, route } = setup({ [ALICE]: "free" });
    const c = await seedCanvas(repos, ALICE);
    expect((await route.POST(req("alice", "POST"), c.id)).status).toBe(200);
  });

  it("answers 401 signed out, 404 for someone else's canvas or a bad id", async () => {
    const { repos, route } = setup({ [ALICE]: "pro_monthly", [BOB]: "pro_monthly" });
    const c = await seedCanvas(repos, ALICE);
    expect((await route.POST(req(null, "POST"), c.id)).status).toBe(401);
    expect((await route.POST(req("bob", "POST"), c.id)).status).toBe(404);
    expect((await route.POST(req("alice", "POST"), "../etc")).status).toBe(404);
    expect(repos.data.canvases.get(c.id)?.shareToken).toBeNull();
  });

  it("rejects cookie writes from another site, but not bearer calls", async () => {
    const { repos, route } = setup();
    const c = await seedCanvas(repos, ALICE);
    expect((await route.POST(req("alice", "POST", { origin: "https://evil.example" }), c.id)).status).toBe(403);
    expect((await route.POST(req("alice", "POST", { origin: APP }), c.id)).status).toBe(200);
    expect(
      (await route.POST(req("alice", "POST", { origin: "https://claude.ai", authorization: "Bearer t" }), c.id)).status,
    ).toBe(200);
  });

  it("answers 503 with a plain message when storage fails", async () => {
    const broken = buildShareRoute({
      repos: () => {
        throw new Error("DATABASE_URL is not set");
      },
      shares: () => {
        throw new Error("DATABASE_URL is not set");
      },
      authenticate: async () => ALICE,
      appUrl: () => APP,
      sameOrigin: () => true,
    });
    const res = await broken.POST(req("alice", "POST"), "11111111-1111-4111-8111-000000000000");
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toMatch(/not available right now/);
  });
});

describe("GET and DELETE /api/canvas/:id/share", () => {
  it("GET shows the current link; DELETE turns it off on any plan", async () => {
    const { repos, route } = setup();
    const c = await seedCanvas(repos, ALICE);
    expect(await (await route.GET(req("alice", "GET"), c.id)).json()).toEqual({ token: null, url: null });
    const { token } = (await (await route.POST(req("alice", "POST"), c.id)).json()) as { token: string };
    expect(await (await route.GET(req("alice", "GET"), c.id)).json()).toEqual({ token, url: `${APP}/s/${token}` });

    repos.data.plans.set(ALICE, "free");
    const del = await route.DELETE(req("alice", "DELETE"), c.id);
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ token: null, url: null });
    expect(repos.data.canvases.get(c.id)?.shareToken).toBeNull();
  });

  it("GET and DELETE are owner only", async () => {
    const { repos, route } = setup();
    const c = await seedCanvas(repos, ALICE);
    expect((await route.GET(req("bob", "GET"), c.id)).status).toBe(404);
    expect((await route.DELETE(req("bob", "DELETE"), c.id)).status).toBe(404);
    expect((await route.DELETE(req(null, "DELETE"), c.id)).status).toBe(401);
  });
});

describe("loadSharedCanvas (/s/:token)", () => {
  async function shared(plan: Plan, takedowns: string[] = []) {
    const { repos, shares, route } = setup({ [ALICE]: plan === "free" ? "pro_monthly" : plan }, takedowns);
    const tray = [{ id: "r9", thumbUrl: "https://i.pinimg.com/t9.jpg", imageUrl: "https://i.pinimg.com/i9.jpg", sourceUrl: "https://www.pinterest.com/pin/9/", sourceSite: "pinterest.com" }];
    const c = await seedCanvas(repos, ALICE, state([imageNode("a", 1), imageNode("b", 2)], tray), "Glass board");
    const { token } = (await (await route.POST(req("alice", "POST"), c.id)).json()) as { token: string };
    repos.data.plans.set(ALICE, plan);
    return { token, deps: { shares: () => shares, loadMatcher: memoTakedowns(repos.takedowns) } };
  }

  it("returns title and filtered state only, never the tray", async () => {
    const { token, deps } = await shared("pro_monthly", ["https://www.pinterest.com/pin/2/"]);
    const out = await loadSharedCanvas(token, deps);
    expect(out?.title).toBe("Glass board");
    expect(out?.state.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(out?.removed).toBe(1);
    expect(out?.state.tray).toEqual([]);
    expect(Object.keys(out ?? {}).sort()).toEqual(["removed", "state", "title"]);
  });

  it("stops serving when the owner's plan no longer allows share links", async () => {
    const { token, deps } = await shared("free");
    expect(await loadSharedCanvas(token, deps)).toBeNull();
  });

  it("is null for unknown or malformed tokens", async () => {
    const { deps } = await shared("pro_monthly");
    expect(await loadSharedCanvas("A".repeat(24), deps)).toBeNull();
    expect(await loadSharedCanvas("bad token", deps)).toBeNull();
  });

  it("fails closed when the takedown list cannot load", async () => {
    const { token, deps } = await shared("pro_monthly");
    await expect(
      loadSharedCanvas(token, {
        ...deps,
        loadMatcher: async () => {
          throw new Error("db down");
        },
      }),
    ).rejects.toThrow();
  });
});

describe("loadCanvasForPage (/c/:id)", () => {
  const alice: WebUser = { userId: ALICE, workosId: "user_a", email: null, plan: "pro_monthly" };
  const bob: WebUser = { userId: BOB, workosId: "user_b", email: null, plan: "free" };

  it("loads the owner's canvas with the takedown filter and its version", async () => {
    const repos = createMemoryRepos({ takedowns: ["https://www.pinterest.com/pin/2/"] });
    const c = await seedCanvas(repos, ALICE, state([imageNode("a", 1), imageNode("b", 2)]), "Mine");
    const out = await loadCanvasForPage(c.id, { getUser: async () => alice, repos: () => repos });
    expect(out.kind).toBe("ok");
    if (out.kind !== "ok") return;
    expect(out.canvas.title).toBe("Mine");
    expect(out.canvas.state?.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(out.canvas.updatedAt).toBe(repos.data.canvases.get(c.id)?.updatedAt.toISOString());
    expect(out.canvas.canShare).toBe(true);
  });

  it("is signed_out without a session and not_found for someone else's canvas", async () => {
    const repos = createMemoryRepos();
    const c = await seedCanvas(repos, ALICE);
    expect((await loadCanvasForPage(c.id, { getUser: async () => null, repos: () => repos })).kind).toBe("signed_out");
    expect((await loadCanvasForPage(c.id, { getUser: async () => bob, repos: () => repos })).kind).toBe("not_found");
    expect((await loadCanvasForPage("no/slash", { getUser: async () => alice, repos: () => repos })).kind).toBe("not_found");
  });

  it("E2E bypass skips the database", async () => {
    const out = await loadCanvasForPage("e2e-canvas", {
      getUser: async () => alice,
      repos: () => {
        throw new Error("no db in e2e");
      },
      bypass: true,
    });
    expect(out).toMatchObject({ kind: "ok", canvas: { id: "e2e-canvas", state: null, updatedAt: null } });
  });
});
