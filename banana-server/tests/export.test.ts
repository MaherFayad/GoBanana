import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import fonts from "../lib/kit/fonts.json";
import { EXPORT_FORMATS, buildKitModel, exportKit, type ExportFile } from "../lib/export";
import { escapeHtml, safeUrl } from "../lib/export/util";
import type { FigjamSpec } from "../lib/export/figjam-spec";
import { FIXTURES, checkoutCanvas, hostileCanvas, qahwaCanvas } from "./export-fixtures";

const fixtures = Object.entries(FIXTURES);

function file(files: ExportFile[], name: string): string {
  const f = files.find((x) => x.name === name);
  if (!f) throw new Error(`missing ${name}`);
  return f.content;
}

function frontMatter(md: string): Record<string, unknown> {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (!m?.[1]) throw new Error("no front matter");
  return parseYaml(m[1]) as Record<string, unknown>;
}

describe("fonts.json", () => {
  const { pairings } = fonts;
  it("has 12 to 20 open licence pairings with unique ids", () => {
    expect(pairings.length).toBeGreaterThanOrEqual(12);
    expect(pairings.length).toBeLessThanOrEqual(20);
    expect(new Set(pairings.map((p) => p.id)).size).toBe(pairings.length);
    for (const p of pairings) {
      expect(["OFL-1.1", "Apache-2.0"]).toContain(p.licence);
      expect(p.url.startsWith("https://fonts.googleapis.com/css2?")).toBe(true);
      expect(p.display.family && p.body.family).toBeTruthy();
      expect(p.mood.length).toBeGreaterThan(0);
    }
  });
  it("has at least 3 pairings with Arabic support and a valid default", () => {
    expect(pairings.filter((p) => p.scripts.includes("arabic")).length).toBeGreaterThanOrEqual(3);
    expect(pairings.some((p) => p.id === fonts.default)).toBe(true);
  });
});

describe("exportKit", () => {
  it("returns each asked format once, in order, and skips unknown ones", () => {
    const files = exportKit(checkoutCanvas, ["brief", "design_md", "brief", "nope" as never]);
    expect(files.map((f) => f.name)).toEqual(["BRIEF.md", "DESIGN.md"]);
    expect(exportKit(checkoutCanvas, [])).toEqual([]);
  });

  it("builds all seven formats with names and mime types", () => {
    const files = exportKit(checkoutCanvas, EXPORT_FORMATS);
    expect(files.map((f) => [f.name, f.mime])).toEqual([
      ["DESIGN.md", "text/markdown"],
      ["AGENTS.md", "text/markdown"],
      ["tokens.json", "application/json"],
      ["theme.css", "text/css"],
      ["figjam-spec.json", "application/json"],
      ["board.html", "text/html"],
      ["BRIEF.md", "text/markdown"],
    ]);
    for (const f of files) expect(f.content.length).toBeGreaterThan(100);
  });
});

describe.each(fixtures)("fixture %s", (_name, snapshot) => {
  const files = exportKit(snapshot, EXPORT_FORMATS);
  const model = buildKitModel(snapshot);

  it("has no em dashes in any output", () => {
    for (const f of files) expect(f.content, f.name).not.toMatch(/—/);
  });

  it("puts only ship colors in the DESIGN.md front matter", () => {
    const md = file(files, "DESIGN.md");
    const fm = frontMatter(md);
    const colors = Object.values((fm.colors ?? {}) as Record<string, string>).map((c) => c.toLowerCase());
    const shipHexes = new Set(model.ship.map((c) => c.hex));
    for (const hex of colors) expect(shipHexes.has(hex)).toBe(true);
    const explore = [
      ...snapshot.palettes.flatMap((p) => p.colors.filter((c) => c.tag === "explore").map((c) => c.hex.toLowerCase())),
      ...snapshot.items.flatMap((i) => (i.type === "swatch" && i.tag === "explore" ? [i.hex.toLowerCase()] : [])),
    ].filter((hex) => !shipHexes.has(hex));
    expect(explore.length).toBeGreaterThan(0);
    const colorsProse = md.slice(md.indexOf("## Colors"), md.indexOf("## Typography"));
    for (const hex of explore) {
      expect(colors).not.toContain(hex);
      expect(colorsProse).toContain(`${hex}`);
    }
    expect(colorsProse).toContain("concept only");
    // Explore colors stay out of the token files too.
    for (const hex of explore) {
      expect(file(files, "theme.css")).not.toContain(hex);
      expect(JSON.stringify((JSON.parse(file(files, "tokens.json")) as { color?: unknown }).color ?? {})).not.toContain(hex);
    }
  });

  it("keeps the DESIGN.md sections in spec order, each once", () => {
    const headings = file(files, "DESIGN.md").match(/^## .+$/gm) ?? [];
    expect(headings).toEqual([
      "## Overview",
      "## Colors",
      "## Typography",
      "## Layout",
      "## Elevation & Depth",
      "## Shapes",
      "## Components",
      "## Do's and Don'ts",
      "## Sources",
    ]);
  });

  it("shows every reference source link in every format", () => {
    const refs = snapshot.items.filter((i) => i.type === "image" || i.type === "upload");
    expect(refs.length).toBeGreaterThan(0);
    for (const item of refs) {
      const url = safeUrl(item.sourceUrl);
      if (!url) continue;
      for (const f of files) {
        if (f.name === "board.html") expect(f.content, f.name).toContain(`href="${escapeHtml(url)}"`);
        else if (f.name.endsWith(".json")) expect(f.content, f.name).toContain(JSON.stringify(url));
        else expect(f.content, `${f.name} ${url}`).toContain(url);
      }
    }
  });

  it("builds a static, noindex HTML board with linked tiles and lazy, no-referrer images", () => {
    const html = file(files, "board.html");
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain('<h2 id="sources-title">Sources</h2>');
    const imgs = html.match(/<img [^>]*>/g) ?? [];
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      expect(img).toMatch(/ src="https?:\/\//);
      expect(img).toContain('loading="lazy"');
      expect(img).toContain('referrerpolicy="no-referrer"');
      expect(img).toMatch(/ alt="[^"]+"/);
    }
    expect(html).not.toContain("data:image");
    // Every safe reference tile is a link to its source.
    const tiles = html.match(/<a class="tile ref"[^>]*>/g) ?? [];
    const safeRefs = snapshot.items.filter((i) => (i.type === "image" || i.type === "upload") && safeUrl(i.sourceUrl));
    expect(tiles.length).toBe(safeRefs.length);
    for (const t of tiles) expect(t).toMatch(/href="https?:\/\//);
  });

  it("emits a FigJam spec in the section 10 shape with sourceUrl on every item", () => {
    const spec = JSON.parse(file(files, "figjam-spec.json")) as FigjamSpec;
    expect(Array.isArray(spec.sections)).toBe(true);
    expect(spec.sections.length).toBeGreaterThan(0);
    let refCount = 0;
    for (const s of spec.sections) {
      expect(typeof s.title).toBe("string");
      for (const k of ["x", "y", "w", "h"] as const) expect(Number.isFinite(s[k])).toBe(true);
      for (const item of s.items) {
        expect(["image", "upload", "note", "swatch", "typeSample"]).toContain(item.type);
        for (const k of ["x", "y", "w", "h"] as const) expect(Number.isFinite(item[k])).toBe(true);
        expect(item).toHaveProperty("sourceUrl");
        if (item.type === "image" || item.type === "upload") {
          refCount++;
          if (item.sourceUrl !== null) expect(item.sourceUrl).toMatch(/^https?:\/\//);
          if (item.imageUrl) expect(item.imageUrl).toMatch(/^https?:\/\//);
        }
        if (item.type === "note") expect(typeof item.text).toBe("string");
        if (item.type === "swatch") expect(item.hex).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    expect(refCount).toBe(snapshot.items.filter((i) => i.type === "image" || i.type === "upload").length);
  });

  it("writes AGENTS.md from the section 10 template with ship, explore and sources", () => {
    const md = file(files, "AGENTS.md");
    expect(md.startsWith("# Design rules for coding agents\n\nRead DESIGN.md before writing any UI. Use only its tokens.")).toBe(true);
    const order = ["## Ship", "## Explore only", "## Sources"].map((h) => md.indexOf(h));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const c of model.ship) expect(md).toContain(c.hex);
    for (const c of model.explore) expect(md.slice(md.indexOf("## Explore only"))).toContain(c.hex);
  });

  it("writes a brief with the brief, directions, what was kept and notes", () => {
    const md = file(files, "BRIEF.md");
    for (const h of ["## Brief", "## Directions tried", "## What was kept", "## Notes", "## Sources"]) expect(md).toContain(h);
    for (const d of snapshot.directions) expect(md).toContain(d.title);
  });
});

describe("content details", () => {
  it("adds ship text colors from passing contrast checks and promotes a primary", () => {
    const m = buildKitModel(checkoutCanvas);
    expect(m.ship.map((c) => c.name)).toEqual(["primary", "secondary", "surface", "white"]);
    const button = m.components.find((c) => c.name === "button-primary");
    expect(button).toMatchObject({ backgroundColor: "primary", textColor: "white" });
    expect(button?.ratio).toBeGreaterThan(4.5);

    const h = buildKitModel(hostileCanvas);
    expect(h.ship).toHaveLength(1);
    expect(h.ship[0]).toMatchObject({ name: "primary", hex: "#c62828", canvasRole: "Brand Red!!" });
  });

  it("uses the canvas type sample, or the default pairing", () => {
    expect(buildKitModel(checkoutCanvas).pairing.id).toBe("unbounded-manrope");
    expect(buildKitModel(hostileCanvas).pairing.id).toBe(fonts.default);
    const q = buildKitModel(qahwaCanvas);
    expect(q.pairing.id).toBe("cairo-tajawal");
    expect(q.arabic).toBe(true);
    expect(q.typography.every((t) => t.letterSpacing === null)).toBe(true);
    expect(exportKit(qahwaCanvas, ["design_md"])[0]?.content).toContain('dir="rtl"');
  });

  it("places items in sections by geometry when sectionId is missing", () => {
    const q = buildKitModel(qahwaCanvas);
    expect(q.sections.find((s) => s.id === "qs1")?.items.map((i) => i.id)).toEqual(["qr1", "qr2", "qn1", "qt1"]);
    expect(q.directions.every((d) => d.kept)).toBe(true);
    const c = buildKitModel(checkoutCanvas);
    expect(c.directions.map((d) => d.kept)).toEqual([true, true, false]);
  });

  it("escapes hostile strings everywhere they could run", () => {
    const files = exportKit(hostileCanvas, EXPORT_FORMATS);
    const html = file(files, "board.html");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("</script>");
    expect(html).toContain("&lt;script&gt;alert(&quot;t&quot;)&lt;/script&gt;");
    expect(html).not.toMatch(/onerror="alert/);
    expect(html).not.toContain("red;background");
    // A data: image is never inlined; the tile becomes a link card.
    expect(html).not.toContain("data:");
    // The javascript: link is shown as text, never as a link.
    expect(html).toContain("Source link not usable: javascript:alert(1)");

    const md = file(files, "DESIGN.md");
    expect(md.match(/^## Colors$/gm)).toHaveLength(1);
    // Front matter keeps the raw title as YAML data; the Markdown body must escape it.
    const body = md.slice(md.indexOf("\n---\n", 4) + 5);
    // Markdown escapes (\\<) render as literal text; no raw tag may remain.
    expect(body).not.toMatch(/(^|[^\\])<(script|svg|img)/m);
    expect(body).toContain("\\<script\\>");
    expect(frontMatter(md).name).toBe('<script>alert("t")</script> Board, test');
    expect(md).not.toMatch(/\]\(javascript:|<javascript:/);

    const spec = JSON.parse(file(files, "figjam-spec.json")) as FigjamSpec;
    const items = spec.sections.flatMap((s) => s.items);
    expect(items.find((i) => i.title?.includes("svg"))?.sourceUrl).toBeNull();
    expect(items.find((i) => i.title?.includes("svg"))?.imageUrl).toBeUndefined();
    expect(file(files, "theme.css")).not.toMatch(/\*\/[\s\S]*\*\/\n@theme/);
  });

  it("dedupes references that share a source link but still links every tile", () => {
    const m = buildKitModel(hostileCanvas);
    expect(m.references.filter((r) => r.url === "https://dribbble.com/shots/1-Same-Link")).toHaveLength(1);
    const html = exportKit(hostileCanvas, ["html_board"])[0]?.content ?? "";
    expect(html.match(/<a class="tile ref"[^>]*href="https:\/\/dribbble\.com\/shots\/1-Same-Link"/g)).toHaveLength(2);
  });
});
