/**
 * P0-01: one search_references call can send up to 10 Serper requests (10 credits). The visible
 * quota still counts 1 search per call; the real credits are stored per user and period, and a
 * global monthly cap (SERPER_MONTHLY_CREDIT_CAP) stops searches with a plain message.
 */
import { describe, expect, it, vi } from "vitest";
import { createSearchReferencesTool, type Direction, type SearchReferencesDeps } from "@/lib/mcp/tools/search_references";
import { drizzle } from "drizzle-orm/neon-http";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { createMemoryRepos } from "@/lib/db/memory";
import { incrementUsage, sumCredits } from "@/lib/db/usage";
import { canSpendCredits, createMemoryUsageStore, currentPeriod, serperCreditCap } from "@/lib/quota";
import { DEFAULT_IMAGE_HOSTS, createWebSearchAdapter, parseAllowlist, type FetchLike } from "@/lib/sources";

const NOW = new Date("2026-10-15T12:00:00Z");
const PERIOD = currentPeriod(NOW);
const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);

const DIRECTION: Direction = {
  id: "row-bd-1",
  bendId: "bd-1",
  canvasId: "c1",
  searchQuery: "letterpress texture",
  brief: "eSIM plan picker for a GCC travel app",
  detail: { platform: "mobile", brief: "eSIM plan picker for a GCC travel app", artQueries: ["letterpress texture"] } as never,
};

const page = {
  images: [1, 2, 3].map((i) => ({
    title: `eSIM plan app UI ${i} by Someone on Dribbble`,
    link: `https://dribbble.com/shots/2694562${i}-shot`,
    imageUrl: `https://cdn.dribbble.com/userupload/${i}.png`,
  })),
};

function deps(fetch: FetchLike, over: Partial<SearchReferencesDeps> = {}) {
  const usage = createMemoryUsageStore();
  const d: SearchReferencesDeps = {
    adapter: createWebSearchAdapter({ apiKey: "k", fetch, allowlist }),
    usage,
    getPlan: async () => "free",
    getDirection: async () => DIRECTION,
    addToTray: async () => true,
    upgradeUrl: () => "https://example.test/pricing",
    now: () => NOW,
    ...over,
  };
  return { deps: d, usage };
}

const okFetch = () => vi.fn<FetchLike>(async () => new Response(JSON.stringify(page), { status: 200 }));

describe("Serper credits", () => {
  it("a both-zone direction search records every request it sent as credits, and 1 search", async () => {
    const fetch = okFetch();
    const { deps: d, usage } = deps(fetch);
    await createSearchReferencesTool(d)({ directionId: "bd-1" }, "u1");
    expect(fetch.mock.calls.length).toBeGreaterThan(1);
    expect(usage.credits.get(`u1|${PERIOD}`)).toBe(fetch.mock.calls.length);
    expect(await usage.creditsUsed(PERIOD)).toBe(fetch.mock.calls.length);
    expect((await usage.get("u1", PERIOD)).searches).toBe(1);
  });

  it("a both-zone plain query search records the UI and art requests", async () => {
    const fetch = okFetch();
    const { deps: d, usage } = deps(fetch);
    await createSearchReferencesTool(d)({ query: "plan picker", zone: "both" }, "u1");
    expect(usage.credits.get(`u1|${PERIOD}`)).toBe(fetch.mock.calls.length);
  });

  it("stops every user with a plain message once the global cap is spent, before any request", async () => {
    const fetch = okFetch();
    const { deps: d, usage } = deps(fetch, { creditCap: () => 2500 });
    await usage.addCredits("someone-else", PERIOD, 2500);
    const res = await createSearchReferencesTool(d)({ directionId: "bd-1" }, "u1");
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toBe(
      "The shared search budget for this month is used up, so searches are paused until November 1. Your directions and canvases are kept.",
    );
    expect(fetch).not.toHaveBeenCalled();
    expect((await usage.get("u1", PERIOD)).searches).toBe(0);
  });

  it("searches while under the cap; last month's credits do not count", async () => {
    const fetch = okFetch();
    const { deps: d, usage } = deps(fetch, { creditCap: () => 2500 });
    await usage.addCredits("someone-else", "2026-09", 9999);
    await usage.addCredits("someone-else", PERIOD, 2499);
    const res = await createSearchReferencesTool(d)({ query: "plan picker" }, "u1");
    expect(res.isError).toBeUndefined();
    expect(fetch).toHaveBeenCalled();
  });

  it("reads the cap from SERPER_MONTHLY_CREDIT_CAP, and no cap when unset or not a positive number", () => {
    expect(serperCreditCap({ SERPER_MONTHLY_CREDIT_CAP: "2500" })).toBe(2500);
    expect(serperCreditCap({ SERPER_MONTHLY_CREDIT_CAP: " 2500 " })).toBe(2500);
    expect(serperCreditCap({})).toBeNull();
    expect(serperCreditCap({ SERPER_MONTHLY_CREDIT_CAP: "" })).toBeNull();
    expect(serperCreditCap({ SERPER_MONTHLY_CREDIT_CAP: "0" })).toBeNull();
    expect(serperCreditCap({ SERPER_MONTHLY_CREDIT_CAP: "-5" })).toBeNull();
    expect(serperCreditCap({ SERPER_MONTHLY_CREDIT_CAP: "lots" })).toBeNull();
    expect(canSpendCredits(10, null).ok).toBe(true);
    expect(canSpendCredits(2499, 2500)).toMatchObject({ ok: true, remaining: 1 });
    expect(canSpendCredits(2600, 2500, { now: NOW })).toMatchObject({ ok: false, remaining: 0 });
  });

  it("the memory repo sums credits across users for one period", async () => {
    const repos = createMemoryRepos();
    await repos.usage.addCredits("a", "2026-10", 8);
    await repos.usage.addCredits("b", "2026-10", 2);
    await repos.usage.addCredits("a", "2026-11", 5);
    expect(await repos.usage.creditsUsed("2026-10")).toBe(10);
  });

  it("stores credits with one upsert and sums them over the period in SQL", async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const answers: unknown[][] = [[], [["10"]]];
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return { rows: answers.shift() ?? [], fields: [], rowCount: 0, command: "" };
    });
    const db = drizzle({ client: { query } as never, schema }) as unknown as Db;
    await incrementUsage(db, "8b7f6c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f", "2026-10", { serperCredits: 8 });
    expect(calls[0]!.sql).toMatch(/"serper_credits" = "usage"\."serper_credits" \+ \$\d/);
    expect(await sumCredits(db, "2026-10")).toBe(10);
    expect(calls[1]!.sql).toMatch(/sum\("serper_credits"\)/);
    expect(calls[1]!.sql).toMatch(/where "usage"\."period" = \$1/);
  });
});
