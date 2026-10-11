/**
 * `/api/canvas/:id/share`: unlisted, view-only share links (spec section 12: Pro only;
 * hard rule 6). Kept out of route.ts so tests can build it with fakes.
 *
 * - GET    -> 200 `{ token, url }` (both null when the canvas is not shared).
 * - POST   -> 200 `{ token, url }`: creates a link, or replaces the old one (the old link
 *             stops working). 403 with an upgrade message on the free plan.
 * - DELETE -> 200 `{ token: null, url: null }`: turns the link off. Allowed on any plan, so
 *             someone who left Pro can still revoke.
 * 404 for both missing and not yours. Every response is `no-store` and `noindex`.
 */
import type { ShareRepo } from "@/lib/db/shares";
import type { Repos } from "@/lib/db/types";
import { limitsFor } from "@/lib/quota";
import { generateShareToken, shareUrl } from "@/lib/share";

export type ShareRouteDeps = {
  repos(): Pick<Repos, "users">;
  shares(): ShareRepo;
  /** users.id of the caller, or null when signed out. */
  authenticate(req: Request): Promise<string | null>;
  /** Public origin for links (APP_URL); falls back to the request origin. */
  appUrl(): string | undefined;
  /** Rejects cookie-authenticated writes from other sites. */
  sameOrigin(req: Request): boolean;
  newToken?: () => string;
};

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const SHARE_PRO_MESSAGE = "Share links are part of Pro.";

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

const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => json({ error, ...extra }, status);

export function buildShareRoute(deps: ShareRouteDeps) {
  const newToken = deps.newToken ?? (() => generateShareToken());

  function origin(req: Request): string {
    return deps.appUrl() ?? new URL(req.url).origin;
  }

  function linkBody(req: Request, token: string | null) {
    return { token, url: token ? shareUrl(origin(req), token) : null };
  }

  async function guard(req: Request, id: string, write: boolean): Promise<string | Response> {
    if (!ID_RE.test(id)) return fail(404, "Canvas not found.");
    if (write && !deps.sameOrigin(req)) return fail(403, "This request came from another site.");
    let userId: string | null;
    try {
      userId = await deps.authenticate(req);
    } catch {
      userId = null;
    }
    return userId ?? fail(401, "Sign in to share this canvas.");
  }

  async function run(fn: () => Promise<Response>): Promise<Response> {
    try {
      return await fn();
    } catch {
      console.error("[share api] request failed");
      return fail(503, "Share links are not available right now. Try again in a minute.");
    }
  }

  async function GET(req: Request, id: string): Promise<Response> {
    const userId = await guard(req, id, false);
    if (userId instanceof Response) return userId;
    return run(async () => {
      const token = await deps.shares().getToken(userId, id);
      if (token === undefined) return fail(404, "Canvas not found.");
      return json(linkBody(req, token));
    });
  }

  async function POST(req: Request, id: string): Promise<Response> {
    const userId = await guard(req, id, true);
    if (userId instanceof Response) return userId;
    return run(async () => {
      // Always the plan in the database, never a cached one: a lapsed plan must stop here.
      const plan = await deps.repos().users.getPlan(userId);
      if (!limitsFor(plan).shareLinks) {
        return fail(403, SHARE_PRO_MESSAGE, { upgradeUrl: `${origin(req)}/en/pricing` });
      }
      const shares = deps.shares();
      // A token clash (unique column) is astronomically unlikely; try once more if it happens.
      for (let attempt = 0; attempt < 2; attempt++) {
        const token = newToken();
        try {
          const ok = await shares.setToken(userId, id, token);
          if (!ok) return fail(404, "Canvas not found.");
          return json(linkBody(req, token));
        } catch (err) {
          if (attempt === 1) throw err;
        }
      }
      throw new Error("unreachable");
    });
  }

  async function DELETE(req: Request, id: string): Promise<Response> {
    const userId = await guard(req, id, true);
    if (userId instanceof Response) return userId;
    return run(async () => {
      const ok = await deps.shares().setToken(userId, id, null);
      if (!ok) return fail(404, "Canvas not found.");
      return json(linkBody(req, null));
    });
  }

  return { GET, POST, DELETE };
}
