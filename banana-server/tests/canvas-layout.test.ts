import { describe, expect, it } from "vitest";
import { arrangeNodes, SECTION_PAD } from "@/canvas/layout-adapter";
import { absoluteRect } from "@/canvas/geometry";
import { noteNode, referenceNode, sectionNode } from "@/canvas/factory";
import { hasOverlap } from "@/lib/layout";
import type { CanvasFlowNode } from "@/canvas/types";

const ref = (id: string, w: number, h: number) =>
  referenceNode(
    { id, imageUrl: `https://i.pinimg.com/${id}.jpg`, thumbUrl: "", sourceUrl: `https://www.pinterest.com/pin/${id}/`, sourceSite: "pinterest.com", width: w, height: h },
    { x: 0, y: 0 },
    id,
  );

function board(): CanvasFlowNode[] {
  const a = sectionNode({ x: 0, y: 0 }, "A", "sa");
  const b = sectionNode({ x: 2000, y: 0 }, "B", "sb");
  return [
    a,
    b,
    { ...ref("i1", 800, 600), parentId: "sa", position: { x: 10, y: 60 } },
    { ...ref("i2", 600, 900), parentId: "sa", position: { x: 300, y: 60 } },
    { ...ref("i3", 1000, 1000), parentId: "sb", position: { x: 10, y: 60 } },
    ref("i4", 400, 400),
    noteNode({ x: 0, y: 0 }, "loose", "n1"),
  ];
}

function absRects(nodes: CanvasFlowNode[], filter: (n: CanvasFlowNode) => boolean) {
  return nodes.filter(filter).map((n) => ({ id: n.id, ...absoluteRect(n, nodes) }));
}

describe("layout adapter (lib/layout on React Flow nodes)", () => {
  it("by_direction: one column per section, children stay inside their frames", () => {
    const out = arrangeNodes(board(), "by_direction");
    const sa = out.find((n) => n.id === "sa");
    const sb = out.find((n) => n.id === "sb");
    expect(sa?.position.x).toBeLessThan(sb?.position.x ?? 0);
    for (const id of ["i1", "i2"]) {
      const n = out.find((x) => x.id === id);
      expect(n?.parentId).toBe("sa");
      expect(n?.position.x).toBe(SECTION_PAD);
      expect(n?.width).toBe(280);
      expect((n?.position.y ?? 0) + (n?.height ?? 0)).toBeLessThanOrEqual(sa?.height ?? 0);
    }
    expect(hasOverlap(absRects(out, (n) => n.type !== "section"))).toBe(false);
    expect(hasOverlap(absRects(out, (n) => n.type === "section"))).toBe(false);
  });

  it("keeps image aspect ratios in masonry", () => {
    const out = arrangeNodes(board(), "masonry");
    const i2 = out.find((n) => n.id === "i2");
    expect(i2?.width).toBe(280);
    expect(i2?.height).toBe(420);
  });

  for (const layout of ["masonry", "grid", "hero"] as const) {
    it(`${layout}: nothing overlaps and loose items sit below sections`, () => {
      const out = arrangeNodes(board(), layout);
      expect(hasOverlap(absRects(out, (n) => !n.parentId))).toBe(false);
      expect(hasOverlap(absRects(out, (n) => n.type !== "section"))).toBe(false);
      const sectionsBottom = Math.max(...out.filter((n) => n.type === "section").map((n) => n.position.y + (n.height ?? 0)));
      for (const id of ["i4", "n1"]) expect(out.find((n) => n.id === id)?.position.y).toBeGreaterThan(sectionsBottom);
    });
  }

  it("arranges one section only and grows its frame to fit", () => {
    const before = board();
    const out = arrangeNodes(before, "grid", { sectionId: "sa" });
    expect(out.find((n) => n.id === "i3")).toEqual(before.find((n) => n.id === "i3"));
    expect(out.find((n) => n.id === "i4")).toEqual(before.find((n) => n.id === "i4"));
    const sa = out.find((n) => n.id === "sa");
    const kids = out.filter((n) => n.parentId === "sa");
    for (const k of kids) {
      expect(k.width).toBe(280);
      expect(k.height).toBe(280);
      expect(k.position.x + (k.width ?? 0)).toBeLessThanOrEqual(sa?.width ?? 0);
    }
  });

  it("is deterministic", () => {
    expect(arrangeNodes(board(), "hero")).toEqual(arrangeNodes(board(), "hero"));
  });
});
