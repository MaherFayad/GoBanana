import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/server";
import {
  register,
  TOOL_DESCRIPTION,
  createSearchReferencesTool,
  inputSchema,
  type SearchReferencesDeps,
} from "@/lib/mcp/tools/search_references";
import { createMemoryUsageStore, currentPeriod, type Plan } from "@/lib/quota";
import type { Reference } from "@/lib/sources";
import type { WebSearchResult } from "@/lib/sources/web-search";

const NOW = new Date("2026-10-15T12:00:00Z");

const ref: Reference = {
  id: "ref_0000000000000001",
  thumbUrl: "https://encrypted-tbn0.gstatic.com/images?q=1",
  imageUrl: "https://i.pinimg.com/originals/a.jpg",
  sourceUrl: "https://www.pinterest.com/pin/1/",
  sourceSite: "pinterest.com",
  title: "Poster",
};

function setup(over: Partial<SearchReferencesDeps> = {}, result: WebSearchResult = { references: [ref], ok: true }, plan: Plan = "free") {
  const usage = createMemoryUsageStore();
  const run = vi.fn(async () => result);
  const addToTray = vi.fn(async () => true);
  const deps: SearchReferencesDeps = {
    adapter: { run },
    usage,
    getPlan: async () => plan,
    getDirection: async (_u, id) => (id === "dir_1" ? { id, searchQuery: "melted chrome type" } : null),
    addToTray,
    upgradeUrl: () => "https://example.test/pricing",
    now: () => NOW,
    ...over,
  };
  return { tool: createSearchReferencesTool(deps), usage, run, addToTray };
}

function text(res: { content: { type: string; text?: string }[] }): string {
  return res.content.map((c) => c.text ?? "").join("\n");
}

describe("search_references tool", () => {
  it("has plain product copy", () => {
    expect(TOOL_DESCRIPTION).toContain("directionId");
    expect(TOOL_DESCRIPTION).toContain("bend_brief");
    expect(TOOL_DESCRIPTION).toContain("source link");
    expect(TOOL_DESCRIPTION).not.toMatch(/[\u2014\u2013]/);
  });

  it("registers on an MCP server with a JSON schema input", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    expect(() => register(server)).not.toThrow();
    const json = z.toJSONSchema(inputSchema) as { properties: Record<string, unknown> };
    expect(Object.keys(json.properties).sort()).toEqual(["canvasId", "count", "directionId", "query", "sources"]);
  });

  it("validates count and sources", () => {
    expect(inputSchema.safeParse({ query: "x" }).data?.count).toBe(12);
    expect(inputSchema.safeParse({ query: "x", count: 3 }).success).toBe(false);
    expect(inputSchema.safeParse({ query: "x", count: 25 }).success).toBe(false);
    expect(inputSchema.safeParse({ query: "x", sources: ["flickr"] }).success).toBe(false);
  });

  it("needs a directionId or a query", async () => {
    const { tool } = setup();
    const res = await tool({}, "u1");
    expect(res.isError).toBe(true);
    expect(text(res)).toBe("Pass a directionId from bend_brief or a query.");
  });

  it("needs a signed in user", async () => {
    const { tool } = setup();
    expect((await tool({ query: "x" }, undefined)).isError).toBe(true);
  });

  it("looks up the direction query and counts the search", async () => {
    const { tool, run, usage } = setup();
    const res = await tool({ directionId: "dir_1", sources: ["dribbble", "pinterest"] }, "u1");
    expect(run).toHaveBeenCalledWith({ query: "melted chrome type", count: 12, userId: "u1", sources: ["pinterest", "dribbble"] });
    expect(res.structuredContent).toMatchObject({ query: "melted chrome type", references: [ref], addedToTray: false });
    expect(text(res)).toContain("https://www.pinterest.com/pin/1/");
    expect((await usage.get("u1", currentPeriod(NOW))).searches).toBe(1);
  });

  it("returns a plain message for an unknown direction", async () => {
    const { tool, run } = setup();
    const res = await tool({ directionId: "nope" }, "u1");
    expect(res.isError).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it("blocks with the upgrade message when the free quota is used", async () => {
    const { tool, usage, run } = setup();
    await usage.addSearches("u1", currentPeriod(NOW), 30);
    const res = await tool({ query: "x" }, "u1");
    expect(text(res)).toBe("You have used your 30 free searches this month. Upgrade: https://example.test/pricing");
    expect(run).not.toHaveBeenCalled();
  });

  it("does not count a failed search", async () => {
    const { tool, usage } = setup({}, { references: [], note: "Image search is not available right now.", ok: false });
    const res = await tool({ query: "x" }, "u1");
    expect(res.isError).toBeUndefined();
    expect(text(res)).toContain("not available");
    expect((await usage.get("u1", currentPeriod(NOW))).searches).toBe(0);
  });

  it("adds results to the canvas tray when canvasId is given", async () => {
    const { tool, addToTray } = setup();
    const res = await tool({ query: "x", canvasId: "c1" }, "u1");
    expect(addToTray).toHaveBeenCalledWith("u1", "c1", [ref]);
    expect(res.structuredContent).toMatchObject({ canvasId: "c1", addedToTray: true });
  });

  it("notes when the canvas is not found", async () => {
    const { tool } = setup({ addToTray: async () => false });
    const res = await tool({ query: "x", canvasId: "c1" }, "u1");
    expect(res.structuredContent).toMatchObject({ addedToTray: false });
    expect(text(res)).toContain("canvas was not found");
  });

  it("never throws raw errors at the agent", async () => {
    const { tool } = setup({
      getPlan: async () => {
        throw new Error("db exploded at 10.0.0.1");
      },
    });
    const res = await tool({ query: "x" }, "u1");
    expect(res.isError).toBe(true);
    expect(text(res)).toBe("Search failed. Try again in a minute.");
  });
});
