/**
 * Palette extraction from in-memory image bytes.
 *
 * extractPalette decodes each image (JPEG, PNG), samples pixels on a fixed grid, runs a
 * deterministic median-cut quantizer, assigns roles from OKLCH and checks WCAG contrast.
 * Bytes are only read; nothing is stored, cached or logged.
 */
import { hexToOklch } from "./color";
import { contrastPairs, type ContrastPair } from "./contrast";
import { decodeImage, type ImageFormat } from "./decode";
import { DEFAULT_SAMPLE_BUDGET, quantize, samplePixels } from "./quantize";
import { assignRoles, type Role } from "./roles";

export { hexToOklch, oklchToHex, normalizeHex } from "./color";
export { contrastRatio, contrastPairs, evaluatePair, TEXT_MIN, UI_MIN } from "./contrast";
export type { ContrastPair, ContrastTag } from "./contrast";
export { decodeImage, detectFormat } from "./decode";
export type { DecodeResult, ImageFormat } from "./decode";
export { fetchThumbIntoMemory, isAllowedUrl } from "./fetch";
export type { FetchThumbOptions, FetchThumbResult } from "./fetch";
export { assignRoles, ROLES } from "./roles";
export type { Role } from "./roles";

export const MIN_SIZE = 5;
export const MAX_SIZE = 9;
export const DEFAULT_SIZE = 6;

export interface PaletteColor {
  hex: string;
  oklch: string;
  role: Role;
}

export interface SkippedImage {
  index: number;
  format: ImageFormat;
  reason: "unsupported_format" | "decode_failed" | "too_large";
}

export interface ExtractPaletteInput {
  images: readonly Uint8Array[];
  /** 5 to 9, default 6. */
  size?: number;
  /**
   * Relative weight per image (same order as `images`), default 1 each. An image of weight 3 gets
   * three times the samples, so its colors count three times (reconcile_direction: great images).
   */
  weights?: readonly number[];
}

export interface ExtractPaletteResult {
  /**
   * Up to `size` colors, ordered by role. Fewer when the images hold fewer distinct colors
   * (for example a two-color image gives two colors).
   */
  palette: PaletteColor[];
  contrast: ContrastPair[];
  /** Images that could not be decoded (for example WebP), so the tool can say so. */
  skipped: SkippedImage[];
}

export function extractPalette(input: ExtractPaletteInput): ExtractPaletteResult {
  const size = input.size ?? DEFAULT_SIZE;
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    throw new RangeError(`size must be an integer from ${MIN_SIZE} to ${MAX_SIZE}`);
  }

  const skipped: SkippedImage[] = [];
  const weightOf = (i: number) => {
    const w = input.weights?.[i];
    return typeof w === "number" && Number.isFinite(w) && w > 0 ? w : 1;
  };
  const totalWeight = input.images.reduce((n, _b, i) => n + weightOf(i), 0);
  const samples: Uint8Array[] = [];
  const weightsRead: number[] = [];
  input.images.forEach((bytes, index) => {
    const decoded = decodeImage(bytes);
    if (!decoded.ok) {
      skipped.push({ index, format: decoded.format, reason: decoded.reason });
      return;
    }
    const perImage = Math.max(1, Math.floor((DEFAULT_SAMPLE_BUDGET * weightOf(index)) / Math.max(1, totalWeight)));
    samples.push(samplePixels(decoded.rgba, decoded.width, decoded.height, perImage));
    weightsRead.push(weightOf(index));
  });
  // Small images give fewer samples than their share. With uneven weights, trim each image's
  // samples so the counts follow the weights exactly (whole pixels only).
  if (new Set(weightsRead).size > 1) {
    const unit = Math.min(...samples.map((s, i) => s.length / 3 / weightsRead[i]!));
    samples.forEach((s, i) => {
      const count = s.length / 3;
      const keep = Math.max(1, Math.floor(unit * weightsRead[i]!));
      if (keep >= count) return;
      // Evenly spaced, so the kept pixels still cover the whole image.
      const out = new Uint8Array(keep * 3);
      for (let j = 0; j < keep; j++) out.set(s.subarray(Math.floor((j * count) / keep) * 3, Math.floor((j * count) / keep) * 3 + 3), j * 3);
      samples[i] = out;
    });
  }

  const totalLength = samples.reduce((n, s) => n + s.length, 0);
  const rgb = new Uint8Array(totalLength);
  let offset = 0;
  for (const s of samples) {
    rgb.set(s, offset);
    offset += s.length;
  }

  const colors = quantize(rgb, { size });
  const roled = assignRoles(colors.map((c) => ({ hex: c.hex, weight: c.count })));
  const palette: PaletteColor[] = roled.map((c) => ({ hex: c.hex, oklch: hexToOklch(c.hex), role: c.role }));

  const surface = roled.find((c) => c.role === "surface")?.hex;
  const onSurface = roled.find((c) => c.role === "on-surface")?.hex;
  const contrast = contrastPairs(
    palette.map((p) => p.hex),
    surface,
    onSurface,
  );

  return { palette, contrast, skipped };
}

/** Crop rectangle as fractions (0 to 1) of the image, as Frankenstein parts store it. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Main colors (hex, most common first, at most `count`) inside a crop of one image. Empty when the
 * image cannot be decoded or the crop is empty. Bytes are only read.
 */
export function cropColors(bytes: Uint8Array, crop: CropRect, count = 3): string[] {
  const decoded = decodeImage(bytes);
  if (!decoded.ok) return [];
  const clamp = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
  const x0 = Math.floor(clamp(crop.x) * decoded.width);
  const y0 = Math.floor(clamp(crop.y) * decoded.height);
  const x1 = Math.ceil(clamp(crop.x + crop.w) * decoded.width);
  const y1 = Math.ceil(clamp(crop.y + crop.h) * decoded.height);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return [];
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const from = ((y0 + y) * decoded.width + x0) * 4;
    rgba.set(decoded.rgba.subarray(from, from + w * 4), y * w * 4);
  }
  const colors = quantize(samplePixels(rgba, w, h, 4000), { size: Math.max(MIN_SIZE, count) });
  return colors.slice(0, count).map((c) => c.hex);
}
