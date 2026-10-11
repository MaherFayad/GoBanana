import { authkitOptionsFromEnv, verifyAuthKitToken, type AuthExtra } from "@/lib/auth";
import { getRepos } from "@/lib/db";
import { buildCanvasRoute } from "./handler";

export const dynamic = "force-dynamic";

/**
 * Who is calling. Two ways in:
 * 1. `Authorization: Bearer <AuthKit access token>`, the same token the MCP endpoint takes
 *    (used by the inline MCP Apps canvas).
 * 2. The web session cookie on `/c/:id`.
 *    TODO(auth): not wired. `@workos-inc/authkit-nextjs` needs its proxy (`authkit()` in
 *    proxy.ts, owned by the site work) plus an `/auth/callback` route, and its Workers
 *    support is not documented. See DECISIONS.md (2026-10-11, Auth, canvas API). Until
 *    then the web canvas gets 401 here.
 */
async function authenticate(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (match?.[1]) {
    if (!authkitOptionsFromEnv()) return null;
    const info = await verifyAuthKitToken(req, match[1].trim());
    return (info?.extra as AuthExtra | undefined)?.userId ?? null;
  }
  return null;
}

const route = buildCanvasRoute({ repos: getRepos, authenticate });

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx): Promise<Response> {
  return route.GET(req, (await params).id);
}

export async function PUT(req: Request, { params }: Ctx): Promise<Response> {
  return route.PUT(req, (await params).id);
}
