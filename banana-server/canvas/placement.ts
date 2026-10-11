/**
 * Placing new notes and sections (Add note, Add section). Pure, for Vitest.
 *
 * - `freeSpot`: the keyboard route puts the item at the center of the view, moved to the
 *   nearest spot that overlaps nothing.
 * - `placementZ`: a new item is drawn on top of everything. A new section is above the other
 *   sections; free items it is dropped over stay free and are lifted above it, so the new
 *   frame never hides them.
 */
import { absoluteRect, type Rect } from "./geometry";
import type { CanvasFlowNode } from "./types";

export const PLACE_GAP = 16;
const STEP = 24;
const MAX_RINGS = 60;

function overlaps(a: Rect, b: Rect, gap = 0): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

/**
 * Top-left of a `size` box centered as close to `center` as possible without overlapping any
 * of `taken` (with a gap). Searches rings of candidates outward and keeps the nearest one.
 */
export function freeSpot(center: { x: number; y: number }, size: { w: number; h: number }, taken: readonly Rect[], gap = PLACE_GAP): { x: number; y: number } {
  const at = (dx: number, dy: number): Rect => ({
    x: Math.round(center.x - size.w / 2 + dx),
    y: Math.round(center.y - size.h / 2 + dy),
    w: size.w,
    h: size.h,
  });
  const free = (r: Rect) => !taken.some((t) => overlaps(r, t, gap));
  const first = at(0, 0);
  if (free(first)) return { x: first.x, y: first.y };
  for (let ring = 1; ring <= MAX_RINGS; ring++) {
    let best: Rect | null = null;
    let bestD = Infinity;
    for (let i = -ring; i <= ring; i++) {
      for (const [dx, dy] of [
        [i, -ring],
        [i, ring],
        [-ring, i],
        [ring, i],
      ] as const) {
        const r = at(dx * STEP, dy * STEP);
        const d = Math.hypot(dx, dy);
        if (d < bestD && free(r)) {
          best = r;
          bestD = d;
        }
      }
    }
    if (best) return { x: best.x, y: best.y };
  }
  return { x: first.x, y: first.y };
}

/** Absolute rects of the visible nodes, for `freeSpot`. */
export function takenRects(nodes: readonly CanvasFlowNode[]): Rect[] {
  return nodes.filter((n) => !n.hidden).map((n) => absoluteRect(n, nodes));
}

/**
 * z for a new node and the z lifts it causes. Items: one above the highest z on the board.
 * Sections: one above the highest section; top-level items that overlap the new section and
 * are not above it already go one above it, so they stay visible and free (never swallowed).
 */
export function placementZ(
  nodes: readonly CanvasFlowNode[],
  type: CanvasFlowNode["type"],
  rect: Rect,
): { z: number; lifts: Map<string, number> } {
  const lifts = new Map<string, number>();
  if (type !== "section") {
    const top = nodes.reduce((m, n) => Math.max(m, n.zIndex ?? 0), 0);
    return { z: top + 1, lifts };
  }
  const z = nodes.filter((n) => n.type === "section").reduce((m, n) => Math.max(m, n.zIndex ?? 0), 0) + 1;
  for (const n of nodes) {
    if (n.type === "section" || n.parentId || n.hidden) continue;
    if ((n.zIndex ?? 0) > z) continue;
    if (overlaps(absoluteRect(n, nodes), rect)) lifts.set(n.id, z + 1);
  }
  return { z, lifts };
}

/** Apply `placementZ` lifts to the node list. */
export function applyLifts(nodes: readonly CanvasFlowNode[], lifts: ReadonlyMap<string, number>): CanvasFlowNode[] {
  if (lifts.size === 0) return [...nodes];
  return nodes.map((n) => (lifts.has(n.id) ? ({ ...n, zIndex: lifts.get(n.id) } as CanvasFlowNode) : n));
}
