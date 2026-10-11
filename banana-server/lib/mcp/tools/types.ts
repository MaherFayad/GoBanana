import type { McpServer } from "@modelcontextprotocol/server";

/**
 * Every MCP tool lives in its own file in lib/mcp/tools/ and exports a
 * `register` function of this type. app/api/[transport]/route.ts calls each
 * one via lib/mcp/tools/index.ts. Keep tool logic in lib/<feature>/ and keep
 * these files thin: parse input, call the feature, shape { content, structuredContent }.
 */
export type RegisterTool = (server: McpServer) => void;

/** Plain-message result for the agent. Never throw raw errors at the agent (spec section 6). */
export function toolMessage(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}
