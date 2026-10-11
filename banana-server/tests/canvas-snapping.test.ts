import { describe, expect, it } from "vitest";
import { noteNode, sectionNode } from "@/canvas/factory";
import { collectPeerRects, computeSnap, guidesEqual, SNAP_THRESHOLD, unionRect } from "@/canvas/snapping";
import type { CanvasFlowNode } from "@/canvas/types";

describe("computeSnap (port of Studio boardSnapping)", () => {
  const peer = { x: 100, y: 100, w: 200, h: 100 };

  it("uses an 8 unit threshold", () => {
    expect(SNAP_THRESHOLD).toBe(8);
  });

  it("snaps a left edge to a peer's left edge and draws a guide touching both", () => {
    const r = computeSnap({ x: 105, y: 300, w: 50, h: 50 }, [peer]);
    expect(r.x).toBe(100);
    expect(r.y).toBe(300);
    expect(r.guides).toEqual([{ axis: "x", position: 100, start: 100, end: 350 }]);
  });

  it("snaps centers, and each axis on its own", () => {
    const r = computeSnap({ x: 172, y: 196, w: 50, h: 10 }, [peer]);
    // x: center 197 vs peer center 200 (3) wins.
    expect(r.x).toBe(175);
    // y: center 201 vs peer end 200 (1) beats start 196 vs 200 (4).
    expect(r.y).toBe(195);
    expect(r.guides.map((g) => g.axis)).toEqual(["x", "y"]);
  });

  it("closest match wins across peers", () => {
    const near = { x: 403, y: 0, w: 2, h: 10 };
    const far = { x: 394, y: 0, w: 2, h: 10 };
    const r = computeSnap({ x: 400, y: 500, w: 20, h: 20 }, [far, near]);
    expect(r.x).toBe(403);
  });

  it("leaves the position alone outside the threshold", () => {
    const r = computeSnap({ x: 500, y: 500, w: 20, h: 20 }, [peer]);
    expect(r).toEqual({ x: 500, y: 500, guides: [] });
  });

  it("compares guide lists", () => {
    const a = computeSnap({ x: 105, y: 300, w: 50, h: 50 }, [peer]).guides;
    const b = computeSnap({ x: 104, y: 300, w: 50, h: 50 }, [peer]).guides;
    expect(guidesEqual(a, b)).toBe(true);
    expect(guidesEqual(a, [])).toBe(false);
  });
});

describe("collectPeerRects", () => {
  const sec = { ...sectionNode({ x: 0, y: 0 }, "S", "s"), position: { x: 1000, y: 1000 } } as CanvasFlowNode;
  const inside = { ...noteNode({ x: 0, y: 0 }, "a", "a"), parentId: "s", position: { x: 10, y: 60 } } as CanvasFlowNode;
  const loose = { ...noteNode({ x: 0, y: 0 }, "b", "b"), position: { x: 5, y: 5 } } as CanvasFlowNode;
  const hidden = { ...noteNode({ x: 0, y: 0 }, "h", "h"), hidden: true } as CanvasFlowNode;

  it("puts items in sections in board space and skips hidden and dragged items", () => {
    const rects = collectPeerRects([sec, inside, loose, hidden], new Set(["b"]));
    expect(rects).toHaveLength(2);
    expect(rects[1]).toMatchObject({ x: 1010, y: 1060 });
  });

  it("skips the contents of a dragged section", () => {
    const rects = collectPeerRects([sec, inside, loose], new Set(["s"]));
    expect(rects).toEqual([expect.objectContaining({ x: 5, y: 5 })]);
  });

  it("unions rects", () => {
    expect(unionRect([])).toBeNull();
    expect(unionRect([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: -5, w: 5, h: 5 }])).toEqual({ x: 0, y: -5, w: 25, h: 15 });
  });
});
