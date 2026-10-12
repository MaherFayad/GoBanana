/**
 * The landing page showcase (lib/site/showcase.ts, owner decision "Live references, linked"):
 * the list itself, the title parser, the takedown-filtered loader (cache, fail closed), the
 * bidi splitter for Arabic copy, and the export preview built by the real exporters.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/lib/site/dict/ar";
import { en } from "@/lib/site/dict/en";
import { hasArabic, splitLatinRuns } from "@/lib/site/bidi";
import { exportPreview, kitPreview, PREVIEW_FORMATS } from "@/lib/site/export-demo";
import kitPreviewJson from "@/lib/site/kit-preview.json";
import { GALLERY_BOARDS, HERO_TILES } from "@/lib/site/moves";
import {
  FINAL_REFS,
  GALLERY_REFS,
  HERO_REFS,
  parseShowcaseTitle,
  SHOWCASE,
  SHOWCASE_IMAGE_HOSTS,
  SHOWCASE_LENSES,
  siteOf,
} from "@/lib/site/showcase";
import { loadShowcase, resetShowcaseCache, SHOWCASE_TAKEDOWN_TTL_MS } from "@/lib/site/showcase-load";
import { isItemPage } from "@/lib/sources/item-page";
import { upgradeImage } from "@/lib/sources/quality";
import { compileTakedowns } from "@/lib/takedown";

describe("showcase title parser", () => {
  it("reads Dribbble titles with a creator and an optional studio", () => {
    expect(parseShowcaseTitle("Iridescent sphere by Aleksei Vasileika on Dribbble")).toEqual({ title: "Iridescent sphere", creator: "Aleksei Vasileika" });
    expect(parseShowcaseTitle("Flight Booking App UI by Sujon Hossain for Artxis on Dribbble")).toEqual({
      title: "Flight Booking App UI",
      creator: "Sujon Hossain",
    });
  });

  it("drops emoji, extra spaces and a role after the name", () => {
    expect(parseShowcaseTitle("🎨 Bento Grid Dashboard by Tasfia Barshat on Dribbble")).toEqual({ title: "Bento Grid Dashboard", creator: "Tasfia Barshat" });
    expect(parseShowcaseTitle("Radio Player App 🎛 | Neumorphic concept by Oleksandr Plyuto 🇺🇦 for  heartbeat on Dribbble").creator).toBe(
      "Oleksandr Plyuto",
    );
    expect(parseShowcaseTitle("Expense apps by Imrul Kayes  - SaaS Product Designer for Taqwah on Dribbble").creator).toBe("Imrul Kayes");
  });

  it("reads Behance titles, with or without a creator, and leaves the creator out when none is named", () => {
    expect(parseShowcaseTitle("Sadu Fabric :: Behance")).toEqual({ title: "Sadu Fabric" });
    expect(parseShowcaseTitle("ABIYA Mashrabiya (6) | Images :: Behance")).toEqual({ title: "ABIYA Mashrabiya" });
    expect(parseShowcaseTitle("Villa In The Desert by Encarni Fernandez Calero :: Behance")).toEqual({
      title: "Villa In The Desert",
      creator: "Encarni Fernandez Calero",
    });
    expect(parseShowcaseTitle("Desert sanctuary, Mexican architecture")).toEqual({ title: "Desert sanctuary, Mexican architecture" });
  });
});

describe("showcase list", () => {
  it("holds 18 to 22 items with unique ids", () => {
    expect(SHOWCASE.length).toBeGreaterThanOrEqual(18);
    expect(SHOWCASE.length).toBeLessThanOrEqual(22);
    expect(new Set(SHOWCASE.map((s) => s.id)).size).toBe(SHOWCASE.length);
  });

  it("names every creator once", () => {
    const creators = SHOWCASE.flatMap((s) => (s.creator ? [s.creator.toLowerCase()] : []));
    expect(creators.length).toBeGreaterThanOrEqual(12);
    expect(new Set(creators).size).toBe(creators.length);
  });

  it("links every item to one item page on its site, and hotlinks from the source CDN only", () => {
    for (const s of SHOWCASE) {
      expect(siteOf(s.sourceUrl), s.id).toBe(s.sourceSite);
      expect(isItemPage(new URL(s.sourceUrl), s.sourceSite), s.id).toBe(true);
      for (const u of [s.imageUrl, s.thumbUrl]) {
        const url = new URL(u);
        expect(url.protocol, s.id).toBe("https:");
        expect(SHOWCASE_IMAGE_HOSTS as readonly string[], s.id).toContain(url.hostname);
      }
    }
  });

  it("stores upgraded image URLs: Dribbble without ?resize, Pinterest at 736x", () => {
    for (const s of SHOWCASE) {
      expect(s.imageUrl, s.id).not.toMatch(/[?&]resize=/);
      expect(upgradeImage(new URL(s.imageUrl)).url, s.id).toBe(new URL(s.imageUrl).toString());
      if (s.imageUrl.includes("i.pinimg.com")) expect(s.imageUrl).toMatch(/\/736x\//);
    }
  });

  it("gives every hero tile, gallery slot and final tile a known item", () => {
    const ids = new Set(SHOWCASE.map((s) => s.id));
    for (const t of HERO_TILES) expect(ids.has(HERO_REFS[t.art]), t.art).toBe(true);
    expect(new Set(HERO_TILES.map((t) => HERO_REFS[t.art])).size).toBe(HERO_TILES.length);
    expect(GALLERY_REFS).toHaveLength(GALLERY_BOARDS.length);
    for (const board of GALLERY_REFS) for (const id of board) expect(ids.has(id), id).toBe(true);
    for (const id of FINAL_REFS) expect(ids.has(id), id).toBe(true);
  });

  it("has words for every lens and move in both languages", () => {
    for (const dict of [en, ar]) {
      for (const lens of SHOWCASE_LENSES) expect(dict.landing.showcase.lenses[lens].trim()).not.toBe("");
      for (const s of SHOWCASE) if (s.move) expect(dict.landing.showcase.moves[s.move].trim()).not.toBe("");
    }
    expect(ar.landing.showcase.credit).toContain("،");
  });
});

describe("showcase loader", () => {
  afterEach(() => resetShowcaseCache());

  it("drops items on the takedown list, by source page or by domain", async () => {
    const blocked = SHOWCASE.find((s) => s.sourceSite === "dribbble")!;
    const items = await loadShowcase({ loadMatcher: async () => compileTakedowns([blocked.sourceUrl, "behance.net"]) });
    expect(items).not.toBeNull();
    expect(items!.some((i) => i.id === blocked.id)).toBe(false);
    expect(items!.some((i) => i.sourceSite === "behance")).toBe(false);
    expect(items!.length).toBe(SHOWCASE.filter((s) => s.id !== blocked.id && s.sourceSite !== "behance").length);
  });

  it("fails closed (null) when the list cannot load, and does not cache the failure", async () => {
    expect(await loadShowcase({ loadMatcher: async () => Promise.reject(new Error("db down")) })).toBeNull();
    expect(await loadShowcase({ loadMatcher: async () => compileTakedowns([]) })).toHaveLength(SHOWCASE.length);
  });

  it("reads the list once per minute", async () => {
    const loadMatcher = vi.fn(async () => compileTakedowns([]));
    let now = 1_000_000;
    await loadShowcase({ loadMatcher, now: () => now });
    now += SHOWCASE_TAKEDOWN_TTL_MS - 1;
    await loadShowcase({ loadMatcher, now: () => now });
    expect(loadMatcher).toHaveBeenCalledTimes(1);
    now += 2;
    await loadShowcase({ loadMatcher, now: () => now });
    expect(loadMatcher).toHaveBeenCalledTimes(2);
  });
});

describe("bidi isolation for Arabic copy", () => {
  const latin = (s: string) => splitLatinRuns(s).filter((p) => p.latin).map((p) => p.text);

  it("isolates Latin terms and keeps sentence punctuation outside", () => {
    expect(latin("الألوان والخطوط بصيغة JSON.")).toEqual(["JSON"]);
    expect(latin("سمة جاهزة لملف إعدادات Tailwind.")).toEqual(["Tailwind"]);
    expect(latin("افتح الملف ~/.cursor/mcp.json أو أنشئه.")).toEqual(["~/.cursor/mcp.json"]);
    expect(latin("بصفتها البائع المعتمد (Merchant of Record).")).toEqual(["Merchant of Record"]);
    expect(latin("مثل https://example.com/pin/123، أو")).toEqual(["https://example.com/pin/123"]);
    expect(latin("من Pinterest وDribbble وBehance")).toEqual(["Pinterest", "Dribbble", "Behance"]);
  });

  it("leaves English untouched", () => {
    expect(hasArabic("Colors and type as design tokens, in JSON.")).toBe(false);
    expect(splitLatinRuns("Add it to Claude.")).toEqual([{ text: "Add it to Claude.", latin: false }]);
  });

  it("never ends a Latin run in the Arabic dictionary with sentence punctuation", () => {
    const strings = (v: unknown, out: string[] = []): string[] => {
      if (typeof v === "string") out.push(v);
      else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
      else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
      return out;
    };
    for (const s of strings(ar)) for (const run of latin(s)) expect(run, s).not.toMatch(/[.,:;!?،]$/);
  });

  it("uses the agreed Arabic labels for the export files", () => {
    expect(ar.landing.ship.formats.map((f) => f.label)).toEqual(["DESIGN.md", "AGENTS.md", "رموز التصميم", "Tailwind", "FigJam", "الموجز"]);
    expect(ar.landing.ship.formats[2]!.body).toBe("الألوان والخطوط بصيغة JSON.");
  });
});

describe("export preview", () => {
  it("is the six files export_kit writes for the example board, with source links", () => {
    const files = exportPreview();
    expect(files.map((f) => f.format)).toEqual([...PREVIEW_FORMATS]);
    expect(files.map((f) => f.name)).toEqual(["DESIGN.md", "AGENTS.md", "tokens.json", "theme.css", "figjam-spec.json", "BRIEF.md"]);
    expect(en.landing.ship.formats).toHaveLength(files.length);
    expect(ar.landing.ship.formats).toHaveLength(files.length);
    const sadu = SHOWCASE.find((s) => s.id === "sadu-fabric")!;
    for (const f of files) {
      expect(f.content.length, f.name).toBeGreaterThan(200);
      expect(f.content, f.name).not.toContain("—");
    }
    expect(files.find((f) => f.name === "DESIGN.md")!.content).toContain(sadu.sourceUrl);
    expect(() => JSON.parse(files.find((f) => f.name === "tokens.json")!.content)).not.toThrow();
  });

  it("matches the precomputed landing fan (lib/site/kit-preview.json)", () => {
    // Regenerate after exporter or demo changes: UPDATE_KIT_PREVIEW=1 npx vitest run tests/site-showcase.test.ts
    if (process.env.UPDATE_KIT_PREVIEW === "1") {
      writeFileSync(join(process.cwd(), "lib/site/kit-preview.json"), JSON.stringify(kitPreview(), null, 2) + "\n");
      return;
    }
    expect(kitPreviewJson, "lib/site/kit-preview.json is stale; see the comment above").toEqual(kitPreview());
  });
});
