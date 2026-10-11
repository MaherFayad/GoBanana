/** Inline canvas live refresh: poll scheduler, merge decision, bridge refresh calls, results panel default. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBridgePersistence, LOAD_TOOL, type ToolCaller } from "@/canvas/persistence-bridge";
import {
  createRefreshScheduler,
  decideRefresh,
  initialTrayOpen,
  isNewer,
  pollDelay,
  POLL_BLURRED_MS,
  POLL_FOCUSED_MS,
  POLL_MAX_MS,
  readTrayPreference,
  resetTrayPreference,
  TRAY_OPEN_KEY,
  writeTrayPreference,
} from "@/canvas/refresh";

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
  it("fetchLatest calls load_canvas_state without moving the base; adopt moves it", async () => {
    const calls: string[] = [];
    const app: ToolCaller = {
      async callServerTool(p) {
        calls.push(p.name);
        return { structuredContent: { ok: true, state: { nodes: [] }, updatedAt: T1 } };
      },
    };
    const p = createBridgePersistence({ app, canvasId: "c", initialState: {}, updatedAt: T0 });
    const latest = await p.fetchLatest();
    expect(calls).toEqual([LOAD_TOOL]);
    expect(latest).toEqual({ state: { nodes: [] }, updatedAt: T1 });
    expect(p.baseUpdatedAt).toBe(T0);
    p.adopt(T1);
    expect(p.baseUpdatedAt).toBe(T1);
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
