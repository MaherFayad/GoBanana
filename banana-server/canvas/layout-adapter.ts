/**
 * Adapter between React Flow nodes and the pure layout functions in `lib/layout`
 * (the same code `arrange_canvas` uses, spec section 9 "Arrange").
 *
 * - With `sectionId`: arranges that section's contents inside it and resizes the frame.
 * - `by_direction` on the whole canvas: one column per section (sections ordered left
 *   to right), loose items in a last column.
 * - Other layouts on the whole canvas: each section's contents are arranged inside it,
 *   sections sit in a row, loose items are arranged below them.
 */
import { arrange, byDirection, COLUMN_WIDTH, GAP, type LayoutItem, type LayoutKind, type Rect } from "@/lib/layout";
import { nodeSize } from "./geometry";
import { estimateNoteHeight } from "./note-layout";
import { SECTION_HEADER_HEIGHT } from "./state";
import { type CanvasFlowNode, MIN_SIZE } from "./types";

export type { LayoutKind } from "@/lib/layout";
export { LAYOUTS } from "@/lib/layout";

/** Inner padding of a section frame (left, right, bottom). */
export const SECTION_PAD = 16;
/** Space between sections and between sections and loose items. */
export const BLOCK_GAP = 48;

export const LAYOUT_LABELS: Record<LayoutKind, string> = {
  by_direction: "By direction",
  masonry: "Masonry",
  grid: "Grid",
  hero: "Hero",
};

function toLayoutItem(n: CanvasFlowNode): LayoutItem {
  const { w, h } = nodeSize(n);
  const item: LayoutItem = { id: n.id, w, h };
  if ((n.type === "image" || n.type === "upload") && n.data.width && n.data.height) {
    item.aspectRatio = n.data.width / n.data.height;
  }
  // An auto-height note is as tall as its text at the column width, not its old aspect ratio
  // (a 220 x 140 note used to come out 280 x 178 and scroll).
  if (n.type === "note" && !n.data.manualHeight) {
    item.aspectRatio = COLUMN_WIDTH / estimateNoteHeight(n.data.text, COLUMN_WIDTH);
  }
  if (n.parentId) item.sectionId = n.parentId;
  return item;
}

type Patch = { x: number; y: number; w: number; h: number; parentId?: string | null };

function applyPatches(nodes: readonly CanvasFlowNode[], patches: Map<string, Patch>): CanvasFlowNode[] {
  return nodes.map((n) => {
    const p = patches.get(n.id);
    if (!p) return n;
    // Square grid and hero cells are taller than most notes; an auto note keeps its text height.
    const h = n.type === "note" && !n.data.manualHeight ? Math.min(p.h, estimateNoteHeight(n.data.text, p.w)) : p.h;
    const next = { ...n, position: { x: p.x, y: p.y }, width: p.w, height: h } as CanvasFlowNode;
    if (p.parentId === null) delete next.parentId;
    else if (p.parentId) next.parentId = p.parentId;
    return next;
  });
}

function sectionHeightPatch(section: CanvasFlowNode, frameH: number): { h: number; expandedHeight?: number } {
  if (section.type === "section" && section.data.collapsed) return { h: SECTION_HEADER_HEIGHT, expandedHeight: frameH };
  return { h: frameH };
}

function withExpandedHeight(nodes: CanvasFlowNode[], id: string, expandedHeight?: number): CanvasFlowNode[] {
  if (expandedHeight === undefined) return nodes;
  return nodes.map((n) =>
    n.id === id && n.type === "section" ? { ...n, data: { ...n.data, expandedHeight } } : n,
  );
}

/** Arrange one section's contents. Positions are relative to the section. */
function arrangeInside(
  nodes: readonly CanvasFlowNode[],
  section: CanvasFlowNode,
  layout: LayoutKind,
): { patches: Map<string, Patch>; size: { w: number; h: number } } {
  const children = nodes.filter((n) => n.parentId === section.id);
  const patches = new Map<string, Patch>();
  const current = nodeSize(section);
  if (children.length === 0) return { patches, size: current };
  const kind = layout === "by_direction" ? "masonry" : layout;
  const columns = layout === "by_direction" ? 1 : undefined;
  const result = arrange(kind, children.map(toLayoutItem), {
    origin: { x: SECTION_PAD, y: SECTION_HEADER_HEIGHT },
    ...(columns ? { columns } : {}),
  });
  let right = 0;
  let bottom = 0;
  for (const r of result.items) {
    patches.set(r.id, { x: r.x, y: r.y, w: r.w, h: r.h });
    right = Math.max(right, r.x + r.w);
    bottom = Math.max(bottom, r.y + r.h);
  }
  const min = MIN_SIZE.section;
  return { patches, size: { w: Math.max(min.w, right + SECTION_PAD), h: Math.max(min.h, bottom + SECTION_PAD) } };
}

function bySectionOrder(a: CanvasFlowNode, b: CanvasFlowNode): number {
  return a.position.x - b.position.x || a.position.y - b.position.y;
}

export function arrangeNodes(
  nodes: readonly CanvasFlowNode[],
  layout: LayoutKind,
  opts: { sectionId?: string } = {},
): CanvasFlowNode[] {
  if (opts.sectionId) {
    const section = nodes.find((n) => n.id === opts.sectionId && n.type === "section");
    if (!section) return [...nodes];
    const { patches, size } = arrangeInside(nodes, section, layout);
    const hp = sectionHeightPatch(section, size.h);
    patches.set(section.id, { x: section.position.x, y: section.position.y, w: size.w, h: hp.h });
    return withExpandedHeight(applyPatches(nodes, patches), section.id, hp.expandedHeight);
  }

  const sections = nodes.filter((n) => n.type === "section").sort(bySectionOrder);

  if (layout === "by_direction") {
    const items = nodes.filter((n) => n.type !== "section").map(toLayoutItem);
    // Wider gaps leave room for each frame's inner padding; frames end up GAP px apart.
    const result = byDirection(items, {
      sections: sections.map((s) => ({ id: s.id })),
      origin: { x: SECTION_PAD, y: 0 },
      gap: GAP + SECTION_PAD * 2,
    });
    const frames = new Map<string, Rect>(
      result.sections.map((f) => [f.id, { id: f.id, x: f.x - SECTION_PAD, y: f.y, w: f.w + SECTION_PAD * 2, h: f.h }]),
    );
    const patches = new Map<string, Patch>();
    let out = [...nodes];
    for (const s of sections) {
      const f = frames.get(s.id);
      if (!f) continue;
      const hp = sectionHeightPatch(s, f.h);
      patches.set(s.id, { x: f.x, y: f.y, w: f.w, h: hp.h });
      out = withExpandedHeight(out, s.id, hp.expandedHeight);
    }
    // byDirection uses vertical gaps of `gap` too; tighten them back to GAP inside columns.
    const byColumn = new Map<number, Rect[]>();
    for (const r of result.items) byColumn.set(r.x, [...(byColumn.get(r.x) ?? []), r]);
    for (const col of byColumn.values()) {
      let y: number | null = null;
      for (const r of col) {
        if (y !== null) r.y = y;
        y = r.y + r.h + GAP;
      }
    }
    for (const r of result.items) {
      const node = nodes.find((n) => n.id === r.id);
      const frame = node?.parentId ? frames.get(node.parentId) : undefined;
      if (frame) patches.set(r.id, { x: r.x - frame.x, y: r.y - frame.y, w: r.w, h: r.h });
      else patches.set(r.id, { x: r.x, y: r.y, w: r.w, h: r.h, parentId: null });
    }
    // Recompute frame heights after tightening the column gaps.
    for (const s of sections) {
      const p = patches.get(s.id);
      if (!p) continue;
      const kids = nodes.filter((n) => n.parentId === s.id);
      const bottom = kids.reduce((m, k) => {
        const kp = patches.get(k.id);
        return kp ? Math.max(m, kp.y + kp.h) : m;
      }, 0);
      const frameH = kids.length > 0 ? bottom + SECTION_PAD : SECTION_HEADER_HEIGHT + SECTION_PAD;
      const hp = sectionHeightPatch(s, frameH);
      patches.set(s.id, { ...p, h: hp.h });
      out = withExpandedHeight(out, s.id, hp.expandedHeight);
    }
    return applyPatches(out, patches);
  }

  // masonry, grid, hero on the whole canvas.
  const patches = new Map<string, Patch>();
  let out = [...nodes];
  let x = 0;
  let sectionsBottom = 0;
  for (const s of sections) {
    const inner = arrangeInside(nodes, s, layout);
    for (const [id, p] of inner.patches) patches.set(id, p);
    const hp = sectionHeightPatch(s, inner.size.h);
    patches.set(s.id, { x, y: 0, w: inner.size.w, h: hp.h });
    out = withExpandedHeight(out, s.id, hp.expandedHeight);
    x += inner.size.w + BLOCK_GAP;
    sectionsBottom = Math.max(sectionsBottom, hp.h);
  }
  const loose = nodes.filter((n) => n.type !== "section" && !n.parentId);
  if (loose.length > 0) {
    const originY = sections.length > 0 ? sectionsBottom + BLOCK_GAP : 0;
    const result = arrange(layout, loose.map(toLayoutItem), { origin: { x: 0, y: originY } });
    for (const r of result.items) patches.set(r.id, { x: r.x, y: r.y, w: r.w, h: r.h });
  }
  return applyPatches(out, patches);
}
