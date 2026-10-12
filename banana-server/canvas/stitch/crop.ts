/**
 * Crop math for stitch slots and the crop editor. Pure, so Vitest covers it.
 *
 * A part is a crop rectangle (fractions 0 to 1) over a hotlinked image. The browser shows it
 * with CSS only (hard rule: never download or cut image bytes): an overflow hidden box with the
 * crop's aspect ratio, and the image inside it scaled to 1 / crop.w of the box width and moved
 * by -crop.x and -crop.y of its own size (translate percentages are relative to the image).
 */
import { clampCrop, type Crop, type PartTheme, type StitchMode, type StitchPlatform } from "@/lib/stitch/types";

/** Image aspect (width / height) to assume before the image has loaded and has no known size. */
export const FALLBACK_IMAGE_ASPECT: Record<StitchPlatform, number> = {
  mobile: 390 / 844,
  tablet: 834 / 1194,
  website: 1440 / 900,
  webapp: 1440 / 900,
};

/** Width / height of the cropped box: (crop.w * imgW) / (crop.h * imgH). */
export function cropAspect(crop: Crop, imageAspect: number): number {
  const c = clampCrop(crop);
  const a = Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect : 1;
  return (c.w * a) / c.h;
}

/**
 * The URL a crop shows: the source CDN's own large size instead of a giant original, same aspect.
 * A Dribbble original can be 7000px wide and 6 MB; a page decoding several of those fails some of
 * them ("Image not available"). Dribbble `resize=1600x` and Pinterest `/1200x/` keep the aspect,
 * so crop fractions stay true. Any other URL comes back unchanged.
 */
export function displaySrc(src: string): string {
  let u: URL;
  try {
    u = new URL(src);
  } catch {
    return src;
  }
  const host = u.hostname.toLowerCase();
  if (host === "cdn.dribbble.com" && !u.searchParams.has("resize")) {
    u.searchParams.set("resize", "1600x");
    return u.toString();
  }
  if (host === "i.pinimg.com" && /^\/originals\//.test(u.pathname)) {
    u.pathname = u.pathname.replace(/^\/originals\//, "/1200x/");
    return u.toString();
  }
  return src;
}

/** Image aspect from known pixel sizes, or null. */
export function imageAspectOf(w?: number | null, h?: number | null): number | null {
  return w && h && w > 0 && h > 0 ? w / h : null;
}

const pct = (n: number) => `${Math.round(n * 1e4) / 1e4}%`;

export interface CropStyles {
  box: { aspectRatio: string };
  /** The crop at its own aspect, scaled to cover the box when a row stretches it taller. */
  fit: { aspectRatio: string; width: string };
  img: { width: string; transform: string };
}

/** Inline styles for the crop box and the image inside it. */
export function cropStyles(crop: Crop, imageAspect: number): CropStyles {
  const c = clampCrop(crop);
  const aspect = cropAspect(c, imageAspect);
  const ratio = `${Math.round(aspect * 1e4) / 1e4}`;
  return {
    box: { aspectRatio: ratio },
    fit: { aspectRatio: ratio, width: `max(100cqw, calc(100cqh * ${ratio}))` },
    img: {
      width: pct(100 / c.w),
      transform: `translate(${pct(-c.x * 100)}, ${pct(-c.y * 100)})`,
    },
  };
}

/** CSS filter for a slot in a view mode. Collage shows parts as they are. */
export function slotFilter(mode: StitchMode, theme: PartTheme | undefined): string | undefined {
  if (mode === "wireframe") return "grayscale(1) contrast(0.9) blur(0.4px) brightness(1.08)";
  if (mode === "even") return theme === "dark" ? "invert(1) hue-rotate(180deg) saturate(0.8)" : "saturate(0.8)";
  return undefined;
}

/** Crop presets in the editor. */
export const CROP_PRESETS: readonly { id: string; label: string; crop: Crop }[] = [
  { id: "top", label: "Top band", crop: { x: 0, y: 0, w: 1, h: 0.1 } },
  { id: "hero", label: "Hero", crop: { x: 0, y: 0.08, w: 1, h: 0.35 } },
  { id: "bottom", label: "Bottom band", crop: { x: 0, y: 0.9, w: 1, h: 0.1 } },
  { id: "left", label: "Left rail", crop: { x: 0, y: 0, w: 0.18, h: 1 } },
  { id: "middle", label: "Middle", crop: { x: 0, y: 0.3, w: 1, h: 0.4 } },
];

export type CropHandle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const MIN = 0.02;

/**
 * Apply a pointer drag of (dx, dy), as fractions of the image, to a crop from `handle`.
 * Moving keeps the size and stays inside the image; edges stop at the opposite edge minus MIN.
 */
export function dragCrop(start: Crop, handle: CropHandle, dx: number, dy: number): Crop {
  if (handle === "move") {
    return {
      x: Math.min(1 - start.w, Math.max(0, start.x + dx)),
      y: Math.min(1 - start.h, Math.max(0, start.y + dy)),
      w: start.w,
      h: start.h,
    };
  }
  let x0 = start.x;
  let y0 = start.y;
  let x1 = start.x + start.w;
  let y1 = start.y + start.h;
  if (handle.includes("w")) x0 = Math.min(x1 - MIN, Math.max(0, x0 + dx));
  if (handle.includes("e")) x1 = Math.max(x0 + MIN, Math.min(1, x1 + dx));
  if (handle.includes("n")) y0 = Math.min(y1 - MIN, Math.max(0, y0 + dy));
  if (handle.includes("s")) y1 = Math.max(y0 + MIN, Math.min(1, y1 + dy));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Crop as whole percents for the number fields. */
export function toPercent(c: Crop): Crop {
  const r = (n: number) => Math.round(n * 1000) / 10;
  return { x: r(c.x), y: r(c.y), w: r(c.w), h: r(c.h) };
}

/** One number field changed (percent): clamp the result into the image. */
export function fromPercentField(c: Crop, field: keyof Crop, percent: number): Crop {
  if (!Number.isFinite(percent)) return c;
  return clampCrop({ ...c, [field]: percent / 100 });
}
