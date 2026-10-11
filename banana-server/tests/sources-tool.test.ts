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
  const runPlan = vi.fn(async () => result);
  const addToTray = vi.fn(async () => true);
  const saveTaste = vi.fn(async () => true);
  const deps: SearchReferencesDeps = {
    adapter: { run, runPlan },
    usage,
    getPlan: async () => plan,
    getDirection: async (_u, id) =>
      id === "dir_1"
        ? { id, searchQuery: "melted chrome type" }
        : id === "bd-8dti7s7c"
          ? {
              id: "uuid-1",
              bendId: "bd-8dti7s7c",
              canvasId: "c1",
              // Stacked query stored by the first live board, and that canvas's brief.
              searchQuery: "crushed velvet texture ui design garment care label packaging",
              brief: "Flight checkout screen for a GCC travel OTA (mobile, bilingual Arabic/English)",
            }
          : null,
    addToTray,
    saveTaste,
    upgradeUrl: () => "https://example.test/pricing",
    now: () => NOW,
    ...over,
  };
  return { tool: createSearchReferencesTool(deps), usage, run, runPlan, addToTray, saveTaste };
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
    expect(Object.keys(json.properties).sort()).toEqual(["canvasId", "count", "directionId", "query", "sources", "taste"]);
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

  it("searches a direction without a canvas brief in the inspiration lane only, and counts one search", async () => {
    const { tool, run, runPlan, usage } = setup();
    const res = await tool({ directionId: "dir_1", sources: ["dribbble", "pinterest"] }, "u1");
    expect(run).not.toHaveBeenCalled();
    expect(runPlan).toHaveBeenCalledTimes(1);
    const [plan, opts] = runPlan.mock.calls[0]! as unknown as [{ lane: string; query: string; site: string }[], { count: number }];
    expect(plan).toEqual([
      { lane: "inspiration", query: "melted chrome type", site: "pinterest" },
      { lane: "inspiration", query: "melted chrome type", site: "behance" },
    ]);
    expect(opts.count).toBe(12);
    expect(res.structuredContent).toMatchObject({
      query: "melted chrome type",
      queries: ["melted chrome type site:pinterest.com/pin", "melted chrome type site:behance.net/gallery"],
      lanes: { inspiration: "melted chrome type" },
      references: [ref],
      addedToTray: false,
    });
    expect(text(res)).toContain("https://www.pinterest.com/pin/1/");
    expect((await usage.get("u1", currentPeriod(NOW))).searches).toBe(1);
  });

  it("passes the canvas's source links so a direction search skips what is already there", async () => {
    const getCanvasSourceUrls = vi.fn(async () => ["https://dribbble.com/shots/1-a"]);
    const { tool, runPlan } = setup({ getCanvasSourceUrls });
    await tool({ directionId: "bd-8dti7s7c", canvasId: "c1" }, "u1");
    expect(getCanvasSourceUrls).toHaveBeenCalledWith("u1", "c1");
    const [, opts] = runPlan.mock.calls[0]! as unknown as [unknown, { exclude: string[] }];
    expect(opts.exclude).toEqual(["https://dribbble.com/shots/1-a"]);
  });

  it("searches every lane of a saved direction and shows the lanes, counting one search", async () => {
    const { tool, runPlan, usage } = setup();
    const res = await tool({ directionId: "bd-8dti7s7c", canvasId: "c1" }, "u1");
    const [plan] = runPlan.mock.calls[0]! as unknown as [{ lane: string; query: string; site: string }[]];
    expect(plan.length).toBeLessThanOrEqual(8);
    expect(plan.map((r) => r.lane)).toEqual(["inspiration", "fidelity", "taste", "inspiration", "hero", "locale"]);
    const out = res.structuredContent as { lanes: Record<string, string>; queries: string[]; query: string };
    expect(out.query).toBe("crushed velvet");
    expect(out.lanes).toMatchObject({ inspiration: "crushed velvet", fidelity: "flight app ui", locale: "arabic app ui" });
    expect(out.lanes.taste).toMatch(/ checkout ui$/);
    expect(out.lanes.hero).toMatch(/ flight app single screen$/);
    expect(out.queries[0]).toBe("crushed velvet site:pinterest.com/pin");
    expect(out.queries[1]).toBe("flight app ui -template -kit -free -wireframe site:dribbble.com/shots");
    expect(text(res)).toContain('inspiration "crushed velvet"');
    expect((await usage.get("u1", currentPeriod(NOW))).searches).toBe(1);
  });

  it("uses and saves the taste words it is given", async () => {
    const { tool, runPlan, saveTaste } = setup();
    const res = await tool({ directionId: "bd-8dti7s7c", taste: ["Monochrome"] }, "u1");
    expect(saveTaste).toHaveBeenCalledWith("u1", "c1", ["monochrome"]);
    const out = res.structuredContent as { lanes: Record<string, string>; taste: string[]; tasteSaved: boolean };
    expect(out.lanes.taste).toBe("monochrome checkout ui");
    expect(out.lanes.hero).toBe("monochrome flight app single screen");
    expect(out).toMatchObject({ taste: ["monochrome"], tasteSaved: true });
    expect(runPlan).toHaveBeenCalledTimes(1);
  });

  it("uses the canvas taste when the call gives none", async () => {
    const { tool } = setup({
      getDirection: async () => ({ id: "d", searchQuery: "crushed velvet", brief: "banking app", taste: ["luxury"] }),
    });
    const res = await tool({ directionId: "d" }, "u1");
    expect((res.structuredContent as { lanes: Record<string, string> }).lanes.taste).toBe("luxury card ui");
  });

  it("rejects too many taste words with a plain message", async () => {
    const { tool, runPlan } = setup();
    const res = await tool({ directionId: "dir_1", taste: ["a", "b", "c", "d", "e", "f"] }, "u1");
    expect(res.isError).toBe(true);
    expect(runPlan).not.toHaveBeenCalled();
  });

  it("does not count a direction search when the first lane fails", async () => {
    const { tool, usage } = setup({}, { references: [], note: "Image search is busy right now.", ok: false });
    await tool({ directionId: "bd-8dti7s7c" }, "u1");
    expect((await usage.get("u1", currentPeriod(NOW))).searches).toBe(0);
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

  it("searches a plain query on each selected source as before", async () => {
    const { tool, run, runPlan } = setup();
    const res = await tool({ query: "melted chrome type", sources: ["dribbble", "pinterest"] }, "u1");
    expect(run).toHaveBeenCalledWith({ query: "melted chrome type", count: 12, userId: "u1", sources: ["pinterest", "dribbble"] });
    expect(runPlan).not.toHaveBeenCalled();
    expect(res.structuredContent).toMatchObject({ query: "melted chrome type", queries: ["melted chrome type"] });
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
