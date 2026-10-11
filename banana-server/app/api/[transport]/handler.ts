/**
 * MCP endpoint wiring, kept out of route.ts so tests can build it with a stub
 * verifier. Stateless Streamable HTTP (mcp-handler 2.x serves the 2026-07-28
 * spec and falls back to stateless 2025-era Streamable HTTP).
 */
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { APP_NAME, RESOURCE_METADATA_PATH } from "@/lib/config";
import { tools as defaultTools } from "@/lib/mcp/tools";
import type { RegisterTool } from "@/lib/mcp/tools/types";

type VerifyToken = (req: Request, bearerToken?: string) => Promise<AuthInfo | undefined>;

export function buildMcpHandler(tools: RegisterTool[] = defaultTools) {
  return createMcpHandler(
    (server) => {
      for (const register of tools) register(server);
    },
    { serverInfo: { name: APP_NAME, version: "0.1.0" } },
  );
}

/**
 * Wraps the MCP handler so every request needs a valid bearer token. Missing or
 * bad tokens get 401 with
 * `WWW-Authenticate: Bearer ..., resource_metadata="<origin>/.well-known/oauth-protected-resource"`.
 * `publicOrigin` overrides the origin used in that URL (APP_URL); when absent
 * it comes from the request and proxy headers.
 */
export function buildAuthedMcpHandler(opts: {
  verifyToken: VerifyToken;
  publicOrigin?: () => string | undefined;
  tools?: RegisterTool[];
}) {
  const mcp = buildMcpHandler(opts.tools);
  return (req: Request): Promise<Response> =>
    withMcpAuth(mcp, opts.verifyToken, {
      required: true,
      resourceMetadataPath: RESOURCE_METADATA_PATH,
      resourceUrl: opts.publicOrigin?.(),
    })(req);
}
