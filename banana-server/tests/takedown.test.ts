import { describe, expect, it, vi } from "vitest";
import { compileTakedowns, filterTakedowns, loadTakedownMatcher } from "@/lib/takedown";

describe("takedown matcher", () => {
  it("blocks a domain and its subdomains, not lookalikes", () => {
    const m = compileTakedowns(["example.com"]);
    expect(m.isBlocked("https://example.com/a")).toBe(true);
    expect(m.isBlocked("https://www.example.com/")).toBe(true);
    expect(m.isBlocked("http://cdn.img.example.com/x.jpg")).toBe(true);
    expect(m.isBlocked("https://EXAMPLE.COM")).toBe(true);
    expect(m.isBlocked("https://notexample.com/a")).toBe(false);
    expect(m.isBlocked("https://example.com.evil.net/a")).toBe(false);
    expect(m.isBlocked("https://example.org/a")).toBe(false);
  });

  it("treats www and bare URLs with no path as domain entries", () => {
    for (const entry of ["www.example.com", "https://example.com", "https://www.example.com/", "EXAMPLE.com."]) {
      const m = compileTakedowns([entry]);
      expect(m.isBlocked("https://shop.example.com/p/1"), entry).toBe(true);
    }
  });

  it("blocks an exact URL with normalized case, slashes, scheme, www and fragment", () => {
    const m = compileTakedowns(["https://www.pinterest.com/pin/123/"]);
    expect(m.isBlocked("https://www.pinterest.com/pin/123/")).toBe(true);
    expect(m.isBlocked("http://pinterest.com/pin/123")).toBe(true);
    expect(m.isBlocked("https://WWW.Pinterest.com/PIN/123//")).toBe(true);
    expect(m.isBlocked("https://pinterest.com/pin/123/#comments")).toBe(true);
    expect(m.isBlocked("https://pinterest.com:443/pin/123")).toBe(true);
    expect(m.isBlocked("https://pinterest.com/pin/1234/")).toBe(false);
    expect(m.isBlocked("https://pinterest.com/pin/")).toBe(false);
    expect(m.isBlocked("https://pinterest.com/")).toBe(false);
    // A page entry does not block the subdomain's page with the same path.
    expect(m.isBlocked("https://uk.pinterest.com/pin/123/")).toBe(false);
  });

  it("handles query strings sensibly", () => {
    const noQuery = compileTakedowns(["dribbble.com/shots/9-Logo"]);
    expect(noQuery.isBlocked("https://dribbble.com/shots/9-Logo?utm_source=x")).toBe(true);
    const withQuery = compileTakedowns(["https://example.net/view?id=42"]);
    expect(withQuery.isBlocked("https://example.net/view?id=42")).toBe(true);
    expect(withQuery.isBlocked("https://example.net/view?ref=a&id=42")).toBe(true);
    expect(withQuery.isBlocked("https://example.net/view?id=43")).toBe(false);
    expect(withQuery.isBlocked("https://example.net/view")).toBe(false);
  });

  it("matches encoded and decoded paths alike", () => {
    const m = compileTakedowns(["https://example.net/a b"]);
    expect(m.isBlocked("https://example.net/a%20b")).toBe(true);
  });

  it("ignores junk entries and junk URLs", () => {
    const m = compileTakedowns(["", "   ", "not a url", "localhost", null, undefined, "javascript:alert(1)"]);
    expect(m.size).toBe(0);
    expect(m.isBlocked("https://example.com")).toBe(false);
    expect(compileTakedowns(["example.com"]).isBlocked("not a url")).toBe(false);
    expect(compileTakedowns(["example.com"]).isBlocked(undefined)).toBe(false);
  });

  it("checks source page, image and thumbnail of a reference", () => {
    const m = compileTakedowns(["i.pinimg.com", "https://dribbble.com/shots/1"]);
    const base = {
      sourceUrl: "https://dribbble.com/shots/2",
      imageUrl: "https://cdn.dribbble.com/a.png",
      thumbUrl: "https://encrypted-tbn0.gstatic.com/x",
    };
    expect(m.isReferenceBlocked(base)).toBe(false);
    expect(m.isReferenceBlocked({ ...base, sourceUrl: "https://dribbble.com/shots/1/" })).toBe(true);
    expect(m.isReferenceBlocked({ ...base, imageUrl: "https://i.pinimg.com/x.jpg" })).toBe(true);
    expect(filterTakedowns([base, { ...base, imageUrl: "https://i.pinimg.com/x.jpg" }], m)).toEqual([base]);
  });

  it("loads entries through an injected loader", async () => {
    const loader = vi.fn(async () => ["behance.net"]);
    const m = await loadTakedownMatcher(loader);
    expect(loader).toHaveBeenCalledOnce();
    expect(m.isBlocked("https://www.behance.net/gallery/1")).toBe(true);
    await expect(loadTakedownMatcher(async () => Promise.reject(new Error("db")))).rejects.toThrow("db");
  });
});
