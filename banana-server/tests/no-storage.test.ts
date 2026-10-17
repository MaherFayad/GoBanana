/**
 * No-storage test (spec section 13, blocks CI).
 *
 * The web_search adapter and the search_references tool must never fetch image bytes
 * and never write anything to disk. Every network request is recorded; every node:fs
 * write API is replaced with a spy that records the call and refuses it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
// Loaded before the fs spies go on: module loading reads files, the tools under test must not.
import "@/lib/mcp/tools/rate_references";

const writes: string[] = [];

const WRITE_APIS = [
  "writeFile",
  "writeFileSync",
  "appendFile",
  "appendFileSync",
  "createWriteStream",
  "write",
  "writeSync",
  "writev",
  "writevSync",
  "copyFile",
  "copyFileSync",
  "cp",
  "cpSync",
  "rename",
  "renameSync",
  "mkdir",
  "mkdirSync",
  "mkdtemp",
  "mkdtempSync",
  "open",
  "openSync",
  "truncate",
  "truncateSync",
  "symlink",
  "symlinkSync",
  "link",
  "linkSync",
] as const;

/**
 * Spy on the write APIs of the real fs module objects (callback, sync and promises),
 * then sync the ESM named exports so `import { writeFile } from "node:fs"` sees the spies too.
 */
function spyOnWrites() {
  const targets: [Record<string, unknown>, string][] = [
    [fs as unknown as Record<string, unknown>, "fs"],
    [fs.promises as unknown as Record<string, unknown>, "fs.promises"],
  ];
  for (const [mod, label] of targets) {
    for (const name of WRITE_APIS) {
      if (typeof mod[name] !== "function") continue;
      const spy = vi.spyOn(mod as Record<string, (...a: unknown[]) => unknown>, name);
      spy.mockImplementation(function (this: unknown, ...args: unknown[]) {
        writes.push(`${label}.${name}(${String(args[0])})`);
        const error = new Error(`no-storage: ${label}.${name} called`);
        if (label === "fs.promises") return Promise.reject(error);
        throw error;
      });
    }
  }
  syncBuiltinESMExports();
}

import { DEFAULT_IMAGE_HOSTS, createWebSearchAdapter, parseAllowlist, type FetchLike } from "@/lib/sources";
import { createSearchReferencesTool } from "@/lib/mcp/tools/search_references";
import { createMemoryUsageStore, currentPeriod } from "@/lib/quota";
import { compileTakedowns } from "@/lib/takedown";
import { serperFixture } from "./sources.fixture";

const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);
const IMAGE_HOSTS = [
  ...DEFAULT_IMAGE_HOSTS,
  "pinimg.com",
  "dribbble.com",
  "behance.net",
  "awwwards.com",
  "pinterest.com",
  "gstatic.com",
  "someblog.example",
  "random.example",
];

type Recorded = { url: string; method: string };

function recordingFetch(requests: Recorded[]): FetchLike {
  return async (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? "GET" });
    if (new URL(String(input)).hostname !== "google.serper.dev") {
      throw new Error(`unexpected request to ${String(input)}`);
    }
    return new Response(JSON.stringify(serperFixture), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}

function assertOnlySerper(requests: Recorded[]) {
  expect(requests.length).toBeGreaterThan(0);
  for (const r of requests) {
    const host = new URL(r.url).hostname;
    expect(host).toBe("google.serper.dev");
    expect(r.method).toBe("POST");
    for (const imageHost of IMAGE_HOSTS) {
      expect(host === imageHost || host.endsWith(`.${imageHost}`)).toBe(false);
    }
  }
}

describe("no-storage: web_search never fetches or writes image bytes", () => {
  let globalRequests: Recorded[];

  beforeEach(() => {
    writes.length = 0;
    spyOnWrites();
    globalRequests = [];
    // Any request that bypasses the injected fetch lands here and is recorded too.
    vi.stubGlobal("fetch", recordingFetch(globalRequests));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    syncBuiltinESMExports();
  });

  it("the fs spies are live (sanity check)", async () => {
    const named = await import("node:fs");
    const promises = await import("node:fs/promises");
    expect(() => named.writeFileSync("/tmp/no-storage-sanity", "")).toThrow("no-storage");
    await expect(promises.writeFile("/tmp/no-storage-sanity", "")).rejects.toThrow("no-storage");
    expect(writes).toEqual([
      "fs.writeFileSync(/tmp/no-storage-sanity)",
      "fs.promises.writeFile(/tmp/no-storage-sanity)",
    ]);
    writes.length = 0;
  });

  it("adapter with injected fetch: one Serper call, no image hosts, no writes", async () => {
    const requests: Recorded[] = [];
    const adapter = createWebSearchAdapter({
      apiKey: "k",
      fetch: recordingFetch(requests),
      allowlist,
      loadTakedowns: async () => compileTakedowns(["https://dribbble.com/shots/777-Taken-down"]),
    });
    const result = await adapter.run({ query: "brutalist bakery app", count: 24, userId: "u1", sources: ["pinterest", "dribbble", "behance", "awwwards"] });

    expect(result.references.length).toBeGreaterThan(0);
    // One request per source and page of 10 (Serper free plan), never more than 4 for a plain query.
    expect(requests.length).toBe(4);
    assertOnlySerper(requests);
    expect(globalRequests).toEqual([]);
    expect(writes).toEqual([]);
    // Results are URLs and metadata only: no inline bytes.
    expect(JSON.stringify(result)).not.toMatch(/data:|base64/i);
  });

  it("adapter with the global fetch: still only Serper, no writes", async () => {
    const adapter = createWebSearchAdapter({ apiKey: "k", allowlist });
    await adapter.run({ query: "q", count: 12, userId: "u1" });
    assertOnlySerper(globalRequests);
    expect(globalRequests.length).toBeGreaterThanOrEqual(2);
    expect(globalRequests.length).toBeLessThanOrEqual(8);
    expect(writes).toEqual([]);
  });

  it("failure path makes no extra requests and writes nothing", async () => {
    const requests: Recorded[] = [];
    const adapter = createWebSearchAdapter({
      apiKey: "k",
      allowlist,
      fetch: async (input, init) => {
        requests.push({ url: String(input), method: init?.method ?? "GET" });
        return new Response("down", { status: 503 });
      },
    });
    const result = await adapter.run({ query: "q", count: 12, userId: "u1" });
    expect(result.references).toEqual([]);
    // Page 1 of each planned UI form ("q app ui" and "q ui design" on Dribbble, "q app ui" on Pinterest), nothing more.
    expect(requests).toHaveLength(3);
    assertOnlySerper(requests);
    expect(globalRequests).toEqual([]);
    expect(writes).toEqual([]);
  });

  it("search_references tool end to end: only Serper, no writes", async () => {
    const requests: Recorded[] = [];
    const tray: unknown[] = [];
    const usage = createMemoryUsageStore();
    const tool = createSearchReferencesTool({
      adapter: createWebSearchAdapter({ apiKey: "k", fetch: recordingFetch(requests), allowlist }),
      usage,
      getPlan: async () => "free",
      getDirection: async () => ({ id: "d1", searchQuery: "melted chrome", brief: "Flight checkout screen (mobile, Arabic)" }),
      addToTray: async (_u, _c, refs) => {
        tray.push(...refs);
        return true;
      },
      upgradeUrl: () => "https://example.test/pricing",
    });
    const res = await tool({ directionId: "d1", canvasId: "c1" }, "u1");
    expect(res.isError).toBeUndefined();
    expect(tray.length).toBeGreaterThan(0);
    // What goes to the tray is URLs and metadata only.
    for (const item of tray) {
      for (const value of Object.values(item as Record<string, unknown>)) {
        expect(typeof value === "string" || typeof value === "number").toBe(true);
      }
    }
    // Every lane is a path-scoped Serper request, at most 8 per call; one search for the quota.
    expect(requests.length).toBeGreaterThanOrEqual(4);
    expect(requests.length).toBeLessThanOrEqual(8);
    const queries = (res.structuredContent as { queries: string[] }).queries;
    // Every request is one path-scoped `site:` search on a registry source.
    expect(queries.every((q) => / site:[a-z0-9.-]+\.[a-z]+(\/\S*)?$/.test(q))).toBe(true);
    // The raw idea is searched only in the art zone (with shop negatives), never in a UI lane.
    expect(queries.some((q) => q.startsWith("melted chrome site:"))).toBe(false);
    // The art lane starts its ladder with a graphic system (V4.3), with the shop negatives.
    expect(queries.some((q) => q.startsWith("melted chrome identity system -etsy"))).toBe(true);
    // Both zones: the art lane takes the bridge lane's place in the 7-request base plan.
    expect(queries.some((q) => q.startsWith("arabic flight app ui"))).toBe(true);
    expect((await usage.get("u1", currentPeriod())).searches).toBe(1);
    assertOnlySerper(requests);
    expect(globalRequests).toEqual([]);
    expect(writes).toEqual([]);
  });

  it("search learning (blocklist, learned arms, a lane re-search) and rating: only Serper, no writes", async () => {
    const requests: Recorded[] = [];
    const tray: unknown[] = [];
    const tool = createSearchReferencesTool({
      adapter: createWebSearchAdapter({ apiKey: "k", fetch: recordingFetch(requests), allowlist }),
      usage: createMemoryUsageStore(),
      getPlan: async () => "free",
      getDirection: async () => ({ id: "d1", searchQuery: "melted chrome", brief: "Flight checkout screen" }),
      addToTray: async (_u, _c, refs) => {
        tray.push(...refs);
        return true;
      },
      getUserLearning: async () => ({
        blocked: ["dribbble:1"],
        creatorRatings: [
          { itemKey: "dribbble:2", verdict: "great", creator: "jane doe" },
          { itemKey: "dribbble:3", verdict: "great", creator: "jane doe" },
        ],
      }),
      getArmStats: async (_u, keys) => [
        { termKey: keys[0]!, arm: "agent:flight booking app ui", great: 9, bad: 0, users: 9, ownGreat: 0, ownBad: 0 },
        { termKey: keys[0]!, arm: "default", great: 0, bad: 9, users: 9, ownGreat: 0, ownBad: 0 },
      ],
      upgradeUrl: () => "https://example.test/pricing",
    });
    const full = await tool({ directionId: "d1", canvasId: "c1" }, "u1");
    expect(full.isError).toBeUndefined();
    const lane = await tool({ directionId: "d1", canvasId: "c1", lane: "bridge", query: "chrome macro" }, "u1");
    expect(lane.isError).toBeUndefined();
    expect(tray.length).toBeGreaterThan(0);
    for (const item of tray) {
      for (const value of Object.values(item as Record<string, unknown>)) {
        expect(typeof value === "string" || typeof value === "number").toBe(true);
      }
    }
    expect(requests.length).toBeLessThanOrEqual(8 + 2);

    // Rating touches only the in-memory repos: no network, no writes.
    const { createRateReferencesTool } = await import("@/lib/mcp/tools/rate_references");
    const { createMemoryRepos } = await import("@/lib/db/memory");
    const repos = createMemoryRepos();
    const c = await repos.canvases.create({ userId: "11111111-1111-4111-8111-111111111111", title: "B", state: {} });
    const saved = tray.slice(0, 2) as Parameters<typeof repos.references.insertMany>[1];
    await repos.references.insertMany(c.id, saved);
    const rate = createRateReferencesTool({ repos, appUrl: () => "https://example.test" });
    const before = requests.length;
    const rated = await rate(
      { canvasId: c.id, ratings: saved.map((r) => ({ referenceId: r.id, verdict: "bad" as const })) },
      "11111111-1111-4111-8111-111111111111",
    );
    expect(rated.structuredContent).toMatchObject({ rated: 2, bad: 2 });
    expect(requests.length).toBe(before);

    assertOnlySerper(requests);
    expect(globalRequests).toEqual([]);
    expect(writes).toEqual([]);
  });
});

