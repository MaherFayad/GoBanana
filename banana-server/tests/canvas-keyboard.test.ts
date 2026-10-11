import { describe, expect, it } from "vitest";
import { isArrowKey, nudge, nudgeDelta, NUDGE, NUDGE_LARGE, resizeBy, resizeDirection } from "@/canvas/keyboard";
import { bringForward, duplicateNodes, reparent, removeNode, sectionAt, selectedIds, toggleCollapsed } from "@/canvas/geometry";
import { nodeLabel } from "@/canvas/labels";
import { matches, SHORTCUTS, type KeyEventLike } from "@/canvas/shortcuts";
import { noteNode, sectionNode } from "@/canvas/factory";
import type { CanvasFlowNode } from "@/canvas/types";

describe("keyboard nudge (SC 2.5.7)", () => {
  it("moves 8 px per arrow key", () => {
    expect(NUDGE).toBe(8);
    const p = { x: 100, y: 100 };
    expect(nudge(p, "ArrowRight", false)).toEqual({ x: 108, y: 100 });
    expect(nudge(p, "ArrowLeft", false)).toEqual({ x: 92, y: 100 });
    expect(nudge(p, "ArrowUp", false)).toEqual({ x: 100, y: 92 });
    expect(nudge(p, "ArrowDown", false)).toEqual({ x: 100, y: 108 });
  });

  it("moves 32 px with Shift", () => {
    expect(NUDGE_LARGE).toBe(32);
    expect(nudge({ x: 0, y: 0 }, "ArrowRight", true)).toEqual({ x: 32, y: 0 });
    expect(nudge({ x: 0, y: 0 }, "ArrowUp", true)).toEqual({ x: 0, y: -32 });
  });

  it("ignores other keys", () => {
    expect(nudgeDelta("a", false)).toBeNull();
    expect(nudge({ x: 5, y: 5 }, "Enter", true)).toEqual({ x: 5, y: 5 });
    expect(isArrowKey("ArrowDown")).toBe(true);
    expect(isArrowKey("Tab")).toBe(false);
  });

  it("adds up over repeated presses", () => {
    let p = { x: 0, y: 0 };
    for (let i = 0; i < 4; i++) p = nudge(p, "ArrowRight", false);
    p = nudge(p, "ArrowDown", true);
    expect(p).toEqual({ x: 32, y: 32 });
  });
});

describe("keyboard resize", () => {
  it("maps + and - keys", () => {
    expect(resizeDirection("+")).toBe(1);
    expect(resizeDirection("=")).toBe(1);
    expect(resizeDirection("-")).toBe(-1);
    expect(resizeDirection("x")).toBe(0);
  });

  it("keeps the aspect ratio for images and respects the minimum", () => {
    expect(resizeBy({ w: 280, h: 210 }, 1, { w: 120, h: 96 }, true)).toEqual({ w: 312, h: 234 });
    expect(resizeBy({ w: 130, h: 100 }, -1, { w: 120, h: 96 }, true)).toEqual({ w: 125, h: 96 });
    expect(resizeBy({ w: 220, h: 140 }, -1, { w: 140, h: 96 }, false)).toEqual({ w: 188, h: 108 });
  });
});

describe("sections", () => {
  const sec = sectionNode({ x: 308, y: 210 }, "S", "s"); // top-left at (0, 0), 616 x 420
  const loose = noteNode({ x: 900, y: 900 }, "n", "n");

  it("finds the section under a point", () => {
    expect(sectionAt({ x: 100, y: 100 }, [sec, loose])?.id).toBe("s");
    expect(sectionAt({ x: 1000, y: 100 }, [sec, loose])).toBeUndefined();
  });

  it("reparents and keeps the on-screen position", () => {
    const moved = { ...loose, position: { x: 50, y: 60 } };
    const inside = reparent([sec, moved], "n", "s");
    expect(inside[1]).toMatchObject({ parentId: "s", position: { x: 50, y: 60 } });
    const shifted = [{ ...sec, position: { x: 100, y: 100 } }, { ...moved, position: { x: 150, y: 170 } }] as CanvasFlowNode[];
    const in2 = reparent(shifted, "n", "s");
    expect(in2[1]?.position).toEqual({ x: 50, y: 70 });
    const out = reparent(in2, "n", null);
    expect(out[1]?.parentId).toBeUndefined();
    expect(out[1]?.position).toEqual({ x: 150, y: 170 });
  });

  it("removing a section keeps its contents", () => {
    const child = { ...loose, parentId: "s", position: { x: 10, y: 60 } };
    const shifted = { ...sec, position: { x: 100, y: 100 } };
    const out = removeNode([shifted, child], "s");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "n", position: { x: 110, y: 160 } });
    expect(out[0]?.parentId).toBeUndefined();
  });

  it("brings a node to the front", () => {
    const out = bringForward([{ ...sec, zIndex: 2 }, loose], "n");
    expect(out[1]?.zIndex).toBe(3);
  });

  it("collapses and expands, hiding the contents", () => {
    const child = { ...loose, parentId: "s" };
    const collapsed = toggleCollapsed([sec, child], "s");
    expect(collapsed[0]).toMatchObject({ height: 48, data: { collapsed: true, expandedHeight: 420 } });
    expect(collapsed[1]?.hidden).toBe(true);
    const open = toggleCollapsed(collapsed, "s");
    expect(open[0]).toMatchObject({ height: 420, data: { collapsed: false } });
    expect(open[1]?.hidden).toBe(false);
  });
});

describe("duplicate (Mod+D, Alt+drag)", () => {
  const sec = sectionNode({ x: 308, y: 210 }, "S", "s");
  const child = { ...noteNode({ x: 0, y: 0 }, "c", "c"), parentId: "s", position: { x: 20, y: 60 } } as CanvasFlowNode;
  const loose = noteNode({ x: 900, y: 900 }, "n", "n");
  let seq = 0;
  const makeId = (n: CanvasFlowNode) => `${n.id}-copy${++seq}`;

  it("copies an item 16 px away and selects only the copy", () => {
    seq = 0;
    const { nodes, copies } = duplicateNodes([sec, child, { ...loose, selected: true }], ["n"], makeId, { offset: 16, select: true });
    expect(copies).toEqual(["n-copy1"]);
    const copy = nodes.find((x) => x.id === "n-copy1");
    expect(copy?.position).toEqual({ x: loose.position.x + 16, y: loose.position.y + 16 });
    expect(copy?.data).toEqual(loose.data);
    expect(copy?.data).not.toBe(loose.data);
    expect(selectedIds(nodes)).toEqual(["n-copy1"]);
  });

  it("a copied section brings its contents, which keep their place inside it", () => {
    seq = 0;
    const { nodes, copies } = duplicateNodes([sec, child, loose], ["s"], makeId, { offset: 0 });
    expect(copies).toEqual(["s-copy1"]);
    const copiedChild = nodes.find((x) => x.id === "c-copy2");
    expect(copiedChild).toMatchObject({ parentId: "s-copy1", position: { x: 20, y: 60 } });
    // Sections stay before their children.
    expect(nodes.findIndex((x) => x.id === "s-copy1")).toBeLessThan(nodes.findIndex((x) => x.id === "c-copy2"));
    // Originals are untouched.
    expect(nodes.find((x) => x.id === "c")?.parentId).toBe("s");
  });

  it("an item copied alone stays in its section", () => {
    seq = 0;
    const { nodes } = duplicateNodes([sec, child], ["c"], makeId, { offset: 16 });
    expect(nodes.find((x) => x.id === "c-copy1")).toMatchObject({ parentId: "s", position: { x: 36, y: 76 } });
  });
});

describe("selected items say so in their name (SC 1.4.1)", () => {
  it("adds 'selected'", () => {
    const n = noteNode({ x: 0, y: 0 }, "Hello", "n");
    expect(nodeLabel(n)).toBe("Note: Hello");
    expect(nodeLabel({ ...n, selected: true })).toBe("Note: Hello, selected");
  });
});

describe("shortcut registry", () => {
  const key = (k: string, mods: Partial<KeyEventLike> = {}): KeyEventLike => ({
    key: k,
    code: /^\d$/.test(k) ? `Digit${k}` : undefined,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    ...mods,
  });

  it("has unique ids and a label and keys for every entry", () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SHORTCUTS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.keys.length).toBeGreaterThan(0);
      expect(s.label).not.toMatch(/\u2014/);
    }
  });

  it("matches the canvas keys", () => {
    expect(matches("sheet", key("?", { shiftKey: true }))).toBe(true);
    expect(matches("zoomFit", { ...key("!", { shiftKey: true }), code: "Digit1" })).toBe(true);
    expect(matches("zoomSelection", { ...key("@", { shiftKey: true }), code: "Digit2" })).toBe(true);
    expect(matches("selectAll", key("a", { ctrlKey: true }))).toBe(true);
    expect(matches("selectAll", key("a", { metaKey: true }))).toBe(true);
    expect(matches("selectAll", key("a"))).toBe(false);
    expect(matches("duplicate", key("d", { metaKey: true }))).toBe(true);
    expect(matches("hand", key("h"))).toBe(true);
    expect(matches("hand", key("h", { ctrlKey: true }))).toBe(false);
    expect(matches("select", key("v"))).toBe(true);
    expect(matches("deselect", key("Escape"))).toBe(true);
  });

  it("leaves browser zoom alone: Ctrl/Cmd with + or - is never a canvas zoom", () => {
    expect(matches("zoomIn", key("+"))).toBe(true);
    expect(matches("zoomIn", key("="))).toBe(true);
    expect(matches("zoomIn", key("=", { ctrlKey: true }))).toBe(false);
    expect(matches("zoomOut", key("-", { metaKey: true }))).toBe(false);
    expect(matches("zoom100", key("0", { ctrlKey: true }))).toBe(true);
  });

  it("keeps the 8 and 32 px nudge apart, and the item keys", () => {
    expect(matches("nudge", key("ArrowLeft"))).toBe(true);
    expect(matches("nudge", key("ArrowLeft", { shiftKey: true }))).toBe(false);
    expect(matches("nudgeLarge", key("ArrowLeft", { shiftKey: true }))).toBe(true);
    expect(matches("menu", key("m"))).toBe(true);
    expect(matches("menu", key("F10", { shiftKey: true }))).toBe(true);
    expect(matches("edit", key("F2"))).toBe(true);
    expect(matches("remove", key("Delete"))).toBe(true);
    expect(matches("remove", key("Backspace"))).toBe(true);
  });

  it("gestures never match a key", () => {
    expect(matches("marquee", key("Drag"))).toBe(false);
    expect(matches("altDrag", key("Alt", { altKey: true }))).toBe(false);
  });
});
