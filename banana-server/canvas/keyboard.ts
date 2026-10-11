/**
 * Keyboard math for the canvas (spec section 9, SC 2.5.7).
 * Arrow keys nudge the focused node 8 px, Shift + arrow 32 px.
 * "+" and "-" resize the focused node by 32 px (keyboard alternative to the resize handles).
 */

export const NUDGE = 8;
export const NUDGE_LARGE = 32;
export const RESIZE_STEP = 32;

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

const DIRECTIONS: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

export function isArrowKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(DIRECTIONS, key);
}

/** Offset for an arrow key press, or null for any other key. */
export function nudgeDelta(key: string, shift: boolean): Point | null {
  const dir = DIRECTIONS[key];
  if (!dir) return null;
  const step = shift ? NUDGE_LARGE : NUDGE;
  return { x: dir.x * step, y: dir.y * step };
}

/** New position after an arrow key press. Returns the same position for other keys. */
export function nudge(position: Point, key: string, shift: boolean): Point {
  const d = nudgeDelta(key, shift);
  if (!d) return position;
  return { x: position.x + d.x, y: position.y + d.y };
}

/** "up" | "down" | "left" | "right" for screen reader messages. */
export function directionWord(key: string): string {
  return key.replace("Arrow", "").toLowerCase();
}

/** 1 for grow keys ("+", "="), -1 for shrink ("-", "_"), 0 otherwise. */
export function resizeDirection(key: string): -1 | 0 | 1 {
  if (key === "+" || key === "=") return 1;
  if (key === "-" || key === "_") return -1;
  return 0;
}

/**
 * Grow or shrink by `RESIZE_STEP` px of width. When `keepAspect` is set the height
 * follows the current aspect ratio (image tiles), otherwise both sides change by
 * the same step. Never goes below `min`.
 */
export function resizeBy(size: Size, direction: -1 | 1, min: Size, keepAspect: boolean): Size {
  const step = RESIZE_STEP * direction;
  if (keepAspect && size.w > 0 && size.h > 0) {
    const ratio = size.w / size.h;
    let w = Math.max(min.w, size.w + step);
    let h = Math.round(w / ratio);
    if (h < min.h) {
      h = min.h;
      w = Math.round(h * ratio);
    }
    return { w, h };
  }
  return { w: Math.max(min.w, size.w + step), h: Math.max(min.h, size.h + step) };
}
