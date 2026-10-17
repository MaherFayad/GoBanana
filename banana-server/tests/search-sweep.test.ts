/**
 * V4.2 search side: a sweep looks at the space around a page before directions exist, counts go to
 * 40 (deeper pages on the strongest lanes, never more than 8 requests), and every search skips what
 * the canvas already holds (tray or board).
 */
import { describe, expect, it, vi } from "vitest";
import { createSearchReferencesTool, inputSchema, type SearchReferencesDeps, type SearchReferencesInput } from "@/lib/mcp/tools/search_references";
import { createMemoryUsageStore, currentPeriod } from "@/lib/quota";
import {
  DEFAULT_IMAGE_HOSTS,
  SERPER_MAX_IN_FLIGHT,
  SERPER_MAX_REQUESTS,
  UI_NEG,
  buildSourceQuery,
  createWebSearchAdapter,
  parseAllowlist,
  type FetchLike,
  type Reference,
} from "@/lib/sources";
import { planSweep } from "@/lib/sources/sweep";

const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);
const NOW = new Date("2026-10-17T12:00:00Z");
const BRIEF = "Mobile flight checkout for a GCC travel OTA: fare summary, travellers, payment. EN + AR/RTL.";
const SCOPES = ["dribbble.com/shots", "pinterest.com/pin"];

/** A stable small number per text, so each query and page gets its own ids. */
function hash(text: string): number {
  let h = 7;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return h;
}

/** Ten UI results per request, unique per query and page, on the site the query is scoped to. */
function page(q: string, n: number) {
  const base = hash(q) * 10 + n * 1000000;
  const pin = q.includes("site:pinterest.com/pin");
  return {
    images: Array.from({ length: 10 }, (_, i) => {
      const id = base + i;
      return pin
        ? {
            title: `Flight checkout app UI ${id}`,
            link: `https://www.pinterest.com/pin/${id}/`,
            imageUrl: `https://i.pinimg.com/736x/${id}.jpg`,
            imageWidth: 1200,
            imageHeight: 900,
          }
        : {
            title: `Flight checkout app UI ${id}`,
            link: `https://dribbble.com/shots/${id}-flight`,
            imageUrl: `https://cdn.dribbble.com/userupload/${id}/file/original.png`,
            imageWidth: 1600,
            imageHeight: 1200,
          };
    }),
  };
}

function fakeFetch() {
  let inFlight = 0;
  let peak = 0;
  const fetch = vi.fn<FetchLike>(async (_url, init) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 2));
    inFlight--;
    const body = JSON.parse(String(init?.body)) as { q: string; page?: number };
    return new Response(JSON.stringify(page(body.q, body.page ?? 1)), { status: 200 });
  });
  return { fetch, peak: () => peak, queries: () => fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as { q: string; page?: number }) };
}

function setup(over: Partial<SearchReferencesDeps> = {}) {
  const f = fakeFetch();
  const usage = createMemoryUsageStore();
  const addToTray = vi.fn(async () => true);
  const deps: SearchReferencesDeps = {
    adapter: createWebSearchAdapter({ apiKey: "k", fetch: f.fetch, allowlist }),
    usage,
    getPlan: async () => "free",
    getDirection: async () => null,
    getCanvasInfo: async (_u, id) => (id === "c1" ? { brief: BRIEF, taste: ["minimal"] } : null),
    addToTray,
    upgradeUrl: () => "https://example.test/pricing",
    now: () => NOW,
    ...over,
  };
  return { tool: createSearchReferencesTool(deps), usage, addToTray, ...f };
}

const text = (res: { content: { text?: string }[] }) => res.content.map((c) => c.text ?? "").join("\n");

const SWEEP: SearchReferencesInput = {
  sweep: true,
  canvasId: "c1",
  query: "flight checkout",
  components: ["fare summary", "seat map"],
  adjacent: ["concert ticketing"],
};

describe("sweep plan", () => {
  it("plans at most 8 requests, one path-scoped site each, with UI negatives", () => {
    const { plan } = planSweep({
      page: "flight checkout",
      components: ["fare summary", "seat map", "baggage"],
      adjacent: ["concert ticketing", "queue management", "food delivery"],
      platform: "mobile",
      brief: BRIEF,
      style: "minimal",
    });
    expect(plan.length).toBeLessThanOrEqual(SERPER_MAX_REQUESTS);
    for (const r of plan) {
      const q = buildSourceQuery(r.query, r.site);
      expect(q.match(/site:/g)).toHaveLength(1);
      expect(SCOPES.some((s) => q.endsWith(`site:${s}`))).toBe(true);
      expect(q).not.toMatch(/\bOR\b/);
      expect(r.query).toContain(UI_NEG);
    }
    // Two of three components and adjacent phrases are searched.
    expect(plan.filter((r) => r.lane === "sweep-component")).toHaveLength(2);
    expect(plan.filter((r) => r.lane === "sweep-adjacent")).toHaveLength(2);
  });

  it("covers the page on Dribbble and Pinterest, the components, the adjacent jobs, taste and locale", () => {
    const { plan, texts } = planSweep({
      page: "flight checkout",
      components: ["fare summary", "seat map"],
      adjacent: ["concert ticketing"],
      platform: "mobile",
      brief: BRIEF,
      style: "minimal",
    });
    const rows = plan.map((r) => [r.lane, r.site, r.query.replace(` ${UI_NEG}`, "")]);
    expect(rows).toEqual([
      ["sweep-fidelity", "dribbble", "flight checkout app ui"],
      ["sweep-component", "dribbble", "flight checkout fare summary app ui"],
      ["sweep-adjacent", "dribbble", "concert ticketing app ui"],
      ["sweep-fidelity", "pinterest", "flight checkout app ui"],
      ["locale", "pinterest", "arabic flight app ui"],
      ["sweep-component", "dribbble", "flight checkout seat map app ui"],
      ["taste", "dribbble", "minimal flight checkout ui design"],
    ]);
    // Niche fallback ladder: a thin component or adjacent answer retries with its core.
    expect(plan[1]!.fallback).toBe(`fare summary app ui ${UI_NEG}`);
    expect(plan[2]!.fallback).toBe(`ticketing app ui ${UI_NEG}`);
    // The locale lane keeps titles that name the subject; mobile drops web titles.
    expect(plan[4]!.titleWord).toBe("flight");
    expect(plan[0]!.avoidWords).toContain("web");
    expect(texts).toMatchObject({ fidelity: "flight checkout app ui", adjacent: ["concert ticketing app ui"], locale: "arabic flight app ui" });
  });

  it("has no locale lane for an English brief and no taste lane without taste", () => {
    const { plan } = planSweep({ page: "flight checkout", platform: "mobile", brief: "Flight checkout, English only" });
    expect(plan.map((r) => r.lane)).toEqual(["sweep-fidelity", "sweep-fidelity"]);
  });

  it("words the lanes for the platform", () => {
    const { plan } = planSweep({ page: "pricing page", components: ["plan comparison"], platform: "website", brief: "SaaS pricing page" });
    expect(plan.every((r) => r.query.includes("website ui"))).toBe(true);
  });
});

describe("search_references sweep", () => {
  it("runs the sweep in at most 8 path-scoped requests, 4 at a time, and counts one search", async () => {
    const { tool, usage, queries, peak, addToTray } = setup();
    const res = await tool(SWEEP, "u1");
    expect(res.isError).toBeFalsy();
    const sent = queries();
    expect(sent.length).toBeLessThanOrEqual(SERPER_MAX_REQUESTS);
    expect(peak()).toBeLessThanOrEqual(SERPER_MAX_IN_FLIGHT);
    for (const { q } of sent) {
      expect(q.match(/site:/g)).toHaveLength(1);
      expect(SCOPES.some((s) => q.endsWith(`site:${s}`))).toBe(true);
    }
    const out = res.structuredContent as { references: Reference[]; zone: string; sweep: { component: string[] }; queries: string[] };
    expect(out.zone).toBe("ui");
    expect(out.references.length).toBe(12);
    expect(out.references.every((r) => r.zone === "ui")).toBe(true);
    const lanes = new Set(out.references.map((r) => r.lane));
    expect(lanes).toContain("sweep-component");
    expect(lanes).toContain("sweep-adjacent");
    expect(out.sweep.component).toEqual(["flight checkout fare summary app ui", "flight checkout seat map app ui"]);
    expect(text(res)).toMatch(/\[ref_[0-9a-f]+, sweep-adjacent\]/);
    expect(text(res)).toContain("the sweep of");
    expect((await usage.get("u1", currentPeriod(NOW))).searches).toBe(1);
    // Into the tray, not tied to a direction.
    expect(addToTray).toHaveBeenCalledWith("u1", "c1", expect.any(Array));
  });

  it("rejects sweep with directionId, with lane, without canvasId or without query", async () => {
    const { tool, fetch } = setup();
    expect(text(await tool({ ...SWEEP, directionId: "bd-1" }, "u1"))).toMatch(/without directionId or lane/);
    expect(text(await tool({ ...SWEEP, lane: "taste" }, "u1"))).toMatch(/without directionId or lane/);
    const { canvasId: _c, ...noCanvas } = SWEEP;
    expect(text(await tool(noCanvas, "u1"))).toMatch(/needs a canvasId/);
    const { query: _q, ...noQuery } = SWEEP;
    expect(text(await tool(noQuery, "u1"))).toMatch(/needs query/);
    expect(text(await tool({ query: "flight checkout", components: ["seat map"] }, "u1"))).toMatch(/go with sweep true/);
    expect(text(await tool({ ...SWEEP, canvasId: "c-not-mine" }, "u1"))).toMatch(/canvas was not found/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("count up to 40", () => {
  it("accepts 40 and rejects 41", async () => {
    expect(inputSchema.safeParse({ query: "x", count: 40 }).success).toBe(true);
    expect(inputSchema.safeParse({ query: "x", count: 41 }).success).toBe(false);
    const { tool, fetch } = setup();
    expect(text(await tool({ query: "flight checkout app ui", count: 41 }, "u1"))).toMatch(/count from 4 to 40/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("a sweep of 40 pages deeper on the strongest lanes, still within 8 requests", async () => {
    // English brief, no taste: fidelity on 2 sites gives 20, so the budget goes to page 2 and 3.
    const { tool, queries } = setup({ getCanvasInfo: async () => ({ brief: "Flight checkout, English only", taste: null }) });
    const res = await tool({ sweep: true, canvasId: "c1", query: "flight checkout", count: 40 }, "u1");
    const sent = queries();
    expect(sent.length).toBeLessThanOrEqual(SERPER_MAX_REQUESTS);
    expect(sent.filter((b) => (b.page ?? 1) === 1)).toHaveLength(2);
    expect(sent.some((b) => (b.page ?? 1) >= 2)).toBe(true);
    expect(sent.every((b) => (b.page ?? 1) <= 3)).toBe(true);
    expect((res.structuredContent as { references: Reference[] }).references.length).toBe(40);
  });

  it("a plain query of 40 may spend all 8 requests on deeper pages", async () => {
    const { tool, queries } = setup();
    // Four sources, two of them with nothing for this fake: 20 good on page 1, then deeper pages.
    const res = await tool({ query: "flight checkout app ui", count: 40, sources: ["dribbble", "pinterest", "behance", "awwwards"] }, "u1");
    expect(queries().length).toBeGreaterThan(4);
    expect(queries().length).toBeLessThanOrEqual(SERPER_MAX_REQUESTS);
    expect((res.structuredContent as { references: Reference[] }).references.length).toBe(40);
  });
});

describe("dedup across the whole canvas", () => {
  /** One shot from the board and one pin from the tray, as the first sweep request returns them. */
  function onCanvas() {
    const first = page(buildSourceQuery(`flight checkout app ui ${UI_NEG}`, "dribbble"), 1).images[0]!;
    const pin = page(buildSourceQuery(`flight checkout app ui ${UI_NEG}`, "pinterest"), 1).images[0]!;
    // Another spelling of the same items: a country subdomain and a query string still match.
    return {
      urls: [first.link.replace("-flight", "-flight?utm=1"), pin.link.replace("www.pinterest.com", "fr.pinterest.com")],
      shot: first.link,
      pin: pin.link,
    };
  }

  it("a sweep skips shots and pins already on the canvas or in its tray", async () => {
    const c = onCanvas();
    const getCanvasSourceUrls = vi.fn(async () => c.urls);
    const { tool } = setup({ getCanvasSourceUrls });
    const res = await tool({ ...SWEEP, count: 40 }, "u1");
    expect(getCanvasSourceUrls).toHaveBeenCalledWith("u1", "c1");
    const urls = (res.structuredContent as { references: Reference[] }).references.map((r) => r.sourceUrl);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls).not.toContain(c.shot);
    expect(urls).not.toContain(c.pin);
  });

  it("a plain query with a canvasId skips them too", async () => {
    const shot = page(buildSourceQuery(`flight checkout app ui`, "dribbble"), 1).images[0]!.link;
    const getCanvasSourceUrls = vi.fn(async () => [shot, "not a url"]);
    const { tool } = setup({ getCanvasSourceUrls });
    const res = await tool({ query: "flight checkout app ui", canvasId: "c1", sources: ["dribbble"] }, "u1");
    const urls = (res.structuredContent as { references: Reference[] }).references.map((r) => r.sourceUrl);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls).not.toContain(shot);
    // Without the canvas the same search returns it.
    const again = await setup().tool({ query: "flight checkout app ui", sources: ["dribbble"] }, "u1");
    expect((again.structuredContent as { references: Reference[] }).references.map((r) => r.sourceUrl)).toContain(shot);
  });
});
