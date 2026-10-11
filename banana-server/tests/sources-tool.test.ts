import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/server";
import {
  register,
  TOOL_DESCRIPTION,
  UI_ONLY_LANE_MESSAGE,
  createSearchReferencesTool,
  inputSchema,
  type SearchReferencesDeps,
  type SearchReferencesInput,
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
    expect(TOOL_DESCRIPTION).toMatch(/^Find UI references \(app screens, web pages, dashboards, components\)/);
    expect(TOOL_DESCRIPTION).toContain("mix is ignored");
    expect(TOOL_DESCRIPTION).not.toMatch(/inspiration|wild"|balanced/);
    expect(TOOL_DESCRIPTION).not.toMatch(/[\u2014\u2013]/);
  });

  it("registers on an MCP server with a JSON schema input", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    expect(() => register(server)).not.toThrow();
    const json = z.toJSONSchema(inputSchema) as { properties: Record<string, unknown> };
    expect(Object.keys(json.properties).sort()).toEqual(["canvasId", "count", "directionId", "lane", "mix", "query", "sources", "taste"]);
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

  it("searches a direction without a canvas brief on the plain path (UI forms), and counts one search", async () => {
    const { tool, run, runPlan, usage } = setup();
    const res = await tool({ directionId: "dir_1", sources: ["dribbble", "pinterest"] }, "u1");
    expect(runPlan).not.toHaveBeenCalled();
    // The adapter's plain path forces the idea into UI forms and gates every result.
    expect(run).toHaveBeenCalledWith({ query: "melted chrome type", count: 12, userId: "u1", sources: ["pinterest", "dribbble"] });
    expect(res.structuredContent).toMatchObject({
      query: "melted chrome type",
      queries: ["melted chrome type"],
      mix: "ui",
      references: [ref],
      addedToTray: false,
    });
    expect((res.structuredContent as { lanes?: unknown }).lanes).toBeUndefined();
    expect(text(res)).toContain("https://www.pinterest.com/pin/1/");
    expect((await usage.get("u1", currentPeriod(NOW))).searches).toBe(1);
    // A lane re-search needs lanes.
    const lane = await tool({ directionId: "dir_1", lane: "taste", query: "minimal checkout ui" }, "u1");
    expect(text(lane)).toContain("no brief");
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
    expect(plan.map((r) => r.lane)).toEqual(["fidelity", "locale", "taste", "component", "hero", "bridge"]);
    expect(plan.some((r) => r.site === "behance" || r.query.startsWith("crushed velvet -") || r.query === "crushed velvet")).toBe(false);
    expect(plan.find((r) => r.lane === "bridge")).toMatchObject({
      query: "crushed velvet ui design -template -kit -free -wireframe",
      site: "dribbble",
      titleWord: "velvet",
    });
    const out = res.structuredContent as { lanes: Record<string, string | string[]>; queries: string[]; query: string; mix: string };
    expect(out.query).toBe("crushed velvet");
    expect(out.mix).toBe("ui");
    expect(out.lanes).toMatchObject({
      idea: "crushed velvet",
      fidelity: "flight app ui",
      component: ["flight checkout ui"],
      bridge: "crushed velvet ui design",
      locale: "arabic app ui",
    });
    expect(out.lanes.taste).toMatch(/ flight checkout ui design$/);
    expect(out.lanes.hero).toMatch(/ flight app single screen$/);
    expect(out.queries[0]).toBe("flight app ui -template -kit -free -wireframe site:dribbble.com/shots");
    expect(out.queries[1]).toBe("arabic app ui -template -kit -free -wireframe site:pinterest.com/pin");
    expect(text(res)).toContain('component "flight checkout ui"');
    expect(text(res)).not.toContain("inspiration");
    expect(text(res)).not.toContain('idea "');
    expect((await usage.get("u1", currentPeriod(NOW))).searches).toBe(1);
  });

  it("accepts mix for older clients and ignores it: always UI", async () => {
    const { tool, runPlan } = setup();
    for (const mix of [undefined, "ui", "balanced", "wild"] as const) {
      const res = await tool({ directionId: "bd-8dti7s7c", ...(mix ? { mix } : {}) }, "u1");
      expect(res.structuredContent).toMatchObject({ mix: "ui" });
    }
    expect(runPlan.mock.calls.every((c) => !("mix" in ((c as unknown as [unknown, object])[1])))).toBe(true);
    // Every call sends the same plan, whatever the mix.
    const plans = runPlan.mock.calls.map((c) => JSON.stringify((c as unknown as [unknown])[0]));
    expect(new Set(plans).size).toBe(1);
    const plain = await tool({ query: "x", mix: "balanced" }, "u1");
    expect(plain.structuredContent).toMatchObject({ mix: "ui" });
    const bad = await tool({ directionId: "bd-8dti7s7c", mix: "bananas" } as unknown as SearchReferencesInput, "u1");
    expect(bad.isError).toBe(true);
    expect(text(bad)).toContain("Check the input");
  });

  it("rejects the removed inspiration lane with a plain message", async () => {
    const { tool, run, runPlan } = setup();
    const res = await tool({ directionId: "bd-8dti7s7c", lane: "inspiration", query: "crushed velvet" } as unknown as SearchReferencesInput, "u1");
    expect(res.isError).toBe(true);
    expect(text(res)).toBe(UI_ONLY_LANE_MESSAGE);
    expect(text(res)).toContain("UI only");
    expect(run).not.toHaveBeenCalled();
    expect(runPlan).not.toHaveBeenCalled();
  });

  it("forces a lane re-search's words into UI when they name none", async () => {
    const { tool, runPlan } = setup();
    const res = await tool({ directionId: "bd-8dti7s7c", lane: "taste", query: "crushed velvet" }, "u1");
    const [plan] = runPlan.mock.calls[0]! as unknown as [{ lane: string; query: string }[]];
    expect(plan).toEqual([{ lane: "taste", query: "crushed velvet app ui -template -kit -free -wireframe", site: "dribbble" }]);
    expect(res.structuredContent).toMatchObject({ lane: "taste", query: "crushed velvet app ui", arms: { taste: "agent:crushed velvet app ui" } });
    await tool({ directionId: "bd-8dti7s7c", lane: "component", query: "flight seat map ui" }, "u1");
    const [plan2] = runPlan.mock.calls[1]! as unknown as [{ lane: string; query: string }[]];
    expect(plan2).toEqual([{ lane: "component", query: "flight seat map ui -template -kit -free -wireframe", site: "dribbble" }]);
  });

  it("re-searches the bridge lane with the agent's words and keeps the idea's title filter", async () => {
    const { tool, runPlan } = setup();
    const res = await tool({ directionId: "bd-8dti7s7c", lane: "bridge", query: "velvet checkout ui" }, "u1");
    const [plan] = runPlan.mock.calls[0]! as unknown as [{ lane: string; query: string; site: string; titleWord?: string }[]];
    expect(plan).toEqual([{ lane: "bridge", query: "velvet checkout ui -template -kit -free -wireframe", site: "dribbble", titleWord: "velvet" }]);
    expect(res.structuredContent).toMatchObject({ lane: "bridge", arms: { bridge: "agent:velvet checkout ui" } });
  });

  it("uses and saves the taste words it is given", async () => {
    const { tool, runPlan, saveTaste } = setup();
    const res = await tool({ directionId: "bd-8dti7s7c", taste: ["Monochrome"] }, "u1");
    expect(saveTaste).toHaveBeenCalledWith("u1", "c1", ["monochrome"]);
    const out = res.structuredContent as { lanes: Record<string, string>; taste: string[]; tasteSaved: boolean };
    expect(out.lanes.taste).toBe("monochrome flight checkout ui design");
    expect(out.lanes.hero).toBe("monochrome flight app single screen");
    expect(out).toMatchObject({ taste: ["monochrome"], tasteSaved: true });
    expect(runPlan).toHaveBeenCalledTimes(1);
  });

  it("uses the canvas taste when the call gives none", async () => {
    const { tool } = setup({
      getDirection: async () => ({ id: "d", searchQuery: "crushed velvet", brief: "banking app", taste: ["luxury"] }),
    });
    const res = await tool({ directionId: "d" }, "u1");
    expect((res.structuredContent as { lanes: Record<string, string> }).lanes.taste).toBe("luxury banking card ui design");
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
    // Saved with the query words that found them (no lane: a plain query search).
    expect(addToTray).toHaveBeenCalledWith("u1", "c1", [{ ...ref, query: "x" }]);
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
