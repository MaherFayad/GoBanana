import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_IMAGE_HOSTS,
  NOTES,
  PLAIN_MAX_REQUESTS,
  SERPER_IMAGES_ENDPOINT,
  allowlistFromEnv,
  allowlistToCspDomains,
  arenaAdapter,
  buildSourceQuery,
  cleanQuery,
  createWebSearchAdapter,
  isAllowedHost,
  isAllowedImageUrl,
  mapSerperImages,
  normalizeSources,
  parseAllowlist,
  pinterestOwnAdapter,
  referenceId,
  requestBudget,
  serperPages,
  SERPER_MAX_PAGES,
  SERPER_MAX_REQUESTS,
  SERPER_PAGE_SIZE,
  SOURCE_SCOPES,
  type FetchLike,
} from "@/lib/sources";
import { EMPTY_TAKEDOWNS, compileTakedowns } from "@/lib/takedown";
import { serperFixture } from "./sources.fixture";

const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("query building", () => {
  it("defaults to pinterest and dribbble", () => {
    expect(normalizeSources(undefined)).toEqual(["pinterest", "dribbble"]);
    expect(normalizeSources([])).toEqual(["pinterest", "dribbble"]);
  });

  it("builds one path-scoped query per source, never the OR form", () => {
    expect(buildSourceQuery("brutalist bakery menu", "pinterest")).toBe("brutalist bakery menu site:pinterest.com/pin");
    expect(buildSourceQuery("brutalist bakery menu", "dribbble")).toBe("brutalist bakery menu site:dribbble.com/shots");
    expect(buildSourceQuery("x", "behance")).toBe("x site:behance.net/gallery");
    expect(buildSourceQuery("x", "awwwards")).toBe("x site:awwwards.com/sites");
    // Every registry source has a path-scoped filter (core sites plus vetted galleries).
    expect(Object.keys(SOURCE_SCOPES)).toEqual(expect.arrayContaining(["awwwards", "behance", "dribbble", "pinterest", "lapa", "refero"]));
    for (const scope of Object.values(SOURCE_SCOPES)) expect(scope).not.toMatch(/\s|\bOR\b/);
    for (const site of ["pinterest", "dribbble", "behance", "awwwards"] as const) {
      expect(buildSourceQuery("a OR b", site)).not.toMatch(/\bOR\b/);
    }
  });

  it("drops unknown and duplicate sources", () => {
    expect(normalizeSources(["dribbble", "Dribbble", "flickr"])).toEqual(["dribbble"]);
    expect(normalizeSources(["flickr"])).toEqual(["pinterest", "dribbble"]);
  });

  it("strips site operators the caller typed so the search cannot widen", () => {
    expect(cleanQuery("neon poster site:example.com OR site:foo.org")).toBe("neon poster");
    expect(buildSourceQuery("neon poster site:example.com OR (site:foo.org)", "dribbble")).toBe("neon poster site:dribbble.com/shots");
  });
});

describe("image host allowlist", () => {
  it("has the default hosts", () => {
    const a = allowlistFromEnv(undefined);
    for (const h of [
      "encrypted-tbn0.gstatic.com",
      "encrypted-tbn3.gstatic.com",
      "i.pinimg.com",
      "cdn.dribbble.com",
      "mir-s3-cdn-cf.behance.net",
      "assets.awwwards.com",
    ]) {
      expect(isAllowedHost(h, a)).toBe(true);
    }
  });

  it("matches exact hosts, never substrings", () => {
    expect(isAllowedHost("i.pinimg.com.evil.example", allowlist)).toBe(false);
    expect(isAllowedHost("xi.pinimg.com", allowlist)).toBe(false);
    expect(isAllowedHost("pinimg.com", allowlist)).toBe(false);
    expect(isAllowedHost("I.PINIMG.COM", allowlist)).toBe(true);
    expect(isAllowedHost("encrypted-tbn9.gstatic.com", allowlist)).toBe(false);
  });

  it("supports suffix entries from the env var", () => {
    const a = allowlistFromEnv(" *.pinimg.com, cdn.dribbble.com\n.behance.net, bad host!, https://assets.awwwards.com/x ");
    expect(isAllowedHost("i.pinimg.com", a)).toBe(true);
    expect(isAllowedHost("s-media-cache.pinimg.com", a)).toBe(true);
    expect(isAllowedHost("pinimg.com", a)).toBe(false);
    expect(isAllowedHost("notpinimg.com", a)).toBe(false);
    expect(isAllowedHost("mir-cdn.behance.net", a)).toBe(true);
    expect(isAllowedHost("assets.awwwards.com", a)).toBe(true);
    expect(isAllowedHost("encrypted-tbn0.gstatic.com", a)).toBe(false); // env replaces defaults
    expect(allowlistToCspDomains(a)).toEqual([
      "https://*.pinimg.com",
      "https://cdn.dribbble.com",
      "https://*.behance.net",
      "https://assets.awwwards.com",
    ]);
  });

  it("falls back to defaults when the env var is empty or all invalid", () => {
    expect(allowlistFromEnv("").entries).toEqual([...DEFAULT_IMAGE_HOSTS]);
    expect(allowlistFromEnv(" , !!! ").entries).toEqual([...DEFAULT_IMAGE_HOSTS]);
  });

  it("only allows https image URLs", () => {
    expect(isAllowedImageUrl("https://i.pinimg.com/a.jpg", allowlist)).toBe(true);
    expect(isAllowedImageUrl("http://i.pinimg.com/a.jpg", allowlist)).toBe(false);
    expect(isAllowedImageUrl("data:image/png;base64,AAAA", allowlist)).toBe(false);
    expect(isAllowedImageUrl(undefined, allowlist)).toBe(false);
  });
});

describe("Serper response mapping", () => {
  const base = { sources: ["pinterest", "dribbble"] as const, allowlist, takedowns: EMPTY_TAKEDOWNS, count: 24 };

  it("keeps only allowed, linked, big enough results on selected sites, deduped, best first", () => {
    const refs = mapSerperImages(serperFixture.images, base);
    expect(refs.map((r) => r.sourceUrl)).toEqual([
      // 1600 px Dribbble shot with a design-work title first, then the 1104 px pin, then the 800 px shot.
      "https://dribbble.com/shots/23456789-Bakery-identity",
      "https://www.pinterest.com/pin/123456789012345678/",
      "https://dribbble.com/shots/777-Taken-down",
    ]);
  });

  it("maps fields and keeps only what the spec allows", () => {
    const [shot, pin] = mapSerperImages(serperFixture.images, base);
    expect(pin).toEqual({
      id: referenceId("https://www.pinterest.com/pin/123456789012345678/", "https://i.pinimg.com/originals/aa/bb/cc/aabbcc0011.jpg"),
      thumbUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR1",
      imageUrl: "https://i.pinimg.com/originals/aa/bb/cc/aabbcc0011.jpg",
      sourceUrl: "https://www.pinterest.com/pin/123456789012345678/",
      sourceSite: "pinterest.com",
      title: "Brutalist bakery menu app UI",
      width: 736,
      height: 1104,
    });
    expect(shot?.sourceSite).toBe("dribbble.com");
    // Dribbble ?resize is stripped for the original upload; the reported size was the variant's.
    expect(shot?.imageUrl).toBe("https://cdn.dribbble.com/userupload/1234567/file/original-abc.png");
    expect(shot?.width).toBeUndefined();
    expect(Object.keys(pin!).sort()).toEqual(
      ["id", "thumbUrl", "imageUrl", "sourceUrl", "sourceSite", "title", "width", "height"].sort(),
    );
  });

  it("uses the thumbnail as the image when only the thumb host is allowlisted, unless it is too small", () => {
    // The fixture's blog pin has a 276 px thumbnail: what the canvas would show is too small.
    const refs = mapSerperImages(serperFixture.images, base);
    expect(refs.find((r) => r.sourceUrl === "https://uk.pinterest.com/pin/999/")).toBeUndefined();
    expect(JSON.stringify(refs)).not.toContain("someblog.example");
    // Without a known size the thumbnail stands in.
    const [kept] = mapSerperImages(
      [{ title: "Menu app UI", link: "https://uk.pinterest.com/pin/999/", imageUrl: "https://images.someblog.example/menu.jpg", thumbnailUrl: "https://encrypted-tbn3.gstatic.com/images?q=5" }],
      base,
    );
    expect(kept?.imageUrl).toBe("https://encrypted-tbn3.gstatic.com/images?q=5");
    expect(kept?.thumbUrl).toBe(kept?.imageUrl);
  });

  it("uses the image as the thumb when only the image host is allowlisted", () => {
    const refs = mapSerperImages(
      [{ title: "Menu app UI", link: "https://dribbble.com/shots/1", imageUrl: "https://cdn.dribbble.com/u/1.png", thumbnailUrl: "https://x.example/t.png" }],
      base,
    );
    expect(refs[0]?.thumbUrl).toBe("https://cdn.dribbble.com/u/1.png");
    expect(refs[0]?.width).toBeUndefined();
  });

  it("includes behance when selected", () => {
    const refs = mapSerperImages(serperFixture.images, { ...base, sources: ["behance"] });
    expect(refs.map((r) => r.sourceSite)).toEqual(["behance.net"]);
  });

  it("drops anything on the takedown list, by page, image or domain", () => {
    const byPage = compileTakedowns(["https://dribbble.com/shots/777-Taken-down"]);
    expect(mapSerperImages(serperFixture.images, { ...base, takedowns: byPage }).map((r) => r.sourceUrl)).not.toContain(
      "https://dribbble.com/shots/777-Taken-down",
    );
    // Blocked original image is checked even when we would swap in the thumbnail.
    const swap = [{ title: "Menu app UI", link: "https://uk.pinterest.com/pin/999/", imageUrl: "https://images.someblog.example/menu.jpg", thumbnailUrl: "https://encrypted-tbn3.gstatic.com/images?q=5" }];
    expect(mapSerperImages(swap, base)).toHaveLength(1);
    const byImage = compileTakedowns(["images.someblog.example"]);
    expect(mapSerperImages(swap, { ...base, takedowns: byImage })).toHaveLength(0);
    const byDomain = compileTakedowns(["pinterest.com"]);
    expect(mapSerperImages(serperFixture.images, { ...base, takedowns: byDomain }).every((r) => r.sourceSite === "dribbble.com")).toBe(true);
  });

  it("respects count and survives junk input", () => {
    expect(mapSerperImages(serperFixture.images, { ...base, count: 2 })).toHaveLength(2);
    expect(mapSerperImages(undefined, base)).toEqual([]);
    expect(mapSerperImages([null, 1, "x", {}], base)).toEqual([]);
  });

  it("gives stable ids", () => {
    const a = mapSerperImages(serperFixture.images, base);
    const b = mapSerperImages(structuredClone(serperFixture.images), base);
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
    expect(new Set(a.map((r) => r.id)).size).toBe(a.length);
    expect(referenceId("a", "b")).toMatch(/^ref_[0-9a-f]{16}$/);
    expect(referenceId("a", "b")).not.toBe(referenceId("a", "c"));
  });
});

describe("web_search adapter", () => {
  it("sends one POST per source to Serper with the key header and { q, num: 10 }", async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse(serperFixture));
    const adapter = createWebSearchAdapter({ apiKey: "test-key", fetch: fetchMock, allowlist });
    const result = await adapter.run({ query: "brutalist bakery menu app", count: 12, userId: "u1" });

    // The fixture page is full (11 images), so a second page is asked for too; page 1 is checked here.
    // Only 3 results pass every filter (fewer than 4), so the short form is tried once as well.
    const firstPage = fetchMock.mock.calls.filter(([, init]) => JSON.parse(String(init?.body)).page === undefined);
    expect(firstPage).toHaveLength(3);
    // The short retry keeps the style word ("brutalist"), then the last 2 words.
    expect(JSON.parse(String(firstPage[2]![1]?.body)).q).toBe("brutalist bakery menu ui design -template -kit -free -wireframe site:pinterest.com/pin");
    for (const [url, init] of firstPage) {
      expect(url).toBe(SERPER_IMAGES_ENDPOINT);
      expect(url).toBe("https://google.serper.dev/images");
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>)["X-API-KEY"]).toBe("test-key");
    }
    expect(firstPage.slice(0, 2).map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { q: "brutalist bakery menu app site:pinterest.com/pin", num: 10 },
      { q: "brutalist bakery menu app site:dribbble.com/shots", num: 10 },
    ]);
    expect(result.ok).toBe(true);
    expect(result.references).toHaveLength(3);
    expect(result.note).toBe("Found 3 of 12 requested references.");
    expect(result.requests).toBe(fetchMock.mock.calls.length);
  });

  it("search() returns references only", async () => {
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: async () => jsonResponse(serperFixture), allowlist });
    const refs = await adapter.search({ query: "q", count: 2, userId: "u" });
    expect(refs).toHaveLength(2);
    // Interleaved across sources: one pin, one shot.
    expect(refs.map((r) => r.sourceSite).sort()).toEqual(["dribbble.com", "pinterest.com"]);
  });

  it("checks the takedown list on every search", async () => {
    const loadTakedowns = vi.fn(async () => compileTakedowns(["dribbble.com"]));
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: async () => jsonResponse(serperFixture), allowlist, loadTakedowns });
    const r1 = await adapter.run({ query: "q", count: 12, userId: "u" });
    await adapter.run({ query: "q", count: 12, userId: "u" });
    expect(loadTakedowns).toHaveBeenCalledTimes(2);
    expect(r1.references.every((r) => r.sourceSite === "pinterest.com")).toBe(true);
  });

  it("pages 10 at a time, at most 3 pages per source and 8 requests per call", () => {
    expect(SERPER_PAGE_SIZE).toBe(10);
    expect(serperPages()).toBe(SERPER_MAX_PAGES);
    expect(serperPages(2)).toBe(2);
    expect(serperPages(9)).toBe(3);
    expect(serperPages(0)).toBe(1);
    expect(requestBudget()).toBe(SERPER_MAX_REQUESTS);
    expect(SERPER_MAX_REQUESTS).toBe(8);
    expect(requestBudget(3)).toBe(3);
    expect(requestBudget(40)).toBe(8);
  });

  // Serper's free plan rejects site: queries above num 10 ("Query pattern not allowed for free accounts").
  function fullPage(page: number) {
    return {
      images: Array.from({ length: 10 }, (_, i) => ({
        title: `App UI shot ${page}-${i}`,
        imageUrl: `https://cdn.dribbble.com/userupload/${page}-${i}.png`,
        imageWidth: 800,
        imageHeight: 600,
        thumbnailUrl: `https://encrypted-tbn0.gstatic.com/images?q=${page}-${i}`,
        source: "Dribbble",
        domain: "dribbble.com",
        link: `https://dribbble.com/shots/${page}${i}`,
      })),
    };
  }

  it("never asks for more than 10 results per request and pages until it has enough", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return jsonResponse(fullPage(body.page ?? 1));
    });
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const result = await adapter.run({ query: "q app", count: 12, userId: "u", sources: ["dribbble"] });

    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies.every((b) => b.num === 10)).toBe(true);
    expect(bodies.every((b) => b.q === "q app site:dribbble.com/shots")).toBe(true);
    expect(bodies.map((b) => b.page ?? 1)).toEqual([1, 2]);
    expect(result.references).toHaveLength(12);
    expect(result.note).toBeUndefined();
    expect(result.requests).toBe(2);
  });

  it("keeps a plain query at 4 requests in all, even with every source and a big count", async () => {
    let inFlight = 0;
    let peak = 0;
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      const body = JSON.parse(String(init?.body));
      return jsonResponse(fullPage(body.page ?? 1));
    });
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const result = await adapter.run({ query: "q app", count: 50, userId: "u", sources: ["pinterest", "dribbble", "behance", "awwwards"] });
    expect(peak).toBeLessThanOrEqual(4);
    expect(fetchMock.mock.calls.length).toBe(PLAIN_MAX_REQUESTS);
    expect(result.requests).toBe(fetchMock.mock.calls.length);
    const scopes = fetchMock.mock.calls.map(([, init]) => String(JSON.parse(String(init?.body)).q).split(" site:")[1]);
    expect(new Set(scopes)).toEqual(new Set(["pinterest.com/pin", "dribbble.com/shots", "behance.net/gallery", "awwwards.com/sites"]));
  });

  it("keeps to a smaller request budget", async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse(fullPage(1)));
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const result = await adapter.run({ query: "q app", count: 24, userId: "u", maxRequests: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.requests).toBe(1);
  });

  it("a 429 on one source keeps what the other source found", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return String(body.q).includes("pinterest") ? jsonResponse({ message: "You are allowed to submit up to 5 requests per second" }, 429) : jsonResponse(fullPage(1));
    });
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const result = await adapter.run({ query: "q app", count: 8, userId: "u" });
    expect(result.ok).toBe(true);
    expect(result.references).toHaveLength(8);
    expect(result.references.every((r) => r.sourceSite === "dribbble.com")).toBe(true);
  });

  it("a plan error on page 1 returns no results with a plain note", async () => {
    const adapter = createWebSearchAdapter({
      apiKey: "k",
      fetch: async () => jsonResponse({ message: "Query pattern not allowed for free accounts.", statusCode: 400 }, 400),
      allowlist,
    });
    const result = await adapter.run({ query: "q", count: 12, userId: "u" });
    expect(result.references).toEqual([]);
    expect(result.note).toBe(NOTES.unavailable);
  });

  it("a failure on a later page keeps the results already found", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return body.page ? jsonResponse({ message: "nope" }, 400) : jsonResponse(fullPage(1));
    });
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const result = await adapter.run({ query: "q app", count: 12, userId: "u", sources: ["dribbble"] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.references).toHaveLength(10);
    expect(result.note).toBe("Found 10 of 12 requested references.");
  });
});

describe("web_search failure paths", () => {
  const q = { query: "q app", count: 12, userId: "u" };

  it.each([
    [500, NOTES.unavailable],
    [403, NOTES.unavailable],
    [429, NOTES.rateLimited],
  ])("returns zero results with a plain note on HTTP %i", async (status, note) => {
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: async () => jsonResponse({ message: "nope" }, status), allowlist });
    // Both sources tried once, both failed.
    await expect(adapter.run(q)).resolves.toEqual({ references: [], note, ok: false, requests: 2 });
  });

  it("does not throw on network errors or bad JSON, and never leaks the key", async () => {
    const secret = "sk-very-secret";
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    const warns = vi.spyOn(console, "warn").mockImplementation(() => {});
    const throwing = createWebSearchAdapter({
      apiKey: secret,
      fetch: async () => {
        throw new Error(`connect failed with ${secret}`);
      },
      allowlist,
    });
    const r1 = await throwing.run(q);
    expect(r1).toEqual({ references: [], note: NOTES.unavailable, ok: false, requests: 2 });
    expect(JSON.stringify(r1)).not.toContain(secret);

    const badJson = createWebSearchAdapter({
      apiKey: secret,
      fetch: async () => new Response("<html>oops</html>", { status: 200 }),
      allowlist,
    });
    expect(await badJson.run(q)).toEqual({ references: [], note: NOTES.unavailable, ok: false, requests: 2 });

    const calls = [...errors.mock.calls, ...logs.mock.calls, ...warns.mock.calls].flat().map(String).join(" ");
    expect(calls).not.toContain(secret);
    errors.mockRestore();
    logs.mockRestore();
    warns.mockRestore();
  });

  it("returns a note and makes no request when the key is missing", async () => {
    const fetchMock = vi.fn<FetchLike>();
    const adapter = createWebSearchAdapter({ apiKey: "  ", fetch: fetchMock, allowlist });
    expect(await adapter.run(q)).toEqual({ references: [], note: NOTES.notConfigured, ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the takedown list cannot load", async () => {
    const fetchMock = vi.fn<FetchLike>();
    const adapter = createWebSearchAdapter({
      apiKey: "k",
      fetch: fetchMock,
      allowlist,
      loadTakedowns: async () => {
        throw new Error("db down");
      },
    });
    expect(await adapter.run(q)).toEqual({ references: [], note: NOTES.takedownsUnavailable, ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a plain note when nothing survives filtering", async () => {
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: async () => jsonResponse({ images: [] }), allowlist });
    // Both sources answered with nothing, so the short form was tried once too (3 requests).
    const result = await adapter.run(q);
    expect(result).toEqual({
      references: [],
      note: NOTES.noResults,
      ok: true,
      requests: 3,
      queries: ["q app site:pinterest.com/pin", "q app site:dribbble.com/shots", "q ui design -template -kit -free -wireframe site:pinterest.com/pin"],
    });
  });
});

describe("v2 stubs", () => {
  it("throw not in v1", async () => {
    await expect(pinterestOwnAdapter.search({ query: "q", count: 4, userId: "u" })).rejects.toThrow("not in v1");
    await expect(arenaAdapter.search({ query: "q", count: 4, userId: "u" })).rejects.toThrow("not in v1");
  });
});
