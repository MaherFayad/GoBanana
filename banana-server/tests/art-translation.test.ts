/**
 * V4.3 canvas side: art references carry a translation (stealAxis and becomes), sit in the
 * cluster row of what they inform, show "becomes" on the tile and in exports, and rate_references
 * takes two art only bad reasons. Old boards without becomes still load, arrange and export.
 */
import { describe, expect, it } from "vitest";
import { parseState, serializeState, stateToItems, stateToNodes } from "@/canvas/state";
import { nodeLabel } from "@/canvas/labels";
import type { CanvasFlowNode, StoredNode, TrayReference } from "@/canvas/types";
import { artTranslationMessage, clusterForAxis, STEAL_AXES } from "@/lib/canvas/art";
import { arrangeState } from "@/lib/canvas/store";
import type { CanvasSnapshot, ImageItem } from "@/lib/canvas/types";
import { exportKit } from "@/lib/export";
import { badHint } from "@/lib/learning/hints";
import { createAddToCanvasTool, TOOL_DESCRIPTION as ADD_DESC } from "@/lib/mcp/tools/add_to_canvas";
import { createGetCanvasTool } from "@/lib/mcp/tools/get_canvas";
import { createRateReferencesTool, TOOL_DESCRIPTION as RATE_DESC } from "@/lib/mcp/tools/rate_references";
import { financeCanvas } from "./export-fixtures";
import { ALICE, imageNode, makeDeps, ref, sectionNode, seedCanvas, state, text } from "./tools-fixtures";

const ART_MESSAGE_3 =
  "Item 3 is art: add stealAxis (type, color, pattern, composition, texture, motion or notation) and becomes, the UI part it turns into, up to 80 characters.";

async function setup(tray: TrayReference[] = [{ ...ref(1), zone: "art" }, { ...ref(2) }, { ...ref(3), zone: "art" }, { ...ref(4), zone: "art" }]) {
  const { deps, repos } = makeDeps();
  const c = await seedCanvas(repos, ALICE, state([], tray));
  const images = async () =>
    parseState((await repos.canvases.getOwned(ALICE, c.id))!.state).nodes.flatMap((n) => (n.type === "image" ? [n] : []));
  return { deps, repos, canvasId: c.id, add: createAddToCanvasTool(deps), images };
}

describe("add_to_canvas art translation", () => {
  it("keeps the description within the 400 character cap and plain", () => {
    expect(ADD_DESC.length).toBeLessThan(400);
    expect(ADD_DESC).toContain("stealAxis");
    expect(ADD_DESC).toContain("becomes");
    expect(ADD_DESC).not.toMatch(/[—–]/);
  });

  it("refuses an art item without becomes, naming the item, and places the rest", async () => {
    const s = await setup();
    const res = await s.add(
      {
        canvasId: s.canvasId,
        items: [
          { type: "reference", referenceId: ref(1).id, stealAxis: "color", becomes: "status colors on the agent strips" },
          { type: "reference", referenceId: ref(2).id, note: "steal: the grid" },
          { type: "reference", referenceId: ref(3).id, stealAxis: "pattern", note: "steal: the weave" },
        ],
      },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    const out = res.structuredContent as { items: unknown[]; skipped: { index: number; reason: string }[] };
    expect(out.items).toHaveLength(2);
    expect(out.skipped).toEqual([{ index: 2, reason: ART_MESSAGE_3 }]);
    expect(text(res)).toContain(`${ART_MESSAGE_3} Not placed.`);
    expect(text(res)).not.toMatch(/[—–]/);
    // The refused art result stays in the tray for another try.
    const saved = parseState((await s.repos.canvases.getOwned(ALICE, s.canvasId))!.state);
    expect(saved.tray.map((t) => t.id)).toContain(ref(3).id);
  });

  it("refuses a bad stealAxis, a missing stealAxis, an empty or too long becomes", async () => {
    const s = await setup();
    const cases: Record<string, unknown>[] = [
      { stealAxis: "vibe", becomes: "the approval gate" },
      { becomes: "the approval gate" },
      { stealAxis: "type", becomes: "   " },
      { stealAxis: "type", becomes: "x".repeat(81) },
      { stealAxis: 3, becomes: "the approval gate" },
    ];
    for (const extra of cases) {
      const res = await s.add(
        {
          canvasId: s.canvasId,
          items: [
            { type: "note", text: "one" },
            { type: "note", text: "two" },
            { type: "reference", referenceId: ref(4).id, ...extra },
          ],
        },
        ALICE,
      );
      const out = res.structuredContent as { skipped: { index: number; reason: string }[] };
      expect(out.skipped, JSON.stringify(extra)).toEqual([{ index: 2, reason: ART_MESSAGE_3 }]);
    }
    // Only the art item in a call: the whole call is refused with the plain message.
    const only = await s.add({ canvasId: s.canvasId, items: [{ type: "reference", referenceId: ref(4).id }] }, ALICE);
    expect(only.isError).toBe(true);
    expect(text(only)).toBe(artTranslationMessage(1));
    expect(text(only)).toBe(
      "Item 1 is art: add stealAxis (type, color, pattern, composition, texture, motion or notation) and becomes, the UI part it turns into, up to 80 characters.",
    );
  });

  it("stores stealAxis and becomes (trimmed) and get_canvas returns them", async () => {
    const s = await setup();
    const res = await s.add(
      {
        canvasId: s.canvasId,
        items: [{ type: "reference", referenceId: ref(1).id, stealAxis: "notation", becomes: "  the approval gate: one strip per agent, color by state  ", note: "steal: flight strips" }],
      },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    const [node] = await s.images();
    expect(node!.data).toMatchObject({ zone: "art", stealAxis: "notation", becomes: "the approval gate: one strip per agent, color by state", cluster: "art" });

    const get = createGetCanvasTool(s.deps);
    const full = await get({ canvasId: s.canvasId }, ALICE);
    const items = (full.structuredContent as { canvas: { items: ImageItem[] } }).canvas.items;
    expect(items.find((i) => i.id === node!.id)).toMatchObject({ stealAxis: "notation", becomes: "the approval gate: one strip per agent, color by state" });
    expect(text(full)).toContain("becomes: the approval gate: one strip per agent, color by state");
    const summary = await get({ canvasId: s.canvasId, summary: true }, ALICE);
    expect(text(summary)).toContain("becomes: the approval gate");
    expect((summary.structuredContent as { items: { becomes?: string }[] }).items[0]).toMatchObject({ becomes: "the approval gate: one strip per agent, color by state" });
  });

  it("maps the steal axis to a default cluster", async () => {
    expect(Object.fromEntries(STEAL_AXES.map((a) => [a, clusterForAxis(a)]))).toEqual({
      type: "type",
      color: "color",
      pattern: "art",
      composition: "layout",
      texture: "art",
      motion: "motion",
      notation: "art",
    });
    const tray: TrayReference[] = STEAL_AXES.map((_, i) => ({ ...ref(i + 1), zone: "art" as const }));
    const s = await setup(tray);
    const res = await s.add(
      { canvasId: s.canvasId, items: STEAL_AXES.map((axis, i) => ({ type: "reference", referenceId: ref(i + 1).id, stealAxis: axis, becomes: `the ${axis} part` })) },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    expect((await s.images()).map((n) => n.data.cluster)).toEqual(["type", "color", "art", "layout", "art", "motion", "art"]);
  });

  it("lets an explicit cluster win, and by_cluster places art in the row of what it informs", async () => {
    const s = await setup([{ ...ref(1), zone: "art" }, { ...ref(2), zone: "art" }, { ...ref(3) }]);
    await s.add(
      {
        canvasId: s.canvasId,
        items: [
          { type: "reference", referenceId: ref(1).id, stealAxis: "color", becomes: "state colors", cluster: "component: approval gate" },
          { type: "reference", referenceId: ref(2).id, stealAxis: "composition", becomes: "the page grid" },
          { type: "reference", referenceId: ref(3).id, cluster: "layout" },
        ],
      },
      ALICE,
    );
    const images = await s.images();
    expect(images.map((n) => n.data.cluster)).toEqual(["component: approval gate", "layout", "layout"]);
    // Composition art shares the layout row with the UI layout reference.
    const saved = parseState((await s.repos.canvases.getOwned(ALICE, s.canvasId))!.state);
    const out = arrangeState(saved, "by_cluster");
    if ("error" in out) throw new Error("arrange failed");
    const y = new Map(out.state.nodes.map((n) => [n.id, n.y]));
    expect(y.get(images[1]!.id)).toBe(y.get(images[2]!.id));
    expect(y.get(images[0]!.id)).not.toBe(y.get(images[1]!.id));
  });

  it("lets UI items carry stealAxis and becomes, optional, with no default cluster", async () => {
    const s = await setup([{ ...ref(1) }, { ...ref(2) }, { ...ref(3) }]);
    const res = await s.add(
      {
        canvasId: s.canvasId,
        items: [
          { type: "reference", referenceId: ref(1).id, stealAxis: "type", becomes: "the balance numerals" },
          { type: "reference", referenceId: ref(2).id },
          { type: "reference", referenceId: ref(3).id, stealAxis: "vibe" },
        ],
      },
      ALICE,
    );
    const out = res.structuredContent as { items: unknown[]; skipped: { index: number; reason: string }[] };
    expect(out.items).toHaveLength(2);
    expect(out.skipped[0]!.index).toBe(2);
    expect(out.skipped[0]!.reason).toMatch(/^Item 3: stealAxis must be type, color/);
    const images = await s.images();
    expect(images[0]!.data).toMatchObject({ stealAxis: "type", becomes: "the balance numerals" });
    expect(images[0]!.data.cluster).toBeUndefined();
    expect(images[1]!.data.stealAxis).toBeUndefined();
  });
});

describe("old art without becomes", () => {
  const oldArt = (): StoredNode => imageNode("img_old", 1, { parentId: "sec_1", data: { ...imageNode("x", 1).data, zone: "art", note: "steal: stamps" } } as Partial<StoredNode>);

  it("still loads, round trips, arranges and shows no becomes", () => {
    const s = parseState(state([sectionNode("sec_1"), oldArt(), imageNode("img_ui", 2, { parentId: "sec_1" })]));
    const art = s.nodes.find((n) => n.id === "img_old")!;
    expect(art.type === "image" && art.data).toMatchObject({ zone: "art", note: "steal: stamps" });
    expect(art.type === "image" && art.data.becomes).toBeUndefined();
    expect(serializeState(stateToNodes(s), s.viewport, s.tray)).toEqual(s);
    for (const layout of ["by_direction", "by_cluster", "grid"] as const) expect("error" in arrangeState(s, layout)).toBe(false);
    expect(stateToItems(s).find((i) => i.id === "img_old")).not.toHaveProperty("becomes");
  });

  it("drops a junk stealAxis or becomes on load", () => {
    const n = oldArt();
    const s = parseState(state([sectionNode("sec_1"), { ...n, data: { ...n.data, stealAxis: "vibe", becomes: 42 } } as unknown as StoredNode]));
    const art = s.nodes.find((x) => x.id === "img_old")!;
    expect(art.type === "image" && art.data.stealAxis).toBeUndefined();
    expect(art.type === "image" && art.data.becomes).toBeUndefined();
  });

  it("exports without becomes, and prints becomes next to the steal note when present", () => {
    const file = (snap: CanvasSnapshot, format: "direction_md" | "build_prompt", name: string) => exportKit(snap, [format]).find((f) => f.path.endsWith(name))!.content;
    const before = file(financeCanvas, "direction_md", "DIRECTION.md");
    expect(before).toContain("What to steal: steal: the stamped date as a section divider");
    expect(before).not.toContain("becomes:");

    const translated: CanvasSnapshot = {
      ...financeCanvas,
      items: financeCanvas.items.map((i) => (i.id === "fa1" ? { ...i, stealAxis: "notation" as const, becomes: "the date stamp as each section divider" } : i)),
    };
    for (const [format, name] of [["direction_md", "DIRECTION.md"], ["build_prompt", "BUILD-PROMPT.md"]] as const) {
      const md = file(translated, format, name);
      expect(md, name).toContain("What to steal: steal: the stamped date as a section divider; take its notation; becomes: the date stamp as each section divider");
      expect(md, name).not.toMatch(/[—–]/);
    }
  });
});

describe("art tile on the inline canvas", () => {
  it("names becomes in the tile's screen reader name", () => {
    const n = imageNode("img_1", 1, { data: { ...imageNode("x", 1).data, zone: "art", becomes: "the approval gate" } } as Partial<StoredNode>);
    const label = nodeLabel({ id: n.id, type: "image", position: { x: 0, y: 0 }, data: n.data } as CanvasFlowNode);
    expect(label).toBe("Art direction image: Pin 1, from pinterest.com, becomes the approval gate");
    const old = imageNode("img_2", 2, { data: { ...imageNode("x", 2).data, zone: "art" } } as Partial<StoredNode>);
    expect(nodeLabel({ id: old.id, type: "image", position: { x: 0, y: 0 }, data: old.data } as CanvasFlowNode)).not.toContain("becomes");
  });
});

describe("rate_references art only reasons", () => {
  async function rateSetup() {
    const { deps, repos } = makeDeps();
    const tray: TrayReference[] = [{ ...ref(3), zone: "art" }];
    const c = await seedCanvas(repos, ALICE, state([], tray));
    await repos.references.insertMany(c.id, [ref(1, { lane: "art" }), ref(2, { lane: "fidelity" }), ref(3)]);
    return { repos, canvasId: c.id, rate: createRateReferencesTool(deps) };
  }

  it("mentions the new reasons in plain words", () => {
    expect(RATE_DESC).toContain("object_only");
    expect(RATE_DESC).toContain("no_translation");
    expect(RATE_DESC).not.toMatch(/[—–]/);
  });

  it("accepts object_only and no_translation on art results and saves them", async () => {
    const s = await rateSetup();
    const res = await s.rate(
      {
        canvasId: s.canvasId,
        ratings: [
          { referenceId: ref(1).id, verdict: "bad", reasons: ["object_only"] },
          // Plain query art result: no lane, but the tray tags it art.
          { referenceId: ref(3).id, verdict: "bad", reasons: ["no_translation"] },
        ],
      },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({ rated: 2, bad: 2 });
    expect(s.repos.data.feedback.map((f) => f.reasons)).toEqual([["object_only"], ["no_translation"]]);
    expect(text(res)).toContain("graphic system");
  });

  it("refuses them on UI results with a plain message and saves nothing", async () => {
    const s = await rateSetup();
    const res = await s.rate(
      {
        canvasId: s.canvasId,
        ratings: [
          { referenceId: ref(1).id, verdict: "bad", reasons: ["object_only"] },
          { referenceId: ref(2).id, verdict: "bad", reasons: ["no_translation"] },
        ],
      },
      ALICE,
    );
    expect(res.isError).toBe(true);
    expect(text(res)).toBe(
      `object_only and no_translation are for art direction results only, and ${ref(2).id} is a UI result. Use another reason, such as off_topic or not_ui. Nothing was saved.`,
    );
    expect(s.repos.data.feedback).toHaveLength(0);
    expect(await s.repos.blocklist.list(ALICE)).toEqual([]);
  });

  it("gives an art lane hint for the new reasons", () => {
    expect(badHint("art", ["object_only"])).toContain('lane "art"');
    expect(badHint(null, ["no_translation"])).toContain("name the UI part it becomes");
  });
});
