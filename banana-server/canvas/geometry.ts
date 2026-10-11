/**
 * Pure geometry helpers for sections (React Flow groups). Child positions in
 * React Flow are relative to their parent; these helpers convert both ways.
 */
import type { CanvasFlowNode } from "./types";
import { SECTION_HEADER_HEIGHT } from "./state";
import { DEFAULT_SIZE } from "./types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function nodeSize(n: CanvasFlowNode): { w: number; h: number } {
  const d = DEFAULT_SIZE[n.type];
  return { w: n.width ?? n.measured?.width ?? d.w, h: n.height ?? n.measured?.height ?? d.h };
}

/** Absolute position of a node. Sections are never nested, so one parent level is enough. */
export function absolutePosition(n: CanvasFlowNode, nodes: readonly CanvasFlowNode[]): { x: number; y: number } {
  if (!n.parentId) return n.position;
  const parent = nodes.find((p) => p.id === n.parentId);
  if (!parent) return n.position;
  return { x: parent.position.x + n.position.x, y: parent.position.y + n.position.y };
}

export function absoluteRect(n: CanvasFlowNode, nodes: readonly CanvasFlowNode[]): Rect {
  const p = absolutePosition(n, nodes);
  const s = nodeSize(n);
  return { x: p.x, y: p.y, w: s.w, h: s.h };
}

export function containsPoint(r: Rect, p: { x: number; y: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** Topmost open section that contains the point (absolute canvas coordinates). */
export function sectionAt(
  point: { x: number; y: number },
  nodes: readonly CanvasFlowNode[],
  excludeId?: string,
): CanvasFlowNode | undefined {
  const hits = nodes.filter(
    (n) => n.type === "section" && n.id !== excludeId && !n.data.collapsed && containsPoint(absoluteRect(n, nodes), point),
  );
  return hits.sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))[0];
}

/**
 * Move a node into a section (or out to the top level when `sectionId` is null),
 * keeping its place on screen. Sections cannot go inside sections.
 */
export function reparent(
  nodes: readonly CanvasFlowNode[],
  nodeId: string,
  sectionId: string | null,
): CanvasFlowNode[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || node.type === "section") return [...nodes];
  if ((node.parentId ?? null) === sectionId) return [...nodes];
  const section = sectionId ? nodes.find((n) => n.id === sectionId && n.type === "section") : undefined;
  if (sectionId && !section) return [...nodes];
  const abs = absolutePosition(node, nodes);
  const next = { ...node } as CanvasFlowNode;
  if (section) {
    next.parentId = section.id;
    next.position = { x: Math.max(0, abs.x - section.position.x), y: Math.max(0, abs.y - section.position.y) };
    next.hidden = Boolean(section.type === "section" && section.data.collapsed);
  } else {
    delete next.parentId;
    next.position = abs;
    delete next.hidden;
  }
  return nodes.map((n) => (n.id === nodeId ? next : n));
}

/** Remove a node. Removing a section keeps its contents and moves them to the top level. */
export function removeNode(nodes: readonly CanvasFlowNode[], nodeId: string): CanvasFlowNode[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return [...nodes];
  let out = [...nodes];
  if (node.type === "section") {
    for (const child of nodes.filter((n) => n.parentId === nodeId)) out = reparent(out, child.id, null);
  }
  return out.filter((n) => n.id !== nodeId);
}

/** Raise a node above every other node. */
export function bringForward(nodes: readonly CanvasFlowNode[], nodeId: string): CanvasFlowNode[] {
  const top = nodes.reduce((m, n) => Math.max(m, n.zIndex ?? 0), 0);
  return nodes.map((n) => (n.id === nodeId ? ({ ...n, zIndex: top + 1 } as CanvasFlowNode) : n));
}

/** A free spot near `p` that does not exactly stack on an existing node's corner. */
export function cascade(p: { x: number; y: number }, nodes: readonly CanvasFlowNode[], step = 24): { x: number; y: number } {
  let { x, y } = p;
  const taken = (q: { x: number; y: number }) =>
    nodes.some((n) => !n.parentId && Math.abs(n.position.x - q.x) < 4 && Math.abs(n.position.y - q.y) < 4);
  for (let i = 0; i < 50 && taken({ x, y }); i++) {
    x += step;
    y += step;
  }
  return { x, y };
}

/** Collapse or expand a section. Its contents are hidden while it is collapsed. */
export function toggleCollapsed(nodes: readonly CanvasFlowNode[], sectionId: string): CanvasFlowNode[] {
  const s = nodes.find((n) => n.id === sectionId);
  if (!s || s.type !== "section") return [...nodes];
  const collapse = !s.data.collapsed;
  const currentH = nodeSize(s).h;
  return nodes.map((n): CanvasFlowNode => {
    if (n.id === sectionId && n.type === "section") {
      return {
        ...n,
        height: collapse ? SECTION_HEADER_HEIGHT : (n.data.expandedHeight ?? DEFAULT_SIZE.section.h),
        data: { ...n.data, collapsed: collapse, expandedHeight: collapse ? currentH : n.data.expandedHeight },
      };
    }
    if (n.parentId === sectionId) return { ...n, hidden: collapse };
    return n;
  });
}

/**
 * Copies of `ids` (Mod+D and Alt+drag). A copied section brings its contents along; an
 * item copied on its own stays in its section. Copies sit `offset` away, are selected when
 * `select` is set (the originals are then unselected), and keep sections before their
 * children (React Flow needs parents first). `makeId` is injected so tests stay pure.
 */
export function duplicateNodes(
  nodes: readonly CanvasFlowNode[],
  ids: readonly string[],
  makeId: (n: CanvasFlowNode) => string,
  options: { offset?: number; select?: boolean } = {},
): { nodes: CanvasFlowNode[]; copies: string[] } {
  const offset = options.offset ?? 0;
  const wanted = new Set(ids);
  // Contents of copied sections come along.
  for (const n of nodes) if (n.parentId && wanted.has(n.parentId)) wanted.add(n.id);
  const idMap = new Map<string, string>();
  for (const n of nodes) if (wanted.has(n.id)) idMap.set(n.id, makeId(n));
  const top = nodes.reduce((m, n) => Math.max(m, n.zIndex ?? 0), 0);
  const copies: CanvasFlowNode[] = [];
  const topLevel: string[] = [];
  for (const n of nodes) {
    const newId = idMap.get(n.id);
    if (!newId) continue;
    const parentCopied = n.parentId ? idMap.get(n.parentId) : undefined;
    const size = nodeSize(n);
    const copy = {
      ...n,
      id: newId,
      data: { ...n.data },
      width: size.w,
      height: size.h,
      // Inside a copied section the child keeps its place; everything else shifts.
      position: parentCopied ? { ...n.position } : { x: n.position.x + offset, y: n.position.y + offset },
      selected: Boolean(options.select) && !parentCopied,
      dragging: false,
      ...(n.zIndex !== undefined ? { zIndex: top + 1 } : {}),
    } as CanvasFlowNode;
    if (parentCopied) copy.parentId = parentCopied;
    delete (copy as { measured?: unknown }).measured;
    copies.push(copy);
    if (!parentCopied) topLevel.push(newId);
  }
  const base = options.select
    ? nodes.map((n) => (n.selected ? ({ ...n, selected: false } as CanvasFlowNode) : n))
    : [...nodes];
  const all = [...base, ...copies];
  return {
    nodes: [...all.filter((n) => n.type === "section"), ...all.filter((n) => n.type !== "section")],
    copies: topLevel,
  };
}

/** Ids of the selected, visible items. */
export function selectedIds(nodes: readonly CanvasFlowNode[]): string[] {
  return nodes.filter((n) => n.selected && !n.hidden).map((n) => n.id);
}

/** Inner padding a section keeps around its contents (same as canvas/layout-adapter.ts SECTION_PAD). */
const SECTION_INNER_PAD = 16;

/**
 * Grow the section that holds `childId` so the child fits inside it with the frame's padding
 * (a note that grew to fit its text, a resize past the edge). Sections never shrink here. A
 * collapsed section keeps its header height and grows the height it restores to.
 */
export function growSectionToFit(nodes: readonly CanvasFlowNode[], childId: string): CanvasFlowNode[] {
  const child = nodes.find((n) => n.id === childId);
  if (!child?.parentId) return nodes as CanvasFlowNode[];
  const section = nodes.find((n) => n.id === child.parentId);
  if (!section || section.type !== "section") return nodes as CanvasFlowNode[];
  const c = nodeSize(child);
  const s = nodeSize(section);
  const needW = child.position.x + c.w + SECTION_INNER_PAD;
  const needH = child.position.y + c.h + SECTION_INNER_PAD;
  if (section.data.collapsed) {
    const restore = section.data.expandedHeight ?? DEFAULT_SIZE.section.h;
    if (needW <= s.w && needH <= restore) return nodes as CanvasFlowNode[];
    return nodes.map((n) =>
      n.id === section.id && n.type === "section"
        ? { ...n, width: Math.max(s.w, needW), data: { ...n.data, expandedHeight: Math.max(restore, needH) } }
        : n,
    );
  }
  if (needW <= s.w && needH <= s.h) return nodes as CanvasFlowNode[];
  return nodes.map((n) => (n.id === section.id ? ({ ...n, width: Math.max(s.w, needW), height: Math.max(s.h, needH) } as CanvasFlowNode) : n));
}
