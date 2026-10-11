/**
 * `/api/canvas/:id` load and save (spec section 5). Kept out of route.ts so tests can
 * build it with fake repos and a stub authenticator (Next rejects extra route exports).
 *
 * Contract (canvas/persistence.ts):
 * - GET -> 200 `{ state, title, updatedAt, removed }`, takedown filter applied.
 * - PUT `{ state, baseUpdatedAt? }` -> 200 `{ ok: true, updatedAt }`; 409 when
 *   `baseUpdatedAt` is given and the canvas changed since.
 * Every response is `no-store` and `noindex`. Errors are `{ error: "<plain message>" }`.
 */
import { loadCanvas, MAX_STATE_BYTES, validateSaveBody } from "@/lib/canvas/store";
import { memoTakedowns } from "@/lib/db/takedowns";
import type { Repos } from "@/lib/db/types";

export type CanvasRouteDeps = {
  repos(): Repos;
  /** users.id of the caller, or null when signed out. */
  authenticate(req: Request): Promise<string | null>;
};

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

const fail = (status: number, error: string) => json({ error }, status);

/** Read at most `max` bytes of the body. Null when it is larger. */
async function readCapped(req: Request, max: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

export function buildCanvasRoute(deps: CanvasRouteDeps) {
  async function guard(req: Request, id: string): Promise<{ userId: string; repos: Repos } | Response> {
    if (!ID_RE.test(id)) return fail(404, "Canvas not found.");
    let userId: string | null;
    try {
      userId = await deps.authenticate(req);
    } catch {
      userId = null;
    }
    if (!userId) return fail(401, "Sign in to open this canvas.");
    try {
      return { userId, repos: deps.repos() };
    } catch {
      console.error("[canvas api] database is not configured");
      return fail(503, "Canvas storage is not available right now. Try again in a minute.");
    }
  }

  async function GET(req: Request, id: string): Promise<Response> {
    const ctx = await guard(req, id);
    if (ctx instanceof Response) return ctx;
    try {
      const loaded = await loadCanvas(ctx.repos, ctx.userId, id, memoTakedowns(ctx.repos.takedowns));
      // Same answer for "missing" and "not yours", so ids cannot be probed.
      if (!loaded) return fail(404, "Canvas not found.");
      return json({
        state: loaded.state,
        title: loaded.canvas.title,
        updatedAt: loaded.canvas.updatedAt.toISOString(),
        removed: loaded.removed,
      });
    } catch {
      console.error("[canvas api] load failed");
      return fail(500, "Could not load this canvas. Try again in a minute.");
    }
  }

  async function PUT(req: Request, id: string): Promise<Response> {
    const ctx = await guard(req, id);
    if (ctx instanceof Response) return ctx;
    const text = await readCapped(req, MAX_STATE_BYTES).catch(() => null);
    if (text === null) return fail(413, "This canvas is too large to save.");
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return fail(400, "The canvas data is not valid.");
    }
    const valid = validateSaveBody(body, new TextEncoder().encode(text).byteLength);
    if (!valid.ok) return fail(valid.status, valid.message);
    try {
      const saved = await ctx.repos.canvases.saveState(ctx.userId, id, valid.state, {
        ...(valid.baseUpdatedAt ? { ifUpdatedAt: valid.baseUpdatedAt } : {}),
      });
      if (!saved.ok) {
        return saved.reason === "conflict"
          ? fail(409, "This canvas changed somewhere else. Reload to see the latest version.")
          : fail(404, "Canvas not found.");
      }
      return json({ ok: true, updatedAt: saved.updatedAt.toISOString() });
    } catch {
      console.error("[canvas api] save failed");
      return fail(500, "Could not save this canvas. Try again in a minute.");
    }
  }

  return { GET, PUT };
}
