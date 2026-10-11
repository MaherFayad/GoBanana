import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutoSaver, SAVE_DELAY_MS, type SaveStatus } from "@/canvas/autosave";
import { createFetchPersistence, createMemoryPersistence } from "@/canvas/persistence";
import { emptyState, serializeState } from "@/canvas/state";
import { noteNode } from "@/canvas/factory";
import type { CanvasState } from "@/canvas/types";

function stateWith(text: string): CanvasState {
  return serializeState([noteNode({ x: 0, y: 0 }, text, "n1")], { x: 0, y: 0, zoom: 1 });
}

describe("auto-save debounce (1 s)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits 1 s after the last change and saves only the last state", async () => {
    expect(SAVE_DELAY_MS).toBe(1000);
    const save = vi.fn(async (_s: CanvasState) => {});
    const saver = createAutoSaver(save);
    saver.schedule(stateWith("a"));
    await vi.advanceTimersByTimeAsync(600);
    saver.schedule(stateWith("ab"));
    await vi.advanceTimersByTimeAsync(600);
    saver.schedule(stateWith("abc"));
    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].nodes[0]?.data).toMatchObject({ text: "abc" });
  });

  it("skips a state equal to the one already saved", async () => {
    const save = vi.fn(async (_s: CanvasState) => {});
    const initial = stateWith("same");
    const saver = createAutoSaver(save, { initialKey: JSON.stringify(initial) });
    saver.schedule(stateWith("same"));
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
  });

  it("reports status and retries after an error", async () => {
    const statuses: SaveStatus[] = [];
    let fail = true;
    const save = vi.fn(async (_s: CanvasState) => {
      if (fail) throw new Error("offline");
    });
    const saver = createAutoSaver(save, { onStatus: (s) => statuses.push(s) });
    saver.schedule(stateWith("x"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(saver.status).toBe("error");
    fail = false;
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(saver.status).toBe("saved");
    expect(statuses).toEqual(["pending", "saving", "error", "saving", "saved"]);
  });

  it("flush saves right away", async () => {
    const save = vi.fn(async (_s: CanvasState) => {});
    const saver = createAutoSaver(save);
    saver.schedule(stateWith("now"));
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does not overlap saves; a change during a save is saved after it", async () => {
    let release: () => void = () => {};
    const calls: string[] = [];
    const save = vi.fn((s: CanvasState) => {
      calls.push(String((s.nodes[0]?.data as { text?: string }).text));
      return calls.length === 1 ? new Promise<void>((r) => (release = r)) : Promise.resolve();
    });
    const saver = createAutoSaver(save);
    saver.schedule(stateWith("one"));
    await vi.advanceTimersByTimeAsync(1000);
    saver.schedule(stateWith("two"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toEqual(["one"]);
    release();
    await vi.advanceTimersByTimeAsync(0);
    await saver.flush();
    expect(calls).toEqual(["one", "two"]);
  });

  it("cancel drops a waiting save", async () => {
    const save = vi.fn(async (_s: CanvasState) => {});
    const saver = createAutoSaver(save);
    saver.schedule(stateWith("x"));
    saver.cancel();
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
  });
});

describe("persistence adapters", () => {
  it("fetch adapter PUTs JSON state and loads { state }", async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const fakeFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (init?.method === "GET") return new Response(JSON.stringify({ state: emptyState() }), { status: 200 });
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    const p = createFetchPersistence("abc 1", { fetch: fakeFetch });
    expect(await p.load()).toEqual(emptyState());
    await p.save(stateWith("hi"));
    expect(requests[0]?.url).toBe("/api/canvas/abc%201");
    expect(requests[1]?.init?.method).toBe("PUT");
    const body = JSON.parse(String(requests[1]?.init?.body)) as { state: CanvasState };
    expect(body.state.nodes[0]?.data).toMatchObject({ text: "hi" });
    // Only JSON goes out; never image bytes.
    expect(typeof requests[1]?.init?.body).toBe("string");
  });

  it("fetch adapter throws a plain error on failure", async () => {
    const fakeFetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
    const p = createFetchPersistence("x", { fetch: fakeFetch });
    await expect(p.save(emptyState())).rejects.toThrow("Could not save this canvas.");
    await expect(p.load()).rejects.toThrow("Could not load this canvas.");
  });

  it("memory adapter keeps the last save", async () => {
    const p = createMemoryPersistence(null);
    await p.save(stateWith("m"));
    expect(p.saved).toHaveLength(1);
    expect(await p.load()).toEqual(stateWith("m"));
  });
});
