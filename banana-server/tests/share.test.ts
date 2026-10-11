import { describe, expect, it } from "vitest";
import {
  applyNoindex,
  generateShareToken,
  isValidShareToken,
  needsNoindex,
  NOINDEX_HEADER_VALUE,
  noindexMetadata,
  ROBOTS_HEADER,
  shareUrl,
} from "@/lib/share";
import { localeFromPath, switchLocalePath } from "@/lib/site/i18n";

describe("share tokens", () => {
  it("are url-safe, at least 22 characters, and valid", () => {
    for (let i = 0; i < 200; i++) {
      const token = generateShareToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBeGreaterThanOrEqual(22);
      expect(isValidShareToken(token)).toBe(true);
    }
  });

  it("do not repeat", () => {
    const seen = new Set(Array.from({ length: 1000 }, () => generateShareToken()));
    expect(seen.size).toBe(1000);
  });

  it("refuse weak lengths", () => {
    expect(() => generateShareToken(8)).toThrow(RangeError);
    expect(generateShareToken(16)).toHaveLength(22);
  });

  it("validation rejects bad shapes", () => {
    expect(isValidShareToken("short")).toBe(false);
    expect(isValidShareToken("a".repeat(21))).toBe(false);
    expect(isValidShareToken("a".repeat(22))).toBe(true);
    expect(isValidShareToken("has/slash/aaaaaaaaaaaaaaaaaaaa")).toBe(false);
    expect(isValidShareToken("a".repeat(65))).toBe(false);
    expect(isValidShareToken(undefined)).toBe(false);
  });

  it("builds share URLs", () => {
    expect(shareUrl("https://x.example/", "abc_DEF-123")).toBe("https://x.example/s/abc_DEF-123");
  });
});

describe("noindex", () => {
  it("covers /s and /c only", () => {
    expect(needsNoindex("/s/abc")).toBe(true);
    expect(needsNoindex("/c/123")).toBe(true);
    expect(needsNoindex("/s")).toBe(true);
    expect(needsNoindex("/en/pricing")).toBe(false);
    expect(needsNoindex("/search")).toBe(false);
    expect(needsNoindex("/")).toBe(false);
  });

  it("sets the X-Robots-Tag header", () => {
    const headers = applyNoindex(new Headers());
    expect(headers.get(ROBOTS_HEADER)).toBe("noindex");
    expect(NOINDEX_HEADER_VALUE).toBe("noindex");
  });

  it("metadata renders a noindex robots tag", () => {
    expect(noindexMetadata.robots).toMatchObject({ index: false, follow: false });
  });
});

describe("site locale paths", () => {
  it("reads and switches the locale segment", () => {
    expect(localeFromPath("/ar/pricing")).toBe("ar");
    expect(localeFromPath("/en")).toBe("en");
    expect(localeFromPath("/c/1")).toBeNull();
    expect(switchLocalePath("/en/pricing", "ar")).toBe("/ar/pricing");
    expect(switchLocalePath("/ar", "en")).toBe("/en");
    expect(switchLocalePath("/other", "ar")).toBe("/ar");
  });
});
