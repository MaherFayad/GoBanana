/**
 * WCAG 2.x contrast (relative luminance ratio, 1 to 21).
 * - Text: 4.5:1 (SC 1.4.3, normal text, level AA).
 * - UI parts and graphics: 3:1 (SC 1.4.11).
 */
import { wcagContrast } from "culori";
import { normalizeHex } from "./color";

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
export function contrastPairs(
  colors: readonly string[],
  surface?: string,
  onSurface?: string,
): ContrastPair[] {
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
      // Pairs are symmetric; keep one per unordered pair.
      const key = color < bg ? `${color}|${bg}` : `${bg}|${color}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Show surface and on-surface the natural way round: on-surface text on surface.
      if (color === s && bg === on) out.push(evaluatePair(on, s));
      else out.push(evaluatePair(color, bg));
    }
  }
  return out;
}
