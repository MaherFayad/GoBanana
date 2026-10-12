/** Frankenstein exports: FRANKENSTEIN.md (stitch_md), frankenstein-wireframe.html (wireframe_html), and the sections in BUILD-PROMPT.md and DIRECTION.md. */
import { describe, expect, it } from "vitest";
import type { CanvasSnapshot, StitchSnapshot } from "@/lib/canvas/types";
import { exportKit } from "@/lib/export";
import { createExportKitTool } from "@/lib/mcp/tools/export_kit";
import { createStitchPageTool } from "@/lib/mcp/tools/frankenstein_page";
import { checkoutCanvas } from "./export-fixtures";
import { library } from "./stitch-fixtures";
import { ALICE, makeDeps, seedCanvas, state, text } from "./tools-fixtures";
import type { CanvasState } from "@/canvas/types";

const slot = (id: string, role: StitchSnapshot["rows"][number]["slots"][number]["role"], n: number, over = {}) => ({
  id,
  role,
  partId: `pt-${n}`,
  imageUrl: `https://cdn.dribbble.com/shot/${n}.png`,
  sourceUrl: `https://dribbble.com/shots/${n}-a_(b)`,
  sourceSite: "dribbble.com",
  title: `Shot ${n}`,
  crop: { x: 0, y: 0, w: 1, h: 0.1 },
  imageWidth: 1600,
  imageHeight: 1200,
  ...over,
});

const stitch: StitchSnapshot = {
  id: "st-1",
  title: "Game store dashboard",
  platform: "webapp",
  mode: "collage",
  note: "Editorial nav over a dashboard",
  x: 0,
  y: 0,
  w: 720,
  h: 500,
  sectionId: null,
  rows: [
    { id: "rw-1", slots: [slot("sl-1", "nav", 1, { note: "split nav with search pill" })] },
    { id: "rw-2", widths: [1, 4], slots: [slot("sl-2", "sidebar", 2, { crop: { x: 0, y: 0, w: 0.18, h: 1 } }), slot("sl-3", "table", 3, { title: "<b>Bold</b> table" })] },
  ],
};
const remixed: StitchSnapshot = { ...stitch, id: "st-2", title: "Game store dashboard, remix 1", variantOf: "st-1", variant: 1, note: undefined };

const snap: CanvasSnapshot = { ...checkoutCanvas, stitches: [stitch, remixed] };
const file = (name: string, s: CanvasSnapshot = snap) => exportKit(s, ["stitch_md", "wireframe_html", "build_prompt", "direction_md"]).find((f) => f.name === name)!;

describe("FRANKENSTEIN.md", () => {
  it("has a path, the scope block, guidance and a skeleton per page with source links", () => {
    const f = file("FRANKENSTEIN.md");
    expect(f.path).toBe("design/explorations/frosted-checkout/FRANKENSTEIN.md");
    const md = f.content;
    expect(md.startsWith("# Frankenstein pages: Frosted checkout\n\n> **Scope: one wild page, not the product design system.**")).toBe(true);
    expect(md).toContain("Take the structure and the moves, not the pixels");
    expect(md).toContain("Unify to one theme.");
    expect(md).toContain("Never copy, trace or embed the reference images.");
    expect(md).toContain("## 1. Game store dashboard");
    expect(md).toContain("- Platform: Web app (1440 px frame).");
    expect(md).toContain("- Idea: Editorial nav over a dashboard");
    expect(md).toContain('1. **Nav** from [Shot 1](https://dribbble.com/shots/1-a_%28b%29) (dribbble.com). Steal: split nav with search pill');
    expect(md).toContain("2. Side by side (widths 1:4):\n   - **Sidebar** from [Shot 2]");
    expect(md).toContain("[\\<b\\>Bold\\</b\\> table](https://dribbble.com/shots/3-a_%28b%29)");
    expect(md).toContain('- Remix 1 of "Game store dashboard".');
    expect(md).toContain("## Sources");
    expect(md).not.toMatch(/[—–]/);
  });

  it("says what to do when there are no pages", () => {
    expect(file("FRANKENSTEIN.md", checkoutCanvas).content).toContain("No Frankenstein pages on this board yet.");
  });
});

describe("frankenstein-wireframe.html", () => {
  it("is a standalone, strict CSP wireframe with no reference images", () => {
    const f = file("frankenstein-wireframe.html");
    expect(f.path).toBe("design/explorations/frosted-checkout/frankenstein-wireframe.html");
    expect(f.mime).toBe("text/html");
    const html = f.content;
    expect(html).toContain(`content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"`);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("cdn.dribbble.com");
    expect(html).toContain('<ol class="frame" style="width:1440px"');
    expect(html).toContain('aria-label="Sidebar, from dribbble.com"');
    expect(html).toContain('href="https://dribbble.com/shots/1-a_(b)"');
    expect(html).toContain("&lt;b&gt;Bold&lt;/b&gt; table");
    expect(html).not.toContain("<b>Bold</b>");
    // Sidebar box: crop 0.18 x 1 of 1600 x 1200 gives height / width = 1200 / 288.
    expect(html).toContain("flex:1 1 0;aspect-ratio:1 / 4.0000");
    expect(html).toContain("flex:4 1 0;");
    expect(html).toContain('role="region" aria-label="Wireframe of Game store dashboard" tabindex="0"');
    expect(html).toContain("Scope: one wild page");
  });
});

describe("build prompt and direction", () => {
  it("mention the Frankenstein pages and link FRANKENSTEIN.md when there are any", () => {
    for (const name of ["BUILD-PROMPT.md", "DIRECTION.md"]) {
      const md = file(name).content;
      expect(md, name).toContain("Frankenstein pages");
      expect(md, name).toContain("`design/explorations/frosted-checkout/FRANKENSTEIN.md`");
      expect(md, name).toContain("Game store dashboard: nav, sidebar + table (parts from dribbble.com).");
      expect(file(name, checkoutCanvas).content, name).not.toContain("Frankenstein");
    }
  });
});

describe("export_kit tool", () => {
  async function seeded(plan?: "pro_monthly") {
    const { deps, repos } = makeDeps(plan ? { plans: { [ALICE]: plan } } : {});
    const c = await seedCanvas(repos, ALICE, { ...state(), parts: library() } as CanvasState, "Pocket ledger");
    await createStitchPageTool(deps)({ canvasId: c.id, recipe: ["nav", "hero", "footer"], variants: 2 }, ALICE);
    return { deps, canvasId: c.id };
  }

  it("gives stitch_md on Free and asks for Pro for wireframe_html with the upgrade link", async () => {
    const { deps, canvasId } = await seeded();
    const res = await createExportKitTool(deps)({ canvasId, formats: ["stitch_md", "wireframe_html"] }, ALICE);
    const out = res.structuredContent as { files: { path: string; content: string }[]; blocked: string[] };
    expect(out.files.map((f) => f.path)).toEqual(["design/explorations/pocket-ledger/FRANKENSTEIN.md"]);
    expect(out.files[0]!.content).toContain("## 2. Frankenstein page 2");
    expect(out.blocked).toEqual(["wireframe_html"]);
    expect(text(res)).toContain("These formats need Pro: wireframe_html. Upgrade: https://app.example.test/en/pricing");
    const only = await createExportKitTool(deps)({ canvasId, formats: ["wireframe_html"] }, ALICE);
    expect(only.isError).toBe(true);
    expect(text(only)).toContain("/en/pricing");
  });

  it("gives Pro the wireframe", async () => {
    const { deps, canvasId } = await seeded("pro_monthly");
    const res = await createExportKitTool(deps)({ canvasId, formats: ["wireframe_html"] }, ALICE);
    const out = res.structuredContent as { files: { path: string; content: string }[] };
    expect(out.files[0]!.path).toBe("design/explorations/pocket-ledger/frankenstein-wireframe.html");
    expect(out.files[0]!.content).toContain("https://dribbble.com/shots/");
  });
});
