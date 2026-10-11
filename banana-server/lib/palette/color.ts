import { converter, formatHex, parse } from "culori";

/** An OKLCH color with plain numbers. Hue is 0 for achromatic colors. */
export interface OklchColor {
  l: number;
  c: number;
  h: number;
}

const toOklch = converter("oklch");
const toOklab = converter("oklab");

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  const r = Math.round(value * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/** "#rrggbb" from 0..255 channels. */
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp255(v).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Normalize any CSS color (including "#777") to lowercase "#rrggbb". Throws on invalid input. */
export function normalizeHex(input: string): string {
  const parsed = parse(input);
  if (!parsed) throw new Error(`Not a color: ${input}`);
  return formatHex(parsed);
}

/** OKLCH numbers for a hex color. */
export function hexToOklchColor(hex: string): OklchColor {
  const c = toOklch(hex);
  if (!c) throw new Error(`Not a color: ${hex}`);
  const h = c.h === undefined || Number.isNaN(c.h) ? 0 : c.h;
  return { l: c.l, c: c.c, h };
}

/** Format OKLCH as a CSS string, for example "oklch(0.62 0.18 250)". */
export function formatOklch(color: OklchColor): string {
  const hue = color.c < 0.0005 ? 0 : round(color.h, 1) % 360;
  return `oklch(${round(color.l, 3)} ${round(color.c, 3)} ${hue})`;
}

/** Hex to a CSS OKLCH string like "oklch(0.62 0.18 250)". */
export function hexToOklch(hex: string): string {
  return formatOklch(hexToOklchColor(hex));
}

/** CSS OKLCH string (or any CSS color) to "#rrggbb". Out-of-gamut values are clipped to sRGB. */
export function oklchToHex(oklch: string): string {
  const parsed = parse(oklch);
  if (!parsed) throw new Error(`Not a color: ${oklch}`);
  return formatHex(parsed);
}

/** OKLab coordinates, used for perceptual distance. */
export function hexToOklab(hex: string): [number, number, number] {
  const c = toOklab(hex);
  if (!c) throw new Error(`Not a color: ${hex}`);
  return [c.l, c.a, c.b];
}

/** Euclidean distance in OKLab (a "delta E OK"); about 0.02 is a just noticeable difference. */
export function oklabDistance(a: readonly number[], b: readonly number[]): number {
  const dl = (a[0] ?? 0) - (b[0] ?? 0);
  const da = (a[1] ?? 0) - (b[1] ?? 0);
  const db = (a[2] ?? 0) - (b[2] ?? 0);
  return Math.sqrt(dl * dl + da * da + db * db);
}
