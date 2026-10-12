/**
 * Default crops (docs/stitch-spec.md "Default crops"). No vision: a band of the source image picked
 * by role, the platform of the source and the image aspect ratio. The agent should pass its own
 * crop when it can see the image; this is only the fallback.
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

export function defaultCrop(role: PartRole, ctx: CropContext = {}): Crop {
  const tall = isFullPageShot(ctx);
  const navH = tall ? 0.04 : 0.08;
  switch (role) {
    case "nav":
      return clampCrop({ x: 0, y: 0, w: 1, h: navH });
    case "hero":
      return clampCrop({ x: 0, y: navH, w: 1, h: tall ? 0.15 : 0.35 });
    case "footer":
    case "tabbar":
      return clampCrop({ x: 0, y: 0.9, w: 1, h: 0.1 });
    case "status-header":
      return clampCrop({ x: 0, y: 0, w: 1, h: 0.14 });
    case "sidebar":
      return clampCrop({ x: 0, y: 0, w: 0.18, h: 1 });
    default:
      // The middle band: below the hero, above the footer.
      return tall ? clampCrop({ x: 0, y: 0.4, w: 1, h: 0.2 }) : clampCrop({ x: 0, y: 0.4, w: 1, h: 0.3 });
  }
}
