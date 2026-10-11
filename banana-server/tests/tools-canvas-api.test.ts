/** /api/canvas/:id load and save, with in-memory repos and a stub authenticator. */
import { describe, expect, it, vi } from "vitest";
import { buildCanvasRoute } from "@/app/api/canvas/[id]/handler";
import { MAX_STATE_BYTES } from "@/lib/canvas/store";
import type { CanvasState } from "@/canvas/types";
import { ALICE, BOB, imageNode, makeDeps, seedCanvas, state } from "./tools-fixtures";

function setup(takedowns: string[] = []) {
  const { repos } = makeDeps({ takedowns });
  const authenticate = vi.fn(async (req: Request) => {
    const who = req.headers.get("x-test-user");
    return who === "alice" ? ALICE : who === "bob" ? BOB : null;
  });
  return { repos, route: buildCanvasRoute({ repos: () => repos, authenticate }) };
}

const req = (user: string | null, init: RequestInit = {}) =>
  new Request("https://app.example.test/api/canvas/x", {
    ...init,
    headers: { ...(user ? { "x-test-user": user } : {}), "content-type": "application/json", ...(init.headers ?? {}) },
  });

const put = (user: string | null, body: unknown) => req(user, { method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body) });

describe("GET /api/canvas/:id", () => {
  it("loads the owner's canvas with the takedown filter and no-store, noindex headers", async () => {
    const { repos, route } = setup(["https://www.pinterest.com/pin/2/"]);
    const c = await seedCanvas(repos, ALICE, state([imageNode("a", 1), imageNode("b", 2)]));
    const res = await route.GET(req("alice"), c.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const body = (await res.json()) as { state: CanvasState; removed: number; updatedAt: string };
    expect(body.state.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(body.removed).toBe(1);
    expect(body.updatedAt).toMatch(/^\d{4}-/);
  });

  it("answers 401 when signed out and 404 for someone else's canvas", async () => {
    const { repos, route } = setup();
    const c = await seedCanvas(repos, ALICE);
    expect((await route.GET(req(null), c.id)).status).toBe(401);
    const res = await route.GET(req("bob"), c.id);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Canvas not found." });
    expect((await route.GET(req("alice"), "../../etc")).status).toBe(404);
  });

  it("fails closed when the takedown list cannot load", async () => {
    const { repos, route } = setup();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const c = await seedCanvas(repos, ALICE, state([imageNode("a", 1)]));
    vi.spyOn(repos.takedowns, "list").mockRejectedValue(new Error("down"));
    const res = await route.GET(req("alice"), c.id);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("pinterest");
  });
});

describe("PUT /api/canvas/:id", () => {
  it("saves valid state for the owner", async () => {
    const { repos, route } = setup();
    const c = await seedCanvas(repos, ALICE);
    const res = await route.PUT(put("alice", { state: state([imageNode("a", 1)]) }), c.id);
    expect(res.status).toBe(200);
    expect(((await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState).nodes).toHaveLength(1);
  });

  it("denies other users and signed out callers", async () => {
    const { repos, route } = setup();
    const c = await seedCanvas(repos, ALICE);
    expect((await route.PUT(put("bob", { state: state([imageNode("a", 1)]) }), c.id)).status).toBe(404);
    expect((await route.PUT(put(null, { state: state() }), c.id)).status).toBe(401);
    expect(((await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState).nodes).toHaveLength(0);
  });

  it("refuses embedded image data (hard rule 2)", async () => {
    const { repos, route } = setup();
    const c = await seedCanvas(repos, ALICE);
    const n = imageNode("a", 1);
    (n.data as { thumbUrl: string }).thumbUrl = "data:image/jpeg;base64,/9j/4AAQ";
    const res = await route.PUT(put("alice", { state: state([n]) }), c.id);
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toEqual({ error: "Images must be links. Embedded image data cannot be saved." });
    const blob = imageNode("b", 2);
    (blob.data as { imageUrl: string }).imageUrl = "blob:https://app.example.test/123";
    expect((await route.PUT(put("alice", { state: state([blob]) }), c.id)).status).toBe(400);
  });

  it("caps the body size and rejects bad JSON", async () => {
    const { repos, route } = setup();
    const c = await seedCanvas(repos, ALICE);
    const huge = JSON.stringify({ state: { nodes: [], pad: "x".repeat(MAX_STATE_BYTES) } });
    expect((await route.PUT(put("alice", huge), c.id)).status).toBe(413);
    expect((await route.PUT(put("alice", "{not json"), c.id)).status).toBe(400);
    expect((await route.PUT(put("alice", { nodes: [] }), c.id)).status).toBe(400);
  });

  it("answers 409 when the canvas changed since baseUpdatedAt", async () => {
    const { repos, route } = setup();
    const c = await seedCanvas(repos, ALICE);
    const base = c.updatedAt.toISOString();
    expect((await route.PUT(put("alice", { state: state(), baseUpdatedAt: base }), c.id)).status).toBe(200);
    expect((await route.PUT(put("alice", { state: state(), baseUpdatedAt: base }), c.id)).status).toBe(409);
  });
});
