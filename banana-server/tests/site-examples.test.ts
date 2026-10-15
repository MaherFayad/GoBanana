/**
 * Real examples on the home page and the gallery (lib/site/examples.json, made by
 * scripts/make-examples.ts): the file's shape, hotlinks from allowlisted hosts only, crops in
 * range, copy rules, and the takedown-filtered loader (cache, fail closed).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/lib/site/dict/ar";
import { en } from "@/lib/site/dict/en";
import {
  EXAMPLES,
  EXAMPLES_FILE,
  EXAMPLES_TAKEDOWN_TTL_MS,
  featuredFirst,
  loadExamples,
  resetExamplesCache,
  slug,
} from "@/lib/site/examples";
import { DEFAULT_IMAGE_HOSTS, isAllowedImageUrl, parseAllowlist } from "@/lib/sources/allowlist";
import { isPartRole } from "@/lib/stitch/types";
import { compileTakedowns } from "@/lib/takedown";

const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);
const allRefs = EXAMPLES.flatMap((e) => [...e.ui, ...e.art, ...(e.stitch?.parts.map((p) => p.ref) ?? [])]);

describe("examples file", () => {
  it("holds 4 to 6 examples across platforms, with a date and a featured one", () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(4);
    expect(EXAMPLES.length).toBeLessThanOrEqual(6);
    expect(EXAMPLES_FILE.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(EXAMPLES_FILE.serperRequests).toBeLessThanOrEqual(120);
    expect(new Set(EXAMPLES.map((e) => e.platform)).size).toBeGreaterThanOrEqual(3);
    expect(featuredFirst(EXAMPLES)[0]!.key).toBe(EXAMPLES_FILE.featured);
    expect(new Set(EXAMPLES.map((e) => e.key)).size).toBe(EXAMPLES.length);
  });

  it("keeps 6 to 8 UI references and 3 to 4 art references per example, each with steal note", () => {
    for (const e of EXAMPLES) {
      expect(e.ui.length, e.key).toBeGreaterThanOrEqual(6);
      expect(e.ui.length, e.key).toBeLessThanOrEqual(8);
      expect(e.art.length, e.key).toBeGreaterThanOrEqual(3);
      expect(e.art.length, e.key).toBeLessThanOrEqual(4);
      for (const r of [...e.ui, ...e.art]) expect(r.steal?.trim(), r.id).toBeTruthy();
      expect(e.direction.spec.signature).toBeTruthy();
    }
  });

  it("hotlinks every image over https from an allowlisted host and links every source page", () => {
    for (const r of allRefs) {
      expect(isAllowedImageUrl(r.src, allowlist), r.src).toBe(true);
      expect(new URL(r.href).protocol, r.href).toBe("https:");
      expect(r.site.trim(), r.id).not.toBe("");
    }
  });

  it("has two Frankenstein pages with valid roles, crops in range and three or more sources", () => {
    const stitched = EXAMPLES.filter((e) => e.stitch);
    expect(stitched.length).toBeGreaterThanOrEqual(2);
    for (const e of stitched) {
      const s = e.stitch!;
      expect(new Set(s.parts.map((p) => p.ref.href)).size, e.key).toBeGreaterThanOrEqual(3);
      for (const p of s.parts) {
        expect(isPartRole(p.role)).toBe(true);
        const { x, y, w, h } = p.crop;
        expect(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1.0001 && y + h <= 1.0001, `${e.key} ${p.role}`).toBe(true);
        expect(p.ref.w && p.ref.h, p.ref.id).toBeTruthy();
      }
      for (const row of s.rows) for (const i of row.parts) expect(s.parts[i], `${e.key} row part ${i}`).toBeDefined();
    }
  });

  it("uses no em dashes in any text it shows", () => {
    const text = JSON.stringify(EXAMPLES_FILE);
    expect(text).not.toContain("—");
  });

  it("makes Latin file names for windows", () => {
    expect(slug("launch page for an AI note-taking startup")).toBe("launch-page-ai-note-taking");
  });
});

describe("examples copy", () => {
  it("has the example and gallery strings in both languages, with no em dashes", () => {
    for (const d of [en, ar]) {
      const x = d.landing.examples;
      for (const p of ["mobile", "website", "webapp"] as const) expect(x.platforms[p].trim()).not.toBe("");
      for (const m of ["collage", "wireframe", "harmonize"] as const) expect(x.modes[m].trim()).not.toBe("");
      expect(x.gallery.title.trim()).not.toBe("");
      expect(JSON.stringify(x)).not.toContain("—");
    }
  });
});

describe("examples loader", () => {
  afterEach(() => resetExamplesCache());

  it("drops references on the takedown list, by page or by domain, and a stitch with a blocked part", async () => {
    const blocked = EXAMPLES[0]!.ui[0]!;
    const { examples, images } = await loadExamples({ loadMatcher: async () => compileTakedowns([blocked.href, "httpster.net"]) });
    expect(images).toBe(true);
    const all = examples.flatMap((e) => [...e.ui, ...e.art]);
    expect(all.some((r) => r.href === blocked.href)).toBe(false);
    expect(all.some((r) => r.site === "httpster.net")).toBe(false);
    for (const e of examples) if (e.stitch) expect(e.stitch.parts.some((p) => p.ref.site === "httpster.net")).toBe(false);
  });

  it("fails closed with no images when the list cannot load, and does not cache the failure", async () => {
    const failed = await loadExamples({ loadMatcher: async () => Promise.reject(new Error("db down")) });
    expect(failed.images).toBe(false);
    expect(failed.examples.every((e) => e.ui.length === 0 && e.art.length === 0 && e.stitch === null)).toBe(true);
    const ok = await loadExamples({ loadMatcher: async () => compileTakedowns([]) });
    expect(ok.images).toBe(true);
    expect(ok.examples[0]!.ui.length).toBe(EXAMPLES[0]!.ui.length);
  });

  it("reads the list once per minute", async () => {
    const loadMatcher = vi.fn(async () => compileTakedowns([]));
    let now = 1_000_000;
    await loadExamples({ loadMatcher, now: () => now });
    now += EXAMPLES_TAKEDOWN_TTL_MS - 1;
    await loadExamples({ loadMatcher, now: () => now });
    expect(loadMatcher).toHaveBeenCalledTimes(1);
    now += 2;
    await loadExamples({ loadMatcher, now: () => now });
    expect(loadMatcher).toHaveBeenCalledTimes(2);
  });
});
