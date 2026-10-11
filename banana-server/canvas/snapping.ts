/**
 * Snap to peers while dragging (docs/design-language.md section 6.3). A port of Studio's
 * `computeSnap` and `collectPeerRects` (fk2:src/admin/pages/site/canvas/boardSnapping.ts):
 * on each axis, the closest pair of edges or centers within the threshold wins, and a guide
 * line is returned that touches both items. Pure, in board units, so items inside sections
 * snap in board space (absoluteRect).
 */
import { absoluteRect, type Rect } from "./geometry";
import type { CanvasFlowNode } from "./types";

/** Snap distance in board units (Studio: 8). */
export const SNAP_THRESHOLD = 8;

export interface SnapGuide {
  /** "x": a vertical line at board x = position. "y": a horizontal line at board y = position. */
  axis: "x" | "y";
  position: number;
  /** Extent on the other axis, covering both the dragged item and the matched peer. */
  start: number;
  end: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

interface Match {
  distance: number;
  dragged: number;
  peer: number;
  rect: Rect;
}

function edges(r: Rect, axis: "x" | "y"): [number, number, number] {
  return axis === "x" ? [r.x, r.x + r.w / 2, r.x + r.w] : [r.y, r.y + r.h / 2, r.y + r.h];
}

function closest(dragged: Rect, peers: readonly Rect[], axis: "x" | "y", threshold: number): Match | null {
  const mine = edges(dragged, axis);
  let best: Match | null = null;
  for (const rect of peers) {
    for (const p of edges(rect, axis)) {
      for (const d of mine) {
        const distance = Math.abs(d - p);
        if (distance > threshold) continue;
        if (!best || distance < best.distance) best = { distance, dragged: d, peer: p, rect };
      }
    }
  }
  return best;
}

/** Snapped top-left for `dragged` and the guides to draw. Axes snap independently. */
export function computeSnap(dragged: Rect, peers: readonly Rect[], threshold = SNAP_THRESHOLD): SnapResult {
  const guides: SnapGuide[] = [];
  let { x, y } = dragged;
  const mx = closest(dragged, peers, "x", threshold);
  if (mx) {
    x = dragged.x + (mx.peer - mx.dragged);
    guides.push({
      axis: "x",
      position: mx.peer,
      start: Math.min(dragged.y, mx.rect.y),
      end: Math.max(dragged.y + dragged.h, mx.rect.y + mx.rect.h),
    });
  }
  const my = closest(dragged, peers, "y", threshold);
  if (my) {
    y = dragged.y + (my.peer - my.dragged);
    guides.push({
      axis: "y",
      position: my.peer,
      start: Math.min(dragged.x, my.rect.x),
      end: Math.max(dragged.x + dragged.w, my.rect.x + my.rect.w),
    });
  }
  return { x, y, guides };
}

/**
 * Every visible item that is not being dragged, in board space. Children of a dragged
 * section move with it, so they are left out too.
 */
export function collectPeerRects(nodes: readonly CanvasFlowNode[], draggedIds: ReadonlySet<string>): Rect[] {
  const out: Rect[] = [];
  for (const n of nodes) {
    if (n.hidden || draggedIds.has(n.id)) continue;
    if (n.parentId && draggedIds.has(n.parentId)) continue;
    out.push(absoluteRect(n, nodes));
  }
  return out;
}

/** The smallest rect around all of `rects`. */
export function unionRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w);
    y2 = Math.max(y2, r.y + r.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function guidesEqual(a: readonly SnapGuide[], b: readonly SnapGuide[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((g, i) => {
    const h = b[i];
    return !!h && g.axis === h.axis && g.position === h.position && g.start === h.start && g.end === h.end;
  });
}
