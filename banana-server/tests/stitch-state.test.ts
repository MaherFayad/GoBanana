/** Stitch state: parts and stitch nodes through parse, save, takedown filter, snapshot and arrange. */
import { describe, expect, it } from "vitest";
import { arrangeNodes } from "@/canvas/layout-adapter";
import { stitchNode } from "@/canvas/factory";
import { deserializeState, filterBlocked, parseState, serializeState, stateToItems, stateToNodes } from "@/canvas/state";
import { DEFAULT_SIZE, MIN_SIZE, type CanvasState, type StitchFlowNode, type StoredNode } from "@/canvas/types";
import { arrangeState, stitchSnapshots, toSnapshot, validateSaveBody } from "@/lib/canvas/store";
import { createMemoryRepos } from "@/lib/db/memory";
import { MAX_PARTS, type StitchData } from "@/lib/stitch/types";
import { part } from "./stitch-fixtures";
import { ALICE, imageNode, sectionNode, state } from "./tools-fixtures";

const data: StitchData = {
  title: "Idea",
  platform: "website",
  mode: "collage",
  note: "Editorial nav over a dashboard hero",
  rows: [
    { id: "rw-1", slots: [{ id: "sl-1", role: "nav", partId: "pt-a", note: "pill nav" }] },
    { id: "rw-2", slots: [{ id: "sl-2", role: "hero", partId: "pt-b", crop: { x: 0, y: 0.1, w: 1, h: 0.3 } }, { id: "sl-3", role: "cards", partId: "pt-gone" }] },
  ],
};

function stitchStored(id = "st-1", over: Partial<StoredNode> = {}): StoredNode {
  return { id, type: "stitch", x: 0, y: 0, w: 720, h: 600, data, ...over } as StoredNode;
}

const lib = [part("pt-a", "nav", 1, { note: "part note" }), part("pt-b", "hero", 2, { theme: "dark" })];

describe("stitch state", () => {
  it("round trips parts and stitch nodes, pruning slots whose part is missing", () => {
    const parsed = parseState({ ...state([stitchStored()]), parts: lib });
    expect(parsed.parts).toEqual(lib);
    const node = parsed.nodes[0]!;
    expect(node.type).toBe("stitch");
    if (node.type !== "stitch") return;
    expect(node.data.rows[1]!.slots.map((s) => s.id)).toEqual(["sl-2"]);
    expect(parseState(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
    const de = deserializeState(parsed);
    expect(de.parts).toEqual(lib);
    const back = serializeState(de.nodes, de.viewport, de.tray, de.parts);
    expect(back.parts).toEqual(lib);
    expect(back.nodes).toEqual(parsed.nodes);
  });

  it("keeps the parts key only when the input has it", () => {
    expect("parts" in parseState(state([stitchStored()]))).toBe(false);
    // Without a parts list nothing is pruned: the server keeps the stored library on save.
    const n = parseState(state([stitchStored()])).nodes[0]!;
    expect(n.type === "stitch" && n.data.rows[1]!.slots).toHaveLength(2);
    expect(parseState({ ...state(), parts: [] }).parts).toEqual([]);
    expect("parts" in serializeState([], { x: 0, y: 0, zoom: 1 })).toBe(false);
    expect(serializeState([], { x: 0, y: 0, zoom: 1 }, [], []).parts).toEqual([]);
  });

  it("drops unsafe and invalid parts and caps the library", () => {
    const bad = [{ ...part("pt-x", "nav", 9), imageUrl: "blob:https://x/1" }, { id: "pt-y" }, ...Array.from({ length: MAX_PARTS + 3 }, (_, i) => part(`pt-${i}`, "cards", i))];
    const parsed = parseState({ ...state(), parts: bad });
    expect(parsed.parts).toHaveLength(MAX_PARTS);
    expect(parsed.parts!.some((p) => p.id === "pt-x" || p.id === "pt-y")).toBe(false);
    // A save body with an embedded image is refused outright.
    const body = { state: { ...state(), parts: [{ ...part("pt-z", "nav", 1), imageUrl: "data:image/png;base64,AA" }] } };
    expect(validateSaveBody(body, 100)).toMatchObject({ ok: false, status: 400 });
  });

  it("hides blocked parts and the slots that used them", () => {
    const s = parseState({ ...state([stitchStored()]), parts: lib });
    const { state: out, removed } = filterBlocked(s, (u) => u.includes("shots/2"));
    expect(removed).toBe(1);
    expect(out.parts!.map((p) => p.id)).toEqual(["pt-a"]);
    const n = out.nodes[0]!;
    expect(n.type === "stitch" && n.data.rows.map((r) => r.id)).toEqual(["rw-1"]);
  });

  it("has default and min sizes and a factory sized for the platform", () => {
    expect(DEFAULT_SIZE.stitch).toEqual({ w: 720, h: 900 });
    expect(MIN_SIZE.stitch.w).toBeGreaterThan(0);
    const node: StitchFlowNode = stitchNode({ x: 0, y: 0 }, { ...data, platform: "mobile" }, lib, "st-9");
    expect(node).toMatchObject({ id: "st-9", type: "stitch", width: 300 });
  });

  it("leaves stitch frames out of items and lists them, resolved, in the snapshot", () => {
    const s = parseState({ ...state([sectionNode("sec_1", { x: 100, y: 50 }), stitchStored("st-1", { parentId: "sec_1", x: 16, y: 48 })]), parts: lib });
    expect(stateToItems(s).map((i) => i.type)).toEqual(["section"]);
    const [st] = stitchSnapshots(s);
    expect(st).toMatchObject({ id: "st-1", x: 116, y: 98, sectionId: "sec_1", note: "Editorial nav over a dashboard hero" });
    expect(st!.rows[0]!.slots[0]).toEqual({
      id: "sl-1",
      role: "nav",
      partId: "pt-a",
      imageUrl: "https://cdn.dribbble.com/shot/1.png",
      sourceUrl: "https://dribbble.com/shots/1",
      sourceSite: "dribbble.com",
      title: "Shot 1",
      crop: { x: 0, y: 0, w: 1, h: 0.2 },
      note: "pill nav",
      imageWidth: 1600,
      imageHeight: 1200,
    });
    // The slot crop overrides the part's; the part note shows when the slot has none.
    expect(st!.rows[1]!.slots[0]).toMatchObject({ crop: { x: 0, y: 0.1, w: 1, h: 0.3 }, theme: "dark" });
    const snap = toSnapshot({ canvas: { id: "c1", title: "B", brief: "", wildness: 3, lens: null, updatedAt: new Date(0) } as never, state: s });
    expect(snap.parts).toEqual(lib);
    expect(snap.stitches).toHaveLength(1);
  });

  it("keeps stitch frames at full size when arranging", () => {
    const s = parseState({
      ...state([
        sectionNode("sec_1", { x: 0, y: 0 }),
        imageNode("img_1", 1, { parentId: "sec_1", x: 16, y: 48 }),
        stitchStored("st-1", { parentId: "sec_1", x: 300, y: 48 }),
        stitchStored("st-2", { x: 2000, y: 0 }),
        imageNode("img_2", 2, { x: 0, y: 900 }),
      ]),
      parts: lib,
    });
    for (const layout of ["masonry", "grid", "hero", "by_direction"] as const) {
      const out = arrangeState(s, layout);
      if ("error" in out) throw new Error("no");
      const st = out.state.nodes.filter((n) => n.type === "stitch");
      expect(st.map((n) => [n.w, n.h])).toEqual([
        [720, 600],
        [720, 600],
      ]);
      const sec = out.state.nodes.find((n) => n.id === "sec_1")!;
      const inSec = out.state.nodes.find((n) => n.id === "st-1")!;
      expect(inSec.parentId).toBe("sec_1");
      expect(sec.w).toBeGreaterThanOrEqual(inSec.x + inSec.w);
      expect(sec.h).toBeGreaterThanOrEqual(inSec.y + inSec.h);
      // No two top-level blocks overlap.
      const items = out.items.filter((i) => !out.state.nodes.find((n) => n.id === i.id)?.parentId);
      for (const a of items)
        for (const b of items)
          if (a !== b) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${layout} ${a.id} ${b.id}`).toBe(false);
    }
    // Arranging one section moves only its frames.
    const one = arrangeNodes(stateToNodes(s), "grid", { sectionId: "sec_1" });
    expect(one.find((n) => n.id === "st-2")!.position).toEqual({ x: 2000, y: 0 });
  });
});

describe("saving keeps the parts library", () => {
  it("keeps stored parts when a save leaves them out, replaces them when it sets them", async () => {
    const repos = createMemoryRepos();
    const c = await repos.canvases.create({ userId: ALICE, title: "B", brief: "", state: { ...state(), parts: lib } as CanvasState });
    await repos.canvases.saveState(ALICE, c.id, state());
    expect(((await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState).parts).toEqual(lib);
    await repos.canvases.saveState(ALICE, c.id, { ...state(), parts: [] });
    expect(((await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState).parts).toEqual([]);
  });
});
