import { describe, expect, it, vi } from "vitest";
import { fetchThumbIntoMemory, isAllowedUrl, type FetchLike } from "@/lib/palette/fetch";

const ALLOW = ["i.pinimg.com", "cdn.dribbble.com", "gstatic.com"];

function imageResponse(bytes: Uint8Array, headers: Record<string, string> = {}): Response {
  return new Response(new Uint8Array(bytes), { status: 200, headers: { "content-type": "image/png", ...headers } });
}

describe("isAllowedUrl", () => {
  it("allows exact hosts and subdomains over https only", () => {
    expect(isAllowedUrl("https://i.pinimg.com/236x/a.jpg", ALLOW)).toBe(true);
    expect(isAllowedUrl("https://encrypted-tbn0.gstatic.com/images?q=1", ALLOW)).toBe(true);
    expect(isAllowedUrl("http://i.pinimg.com/a.jpg", ALLOW)).toBe(false);
    expect(isAllowedUrl("https://evil.com/a.jpg", ALLOW)).toBe(false);
    expect(isAllowedUrl("https://i.pinimg.com.evil.com/a.jpg", ALLOW)).toBe(false);
    expect(isAllowedUrl("https://notgstatic.com/a.jpg", ALLOW)).toBe(false);
    expect(isAllowedUrl("https://user:pw@i.pinimg.com/a.jpg", ALLOW)).toBe(false);
    expect(isAllowedUrl("not a url", ALLOW)).toBe(false);
    expect(isAllowedUrl("https://i.pinimg.com/a.jpg", [])).toBe(false);
  });
});

describe("fetchThumbIntoMemory", () => {
  it("returns bytes in memory for an allowed host", async () => {
    const body = new Uint8Array([1, 2, 3, 4]);
    const fetchImpl = vi.fn<FetchLike>(async () => imageResponse(body));
    const res = await fetchThumbIntoMemory("https://i.pinimg.com/a.png", { allowedHosts: ALLOW, fetchImpl });
    expect(res).toEqual({ ok: true, bytes: body, contentType: "image/png" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://i.pinimg.com/a.png",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("refuses hosts not on the allowlist without calling fetch", async () => {
    const fetchImpl = vi.fn<FetchLike>();
    for (const url of ["https://example.com/a.png", "http://i.pinimg.com/a.png", "https://i.pinimg.com.evil.io/a.png"]) {
      const res = await fetchThumbIntoMemory(url, { allowedHosts: ALLOW, fetchImpl });
      expect(res).toEqual({ ok: false, reason: "host_not_allowed" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a redirect that leaves the allowlist", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      new Response(null, { status: 302, headers: { location: "https://evil.com/a.png" } }),
    );
    const res = await fetchThumbIntoMemory("https://i.pinimg.com/a.png", { allowedHosts: ALLOW, fetchImpl });
    expect(res).toEqual({ ok: false, reason: "host_not_allowed" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("follows a redirect inside the allowlist", async () => {
    const fetchImpl = vi.fn<FetchLike>(async (url) =>
      url.endsWith("/a.png")
        ? new Response(null, { status: 301, headers: { location: "/b.png" } })
        : imageResponse(new Uint8Array([9])),
    );
    const res = await fetchThumbIntoMemory("https://i.pinimg.com/a.png", { allowedHosts: ALLOW, fetchImpl });
    expect(res.ok).toBe(true);
    expect(fetchImpl).toHaveBeenLastCalledWith("https://i.pinimg.com/b.png", expect.anything());
  });

  it("enforces the size cap from content-length and from the stream", async () => {
    const big = new Uint8Array(100);
    const declared = await fetchThumbIntoMemory("https://i.pinimg.com/a.png", {
      allowedHosts: ALLOW,
      maxBytes: 50,
      fetchImpl: async () => imageResponse(big, { "content-length": "100" }),
    });
    expect(declared).toEqual({ ok: false, reason: "too_large" });

    const streamed = await fetchThumbIntoMemory("https://i.pinimg.com/a.png", {
      allowedHosts: ALLOW,
      maxBytes: 50,
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              for (let i = 0; i < 10; i++) c.enqueue(new Uint8Array(20));
              c.close();
            },
          }),
          { headers: { "content-type": "image/jpeg" } },
        ),
    });
    expect(streamed).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects non-image responses and HTTP errors", async () => {
    const html = await fetchThumbIntoMemory("https://i.pinimg.com/a", {
      allowedHosts: ALLOW,
      fetchImpl: async () => new Response("<html>", { headers: { "content-type": "text/html" } }),
    });
    expect(html).toEqual({ ok: false, reason: "not_an_image" });
    const missing = await fetchThumbIntoMemory("https://i.pinimg.com/a", {
      allowedHosts: ALLOW,
      fetchImpl: async () => new Response("no", { status: 404 }),
    });
    expect(missing).toEqual({ ok: false, reason: "http_error", status: 404 });
  });

  it("times out", async () => {
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    const res = await fetchThumbIntoMemory("https://i.pinimg.com/a.png", { allowedHosts: ALLOW, fetchImpl, timeoutMs: 20 });
    expect(res).toEqual({ ok: false, reason: "timeout" });
  });

  it("reports network errors without throwing", async () => {
    const res = await fetchThumbIntoMemory("https://i.pinimg.com/a.png", {
      allowedHosts: ALLOW,
      fetchImpl: async () => {
        throw new TypeError("fetch failed");
      },
    });
    expect(res).toEqual({ ok: false, reason: "network_error" });
  });
});
