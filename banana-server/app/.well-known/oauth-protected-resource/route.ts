import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * RFC 9728 protected resource metadata. Lists the AuthKit domain as the
 * authorization server; `resource` is MCP_RESOURCE_URL so it matches the token
 * audience. Also served at /.well-known/oauth-protected-resource/api/mcp for
 * clients that use the path-suffixed form.
 */
export function GET(req: Request): Response {
  const { authkitIssuer, mcpResourceUrl, legacyAppUrl, legacyMcpResourceUrl } = getConfig();
  // A client that reached us on the old workers.dev host keeps the old resource, so its tokens still match.
  const onLegacyHost = !!legacyAppUrl && new URL(req.url).origin === new URL(legacyAppUrl).origin;
  if (!authkitIssuer) {
    return Response.json({ error: "Authorization server is not configured" }, { status: 503 });
  }
  return protectedResourceHandler({
    authServerUrls: [authkitIssuer],
    resourceUrl: onLegacyHost && legacyMcpResourceUrl ? legacyMcpResourceUrl : mcpResourceUrl,
  })(req);
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
