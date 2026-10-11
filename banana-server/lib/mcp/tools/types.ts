import type { McpServer, StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import type { z } from "zod";

/**
 * Every MCP tool lives in its own file in lib/mcp/tools/ and exports a
 * `register` function of this type. app/api/[transport]/route.ts calls each
 * one via lib/mcp/tools/index.ts. Keep tool logic in lib/<feature>/ and keep
 * these files thin: parse input, call the feature, shape { content, structuredContent }.
 */
export type RegisterTool = (server: McpServer) => void;

/** What every tool handler returns. */
export type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  /** Result metadata. MCP Apps hosts pass it to the view but not to the model. */
  _meta?: Record<string, unknown>;
};

/** Plain-message result for the agent. Never throw raw errors at the agent (spec section 6). */
export function toolMessage(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

/** Success result: text for the agent plus structured content for the UI. */
export function toolResult(text: string, structuredContent: object): ToolResult {
  return {
    content: [{ type: "text", text }],
    structuredContent: structuredContent as Record<string, unknown>,
  };
}

/**
 * Advertise a schema's strict JSON schema to clients, but let every call through to the
 * handler, so invalid input gets a plain message instead of the SDK's raw validation dump.
 * The handler must validate with the same schema (see `parseArgs`).
 */
export function lenient(schema: StandardSchemaWithJSON<unknown, unknown>): StandardSchemaWithJSON<unknown, unknown> {
  return {
    "~standard": {
      ...schema["~standard"],
      validate: (value: unknown) => ({ value }),
    },
  };
}

/** Validate tool args. On failure returns the plain message for the first bad field. */
export function parseArgs<S extends z.ZodType>(
  schema: S,
  raw: unknown,
  messages: Record<string, string>,
  fallback: string,
): { ok: true; data: z.output<S> } | { ok: false; message: string } {
  const result = schema.safeParse(raw ?? {});
  if (result.success) return { ok: true, data: result.data };
  const field = String(result.error.issues[0]?.path[0] ?? "");
  return { ok: false, message: messages[field] ?? fallback };
}
