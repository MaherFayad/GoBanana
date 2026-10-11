/**
 * Deterministic median-cut color quantizer.
 *
 * Steps:
 * 1. `samplePixels` takes a fixed grid of pixels from each image (no randomness) and skips
 *    near-transparent ones.
 * 2. `medianCut` splits the RGB samples into boxes along their widest channel, cutting at a
 *    value boundary so identical colors always stay together.
 * 3. `quantize` merges boxes that look the same (OKLab distance), drops tiny clusters
 *    (noise, edge blends) and returns the most common colors.
 */
import { hexToOklab, hexToOklchColor, oklabDistance, rgbToHex } from "./color";

/** Pixels with alpha below this are ignored. */
export const MIN_ALPHA = 128;
/** Total sample budget across all images. */
export const DEFAULT_SAMPLE_BUDGET = 20_000;

export interface QuantizedColor {
  hex: string;
  /** Number of samples in this cluster. */
  count: number;
  /** Share of all opaque samples, 0..1. */
  share: number;
}

/**
 * Take at most `maxSamples` opaque pixels from an RGBA buffer on a regular grid.
 * Returns packed RGB triplets.
 */
export function samplePixels(
  rgba: Uint8Array,
  width: number,
  height: number,
  maxSamples: number,
): Uint8Array {
  const total = width * height;
  if (total <= 0 || maxSamples <= 0) return new Uint8Array(0);
  const step = Math.max(1, Math.ceil(Math.sqrt(total / maxSamples)));
  const out: number[] = [];
  for (let y = Math.floor(step / 2); y < height; y += step) {
    for (let x = Math.floor(step / 2); x < width; x += step) {
      const i = (y * width + x) * 4;
      if ((rgba[i + 3] ?? 0) < MIN_ALPHA) continue;
      out.push(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0);
    }
  }
  return Uint8Array.from(out);
}

interface Box {
  idx: number[];
  /** Widest channel (0 r, 1 g, 2 b) and its range. */
  channel: number;
  range: number;
}

function makeBox(rgb: Uint8Array, idx: number[]): Box {
  const min = [255, 255, 255];
  const max = [0, 0, 0];
  for (const p of idx) {
    for (let c = 0; c < 3; c++) {
      const v = rgb[p * 3 + c] ?? 0;
      if (v < (min[c] ?? 0)) min[c] = v;
      if (v > (max[c] ?? 0)) max[c] = v;
    }
  }
  let channel = 0;
  let range = -1;
  for (let c = 0; c < 3; c++) {
    const r = (max[c] ?? 0) - (min[c] ?? 0);
    if (r > range) {
      range = r;
      channel = c;
    }
  }
  return { idx, channel, range };
}

function splitBox(rgb: Uint8Array, box: Box): [Box, Box] | null {
  const ch = box.channel;
  const value = (p: number) => rgb[p * 3 + ch] ?? 0;
  // Stable sort keeps the result fully deterministic for equal values.
  const sorted = [...box.idx].sort((a, b) => value(a) - value(b));
  const mid = value(sorted[Math.floor(sorted.length / 2)] ?? 0);
  // Cut at a value boundary: everything below the median value goes left.
  let cut = sorted.findIndex((p) => value(p) >= mid);
  if (cut <= 0) cut = sorted.findIndex((p) => value(p) > mid);
  if (cut <= 0 || cut >= sorted.length) return null;
  return [makeBox(rgb, sorted.slice(0, cut)), makeBox(rgb, sorted.slice(cut))];
}

/** Median cut into at most `maxBoxes` boxes. Returns the mean color and size of each box. */
export function medianCut(
  rgb: Uint8Array,
  maxBoxes: number,
): { r: number; g: number; b: number; count: number }[] {
  const n = Math.floor(rgb.length / 3);
  if (n === 0) return [];
  const boxes: Box[] = [makeBox(rgb, Array.from({ length: n }, (_, i) => i))];
  while (boxes.length < maxBoxes) {
    let pick = -1;
    let best = 0;
    boxes.forEach((box, i) => {
      if (box.idx.length < 2 || box.range <= 0) return;
      const score = box.idx.length * box.range;
      if (score > best) {
        best = score;
        pick = i;
      }
    });
    if (pick < 0) break;
    const split = splitBox(rgb, boxes[pick] as Box);
    if (!split) break;
    boxes.splice(pick, 1, split[0], split[1]);
  }
  return boxes.map((box) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const p of box.idx) {
      r += rgb[p * 3] ?? 0;
      g += rgb[p * 3 + 1] ?? 0;
      b += rgb[p * 3 + 2] ?? 0;
    }
    const count = box.idx.length;
    return { r: r / count, g: g / count, b: b / count, count };
  });
}

interface Cluster {
  r: number;
  g: number;
  b: number;
  count: number;
  hex: string;
  lab: [number, number, number];
}

function byCountThenHex(a: { count: number; hex: string }, b: { count: number; hex: string }): number {
  return b.count - a.count || (a.hex < b.hex ? -1 : a.hex > b.hex ? 1 : 0);
}

export interface QuantizeOptions {
  /** Colors wanted. */
  size: number;
  /** Clusters closer than this in OKLab are merged. Default 0.06. */
  mergeDistance?: number;
  /** Clusters smaller than this share of samples are dropped as noise. Default 0.01. */
  minShare?: number;
}

/**
 * Quantize packed RGB samples to up to `size` distinct colors, most common first.
 * May return fewer colors when the image has fewer distinct colors.
 */
export function quantize(rgb: Uint8Array, opts: QuantizeOptions): QuantizedColor[] {
  const total = Math.floor(rgb.length / 3);
  if (total === 0) return [];
  const mergeDistance = opts.mergeDistance ?? 0.06;
  const minShare = opts.minShare ?? 0.01;
  const boxes = medianCut(rgb, Math.max(16, opts.size * 3));

  const raw = boxes
    .map((b) => ({ ...b, hex: rgbToHex(b.r, b.g, b.b) }))
    .sort(byCountThenHex);

  // Greedy merge: big clusters absorb nearby smaller ones.
  const clusters: Cluster[] = [];
  for (const box of raw) {
    const lab = hexToOklab(box.hex);
    const near = clusters.find((c) => oklabDistance(c.lab, lab) < mergeDistance);
    if (near) {
      const n = near.count + box.count;
      near.r = (near.r * near.count + box.r * box.count) / n;
      near.g = (near.g * near.count + box.g * box.count) / n;
      near.b = (near.b * near.count + box.b * box.count) / n;
      near.count = n;
      // Keep the identity (lab) of the dominant cluster stable while merging.
    } else {
      clusters.push({ r: box.r, g: box.g, b: box.b, count: box.count, hex: box.hex, lab });
    }
  }
  for (const c of clusters) c.hex = rgbToHex(c.r, c.g, c.b);

  const kept = clusters
    .filter((c) => c.count / total >= minShare)
    .sort(byCountThenHex);

  const chosen = kept.slice(0, opts.size);
  // If the most vivid cluster missed the cut, swap it in for the smallest pick so the
  // palette keeps an accent.
  const vivid = kept
    .slice(opts.size)
    .map((c) => ({ c, chroma: hexToOklchColor(c.hex).c }))
    .filter((v) => v.chroma >= 0.1)
    .sort((a, b) => b.chroma - a.chroma || byCountThenHex(a.c, b.c))[0];
  if (vivid && chosen.length === opts.size) {
    const maxChosenChroma = Math.max(...chosen.map((c) => hexToOklchColor(c.hex).c));
    if (vivid.chroma > maxChosenChroma + 0.05) chosen[chosen.length - 1] = vivid.c;
  }

  return chosen
    .sort(byCountThenHex)
    .map((c) => ({ hex: c.hex, count: c.count, share: c.count / total }));
}
