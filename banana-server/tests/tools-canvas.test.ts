/** open_canvas, add_to_canvas, arrange_canvas, get_canvas and export_kit with in-memory repos. */
import { describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { createAddToCanvasTool, MAX_ITEMS_PER_CALL } from "@/lib/mcp/tools/add_to_canvas";
import { createArrangeCanvasTool } from "@/lib/mcp/tools/arrange_canvas";
import { createExportKitTool } from "@/lib/mcp/tools/export_kit";
import { createGetCanvasTool } from "@/lib/mcp/tools/get_canvas";
import { CANVAS_UI_URI, createOpenCanvasTool, register as registerOpen, titleFromBrief } from "@/lib/mcp/tools/open_canvas";
import { createNewCanvasTool, register as registerNew } from "@/lib/mcp/tools/new_canvas";
import { TOOL_DESCRIPTION as ADD_DESC } from "@/lib/mcp/tools/add_to_canvas";
import { TOOL_DESCRIPTION as ARRANGE_DESC } from "@/lib/mcp/tools/arrange_canvas";
import { TOOL_DESCRIPTION as EXPORT_DESC } from "@/lib/mcp/tools/export_kit";
import { TOOL_DESCRIPTION as GET_DESC } from "@/lib/mcp/tools/get_canvas";
import { TOOL_DESCRIPTION as OPEN_DESC } from "@/lib/mcp/tools/open_canvas";
import type { CanvasState } from "@/canvas/types";
import { ALICE, APP, BOB, imageNode, makeDeps, ref, sectionNode, seedCanvas, state, text } from "./tools-fixtures";

const stored = async (repos: ReturnType<typeof makeDeps>["repos"], id: string) =>
  (await repos.canvases.getOwned(ALICE, id))!.state as CanvasState;

describe("tool copy", () => {
  it("is short and plain", () => {
    for (const d of [OPEN_DESC, ADD_DESC, ARRANGE_DESC, GET_DESC, EXPORT_DESC]) {
      expect(d).not.toMatch(/[\u2014\u2013]/);
      expect(d.length).toBeLessThan(400);
    }
  });
});

describe("open_canvas", () => {
  it("declares the inline canvas UI", () => {
    let meta: unknown;
    const fake = { registerTool: (_n: string, config: { _meta?: unknown }) => (meta = config._meta) };
    registerOpen(fake as unknown as McpServer);
    // registerAppTool (ext-apps) also writes the legacy flat key for older hosts.
    expect(meta).toEqual({ ui: { resourceUri: CANVAS_UI_URI }, "ui/resourceUri": CANVAS_UI_URI });
    expect(CANVAS_UI_URI).toBe("ui://banana/canvas");
    expect(() => registerOpen(new McpServer({ name: "t", version: "0" }))).not.toThrow();
  });

  it("creates a canvas with a web link and counts it", async () => {
    const { deps, repos } = makeDeps();
    const res = await createOpenCanvasTool(deps)({ brief: "Flight checkout screen for a budget airline" }, ALICE);
    expect(res.isError).toBeFalsy();
    const canvas = (res.structuredContent as { canvas: { id: string; title: string; webUrl: string } }).canvas;
    expect(canvas.webUrl).toBe(`${APP}/c/${canvas.id}`);
    expect(canvas.title).toBe("Flight checkout screen for a budget airline");
    expect(text(res)).toContain(canvas.webUrl);
    expect(await repos.usage.get(ALICE, "2026-10")).toEqual({ searches: 0, canvases: 1 });
  });

  it("saves taste words on a new or opened canvas", async () => {
    const { deps, repos } = makeDeps();
    const open = createOpenCanvasTool(deps);
    const res = await open({ brief: "banking app", taste: ["Dark Mode", "editorial"] }, ALICE);
    const canvas = (res.structuredContent as { canvas: { id: string; taste: string[] } }).canvas;
    expect(canvas.taste).toEqual(["dark mode", "editorial"]);
    expect((await stored(repos, canvas.id)).taste).toEqual(["dark mode", "editorial"]);
    expect(text(res)).toContain("Taste for searches: dark mode, editorial.");
    const again = await open({ canvasId: canvas.id, taste: ["luxury"] }, ALICE);
    expect((again.structuredContent as { canvas: { taste: string[] } }).canvas.taste).toEqual(["luxury"]);
    expect((await stored(repos, canvas.id)).taste).toEqual(["luxury"]);
    expect((await open({ taste: ["a", "b", "c", "d", "e", "f"] }, ALICE)).isError).toBe(true);
  });

  it("stops free users at 3 canvases with the upgrade link", async () => {
    const { deps } = makeDeps();
    const open = createOpenCanvasTool(deps);
    for (let i = 0; i < 3; i++) expect((await open({}, ALICE)).isError).toBeFalsy();
    const res = await open({ title: "Fourth" }, ALICE);
    expect(res.isError).toBe(true);
    expect(text(res)).toBe(`You have used your 3 free canvases. Upgrade for unlimited canvases: ${APP}/en/pricing`);
  });

  it("lets Pro users create more", async () => {
    const { deps } = makeDeps({ plans: { [ALICE]: "pro_monthly" } });
    const open = createOpenCanvasTool(deps);
    for (let i = 0; i < 5; i++) expect((await open({}, ALICE)).isError).toBeFalsy();
  });

  it("opens an existing canvas, updates the title, and denies other users", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE);
    const open = createOpenCanvasTool(deps);
    const res = await open({ canvasId: c.id, title: "Renamed" }, ALICE);
    expect((res.structuredContent as { created: boolean; canvas: { title: string } }).canvas.title).toBe("Renamed");
    expect((await repos.canvases.getOwned(ALICE, c.id))!.title).toBe("Renamed");
    const denied = await open({ canvasId: c.id }, BOB);
    expect(denied.isError).toBe(true);
    expect(text(denied)).toContain("not found");
  });

  it("answers plainly for bad input and signed out users", async () => {
    const { deps } = makeDeps();
    const open = createOpenCanvasTool(deps);
    expect(text(await open({ title: "x".repeat(81) }, ALICE))).toBe("title must be 1 to 80 characters.");
    expect((await open({}, undefined)).isError).toBe(true);
  });

  it("makes a short title from a long brief", () => {
    const t = titleFromBrief("A very long brief about a flight checkout screen for a budget airline that feels calm");
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.endsWith(" ")).toBe(false);
  });
});

describe("new_canvas", () => {
  it("creates a canvas without the inline UI, then open_canvas shows it", async () => {
    let meta: unknown = "unset";
    const fake = { registerTool: (_n: string, config: { _meta?: unknown }) => (meta = config._meta) };
    registerNew(fake as unknown as McpServer);
    expect(meta).toBeUndefined();

    const { deps, repos } = makeDeps();
    const res = await createNewCanvasTool(deps)({ brief: "Retail banking app", taste: ["minimal"] }, ALICE);
    expect(res.isError).toBeFalsy();
    expect(res._meta).toBeUndefined();
    const canvas = (res.structuredContent as { canvas: { id: string; webUrl: string } }).canvas;
    expect(text(res)).toContain("It is not shown yet.");
    expect((await stored(repos, canvas.id)).taste).toEqual(["minimal"]);
    expect(await repos.usage.get(ALICE, "2026-10")).toEqual({ searches: 0, canvases: 1 });

    const shown = await createOpenCanvasTool(deps)({ canvasId: canvas.id }, ALICE);
    expect((shown.structuredContent as { created: boolean }).created).toBe(false);
    expect(shown._meta).toBeDefined();
  });

  it("keeps the plan's canvas limit", async () => {
    const { deps } = makeDeps();
    const make = createNewCanvasTool(deps);
    for (let i = 0; i < 3; i++) expect((await make({ title: `Board ${i}` }, ALICE)).isError).toBeFalsy();
    const fourth = await make({ title: "Board 4" }, ALICE);
    expect(fourth.isError).toBe(true);
  });
});

describe("add_to_canvas", () => {
  it("places references, notes, swatches and sections and resolves references from the table", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE);
    await repos.references.insertMany(c.id, [ref(1)]);
    const res = await createAddToCanvasTool(deps)(
      {
        canvasId: c.id,
        items: [
          { type: "reference", referenceId: ref(1).id },
          { type: "note", text: "Love the grain" },
          { type: "swatch", hex: "#E63946", role: "accent" },
          { type: "section", title: "Era" },
        ],
      },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    const items = (res.structuredContent as { items: { type: string }[] }).items;
    expect(items.map((i) => i.type).sort()).toEqual(["image", "note", "section", "swatch"]);
    const s = await stored(repos, c.id);
    const img = s.nodes.find((n) => n.type === "image")!;
    expect(img.data).toMatchObject({ sourceUrl: ref(1).sourceUrl, imageUrl: ref(1).imageUrl });
    const sw = s.nodes.find((n) => n.type === "swatch")!;
    expect(sw.data).toMatchObject({ hex: "#e63946", role: "accent", tag: "explore" });
    expect((sw.data as { oklch: string }).oklch).toMatch(/^oklch\(/);
  });

  it("uses the tray, removes placed results from it and lands them in their direction's section", async () => {
    const { deps, repos } = makeDeps();
    const tray = [{ ...ref(1), directionId: "bd-1" }, { ...ref(2) }];
    const c = await seedCanvas(repos, ALICE, state([], tray));
    await repos.directions.upsertMany(c.id, [{ bendId: "bd-1", move: "era", title: "Checkout as a 1970s ticket", searchQuery: "q" }]);
    const res = await createAddToCanvasTool(deps)(
      { canvasId: c.id, items: [{ type: "reference", referenceId: ref(1).id }] },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    const s = await stored(repos, c.id);
    expect(s.tray.map((r) => r.id)).toEqual([ref(2).id]);
    const section = s.nodes.find((n) => n.type === "section")!;
    expect(section.data).toMatchObject({ title: "Checkout as a 1970s ticket", directionId: "bd-1" });
    expect(s.nodes.find((n) => n.type === "image")!.parentId).toBe(section.id);
  });

  it("appends below what is already in the target section", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(
      repos,
      ALICE,
      state([sectionNode("s", { x: 0, y: 0 }), imageNode("a", 1, { parentId: "s", x: 16, y: 48, w: 280, h: 210 })]),
    );
    const res = await createAddToCanvasTool(deps)(
      { canvasId: c.id, sectionId: "s", items: [{ type: "note", text: "below" }] },
      ALICE,
    );
    const placed = (res.structuredContent as { items: { y: number; sectionId: string }[] }).items[0]!;
    expect(placed).toMatchObject({ sectionId: "s", y: 48 + 210 + 16 });
  });

  it("refuses the whole batch past the free item cap", async () => {
    const { deps, repos } = makeDeps();
    const nodes = Array.from({ length: 39 }, (_, i) => imageNode(`n${i}`, i));
    const c = await seedCanvas(repos, ALICE, state(nodes));
    const add = createAddToCanvasTool(deps);
    const res = await add({ canvasId: c.id, items: [{ type: "note", text: "a" }, { type: "note", text: "b" }] }, ALICE);
    expect(res.isError).toBe(true);
    expect(text(res)).toBe(`This canvas has reached the 40 item limit on the free plan. Upgrade: ${APP}/en/pricing`);
    expect((await stored(repos, c.id)).nodes).toHaveLength(39);
    expect((await add({ canvasId: c.id, items: [{ type: "note", text: "a" }] }, ALICE)).isError).toBeFalsy();
  });

  it("lets Pro canvases go past 40 items", async () => {
    const { deps, repos } = makeDeps({ plans: { [ALICE]: "pro_yearly" } });
    const c = await seedCanvas(repos, ALICE, state(Array.from({ length: 40 }, (_, i) => imageNode(`n${i}`, i))));
    const res = await createAddToCanvasTool(deps)({ canvasId: c.id, items: [{ type: "note", text: "a" }] }, ALICE);
    expect(res.isError).toBeFalsy();
  });

  it("denies other users' canvases", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE);
    const res = await createAddToCanvasTool(deps)({ canvasId: c.id, items: [{ type: "note", text: "a" }] }, BOB);
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("not found");
    expect((await stored(repos, c.id)).nodes).toHaveLength(0);
  });

  it("skips taken down and unknown references", async () => {
    const { deps, repos } = makeDeps({ takedowns: ["https://www.pinterest.com/pin/2/"] });
    const c = await seedCanvas(repos, ALICE);
    await repos.references.insertMany(c.id, [ref(1), ref(2)]);
    const res = await createAddToCanvasTool(deps)(
      {
        canvasId: c.id,
        items: [
          { type: "reference", referenceId: ref(1).id },
          { type: "reference", referenceId: ref(2).id },
          { type: "reference", referenceId: "ref_missing" },
        ],
      },
      ALICE,
    );
    const out = res.structuredContent as { items: unknown[]; skipped: { index: number; reason: string }[] };
    expect(out.items).toHaveLength(1);
    expect(out.skipped.map((s) => s.index)).toEqual([1, 2]);
    expect(out.skipped[0]!.reason).toContain("takedown");
  });

  it("validates input with plain messages", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE);
    const add = createAddToCanvasTool(deps);
    expect(text(await add({ canvasId: c.id, items: [] }, ALICE))).toContain("items must be a list");
    const many = Array.from({ length: MAX_ITEMS_PER_CALL + 1 }, () => ({ type: "note", text: "x" }));
    expect((await add({ canvasId: c.id, items: many }, ALICE)).isError).toBe(true);
    expect(text(await add({ canvasId: c.id, sectionId: "nope", items: [{ type: "note", text: "x" }] }, ALICE))).toContain(
      "section was not found",
    );
  });
});

describe("arrange_canvas", () => {
  it("saves the new positions", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state([imageNode("a", 1, { x: 500, y: 900 }), imageNode("b", 2, { x: -40, y: 7 })]));
    const res = await createArrangeCanvasTool(deps)({ canvasId: c.id, layout: "grid" }, ALICE);
    expect(res.isError).toBeFalsy();
    const items = (res.structuredContent as { items: { id: string; x: number; y: number }[] }).items;
    expect(items).toEqual([
      { id: "a", x: 0, y: 0, w: 280, h: 280 },
      { id: "b", x: 296, y: 0, w: 280, h: 280 },
    ]);
    const s = await stored(repos, c.id);
    expect(s.nodes.map((n) => [n.id, n.x, n.y])).toEqual([
      ["a", 0, 0],
      ["b", 296, 0],
    ]);
  });

  it("refuses an unknown layout or section, and other users", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE);
    const arrange = createArrangeCanvasTool(deps);
    expect(text(await arrange({ canvasId: c.id, layout: "spiral" }, ALICE))).toContain("layout must be one of");
    expect(text(await arrange({ canvasId: c.id, layout: "grid", sectionId: "x" }, ALICE))).toContain("section was not found");
    expect((await arrange({ canvasId: c.id, layout: "grid" }, BOB)).isError).toBe(true);
  });
});

describe("get_canvas", () => {
  it("lists the user's recent canvases without a canvasId, so a new chat can extend one", async () => {
    const { deps, repos } = makeDeps();
    expect(text(await createGetCanvasTool(deps)({}, ALICE))).toContain("No canvases yet");
    const c = await seedCanvas(repos, ALICE, state([]));
    await seedCanvas(repos, BOB, state([]));
    const res = await createGetCanvasTool(deps)({}, ALICE);
    const out = res.structuredContent as { canvases: { id: string; webUrl: string }[] };
    expect(out.canvases.map((x) => x.id)).toEqual([c.id]);
    expect(out.canvases[0]!.webUrl).toBe(`${APP}/c/${c.id}`);
    expect(text(res)).toContain(`${c.id}: "`);
  });

  it("returns sections, items with source links, palettes and the brief, without taken down items", async () => {
    const { deps, repos } = makeDeps({ takedowns: ["pinterest.com/pin/2"] });
    const c = await seedCanvas(
      repos,
      ALICE,
      state([sectionNode("s", { title: "Era", directionId: "bd-1" }), imageNode("a", 1, { parentId: "s", x: 16, y: 48 }), imageNode("b", 2)]),
    );
    await repos.directions.upsertMany(c.id, [{ bendId: "bd-1", move: "era", title: "Era", searchQuery: "1970s ticket" }]);
    await repos.palettes.insert(c.id, [{ hex: "#112233", oklch: "oklch(0.2 0.03 250)", role: "primary" }], []);
    const res = await createGetCanvasTool(deps)({ canvasId: c.id }, ALICE);
    const out = res.structuredContent as { canvas: { items: { id: string }[]; sections: unknown[]; brief: string; palettes: unknown[] } };
    expect(out.canvas.items.map((i) => i.id)).toEqual(["a"]);
    expect(out.canvas.sections).toHaveLength(1);
    expect(out.canvas.brief).toBe("flight checkout screen");
    expect(out.canvas.palettes).toHaveLength(1);
    const t = text(res);
    expect(t).toContain(ref(1).sourceUrl);
    expect(t).not.toContain(ref(2).sourceUrl);
    expect(t).toContain("bd-1");
  });

  it("denies other users", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE);
    expect((await createGetCanvasTool(deps)({ canvasId: c.id }, BOB)).isError).toBe(true);
  });
});

describe("export_kit", () => {
  it("gives free users design_md and brief", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state([imageNode("a", 1)]));
    const res = await createExportKitTool(deps)({ canvasId: c.id, formats: ["design_md", "brief"] }, ALICE);
    expect(res.isError).toBeFalsy();
    const files = (res.structuredContent as { files: { name: string; content: string }[] }).files;
    expect(files.map((f) => f.name)).toEqual(["DESIGN.md", "BRIEF.md"]);
    expect(files[0]!.content).toContain(ref(1).sourceUrl);
    expect(res.content).toHaveLength(3);
  });

  it("gates Pro formats with the upgrade message", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE);
    const exp = createExportKitTool(deps);
    const blocked = await exp({ canvasId: c.id, formats: ["tokens", "tailwind"] }, ALICE);
    expect(blocked.isError).toBe(true);
    expect(text(blocked)).toBe(`These formats need Pro: tokens, tailwind. Upgrade: ${APP}/en/pricing`);
    const mixed = await exp({ canvasId: c.id, formats: ["brief", "html_board"] }, ALICE);
    const out = mixed.structuredContent as { files: { name: string }[]; blocked: string[]; note: string };
    expect(out.files.map((f) => f.name)).toEqual(["BRIEF.md"]);
    expect(out.blocked).toEqual(["html_board"]);
    expect(out.note).toContain("/en/pricing");
  });

  it("gives Pro users every format", async () => {
    const { deps, repos } = makeDeps({ plans: { [ALICE]: "founding" } });
    const c = await seedCanvas(repos, ALICE, state([imageNode("a", 1)]));
    const formats = ["design_md", "agents_md", "tokens", "tailwind", "figjam_spec", "html_board", "brief"];
    const res = await createExportKitTool(deps)({ canvasId: c.id, formats }, ALICE);
    expect((res.structuredContent as { files: unknown[] }).files).toHaveLength(7);
  });

  it("denies other users and leaves out taken down items", async () => {
    const { deps, repos } = makeDeps({ takedowns: ["pinterest.com"] });
    const c = await seedCanvas(repos, ALICE, state([imageNode("a", 1)]));
    expect((await createExportKitTool(deps)({ canvasId: c.id, formats: ["brief"] }, BOB)).isError).toBe(true);
    const res = await createExportKitTool(deps)({ canvasId: c.id, formats: ["design_md"] }, ALICE);
    expect(text(res)).not.toContain(ref(1).sourceUrl);
  });
});

describe("add_to_canvas screens (Mobbin)", () => {
  const SCREEN = {
    type: "screen",
    imageUrl: "https://mobbin.com/api/mcp/short/9N5TNmdP",
    sourceUrl: "https://mobbin.com/screens/6490283f-b69b-459c-b8e0-ef95ec4ee1bc",
    app: "Luma",
    title: "Checkout",
    platform: "ios",
    note: "steal: the full width pay bar",
  } as const;

  it("places a Mobbin screen as a hotlinked UI reference linked to its Mobbin page", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE);
    await repos.directions.upsertMany(c.id, [{ bendId: "bd-1", move: "era", title: "Checkout as a 1970s ticket", searchQuery: "q" }]);
    const res = await createAddToCanvasTool(deps)({ canvasId: c.id, items: [{ ...SCREEN, directionId: "bd-1" }] }, ALICE);
    expect(res.isError).toBeFalsy();
    const s = await stored(repos, c.id);
    const img = s.nodes.find((n) => n.type === "image")!;
    expect(img.data).toMatchObject({
      imageUrl: SCREEN.imageUrl,
      sourceUrl: SCREEN.sourceUrl,
      sourceSite: "mobbin.com",
      title: "Luma: Checkout",
      note: SCREEN.note,
      thumbUrl: null,
    });
    // UI zone (no art mark), a phone shaped tile, in the direction's section.
    expect((img.data as { zone?: string }).zone).toBeUndefined();
    expect(img.h).toBeGreaterThan(img.w);
    const section = s.nodes.find((n) => n.type === "section")!;
    expect(section.data).toMatchObject({ directionId: "bd-1" });
    expect(img.parentId).toBe(section.id);
    // Bytescale (the CDN the short link redirects to) is a Mobbin host too.
    const cdn = await createAddToCanvasTool(deps)(
      { canvasId: c.id, items: [{ type: "screen", imageUrl: "https://bytescale.mobbin.com/FW25bBB/image/x.webp?enc=1.abc", sourceUrl: SCREEN.sourceUrl }] },
      ALICE,
    );
    expect(cdn.isError).toBeFalsy();
    const titles = (await stored(repos, c.id)).nodes.flatMap((n) => (n.type === "image" ? [n.data.title] : []));
    expect(titles).toContain("Mobbin screen");
  });

  it("skips screens off mobbin.com or with unsafe links, and keeps the rest", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE);
    const bad = [
      { sourceUrl: "https://dribbble.com/shots/1" },
      { sourceUrl: "https://mobbin.com.evil.example/screens/1" },
      { sourceUrl: "http://mobbin.com/screens/1" },
      { sourceUrl: "https://mobbin.com/" },
      { sourceUrl: "https://user:pw@mobbin.com/screens/1" },
      { imageUrl: "https://evil.example/mobbin.com/x.webp" },
      { imageUrl: "https://notmobbin.com/x.webp" },
      { imageUrl: "data:image/png;base64,AAAA" },
      { imageUrl: "javascript:alert(1)" },
      { imageUrl: "https://mobbin.com:8443/x.webp" },
    ];
    const res = await createAddToCanvasTool(deps)(
      { canvasId: c.id, items: [...bad.map((b) => ({ ...SCREEN, ...b })), SCREEN] },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    const out = res.structuredContent as { items: unknown[]; skipped: { index: number; reason: string }[] };
    expect(out.items).toHaveLength(1);
    expect(out.skipped.map((s) => s.index)).toEqual(bad.map((_, i) => i));
    expect(out.skipped[0]!.reason).toContain("mobbin.com");
    // Only bad screens: nothing placed, a plain error.
    const none = await createAddToCanvasTool(deps)({ canvasId: c.id, items: [{ ...SCREEN, imageUrl: "https://evil.example/x.webp" }] }, ALICE);
    expect(none.isError).toBe(true);
    expect(text(none)).toContain("imageUrl must be");
  });

  it("refuses over long links and skips taken down screens", async () => {
    const { deps, repos } = makeDeps({ takedowns: [SCREEN.sourceUrl] });
    const c = await seedCanvas(repos, ALICE);
    const add = createAddToCanvasTool(deps);
    const long = await add({ canvasId: c.id, items: [{ ...SCREEN, imageUrl: `https://mobbin.com/${"a".repeat(2100)}` }] }, ALICE);
    expect(long.isError).toBe(true);
    expect(text(long)).toContain('{ type: "screen"');
    const res = await add({ canvasId: c.id, items: [SCREEN, { type: "note", text: "Shipped today" }] }, ALICE);
    const out = res.structuredContent as { items: { type: string }[]; skipped: { reason: string }[] };
    expect(out.items.map((i) => i.type)).toEqual(["note"]);
    expect(out.skipped[0]!.reason).toContain("takedown");
  });
});
