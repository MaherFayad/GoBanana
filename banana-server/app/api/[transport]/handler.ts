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
import { registerCanvasResource } from "@/lib/mcp/resources/canvas";
import { SERVER_INSTRUCTIONS } from "@/lib/mcp/instructions";

type VerifyToken = (req: Request, bearerToken?: string) => Promise<AuthInfo | undefined>;

/** MCP resources: the inline canvas UI (`ui://banana/canvas`, MCP Apps). */
export const defaultResources: RegisterTool[] = [(server) => registerCanvasResource(server)];

/**
 * Icons for clients that show one next to the connector (MCP `Implementation.icons`). Absolute
 * URLs on APP_URL; left out when APP_URL is not set (tests, local dev without it).
 */
function serverIcons() {
  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (!appUrl) return undefined;
  return [
    { src: `${appUrl}/brand/app-icon-192.png`, mimeType: "image/png", sizes: ["192x192"] },
    { src: `${appUrl}/brand/mark-ink.svg`, mimeType: "image/svg+xml", sizes: ["any"], theme: "light" as const },
    { src: `${appUrl}/brand/mark-yellow.svg`, mimeType: "image/svg+xml", sizes: ["any"], theme: "dark" as const },
  ];
}

export function buildMcpHandler(tools: RegisterTool[] = defaultTools, resources: RegisterTool[] = defaultResources) {
  // mcp-handler types serverInfo as name and version only, but hands the object to McpServer
  // as is, and the SDK's Implementation takes icons.
  const serverInfo = { name: APP_NAME, version: "0.1.0", icons: serverIcons() };
  return createMcpHandler(
    (server) => {
      for (const register of tools) register(server);
      for (const register of resources) register(server);
    },
    // Instructions reach agents that use the connector without the plugin's skills.
    { serverInfo, instructions: SERVER_INSTRUCTIONS },
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
  resources?: RegisterTool[];
}) {
  const mcp = buildMcpHandler(opts.tools, opts.resources);
  return (req: Request): Promise<Response> =>
    withMcpAuth(mcp, opts.verifyToken, {
      required: true,
      resourceMetadataPath: RESOURCE_METADATA_PATH,
      resourceUrl: opts.publicOrigin?.(),
    })(req);
}
