/** Add note and Add section: the free spot for the keyboard route and the z-order of new items. */
import { describe, expect, it } from "vitest";
import type { Rect } from "@/canvas/geometry";
import { applyLifts, freeSpot, PLACE_GAP, placementZ, takenRects } from "@/canvas/placement";
import type { CanvasFlowNode } from "@/canvas/types";

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const node = (id: string, type: CanvasFlowNode["type"], x: number, y: number, w = 200, h = 100, extra: Partial<CanvasFlowNode> = {}) =>
  ({
    id,
    type,
    position: { x, y },
    width: w,
    height: h,
    data: type === "section" ? { title: id } : type === "note" ? { text: id } : { imageUrl: "https://a.test/i.png", sourceUrl: "https://a.test", sourceSite: "a.test" },
    ...extra,
  }) as CanvasFlowNode;

describe("freeSpot", () => {
  it("uses the center when it is free", () => {
    expect(freeSpot({ x: 100, y: 100 }, { w: 220, h: 140 }, [])).toEqual({ x: -10, y: 30 });
  });

  it("moves to the nearest spot that overlaps nothing", () => {
    const taken: Rect[] = [{ x: -200, y: -200, w: 400, h: 400 }];
    const p = freeSpot({ x: 0, y: 0 }, { w: 220, h: 140 }, taken);
    const box = { ...p, w: 220, h: 140 };
    expect(overlaps(box, { x: -200 - PLACE_GAP, y: -200 - PLACE_GAP, w: 400 + PLACE_GAP * 2, h: 400 + PLACE_GAP * 2 })).toBe(false);
    // Nearest: straight up or down past the block (less travel than sideways for a wide box).
    expect(Math.hypot(p.x + 110, p.y + 70)).toBeLessThan(400);
  });

  it("finds a gap among many items", () => {
    const taken: Rect[] = [];
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (i !== 2 || j !== 0) taken.push({ x: i * 300, y: j * 200, w: 260, h: 160 });
    const p = freeSpot({ x: 130, y: 80 }, { w: 220, h: 140 }, taken, 0);
    const box = { ...p, w: 220, h: 140 };
    expect(taken.some((t) => overlaps(box, t))).toBe(false);
  });

  it("takenRects uses absolute positions and skips hidden items", () => {
    const nodes = [node("s", "section", 100, 100, 600, 400), node("n", "note", 16, 48, 220, 140, { parentId: "s" }), node("h", "note", 0, 0, 10, 10, { hidden: true })];
    expect(takenRects(nodes)).toEqual([
      { x: 100, y: 100, w: 600, h: 400 },
      { x: 116, y: 148, w: 220, h: 140 },
    ]);
  });
});

describe("placementZ", () => {
  it("a new note goes above everything, images brought forward included", () => {
    const nodes = [node("a", "image", 0, 0, 280, 210, { zIndex: 7 }), node("b", "note", 300, 0)];
    expect(placementZ(nodes, "note", { x: 0, y: 0, w: 220, h: 140 })).toEqual({ z: 8, lifts: new Map() });
    expect(placementZ([], "note", { x: 0, y: 0, w: 1, h: 1 }).z).toBe(1);
  });

  it("a new section goes above other sections and lifts free items it covers", () => {
    const nodes = [
      node("s1", "section", 0, 0, 600, 400, { zIndex: 2 }),
      node("free", "image", 1000, 0, 280, 210),
      node("far", "note", 3000, 0),
      node("high", "note", 1100, 50, 100, 100, { zIndex: 9 }),
      node("kid", "note", 16, 48, 100, 100, { parentId: "s1" }),
    ];
    const { z, lifts } = placementZ(nodes, "section", { x: 900, y: -50, w: 616, h: 420 });
    expect(z).toBe(3);
    // Overlapped and not already above: lifted above the new section, still free.
    expect([...lifts]).toEqual([["free", 4]]);
    const out = applyLifts(nodes, lifts);
    expect(out.find((n) => n.id === "free")).toMatchObject({ zIndex: 4 });
    expect(out.find((n) => n.id === "free")?.parentId).toBeUndefined();
    expect(applyLifts(nodes, new Map())).toEqual(nodes);
  });
});
