/**
 * Field report fixes: reconcile_direction (P2), per direction export with named fonts (P3),
 * Frankenstein part notes (P4), get_canvas summary and the export_kit inline cap (P9), and the
 * nudges that make agents use them.
 */
import { describe, expect, it, vi } from "vitest";
import type { StoredNode } from "@/canvas/types";
import type { CanvasSnapshot, StitchSnapshot } from "@/lib/canvas/types";
import { TYPE_VOICES, type VisualSpec } from "@/lib/direction-detail";
import { buildKitModel, exportKit } from "@/lib/export";
import { defaultPairing } from "@/lib/export/model";
import { voiceFonts, voiceFontsUrl } from "@/lib/kit/voice-fonts";
import { createAddToCanvasTool } from "@/lib/mcp/tools/add_to_canvas";
import { createExportKitTool, INLINE_CAP } from "@/lib/mcp/tools/export_kit";
import { createGetCanvasTool, TOOL_DESCRIPTION as GET_DESC } from "@/lib/mcp/tools/get_canvas";
import { createRateReferencesTool } from "@/lib/mcp/tools/rate_references";
import { createReconcileDirectionTool, TOOL_DESCRIPTION as RECONCILE_DESC } from "@/lib/mcp/tools/reconcile_direction";
import { cropColors, extractPalette } from "@/lib/palette";
import type { FetchLike } from "@/lib/palette/fetch";
import { harmonizeFromPalette } from "@/lib/stitch/harmonize";
import { findConflicts, isStale, itemsKey, moodLine, reconcileHint, reconcilePairs } from "@/lib/reconcile";
import { bandsRgba, encodePng, hexToRgba } from "./fixtures/palette-images";
import { ALICE, imageNode, makeDeps, ref, sectionNode, seedCanvas, state, text } from "./tools-fixtures";

const band = (a: string, b: string) => encodePng(bandsRgba([[hexToRgba(a), 32], [hexToRgba(b), 32]], 32));
const CREAM_RED = band("#f6efe3", "#d62828");
const NAVY_TEAL = band("#0b1d3a", "#2ec4b6");

const spec = (over: Partial<VisualSpec> = {}): VisualSpec => ({
  typography: "Huge condensed numerals",
  typeVoice: "condensed",
  color: "Dark midnight base with a purple glow",
  layout: "One column",
  imagery: "Photo",
  motion: "None",
  texture: "Muted and soft",
  iconography: "Line icons",
  density: "Airy",
  signature: "Boarding pass total",
  pattern: "Sticky pay bar",
  steal: [],
  avoid: [],
  styleWords: [],
  whyItFits: "Travel",
  ...over,
});

/** Thumbnails served by the fake fetch: images 1 to 3 cream and red, 4 to 6 navy and teal. */
function fetchStub() {
  return vi.fn<FetchLike>(async (url) => {
    const n = Number(/\/(\d+)\.png$/.exec(url)?.[1] ?? 0);
    const bytes = n >= 1 && n <= 3 ? CREAM_RED : n >= 4 && n <= 6 ? NAVY_TEAL : null;
    return bytes ? new Response(new Uint8Array(bytes), { headers: { "content-type": "image/png" } }) : new Response("no", { status: 404 });
  });
}

function boardNodes(): StoredNode[] {
  return [
    sectionNode("s1", { title: "Boarding pass", directionId: "b1" }),
    imageNode("a1", 1, { parentId: "s1" }),
    imageNode("a2", 2, { parentId: "s1" }),
    imageNode("a3", 3, { parentId: "s1" }),
    sectionNode("s2", { title: "Night ledger", directionId: "b2", y: 600 }),
    imageNode("b4", 4, { parentId: "s2" }),
    imageNode("b5", 5, { parentId: "s2" }),
    imageNode("b6", 6, { parentId: "s2" }),
  ];
}

async function board(opts: { second?: boolean; nodes?: StoredNode[] } = {}) {
  const { deps, repos } = makeDeps({ plans: { [ALICE]: "founding" } });
  const c = await seedCanvas(repos, ALICE, state(opts.nodes ?? boardNodes()), "Flight checkout");
  await repos.directions.upsertMany(c.id, [
    { bendId: "b1", move: "transplant", title: "Boarding pass checkout", searchQuery: "boarding pass", detail: { platform: "mobile", spec: spec(), verdict: "keep" } },
    { bendId: "b2", move: "era", title: "Night ledger", searchQuery: "ledger", detail: { platform: "mobile", spec: spec({ typeVoice: "serif-classic", color: "Navy base with teal" }), verdict: opts.second ? "keep" : "drop" } },
  ]);
  const fetchImpl = fetchStub();
  return { deps: { ...deps, fetchImpl }, repos, canvasId: c.id, fetchImpl };
}

type ExportOut = {
  files: { name: string; path: string; content: string; inline: boolean; size: number }[];
  directions?: { directionId: string; dir: string; paths: string[] }[];
  reconciled: string[];
};

describe("lib/reconcile", () => {
  it("fingerprints placed images and great ratings, so add, remove and rate make it stale", () => {
    const a = itemsKey([{ id: "x" }, { id: "y" }], new Set());
    expect(itemsKey([{ id: "y" }, { id: "x" }], new Set())).toBe(a);
    expect(itemsKey([{ id: "x" }], new Set())).not.toBe(a);
    expect(itemsKey([{ id: "x" }, { id: "y" }], new Set(["x"]))).not.toBe(a);
    expect(isStale(null, a)).toBe(true);
    const reconciled = { at: "", itemsKey: a, palette: [], contrast: [], mood: "", images: 0, great: 0 };
    expect(isStale({ reconciled }, a)).toBe(false);
  });

  it("tags pairs ship at 4.5:1 for text or 3:1 for UI parts", () => {
    const [ui, none, txt] = reconcilePairs([
      { fg: "#ffffff", bg: "#e05d00", ratio: 0, passesText: false, passesUi: false, tag: "explore" },
      { fg: "#ffffff", bg: "#dddddd", ratio: 0, passesText: false, passesUi: false, tag: "explore" },
      { fg: "#000000", bg: "#ffffff", ratio: 0, passesText: false, passesUi: false, tag: "explore" },
    ]);
    expect(ui).toMatchObject({ passesText: false, passesUi: true, tag: "ship" });
    expect(none!.tag).toBe("explore");
    expect(txt).toMatchObject({ passesText: true, tag: "ship" });
  });

  it("names conflicts between the spec and the board in plain lines", () => {
    const palette = [
      { hex: "#f6efe3", oklch: "", role: "surface" },
      { hex: "#d62828", oklch: "", role: "primary" },
    ];
    const conflicts = findConflicts(spec(), palette, { voiceFonts: "Anton", sample: "Fraunces and Work Sans" });
    expect(conflicts.map((c) => c.axis).sort()).toEqual(["color", "color", "mood", "typography"]);
    expect(conflicts.find((c) => c.board.includes("light"))!.board).toContain("#f6efe3");
    expect(conflicts.some((c) => c.board.includes("No purple"))).toBe(true);
    expect(moodLine(palette)).toMatch(/^light, warm, with a loud, saturated accent \(red\)\.$/);
    expect(findConflicts(spec({ color: "Cream paper with a red stamp", texture: "Grain" }), palette, null)).toEqual([]);
    expect(reconcileHint(["A"])).toBe('Direction "A" changed: run reconcile_direction before export so the spec matches the board.');
  });
});

describe("palette weights and part crops", () => {
  it("counts a weighted image more and reads only the crop", () => {
    const red = encodePng(bandsRgba([[hexToRgba("#d62828"), 64]], 32));
    const blue = encodePng(bandsRgba([[hexToRgba("#1d4ed8"), 64]], 32));
    const surface = (weights?: number[]) => extractPalette({ images: [red, blue], weights }).palette.find((c) => c.role === "surface")!.hex;
    // Surface is the lightest or darkest color, whichever covers more: weighting blue up flips it.
    expect(surface()).toBe("#d62828");
    expect(surface([1, 3])).toBe("#1d4ed8");
    expect(cropColors(CREAM_RED, { x: 0, y: 0, w: 0.5, h: 1 })[0]).toBe("#f6efe3");
    expect(cropColors(CREAM_RED, { x: 0.5, y: 0, w: 0.5, h: 1 })[0]).toBe("#d62828");
    expect(cropColors(CREAM_RED, { x: 0, y: 0, w: 0, h: 0 })).toEqual([]);
  });
});

describe("reconcile_direction tool", () => {
  it("says when to call it", () => {
    expect(RECONCILE_DESC).toMatch(/before export_kit/);
    expect(RECONCILE_DESC).toMatch(/conflicts/);
    expect(RECONCILE_DESC.length).toBeLessThan(400);
    expect(RECONCILE_DESC).not.toMatch(/[—–]/);
  });

  it("reads the direction's images (great ones weighted), saves the palette and returns conflicts", async () => {
    const { deps, repos, canvasId, fetchImpl } = await board();
    await repos.feedback.insertMany([
      { userId: ALICE, itemKey: "pinterest:2", sourceSite: "pinterest.com", lane: null, query: null, termKey: null, arm: null, verdict: "great", reasons: [], creator: null },
    ]);
    const res = await createReconcileDirectionTool(deps)({ canvasId, directionId: "b1" }, ALICE);
    expect(res.isError).toBeFalsy();
    // Only the three images of direction b1 are fetched.
    expect(fetchImpl.mock.calls.map((c) => c[0]).sort()).toEqual([1, 2, 3].map((i) => ref(i).thumbUrl));
    const t = text(res);
    expect(t).toContain("3 of 3 placed images read (1 rated great");
    expect(t).toContain("tell the user");
    expect(t).toMatch(/the spec said "Dark midnight base with a purple glow"/);

    const row = (await repos.directions.listForCanvas(canvasId)).find((d) => d.bendId === "b1")!;
    const rec = row.detail!.reconciled!;
    expect(rec.palette.map((c) => c.hex)).toEqual(expect.arrayContaining(["#f6efe3", "#d62828"]));
    expect(rec.contrast.some((p) => p.tag === "ship")).toBe(true);
    expect(rec.great).toBe(1);
    expect(row.detail!.spec!.color).toMatch(/^From the board: base #f6efe3/);
    expect(row.detail!.verdict).toBe("keep");
    // Hex values and short lines only: no bytes saved.
    expect(JSON.stringify(row.detail)).not.toMatch(/base64|data:/);
  });

  it("gives the direction's Frankenstein pages their harmonize duotone from the new palette", async () => {
    const page = (id: string, directionId: string): StoredNode =>
      ({ id, type: "stitch", x: 0, y: 1200, w: 390, h: 800, data: { title: id, platform: "mobile", mode: "collage", rows: [], directionId } }) as StoredNode;
    const { deps, repos, canvasId } = await board({ nodes: [...boardNodes(), page("st-1", "b1"), page("st-2", "b2")] });
    await createReconcileDirectionTool(deps)({ canvasId, directionId: "b1" }, ALICE);
    const row = (await repos.directions.listForCanvas(canvasId)).find((d) => d.bendId === "b1")!;
    const expected = harmonizeFromPalette(row.detail!.reconciled!.palette);
    expect(expected).toBeDefined();
    const saved = (await repos.canvases.getOwned(ALICE, canvasId))!.state as { nodes: StoredNode[] };
    const data = (id: string) => saved.nodes.find((n) => n.id === id)!.data as { harmonize?: unknown };
    expect(data("st-1").harmonize).toEqual(expected);
    expect(data("st-2").harmonize).toBeUndefined();
  });

  it("refuses an unknown direction", async () => {
    const { deps, canvasId } = await board();
    expect(text(await createReconcileDirectionTool(deps)({ canvasId, directionId: "nope" }, ALICE))).toContain("no direction with that id");
  });
});

describe("export_kit and reconcile", () => {
  it("reconciles a changed direction first, so DESIGN.md has the board's colors and named fonts", async () => {
    const { deps, canvasId, fetchImpl } = await board();
    const exp = createExportKitTool(deps);
    const res = await exp({ canvasId, formats: ["design_md"] }, ALICE);
    const out = res.structuredContent as ExportOut;
    expect(out.reconciled).toEqual(["Boarding pass checkout"]);
    const md = out.files[0]!.content;
    expect(md).not.toMatch(/no colors (are )?tagged ship/i);
    expect(md).toContain("#f6efe3");
    expect(md).toContain("this direction's own placed images");
    for (const family of ["Anton", "Work Sans", "Lalezar", "Vazirmatn"]) expect(md).toContain(family);
    expect(text(res)).toContain("Reconciled with the board first");

    // Unchanged board: no second reconcile.
    fetchImpl.mockClear();
    const again = (await exp({ canvasId, formats: ["design_md"] }, ALICE)).structuredContent as ExportOut;
    expect(again.reconciled).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never says no colors are tagged ship for a direction with 3 images, even when none can be read", async () => {
    const nodes = boardNodes().map((n) => (n.type === "image" ? ({ ...n, data: { ...n.data, thumbUrl: n.data.thumbUrl!.replace(/\d+\.png$/, "9.png") } } as StoredNode) : n));
    const { deps, canvasId } = await board({ nodes });
    const out = (await createExportKitTool(deps)({ canvasId, formats: ["design_md"] }, ALICE)).structuredContent as ExportOut;
    const md = out.files[0]!.content;
    expect(md).not.toMatch(/no colors (are )?tagged ship/i);
    expect(md).toContain("placeholders");
    expect(md).toMatch(/surface: "#ffffff"|surface: '#ffffff'|surface: "?#ffffff/);
  });

  it("exports one folder per kept direction, each with its own palette and fonts", async () => {
    const { deps, canvasId } = await board({ second: true });
    const res = await createExportKitTool(deps)({ canvasId, formats: ["design_md"] }, ALICE);
    const out = res.structuredContent as ExportOut;
    expect(out.files.every((f) => f.inline)).toBe(true);
    expect(out.directions!.map((d) => d.dir)).toEqual(["design/explorations/boarding-pass-checkout", "design/explorations/night-ledger"]);
    const design = (dir: string) => out.files.find((f) => f.path === `${dir}/DESIGN.md`)!.content;
    const one = design("design/explorations/boarding-pass-checkout");
    const two = design("design/explorations/night-ledger");
    expect(one).toContain("#d62828");
    expect(one).not.toContain("#2ec4b6");
    expect(two).toContain("#2ec4b6");
    expect(two).not.toContain("#d62828");
    expect(one).toContain("Anton");
    expect(two).toContain("Playfair Display");
    expect(two).toContain("Amiri");
    expect(text(res)).toContain("Build one direction at a time");
    expect(text(res)).toContain('"Night ledger" in design/explorations/night-ledger/');
  });

  it("caps inline output and returns one file per call with file", async () => {
    const { deps, canvasId } = await board({ second: true });
    const exp = createExportKitTool(deps);
    const formats = ["design_md", "direction_md", "build_prompt", "review", "agents_md", "claude_md", "cursor_rules", "copilot", "tokens", "tailwind", "brief", "stitch_md", "html_board", "figjam_spec"] as const;
    const res = await exp({ canvasId, formats: [...formats] }, ALICE);
    const out = res.structuredContent as ExportOut;
    const total = out.files.reduce((n, f) => n + f.size, 0);
    expect(total).toBeGreaterThan(INLINE_CAP);
    const inlineChars = res.content.slice(1).reduce((n, c) => n + c.text.length, 0);
    expect(inlineChars).toBeLessThanOrEqual(INLINE_CAP);
    const later = out.files.filter((f) => !f.inline);
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((f) => f.content === "")).toBe(true);
    expect(text(res)).toContain(`file: "${later[0]!.path}"`);

    const one = await exp({ canvasId, formats: [...formats], file: later[0]!.path }, ALICE);
    expect(one.content).toHaveLength(1);
    expect(one.content[0]!.text).toContain(`path: ${later[0]!.path}`);
    expect(one.content[0]!.text.length).toBeGreaterThan(later[0]!.size);
    expect(text(await exp({ canvasId, formats: ["brief"], file: "nope.md" }, ALICE))).toContain("No file with that path");
  });
});

describe("nudges", () => {
  it("add_to_canvas and rate_references hint at reconcile_direction once a direction has 3 images", async () => {
    const { deps, repos, canvasId } = await board({ nodes: [sectionNode("s1", { directionId: "b1" })] });
    const add = createAddToCanvasTool(deps);
    await repos.references.insertMany(canvasId, [ref(1), ref(2), ref(3)]);
    const place = (i: number) => ({ type: "reference" as const, referenceId: ref(i).id });
    const two = await add({ canvasId, sectionId: "s1", items: [place(1), place(2)] }, ALICE);
    expect(text(two)).not.toContain("reconcile_direction");
    const three = await add({ canvasId, sectionId: "s1", items: [place(3)] }, ALICE);
    expect(text(three)).toContain('Direction "Boarding pass checkout" changed: run reconcile_direction before export');

    await createReconcileDirectionTool(deps)({ canvasId, directionId: "b1" }, ALICE);
    const four = await add({ canvasId, items: [{ type: "note", text: "pay bar stays" }] }, ALICE);
    expect(text(four)).not.toContain("reconcile_direction");

    const rated = await createRateReferencesTool(deps)({ canvasId, ratings: [{ referenceId: ref(1).id, verdict: "great" }] }, ALICE);
    expect(text(rated)).toContain("run reconcile_direction");
  });

  it("get_canvas recommends summary mode and returns only ids, titles, roles, notes and directionIds", async () => {
    expect(GET_DESC).toContain("summary: true first");
    expect(GET_DESC.length).toBeLessThan(400);
    const { deps, canvasId } = await board();
    const res = await createGetCanvasTool(deps)({ canvasId, summary: true }, ALICE);
    const s = res.structuredContent as { items: Record<string, unknown>[]; directions: unknown[] };
    expect(s.directions).toHaveLength(2);
    expect(s.items.find((i) => i.id === "a1")).toEqual({ id: "a1", type: "image", directionId: "b1", title: "Pin 1", role: "ui" });
    expect(JSON.stringify(s)).not.toMatch(/pinimg|sourceUrl|"x":/);
    expect(text(res)).toContain("Items of direction b1:");
  });

  it("a large full get_canvas ends with the summary hint", async () => {
    const nodes = [sectionNode("s1", { directionId: "b1" }), ...Array.from({ length: 60 }, (_, i) => imageNode(`n${i}`, i + 10, { parentId: "s1", data: { ...imageNode("x", i + 10).data, note: "steal: ".padEnd(220, "x") } } as Partial<StoredNode>))];
    const { deps, canvasId } = await board({ nodes });
    const res = await createGetCanvasTool(deps)({ canvasId }, ALICE);
    expect(text(res)).toContain("next time call get_canvas with summary: true first");
  });
});

describe("type voices map to four named Google Fonts", () => {
  it("names Latin and Arabic display and body for every voice, never Inter, Roboto or Arial", () => {
    for (const v of TYPE_VOICES) {
      const f = voiceFonts(v);
      const families = [f.latinDisplay, f.latinBody, f.arabicDisplay, f.arabicBody].map((x) => x.family);
      expect(families.every(Boolean), v).toBe(true);
      expect(families.some((x) => /^(Inter|Roboto|Arial)$/.test(x)), v).toBe(false);
      expect(voiceFontsUrl(f)).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?family=/);
    }
    expect([defaultPairing().display.family, defaultPairing().body.family]).not.toContain("Inter");
  });
});

describe("Frankenstein part notes (FRANKENSTEIN.md and BUILD-PROMPT.md)", () => {
  const stitch: StitchSnapshot = {
    id: "st-1",
    title: "Checkout",
    platform: "mobile",
    mode: "collage",
    directionId: "b1",
    x: 0,
    y: 0,
    w: 390,
    h: 800,
    sectionId: null,
    rows: [
      {
        id: "rw-1",
        slots: [
          {
            id: "sl-1",
            role: "hero",
            partId: "pt-1",
            imageUrl: "https://cdn.dribbble.com/shot/1.png",
            thumbUrl: "https://cdn.dribbble.com/shot/1-thumb.png",
            sourceUrl: "https://dribbble.com/shots/1",
            sourceSite: "dribbble.com",
            title: "Boarding hero",
            crop: { x: 0, y: 0.1, w: 1, h: 0.25 },
            imageWidth: 800,
            imageHeight: 600,
          },
        ],
      },
      { id: "rw-2", slots: [{ id: "sl-2", role: "chart", partId: "pt-2", imageUrl: "https://cdn.dribbble.com/shot/2.png", sourceUrl: "https://dribbble.com/shots/2", sourceSite: "dribbble.com", crop: { x: 0, y: 0, w: 1, h: 1 } }] },
    ],
  };
  const snapshot: CanvasSnapshot = {
    title: "Flight",
    brief: "flight checkout on mobile",
    wildness: 3,
    directions: [
      {
        id: "b1",
        move: "transplant",
        title: "Boarding pass checkout",
        searchQuery: "boarding pass",
        detail: { verdict: "keep", reconciled: { at: "", itemsKey: "k", palette: [], contrast: [], mood: "", images: 0, great: 0, parts: { "pt-1": ["#f6efe3", "#d62828"] } } },
      },
    ],
    sections: [],
    items: [],
    palettes: [],
    stitches: [stitch],
  };

  it("describes each part: role, colors, type scale, density, RTL, hotlinked image with crop and source", () => {
    const md = exportKit(snapshot, ["stitch_md"])[0]!.content;
    expect(md).toContain("Role: hero.");
    expect(md).toContain("Main colors: #f6efe3, #d62828.");
    expect(md).toMatch(/Type scale: display \d+px, body \d+px\./);
    expect(md).toContain("Density: airy");
    expect(md).toContain("Mirrors in Arabic RTL: text and media swap sides");
    expect(md).toContain("keep numbers left to right");
    expect(md).toContain("<https://cdn.dribbble.com/shot/1-thumb.png> (hotlinked, open to look, never download it), crop x 0%, y 10%, width 100%, height 25% of the image (0, 60, 800 by 150 px of 800 by 600)");
    expect(md).toContain("Main colors: not measured yet (run reconcile_direction");
    expect(md).toContain("Source: [Boarding hero](https://dribbble.com/shots/1) (dribbble.com).");
  });

  it("BUILD-PROMPT.md opens with get_snapshot on each Frankenstein page, before any code", () => {
    const md = exportKit(snapshot, ["build_prompt"])[0]!.content;
    const steps = md.indexOf("## Before any code");
    const first = md.indexOf('1. Call get_snapshot on each Frankenstein page and look at it: "Checkout" (st-1).');
    expect(steps).toBeGreaterThan(-1);
    expect(first).toBeGreaterThan(steps);
    expect(first).toBeLessThan(md.indexOf("## Prompt"));
    expect(md).toContain("Main colors: #f6efe3, #d62828.");
    expect(md).not.toMatch(/[—–]/);
    expect(buildKitModel(snapshot).partColors.get("pt-1")).toEqual(["#f6efe3", "#d62828"]);
  });
});

