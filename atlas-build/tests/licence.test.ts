import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_IMAGE_HOSTS, isAllowedImageUrl } from "../../banana-server/lib/sources/allowlist.ts";
import { noModelInputHosts } from "../../banana-server/lib/sources/registry.ts";
import { exemplarPicks } from "../j7-taste.ts";
import { fetchThumbBlock, fetchImageBlock, modelInputOk, thumbAllowlist } from "../lib/thumbs.ts";

// Craftwork's license allows saving references and sharing links, but not testing or training AI
// models on its previews. No Craftwork page, image or video may reach a model input.
const TASTE = join(__dirname, "..", "..", "banana-server", "bench", "taste");
const candidates = JSON.parse(readFileSync(join(TASTE, "candidates.json"), "utf8")).candidates as {
  id: string;
  sourceSite: string;
  genre?: string;
  platform?: string;
  sourceUrl: string;
  imageUrl: string;
  thumbUrl?: string;
  media?: { url: string; poster?: string }[];
}[];
const craftwork = candidates.filter((c) => c.sourceSite === "craftwork.design");

describe("Craftwork never reaches a model input", () => {
  it("lists Craftwork's own hosts as no-model hosts", () => {
    const hosts = noModelInputHosts();
    for (const h of ["craftwork.design", "curated-images.b-cdn.net", "curated-video.b-cdn.net", "craftwork-products.b-cdn.net", "marketstorage.b-cdn.net"]) expect(hosts).toContain(h);
    expect(hosts).not.toContain("assets.awwwards.com");
  });

  it("keeps Craftwork images off the canvas allowlist (removed from search) and off the judging thumbnail allowlist", () => {
    expect(DEFAULT_IMAGE_HOSTS).not.toContain("curated-images.b-cdn.net");
    const allow = thumbAllowlist();
    for (const c of craftwork) {
      expect(isAllowedImageUrl(c.imageUrl, allow)).toBe(false);
      for (const m of c.media ?? []) expect(isAllowedImageUrl(m.url, allow)).toBe(false);
    }
    expect(isAllowedImageUrl("https://assets.awwwards.com/awards/a.jpg", allow)).toBe(true);
  });

  it("refuses to fetch a Craftwork image for a model, without any network call", async () => {
    const c = craftwork[0]!;
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0]), { status: 200, headers: { "content-type": "image/jpeg" } });
    }) as unknown as typeof fetch;
    expect(await fetchThumbBlock({ imageUrl: c.imageUrl, thumbUrl: c.thumbUrl }, { fetchImpl })).toEqual({ ok: false, reason: "not_allowed" });
    expect(await fetchImageBlock(c.imageUrl, { fetchImpl })).toEqual({ ok: false, reason: "not_allowed" });
    expect(calls).toBe(0);
  });

  it("drops Craftwork picks from every j7-taste genre, whatever their genre field says", () => {
    expect(craftwork.length).toBeGreaterThan(0);
    for (const c of craftwork) expect(modelInputOk(c)).toBe(false);
    const picks = candidates.map(({ id, sourceUrl, imageUrl, platform, genre }) => ({ id, sourceUrl, imageUrl, platform, genre }));
    // A Craftwork pick relabelled as a UI pick (no genre) is still dropped by its URLs.
    const relabelled = { ...picks.find((p) => p.sourceUrl.includes("craftwork.design"))!, genre: undefined, platform: "web", id: "x1" };
    for (const genre of [undefined, "web-showcase", "presentation", "branding"]) {
      const got = exemplarPicks([...picks, relabelled], genre);
      expect(got.some((p) => /craftwork|b-cdn\.net/.test(`${p.sourceUrl} ${p.imageUrl}`))).toBe(false);
    }
    // Best Designs on X candidates (sourceSite x.com) are link-out only too (tests/no-model-sources.test.ts).
    expect(exemplarPicks(picks, "web-showcase").length).toBe(candidates.filter((c) => c.genre === "web-showcase" && c.sourceSite !== "craftwork.design" && c.sourceSite !== "x.com").length);
  });

  it("drops an item when only one of its media is Craftwork's", () => {
    expect(modelInputOk({ sourceUrl: "https://www.awwwards.com/sites/x", imageUrl: "https://assets.awwwards.com/a.jpg" })).toBe(true);
    expect(modelInputOk({ sourceUrl: "https://www.awwwards.com/sites/x", imageUrl: "https://assets.awwwards.com/a.jpg", media: [{ url: "https://curated-video.b-cdn.net/v.mp4" }] })).toBe(false);
  });
});
