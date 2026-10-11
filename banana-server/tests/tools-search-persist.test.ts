/**
 * bend_brief with canvasId saves directions; search_references resolves them, counts quota
 * in the usage repo and fills the canvas tray. Real repo wiring (createDbDeps) over
 * in-memory repos, with a fake search adapter.
 */
import { describe, expect, it, vi } from "vitest";
import { createBendBriefTool } from "@/lib/mcp/tools/bend_brief";
import { createDbDeps, createSearchReferencesTool } from "@/lib/mcp/tools/search_references";
import type { WebSearchResult } from "@/lib/sources/web-search";
import type { CanvasState } from "@/canvas/types";
import { ALICE, APP, BOB, makeDeps, ref, seedCanvas, text } from "./tools-fixtures";

function setup(result: WebSearchResult = { references: [ref(1), ref(2)], ok: true }, takedowns: string[] = []) {
  const { repos } = makeDeps({ takedowns });
  const run = vi.fn(async () => result);
  const runPlan = vi.fn(async () => result);
  const deps = { ...createDbDeps(repos, () => APP), adapter: { run, runPlan }, now: () => new Date("2026-10-15T12:00:00Z") };
  return { repos, run, runPlan, search: createSearchReferencesTool(deps), bend: createBendBriefTool(() => ({ repos })) };
}

type Dir = { id: string; searchQuery: string };

describe("bend_brief with a canvas", () => {
  it("saves directions keyed by their stable id and fills in the canvas brief", async () => {
    const { repos, bend } = setup();
    const c = await repos.canvases.create({ userId: ALICE, title: "Board", state: {} });
    const res = await bend({ brief: "flight checkout screen", wildness: 4, canvasId: c.id }, ALICE);
    expect(res.isError).toBeFalsy();
    const dirs = (res.structuredContent as { directions: Dir[]; saved: boolean }).directions;
    expect((res.structuredContent as { saved: boolean }).saved).toBe(true);
    expect(repos.data.directions.map((d) => d.bendId)).toEqual(dirs.map((d) => d.id));
    const row = (await repos.canvases.getOwned(ALICE, c.id))!;
    expect(row).toMatchObject({ brief: "flight checkout screen", wildness: 4 });
    // Bending again with the same input does not duplicate rows.
    await bend({ brief: "flight checkout screen", wildness: 4, canvasId: c.id }, ALICE);
    expect(repos.data.directions).toHaveLength(dirs.length);
  });

  it("does not save to another user's canvas", async () => {
    const { repos, bend } = setup();
    const c = await repos.canvases.create({ userId: ALICE, title: "Board", state: {} });
    const res = await bend({ brief: "poster", wildness: 2, canvasId: c.id }, BOB);
    expect((res.structuredContent as { saved: boolean }).saved).toBe(false);
    expect(text(res)).toContain("not saved");
    expect(repos.data.directions).toHaveLength(0);
  });

  it("stays stateless without a canvasId", async () => {
    const getDeps = vi.fn();
    const res = await createBendBriefTool(getDeps)({ brief: "poster", wildness: 2 }, undefined);
    expect(res.isError).toBeFalsy();
    expect(getDeps).not.toHaveBeenCalled();
  });
});

describe("taste on the canvas", () => {
  it("is saved by search_references and bend_brief, reused, and kept when the canvas UI saves without it", async () => {
    const { repos, bend, search, runPlan } = setup();
    const c = await seedCanvas(repos, ALICE);
    const bent = await bend({ brief: "flight checkout screen", wildness: 3, canvasId: c.id, taste: ["Monochrome", "luxury"] }, ALICE);
    const dirs = (bent.structuredContent as { directions: { id: string; searchQueries: string[] }[] }).directions;
    expect(dirs.every((d) => /^(monochrome|luxury) flight checkout ui design$/.test(d.searchQueries[1]!))).toBe(true);
    const stateOf = async () => (await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState;
    expect((await stateOf()).taste).toEqual(["monochrome", "luxury"]);

    // The canvas UI saves state without `taste`: the stored taste stays.
    const { taste: _taste, ...uiState } = await stateOf();
    await repos.canvases.saveState(ALICE, c.id, uiState);
    expect((await stateOf()).taste).toEqual(["monochrome", "luxury"]);

    // A later search with no taste uses the canvas taste; one with taste replaces it.
    await search({ directionId: dirs[0]!.id, canvasId: c.id }, ALICE);
    const [plan] = runPlan.mock.calls[0]! as unknown as [{ lane: string; query: string }[]];
    expect(plan.find((r) => r.lane === "taste")!.query).toMatch(/^(monochrome|luxury) flight checkout ui design /);
    await search({ directionId: dirs[0]!.id, canvasId: c.id, taste: ["editorial"] }, ALICE);
    expect((await stateOf()).taste).toEqual(["editorial"]);
  });
});

describe("search_references with the database", () => {
  it("resolves a bend direction id, saves results and tags the tray with the direction", async () => {
    const { repos, bend, search, runPlan } = setup();
    const c = await seedCanvas(repos, ALICE);
    const bent = await bend({ brief: "flight checkout screen", wildness: 3, canvasId: c.id }, ALICE);
    const dir = (bent.structuredContent as { directions: Dir[] }).directions[0]!;

    const res = await search({ directionId: dir.id, canvasId: c.id }, ALICE);
    expect(res.isError).toBeFalsy();
    // Lane 1 is the direction's raw ingredient; the brief lanes come from the canvas brief.
    const [plan] = runPlan.mock.calls[0]! as unknown as [{ lane: string; query: string }[]];
    expect(plan[0]).toMatchObject({ lane: "inspiration", query: dir.searchQuery });
    expect(plan.some((r) => r.lane === "fidelity")).toBe(true);
    expect((res.structuredContent as { addedToTray: boolean }).addedToTray).toBe(true);

    const s = (await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState;
    expect(s.tray.map((r) => r.id)).toEqual([ref(1).id, ref(2).id]);
    expect(s.tray.every((r) => r.directionId === dir.id)).toBe(true);
    expect((await repos.references.getByIds(c.id, [ref(1).id])).size).toBe(1);
    expect(await repos.usage.get(ALICE, "2026-10")).toEqual({ searches: 1, canvases: 0 });
  });

  it("finds a direction without canvasId once it is saved", async () => {
    const { repos, bend, search } = setup();
    const c = await seedCanvas(repos, ALICE);
    const bent = await bend({ brief: "poster", wildness: 2, canvasId: c.id }, ALICE);
    const dir = (bent.structuredContent as { directions: Dir[] }).directions[1]!;
    expect((await search({ directionId: dir.id }, ALICE)).isError).toBeFalsy();
    // Bob cannot use Alice's direction.
    expect(text(await search({ directionId: dir.id }, BOB))).toContain("not found");
  });

  it("explains how to search when a direction was never saved", async () => {
    const { search } = setup();
    const res = await search({ directionId: "bd-unsaved1" }, ALICE);
    expect(text(res)).toContain("Pass the direction's search text as query");
  });

  it("returns results without saving when there is no canvasId", async () => {
    const { repos, search } = setup();
    const res = await search({ query: "brutalist poster" }, ALICE);
    expect((res.structuredContent as { references: unknown[] }).references).toHaveLength(2);
    expect(repos.data.references.size).toBe(0);
  });

  it("does not touch another user's canvas", async () => {
    const { repos, search } = setup();
    const c = await seedCanvas(repos, ALICE);
    const res = await search({ query: "poster", canvasId: c.id }, BOB);
    expect((res.structuredContent as { addedToTray: boolean }).addedToTray).toBe(false);
    expect(repos.data.references.size).toBe(0);
  });

  it("stops at the free search quota with the upgrade link", async () => {
    const { repos, search, run } = setup();
    await repos.usage.addSearches(ALICE, "2026-10", 30);
    const res = await search({ query: "poster" }, ALICE);
    expect(text(res)).toBe(`You have used your 30 free searches this month. Upgrade: ${APP}/en/pricing`);
    expect(run).not.toHaveBeenCalled();
  });

  it("reads the takedown list on every search and fails closed when it cannot", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key");
    const serper = vi.fn(async () => new Response(JSON.stringify({ images: [] }), { status: 200 }));
    vi.stubGlobal("fetch", serper);
    try {
      const { repos } = makeDeps({ takedowns: ["pinterest.com"] });
      const list = vi.spyOn(repos.takedowns, "list");
      const tool = createSearchReferencesTool(createDbDeps(repos, () => APP));
      await tool({ query: "poster" }, ALICE);
      await tool({ query: "poster" }, ALICE);
      expect(list).toHaveBeenCalledTimes(2);
      // One path-scoped request per source (pinterest.com/pin, dribbble.com/shots) per search.
      expect(serper).toHaveBeenCalledTimes(4);

      list.mockRejectedValueOnce(new Error("db down"));
      const res = await tool({ query: "poster" }, ALICE);
      expect((res.structuredContent as { references: unknown[] } | undefined)?.references ?? []).toHaveLength(0);
      expect(serper).toHaveBeenCalledTimes(4);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
