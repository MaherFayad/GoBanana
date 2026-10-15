import { describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { BEND_BRIEF_DESCRIPTION, register } from "@/lib/mcp/tools/bend_brief";

type Handler = (args: unknown, ctx: unknown) => Promise<{
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}>;

interface Captured {
  name: string;
  config: {
    description?: string;
    inputSchema?: {
      "~standard": {
        validate: (v: unknown) => unknown;
        jsonSchema: { input: (o: { target: string }) => Record<string, unknown> };
      };
    };
  };
  handler: Handler;
}

function capture(): Captured {
  let captured: Captured | undefined;
  const fake = {
    registerTool(name: string, config: Captured["config"], handler: Handler) {
      captured = { name, config, handler };
    },
  };
  register(fake as unknown as McpServer);
  if (!captured) throw new Error("bend_brief did not register");
  return captured;
}

describe("bend_brief tool", () => {
  it("registers on a real MCP server", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    expect(() => register(server)).not.toThrow();
  });

  it("has short plain product copy that points to search_references", () => {
    const { name, config } = capture();
    expect(name).toBe("bend_brief");
    expect(config.description).toBe(BEND_BRIEF_DESCRIPTION);
    expect(BEND_BRIEF_DESCRIPTION).toContain("search_references");
    expect(BEND_BRIEF_DESCRIPTION).not.toMatch(/[\u2014\u2013]/);
    expect(BEND_BRIEF_DESCRIPTION.length).toBeLessThan(500);
    expect(BEND_BRIEF_DESCRIPTION).toContain("one wild page or two");
    expect(BEND_BRIEF_DESCRIPTION).toContain("wildSpots");
  });

  it("advertises the full input schema but leaves validation to the handler", () => {
    const { config } = capture();
    const std = config.inputSchema!["~standard"];
    const json = std.jsonSchema.input({ target: "draft-2020-12" }) as {
      properties: Record<string, Record<string, unknown>>;
      required: string[];
    };
    expect(Object.keys(json.properties).sort()).toEqual(["brief", "canvasId", "count", "fromUpload", "lens", "moves", "mustKeep", "pages", "platform", "taste", "wildness"]);
    expect(json.required.sort()).toEqual(["brief", "wildness"]);
    expect(json.properties.wildness?.maximum).toBe(5);
    expect(json.properties.count?.maximum).toBe(8);
    expect(std.validate({ wildness: 99 })).toEqual({ value: { wildness: 99 } });
  });

  it("returns readable text and structured directions", async () => {
    const { handler } = capture();
    const res = await handler({ brief: "flight checkout screen", wildness: 4 }, {});
    expect(res.isError).toBeFalsy();
    const directions = res.structuredContent?.directions as {
      id: string;
      searchQuery: string;
      title: string;
      twist: string;
      move: string;
      prompt: string;
    }[];
    expect(directions).toHaveLength(6);
    const text = res.content[0]!.text;
    directions.forEach((d, i) => {
      expect(d.twist.length).toBeGreaterThan(0);
      // One compact line per direction: "1. Title (Twist: ...) [move + move] query: ...".
      expect(text).toContain(`${i + 1}. ${d.title} (Twist: ${d.twist}) [${d.move}] query: ${d.searchQuery}\n`);
      expect(text).toContain(`id: ${d.id}. Prompt: ${d.prompt}`);
    });
    expect(text).toContain("search_references");
    expect(text).not.toContain("\u2014");
  });

  it("leaves the twist out of the text at wildness 1 and 2", async () => {
    const { handler } = capture();
    const res = await handler({ brief: "podcast player", wildness: 2 }, {});
    const directions = res.structuredContent?.directions as { twist: string; title: string; move: string }[];
    for (const d of directions) expect(d.twist).toBe("");
    expect(res.content[0]!.text).not.toContain("Twist:");
    expect(res.content[0]!.text).toContain(`1. ${directions[0]!.title} [${directions[0]!.move}] query: `);
  });

  it("answers invalid input with a plain message, never a throw", async () => {
    const { handler } = capture();
    for (const args of [undefined, {}, { brief: "x", wildness: 9 }, { brief: "x", wildness: 2, count: 20 }]) {
      const res = await handler(args, {});
      expect(res.isError).toBe(true);
      expect(res.content[0]!.text).not.toMatch(/[{}[\]]/);
    }
    const res = await handler({ brief: "x", wildness: 2, lens: "atlantis" }, {});
    expect(res.content[0]!.text).toContain("sadu");
  });
});
