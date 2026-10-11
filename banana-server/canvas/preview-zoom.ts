/**
 * Zoom and pan math for the image preview (canvas/ImagePreview.tsx). Pure, for Vitest.
 *
 * The image is drawn at its natural size with `translate(x, y) scale(scale)` from the top
 * left of the stage. `x` and `y` are the image's top-left corner in stage pixels.
 */

export interface Size {
  w: number;
  h: number;
}

export interface View {
  scale: number;
  x: number;
  y: number;
}

export const PREVIEW_MIN_SCALE = 0.05;
export const PREVIEW_MAX_SCALE = 8;
/** One + or - press. */
export const PREVIEW_STEP = 1.25;
/** One arrow key press while zoomed in, in stage pixels. */
export const PREVIEW_PAN_STEP = 48;

/** Scale that fits the whole image in the stage. */
export function fitScale(image: Size, stage: Size): number {
  if (image.w <= 0 || image.h <= 0 || stage.w <= 0 || stage.h <= 0) return 1;
  return Math.min(stage.w / image.w, stage.h / image.h);
}

export function clampScale(scale: number, min = PREVIEW_MIN_SCALE, max = PREVIEW_MAX_SCALE): number {
  return Math.min(max, Math.max(min, scale));
}

/**
 * Keep the image in view: a side smaller than the stage is centered; a larger side may not
 * leave a gap at either edge.
 */
export function clampPan(view: View, image: Size, stage: Size): View {
  const w = image.w * view.scale;
  const h = image.h * view.scale;
  const x = w <= stage.w ? (stage.w - w) / 2 : Math.min(0, Math.max(stage.w - w, view.x));
  const y = h <= stage.h ? (stage.h - h) / 2 : Math.min(0, Math.max(stage.h - h, view.y));
  return { scale: view.scale, x, y };
}

/** The fitted, centered view. */
export function fitView(image: Size, stage: Size): View {
  return clampPan({ scale: fitScale(image, stage), x: 0, y: 0 }, image, stage);
}

/** Zoom range for this image: a tiny image may fit above 800%, and a huge one below 5%. */
export function scaleRange(image: Size, stage: Size): { min: number; max: number } {
  const fit = fitScale(image, stage);
  return { min: Math.min(PREVIEW_MIN_SCALE, fit), max: Math.max(PREVIEW_MAX_SCALE, fit * 2) };
}

/** Zoom to `scale` keeping the stage point `at` (default: the stage center) fixed on screen. */
export function zoomTo(view: View, scale: number, image: Size, stage: Size, at?: { x: number; y: number }): View {
  const range = scaleRange(image, stage);
  const s = clampScale(scale, range.min, range.max);
  const p = at ?? { x: stage.w / 2, y: stage.h / 2 };
  const k = s / view.scale;
  return clampPan({ scale: s, x: p.x - (p.x - view.x) * k, y: p.y - (p.y - view.y) * k }, image, stage);
}

/** One step in (+1) or out (-1). */
export function zoomStep(view: View, direction: 1 | -1, image: Size, stage: Size, at?: { x: number; y: number }): View {
  return zoomTo(view, view.scale * (direction > 0 ? PREVIEW_STEP : 1 / PREVIEW_STEP), image, stage, at);
}

/** Wheel and trackpad pinch: smooth zoom around the pointer. */
export function wheelZoom(view: View, deltaY: number, image: Size, stage: Size, at: { x: number; y: number }): View {
  const factor = Math.exp(-deltaY * 0.002);
  return zoomTo(view, view.scale * factor, image, stage, at);
}

export function panBy(view: View, dx: number, dy: number, image: Size, stage: Size): View {
  return clampPan({ scale: view.scale, x: view.x + dx, y: view.y + dy }, image, stage);
}

/** True when the image is bigger than the stage on some side (so dragging or arrows pan). */
export function canPan(view: View, image: Size, stage: Size): boolean {
  return image.w * view.scale > stage.w + 0.5 || image.h * view.scale > stage.h + 0.5;
}

/** Double-click: fit when zoomed in, else 100% around the pointer. */
export function toggleFit(view: View, image: Size, stage: Size, at?: { x: number; y: number }): View {
  const fit = fitScale(image, stage);
  return Math.abs(view.scale - fit) < 0.01 ? zoomTo(view, 1, image, stage, at) : fitView(image, stage);
}

/** "125%". */
export function percent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

/** Horizontal swipe on touch: -1 previous, 1 next, 0 neither. `rtl` mirrors the direction. */
export function swipeDirection(dx: number, dy: number, rtl = false, min = 48): -1 | 0 | 1 {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  const next = dx < 0 ? 1 : -1;
  return (rtl ? -next : next) as -1 | 1;
}
