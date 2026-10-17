/**
 * Screens on a presentation image, found in code (no model): phones or browser windows laid out on
 * a backdrop (R6, bench/BASELINE.md "Refinement R6"). Two finders over a downsampled copy:
 *
 * - backdrop fill: the backdrop is grown from the image border over smooth color (a flat or
 *   gradient backdrop and soft shadows pass, a screen's edge stops it); large foreground blobs
 *   that share columns are one screen each.
 * - columns: the backdrop is the border's median color; a column belongs to a screen when enough
 *   of its samples differ from it, and each run of such columns is one screen, its top and bottom
 *   where its rows stop differing (works on tilted phones with long shadows, where the fill leaks).
 *
 * The fill's answer is used when it passes the checks, else the columns'. The checks: every screen
 * a phone or a window shape and at least a quarter of the image tall, screens side by side without
 * overlap, of about one size, and together leaving some backdrop. Anything else gives no hint, so
 * overlapping, cropped or full bleed shots get none.
 *
 * Pure: takes decoded RGBA, keeps nothing.
 */
import type { Crop } from "@/lib/stitch/types";

export type ScreenBox = Crop;

/** Sampling: about this many columns across the image. */
const SAMPLES = 400;
/** Fill: largest color step (sum of channel differences) between neighbouring samples the backdrop crosses. */
const STEP_DIST = 12;
/** Fill: largest distance from its border seed the backdrop may drift to. */
const DRIFT_DIST = 150;
/** Columns: distance from the backdrop color above which a sample is foreground. */
const FG_DIST = 60;
/** Columns: share of a column's samples that must be foreground for it to belong to a screen. */
const COL_ON = 0.3;
/** Columns: share of a row's samples (inside one run) that must be foreground for it to belong to that screen. */
const ROW_ON = 0.5;
/** Columns: border samples farther than FG_DIST from the backdrop color (as a share) mean no plain backdrop. */
const BORDER_NOISE = 0.25;
/** Width over height of one phone screen (portrait, tilted a little) or one window. */
const PHONE = [0.3, 0.8] as const;
const WINDOW = [0.95, 2.6] as const;

type Grid = { rgb: Float32Array; cols: number; rows: number; step: number; width: number; height: number };
/** A box in samples, ends included. */
type Span = { x0: number; x1: number; y0: number; y1: number };

/** Each sample is the average of its step x step cell, which also smooths JPEG noise. */
function sample(rgba: Uint8Array, width: number, height: number): Grid {
  const step = Math.max(1, Math.round(width / SAMPLES));
  const cols = Math.floor(width / step);
  const rows = Math.floor(height / step);
  const rgb = new Float32Array(cols * rows * 3);
  const s = step * step;
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < step; dy++)
        for (let dx = 0; dx < step; dx++) {
          const i = ((cy * step + dy) * width + cx * step + dx) * 4;
          r += rgba[i]!;
          g += rgba[i + 1]!;
          b += rgba[i + 2]!;
        }
      const k = (cy * cols + cx) * 3;
      rgb[k] = r / s;
      rgb[k + 1] = g / s;
      rgb[k + 2] = b / s;
    }
  return { rgb, cols, rows, step, width, height };
}

const neighbours = (i: number, cols: number, rows: number) => {
  const x = i % cols;
  const y = (i - x) / cols;
  return [x > 0 ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, y > 0 ? i - cols : -1, y < rows - 1 ? i + cols : -1];
};

function fillScreens(g: Grid): Span[] {
  const { rgb, cols, rows } = g;
  const n = cols * rows;
  const dist = (a: number, b: number) => Math.abs(rgb[a * 3]! - rgb[b * 3]!) + Math.abs(rgb[a * 3 + 1]! - rgb[b * 3 + 1]!) + Math.abs(rgb[a * 3 + 2]! - rgb[b * 3 + 2]!);
  const seed = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const push = (i: number) => {
    if (seed[i]! >= 0) return;
    seed[i] = i;
    queue[tail++] = i;
  };
  for (let cx = 0; cx < cols; cx++) {
    push(cx);
    push((rows - 1) * cols + cx);
  }
  for (let cy = 0; cy < rows; cy++) {
    push(cy * cols);
    push(cy * cols + cols - 1);
  }
  while (head < tail) {
    const i = queue[head++]!;
    for (const j of neighbours(i, cols, rows)) {
      if (j < 0 || seed[j]! >= 0) continue;
      if (dist(i, j) <= STEP_DIST && dist(seed[i]!, j) <= DRIFT_DIST) {
        seed[j] = seed[i]!;
        queue[tail++] = j;
      }
    }
  }
  const label = new Int32Array(n).fill(-1);
  const blobs: Span[] = [];
  for (let start = 0; start < n; start++) {
    if (seed[start]! >= 0 || label[start]! >= 0) continue;
    const blob: Span = { x0: cols, x1: -1, y0: rows, y1: -1 };
    head = tail = 0;
    label[start] = blobs.length;
    queue[tail++] = start;
    while (head < tail) {
      const i = queue[head++]!;
      const x = i % cols;
      const y = (i - x) / cols;
      blob.x0 = Math.min(blob.x0, x);
      blob.x1 = Math.max(blob.x1, x);
      blob.y0 = Math.min(blob.y0, y);
      blob.y1 = Math.max(blob.y1, y);
      for (const j of neighbours(i, cols, rows)) {
        if (j < 0 || seed[j]! >= 0 || label[j]! >= 0) continue;
        label[j] = blobs.length;
        queue[tail++] = j;
      }
    }
    blobs.push(blob);
  }
  // Big blobs only; blobs that share most of their columns are one screen (content cut off from its frame).
  const width = (b: Span) => b.x1 - b.x0 + 1;
  const big = blobs.filter((b) => width(b) * (b.y1 - b.y0 + 1) >= n * 0.02).sort((a, b) => a.x0 - b.x0);
  const merged: Span[] = [];
  for (const b of big) {
    const m = merged.find((o) => Math.min(o.x1, b.x1) - Math.max(o.x0, b.x0) + 1 >= 0.5 * Math.min(width(o), width(b)));
    if (m) Object.assign(m, { x0: Math.min(m.x0, b.x0), x1: Math.max(m.x1, b.x1), y0: Math.min(m.y0, b.y0), y1: Math.max(m.y1, b.y1) });
    else merged.push({ ...b });
  }
  return merged;
}

function columnScreens(g: Grid): Span[] {
  const { rgb, cols, rows } = g;
  const border: number[] = [];
  for (let cx = 0; cx < cols; cx++) border.push(cx, cols + cx, (rows - 2) * cols + cx, (rows - 1) * cols + cx);
  for (let cy = 0; cy < rows; cy++) border.push(cy * cols, cy * cols + 1, cy * cols + cols - 2, cy * cols + cols - 1);
  const median = (k: number) => border.map((i) => rgb[i * 3 + k]!).sort((a, b) => a - b)[border.length >> 1]!;
  const bg = [median(0), median(1), median(2)];
  const far = (i: number) => Math.abs(rgb[i * 3]! - bg[0]!) + Math.abs(rgb[i * 3 + 1]! - bg[1]!) + Math.abs(rgb[i * 3 + 2]! - bg[2]!) > FG_DIST;
  if (border.filter(far).length / border.length > BORDER_NOISE) return [];
  const runs: Span[] = [];
  for (let cx = 0; cx < cols; cx++) {
    let on = 0;
    for (let cy = 0; cy < rows; cy++) on += far(cy * cols + cx) ? 1 : 0;
    if (on / rows < COL_ON) continue;
    const last = runs[runs.length - 1];
    // Bridge gaps under 1% of the width (a dark notch, a thin seam).
    if (last && cx - last.x1 <= Math.max(1, Math.round(cols * 0.01))) last.x1 = cx;
    else runs.push({ x0: cx, x1: cx, y0: -1, y1: -1 });
  }
  const out: Span[] = [];
  for (const r of runs.filter((s) => s.x1 - s.x0 + 1 >= cols * 0.08)) {
    for (let cy = 0; cy < rows; cy++) {
      let on = 0;
      for (let cx = r.x0; cx <= r.x1; cx++) on += far(cy * cols + cx) ? 1 : 0;
      if (on / (r.x1 - r.x0 + 1) < ROW_ON) continue;
      if (r.y0 < 0) r.y0 = cy;
      r.y1 = cy;
    }
    if (r.y0 >= 0) out.push(r);
  }
  return out;
}

/** Spans to image fractions, or [] when they fail the checks in the header. */
function checked(spans: readonly Span[], g: Grid): ScreenBox[] {
  if (spans.length === 0 || spans.length > 6) return [];
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const boxes = [...spans]
    .sort((a, b) => a.x0 - b.x0)
    .map((s) => {
      const x = (s.x0 * g.step) / g.width;
      const y = (s.y0 * g.step) / g.height;
      return { x: r3(x), y: r3(y), w: r3(Math.min(1, ((s.x1 + 1) * g.step) / g.width) - x), h: r3(Math.min(1, ((s.y1 + 1) * g.step) / g.height) - y) };
    });
  for (const b of boxes) {
    const aspect = (b.w * g.width) / (b.h * g.height);
    if (!((aspect >= PHONE[0] && aspect <= PHONE[1]) || (aspect >= WINDOW[0] && aspect <= WINDOW[1]))) return [];
    if (b.h < (boxes.length === 1 ? 0.5 : 0.25)) return [];
  }
  for (let i = 1; i < boxes.length; i++) if (boxes[i]!.x < boxes[i - 1]!.x + boxes[i - 1]!.w) return [];
  const mid = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;
  const mw = mid(boxes.map((b) => b.w));
  const mh = mid(boxes.map((b) => b.h));
  if (boxes.some((b) => Math.abs(b.w - mw) > 0.25 * mw || Math.abs(b.h - mh) > 0.3 * mh)) return [];
  // One box that fills the image is not a presentation.
  if (boxes.length === 1 && boxes[0]!.w * boxes[0]!.h > 0.85) return [];
  return boxes;
}

export function detectScreens(rgba: Uint8Array, width: number, height: number): ScreenBox[] {
  if (!(width > 32 && height > 32) || rgba.length < width * height * 4) return [];
  const g = sample(rgba, width, height);
  const fill = checked(fillScreens(g), g);
  return fill.length ? fill : checked(columnScreens(g), g);
}

/** The look line for the found screens, or null when there are none. */
export function screensLine(boxes: readonly ScreenBox[]): string | null {
  if (boxes.length === 0) return null;
  const f = (v: number) => v.toFixed(2);
  const list = boxes.map((b, i) => `screen ${i + 1}: x ${f(b.x)} to ${f(b.x + b.w)}, y ${f(b.y)} to ${f(b.y + b.h)}`).join("; ");
  return `Screens found in code on this image (fractions of the whole image, counted from the left; edges may include a device frame or a shadow): ${list}. Each part sits inside one of them.`;
}
