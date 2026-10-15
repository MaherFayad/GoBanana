/**
 * P0-04: each result belongs to one direction. Results a direction search would add to the tray
 * are dropped when the canvas already has them for another direction (also when the directions
 * are searched at the same time), and a direction left with fewer than 6 UI results runs one
 * extra UI request.
 */
import { describe, expect, it, vi } from "vitest";
import { emptyState } from "@/canvas/state";
import type { CanvasState } from "@/canvas/types";
import { canvasSourceUrls } from "@/lib/canvas/store";
import {
  MIN_DIRECTION_UI,
  createSearchReferencesTool,
  nextUiRequest,
  type Direction,
  type SearchReferencesDeps,
} from "@/lib/mcp/tools/search_references";
import { createMemoryUsageStore, currentPeriod } from "@/lib/quota";
import type { LaneTexts, PlannedRequest } from "@/lib/sources/plan";
import { takenByOthers, writeSearchTray } from "@/lib/sources/tray";
import type { Reference } from "@/lib/sources/types";
import type { WebSearchResult } from "@/lib/sources/web-search";

const NOW = new Date("2026-10-15T12:00:00Z");
const BRIEF = "eSIM plan picker for a GCC travel app: pick a destination data plan, compare GB and days, buy";

const direction = (bendId: string, idea: string): Direction => ({
  id: `row-${bendId}`,
  bendId,
  canvasId: "c1",
  searchQuery: idea,
  brief: BRIEF,
  detail: { platform: "mobile", brief: BRIEF, artQueries: [idea] } as never,
});
const DIRECTIONS: Record<string, Direction> = {
  "bd-a": direction("bd-a", "letterpress texture"),
  "bd-b": direction("bd-b", "exhibition catalog"),
  "bd-c": direction("bd-c", "ruler ticks"),
};

const shot = (key: string, lane: Reference["lane"]): Reference => ({
  id: `ref_${key}`,
  thumbUrl: `https://cdn.dribbble.com/t/${key}.png`,
  imageUrl: `https://cdn.dribbble.com/i/${key}.png`,
  sourceUrl: `https://dribbble.com/shots/${key}`,
  sourceSite: "dribbble.com",
  title: `shot ${key}`,
  lane,
  zone: lane === "art" ? "art" : "ui",
});

/**
 * Every UI request answers with the same 8 generic shots (the live failure: every direction got the
 * same calendars), each art request with 2 of its own. Links on `exclude` are skipped, as runPlan does.
 */
function adapter() {
  return vi.fn(async (plan: readonly PlannedRequest[], opts: { exclude?: string[] }): Promise<WebSearchResult> => {
    const skip = new Set(opts.exclude ?? []);
    const refs: Reference[] = [];
    for (const req of plan) {
      if (req.lane === "art") refs.push(shot(`art-${req.query.length}-${req.site}-1`, "art"), shot(`art-${req.query.length}-${req.site}-2`, "art"));
      else if (req.lane === "fidelity") for (let i = 1; i <= 3; i++) refs.push(shot(`shipped-${req.site}-${i}`, "fidelity"));
      else for (let i = 1; i <= 8; i++) refs.push(shot(`generic-${i}`, req.lane));
    }
    const seen = new Set<string>();
    const references = refs.filter((r) => !skip.has(r.sourceUrl) && !seen.has(r.id) && seen.add(r.id));
    return { references, ok: true, requests: plan.length };
  });
}

function board(runPlan = adapter()) {
  let state: CanvasState = emptyState();
  const usage = createMemoryUsageStore();
  const deps: SearchReferencesDeps = {
    adapter: { run: vi.fn(), runPlan } as never,
    usage,
    getPlan: async () => "free",
    getDirection: async (_u, id) => DIRECTIONS[id] ?? null,
    getCanvasSourceUrls: async () => canvasSourceUrls(state),
    addToTray: async (_u, _c, refs, directionId, opts) => {
      const written = writeSearchTray(state, refs, directionId, opts?.baseline);
      state = written.state;
      return { dropped: written.dropped };
    },
    getBaseline: async () => state.baseline ?? null,
    upgradeUrl: () => "https://example.test/pricing",
    now: () => NOW,
  };
  return { tool: createSearchReferencesTool(deps), runPlan, usage, state: () => state };
}

type Out = { references: Reference[]; baseline?: { referenceIds: string[]; reused: boolean }; droppedShared?: number; extraLane?: unknown };

/** The results a search gave its direction (not the Shipped today baseline). */
const directionUrls = (out: Out) => {
  const shipped = new Set(out.baseline && !out.baseline.reused ? out.baseline.referenceIds : []);
  return out.references.filter((r) => !shipped.has(r.id)).map((r) => r.sourceUrl);
};

function noSharedUrl(lists: string[][]) {
  const all = lists.flat();
  expect(new Set(all).size).toBe(all.length);
}

describe("each result belongs to one direction", () => {
  it("3 directions searched at the same time on one canvas share no URL", async () => {
    const { tool, state } = board();
    const outs = await Promise.all(["bd-a", "bd-b", "bd-c"].map((id) => tool({ directionId: id, canvasId: "c1" }, "u1")));
    noSharedUrl(outs.map((o) => directionUrls(o.structuredContent as Out)));
    // The tray agrees: no link is tagged with two directions.
    const tagged = state().tray.filter((r) => r.directionId);
    const byUrl = new Map<string, Set<string>>();
    for (const r of tagged) byUrl.set(r.sourceUrl, (byUrl.get(r.sourceUrl) ?? new Set()).add(r.directionId!));
    expect([...byUrl.values()].every((dirs) => dirs.size === 1)).toBe(true);
    // The later writers were told what they lost.
    expect(outs.some((o) => (o.structuredContent as Out).droppedShared)).toBe(true);
    expect(outs.map((o) => o.content.map((c) => c.text).join("\n")).join("\n")).toContain("each result belongs to one direction");
  });

  it("3 directions searched one after another share no URL", async () => {
    const { tool } = board();
    const outs: Out[] = [];
    for (const id of ["bd-a", "bd-b", "bd-c"]) outs.push((await tool({ directionId: id, canvasId: "c1" }, "u1")).structuredContent as Out);
    noSharedUrl(outs.map(directionUrls));
  });

  it("runs one extra UI request when fewer than 6 UI results are left, and counts its credit", async () => {
    const { tool, runPlan, usage } = board();
    await tool({ directionId: "bd-a", canvasId: "c1" }, "u1");
    const calls = runPlan.mock.calls.length;
    const res = await tool({ directionId: "bd-b", canvasId: "c1" }, "u1");
    const extra = runPlan.mock.calls.slice(calls).map((c) => c[0]);
    // The direction's own search, then one single-request retry (cap 1).
    expect(extra).toHaveLength(2);
    expect(extra[1]).toHaveLength(1);
    expect(extra[1]![0]!.lane).not.toBe("fidelity");
    expect((res.structuredContent as Out).extraLane).toBeDefined();
    const sent = runPlan.mock.calls.reduce((n, c) => n + c[0].length, 0);
    expect(usage.credits.get(`u1|${currentPeriod(NOW)}`)).toBe(sent);
  });

  it("never runs the extra request past the per-call budget", async () => {
    const runPlan = vi.fn(async (): Promise<WebSearchResult> => ({ references: [shot("one", "bridge")], ok: true, requests: 8 }));
    const { tool } = board(runPlan);
    await tool({ directionId: "bd-a", canvasId: "c1" }, "u1");
    expect(runPlan).toHaveBeenCalledTimes(1);
  });

  it("keeps a direction's own links and those placed in its own section", () => {
    let state = emptyState();
    state = writeSearchTray(state, [shot("x", "bridge") as never], "bd-a").state;
    state = {
      ...state,
      nodes: [
        { id: "s1", type: "section", x: 0, y: 0, w: 600, h: 400, data: { title: "A", directionId: "bd-a" } },
        { id: "i1", type: "image", x: 10, y: 10, parentId: "s1", data: { imageUrl: "https://cdn.dribbble.com/i/y.png", sourceUrl: "https://dribbble.com/shots/y", sourceSite: "dribbble.com" } },
        { id: "i2", type: "image", x: 700, y: 10, data: { imageUrl: "https://cdn.dribbble.com/i/z.png", sourceUrl: "https://dribbble.com/shots/z", sourceSite: "dribbble.com" } },
      ] as never,
    };
    const forA = takenByOthers(state, "bd-a");
    expect([...forA].some((k) => k.includes("/x"))).toBe(false);
    expect([...forA].some((k) => k.includes("/y"))).toBe(false);
    expect([...forA].some((k) => k.includes("/z"))).toBe(true);
    const out = writeSearchTray(state, [shot("x", "bridge"), shot("y", "bridge"), shot("q", "bridge")] as never, "bd-b");
    expect(out.dropped.sort()).toEqual(["ref_x", "ref_y"]);
    expect(out.state.tray.find((r) => r.id === "ref_q")!.directionId).toBe("bd-b");
  });

  it("picks the next unsent UI request, never the baseline lane, else page 2", () => {
    const lanes: LaneTexts = { idea: "ruler ticks", fidelity: "esim plan picker app ui", bridge: "ruler ticks ui design", component: ["esim plan cards app ui", "esim checkout app ui"], platform: "mobile" };
    const first: PlannedRequest = { lane: "bridge", query: "ruler ticks ui design -template -kit -free -wireframe", site: "dribbble", titleWord: "ticks" };
    const next = nextUiRequest(lanes, [first]);
    expect(next).toBeDefined();
    expect(next!.lane).not.toBe("fidelity");
    expect(next!.query).not.toBe(first.query);
    const page2 = nextUiRequest({ idea: "x" }, [first]);
    expect(page2).toMatchObject({ lane: "bridge", page: 2, site: "dribbble" });
    expect(MIN_DIRECTION_UI).toBe(6);
  });
});
