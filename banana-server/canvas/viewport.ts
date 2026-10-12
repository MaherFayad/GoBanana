/**
 * Zoom ladder and viewport math for the canvas (docs/design-language.md section 6.1).
 * Pure, so Vitest covers it without React Flow.
 *
 * Discrete changes (buttons, keys, fit) step through the ladder and animate for
 * ZOOM_DURATION ms; continuous gestures (wheel, pinch) never animate.
 */

export const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
/** Padding around fitted items (Studio: 64px, centered). */
export const FIT_PADDING = "64px";
/** Milliseconds for a discrete zoom step (matches --st-duration-zoom). */
export const ZOOM_DURATION = 220;
/** Keyboard pan of the focused board: arrow keys move the view this far, Shift multiplies by 4. */
export const PAN_STEP = 40;
export const PAN_STEP_LARGE = 160;

/** Floating point slack so 0.7499999 counts as the 75% step. */
const EPSILON = 1e-3;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * The next step on the ladder in a direction. From a zoom between steps (after a pinch),
 * zooming in goes to the next step above and zooming out to the next step below.
 * At either end the zoom stays put.
 */
export function nextZoomStep(current: number, direction: 1 | -1): number {
  const z = clampZoom(current);
  if (direction > 0) {
    return ZOOM_STEPS.find((s) => s > z + EPSILON) ?? MAX_ZOOM;
  }
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    const s = ZOOM_STEPS[i] as number;
    if (s < z - EPSILON) return s;
  }
  return MIN_ZOOM;
}

/** "100%" for a zoom of 1. */
export function zoomPercent(zoom: number): string {
  return `${Math.round(clampZoom(zoom) * 100)}%`;
}

export interface ViewportLike {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Zoom to `zoom` keeping the screen point `anchor` (relative to the board's top-left)
 * fixed. Used for "zoom around the center" on + and -.
 */
export function zoomAround(vp: ViewportLike, zoom: number, anchor: { x: number; y: number }): ViewportLike {
  const z = clampZoom(zoom);
  const k = z / vp.zoom;
  return { x: anchor.x - (anchor.x - vp.x) * k, y: anchor.y - (anchor.y - vp.y) * k, zoom: z };
}

/** True when the user asked the system for less motion. Safe on the server. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Duration for a discrete viewport change: 0 under reduced motion. */
export function zoomDuration(): number {
  return prefersReducedMotion() ? 0 : ZOOM_DURATION;
}

export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * How far to pan the view down so a focused item clears a floating bar (SC 2.4.11).
 * Returns 0 when they do not overlap. The item moves down by the overlap plus `gap`.
 */
export function clearanceBelow(item: ScreenRect, bar: ScreenRect, gap = 8): number {
  const overlaps = item.left < bar.right && item.right > bar.left && item.top < bar.bottom && item.bottom > bar.top;
  if (!overlaps) return 0;
  return Math.ceil(bar.bottom - item.top + gap);
}

/**
 * How far to pan the view up so a focused item clears a bar floating at the bottom of the board
 * (the tool dock, SC 2.4.11). Returns 0 when they do not overlap. The item moves up by the
 * overlap plus `gap`.
 */
export function clearanceAbove(item: ScreenRect, bar: ScreenRect, gap = 8): number {
  const overlaps = item.left < bar.right && item.right > bar.left && item.top < bar.bottom && item.bottom > bar.top;
  if (!overlaps) return 0;
  return Math.ceil(item.bottom - bar.top + gap);
}
