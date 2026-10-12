/**
 * Field report, 2026-10-12: get_canvas listed 0 directions on every board, so the agent started a
 * fifth flight checkout board. The rows were saved (3 to 8 per board in production); the list
 * query's count compared directions.canvas_id with directions.id (tests/db-repos.test.ts pins the
 * SQL). These cover the tool text that steers agents to save and reuse boards.
 */
import { describe, expect, it } from "vitest";
import { createBendBriefTool } from "@/lib/mcp/tools/bend_brief";
import { createGetCanvasTool } from "@/lib/mcp/tools/get_canvas";
import { ALICE, APP, makeDeps, seedCanvas, text } from "./tools-fixtures";

describe("bend_brief without a canvas", () => {
  it("says the directions are not saved and how to keep them", async () => {
    const { repos } = makeDeps();
    const tool = createBendBriefTool(() => ({ repos }));
    const res = await tool({ brief: "flight checkout screen", wildness: 4 }, ALICE);
    expect(text(res)).toContain("Not saved: no canvasId was passed");
    expect(text(res)).toContain("call bend_brief again with the same brief and a canvasId");
    expect(text(res)).not.toMatch(/[—–]/);
  });

  it("says nothing of the kind when it saved them", async () => {
    const { repos } = makeDeps();
    const { id } = await seedCanvas(repos, ALICE);
    const res = await createBendBriefTool(() => ({ repos }))({ brief: "flight checkout screen", wildness: 4, canvasId: id }, ALICE);
    expect(text(res)).toContain(`Saved to canvas ${id}`);
    expect(text(res)).not.toContain("Not saved");
  });
});

describe("get_canvas list", () => {
  it("counts the saved directions of each board and steers to reuse", async () => {
    const { repos } = makeDeps();
    const { id } = await seedCanvas(repos, ALICE);
    await createBendBriefTool(() => ({ repos }))({ brief: "flight checkout screen", wildness: 4, canvasId: id, count: 3 }, ALICE);
    const res = await createGetCanvasTool({ repos, appUrl: () => APP })({}, ALICE);
    expect(text(res)).toContain("3 directions");
    expect(text(res)).toContain("reuse its board instead of starting a new one");
  });
});
