import { describe, expect, it } from "vitest";
import { arrangeNodes, BLOCK_GAP, SECTION_PAD } from "@/canvas/layout-adapter";
import { absoluteRect } from "@/canvas/geometry";
import { noteNode, referenceNode, sectionNode, stitchNode, swatchNode, typeSampleNode } from "@/canvas/factory";
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

describe("spread on the whole canvas (P0-13)", () => {
  const art = (id: string, w: number, h: number) => {
    const n = ref(id, w, h);
    return n.type === "image" ? { ...n, data: { ...n.data, zone: "art" as const } } : n;
  };
  /** `n` directions, each with 2 art, a note, 6 UI, a swatch and a type sample, laid out as columns first. */
  function directions(n: number): CanvasFlowNode[] {
    const out: CanvasFlowNode[] = [];
    for (let d = 0; d < n; d++) {
      const s = sectionNode({ x: d * 700, y: 0 }, `Direction ${d + 1}`, `s${d}`);
      out.push(s);
      const kid = (node: CanvasFlowNode, i: number): CanvasFlowNode => ({ ...node, parentId: s.id, position: { x: 16, y: 60 + i * 10 } });
      out.push(kid(art(`d${d}-art1`, 1600, 1000), 0), kid(art(`d${d}-art2`, 800, 800), 1));
      out.push(kid(noteNode({ x: 0, y: 0 }, `Mechanic ${d}: the boarding pass tears off. Twist: stamps.`, `d${d}-note`), 2));
      for (let u = 0; u < 6; u++) out.push(kid(ref(`d${d}-ui${u}`, 600, 1200 - u * 100), 3 + u));
      out.push(kid(swatchNode({ x: 0, y: 0 }, "#d62828", {}, `d${d}-sw`), 9));
      out.push(kid(typeSampleNode({ x: 0, y: 0 }, undefined, `d${d}-type`), 10));
    }
    out.push(ref("loose1", 400, 300));
    return out;
  }

  for (const n of [1, 3, 6]) {
    it(`${n} direction${n > 1 ? "s" : ""}: one spread each, stacked top to bottom, nothing overlaps, loose items below`, () => {
      const out = arrangeNodes(directions(n), "spread");
      const sections = out.filter((s) => s.type === "section");
      expect(sections.map((s) => s.position.x)).toEqual(Array(n).fill(0));
      const ys = sections.map((s) => s.position.y);
      expect([...ys].sort((a, b) => a - b)).toEqual(ys);
      for (let i = 1; i < n; i++) expect(ys[i]).toBe(ys[i - 1]! + (sections[i - 1]!.height ?? 0) + BLOCK_GAP);
      expect(hasOverlap(absRects(out, (x) => !x.parentId))).toBe(false);
      expect(hasOverlap(absRects(out, (x) => x.type !== "section"))).toBe(false);
      for (let d = 0; d < n; d++) {
        const get = (id: string) => out.find((x) => x.id === id)!;
        const lead = get(`d${d}-art1`);
        expect(lead.parentId).toBe(`s${d}`);
        expect(lead.width).toBe(560);
        expect(lead.position.x).toBe(SECTION_PAD);
        // The mechanic note sits beside the lead, the UI grid right of it in 3 columns.
        expect(get(`d${d}-note`).position.x).toBe(SECTION_PAD + 560 + 16);
        const uiX = [0, 1, 2, 3, 4, 5].map((u) => get(`d${d}-ui${u}`).position.x);
        expect(new Set(uiX).size).toBe(3);
        expect(Math.min(...uiX)).toBeGreaterThan(get(`d${d}-note`).position.x);
        // Swatch and type sample under it all.
        const blocksBottom = Math.max(...[`d${d}-art1`, `d${d}-art2`, `d${d}-note`, ...[0, 1, 2, 3, 4, 5].map((u) => `d${d}-ui${u}`)].map((id) => get(id).position.y + (get(id).height ?? 0)));
        expect(get(`d${d}-sw`).position.y).toBeGreaterThan(blocksBottom);
        expect(get(`d${d}-type`).position.y).toBe(get(`d${d}-sw`).position.y);
        // Every child stays inside its frame.
        const s = get(`s${d}`);
        for (const k of out.filter((x) => x.parentId === s.id)) {
          expect(k.position.x + (k.width ?? 0)).toBeLessThanOrEqual(s.width ?? 0);
          expect(k.position.y + (k.height ?? 0)).toBeLessThanOrEqual(s.height ?? 0);
        }
      }
      const bottom = Math.max(...sections.map((s) => s.position.y + (s.height ?? 0)));
      expect(out.find((x) => x.id === "loose1")!.position.y).toBeGreaterThan(bottom);
    });
  }

  it("puts the Frankenstein pages section last, at full size, and the stack still does not overlap", () => {
    const nodes = directions(3);
    const pages = sectionNode({ x: -900, y: 0 }, "Frankenstein pages", "pages");
    const frame = stitchNode({ x: 0, y: 0 }, { title: "Page", platform: "website", mode: "collage", rows: [] }, [], "st1");
    const out = arrangeNodes([pages, ...nodes, { ...frame, parentId: "pages", position: { x: 16, y: 48 } }], "spread");
    const sections = out.filter((s) => s.type === "section").sort((a, b) => a.position.y - b.position.y);
    expect(sections.at(-1)!.id).toBe("pages");
    const st = out.find((x) => x.id === "st1")!;
    expect(st.width).toBe(frame.width);
    expect(hasOverlap(absRects(out, (x) => !x.parentId))).toBe(false);
    expect(hasOverlap(absRects(out, (x) => x.type !== "section"))).toBe(false);
  });

  it("arranges one section as a spread and grows its frame", () => {
    const out = arrangeNodes(directions(2), "spread", { sectionId: "s1" });
    const s1 = out.find((x) => x.id === "s1")!;
    expect(out.find((x) => x.id === "d1-art1")!.width).toBe(560);
    expect(out.find((x) => x.id === "d0-art1")!.width).toBe(280);
    expect(s1.width).toBeGreaterThanOrEqual(SECTION_PAD + 560 + 16 + 280 + 16 + 3 * 280 + 2 * 16);
  });
});
