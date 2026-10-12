import { getRepos } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { authenticateRequest, isSameOrigin } from "@/lib/request-auth";
import { liveCanvasDeleteDeps } from "@/lib/canvas-delete/db";
import { buildCanvasDeleteRoute } from "./delete-handler";
import { buildCanvasRoute } from "./handler";

export const dynamic = "force-dynamic";

/** Bearer token first, then the web session cookie (lib/request-auth.ts). */
const route = buildCanvasRoute({ repos: getRepos, authenticate: authenticateRequest });

const remove = buildCanvasDeleteRoute({
  deps: liveCanvasDeleteDeps,
  authenticate: authenticateRequest,
  sameOrigin: (req) => isSameOrigin(req, getConfig().appUrl),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx): Promise<Response> {
  return route.GET(req, (await params).id);
}

export async function PUT(req: Request, { params }: Ctx): Promise<Response> {
  if (!isSameOrigin(req, getConfig().appUrl)) {
    return Response.json({ error: "This request came from another site." }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  return route.PUT(req, (await params).id);
}

/** Deletes the canvas for good (lib/canvas-delete/delete.ts). */
export async function DELETE(req: Request, { params }: Ctx): Promise<Response> {
  return remove(req, (await params).id);
}
