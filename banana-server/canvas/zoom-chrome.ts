/**
 * Node chrome under zoom (the Figma behavior) and image source choice. Pure, for Vitest.
 *
 * Per-node chrome (menu button, source chip, Preview button, note color pill, resize handles,
 * selection outline) keeps one on-screen size at any zoom: CanvasApp writes `--bn-zoom` and
 * `--bn-chrome` (1 / zoom) on the board and the CSS counter-scales by `--bn-chrome`. Nodes
 * only re-render when their chrome mode changes (a bucket of on-screen width), never on each
 * zoom tick.
 */

/** Counter-scale for chrome drawn inside the zoomed viewport, so it stays the same size on screen. */
export function chromeScale(zoom: number): number {
  return zoom > 0 && Number.isFinite(zoom) ? 1 / zoom : 1;
}

/**
 * Chrome for a tile by its on-screen width:
 * - "full": chip with the site name, menu and Preview shown on hover, focus and selection;
 * - "icon": the source chip collapses to its icon (the name stays its accessible name);
 * - "tiny": the tile is too small to carry chrome; chip and buttons show on hover, focus and
 *   selection only, and stay keyboard reachable (focus-within shows them).
 */
export type ChromeMode = "full" | "icon" | "tiny";

export const CHROME_ICON_BELOW = 200;
export const CHROME_TINY_BELOW = 120;

export function chromeMode(nodeWidth: number, zoom: number): ChromeMode {
  const screen = nodeWidth * zoom;
  if (screen < CHROME_TINY_BELOW) return "tiny";
  if (screen < CHROME_ICON_BELOW) return "icon";
  return "full";
}

/** Load the full image once the tile on screen is clearly wider than the thumbnail's pixels. */
export const SHARP_RATIO = 1.2;
/** Tiles at least this wide on screen want the full image even before the thumb has loaded. */
export const THUMB_MAX_SCREEN_WIDTH = 320;

/**
 * True when the tile should show `imageUrl` instead of the thumbnail: zoomed in past 100%,
 * or the tile on screen is wider than 1.2 x the thumbnail's natural width (or than 320 px
 * when that width is not known yet).
 */
export function wantFullImage(opts: { nodeWidth: number; zoom: number; thumbNaturalWidth?: number | null }): boolean {
  const screen = opts.nodeWidth * opts.zoom;
  if (opts.zoom > 1) return true;
  const natural = opts.thumbNaturalWidth ?? 0;
  if (natural > 0) return screen > natural * SHARP_RATIO;
  return screen > THUMB_MAX_SCREEN_WIDTH;
}

/** A pointer that moved less than this between down and up is a click, not a drag. */
export const CLICK_SLOP = 4;

export interface PointerSample {
  x: number;
  y: number;
}

/** Click versus drag: movement under `slop` px (screen pixels) counts as a click. */
export function isClick(down: PointerSample, up: PointerSample, slop = CLICK_SLOP): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) < slop;
}

/** Modifier keys turn a click into a selection gesture (Shift, Ctrl or Cmd click), never a preview. */
export function isPlainClick(e: { button: number; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean {
  return e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
}
