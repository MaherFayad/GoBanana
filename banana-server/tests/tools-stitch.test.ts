/** cut_parts, frankenstein_page, remix_frankenstein, update_frankenstein and the get_canvas parts and pages, with in-memory repos. */
import { describe, expect, it } from "vitest";
import type { CanvasState, StoredNode } from "@/canvas/types";
import { createAddToCanvasTool } from "@/lib/mcp/tools/add_to_canvas";
import { createCutPartsTool, MAX_CUTS, TOOL_DESCRIPTION as CUT_DESC } from "@/lib/mcp/tools/cut_parts";
import { createGetCanvasTool, type GetCanvasOutput } from "@/lib/mcp/tools/get_canvas";
import { createRemixStitchTool, TOOL_DESCRIPTION as REMIX_DESC } from "@/lib/mcp/tools/remix_frankenstein";
import { createStitchPageTool, TOOL_DESCRIPTION as STITCH_DESC, type StitchPageOutput } from "@/lib/mcp/tools/frankenstein_page";
import { STITCH_SECTION_TITLE } from "@/lib/mcp/tools/stitch-shared";
import { createUpdateStitchTool, TOOL_DESCRIPTION as UPDATE_DESC } from "@/lib/mcp/tools/update_frankenstein";
import { MAX_PARTS, type Part } from "@/lib/stitch/types";
import { library, part } from "./stitch-fixtures";
import { ALICE, APP, BOB, imageNode, makeDeps, ref, seedCanvas, state, text } from "./tools-fixtures";

type Repos = ReturnType<typeof makeDeps>["repos"];
const stored = async (repos: Repos, id: string) => (await repos.canvases.getOwned(ALICE, id))!.state as CanvasState;
const stitches = (s: CanvasState) => s.nodes.filter((n): n is Extract<StoredNode, { type: "stitch" }> => n.type === "stitch");

async function withParts(parts: Part[] = library(), nodes: StoredNode[] = []) {
  const { deps, repos } = makeDeps();
  const c = await seedCanvas(repos, ALICE, { ...state(nodes), parts } as CanvasState);
  return { deps, repos, id: c.id };
}

describe("tool copy", () => {
  it("is short, plain and says Frankenstein", () => {
    for (const d of [CUT_DESC, STITCH_DESC, REMIX_DESC, UPDATE_DESC]) {
      expect(d).not.toMatch(/[—–]/);
      expect(d.length).toBeLessThan(400);
      expect(d).toContain("Frankenstein");
    }
    expect(CUT_DESC).toContain("Look first: look { itemId }");
    expect(CUT_DESC).toContain("Never download images");
  });
});

describe("cut_parts", () => {
  it("cuts parts from board images and search results, with source links and guessed crops", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_1", 1)], [{ ...ref(2), thumbUrl: ref(2).thumbUrl }]));
    await repos.references.insertMany(c.id, [ref(3, { width: 1440, height: 6000 })]);
    const res = await createCutPartsTool(deps)(
      {
        canvasId: c.id,
        cuts: [
          { itemId: "img_1", role: "nav", crop: { x: 0, y: 0, w: 1, h: 0.1 }, theme: "dark", note: "pill nav" },
          { referenceId: ref(2).id, role: "hero" },
          { referenceId: ref(3).id, role: "hero" },
        ],
      },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    const parts = (await stored(repos, c.id)).parts!;
    expect(parts.map((p) => [p.id, p.role, p.guessedCrop ?? false])).toEqual([
      ["pt-1", "nav", false],
      ["pt-2", "hero", true],
      ["pt-3", "hero", true],
    ]);
    expect(parts[0]).toMatchObject({ imageUrl: ref(1).imageUrl, sourceUrl: ref(1).sourceUrl, sourceSite: "pinterest.com", theme: "dark", note: "pill nav", fromItemId: "img_1", imageWidth: 400 });
    expect(parts[1]).toMatchObject({ fromReferenceId: ref(2).id, crop: { x: 0, y: 0.08, w: 1, h: 0.35 } });
    // A tall full page shot gets the narrower hero band.
    expect(parts[2]!.crop).toEqual({ x: 0, y: 0.04, w: 1, h: 0.15 });
    const t = text(res);
    expect(t).toContain("Cut 3 parts for Frankenstein pages");
    expect(t).toContain(`pt-2: hero from pinterest.com ${ref(2).sourceUrl}, crop x 0% y 8% w 100% h 35% (guessed crop)`);
    expect(t).toContain("adjust each one in the canvas crop editor");
    expect(t).toContain("Do not download the images");
    expect(res.structuredContent).toMatchObject({ libraryCount: 3, webUrl: `${APP}/c/${c.id}` });
    // Free: no search quota used, no canvas items added.
    expect((await stored(repos, c.id)).nodes).toHaveLength(1);
  });

  it("is all or nothing", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_1", 1)]));
    const res = await createCutPartsTool(deps)({ canvasId: c.id, cuts: [{ itemId: "img_1", role: "nav" }, { itemId: "nope", role: "hero" }, { referenceId: "ref_x", role: "cta" }] }, ALICE);
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("Cut 2: item nope is not an image on this canvas.");
    expect(text(res)).toContain("Cut 3: reference ref_x was not found");
    expect((await stored(repos, c.id)).parts).toBeUndefined();
  });

  it("refuses bad input, blocked images, a full library and other users' canvases", async () => {
    const { deps, repos } = makeDeps({ takedowns: ["pinterest.com/pin/1/"] });
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_1", 1)]));
    const cut = createCutPartsTool(deps);
    expect(text(await cut({ canvasId: c.id, cuts: [{ itemId: "img_1", referenceId: "x", role: "nav" }] }, ALICE))).toContain("itemId or referenceId");
    expect(text(await cut({ canvasId: c.id, cuts: [{ itemId: "img_1", role: "banner" }] }, ALICE))).toContain("role is one of");
    expect((await cut({ canvasId: c.id, cuts: Array.from({ length: MAX_CUTS + 1 }, () => ({ itemId: "img_1", role: "nav" })) }, ALICE)).isError).toBe(true);
    expect(text(await cut({ canvasId: c.id, cuts: [{ itemId: "img_1", role: "nav" }] }, BOB))).toContain("not found");
    const full = await withParts(Array.from({ length: MAX_PARTS }, (_, i) => part(`pt-${i}`, "cards", i)), [imageNode("img_1", 1)]);
    const res = await createCutPartsTool(full.deps)({ canvasId: full.id, cuts: [{ itemId: "img_1", role: "nav" }] }, ALICE);
    expect(text(res)).toContain(`holds up to ${MAX_PARTS} parts`);
  });
});

describe("Mobbin screens as part sources", () => {
  it("cuts parts from a placed Mobbin screen and stacks them with search parts, keeping the Mobbin link", async () => {
    const { deps, repos } = makeDeps();
    const c = await repos.canvases.create({ userId: ALICE, title: "Board", brief: "mobile flight checkout", state: state([imageNode("pin_1", 1)]) });
    const screen = {
      type: "screen",
      imageUrl: "https://mobbin.com/api/mcp/short/X5xl09N3",
      sourceUrl: "https://mobbin.com/screens/469375d4-5ee8-450a-80ca-30582b5e7b38",
      app: "Shop",
      platform: "ios",
    };
    const added = await createAddToCanvasTool(deps)({ canvasId: c.id, items: [screen] }, ALICE);
    const screenId = (added.structuredContent as { items: { id: string }[] }).items[0]!.id;
    const cut = await createCutPartsTool(deps)(
      { canvasId: c.id, cuts: [{ itemId: "pin_1", role: "hero" }, { itemId: screenId, role: "cta", note: "real pay bar" }] },
      ALICE,
    );
    expect(cut.isError).toBeFalsy();
    const parts = (await stored(repos, c.id)).parts!;
    const pay = parts.find((p) => p.fromItemId === screenId)!;
    const hero = parts.find((p) => p.fromItemId === "pin_1")!;
    expect(pay).toMatchObject({ imageUrl: screen.imageUrl, sourceUrl: screen.sourceUrl, sourceSite: "mobbin.com", title: "Shop", fromItemId: screenId, guessedCrop: true });
    // One screen, not a presentation of phones: the full width pay band, not the middle phone column.
    expect(pay.crop).toEqual({ x: 0.06, y: 0.8, w: 0.88, h: 0.1 });
    expect(text(cut)).toContain(`cta from mobbin.com ${screen.sourceUrl}`);

    const page = await createStitchPageTool(deps)({ canvasId: c.id, rows: [{ slots: [{ partId: hero.id }] }, { slots: [{ partId: pay.id }] }], title: "Wild hero, real pay bar" }, ALICE);
    expect(page.isError).toBeFalsy();
    const slots = (page.structuredContent as StitchPageOutput).stitches[0]!.skeleton.flatMap((r) => r.slots);
    expect(slots[1]).toMatchObject({ role: "cta", sourceSite: "mobbin.com", sourceUrl: screen.sourceUrl });
  });
});

describe("frankenstein_page", () => {
  it("fills a recipe into distinct variants side by side in the Frankenstein pages section", async () => {
    const { deps, repos, id } = await withParts();
    const run = createStitchPageTool(deps);
    const res = await run({ canvasId: id, recipe: ["nav", "hero", "cards", "footer"], variants: 3, title: "Idea", note: "mix it" }, ALICE);
    expect(res.isError).toBeFalsy();
    const out = res.structuredContent as StitchPageOutput;
    expect(out.stitches.map((s) => s.id)).toEqual(["st-2", "st-3", "st-4"]);
    expect(out.stitches[0]!.skeleton[0]).toMatchObject({ rowId: "rw-1", slots: [{ slotId: "sl-1", role: "nav", sourceSite: "dribbble.com", sourceUrl: expect.stringMatching(/^https:\/\/dribbble\.com\/shots\/\d$/), sourceTitle: expect.any(String) }] });
    const s = await stored(repos, id);
    const section = s.nodes.find((n) => n.type === "section")!;
    expect(section.type === "section" && section.data.title).toBe(STITCH_SECTION_TITLE);
    const frames = stitches(s);
    expect(frames.map((f) => f.parentId)).toEqual([section.id, section.id, section.id]);
    expect(new Set(frames.map((f) => f.y)).size).toBe(1);
    expect(frames[1]!.x).toBeGreaterThan(frames[0]!.x + frames[0]!.w - 1);
    expect(frames.every((f) => f.w === 720 && f.data.note === "mix it" && f.data.mode === "collage")).toBe(true);
    const t = text(res);
    expect(t).toContain(`Made 3 Frankenstein pages in the "${STITCH_SECTION_TITLE}" section`);
    expect(t).toContain("1. row rw-1: nav (slot sl-1, part pt-nav");
    expect(t).toContain("Web link:");

    // Same call, same pages; the section is reused.
    const again = (await run({ canvasId: id, recipe: ["nav", "hero", "cards", "footer"], variants: 3, title: "Idea", note: "mix it" }, ALICE)).structuredContent as StitchPageOutput;
    expect(again.sectionId).toBe(out.sectionId);
    expect(again.stitches.map((x) => x.skeleton)).toEqual(out.stitches.map((x) => x.skeleton));
  });

  it("builds explicit rows with crops, widths, platform and mode", async () => {
    const { deps, repos, id } = await withParts([...library(), part("pt-side", "sidebar", 4)]);
    const res = await createStitchPageTool(deps)(
      {
        canvasId: id,
        platform: "webapp",
        mode: "wireframe",
        rows: [{ slots: [{ partId: "pt-nav1", note: "steal the tabs" }] }, { slots: [{ partId: "pt-side" }, { partId: "pt-cards2", crop: { x: 0, y: 0.5, w: 1, h: 0.2 } }], widths: [1, 4] }],
      },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    const [frame] = stitches(await stored(repos, id));
    expect(frame!.data).toMatchObject({
      title: "Frankenstein page",
      platform: "webapp",
      mode: "wireframe",
      rows: [
        { id: "rw-1", slots: [{ id: "sl-1", role: "nav", partId: "pt-nav1", note: "steal the tabs" }] },
        { id: "rw-2", widths: [1, 4], slots: [{ id: "sl-2", role: "sidebar" }, { id: "sl-3", role: "cards", crop: { x: 0, y: 0.5, w: 1, h: 0.2 } }] },
      ],
    });
  });

  it("refuses unknown parts, both or neither of rows and recipe, and an empty library", async () => {
    const { deps, repos, id } = await withParts();
    const run = createStitchPageTool(deps);
    const res = await run({ canvasId: id, rows: [{ slots: [{ partId: "pt-nav1" }, { partId: "pt-nope" }] }] }, ALICE);
    expect(text(res)).toBe("These parts are not in the library: pt-nope. Call get_canvas to see part ids. Nothing was made.");
    expect(stitches(await stored(repos, id))).toHaveLength(0);
    expect(text(await run({ canvasId: id }, ALICE))).toContain("either rows");
    expect(text(await run({ canvasId: id, recipe: ["nav"], rows: [{ slots: [{ partId: "pt-nav1" }] }] }, ALICE))).toContain("either rows");
    expect(text(await run({ canvasId: id, recipe: ["nav"], directionId: "d-x" }, ALICE))).toContain("no direction with that id");
    const empty = await withParts([]);
    expect(text(await createStitchPageTool(empty.deps)({ canvasId: empty.id, recipe: ["nav"] }, ALICE))).toContain("parts library is empty");
  });

  it("respects the plan item cap, all or nothing", async () => {
    const nodes = Array.from({ length: 38 }, (_, i) => imageNode(`img_${i}`, i));
    const { deps, repos, id } = await withParts(library(), nodes);
    // 38 items + a new section + 2 frames = 41 > 40 on Free.
    const res = await createStitchPageTool(deps)({ canvasId: id, recipe: ["nav", "hero"], variants: 2 }, ALICE);
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("/en/pricing");
    expect((await stored(repos, id)).nodes).toHaveLength(38);
    expect((await createStitchPageTool(deps)({ canvasId: id, recipe: ["nav", "hero"], variants: 1 }, ALICE)).isError).toBeFalsy();
  });
});

describe("remix_frankenstein", () => {
  async function seeded() {
    const ctx = await withParts();
    const made = (await createStitchPageTool(ctx.deps)({ canvasId: ctx.id, recipe: ["nav", "hero", "cards", "footer"], title: "Base" }, ALICE)).structuredContent as StitchPageOutput;
    return { ...ctx, base: made.stitches[0]! };
  }

  it("places new variants right of the original, keeping locked slots", async () => {
    const { deps, repos, id, base } = await seeded();
    const res = await createRemixStitchTool(deps)({ canvasId: id, stitchId: base.id, count: 2, lock: ["nav"] }, ALICE);
    expect(res.isError).toBeFalsy();
    const frames = stitches(await stored(repos, id));
    const orig = frames.find((f) => f.id === base.id)!;
    const variants = frames.filter((f) => f.data.variantOf === base.id);
    expect(variants.map((v) => [v.data.title, v.data.variant])).toEqual([
      ["Base, remix 1", 1],
      ["Base, remix 2", 2],
    ]);
    for (const v of variants) {
      expect(v.y).toBe(orig.y);
      expect(v.x).toBeGreaterThan(orig.x);
      expect(v.parentId).toBe(orig.parentId);
      expect(v.data.rows[0]!.slots[0]!.partId).toBe(orig.data.rows[0]!.slots[0]!.partId);
    }
    expect(text(res)).toContain(`Made 2 variants of Frankenstein page ${base.id}`);
    // A second call avoids what is on the board now, so it adds new combinations.
    const more = await createRemixStitchTool(deps)({ canvasId: id, stitchId: base.id, count: 2, lock: ["nav"] }, ALICE);
    expect(more.isError).toBeFalsy();
    const keys = stitches(await stored(repos, id)).map((f) => JSON.stringify(f.data.rows.map((r) => r.slots.map((s) => s.partId))));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("varies only the named roles", async () => {
    const { deps, repos, id, base } = await seeded();
    await createRemixStitchTool(deps)({ canvasId: id, stitchId: base.id, count: 1, vary: ["hero"] }, ALICE);
    const frames = stitches(await stored(repos, id));
    const [orig, v] = [frames.find((f) => f.id === base.id)!, frames.find((f) => f.data.variantOf === base.id)!];
    const ids = (f: typeof orig) => f.data.rows.map((r) => r.slots[0]!.partId);
    expect(ids(v).filter((p, i) => p !== ids(orig)[i])).toEqual([ids(v)[1]]);
  });

  it("says so for a missing page or when nothing can change", async () => {
    const { deps, id, base } = await seeded();
    const run = createRemixStitchTool(deps);
    expect(text(await run({ canvasId: id, stitchId: "st-nope", count: 1 }, ALICE))).toContain("Frankenstein page was not found");
    expect(text(await run({ canvasId: id, stitchId: base.id, count: 1, lock: ["nav", "hero", "cards", "footer"] }, ALICE))).toContain("Nothing to remix");
    expect((await run({ canvasId: id, stitchId: base.id, count: 7 }, ALICE)).isError).toBe(true);
  });
});

describe("update_frankenstein", () => {
  async function seeded() {
    const ctx = await withParts([...library(), part("pt-side", "sidebar", 4)]);
    const made = (await createStitchPageTool(ctx.deps)({ canvasId: ctx.id, rows: [{ slots: [{ partId: "pt-nav1" }] }, { slots: [{ partId: "pt-hero2" }] }] }, ALICE))
      .structuredContent as StitchPageOutput;
    return { ...ctx, stitchId: made.stitches[0]!.id };
  }
  const frame = async (repos: Repos, id: string, stitchId: string) => stitches(await stored(repos, id)).find((f) => f.id === stitchId)!;

  it("applies every op in order and resizes the frame", async () => {
    const { deps, repos, id, stitchId } = await seeded();
    const before = await frame(repos, id, stitchId);
    const res = await createUpdateStitchTool(deps)(
      {
        canvasId: id,
        stitchId,
        ops: [
          { op: "insert", index: 1, slots: [{ partId: "pt-side" }, { partId: "pt-cards1" }], widths: [1, 4] },
          { op: "swap", slotId: "sl-2", partId: "pt-hero3" },
          { op: "move", slotId: "sl-1", rowId: "rw-1", index: 0 },
          { op: "moveRow", rowId: "rw-2", index: 0 },
          { op: "crop", slotId: "sl-1", crop: { x: 0, y: 0, w: 1, h: 0.3 } },
          { op: "widths", rowId: "rw-3", widths: [1, 3] },
          { op: "mode", mode: "even" },
          { op: "note", slotId: "sl-1", note: "tabs" },
          { op: "note", note: "the idea" },
          { op: "title", title: "Renamed" },
        ],
      },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    const after = await frame(repos, id, stitchId);
    // "even" is the legacy alias of harmonize: accepted, saved as harmonize.
    expect(after.data).toMatchObject({ title: "Renamed", mode: "harmonize", note: "the idea" });
    // Insert put rw-3 between rw-1 and rw-2; moveRow then took rw-2 to the top.
    expect(after.data.rows.map((r) => r.id)).toEqual(["rw-2", "rw-1", "rw-3"]);
    expect(after.data.rows[2]!.widths).toEqual([1, 3]);
    expect(after.data.rows[0]!.slots[0]).toMatchObject({ id: "sl-2", partId: "pt-hero3" });
    expect(after.h).toBeGreaterThan(before.h);
    expect(text(res)).toContain(`Applied 10 changes to Frankenstein page ${stitchId}`);
  });

  it("accepts the older field names", async () => {
    const { deps, repos, id, stitchId } = await seeded();
    const res = await createUpdateStitchTool(deps)({ canvasId: id, stitchId, ops: [{ op: "moveRow", rowId: "rw-2", toIndex: 0 }, { op: "title", text: "Old style" }] }, ALICE);
    expect(res.isError).toBeFalsy();
    expect((await frame(repos, id, stitchId)).data).toMatchObject({ title: "Old style", rows: [{ id: "rw-2" }, { id: "rw-1" }] });
  });

  it("changes nothing when one op fails", async () => {
    const { deps, repos, id, stitchId } = await seeded();
    const before = await frame(repos, id, stitchId);
    const res = await createUpdateStitchTool(deps)({ canvasId: id, stitchId, ops: [{ op: "title", title: "X" }, { op: "remove", rowId: "rw-9" }] }, ALICE);
    expect(text(res)).toBe("Op 2 (remove): row rw-9 is not in this page. Nothing was changed.");
    expect(await frame(repos, id, stitchId)).toEqual(before);
    expect(text(await createUpdateStitchTool(deps)({ canvasId: id, stitchId: "st-x", ops: [{ op: "mode", mode: "even" }] }, ALICE))).toContain("was not found");
    expect(text(await createUpdateStitchTool(deps)({ canvasId: id, stitchId, ops: [{ op: "explode" }] }, ALICE))).toContain("ops is a list");
    expect((await createUpdateStitchTool(deps)({ canvasId: id, stitchId, ops: [] }, ALICE)).isError).toBe(true);
  });
});

describe("get_canvas", () => {
  it("lists the parts library by role and the Frankenstein pages with skeletons", async () => {
    const { deps, id } = await withParts([part("pt-a", "nav", 1, { guessedCrop: true, note: "pill" }), part("pt-b", "hero", 2), part("pt-c", "nav", 3)]);
    await createStitchPageTool(deps)({ canvasId: id, rows: [{ slots: [{ partId: "pt-a" }] }, { slots: [{ partId: "pt-b" }] }], title: "Page one", note: "idea" }, ALICE);
    const res = await createGetCanvasTool(deps)({ canvasId: id }, ALICE);
    const out = res.structuredContent as GetCanvasOutput;
    expect(out.parts.map((g) => [g.role, g.parts.map((p) => p.id)])).toEqual([
      ["nav", ["pt-a", "pt-c"]],
      ["hero", ["pt-b"]],
    ]);
    expect(out.parts[0]!.parts[0]).toMatchObject({ guessed: true, note: "pill", sourceUrl: "https://dribbble.com/shots/1" });
    expect(out.stitches).toEqual([
      expect.objectContaining({ title: "Page one", platform: "website", mode: "collage", note: "idea", skeleton: expect.any(Array) }),
    ]);
    expect("parts" in out.canvas).toBe(false);
    const t = text(res);
    expect(t).toContain("Parts library (3):");
    expect(t).toContain("    - pt-a from dribbble.com https://dribbble.com/shots/1 (guessed crop) note: pill");
    expect(t).toContain("Frankenstein pages (1):");
    expect(t).toContain('    1. row rw-1: nav (slot sl-1, part pt-a) from "Shot 1" on dribbble.com https://dribbble.com/shots/1 note: pill');
  });
});
