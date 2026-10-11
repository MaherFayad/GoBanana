/**
 * MCP contract (spec section 13): the real handler, in process, over Request/Response.
 * tools/list shows every tool with object input schemas; bend_brief runs end to end.
 */
import { describe, expect, it } from "vitest";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { buildAuthedMcpHandler } from "@/app/api/[transport]/handler";

const URL_ = "https://banana.example.com/api/mcp";

const verifyToken = async (_req: Request, token?: string): Promise<AuthInfo | undefined> =>
  token === "good"
    ? { token, clientId: "client", scopes: [], extra: { workosId: "user_01", userId: "11111111-1111-4111-8111-111111111111", email: "a@example.com" } }
    : undefined;

const mcp = buildAuthedMcpHandler({ verifyToken, publicOrigin: () => "https://banana.example.com" });

async function rpc(method: string, params?: unknown): Promise<{ result?: Record<string, unknown>; error?: unknown }> {
  const res = await mcp(
    new Request(URL_, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
        authorization: "Bearer good",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params ? { params } : {}) }),
    }),
  );
  expect(res.status).toBe(200);
  const body = await res.text();
  const line = body.trim().startsWith("{") ? body : body.split("\n").find((l) => l.startsWith("data:"))!.slice(5);
  return JSON.parse(line);
}

const EXPECTED = [
  "ping",
  "bend_brief",
  "search_references",
  "open_canvas",
  "add_to_canvas",
  "arrange_canvas",
  "get_canvas",
  "extract_palette",
  "export_kit",
  // App-only (hidden from the model by MCP Apps hosts); the inline canvas saves through it.
  "save_canvas_state",
];

type ListedTool = {
  name: string;
  description?: string;
  inputSchema: { type: string; properties?: Record<string, unknown>; required?: string[] };
  _meta?: Record<string, unknown>;
};

describe("MCP contract", () => {
  it("lists all tools in order with input schemas and plain descriptions", async () => {
    const { result } = await rpc("tools/list");
    const tools = (result!.tools as ListedTool[]);
    expect(tools.map((t) => t.name)).toEqual(EXPECTED);
    for (const t of tools) {
      expect(t.inputSchema.type, t.name).toBe("object");
      expect(t.description, t.name).toBeTruthy();
      expect(t.description, t.name).not.toMatch(/[\u2014\u2013]/);
    }
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    expect(Object.keys(byName.open_canvas!.inputSchema.properties ?? {}).sort()).toEqual(["brief", "canvasId", "title"]);
    expect(byName.open_canvas!._meta).toMatchObject({ ui: { resourceUri: "ui://banana/canvas" } });
    expect(byName.add_to_canvas!.inputSchema.required?.sort()).toEqual(["canvasId", "items"]);
    expect(byName.extract_palette!.inputSchema.required?.sort()).toEqual(["canvasId", "itemIds"]);
    expect(byName.export_kit!.inputSchema.required?.sort()).toEqual(["canvasId", "formats"]);
    expect(byName.arrange_canvas!.inputSchema.required?.sort()).toEqual(["canvasId", "layout"]);
    expect(byName.get_canvas!.inputSchema.required).toEqual(["canvasId"]);
    expect(Object.keys(byName.bend_brief!.inputSchema.properties ?? {})).toContain("canvasId");
  });

  it("runs bend_brief and returns text plus structured directions", async () => {
    const { result } = await rpc("tools/call", { name: "bend_brief", arguments: { brief: "flight checkout screen", wildness: 3, count: 4 } });
    expect(result!.isError).toBeFalsy();
    const structured = result!.structuredContent as { directions: { id: string; title: string; searchQuery: string }[] };
    expect(structured.directions).toHaveLength(4);
    const text = (result!.content as { text: string }[])[0]!.text;
    expect(text).toContain(structured.directions[0]!.title);
  });

  it("answers bad input with a plain message, not a validation dump", async () => {
    const { result } = await rpc("tools/call", { name: "bend_brief", arguments: { brief: "x", wildness: 9 } });
    expect(result!.isError).toBe(true);
    expect((result!.content as { text: string }[])[0]!.text).toBe("wildness must be a whole number from 1 (Fresh) to 5 (Bananas).");
    const arrange = await rpc("tools/call", { name: "arrange_canvas", arguments: { canvasId: "x", layout: "spiral" } });
    expect((arrange.result!.content as { text: string }[])[0]!.text).toContain("layout must be one of");
  });
});
