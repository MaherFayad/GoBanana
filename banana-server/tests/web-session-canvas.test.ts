/** Web canvas saves send the version they started from and stop after a 409. */
import { describe, expect, it } from "vitest";
import { CONFLICT_MESSAGE, createFetchPersistence, isConflict, saveErrorText } from "@/canvas/persistence";
import { emptyState } from "@/canvas/state";

type Call = { method: string; body: unknown };

function fakeServer(responses: Response[]) {
  const calls: Call[] = [];
  const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    return next;
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("fetch persistence with baseUpdatedAt", () => {
  it("sends the page's version, then the version each save returns", async () => {
    const { calls, fetchImpl } = fakeServer([
      json({ ok: true, updatedAt: "2026-10-11T10:00:01.000Z" }),
      json({ ok: true, updatedAt: "2026-10-11T10:00:02.000Z" }),
    ]);
    const p = createFetchPersistence("c1", { fetch: fetchImpl, baseUpdatedAt: "2026-10-11T10:00:00.000Z" });
    await p.save(emptyState());
    await p.save(emptyState());
    expect(calls.map((c) => (c.body as { baseUpdatedAt?: string }).baseUpdatedAt)).toEqual([
      "2026-10-11T10:00:00.000Z",
      "2026-10-11T10:00:01.000Z",
    ]);
  });

  it("takes the version from GET when the page had no state", async () => {
    const { calls, fetchImpl } = fakeServer([
      json({ state: emptyState(), updatedAt: "2026-10-11T09:00:00.000Z" }),
      new Response(null, { status: 204 }),
    ]);
    const p = createFetchPersistence("c1", { fetch: fetchImpl });
    await p.load();
    await p.save(emptyState());
    expect((calls[1]?.body as { baseUpdatedAt?: string }).baseUpdatedAt).toBe("2026-10-11T09:00:00.000Z");
  });

  it("without any version, saves without baseUpdatedAt (last write wins)", async () => {
    const { calls, fetchImpl } = fakeServer([new Response(null, { status: 204 })]);
    const p = createFetchPersistence("c1", { fetch: fetchImpl });
    await p.save(emptyState());
    expect(calls[0]?.body).not.toHaveProperty("baseUpdatedAt");
  });

  it("on 409 throws the plain conflict message and never saves again", async () => {
    const { calls, fetchImpl } = fakeServer([json({ error: "changed" }, 409)]);
    const p = createFetchPersistence("c1", { fetch: fetchImpl, baseUpdatedAt: "2026-10-11T10:00:00.000Z" });
    const first = await p.save(emptyState()).catch((e: unknown) => e);
    expect(isConflict(first)).toBe(true);
    expect((first as Error).message).toBe(CONFLICT_MESSAGE);
    expect(CONFLICT_MESSAGE).toBe("This canvas changed in another window. Reload to see the latest.");
    await expect(p.save(emptyState())).rejects.toThrow(CONFLICT_MESSAGE);
    expect(calls).toHaveLength(1);
  });
});

describe("fetch persistence and big boards", () => {
  it("drops keepalive over 64 KiB (browsers fail such a fetch outright) and keeps it for small saves", async () => {
    const seen: (boolean | undefined)[] = [];
    const fetchImpl = (async (_u: RequestInfo | URL, init?: RequestInit) => {
      seen.push(init?.keepalive);
      return new Response(JSON.stringify({ ok: true, updatedAt: "2026-10-12T10:00:00.000Z" }), { status: 200 });
    }) as typeof fetch;
    const p = createFetchPersistence("c1", { fetch: fetchImpl });
    await p.save(emptyState());
    const big = { ...emptyState(), nodes: [{ id: "n", type: "note", position: { x: 0, y: 0 }, data: { text: "x".repeat(90_000) } }] };
    await p.save(big as unknown as ReturnType<typeof emptyState>);
    expect(seen).toEqual([true, false]);
  });

  it("a refused save carries the server's reason, and the toast text says it", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: "This canvas is too large to save." }), { status: 413 })) as typeof fetch;
    const p = createFetchPersistence("c1", { fetch: fetchImpl });
    const err = await p.save(emptyState()).catch((e: unknown) => e);
    expect(saveErrorText(err)).toBe("This canvas is too large to save. Your changes are still here.");
    expect(saveErrorText(new TypeError("Failed to fetch"))).toMatch(/Check your connection/);
  });
});
