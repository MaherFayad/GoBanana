/**
 * Geometry for the landing page's draggable field of tiles (components/site/HeroField.tsx).
 * Pure, so Vitest covers it. Offsets are the plane's translate in CSS pixels: 0 shows its
 * top-left corner; the most negative value shows its bottom-right corner.
 */
export type Vec = { x: number; y: number };
export type Size = { w: number; h: number };

/** Arrow keys move the view this far; with Shift, three times as far. */
export const KEY_STEP = 80;
export const KEY_STEP_LARGE = 240;
/** Velocity kept per 16ms frame after a fling, and the speed (px per ms) where inertia stops. */
export const FRICTION = 0.92;
export const MIN_SPEED = 0.02;
/** Pointer travel (px) after which a press is a drag, not a click on a tile. */
export const DRAG_THRESHOLD = 4;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Keeps the plane covering the view. A plane smaller than the view is centered instead. */
export function clampOffset(offset: Vec, view: Size, plane: Size): Vec {
  const axis = (o: number, v: number, p: number) => (p <= v ? (v - p) / 2 : clamp(o, v - p, 0));
  return { x: axis(offset.x, view.w, plane.w), y: axis(offset.y, view.h, plane.h) };
}

/** The offset that puts the middle of the plane in the middle of the view (Home key). */
export function centerOffset(view: Size, plane: Size): Vec {
  return clampOffset({ x: (view.w - plane.w) / 2, y: (view.h - plane.h) / 2 }, view, plane);
}

/** Pan for a key, or null when the key does not pan. "Home" is handled by the caller. */
export function keyDelta(key: string, shift: boolean): Vec | null {
  const s = shift ? KEY_STEP_LARGE : KEY_STEP;
  switch (key) {
    case "ArrowLeft":
      return { x: s, y: 0 };
    case "ArrowRight":
      return { x: -s, y: 0 };
    case "ArrowUp":
      return { x: 0, y: s };
    case "ArrowDown":
      return { x: 0, y: -s };
    default:
      return null;
  }
}

/** One inertia step: move by velocity (px per ms) over `dt` ms, then apply friction. */
export function inertiaStep(offset: Vec, velocity: Vec, dt: number): { offset: Vec; velocity: Vec; done: boolean } {
  const next = { x: offset.x + velocity.x * dt, y: offset.y + velocity.y * dt };
  const decay = Math.pow(FRICTION, dt / 16);
  const v = { x: velocity.x * decay, y: velocity.y * decay };
  return { offset: next, velocity: v, done: Math.hypot(v.x, v.y) < MIN_SPEED };
}

/**
 * Smallest pan that brings a rectangle (in plane coordinates) fully into the view, with a
 * margin, so a tile that gets keyboard focus is never hidden off screen (SC 2.4.11).
 */
export function revealOffset(offset: Vec, rect: { x: number; y: number; w: number; h: number }, view: Size, margin = 24): Vec {
  const axis = (o: number, start: number, size: number, v: number) => {
    const left = start + o;
    if (left < margin) return o + (margin - left);
    const right = left + size;
    if (right > v - margin) return o - Math.min(right - (v - margin), left - margin);
    return o;
  };
  return { x: axis(offset.x, rect.x, rect.w, view.w), y: axis(offset.y, rect.y, rect.h, view.h) };
}
