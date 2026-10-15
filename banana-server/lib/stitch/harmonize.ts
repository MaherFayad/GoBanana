/**
 * Harmonize view of a Frankenstein page (P0-11): a duotone per page. Each part is turned to
 * luminance, then dark tones map to the direction's ink color and light tones to its surface
 * color, so parts from three sources read as one palette. The browser does it with an inline SVG
 * filter (`feColorMatrix` to luminance, then `feComponentTransfer`); nothing is fetched or cut.
 *
 * Pure and dependency free: the canvas UI bundle and the tools share it.
 */
import type { HarmonizeColors } from "./types";

/** WCAG 2.x text contrast the ink and surface must reach to be used (SC 1.4.3, AA). */
export const HARMONIZE_MIN_CONTRAST = 4.5;

/** Rec. 709 luminance weights, the same ones WCAG relative luminance uses. */
export const LUMINANCE_MATRIX = [
  "0.2126 0.7152 0.0722 0 0",
  "0.2126 0.7152 0.0722 0 0",
  "0.2126 0.7152 0.0722 0 0",
  "0 0 0 1 0",
].join(" ");

/** sRGB channels 0 to 1 from `#rgb` or `#rrggbb` (any case, spaces trimmed), else null. */
export function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, "");
  const full = /^[0-9a-f]{3}$/i.test(h) ? [...h].map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function linear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an sRGB color. */
export function relativeLuminance([r, g, b]: readonly [number, number, number]): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio of two hex colors, or 1 when either does not parse. */
export function hexContrast(a: string, b: string): number {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return 1;
  const [hi, lo] = [relativeLuminance(x), relativeLuminance(y)].sort((m, n) => n - m) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const toHex = (rgb: readonly number[]) => `#${rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;

/** `#rrggbb` from a computed CSS color (a hex value or an rgb function), else null. */
export function cssColorToHex(value: string): string | null {
  const v = value.trim();
  const rgb = hexToRgb(v);
  if (rgb) return toHex(rgb);
  const m = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/i.exec(v);
  if (!m) return null;
  return toHex([m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)) / 255));
}

/**
 * Ink and surface from a palette (a direction's reconciled colors): the darkest and the lightest
 * color. When that pair is under 4.5:1, ink is darkened and surface lightened in steps (same hues)
 * until it passes, so the page stays legible and still reads in the direction's colors.
 * Undefined when the palette has fewer than two distinct colors: the view then uses the neutral
 * ink and surface tokens.
 */
export function harmonizeFromPalette(palette: readonly { hex: string }[] | undefined | null): HarmonizeColors | undefined {
  const colors = (palette ?? []).flatMap((c) => {
    const rgb = typeof c?.hex === "string" ? hexToRgb(c.hex) : null;
    return rgb ? [{ rgb, l: relativeLuminance(rgb) }] : [];
  });
  if (colors.length < 2) return undefined;
  const sorted = [...colors].sort((a, b) => a.l - b.l);
  const dark = sorted[0]!.rgb;
  const light = sorted[sorted.length - 1]!.rgb;
  if (toHex(dark) === toHex(light)) return undefined;
  for (let step = 0; step <= 10; step++) {
    const t = step / 10;
    const ink = toHex(dark.map((c) => c * (1 - t)));
    const surface = toHex(light.map((c) => c + (1 - c) * t));
    if (hexContrast(ink, surface) >= HARMONIZE_MIN_CONTRAST) return { ink, surface };
  }
  return undefined;
}

/** `tableValues` for `feFuncR`, `feFuncG` and `feFuncB`: luminance 0 maps to ink, 1 to surface. */
export function duotoneTables(colors: HarmonizeColors): { r: string; g: string; b: string } | null {
  const ink = hexToRgb(colors.ink);
  const surface = hexToRgb(colors.surface);
  if (!ink || !surface) return null;
  const pair = (i: number) => `${round(ink[i]!)} ${round(surface[i]!)}`;
  return { r: pair(0), g: pair(1), b: pair(2) };
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;

/** An id usable in `url(#...)` for one page's filter. */
export function harmonizeFilterId(pageKey: string): string {
  return `bn-harmonize-${pageKey.replace(/[^A-Za-z0-9_-]/g, "")}`;
}
