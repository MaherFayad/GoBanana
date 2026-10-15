import { describe, expect, it } from "vitest";
import { buildParams, splitBatches } from "../lib/batch.ts";
import { reviewHtml, sample } from "../lib/review.ts";
import { pickThumbUrl, smallVariant, sniffImageType, thumbAllowlist, fetchThumbBlock } from "../lib/thumbs.ts";
import { parseArgs } from "../run.ts";
import { HAIKU } from "../config.ts";

describe("batch params", () => {
  it("caches the system prefix and sets effort", () => {
    const p = buildParams({ model: HAIKU, system: "rules", content: "hi", maxTokens: 100, effort: "low" });
    expect(p.system).toEqual([{ type: "text", text: "rules", cache_control: { type: "ephemeral" } }]);
    expect(p.output_config).toEqual({ effort: "low" });
  });

  it("splits by request count and by bytes", () => {
    const reqs = Array.from({ length: 5 }, (_, i) => ({ custom_id: `r${i}`, params: buildParams({ model: HAIKU, system: "s", content: "x".repeat(100), maxTokens: 1 }) }));
    expect(splitBatches(reqs, 2).map((b) => b.length)).toEqual([2, 2, 1]);
    expect(splitBatches(reqs, 100, 400).length).toBe(5);
  });
});

describe("review sample", () => {
  it("takes 10% (at least 1), stable for a seed, in order", () => {
    const items = Array.from({ length: 95 }, (_, i) => i);
    const a = sample(items, 0.1, "j1");
    expect(a).toHaveLength(10);
    expect(sample(items, 0.1, "j1")).toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual(a);
    expect(sample([1], 0.1)).toEqual([1]);
    expect(sample([], 0.1)).toEqual([]);
  });

  it("escapes record text", () => {
    const html = reviewHtml({ job: "j1", kind: "cards", total: 1, rejects: 0, sampled: [{ name: "<script>x</script>" }] });
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("thumbnails", () => {
  it("uses the server's allowlist and size variants", () => {
    const allow = thumbAllowlist();
    expect(smallVariant("https://i.pinimg.com/originals/ab/cd/x.jpg")).toBe("https://i.pinimg.com/236x/ab/cd/x.jpg");
    expect(pickThumbUrl({ imageUrl: "https://i.pinimg.com/736x/a.jpg" }, allow)).toBe("https://i.pinimg.com/236x/a.jpg");
    expect(pickThumbUrl({ imageUrl: "https://evil.example.com/a.jpg" }, allow)).toBeNull();
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("image/png");
  });

  it("fetches into memory and returns a base64 image block", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const fetchImpl = async () => new Response(png, { status: 200, headers: { "content-type": "image/png" } });
    const r = await fetchThumbBlock({ imageUrl: "https://i.pinimg.com/736x/a.jpg" }, { fetchImpl });
    expect(r.ok).toBe(true);
    if (r.ok && r.block.source.type === "base64") {
      expect(r.block.source.media_type).toBe("image/png");
      expect(Buffer.from(r.block.source.data, "base64")).toEqual(Buffer.from(png));
    }
    const blocked = await fetchThumbBlock({ imageUrl: "https://evil.example.com/a.png" }, { fetchImpl });
    expect(blocked).toEqual({ ok: false, reason: "not_allowed" });
  });
});

describe("run.ts arguments", () => {
  it("parses flags", () => {
    expect(parseArgs(["example.ts", "--dry", "--limit", "2"])).toMatchObject({ job: "example", dry: true, limit: 2, offset: 0 });
    expect(parseArgs(["j3-cards", "--offset", "10", "--from-raw"])).toMatchObject({ job: "j3-cards", offset: 10, fromRaw: true });
    expect(() => parseArgs(["x", "--limit", "-1"])).toThrow();
    expect(() => parseArgs(["x", "--wat"])).toThrow();
    expect(() => parseArgs([])).toThrow();
  });
});
