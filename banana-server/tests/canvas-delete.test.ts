/**
 * Canvas deletion (owner asked 2026-10-12): lib/canvas-delete, the delete_canvas MCP tool and
 * DELETE /api/canvas/:id. In-memory repos that cascade like the schema, a fake R2 bucket, and
 * the schema itself checked so the cascade is real.
 */
import { getTableConfig } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/neon-http";
import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { buildCanvasDeleteRoute } from "@/app/api/canvas/[id]/delete-handler";
import type { StoredNode } from "@/canvas/types";
import { createDbCanvasDeleteRepo } from "@/lib/canvas-delete/db";
import { deleteCanvas, uploadIdsInState, type CanvasDeleteDeps } from "@/lib/canvas-delete/delete";
import { memoryCanvasDeleteRepo, memoryUploadRows } from "@/lib/canvas-delete/memory";
import { createMemoryRepos, type MemoryRepos } from "@/lib/db/memory";
import { createDeleteCanvasTool, TOOL_DESCRIPTION } from "@/lib/mcp/tools/delete_canvas";
import { isSameOrigin } from "@/lib/request-auth";
import { uploadKey, uploadPath } from "@/lib/uploads/rules";
import { fakeR2, type FakeR2 } from "./fake-r2";
import { ALICE, APP, BOB, imageNode, ref, seedCanvas, state, text } from "./tools-fixtures";

const UP1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const UP2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const UP_BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

function uploadNode(id: string, uploadId: string): StoredNode {
  const n = imageNode(id, 1);
  const path = uploadPath(uploadId);
  return { ...n, type: "upload", data: { ...n.data, imageUrl: path, thumbUrl: path, sourceUrl: path } } as StoredNode;
}

type World = { repos: MemoryRepos; bucket: FakeR2; uploads: ReturnType<typeof memoryUploadRows>; deps: CanvasDeleteDeps };

function world(opts: { bucket?: FakeR2 | null } = {}): World {
  const repos = createMemoryRepos();
  const bucket = opts.bucket === undefined ? fakeR2() : opts.bucket;
  const uploads = memoryUploadRows();
  for (const [id, userId] of [
    [UP1, ALICE],
    [UP2, ALICE],
    [UP_BOB, BOB],
  ] as const) {
    uploads.rows.set(id, { id, userId, r2Key: uploadKey(userId, id), mime: "image/png", bytes: 10 });
    bucket?.objects.set(uploadKey(userId, id), { bytes: new Uint8Array([1]) });
  }
  const deps: CanvasDeleteDeps = { canvases: memoryCanvasDeleteRepo(repos.data), uploads, bucket: () => bucket ?? null };
  return { repos, bucket: bucket as FakeR2, uploads, deps };
}

/** Alice's board with directions, references, a palette, a tray, a share link and two uploads. */
async function fullBoard(w: World) {
  const c = await seedCanvas(w.repos, ALICE, state([imageNode("n1", 1), uploadNode("n2", UP1), uploadNode("n3", UP2)], [ref(9)]));
  await w.repos.directions.upsertMany(c.id, [{ bendId: "bd-1", move: "invert", title: "Flip", searchQuery: "flip ui" }]);
  await w.repos.references.insertMany(c.id, [ref(1)]);
  await w.repos.palettes.insert(c.id, ["#000000"], {});
  w.repos.data.canvases.get(c.id)!.shareToken = "tok_share";
  return c;
}

describe("uploadIdsInState", () => {
  it("finds upload paths in node data, once each, and ignores everything else", () => {
    const s = state([imageNode("a", 1), uploadNode("b", UP1), uploadNode("c", UP1), uploadNode("d", UP2)]);
    expect(uploadIdsInState(s).sort()).toEqual([UP1, UP2]);
    expect(uploadIdsInState(null)).toEqual([]);
    expect(uploadIdsInState({ nodes: [{ data: { imageUrl: "/api/uploads/not-a-uuid" } }] })).toEqual([]);
  });
});

describe("deleteCanvas", () => {
  it("deletes the canvas row with its directions, references, palettes, tray and share link, and its uploads in R2", async () => {
    const w = world();
    const keep = await seedCanvas(w.repos, ALICE, state(), "Other");
    await w.repos.directions.upsertMany(keep.id, [{ bendId: "bd-2", move: "invert", title: "Keep", searchQuery: "keep" }]);
    const c = await fullBoard(w);
    expect(await w.repos.canvases.countOwned(ALICE)).toBe(2);

    const out = await deleteCanvas(w.deps, ALICE, c.id);

    expect(out).toEqual({ ok: true, title: "Board", uploadsDeleted: 2 });
    expect(w.repos.data.canvases.has(c.id)).toBe(false);
    expect(w.repos.data.directions.filter((d) => d.canvasId === c.id)).toEqual([]);
    expect([...w.repos.data.references.values()].filter((r) => r.canvasId === c.id)).toEqual([]);
    expect(w.repos.data.palettes.filter((p) => p.canvasId === c.id)).toEqual([]);
    // Another canvas and its rows are untouched; the free plan slot is back.
    expect(w.repos.data.directions.filter((d) => d.canvasId === keep.id)).toHaveLength(1);
    expect(await w.repos.canvases.countOwned(ALICE)).toBe(1);
    // R2 cleanup: Alice's two uploads are gone (objects and rows), Bob's stays.
    expect(w.bucket.objects.has(uploadKey(ALICE, UP1))).toBe(false);
    expect(w.bucket.objects.has(uploadKey(ALICE, UP2))).toBe(false);
    expect(w.uploads.rows.has(UP1)).toBe(false);
    expect(w.bucket.objects.has(uploadKey(BOB, UP_BOB))).toBe(true);
    expect(w.bucket.calls.delete).toBe(1);
  });

  it("keeps an upload another of the user's canvases still shows", async () => {
    const w = world();
    const c = await fullBoard(w);
    await seedCanvas(w.repos, ALICE, state([uploadNode("x", UP2)]), "Also shows UP2");
    const out = await deleteCanvas(w.deps, ALICE, c.id);
    expect(out).toMatchObject({ ok: true, uploadsDeleted: 1 });
    expect(w.bucket.objects.has(uploadKey(ALICE, UP1))).toBe(false);
    expect(w.bucket.objects.has(uploadKey(ALICE, UP2))).toBe(true);
    expect(w.uploads.rows.has(UP2)).toBe(true);
  });

  it("never touches someone else's upload, even when the board shows its path", async () => {
    const w = world();
    const c = await seedCanvas(w.repos, ALICE, state([uploadNode("x", UP_BOB)]));
    expect(await deleteCanvas(w.deps, ALICE, c.id)).toMatchObject({ ok: true, uploadsDeleted: 0 });
    expect(w.bucket.objects.has(uploadKey(BOB, UP_BOB))).toBe(true);
    expect(w.uploads.rows.has(UP_BOB)).toBe(true);
    expect(w.bucket.calls.delete).toBe(0);
  });

  it("only the owner can delete: another user gets not_found and nothing changes", async () => {
    const w = world();
    const c = await fullBoard(w);
    expect(await deleteCanvas(w.deps, BOB, c.id)).toEqual({ ok: false, reason: "not_found" });
    expect(await deleteCanvas(w.deps, ALICE, "not-a-uuid")).toEqual({ ok: false, reason: "not_found" });
    expect(await deleteCanvas(w.deps, ALICE, BOB)).toEqual({ ok: false, reason: "not_found" });
    expect(w.repos.data.canvases.has(c.id)).toBe(true);
    expect(w.bucket.objects.size).toBe(3);
  });

  it("keeps the canvas when R2 is missing or fails, so the user can try again", async () => {
    const missing = world({ bucket: null });
    const c1 = await fullBoard(missing);
    expect(await deleteCanvas(missing.deps, ALICE, c1.id)).toEqual({ ok: false, reason: "storage_unavailable" });
    expect(missing.repos.data.canvases.has(c1.id)).toBe(true);

    const failing = world({ bucket: fakeR2({ failDelete: true }) });
    const c2 = await fullBoard(failing);
    expect(await deleteCanvas(failing.deps, ALICE, c2.id)).toEqual({ ok: false, reason: "storage_unavailable" });
    expect(failing.repos.data.canvases.has(c2.id)).toBe(true);
    expect(failing.uploads.rows.has(UP1)).toBe(true);
  });

  it("does not need R2 for a canvas without uploads", async () => {
    const w = world({ bucket: null });
    const c = await seedCanvas(w.repos, ALICE, state([imageNode("n1", 1)]));
    expect(await deleteCanvas(w.deps, ALICE, c.id)).toEqual({ ok: true, title: "Board", uploadsDeleted: 0 });
  });
});

describe("delete_canvas tool", () => {
  it("requires confirm: true and deletes nothing without it", async () => {
    const w = world();
    const c = await fullBoard(w);
    const tool = createDeleteCanvasTool(() => w.deps);
    for (const args of [{ canvasId: c.id }, { canvasId: c.id, confirm: false }, { canvasId: c.id, confirm: "true" }]) {
      const res = await tool(args, ALICE);
      expect(res.isError).toBe(true);
      expect(text(res)).toMatch(/Nothing was deleted\. Ask the user to confirm/);
    }
    expect(w.repos.data.canvases.has(c.id)).toBe(true);
  });

  it("deletes the canvas with confirm: true", async () => {
    const w = world();
    const c = await fullBoard(w);
    const res = await createDeleteCanvasTool(() => w.deps)({ canvasId: c.id, confirm: true }, ALICE);
    expect(res.isError).toBeUndefined();
    expect(text(res)).toBe('Deleted canvas "Board" for good.');
    expect(res.structuredContent).toEqual({ deleted: true, canvasId: c.id, title: "Board", uploadsDeleted: 2 });
    expect(w.repos.data.canvases.has(c.id)).toBe(false);
  });

  it("answers not found to another user, and asks to sign in when signed out", async () => {
    const w = world();
    const c = await fullBoard(w);
    const tool = createDeleteCanvasTool(() => w.deps);
    expect(text(await tool({ canvasId: c.id, confirm: true }, BOB))).toMatch(/not found/);
    expect(text(await tool({ canvasId: c.id, confirm: true }, undefined))).toMatch(/not signed in/);
    expect(w.repos.data.canvases.has(c.id)).toBe(true);
  });

  it("turns a database failure into a plain message", async () => {
    const tool = createDeleteCanvasTool(() => {
      throw new Error("DATABASE_URL missing");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await tool({ canvasId: ALICE, confirm: true }, ALICE);
    spy.mockRestore();
    expect(text(res)).toMatch(/Try again in a minute/);
  });

  it("has a short, plain description that tells the agent to ask first", () => {
    expect(TOOL_DESCRIPTION).toMatch(/cannot be undone/);
    expect(TOOL_DESCRIPTION).toMatch(/Ask the user first/);
    expect(TOOL_DESCRIPTION).not.toMatch(/[—–]/);
  });
});

describe("DELETE /api/canvas/:id", () => {
  function setup() {
    const w = world();
    const route = buildCanvasDeleteRoute({
      deps: () => w.deps,
      authenticate: async (req) => {
        const who = req.headers.get("x-test-user");
        return who === "alice" ? ALICE : who === "bob" ? BOB : null;
      },
      sameOrigin: (req) => isSameOrigin(req, APP),
    });
    return { w, route };
  }
  const req = (user: string | null, headers: Record<string, string> = {}) =>
    new Request(`${APP}/api/canvas/x`, { method: "DELETE", headers: { ...(user ? { "x-test-user": user } : {}), ...headers } });

  it("deletes the owner's canvas", async () => {
    const { w, route } = setup();
    const c = await fullBoard(w);
    const res = await route(req("alice", { origin: APP }), c.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(await res.json()).toEqual({ ok: true });
    expect(w.repos.data.canvases.has(c.id)).toBe(false);
    expect(w.bucket.objects.has(uploadKey(ALICE, UP1))).toBe(false);
  });

  it("answers 404 to another user, 401 when signed out, 403 from another site", async () => {
    const { w, route } = setup();
    const c = await fullBoard(w);
    expect((await route(req("bob"), c.id)).status).toBe(404);
    expect((await route(req(null), c.id)).status).toBe(401);
    expect((await route(req("alice", { origin: "https://evil.example" }), c.id)).status).toBe(403);
    expect((await route(req("alice"), "../x")).status).toBe(404);
    expect(w.repos.data.canvases.has(c.id)).toBe(true);
  });

  it("answers 503 when storage is down, and keeps the canvas", async () => {
    const { w, route } = setup();
    const c = await fullBoard(w);
    w.deps.bucket = () => null;
    const res = await route(req("alice"), c.id);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toMatch(/Nothing was deleted/);
    expect(w.repos.data.canvases.has(c.id)).toBe(true);
  });
});

describe("canvas delete SQL and schema", () => {
  it("every canvas-owned table cascades from canvases", () => {
    for (const t of [schema.directions, schema.references, schema.palettes]) {
      const fks = getTableConfig(t).foreignKeys.filter((fk) => getTableConfig(fk.reference().foreignTable).name === "canvases");
      expect(fks.map((fk) => fk.onDelete), getTableConfig(t).name).toEqual(["cascade"]);
    }
  });

  it("scopes the delete and the other-canvas check to the owner", async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return { rows: sql.startsWith("delete") ? [[BOB]] : [], fields: [], rowCount: 1, command: "" };
    });
    const db = drizzle({ client: { query } as never, schema }) as unknown as Db;
    const repo = createDbCanvasDeleteRepo(() => db);

    expect(await repo.deleteOwned(ALICE, BOB)).toBe(true);
    expect(calls[0]!.sql).toMatch(/^delete from "canvases" where \("canvases"\."id" = \$1 and "canvases"\."user_id" = \$2\) returning "id"$/);
    expect(calls[0]!.params).toEqual([BOB, ALICE]);

    expect(await repo.uploadsShownElsewhere(ALICE, BOB, [UP1])).toEqual(new Set());
    expect(calls[1]!.sql).toMatch(/"canvases"\."user_id" = \$1 and "canvases"\."id" <> \$2 and "canvases"\."state"::text LIKE \$3/);
    expect(calls[1]!.params).toEqual([ALICE, BOB, `%/api/uploads/${UP1}%`, 1]);

    expect(await repo.deleteOwned(ALICE, "x")).toBe(false);
    expect(await repo.findOwned("x", BOB)).toBeNull();
    expect(calls).toHaveLength(2);
  });
});
