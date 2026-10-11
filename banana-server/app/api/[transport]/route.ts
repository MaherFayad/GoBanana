import { verifyAuthKitToken } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { buildAuthedMcpHandler } from "./handler";

export const dynamic = "force-dynamic";

const mcp = buildAuthedMcpHandler({
  verifyToken: verifyAuthKitToken,
  publicOrigin: () => getConfig().appUrl,
});

type Ctx = { params: Promise<{ transport: string }> };

// The MCP endpoint is /api/mcp. Other /api/<x> paths are not MCP.
async function handle(req: Request, { params }: Ctx): Promise<Response> {
  const { transport } = await params;
  if (transport !== "mcp") return new Response("Not found", { status: 404 });
  return mcp(req);
}

export { handle as GET, handle as POST, handle as DELETE };
