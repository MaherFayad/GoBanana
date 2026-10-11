import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_IMAGE_HOSTS,
  NOTES,
  SERPER_IMAGES_ENDPOINT,
  allowlistFromEnv,
  allowlistToCspDomains,
  arenaAdapter,
  buildSearchQuery,
  buildSiteFilter,
  createWebSearchAdapter,
  isAllowedHost,
  isAllowedImageUrl,
  mapSerperImages,
  normalizeSources,
  parseAllowlist,
  pinterestOwnAdapter,
  referenceId,
  serperNum,
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
    expect(buildSearchQuery("brutalist bakery menu")).toBe(
      "brutalist bakery menu (site:pinterest.com OR site:dribbble.com)",
    );
  });

  it("maps behance and awwwards to their real domains, in a stable order", () => {
    expect(buildSiteFilter(["awwwards", "behance"])).toBe("(site:behance.net OR site:awwwards.com)");
    expect(buildSearchQuery("x", ["awwwards", "pinterest", "dribbble", "behance"])).toBe(
      "x (site:pinterest.com OR site:dribbble.com OR site:behance.net OR site:awwwards.com)",
    );
  });

  it("drops unknown and duplicate sources", () => {
    expect(normalizeSources(["dribbble", "Dribbble", "flickr"])).toEqual(["dribbble"]);
    expect(normalizeSources(["flickr"])).toEqual(["pinterest", "dribbble"]);
  });

  it("strips site operators the caller typed so the search cannot widen", () => {
    expect(buildSearchQuery("neon poster site:example.com OR site:foo.org", ["dribbble"])).toBe(
      "neon poster (site:dribbble.com)",
    );
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

  it("keeps only allowed, linked results on selected sites, deduped", () => {
    const refs = mapSerperImages(serperFixture.images, base);
    expect(refs.map((r) => r.sourceUrl)).toEqual([
      "https://www.pinterest.com/pin/123456789012345678/",
      "https://dribbble.com/shots/23456789-Bakery-identity",
      "https://uk.pinterest.com/pin/999/",
      "https://dribbble.com/shots/777-Taken-down",
    ]);
  });

  it("maps fields and keeps only what the spec allows", () => {
    const [pin, shot] = mapSerperImages(serperFixture.images, base);
    expect(pin).toEqual({
      id: referenceId("https://www.pinterest.com/pin/123456789012345678/", "https://i.pinimg.com/originals/aa/bb/cc/aabbcc0011.jpg"),
      thumbUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR1",
      imageUrl: "https://i.pinimg.com/originals/aa/bb/cc/aabbcc0011.jpg",
      sourceUrl: "https://www.pinterest.com/pin/123456789012345678/",
      sourceSite: "pinterest.com",
      title: "Brutalist bakery menu poster",
      width: 736,
      height: 1104,
    });
    expect(shot?.sourceSite).toBe("dribbble.com");
    expect(shot?.width).toBe(1600);
    expect(Object.keys(pin!).sort()).toEqual(
      ["id", "thumbUrl", "imageUrl", "sourceUrl", "sourceSite", "title", "width", "height"].sort(),
    );
  });

  it("uses the thumbnail as the image when only the thumb host is allowlisted", () => {
    const refs = mapSerperImages(serperFixture.images, base);
    const blog = refs.find((r) => r.sourceUrl === "https://uk.pinterest.com/pin/999/");
    expect(blog?.imageUrl).toBe("https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcR5");
    expect(blog?.thumbUrl).toBe(blog?.imageUrl);
    expect([blog?.width, blog?.height]).toEqual([276, 207]);
    expect(JSON.stringify(refs)).not.toContain("someblog.example");
  });

  it("uses the image as the thumb when only the image host is allowlisted", () => {
    const refs = mapSerperImages(
      [{ link: "https://dribbble.com/shots/1", imageUrl: "https://cdn.dribbble.com/u/1.png", thumbnailUrl: "https://x.example/t.png" }],
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
    const byImage = compileTakedowns(["images.someblog.example"]);
    expect(mapSerperImages(serperFixture.images, { ...base, takedowns: byImage })).toHaveLength(3);
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
  it("sends one POST to Serper with the key header and { q, num }", async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse(serperFixture));
    const adapter = createWebSearchAdapter({ apiKey: "test-key", fetch: fetchMock, allowlist });
    const result = await adapter.run({ query: "brutalist bakery menu", count: 12, userId: "u1" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(SERPER_IMAGES_ENDPOINT);
    expect(url).toBe("https://google.serper.dev/images");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["X-API-KEY"]).toBe("test-key");
    expect(JSON.parse(String(init?.body))).toEqual({
      q: "brutalist bakery menu (site:pinterest.com OR site:dribbble.com)",
      num: 30,
    });
    expect(result.ok).toBe(true);
    expect(result.references).toHaveLength(4);
    expect(result.note).toBe("Found 4 of 12 requested references.");
  });

  it("search() returns references only", async () => {
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: async () => jsonResponse(serperFixture), allowlist });
    const refs = await adapter.search({ query: "q", count: 2, userId: "u" });
    expect(refs).toHaveLength(2);
  });

  it("checks the takedown list on every search", async () => {
    const loadTakedowns = vi.fn(async () => compileTakedowns(["dribbble.com"]));
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: async () => jsonResponse(serperFixture), allowlist, loadTakedowns });
    const r1 = await adapter.run({ query: "q", count: 12, userId: "u" });
    await adapter.run({ query: "q", count: 12, userId: "u" });
    expect(loadTakedowns).toHaveBeenCalledTimes(2);
    expect(r1.references.every((r) => r.sourceSite === "pinterest.com")).toBe(true);
  });

  it("asks Serper for more than count, within limits", () => {
    expect(serperNum(4)).toBe(10);
    expect(serperNum(12)).toBe(30);
    expect(serperNum(24)).toBe(50);
  });
});

describe("web_search failure paths", () => {
  const q = { query: "q", count: 12, userId: "u" };

  it.each([
    [500, NOTES.unavailable],
    [403, NOTES.unavailable],
    [429, NOTES.rateLimited],
  ])("returns zero results with a plain note on HTTP %i", async (status, note) => {
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: async () => jsonResponse({ message: "nope" }, status), allowlist });
    await expect(adapter.run(q)).resolves.toEqual({ references: [], note, ok: false });
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
    expect(r1).toEqual({ references: [], note: NOTES.unavailable, ok: false });
    expect(JSON.stringify(r1)).not.toContain(secret);

    const badJson = createWebSearchAdapter({
      apiKey: secret,
      fetch: async () => new Response("<html>oops</html>", { status: 200 }),
      allowlist,
    });
    expect(await badJson.run(q)).toEqual({ references: [], note: NOTES.unavailable, ok: false });

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
    expect(await adapter.run(q)).toEqual({ references: [], note: NOTES.noResults, ok: true });
  });
});

describe("v2 stubs", () => {
  it("throw not in v1", async () => {
    await expect(pinterestOwnAdapter.search({ query: "q", count: 4, userId: "u" })).rejects.toThrow("not in v1");
    await expect(arenaAdapter.search({ query: "q", count: 4, userId: "u" })).rejects.toThrow("not in v1");
  });
});
