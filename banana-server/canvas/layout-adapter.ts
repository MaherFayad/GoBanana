/**
 * Adapter between React Flow nodes and the pure layout functions in `lib/layout`
 * (the same code `arrange_canvas` uses, spec section 9 "Arrange").
 *
 * - With `sectionId`: arranges that section's contents inside it and resizes the frame.
 * - `spread` on the whole canvas: each section becomes one horizontal spread (lib/layout
 *   `spread`), sections stack top to bottom with the Frankenstein pages last, loose items below.
 * - `by_direction` on the whole canvas: one column per section (sections ordered left
 *   to right), loose items in a last column.
 * - Other layouts on the whole canvas: each section's contents are arranged inside it,
 *   sections sit in a row, loose items are arranged below them.
 */
import { arrange, arrangeZoned, byDirection, COLUMN_WIDTH, GAP, type LayoutItem, type LayoutKind, type Rect } from "@/lib/layout";
import { nodeSize } from "./geometry";
import { estimateNoteHeight } from "./note-layout";
import { orderNodes, SECTION_HEADER_HEIGHT } from "./state";
import { type CanvasFlowNode, MIN_SIZE } from "./types";

export type { LayoutKind } from "@/lib/layout";
export { LAYOUTS } from "@/lib/layout";

/** Inner padding of a section frame (left, right, bottom). */
export const SECTION_PAD = 16;
/** Space between sections and between sections and loose items. */
export const BLOCK_GAP = 48;

export const LAYOUT_LABELS: Record<LayoutKind, string> = {
  spread: "Spread",
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
  if (n.type === "image" && n.data.zone === "art") item.zone = "art";
  if (n.type === "note" || n.type === "swatch" || n.type === "typeSample") item.kind = n.type;
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
  // Art direction items get their own labelled block above the UI references.
  const result = arrangeZoned(kind, children.map(toLayoutItem), {
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

/**
 * Arrange. Stitch frames ("Frankenstein pages") keep their size: they are left out of the layout
 * functions (which would shrink them to a column) and placed in a row afterwards, see placeStitches.
 */
export function arrangeNodes(
  nodes: readonly CanvasFlowNode[],
  layout: LayoutKind,
  opts: { sectionId?: string } = {},
): CanvasFlowNode[] {
  const restack = layout === "spread" && !opts.sectionId;
  if (!nodes.some((n) => n.type === "stitch")) return arrangeCore(nodes, layout, opts);
  const stitches = nodes.filter((n) => n.type === "stitch" && (!opts.sectionId || n.parentId === opts.sectionId));
  const moving = new Set(stitches.map((n) => n.id));
  // Spread: the sections holding Frankenstein pages (and their builds) are the final spread.
  const last = new Set(stitches.flatMap((n) => (n.parentId ? [n.parentId] : [])));
  const arranged = arrangeCore(nodes.filter((n) => !moving.has(n.id)), layout, { ...opts, last });
  const placed = placeStitches(arranged, stitches, !opts.sectionId);
  return restack ? restackSpreads(placed) : placed;
}

/**
 * Spread: sections stack top to bottom at x 0 in their current order, BLOCK_GAP apart (frames
 * that grew around Frankenstein pages included), and loose items sit below them as one block.
 */
function restackSpreads(nodes: CanvasFlowNode[]): CanvasFlowNode[] {
  const sections = nodes.filter((n) => n.type === "section" && !n.parentId).sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  const moved = new Map<string, { x: number; y: number }>();
  let y = 0;
  for (const s of sections) {
    moved.set(s.id, { x: 0, y });
    y += nodeSize(s).h + BLOCK_GAP;
  }
  const loose = nodes.filter((n) => !n.parentId && n.type !== "section");
  if (loose.length > 0) {
    const minX = Math.min(...loose.map((n) => n.position.x));
    const minY = Math.min(...loose.map((n) => n.position.y));
    for (const n of loose) moved.set(n.id, { x: n.position.x - minX, y: n.position.y - minY + y });
  }
  return nodes.map((n) => (moved.has(n.id) ? { ...n, position: moved.get(n.id)! } : n));
}

/** Lay stitch frames in a row at the top of their section (or below all loose content), at full size. */
function placeStitches(nodes: CanvasFlowNode[], stitches: readonly CanvasFlowNode[], wholeCanvas: boolean): CanvasFlowNode[] {
  let out = [...nodes];
  const bySection = new Map<string | null, CanvasFlowNode[]>();
  for (const s of stitches) {
    const key = s.parentId && out.some((n) => n.id === s.parentId && n.type === "section") ? s.parentId : null;
    bySection.set(key, [...(bySection.get(key) ?? []), s]);
  }
  const sorted = (list: CanvasFlowNode[]) => [...list].sort(bySectionOrder);
  for (const [sectionId, list] of bySection) {
    if (sectionId === null) continue;
    const row = sorted(list);
    const rowH = Math.max(...row.map((n) => nodeSize(n).h));
    // Other children move down to make room for the row of frames.
    out = out.map((n) => (n.parentId === sectionId ? { ...n, position: { x: n.position.x, y: n.position.y + rowH + GAP } } : n));
    let x = SECTION_PAD;
    for (const n of row) {
      const { w, h } = nodeSize(n);
      out.push({ ...n, parentId: sectionId, position: { x, y: SECTION_HEADER_HEIGHT }, width: w, height: h } as CanvasFlowNode);
      x += w + GAP;
    }
    const kids = out.filter((n) => n.parentId === sectionId);
    const right = Math.max(...kids.map((k) => k.position.x + nodeSize(k).w));
    const bottom = Math.max(...kids.map((k) => k.position.y + nodeSize(k).h));
    out = out.map((n) => {
      if (n.id !== sectionId || n.type !== "section") return n;
      const w = Math.max(nodeSize(n).w, right + SECTION_PAD);
      const frameH = bottom + SECTION_PAD;
      if (n.data.collapsed) return { ...n, width: w, data: { ...n.data, expandedHeight: frameH } };
      return { ...n, width: w, height: frameH };
    });
  }
  if (wholeCanvas) {
    // Grown sections may now reach into the next block on their row: push those to the right.
    const top = out.filter((n) => n.type === "section").sort(bySectionOrder);
    const moved = new Map<string, number>();
    for (let i = 0; i < top.length; i++) {
      const a = top[i]!;
      const ax = a.position.x + (moved.get(a.id) ?? 0);
      const as = nodeSize(a);
      for (let j = i + 1; j < top.length; j++) {
        const b = top[j]!;
        const bs = nodeSize(b);
        const bx = b.position.x + (moved.get(b.id) ?? 0);
        const yOverlap = a.position.y < b.position.y + bs.h && b.position.y < a.position.y + as.h;
        if (yOverlap && bx < ax + as.w + BLOCK_GAP && bx >= ax) moved.set(b.id, ax + as.w + BLOCK_GAP - b.position.x);
      }
    }
    out = out.map((n) => (moved.has(n.id) ? { ...n, position: { x: n.position.x + moved.get(n.id)!, y: n.position.y } } : n));
    // Loose items that a grown section now covers move down below the sections.
    const frames = out.filter((n) => n.type === "section").map((n) => ({ ...n.position, ...nodeSize(n) }));
    const looseItems = out.filter((n) => !n.parentId && n.type !== "section" && !stitches.includes(n));
    const hit = looseItems.some((n) => {
      const r = { ...n.position, ...nodeSize(n) };
      return frames.some((f) => r.x < f.x + f.w && f.x < r.x + r.w && r.y < f.y + f.h && f.y < r.y + r.h);
    });
    if (hit && looseItems.length > 0) {
      const below = Math.max(...frames.map((f) => f.y + f.h)) + BLOCK_GAP;
      const dy = below - Math.min(...looseItems.map((n) => n.position.y));
      const ids = new Set(looseItems.map((n) => n.id));
      if (dy > 0) out = out.map((n) => (ids.has(n.id) ? { ...n, position: { x: n.position.x, y: n.position.y + dy } } : n));
    }
  }
  const loose = bySection.get(null);
  if (loose) {
    const top = out.filter((n) => !n.parentId);
    const left = top.length > 0 ? Math.min(...top.map((n) => n.position.x)) : 0;
    let x = left;
    const y = top.length > 0 ? Math.max(...top.map((n) => n.position.y + nodeSize(n).h)) + BLOCK_GAP : 0;
    for (const n of sorted(loose)) {
      const { w, h } = nodeSize(n);
      const next = { ...n, position: { x, y }, width: w, height: h } as CanvasFlowNode;
      delete next.parentId;
      out.push(next);
      x += w + GAP;
    }
  }
  return orderNodes(out);
}

function arrangeCore(
  nodes: readonly CanvasFlowNode[],
  layout: LayoutKind,
  opts: { sectionId?: string; last?: ReadonlySet<string> } = {},
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

  if (layout === "spread") {
    // One spread per section, stacked top to bottom; Frankenstein page sections go last.
    const last = opts.last ?? new Set<string>();
    const ordered = [...sections.filter((s) => !last.has(s.id)), ...sections.filter((s) => last.has(s.id))];
    const patches = new Map<string, Patch>();
    let out = [...nodes];
    let y = 0;
    for (const s of ordered) {
      const inner = arrangeInside(nodes, s, layout);
      for (const [id, p] of inner.patches) patches.set(id, p);
      const hp = sectionHeightPatch(s, inner.size.h);
      patches.set(s.id, { x: 0, y, w: inner.size.w, h: hp.h });
      out = withExpandedHeight(out, s.id, hp.expandedHeight);
      y += hp.h + BLOCK_GAP;
    }
    const loose = nodes.filter((n) => n.type !== "section" && !n.parentId);
    if (loose.length > 0) {
      const result = arrange("spread", loose.map(toLayoutItem), { origin: { x: 0, y } });
      for (const r of result.items) patches.set(r.id, { x: r.x, y: r.y, w: r.w, h: r.h });
    }
    return applyPatches(out, patches);
  }

  if (layout === "by_direction") {
    const items = nodes.filter((n) => n.type !== "section").map(toLayoutItem);
    // Wider gaps leave room for each frame's inner padding; frames end up GAP px apart.
    const result = byDirection(items, {
      sections: sections.map((s) => ({ id: s.id })),
      origin: { x: SECTION_PAD, y: 0 },
      gap: GAP + SECTION_PAD * 2,
      rowGap: GAP,
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
    for (const r of result.items) {
      const node = nodes.find((n) => n.id === r.id);
      const frame = node?.parentId ? frames.get(node.parentId) : undefined;
      if (frame) patches.set(r.id, { x: r.x - frame.x, y: r.y - frame.y, w: r.w, h: r.h });
      else patches.set(r.id, { x: r.x, y: r.y, w: r.w, h: r.h, parentId: null });
    }
    // Frame heights from the children's final positions.
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
