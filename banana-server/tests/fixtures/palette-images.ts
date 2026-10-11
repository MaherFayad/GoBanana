/**
 * Tiny test images generated in memory (no binary fixtures committed).
 */
import * as jpegNs from "jpeg-js";
import * as upngNs from "upng-js";

const jpeg: typeof jpegNs = (jpegNs as unknown as { default?: typeof jpegNs }).default ?? jpegNs;
const UPNG: typeof upngNs = (upngNs as unknown as { default?: typeof upngNs }).default ?? upngNs;

export type RGBA = [number, number, number, number];

export function hexToRgba(hex: string, alpha = 255): RGBA {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

/**
 * RGBA buffer split into vertical bands. `bands` is a list of [color, widthInPixels].
 */
export function bandsRgba(bands: [RGBA, number][], height: number): { width: number; height: number; data: Uint8Array } {
  const width = bands.reduce((n, [, w]) => n + w, 0);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    let x = 0;
    for (const [color, w] of bands) {
      for (let k = 0; k < w; k++, x++) data.set(color, (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

export function encodePng(img: { width: number; height: number; data: Uint8Array }): Uint8Array {
  const ab = img.data.buffer.slice(img.data.byteOffset, img.data.byteOffset + img.data.byteLength) as ArrayBuffer;
  return new Uint8Array(UPNG.encode([ab], img.width, img.height, 0));
}

export function encodeJpeg(img: { width: number; height: number; data: Uint8Array }, quality = 95): Uint8Array {
  return new Uint8Array(jpeg.encode({ width: img.width, height: img.height, data: img.data }, quality).data);
}

/** A minimal RIFF/WEBP header; enough for format detection, not a real image. */
export function fakeWebp(): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x52, 0x49, 0x46, 0x46, 24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
  return bytes;
}

/** Twelve clearly different colors, used to test size bounds. */
export const RICH_COLORS = [
  "#ffffff", "#111111", "#e63946", "#1d3557", "#2a9d8f", "#f4a261",
  "#8338ec", "#ffbe0b", "#06d6a0", "#8d99ae", "#ff006e", "#3a5a40",
];

export function richImage(): { width: number; height: number; data: Uint8Array } {
  // Decreasing band widths so populations differ and ordering is unambiguous.
  return bandsRgba(
    RICH_COLORS.map((hex, i) => [hexToRgba(hex), 48 - i * 3] as [RGBA, number]),
    32,
  );
}
