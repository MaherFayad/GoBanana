/**
 * P0-03: the fidelity lane (the page as apps ship it) is the same for every direction of one
 * brief, so it runs once per canvas. Later direction searches on that canvas reuse its ids and
 * send no fidelity request; its results go to a "Shipped today" section, never to a direction.
 */
import { describe, expect, it, vi } from "vitest";
import { emptyState, parseState } from "@/canvas/state";
import { MAX_BASELINE_SENT, type CanvasState } from "@/canvas/types";
import { createMemoryRepos } from "@/lib/db/memory";
import { createSearchReferencesTool, type Direction, type SearchReferencesDeps } from "@/lib/mcp/tools/search_references";
import { writeSearchTray } from "@/lib/sources/tray";
import { createMemoryUsageStore } from "@/lib/quota";
import { BASELINE_TTL_MS, baselineKey, isFreshBaseline, mergeBaseline, sentKey, withoutBaselineLane, withoutSent, withSent } from "@/lib/sources/baseline";
import type { PlannedRequest } from "@/lib/sources/plan";
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

/** A fake adapter: each planned request answers with 3 results of its own lane and site. */
function answer(plan: readonly PlannedRequest[]): WebSearchResult {
  const references: Reference[] = plan.flatMap((req, i) =>
    [0, 1, 2].map((j) => {
      const id = `ref_${req.lane}_${req.site}_${i}_${j}_${req.query.length}`;
      return {
        id,
        thumbUrl: `https://cdn.dribbble.com/t/${id}.png`,
        imageUrl: `https://cdn.dribbble.com/i/${id}.png`,
        sourceUrl: `https://dribbble.com/shots/${id}`,
        sourceSite: "dribbble.com",
        title: `${req.lane} shot ${j}`,
        lane: req.lane,
        zone: req.lane === "art" ? "art" : "ui",
      } as Reference;
    }),
  );
  return { references, ok: true, requests: plan.length };
}

function board(clock: { now: Date } = { now: NOW }) {
  let state: CanvasState = emptyState();
  const runPlan = vi.fn(async (plan: readonly PlannedRequest[]) => answer(plan));
  const deps: SearchReferencesDeps = {
    adapter: { run: vi.fn(), runPlan } as never,
    usage: createMemoryUsageStore(),
    getPlan: async () => "free",
    getDirection: async (_u, id) => DIRECTIONS[id] ?? null,
    addToTray: async (_u, _c, refs, directionId, opts) => {
      const written = writeSearchTray(state, refs, directionId, opts?.baseline);
      state = written.state;
      return { dropped: written.dropped };
    },
    getBaseline: async () => parseState(JSON.parse(JSON.stringify(state))).baseline ?? null,
    upgradeUrl: () => "https://example.test/pricing",
    now: () => clock.now,
  };
  return { tool: createSearchReferencesTool(deps), runPlan, state: () => state, clock };
}

const fidelityRequests = (plan: readonly PlannedRequest[]) => plan.filter((r) => r.lane === "fidelity").length;

describe("one baseline lane per canvas", () => {
  it("the second and third direction searches send zero fidelity requests", async () => {
    const { tool, runPlan, state } = board();
    const first = await tool({ directionId: "bd-a", canvasId: "c1" }, "u1");
    await tool({ directionId: "bd-b", canvasId: "c1" }, "u1");
    await tool({ directionId: "bd-c", canvasId: "c1" }, "u1");
    const plans = runPlan.mock.calls.map((c) => c[0]);
    expect(fidelityRequests(plans[0]!)).toBeGreaterThan(0);
    expect(fidelityRequests(plans[1]!)).toBe(0);
    expect(fidelityRequests(plans[2]!)).toBe(0);
    // The skipped lane is not paid for: later searches send fewer requests.
    expect(plans[1]!.length).toBeLessThan(plans[0]!.length);

    const saved = state().baseline!;
    expect(saved.key).toBe("mobile|" + baselineKey({ fidelity: (first.structuredContent as { lanes: { fidelity: string } }).lanes.fidelity })!.split("|")[1]);
    expect(saved.at).toBe(NOW.toISOString());
    expect(saved.referenceIds.length).toBeGreaterThan(0);
    expect(saved.referenceIds.every((id) => id.startsWith("ref_fidelity_"))).toBe(true);
  });

  it("puts baseline results in the tray with no direction and lists them under Shipped today", async () => {
    const { tool, state } = board();
    const res = await tool({ directionId: "bd-a", canvasId: "c1" }, "u1");
    const text = res.content.map((c) => c.text).join("\n");
    expect(text).toContain('place these in one "Shipped today" section, never in a direction');
    const tray = state().tray;
    const shipped = tray.filter((r) => r.id.startsWith("ref_fidelity_"));
    expect(shipped.length).toBeGreaterThan(0);
    expect(shipped.every((r) => r.directionId === undefined)).toBe(true);
    expect(tray.filter((r) => !r.id.startsWith("ref_fidelity_")).every((r) => r.directionId === "bd-a")).toBe(true);
    // The UI list above the Shipped today heading has no fidelity results.
    const uiBlock = text.split("Shipped today (")[0]!;
    expect(uiBlock).not.toMatch(/ref_fidelity_/);
  });

  it("tells the agent where the reused baseline is", async () => {
    const { tool } = board();
    await tool({ directionId: "bd-a", canvasId: "c1" }, "u1");
    const res = await tool({ directionId: "bd-b", canvasId: "c1" }, "u1");
    const out = res.structuredContent as { baseline: { reused: boolean; referenceIds: string[] } };
    expect(out.baseline.reused).toBe(true);
    const text = res.content.map((c) => c.text).join("\n");
    expect(text).toContain("The baseline lane (fidelity) already ran for this canvas on 2026-10-15, so it was skipped.");
    expect(text).toContain(out.baseline.referenceIds[0]);
  });

  it("runs the lane again after 7 days", async () => {
    const clock = { now: NOW };
    const { tool, runPlan } = board(clock);
    await tool({ directionId: "bd-a", canvasId: "c1" }, "u1");
    clock.now = new Date(NOW.getTime() + BASELINE_TTL_MS + 1000);
    await tool({ directionId: "bd-b", canvasId: "c1" }, "u1");
    expect(fidelityRequests(runPlan.mock.calls[1]![0])).toBeGreaterThan(0);
  });

  it("runs the lane for a different page or platform, and for a lane re-search when asked", async () => {
    const { tool, runPlan } = board();
    await tool({ directionId: "bd-a", canvasId: "c1" }, "u1");
    DIRECTIONS["bd-d"] = { ...direction("bd-d", "neon sign"), detail: { platform: "website", brief: BRIEF, artQueries: ["neon sign"] } as never };
    await tool({ directionId: "bd-d", canvasId: "c1" }, "u1");
    expect(fidelityRequests(runPlan.mock.calls[1]![0])).toBeGreaterThan(0);
    await tool({ directionId: "bd-b", canvasId: "c1", lane: "fidelity", query: "esim data plan cards" }, "u1");
    expect(fidelityRequests(runPlan.mock.calls[2]![0])).toBeGreaterThan(0);
    delete DIRECTIONS["bd-d"];
  });

  it("does not save a baseline without a canvas", async () => {
    const { tool, state, runPlan } = board();
    DIRECTIONS["bd-x"] = { ...direction("bd-x", "foil"), canvasId: null };
    await tool({ directionId: "bd-x" }, "u1");
    await tool({ directionId: "bd-x" }, "u1");
    expect(state().baseline).toBeUndefined();
    expect(fidelityRequests(runPlan.mock.calls[1]![0])).toBeGreaterThan(0);
    delete DIRECTIONS["bd-x"];
  });
});

describe("baseline helpers", () => {
  const b = { key: "mobile|esim plan picker app ui", referenceIds: ["ref_1"], at: NOW.toISOString() };

  it("keys on platform and fidelity words", () => {
    expect(baselineKey({ fidelity: "eSIM  Plan picker app ui", platform: "mobile" })).toBe("mobile|esim plan picker app ui");
    expect(baselineKey({ platform: "mobile" })).toBeNull();
  });

  it("is fresh for 7 days on the same key only", () => {
    expect(isFreshBaseline(b, b.key, NOW)).toBe(true);
    expect(isFreshBaseline(b, "website|x", NOW)).toBe(false);
    expect(isFreshBaseline(b, b.key, new Date(NOW.getTime() + BASELINE_TTL_MS))).toBe(false);
    expect(isFreshBaseline(null, b.key, NOW)).toBe(false);
  });

  it("drops only fidelity requests", () => {
    const plan = [{ lane: "fidelity" }, { lane: "bridge" }, { lane: "fidelity" }, { lane: "art" }] as PlannedRequest[];
    expect(withoutBaselineLane(plan).map((r) => r.lane)).toEqual(["bridge", "art"]);
  });

  it("merges ids from two searches that ran at once, replaces a stale or other key", () => {
    expect(mergeBaseline(b, { ...b, referenceIds: ["ref_2", "ref_1"] }, NOW).referenceIds).toEqual(["ref_1", "ref_2"]);
    expect(mergeBaseline(b, { ...b, key: "website|x", referenceIds: ["ref_9"] }, NOW).referenceIds).toEqual(["ref_9"]);
  });

  it("parseState keeps a valid baseline and drops a malformed one", () => {
    expect(parseState({ nodes: [], baseline: b }).baseline).toEqual(b);
    expect(parseState({ nodes: [], baseline: { key: "k", at: "nope", referenceIds: [] } }).baseline).toBeUndefined();
    expect(parseState({ nodes: [], baseline: { key: "k", at: NOW.toISOString(), referenceIds: [1, "a", "a"] } }).baseline).toEqual({
      key: "k",
      at: NOW.toISOString(),
      referenceIds: ["a"],
    });
  });

  it("a canvas UI save without baseline keeps the stored one", async () => {
    const repos = createMemoryRepos();
    const c = await repos.canvases.create({ userId: "8b7f6c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f", title: "x", state: emptyState() });
    await repos.canvases.saveState(c.userId, c.id, { ...emptyState(), baseline: b });
    await repos.canvases.saveState(c.userId, c.id, emptyState());
    expect(parseState((await repos.canvases.getOwned(c.userId, c.id))!.state).baseline).toEqual(b);
  });
});

describe("no request runs twice on one canvas (Gate 2 fix)", () => {
  const b = { key: "mobile|esim plan picker app ui", referenceIds: ["ref_1"], at: NOW.toISOString() };
  it("later direction searches skip every request the canvas already sent, not only the fidelity lane", async () => {
    const { tool, runPlan, state } = board();
    await tool({ directionId: "bd-a", canvasId: "c1" }, "u1");
    await tool({ directionId: "bd-b", canvasId: "c1" }, "u1");
    await tool({ directionId: "bd-c", canvasId: "c1" }, "u1");
    const keys = runPlan.mock.calls.map((c) => [...new Set((c[0] as PlannedRequest[]).map(sentKey))]);
    const seen = new Set<string>();
    for (const plan of keys) {
      for (const k of plan) expect(seen.has(k), k).toBe(false);
      for (const k of plan) seen.add(k);
    }
    // The taste lane (brief level for a mobile brief with no user taste) ran on the first search only.
    const taste = runPlan.mock.calls.map((c) => (c[0] as PlannedRequest[]).filter((r) => r.lane === "taste").length);
    expect(taste[0]).toBeGreaterThan(0);
    expect(taste.slice(1).every((n) => n === 0)).toBe(true);
    expect(state().baseline!.sent!.length).toBeGreaterThan(keys[0]!.length);
  });

  it("a direction whose brief-level taste request already ran gets its own taste wording instead", async () => {
    const styled = (bendId: string, idea: string, styleWords: string[]): Direction => ({
      ...direction(bendId, idea),
      detail: { platform: "mobile", brief: BRIEF, artQueries: [idea], spec: { styleWords } } as never,
    });
    DIRECTIONS["bd-s1"] = styled("bd-s1", "letterpress texture", ["dark mode", "grainy"]);
    DIRECTIONS["bd-s2"] = styled("bd-s2", "exhibition catalog", ["minimal"]);
    const { tool, runPlan } = board();
    await tool({ directionId: "bd-s1", canvasId: "c1" }, "u1");
    await tool({ directionId: "bd-s2", canvasId: "c1" }, "u1");
    const taste = runPlan.mock.calls.slice(0, 2).map((c) => (c[0] as PlannedRequest[]).filter((r) => r.lane === "taste").map((r) => r.query.split(" -")[0]));
    expect(taste[0]![0]).toMatch(/^dark /);
    expect(taste[1]).toHaveLength(1);
    expect(taste[1]![0]).toMatch(/^minimal /);
    expect(taste[1]![0]!.replace(/^minimal /, "")).toBe(taste[0]![0]!.replace(/^dark /, ""));
  });

  it("sentKey tells pages and sites apart, withoutSent drops only sent requests", () => {
    const a = { lane: "taste", query: "Dark  eSIM plan ui", site: "pinterest" } as PlannedRequest;
    expect(sentKey(a)).toBe(sentKey({ ...a, query: "dark esim plan ui" }));
    expect(sentKey(a)).not.toBe(sentKey({ ...a, page: 2 }));
    expect(sentKey(a)).not.toBe(sentKey({ ...a, site: "dribbble" }));
    const b2 = withSent(b, [sentKey(a)]);
    expect(withoutSent([a, { ...a, site: "dribbble" } as PlannedRequest], b2).map((r) => r.site)).toEqual(["dribbble"]);
    expect(withoutSent([a], null)).toEqual([a]);
  });

  it("merges sent keys, keeps the newest MAX_BASELINE_SENT, and parseState keeps them", () => {
    const merged = mergeBaseline(withSent(b, ["x"]), withSent(b, ["y", "x"]), NOW);
    expect(merged.sent).toEqual(["x", "y"]);
    const many = withSent(b, Array.from({ length: MAX_BASELINE_SENT + 5 }, (_, i) => `k${i}`));
    expect(many.sent).toHaveLength(MAX_BASELINE_SENT);
    expect(many.sent![0]).toBe("k5");
    expect(parseState({ nodes: [], baseline: merged }).baseline).toEqual(merged);
    expect(parseState({ nodes: [], baseline: { ...b, sent: [3, "", "z"] } }).baseline?.sent).toEqual(["z"]);
  });
});
