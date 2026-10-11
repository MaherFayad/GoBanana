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
