/** Inline canvas live refresh: poll scheduler, merge decision, bridge refresh calls, results panel default. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBridgePersistence, LOAD_TOOL, type ToolCaller } from "@/canvas/persistence-bridge";
import {
  createRefreshScheduler,
  decideRefresh,
  initialTrayOpen,
  isNewer,
  pollDelay,
  pollOnce,
  type RefreshDecision,
  POLL_BLURRED_MS,
  POLL_FOCUSED_MS,
  POLL_MAX_MS,
  readTrayPreference,
  resetTrayPreference,
  TRAY_OPEN_KEY,
  writeTrayPreference,
} from "@/canvas/refresh";
import type { CanvasState } from "@/canvas/types";
import { createLoadCanvasStateTool } from "@/lib/mcp/tools/load_canvas_state";
import { ALICE, BOB, imageNode, makeDeps, seedCanvas, state } from "./tools-fixtures";

describe("pollDelay", () => {
  it("polls every 4 s with focus, 15 s without, never while hidden", () => {
    expect(pollDelay(true, true, 0)).toBe(POLL_FOCUSED_MS);
    expect(pollDelay(true, false, 0)).toBe(POLL_BLURRED_MS);
    expect(pollDelay(false, true, 0)).toBeNull();
  });

  it("backs off exponentially on errors, up to 60 s", () => {
    expect(pollDelay(true, true, 1)).toBe(8_000);
    expect(pollDelay(true, true, 2)).toBe(16_000);
    expect(pollDelay(true, true, 10)).toBe(POLL_MAX_MS);
    expect(pollDelay(true, false, 3)).toBe(POLL_MAX_MS);
  });
});

describe("createRefreshScheduler", () => {
  let visible = true;
  let focused = true;
  beforeEach(() => {
    vi.useFakeTimers();
    visible = true;
    focused = true;
  });
  afterEach(() => vi.useRealTimers());

  const make = (tick: () => Promise<unknown>) => createRefreshScheduler(tick, { isVisible: () => visible, isFocused: () => focused });

  it("ticks on the focused cadence and not at once on start", async () => {
    const tick = vi.fn(async () => undefined);
    const s = make(tick);
    s.start();
    expect(tick).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(POLL_FOCUSED_MS);
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(POLL_FOCUSED_MS * 2);
    expect(tick).toHaveBeenCalledTimes(3);
    s.stop();
  });

  it("slows down without focus and stops while hidden", async () => {
    const tick = vi.fn(async () => undefined);
    const s = make(tick);
    focused = false;
    s.start();
    expect(s.nextDelay).toBe(POLL_BLURRED_MS);
    await vi.advanceTimersByTimeAsync(POLL_FOCUSED_MS);
    expect(tick).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(POLL_BLURRED_MS);
    expect(tick).toHaveBeenCalledTimes(1);
    visible = false;
    s.update();
    expect(s.nextDelay).toBeNull();
    await vi.advanceTimersByTimeAsync(POLL_MAX_MS * 3);
    expect(tick).toHaveBeenCalledTimes(1);
    s.stop();
  });

  it("refreshes at once when the frame becomes visible again", async () => {
    const tick = vi.fn(async () => undefined);
    const s = make(tick);
    s.start();
    visible = false;
    s.update();
    visible = true;
    s.update();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(s.nextDelay).toBe(POLL_FOCUSED_MS);
    s.stop();
  });

  it("poke refreshes now (focus, host notifications)", async () => {
    const tick = vi.fn(async () => undefined);
    const s = make(tick);
    s.start();
    s.poke();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
    s.stop();
    s.poke();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("backs off after failures and resets after a success", async () => {
    let fail = true;
    const tick = vi.fn(async () => {
      if (fail) throw new Error("offline");
    });
    const s = make(tick);
    s.start();
    await vi.advanceTimersByTimeAsync(POLL_FOCUSED_MS);
    expect(s.failures).toBe(1);
    expect(s.nextDelay).toBe(8_000);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(s.failures).toBe(2);
    expect(s.nextDelay).toBe(16_000);
    fail = false;
    await vi.advanceTimersByTimeAsync(16_000);
    expect(s.failures).toBe(0);
    expect(s.nextDelay).toBe(POLL_FOCUSED_MS);
    s.stop();
  });

  it("stop clears the timer", async () => {
    const tick = vi.fn(async () => undefined);
    const s = make(tick);
    s.start();
    s.stop();
    expect(s.nextDelay).toBeNull();
    await vi.advanceTimersByTimeAsync(POLL_MAX_MS);
    expect(tick).not.toHaveBeenCalled();
  });
});

describe("merge decision", () => {
  const base = { newer: true, dirty: false, busy: false, conflict: false };
  it("applies a newer state when nothing local is pending", () => {
    expect(decideRefresh(base)).toBe("apply");
  });
  it("skips when nothing is newer", () => {
    expect(decideRefresh({ ...base, newer: false, dirty: true })).toBe("skip");
  });
  it("waits while the user drags, resizes or edits", () => {
    expect(decideRefresh({ ...base, busy: true })).toBe("defer");
    expect(decideRefresh({ ...base, busy: true, dirty: true })).toBe("defer");
  });
  it("saves unsaved work first instead of overwriting it", () => {
    expect(decideRefresh({ ...base, dirty: true })).toBe("flush");
  });
  it("leaves an open conflict to the banner", () => {
    expect(decideRefresh({ ...base, conflict: true })).toBe("conflict");
  });

  it("compares save times", () => {
    expect(isNewer("2026-10-15T12:00:01.000Z", "2026-10-15T12:00:00.000Z")).toBe(true);
    expect(isNewer("2026-10-15T12:00:00.000Z", "2026-10-15T12:00:00.000Z")).toBe(false);
    expect(isNewer("2026-10-15T11:00:00.000Z", "2026-10-15T12:00:00.000Z")).toBe(false);
    expect(isNewer("2026-10-15T11:00:00.000Z", undefined)).toBe(true);
    expect(isNewer(undefined, "2026-10-15T12:00:00.000Z")).toBe(false);
  });
});

describe("bridge refresh calls", () => {
  const T0 = "2026-10-15T12:00:00.000Z";
  const T1 = "2026-10-15T12:00:05.000Z";
  it("fetchLatest calls load_canvas_state by version without moving the base; adopt moves it", async () => {
    const calls: { name: string; arguments?: Record<string, unknown> }[] = [];
    const app: ToolCaller = {
      async callServerTool(p) {
        calls.push(p);
        return { structuredContent: { ok: true, state: { nodes: [] }, updatedAt: T1, takedownHash: "1-a" } };
      },
    };
    const p = createBridgePersistence({ app, canvasId: "c", initialState: {}, updatedAt: T0 });
    const latest = await p.fetchLatest();
    expect(calls).toEqual([{ name: LOAD_TOOL, arguments: { canvasId: "c", sinceUpdatedAt: T0 } }]);
    expect(latest).toEqual({ state: { nodes: [] }, updatedAt: T1, takedownHash: "1-a" });
    expect(p.baseUpdatedAt).toBe(T0);
    p.adopt(T1, "1-a");
    expect(p.baseUpdatedAt).toBe(T1);
    expect(p.takedownHash).toBe("1-a");
    await p.fetchLatest();
    expect(calls[1]!.arguments).toEqual({ canvasId: "c", sinceUpdatedAt: T1, takedownHash: "1-a" });
  });

  it("reads an unchanged answer, with the takedown list only when it came", async () => {
    let answer: Record<string, unknown> = { ok: true, unchanged: true, updatedAt: T0, takedownHash: "0-x" };
    const p = createBridgePersistence({
      app: { callServerTool: async () => ({ structuredContent: answer }) },
      canvasId: "c",
      initialState: {},
      updatedAt: T0,
    });
    expect(await p.fetchLatest()).toEqual({ unchanged: true, updatedAt: T0 });
    answer = { ...answer, takedowns: { hash: "1-y", entries: ["example.com", 3] } };
    expect(await p.fetchLatest()).toEqual({ unchanged: true, updatedAt: T0, takedowns: { hash: "1-y", entries: ["example.com"] } });
  });

  it("fetchLatest rejects on tool and transport errors (the poller backs off)", async () => {
    const bad = createBridgePersistence({
      app: { callServerTool: async () => ({ isError: true, content: [{ type: "text", text: "nope" }] }) },
      canvasId: "c",
    });
    await expect(bad.fetchLatest()).rejects.toThrow("nope");
    const down = createBridgePersistence({
      app: {
        callServerTool: async () => {
          throw new Error("gone");
        },
      },
      canvasId: "c",
    });
    await expect(down.fetchLatest()).rejects.toThrow(/reach the server/);
  });
});

describe("results panel default", () => {
  afterEach(() => resetTrayPreference());

  it("the web canvas opens it on wide screens; the inline canvas starts collapsed", () => {
    expect(initialTrayOpen({ readOnly: false, compact: false, collapsedByDefault: false, preference: null })).toBe(true);
    expect(initialTrayOpen({ readOnly: false, compact: false, collapsedByDefault: true, preference: null })).toBe(false);
    expect(initialTrayOpen({ readOnly: false, compact: true, collapsedByDefault: false, preference: null })).toBe(false);
    expect(initialTrayOpen({ readOnly: true, compact: false, collapsedByDefault: false, preference: true })).toBe(false);
  });

  it("a toggle this session wins on wide frames", () => {
    expect(initialTrayOpen({ readOnly: false, compact: false, collapsedByDefault: true, preference: true })).toBe(true);
    expect(initialTrayOpen({ readOnly: false, compact: false, collapsedByDefault: false, preference: false })).toBe(false);
  });

  it("in chat a panel opened in another canvas view does not carry over", () => {
    // Every chat view shares one sandbox origin, so session storage may say "open" from another canvas.
    const store = new Map<string, string>([[TRAY_OPEN_KEY, "1"]]);
    expect(readTrayPreference({ getItem: (k: string) => store.get(k) ?? null })).toBe(true);
    // The inline canvas reads only this view's own toggle (no storage): it starts collapsed.
    expect(initialTrayOpen({ readOnly: false, compact: false, collapsedByDefault: true, preference: readTrayPreference(null) })).toBe(false);
  });

  it("remembers the toggle in session storage, or in memory when storage throws", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(readTrayPreference(storage)).toBeNull();
    writeTrayPreference(true, storage);
    expect(store.get(TRAY_OPEN_KEY)).toBe("1");
    expect(readTrayPreference(storage)).toBe(true);

    resetTrayPreference();
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readTrayPreference(throwing)).toBeNull();
    writeTrayPreference(false, throwing);
    expect(readTrayPreference(throwing)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------- poll by version (P0-09)

describe("load_canvas_state polled by version", () => {
  async function setup(takedowns: string[] = []) {
    const { deps, repos } = makeDeps({ takedowns });
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_a", 1), imageNode("img_b", 3)]));
    const spies = {
      getOwned: vi.spyOn(repos.canvases, "getOwned"),
      getVersion: vi.spyOn(repos.canvases, "getVersion"),
      list: vi.spyOn(repos.takedowns, "list"),
      hash: vi.spyOn(repos.takedowns, "hash"),
    };
    const load = createLoadCanvasStateTool(deps);
    return { deps, repos, c, spies, load };
  }

  it("an unchanged poll reads no state blob and no full takedown list, but still checks the list", async () => {
    const { c, spies, load, repos } = await setup(["example.org"]);
    const hash = await repos.takedowns.hash();
    spies.hash.mockClear();
    const res = await load({ canvasId: c.id, sinceUpdatedAt: c.updatedAt.toISOString(), takedownHash: hash }, ALICE);
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toEqual({ ok: true, unchanged: true, updatedAt: c.updatedAt.toISOString(), takedownHash: hash });
    expect(spies.getOwned).not.toHaveBeenCalled();
    expect(spies.list).not.toHaveBeenCalled();
    expect(spies.getVersion).toHaveBeenCalledTimes(1);
    expect(spies.hash).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(res)).not.toContain("img_a");
  });

  it("sends the takedown list, and only it, when the view's hash is out of date", async () => {
    const { c, spies, load, repos } = await setup();
    const before = await repos.takedowns.hash();
    repos.data.takedowns.push("https://www.pinterest.com/pin/3/");
    const res = await load({ canvasId: c.id, sinceUpdatedAt: c.updatedAt.toISOString(), takedownHash: before }, ALICE);
    const out = res.structuredContent as { unchanged: true; takedownHash: string; takedowns: { hash: string; entries: string[] } };
    expect(out.unchanged).toBe(true);
    expect(out.takedowns.entries).toEqual(["https://www.pinterest.com/pin/3/"]);
    expect(out.takedowns.hash).not.toBe(before);
    expect(out.takedownHash).toBe(out.takedowns.hash);
    expect(spies.getOwned).not.toHaveBeenCalled();
  });

  it("loads the filtered board with its hash when the canvas changed, and refuses other users", async () => {
    const { c, load, repos, spies } = await setup(["https://www.pinterest.com/pin/3/"]);
    const stale = new Date(c.updatedAt.getTime() - 1000).toISOString();
    const res = await load({ canvasId: c.id, sinceUpdatedAt: stale, takedownHash: "x" }, ALICE);
    const out = res.structuredContent as { state: CanvasState; takedownHash: string; removed: number };
    expect(out.state.nodes.map((n) => n.id)).toEqual(["img_a"]);
    expect(out.removed).toBe(1);
    expect(out.takedownHash).toBe(await repos.takedowns.hash());
    expect(spies.getOwned).toHaveBeenCalledTimes(1);
    const bob = await load({ canvasId: c.id, sinceUpdatedAt: c.updatedAt.toISOString() }, BOB);
    expect(bob.structuredContent).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("fails closed when the takedown hash cannot be read", async () => {
    const { c, spies, load } = await setup();
    spies.hash.mockRejectedValueOnce(new Error("db"));
    const res = await load({ canvasId: c.id, sinceUpdatedAt: c.updatedAt.toISOString() }, ALICE);
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toMatchObject({ ok: false, reason: "error" });
  });
});

describe("pollOnce", () => {
  const T0 = "2026-10-15T12:00:00.000Z";
  const T1 = "2026-10-15T12:00:05.000Z";
  function view(prune: number | null = 0, decision: RefreshDecision = "apply") {
    return { offer: vi.fn(() => decision), prune: vi.fn((_: (url: string) => boolean) => prune) };
  }

  it("end to end: an unchanged board is not offered; a new takedown prunes it once", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_a", 1), imageNode("img_b", 3)]));
    const load = createLoadCanvasStateTool(deps);
    const p = createBridgePersistence({
      app: { callServerTool: async (q) => load(q.arguments, ALICE) },
      canvasId: c.id,
      initialState: {},
      updatedAt: c.updatedAt.toISOString(),
    });
    const getOwned = vi.spyOn(repos.canvases, "getOwned");
    const v = view(0);
    await pollOnce(p, v);
    // First poll: the view had no hash yet, so it gets the list once and keeps the hash.
    expect(v.prune).toHaveBeenCalledTimes(1);
    expect(p.takedownHash).toBe(await repos.takedowns.hash());
    await pollOnce(p, v);
    expect(v.prune).toHaveBeenCalledTimes(1);
    expect(v.offer).not.toHaveBeenCalled();
    expect(getOwned).not.toHaveBeenCalled();

    repos.data.takedowns.push("https://www.pinterest.com/pin/3/");
    await pollOnce(p, v);
    expect(v.prune).toHaveBeenCalledTimes(2);
    const isBlocked = v.prune.mock.calls[1]![0];
    expect(isBlocked("https://www.pinterest.com/pin/3/")).toBe(true);
    expect(isBlocked("https://www.pinterest.com/pin/1/")).toBe(false);
    expect(getOwned).not.toHaveBeenCalled();
  });

  it("keeps the old hash when the board is busy, so the next poll prunes again", async () => {
    const fetchLatest = vi.fn(async () => ({ unchanged: true as const, updatedAt: T0, takedowns: { hash: "1-a", entries: ["example.com"] } }));
    const p = { conflict: null, baseUpdatedAt: T0, fetchLatest, adopt: vi.fn(), adoptTakedowns: vi.fn() };
    await pollOnce(p, view(null));
    expect(p.adoptTakedowns).not.toHaveBeenCalled();
    await pollOnce(p, view(2));
    expect(p.adoptTakedowns).toHaveBeenCalledWith("1-a");
  });

  it("offers a newer save and adopts its version and hash only when applied", async () => {
    const fetchLatest = vi.fn(async () => ({ state: { nodes: [] }, updatedAt: T1, takedownHash: "2-b" }));
    const p = { conflict: null, baseUpdatedAt: T0, fetchLatest, adopt: vi.fn(), adoptTakedowns: vi.fn() };
    await pollOnce(p, view(0, "defer"));
    expect(p.adopt).not.toHaveBeenCalled();
    await pollOnce(p, view(0, "apply"));
    expect(p.adopt).toHaveBeenCalledWith(T1, "2-b");
  });

  it("does not poll during a conflict", async () => {
    const fetchLatest = vi.fn();
    const p = { conflict: {} as never, baseUpdatedAt: T0, fetchLatest, adopt: vi.fn(), adoptTakedowns: vi.fn() };
    await pollOnce(p, view());
    expect(fetchLatest).not.toHaveBeenCalled();
  });
});
