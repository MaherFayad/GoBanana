/**
 * P0-12 (owner decision D1): the inline canvas draws a Frankenstein page to one image in the
 * browser and puts it in the agent's context through MCP Apps. The drawing itself needs a real
 * browser (e2e); here: the page geometry, the text layout map, the context blocks for each
 * outcome (drawn, tainted, text only, empty), and that the renderer is only ever loaded lazily.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CanvasSnapshot } from "@/lib/canvas/types";
import type { StitchData } from "@/lib/stitch/types";
import { contextBlocks, pageContext, snapshotCall } from "@/canvas/vision/page-context";
import { coverBand, layoutMap, pageLayout } from "@/canvas/vision/page-layout";
import type { RenderOutcome } from "@/canvas/vision/render-page";
import { SHOW_IN_CHAT_HINT, stitchView } from "@/lib/vision/snapshot";
import { part } from "./stitch-fixtures";

const nav = part("pt-nav", "nav", 1, { crop: { x: 0, y: 0, w: 1, h: 0.2 }, theme: "dark", note: "steal: the pill nav" });
const side = part("pt-side", "sidebar", 2, { crop: { x: 0, y: 0, w: 0.25, h: 1 } });
const cards = part("pt-cards", "cards", 3, { crop: { x: 0, y: 0.5, w: 1, h: 0.25 } });
const parts = new Map([nav, side, cards].map((p) => [p.id, p]));
const stitch: StitchData = {
  title: "Pill nav over cards",
  platform: "website",
  mode: "collage",
  rows: [
    { id: "r1", slots: [{ id: "s1", role: "nav", partId: "pt-nav" }] },
    { id: "r2", widths: [1, 3], slots: [{ id: "s2", role: "sidebar", partId: "pt-side" }, { id: "s3", role: "cards", partId: "pt-cards" }] },
  ],
};
const aspect = () => 4 / 3;

describe("pageLayout", () => {
  it("lays rows out like the canvas: frame width, shared widths, tallest slot sets the row", () => {
    const l = pageLayout(stitch, parts, aspect);
    expect(l.width).toBe(1440);
    // nav: crop aspect (1 * 4/3) / 0.2 = 6.67, so 1440 wide is 216 tall.
    const box = (i: number) => Object.fromEntries(Object.entries(l.cells[i]!.box).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
    expect(box(0)).toEqual({ x: 0, y: 0, w: 1440, h: 216 });
    const [s2, s3] = [l.cells[1]!, l.cells[2]!];
    // Sidebar 360 wide at aspect (0.25 * 4/3) / 1 = 1/3 is 1080 tall; cards 1080 wide at 5.33 would be 202.5.
    expect(box(1)).toEqual({ x: 0, y: 216, w: 360, h: 1080 });
    expect(box(2)).toEqual({ x: 360, y: 216, w: 1080, h: 1080 });
    expect(l.height).toBeCloseTo(216 + 1080, 6);
    // The sidebar keeps its crop; the cards crop (aspect 5.33) covers its square box with a centred band.
    expect(s2.src).toEqual(side.crop);
    expect(s3.src.y).toBe(0.5);
    expect(s3.src.h).toBe(0.25);
    expect(s3.src.w).toBeCloseTo(0.1875, 6);
    expect(s3.src.x).toBeCloseTo(0.40625, 6);
  });

  it("keeps a missing part as an empty cell and an empty page at zero height", () => {
    const l = pageLayout({ platform: "mobile", rows: [{ id: "r", slots: [{ id: "s", role: "hero", partId: "gone" }] }] }, parts, aspect);
    expect(l.width).toBe(390);
    expect(l.cells[0]!.part).toBeNull();
    expect(pageLayout({ platform: "mobile", rows: [] }, parts, aspect)).toEqual({ width: 390, height: 0, cells: [] });
  });
});

describe("coverBand", () => {
  it("takes a centred band when the box is wider or taller than the crop", () => {
    const c = { x: 0, y: 0, w: 1, h: 1 };
    expect(coverBand(c, 1, 1)).toBe(c);
    expect(coverBand(c, 1, 2)).toEqual({ x: 0, y: 0.25, w: 1, h: 0.5 });
    expect(coverBand(c, 2, 1)).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 });
  });
});

describe("layoutMap", () => {
  it("names each row's parts with size, theme and source link", () => {
    const lines = layoutMap(stitch.title, stitch, pageLayout(stitch, parts, aspect));
    expect(lines[0]).toBe('Frankenstein page "Pill nav over cards" (website), 1440 x 1296 px, 2 rows top to bottom:');
    expect(lines[1]).toBe("Row 1: nav (1440 x 216 px, dark) from dribbble.com https://dribbble.com/shots/1, steal: the pill nav");
    expect(lines[2]).toMatch(/^Row 2: sidebar \(360 x 1080 px, theme unknown\) .* \| cards \(1080 x 1080 px, theme unknown\) from dribbble\.com https:\/\/dribbble\.com\/shots\/3$/);
  });
});

describe("pageContext", () => {
  const t = { canvasId: "cv_1", stitchId: "st_1", title: stitch.title };
  const map = ["Frankenstein page ...", "Row 1: nav"];
  const drawn: RenderOutcome = { ok: true, data: "iVBORw0KGgo", mimeType: "image/png", width: 1200, height: 1080, map, missing: [] };
  const tainted: RenderOutcome = { ok: false, reason: "tainted", hosts: ["i.pinimg.com"], map };

  it("sends the drawn page as an image after its layout, never anywhere else", () => {
    const { content, notice } = pageContext(t, drawn, { imagesOk: true });
    expect(content.map((b) => b.type)).toEqual(["text", "image"]);
    expect(content[0]).toMatchObject({ text: expect.stringContaining("drawn in their browser") });
    expect(content[0]).toMatchObject({ text: expect.stringContaining("Not stored anywhere") });
    expect(content[0]).toMatchObject({ text: expect.stringContaining("Row 1: nav") });
    expect(content[1]).toEqual({ type: "image", data: "iVBORw0KGgo", mimeType: "image/png" });
    expect(notice.kind).toBe("success");
  });

  it("falls back to the parts view when a host without CORS taints the canvas, and says so", () => {
    const partsView = contextBlocks([{ type: "text", text: "Row 1: nav" }, { type: "image", data: "abc", mimeType: "image/jpeg" }, { type: "resource" }]);
    const { content, notice } = pageContext(t, tainted, { imagesOk: true, partsView });
    expect(content[0]).toMatchObject({ text: expect.stringMatching(/could not be drawn as one image: parts from i\.pinimg\.com .*\(no CORS header\)/) });
    expect(content.slice(1)).toEqual(partsView);
    expect(notice).toMatchObject({ kind: "warning", title: "Sent the parts view instead" });

    const noParts = pageContext(t, tainted, { imagesOk: true, partsView: null });
    expect(noParts.content).toHaveLength(1);
    expect(noParts.content[0]).toMatchObject({ text: expect.stringContaining("Call get_snapshot with this stitchId") });
    expect(snapshotCall(t)).toEqual({ name: "get_snapshot", arguments: { canvasId: "cv_1", stitchId: "st_1" } });
  });

  it("sends a text layout when the host takes no images, and notes empty pages", () => {
    const text = pageContext(t, drawn, { imagesOk: false });
    expect(text.content.map((b) => b.type)).toEqual(["text"]);
    expect(text.content[0]).toMatchObject({ text: expect.stringContaining("does not take images") });
    expect(pageContext(t, { ok: false, reason: "empty", hosts: [], map }, { imagesOk: true }).notice.title).toBe("This page has no rows yet");
  });

  it("copy has no em dashes", () => {
    const all = [pageContext(t, drawn, { imagesOk: true }), pageContext(t, tainted, { imagesOk: false }), pageContext(t, drawn, { imagesOk: false })];
    expect(JSON.stringify(all)).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`));
  });
});

describe("get_snapshot points to Show in chat", () => {
  it("tells the agent how to get the composed page", () => {
    const c = { id: "cv_1", title: "Board", sections: [], items: [], stitches: [{ id: "st_1", ...stitch, rows: [] }] } as unknown as CanvasSnapshot;
    expect(stitchView(c, "st_1")!.head).toContain(SHOW_IN_CHAT_HINT);
  });
});

describe("the renderer stays out of the server bundle", () => {
  it("is only ever loaded with import(), and only from the inline canvas", () => {
    const root = path.resolve(__dirname, "..");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (["node_modules", ".next", ".open-next", ".wrangler", "public", "tests"].includes(e.name) || e.name.startsWith(".")) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name) && !p.endsWith(path.join("vision", "render-page.ts"))) {
          const src = fs.readFileSync(p, "utf8");
          for (const line of src.split("\n")) if (/vision\/render-page"/.test(line) && !/^\s*(import type|\/\/|\*)/.test(line)) hits.push(`${path.relative(root, p)}: ${line.trim()}`);
        }
      }
    };
    walk(root);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(/^ui[\\/]canvas[\\/]ShowPage\.tsx: .*typeof window === "undefined" \? null : \(\) => import\("@\/canvas\/vision\/render-page"\)/);
  });
});
