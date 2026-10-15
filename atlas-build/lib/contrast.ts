/**
 * WCAG 2.x contrast, copied from banana-server/lib/palette/contrast.ts (keep the two in step), plus
 * shipPairs: the palette pairs that pass for body text. The model proposes hex values; this
 * script, never the model, fills IngredientCard.shipPairs (plan 6.3 prompt rules).
 * - Text: 4.5:1 (SC 1.4.3, normal text, level AA).
 * - UI parts and graphics: 3:1 (SC 1.4.11).
 */
import { formatHex, parse, wcagContrast } from "culori";

export const TEXT_MIN = 4.5;
export const UI_MIN = 3;

export type ContrastTag = "ship" | "explore";

export interface ContrastPair {
  fg: string;
  bg: string;
  /** Rounded to 2 decimals for display. Pass/fail uses the unrounded value. */
  ratio: number;
  passesText: boolean;
  passesUi: boolean;
  tag: ContrastTag;
}

/** Lowercase #rrggbb (from banana-server/lib/palette/color.ts). */
export function normalizeHex(input: string): string {
  const parsed = parse(input);
  if (!parsed) throw new Error(`Not a color: ${input}`);
  return formatHex(parsed);
}

/** Unrounded WCAG 2.x contrast ratio between two colors. Order does not matter. */
export function contrastRatio(a: string, b: string): number {
  return wcagContrast(normalizeHex(a), normalizeHex(b));
}

export function evaluatePair(fg: string, bg: string): ContrastPair {
  const f = normalizeHex(fg);
  const g = normalizeHex(bg);
  const raw = contrastRatio(f, g);
  const passesText = raw >= TEXT_MIN;
  return {
    fg: f,
    bg: g,
    ratio: Math.round(raw * 100) / 100,
    passesText,
    passesUi: raw >= UI_MIN,
    tag: passesText ? "ship" : "explore",
  };
}

/**
 * Useful pairs for a palette: each color against the surface, the on-surface color,
 * white and black. Self pairs and repeated pairs (in either order) are skipped. Order is deterministic.
 */
export function contrastPairs(colors: readonly string[], surface?: string, onSurface?: string): ContrastPair[] {
  const backgrounds = [surface, onSurface, "#ffffff", "#000000"]
    .filter((c): c is string => typeof c === "string")
    .map(normalizeHex);
  const seen = new Set<string>();
  const out: ContrastPair[] = [];
  const s = surface ? normalizeHex(surface) : undefined;
  const on = onSurface ? normalizeHex(onSurface) : undefined;
  for (const raw of colors) {
    const color = normalizeHex(raw);
    for (const bg of backgrounds) {
      if (color === bg) continue;
      const key = color < bg ? `${color}|${bg}` : `${bg}|${color}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (color === s && bg === on) out.push(evaluatePair(on, s));
      else out.push(evaluatePair(color, bg));
    }
  }
  return out;
}

export type PaletteEntry = { hex: string; role: "surface" | "ink" | "accent" | "support"; name: string };

/**
 * Every pair of palette colors that passes 4.5:1, as [foreground, background]. The background is
 * the surface color when one of the two is a surface, else the lighter of the two. Each unordered
 * pair appears once, in palette order. Hex values come back lowercase.
 */
export function shipPairs(palette: readonly PaletteEntry[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (let i = 0; i < palette.length; i++) {
    for (let j = i + 1; j < palette.length; j++) {
      const a = palette[i]!;
      const b = palette[j]!;
      const ah = normalizeHex(a.hex);
      const bh = normalizeHex(b.hex);
      if (ah === bh) continue;
      const key = ah < bh ? `${ah}|${bh}` : `${bh}|${ah}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (contrastRatio(ah, bh) < TEXT_MIN) continue;
      let bg: string;
      if (a.role === "surface" && b.role !== "surface") bg = ah;
      else if (b.role === "surface" && a.role !== "surface") bg = bh;
      else bg = luminanceOrder(ah, bh);
      out.push([bg === ah ? bh : ah, bg]);
    }
  }
  return out;
}

/** The lighter of two colors (higher contrast against black). */
function luminanceOrder(a: string, b: string): string {
  return contrastRatio(a, "#000000") >= contrastRatio(b, "#000000") ? a : b;
}
