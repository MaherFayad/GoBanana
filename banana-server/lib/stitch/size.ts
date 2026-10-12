/**
 * Size of a stitch frame on the canvas. The frame is the platform frame (STITCH_FRAME_WIDTH)
 * scaled down to a display width; each row is as tall as its tallest slot, and a slot's height
 * comes from its crop's aspect ratio when the image size is known, else a default ratio by role.
 */
import { STITCH_FRAME_WIDTH, type Crop, type Part, type PartRole, type StitchData, type StitchPlatform, type StitchSlot } from "./types";

/** Canvas display width of a frame per platform. */
export const STITCH_DISPLAY_WIDTH: Record<StitchPlatform, number> = {
  mobile: 300,
  tablet: 460,
  website: 720,
  webapp: 720,
};

/** Room for the frame's title bar above the page. */
export const STITCH_HEADER = 40;
/** Height of an empty frame's page area. */
export const STITCH_EMPTY_HEIGHT = 160;
const MIN_SLOT = 24;
const MAX_SLOT = 1600;

/** Slot height over slot width when the image size is unknown, by role (as seen at full frame width). */
const ROLE_RATIO: Partial<Record<PartRole, number>> = {
  nav: 0.08,
  "status-header": 0.2,
  toolbar: 0.08,
  tabbar: 0.18,
  hero: 0.5,
  footer: 0.22,
  logos: 0.1,
  stats: 0.2,
  cta: 0.25,
  sidebar: 2,
  filters: 0.15,
};
const DEFAULT_RATIO = 0.45;

/** Height over width of a crop of an image, or null when the image size is unknown. */
export function cropAspect(crop: Crop, imageWidth?: number, imageHeight?: number): number | null {
  if (!(imageWidth && imageHeight && imageWidth > 0 && imageHeight > 0)) return null;
  const w = crop.w * imageWidth;
  const h = crop.h * imageHeight;
  return w > 0 && h > 0 ? h / w : null;
}

export function slotAspect(slot: StitchSlot, part: Part | undefined): number {
  const crop = slot.crop ?? part?.crop;
  const known = crop && part ? cropAspect(crop, part.imageWidth, part.imageHeight) : null;
  return known ?? ROLE_RATIO[slot.role] ?? DEFAULT_RATIO;
}

/** Display size of a stitch frame: width per platform, height summed from rows plus the title bar. */
export function stitchSize(data: StitchData, parts: readonly Part[] | ReadonlyMap<string, Part>): { w: number; h: number } {
  const byId = parts instanceof Map ? parts : new Map((parts as readonly Part[]).map((p) => [p.id, p]));
  const w = STITCH_DISPLAY_WIDTH[data.platform] ?? STITCH_DISPLAY_WIDTH.website;
  let h = 0;
  for (const row of data.rows) {
    const widths = row.widths && row.widths.length === row.slots.length ? row.widths : row.slots.map(() => 1);
    const total = widths.reduce((a, b) => a + b, 0) || 1;
    let rowH = 0;
    row.slots.forEach((slot, i) => {
      const slotW = (w * (widths[i] ?? 1)) / total;
      rowH = Math.max(rowH, slotW * slotAspect(slot, byId.get(slot.partId)));
    });
    h += Math.min(MAX_SLOT, Math.max(MIN_SLOT, Math.round(rowH)));
  }
  return { w, h: STITCH_HEADER + (h > 0 ? h : STITCH_EMPTY_HEIGHT) };
}

/** Real frame width in px of the platform (390, 834 or 1440). */
export function frameWidth(platform: StitchPlatform): number {
  return STITCH_FRAME_WIDTH[platform];
}
