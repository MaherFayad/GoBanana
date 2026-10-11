import { getConfig } from "@/lib/config";
import { getRepos } from "@/lib/db";
import { getShareRepo } from "@/lib/db/shares";
import { authenticateRequest, isSameOrigin } from "@/lib/request-auth";
import { buildShareRoute } from "./handler";

export const dynamic = "force-dynamic";

const route = buildShareRoute({
  repos: getRepos,
  shares: getShareRepo,
  authenticate: authenticateRequest,
  appUrl: () => getConfig().appUrl,
  sameOrigin: (req) => isSameOrigin(req, getConfig().appUrl),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx): Promise<Response> {
  return route.GET(req, (await params).id);
}

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  return route.POST(req, (await params).id);
}

export async function DELETE(req: Request, { params }: Ctx): Promise<Response> {
  return route.DELETE(req, (await params).id);
}
