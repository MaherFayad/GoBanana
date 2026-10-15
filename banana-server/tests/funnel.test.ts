/** DIST-08: the install funnel records each user's first ping, canvas, kept direction and export. */
import { afterEach, describe, expect, it } from "vitest";
import { FUNNEL_STEPS, recordFunnel, setFunnelStore, type FunnelStep } from "@/lib/funnel";
import { createBendBriefTool } from "@/lib/mcp/tools/bend_brief";
import { createExportKitTool } from "@/lib/mcp/tools/export_kit";
import { createOpenCanvasTool } from "@/lib/mcp/tools/open_canvas";
import { createRateDirectionsTool } from "@/lib/mcp/tools/rate_directions";
import { ALICE, makeDeps, seedCanvas } from "./tools-fixtures";

function fakeStore() {
  const marks: [string, FunnelStep][] = [];
  return { marks, store: { mark: async (u: string, s: FunnelStep) => void marks.push([u, s]) } };
}

afterEach(() => setFunnelStore(null));

describe("recordFunnel", () => {
  it("has the four steps in funnel order", () => {
    expect([...FUNNEL_STEPS]).toEqual(["ping", "canvas", "keep", "export"]);
  });

  it("writes a step once per user in an isolate", async () => {
    const { marks, store } = fakeStore();
    setFunnelStore(store);
    await recordFunnel(ALICE, "ping");
    await recordFunnel(ALICE, "ping");
    await recordFunnel(ALICE, "canvas");
    expect(marks).toEqual([[ALICE, "ping"], [ALICE, "canvas"]]);
  });

  it("ignores a missing or malformed user id", async () => {
    const { marks, store } = fakeStore();
    setFunnelStore(store);
    await recordFunnel(undefined, "ping");
    await recordFunnel("not-a-uuid", "ping");
    expect(marks).toEqual([]);
  });

  it("never throws when the store fails, and tries again next time", async () => {
    let calls = 0;
    setFunnelStore({
      mark: async () => {
        calls += 1;
        throw new Error("db down");
      },
    });
    await expect(recordFunnel(ALICE, "export")).resolves.toBeUndefined();
    await recordFunnel(ALICE, "export");
    expect(calls).toBe(2);
  });

  it("does nothing without a database", async () => {
    await expect(recordFunnel(ALICE, "ping")).resolves.toBeUndefined();
  });
});

describe("tools record the funnel", () => {
  it("open_canvas records the first canvas", async () => {
    const { marks, store } = fakeStore();
    setFunnelStore(store);
    const { deps } = makeDeps();
    await createOpenCanvasTool(deps)({ brief: "Flight checkout screen" }, ALICE);
    expect(marks).toEqual([[ALICE, "canvas"]]);
  });

  it("rate_directions records a kept direction, not a dropped one", async () => {
    const { marks, store } = fakeStore();
    setFunnelStore(store);
    const { deps, repos } = makeDeps();
    const canvas = await seedCanvas(repos, ALICE);
    const bent = (await createBendBriefTool(() => ({ repos }))({ brief: "flight checkout screen", wildness: 4, count: 3, canvasId: canvas.id }, ALICE))
      .structuredContent as { directions: { id: string }[] };
    const rate = createRateDirectionsTool(deps);
    await rate({ canvasId: canvas.id, ratings: [{ directionId: bent.directions[0]!.id, verdict: "drop" }] }, ALICE);
    expect(marks).toEqual([]);
    await rate({ canvasId: canvas.id, ratings: [{ directionId: bent.directions[1]!.id, verdict: "keep" }] }, ALICE);
    expect(marks).toEqual([[ALICE, "keep"]]);
  });

  it("export_kit records the first export, not a refused one", async () => {
    const { marks, store } = fakeStore();
    setFunnelStore(store);
    const { deps, repos } = makeDeps();
    const canvas = await seedCanvas(repos, ALICE);
    const exp = createExportKitTool(deps);
    await exp({ canvasId: "nope", formats: ["brief"] }, ALICE);
    expect(marks).toEqual([]);
    await exp({ canvasId: canvas.id, formats: ["brief"] }, ALICE);
    expect(marks).toEqual([[ALICE, "export"]]);
  });
});
