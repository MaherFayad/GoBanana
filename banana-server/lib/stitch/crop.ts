/**
 * Default crops (docs/stitch-spec.md "Default crops"). No vision: a band of the source image picked
 * by role, the platform of the source and the image shape. The agent passes its own crop only when
 * its client shows it the image; otherwise this guess stands, marked as guessed, and the user fixes
 * it in the canvas crop editor. The server never fetches the image to look.
 *
 * Field report, 2026-10-12: every role but nav, hero and status header got the same middle band
 * (40% to 70% down), so a pay button and a fare summary cut from one shot were identical. Each role
 * now has its own band, and a phone shot laid out as a landscape presentation (Dribbble's 4:3
 * shots, several phones side by side) is cut from the middle phone, not across all of them.
 */
import { clampCrop, type Crop, type PartRole, type StitchPlatform } from "./types";

export interface CropContext {
  imageWidth?: number | null;
  imageHeight?: number | null;
  /** Platform of the source image, when known. */
  platform?: StitchPlatform | null;
}

/**
 * True for a tall full page shot (many screens stacked), false for a single screen.
 * A phone screen is about 2.2 times as tall as it is wide, a desktop screen about 0.6.
 */
export function isFullPageShot(ctx: CropContext): boolean {
  const w = ctx.imageWidth ?? 0;
  const h = ctx.imageHeight ?? 0;
  if (!(w > 0 && h > 0)) return false;
  const aspect = h / w;
  const limit = ctx.platform === "mobile" ? 3 : ctx.platform ? 1.5 : 2.6;
  return aspect > limit;
}

/**
 * How the image is laid out, by its shape:
 * - page: a tall full page shot (isFullPageShot).
 * - phones: a phone design shown as a landscape or square presentation (several screens side by
 *   side). Mobile sources only; with no size (Dribbble drops it) a mobile shot is taken as one,
 *   since most Dribbble shots are 4:3 presentations.
 * - screen: one screen filling the image (a portrait phone screen, a desktop page).
 */
export type ImageLayout = "page" | "phones" | "screen";

export function imageLayout(ctx: CropContext): ImageLayout {
  if (isFullPageShot(ctx)) return "page";
  if (ctx.platform !== "mobile") return "screen";
  const w = ctx.imageWidth ?? 0;
  const h = ctx.imageHeight ?? 0;
  if (!(w > 0 && h > 0)) return "phones";
  return h / w < 1.15 ? "phones" : "screen";
}

/**
 * Band of one screen per role, as fractions of the screen: where that part usually sits. Every
 * role has its own band, so two roles cut from one image never get the same crop.
 */
export const ROLE_BANDS: Record<PartRole, Crop> = {
  nav: { x: 0, y: 0, w: 1, h: 0.08 },
  "status-header": { x: 0, y: 0, w: 1, h: 0.14 },
  toolbar: { x: 0, y: 0.06, w: 1, h: 0.1 },
  filters: { x: 0, y: 0.12, w: 1, h: 0.1 },
  hero: { x: 0, y: 0.08, w: 1, h: 0.35 },
  detail: { x: 0, y: 0.14, w: 1, h: 0.36 },
  stats: { x: 0, y: 0.2, w: 1, h: 0.18 },
  empty: { x: 0, y: 0.25, w: 1, h: 0.45 },
  table: { x: 0, y: 0.28, w: 1, h: 0.46 },
  cards: { x: 0, y: 0.3, w: 1, h: 0.25 },
  chart: { x: 0, y: 0.32, w: 1, h: 0.3 },
  form: { x: 0, y: 0.34, w: 1, h: 0.4 },
  gallery: { x: 0, y: 0.36, w: 1, h: 0.3 },
  list: { x: 0, y: 0.38, w: 1, h: 0.34 },
  other: { x: 0, y: 0.4, w: 1, h: 0.3 },
  content: { x: 0, y: 0.42, w: 1, h: 0.28 },
  logos: { x: 0, y: 0.44, w: 1, h: 0.1 },
  features: { x: 0, y: 0.46, w: 1, h: 0.26 },
  pricing: { x: 0, y: 0.48, w: 1, h: 0.3 },
  sheet: { x: 0, y: 0.52, w: 1, h: 0.4 },
  testimonial: { x: 0, y: 0.6, w: 1, h: 0.2 },
  faq: { x: 0, y: 0.66, w: 1, h: 0.2 },
  // A pay or primary button: low on the screen and narrower than the screen.
  cta: { x: 0.06, y: 0.8, w: 0.88, h: 0.1 },
  footer: { x: 0, y: 0.9, w: 1, h: 0.1 },
  tabbar: { x: 0, y: 0.91, w: 1, h: 0.09 },
  sidebar: { x: 0, y: 0, w: 0.18, h: 1 },
};

/** Tall full page shots: the top and bottom bars are thin, the middle bands about 60% as tall. */
const PAGE_BANDS: Partial<Record<PartRole, Crop>> = {
  nav: { x: 0, y: 0, w: 1, h: 0.04 },
  "status-header": { x: 0, y: 0, w: 1, h: 0.06 },
  hero: { x: 0, y: 0.04, w: 1, h: 0.15 },
  cta: { x: 0.06, y: 0.82, w: 0.88, h: 0.06 },
  footer: { x: 0, y: 0.94, w: 1, h: 0.06 },
  tabbar: { x: 0, y: 0.95, w: 1, h: 0.05 },
  sidebar: { x: 0, y: 0, w: 0.18, h: 1 },
};

/** The middle phone of a presentation shot: a center column with a little room above and below. */
const PHONE = { x: 0.34, y: 0.05, w: 0.32, h: 0.9 };

export function defaultCrop(role: PartRole, ctx: CropContext = {}): Crop {
  const band = ROLE_BANDS[role];
  switch (imageLayout(ctx)) {
    case "page":
      return clampCrop(PAGE_BANDS[role] ?? { ...band, h: band.h * 0.6 });
    case "phones":
      return clampCrop({ x: PHONE.x + band.x * PHONE.w, y: PHONE.y + band.y * PHONE.h, w: band.w * PHONE.w, h: band.h * PHONE.h });
    default:
      return clampCrop(band);
  }
}

const sameCrop = (a: Crop, b: Crop) => (["x", "y", "w", "h"] as const).every((k) => Math.abs(a[k] - b[k]) < 0.005);

/**
 * A guessed crop that differs from every crop in `taken` (crops already cut from the same image):
 * the band moves down by its height, then up, then by half its height. Two parts cut from one image
 * (two cards, a summary and a pay button) never come out identical.
 */
export function distinctCrop(crop: Crop, taken: readonly Crop[]): Crop {
  if (!taken.some((t) => sameCrop(t, crop))) return crop;
  for (const dy of [crop.h, -crop.h, crop.h / 2, -crop.h / 2]) {
    const y = crop.y + dy;
    if (y < 0 || y + crop.h > 1) continue;
    const next = clampCrop({ ...crop, y });
    if (!taken.some((t) => sameCrop(t, next))) return next;
  }
  // Nowhere to move: a tighter band from the same top.
  return clampCrop({ ...crop, h: crop.h * 0.6 });
}
