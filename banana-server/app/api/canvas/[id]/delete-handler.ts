/**
 * `DELETE /api/canvas/:id`: delete one canvas for good (lib/canvas-delete/delete.ts). Kept out
 * of route.ts so tests can build it with fakes (Next rejects extra route exports).
 *
 * - 200 `{ ok: true }` when the canvas and everything on it is gone.
 * - 404 for both missing and not yours, so ids cannot be probed.
 * - 403 for a cookie-authenticated request from another site (same check as the share route).
 * - 503 when the database or image storage is not available; nothing was deleted.
 * Every response is `no-store` and `noindex`. Errors are `{ error: "<plain message>" }`.
 */
import { deleteCanvas, type CanvasDeleteDeps } from "@/lib/canvas-delete/delete";

export type CanvasDeleteRouteDeps = {
  deps(): CanvasDeleteDeps;
  /** users.id of the caller, or null when signed out. */
  authenticate(req: Request): Promise<string | null>;
  /** Rejects cookie-authenticated writes from other sites. */
  sameOrigin(req: Request): boolean;
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

export function buildCanvasDeleteRoute(route: CanvasDeleteRouteDeps) {
  return async function DELETE(req: Request, id: string): Promise<Response> {
    if (!ID_RE.test(id)) return fail(404, "Canvas not found.");
    if (!route.sameOrigin(req)) return fail(403, "This request came from another site.");
    let userId: string | null;
    try {
      userId = await route.authenticate(req);
    } catch {
      userId = null;
    }
    if (!userId) return fail(401, "Sign in to delete this canvas.");
    try {
      const out = await deleteCanvas(route.deps(), userId, id);
      if (out.ok) return json({ ok: true });
      return out.reason === "not_found"
        ? fail(404, "Canvas not found.")
        : fail(503, "Could not delete this canvas right now. Nothing was deleted. Try again in a minute.");
    } catch {
      console.error("[canvas api] delete failed");
      return fail(503, "Could not delete this canvas right now. Try again in a minute.");
    }
  };
}
