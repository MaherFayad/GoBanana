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
  const perImage = Math.max(1, Math.floor(DEFAULT_SAMPLE_BUDGET / Math.max(1, input.images.length)));
  const samples: Uint8Array[] = [];
  input.images.forEach((bytes, index) => {
    const decoded = decodeImage(bytes);
    if (!decoded.ok) {
      skipped.push({ index, format: decoded.format, reason: decoded.reason });
      return;
    }
    samples.push(samplePixels(decoded.rgba, decoded.width, decoded.height, perImage));
  });

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
