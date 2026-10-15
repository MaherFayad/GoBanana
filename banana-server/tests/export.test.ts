import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import fonts from "../lib/kit/fonts.json";
import { EXPORT_FORMATS, buildKitModel, exportKit, type ExportFile } from "../lib/export";
import { escapeHtml, safeUrl } from "../lib/export/util";
import type { FigjamSpec } from "../lib/export/figjam-spec";
import { EXPORT_FORMATS as QUOTA_FORMATS } from "../lib/quota";
import { TYPE_VOICES } from "../lib/direction-detail";
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
  it("has 12 to 30 open licence pairings with unique ids", () => {
    expect(pairings.length).toBeGreaterThanOrEqual(12);
    expect(pairings.length).toBeLessThanOrEqual(30);
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
  it("maps every type voice to a Latin pairing", () => {
    for (const v of TYPE_VOICES) {
      const id = (fonts.voices as Record<string, string>)[v];
      const p = pairings.find((x) => x.id === id);
      expect(p, v).toBeDefined();
      expect(p!.scripts).toContain("latin");
    }
    expect(new Set(Object.values(fonts.voices)).size).toBe(TYPE_VOICES.length);
  });
});

describe("exportKit", () => {
  it("returns each asked format once, in order, and skips unknown ones", () => {
    const files = exportKit(checkoutCanvas, ["brief", "design_md", "brief", "nope" as never]);
    expect(files.map((f) => f.name)).toEqual(["BRIEF.md", "DESIGN.md"]);
    expect(exportKit(checkoutCanvas, [])).toEqual([]);
  });

  it("builds every format with names, mime types and suggested paths", () => {
    const files = exportKit(checkoutCanvas, EXPORT_FORMATS);
    const dir = "design/explorations/frosted-checkout";
    expect(files.map((f) => [f.name, f.mime, f.path, f.append ?? false])).toEqual([
      ["DESIGN.md", "text/markdown", `${dir}/DESIGN.md`, false],
      ["AGENTS.md", "text/markdown", "AGENTS.md", true],
      ["tokens.json", "application/json", `${dir}/kit/tokens.json`, false],
      ["theme.css", "text/css", `${dir}/kit/theme.css`, false],
      ["figjam-spec.json", "application/json", `${dir}/figjam-spec.json`, false],
      ["board.html", "text/html", `${dir}/board.html`, false],
      ["BRIEF.md", "text/markdown", `${dir}/BRIEF.md`, false],
      ["DIRECTION.md", "text/markdown", `${dir}/DIRECTION.md`, false],
      ["BUILD-PROMPT.md", "text/markdown", `${dir}/BUILD-PROMPT.md`, false],
      ["REVIEW.md", "text/markdown", `${dir}/REVIEW.md`, false],
      ["gobanana-frosted-checkout.mdc", "text/markdown", ".cursor/rules/gobanana-frosted-checkout.mdc", false],
      ["gobanana-frosted-checkout.instructions.md", "text/markdown", ".github/instructions/gobanana-frosted-checkout.instructions.md", false],
      ["CLAUDE.md", "text/markdown", "CLAUDE.md", true],
      ["FRANKENSTEIN.md", "text/markdown", `${dir}/FRANKENSTEIN.md`, false],
      ["frankenstein-wireframe.html", "text/html", `${dir}/frankenstein-wireframe.html`, false],
      ["PITCH.md", "text/markdown", `${dir}/PITCH.md`, false],
      ["EXPERIMENT.md", "text/markdown", `${dir}/EXPERIMENT.md`, false],
    ]);
    for (const f of files) expect(f.content.length).toBeGreaterThan(100);
  });

  it("keeps the export format list in step with the plan list", () => {
    expect([...EXPORT_FORMATS]).toEqual([...QUOTA_FORMATS]);
  });
});

const STITCH_FILES = ["FRANKENSTEIN.md", "frankenstein-wireframe.html"];

describe.each(fixtures)("fixture %s", (_name, snapshot) => {
  const files = exportKit(snapshot, EXPORT_FORMATS);
  const model = buildKitModel(snapshot);

  it("has no em dashes in any output", () => {
    for (const f of files) expect(f.content, f.name).not.toMatch(/\u2014/);
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
      // The Frankenstein files list the sources of their slots (tests/export-stitch.test.ts).
      for (const f of files.filter((x) => !STITCH_FILES.includes(x.name))) {
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

  it("writes AGENTS.md as a scoped wild page section with ship, explore and sources", () => {
    const md = file(files, "AGENTS.md");
    expect(md).toMatch(/^<!-- gobanana:[a-z0-9-]+ -->\n## Wild page: /);
    expect(md).toMatch(/<!-- \/gobanana:[a-z0-9-]+ -->\n$/);
    expect(md).not.toContain("Use only its tokens");
    expect(md).toContain("Applies to: ");
    const order = ["### Rules", "### Ship", "### Explore only", "### Sources"].map((h) => md.indexOf(h));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const c of model.ship) expect(md).toContain(c.hex);
    for (const c of model.explore) expect(md.slice(md.indexOf("### Explore only"))).toContain(c.hex);
  });

  it("writes the system AGENTS.md from the section 10 template", () => {
    const md = file(exportKit(snapshot, ["agents_md"], { scope: "system" }), "AGENTS.md");
    expect(md.replace(/^<!-- gobanana:[a-z0-9-]+ -->\n/, "").startsWith("# Design rules for coding agents\n\nRead DESIGN.md before writing any UI. Use only its tokens.")).toBe(true);
    const order = ["## Ship", "## Explore only", "## Sources"].map((h) => md.indexOf(h));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("opens every page scope file with the scope block", () => {
    for (const f of files) {
      if (f.name.endsWith(".json")) {
        expect(f.content, f.name).toContain("Scope: one wild page, not the product design system.");
        continue;
      }
      if (f.name === "theme.css" || f.name.endsWith(".html")) {
        expect(f.content, f.name).toContain("Scope: one wild page, not the product design system.");
        continue;
      }
      // Markdown: after any front matter and the first heading, the block comes first.
      const body = f.content.replace(/^<!-- gobanana:[a-z0-9-]+ -->\n/, "").replace(/^---\n[\s\S]*?\n---\n\n/, "").replace(/^#+ .*\n\n/, "");
      expect(body.startsWith("> **Scope: one wild page, not the product design system.**"), f.name).toBe(true);
      expect(body, f.name).toContain("inherits the project's own design system and its existing DESIGN.md, and does not change them");
      expect(body, f.name).toContain("page level overrides");
    }
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

  it("derives ship from contrast pairs for untagged palette colors, and lets a swatch toggle win", () => {
    const snap = {
      ...checkoutCanvas,
      items: [
        ...checkoutCanvas.items.filter((i) => i.type !== "swatch"),
        { id: "sw", type: "swatch" as const, x: 0, y: 600, w: 80, h: 80, hex: "#3A5A40", tag: "explore" as const },
      ],
      palettes: [
        {
          colors: [
            { hex: "#F5F0E6", oklch: "oklch(0.95 0.02 85)", role: "surface" },
            { hex: "#3A5A40", oklch: "oklch(0.42 0.06 145)", role: "primary" },
            { hex: "#E9C46A", oklch: "oklch(0.83 0.12 85)", role: "accent" },
          ],
          contrast: [
            { fg: "#3a5a40", bg: "#f5f0e6", ratio: 6.9, passesText: true, passesUi: true, tag: "ship" as const },
            { fg: "#f5f0e6", bg: "#000000", ratio: 18.1, passesText: true, passesUi: true, tag: "ship" as const },
            { fg: "#e9c46a", bg: "#f5f0e6", ratio: 1.5, passesText: false, passesUi: false, tag: "explore" as const },
          ],
        },
      ],
    };
    const m = buildKitModel(snap);
    // #3a5a40 is in a ship pair, but the swatch on the canvas says explore.
    expect(m.ship.map((c) => c.hex)).toEqual(["#f5f0e6", "#000000"]);
    expect(m.explore.map((c) => c.hex).sort()).toEqual(["#3a5a40", "#e9c46a"]);
    const fm = frontMatter(exportKit(snap, ["design_md"])[0]?.content ?? "");
    expect(Object.values(fm.colors as Record<string, string>)).not.toContain("#3a5a40");
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
