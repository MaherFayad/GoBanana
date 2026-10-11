import { getRepos } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { authenticateRequest, isSameOrigin } from "@/lib/request-auth";
import { buildCanvasRoute } from "./handler";

export const dynamic = "force-dynamic";

/** Bearer token first, then the web session cookie (lib/request-auth.ts). */
const route = buildCanvasRoute({ repos: getRepos, authenticate: authenticateRequest });

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
