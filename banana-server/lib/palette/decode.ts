/**
 * In-memory image decoding for palette extraction.
 *
 * Bytes never leave memory: nothing here touches disk, caches or logs.
 *
 * - JPEG: jpeg-js (pure JS, typed-array mode so it does not need Node's Buffer).
 * - PNG: upng-js (pure JS, uses pako for inflate).
 * - WebP: not supported yet. Recommended path is `@jsquash/webp` (libwebp compiled to wasm,
 *   ESM, documented for Cloudflare Workers by importing the .wasm module and calling its
 *   `init()` with it). Not installed; WebP input returns `unsupported_format` for now.
 * - GIF and anything else: `unsupported_format`.
 */
import * as jpegNs from "jpeg-js";
import * as upngNs from "upng-js";

export type ImageFormat = "jpeg" | "png" | "webp" | "gif" | "unknown";

export interface DecodedImage {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row major. */
  rgba: Uint8Array;
}

export type DecodeResult =
  | ({ ok: true; format: "jpeg" | "png" } & DecodedImage)
  | { ok: false; format: ImageFormat; reason: "unsupported_format" | "decode_failed" | "too_large" };

/** Images above this many pixels are refused before decoding (thumbnails are far smaller). */
export const MAX_PIXELS = 16_000_000;

// Both libraries are CommonJS. Depending on the bundler the functions sit on the namespace
// or on its `default` export, so resolve them once.
type JpegModule = typeof jpegNs;
type UpngModule = typeof upngNs;
const jpeg: JpegModule =
  (jpegNs as unknown as { default?: JpegModule }).default ?? jpegNs;
const UPNG: UpngModule =
  (upngNs as unknown as { default?: UpngModule }).default ?? upngNs;

export function detectFormat(bytes: Uint8Array): ImageFormat {
  const b = (i: number) => bytes[i] ?? -1;
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "jpeg";
  if (
    b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47 &&
    b(4) === 0x0d && b(5) === 0x0a && b(6) === 0x1a && b(7) === 0x0a
  ) {
    return "png";
  }
  if (
    b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 &&
    b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50
  ) {
    return "webp";
  }
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38) return "gif";
  return "unknown";
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Read PNG width and height from the IHDR chunk without inflating anything. */
function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function decodeJpeg(bytes: Uint8Array): DecodeResult {
  try {
    const img = jpeg.decode(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: MAX_PIXELS / 1_000_000,
      maxMemoryUsageInMB: 256,
    });
    return { ok: true, format: "jpeg", width: img.width, height: img.height, rgba: img.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const tooLarge = /maxResolutionInMP|maxMemoryUsageInMB/.test(message);
    return { ok: false, format: "jpeg", reason: tooLarge ? "too_large" : "decode_failed" };
  }
}

function decodePng(bytes: Uint8Array): DecodeResult {
  const size = pngSize(bytes);
  if (!size) return { ok: false, format: "png", reason: "decode_failed" };
  if (size.width * size.height > MAX_PIXELS) return { ok: false, format: "png", reason: "too_large" };
  try {
    const img = UPNG.decode(toArrayBuffer(bytes));
    const frames = UPNG.toRGBA8(img);
    const first = frames[0];
    if (!first) return { ok: false, format: "png", reason: "decode_failed" };
    return { ok: true, format: "png", width: img.width, height: img.height, rgba: new Uint8Array(first) };
  } catch {
    return { ok: false, format: "png", reason: "decode_failed" };
  }
}

/** Decode JPEG or PNG bytes to RGBA in memory. Never throws. */
export function decodeImage(bytes: Uint8Array): DecodeResult {
  const format = detectFormat(bytes);
  switch (format) {
    case "jpeg":
      return decodeJpeg(bytes);
    case "png":
      return decodePng(bytes);
    default:
      return { ok: false, format, reason: "unsupported_format" };
  }
}
