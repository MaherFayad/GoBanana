/**
 * Canvas layouts (spec section 9). Pure, deterministic, no overlaps.
 *
 * - by_direction: one column per section, 280 px wide, 16 px gaps.
 * - masonry: 4 columns, each item keeps its aspect ratio.
 * - grid: equal square cells (the canvas crops with object-fit: cover).
 * - hero: the first item is 2x a cell, the others sit in rows centered below it.
 *
 * All coordinates are absolute canvas pixels from `origin` (default 0,0). Items keep input
 * order inside each column or row.
 */

export type LayoutKind = "by_direction" | "masonry" | "grid" | "hero";
export const LAYOUTS: readonly LayoutKind[] = ["by_direction", "masonry", "grid", "hero"];

export interface LayoutItem {
  id: string;
  w?: number;
  h?: number;
  /** Width divided by height. Wins over w and h when both are given. */
  aspectRatio?: number;
  sectionId?: string;
}

export interface LayoutSection {
  id: string;
}

export interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutResult {
  items: Rect[];
  /** Section frames (by_direction only). Empty for other layouts. */
  sections: Rect[];
}

export interface LayoutOptions {
  sections?: readonly LayoutSection[];
  origin?: { x: number; y: number };
  /** Column width (by_direction, masonry) or cell size (grid, hero). Default 280. */
  columnWidth?: number;
  gap?: number;
  /** masonry columns (default 4), grid and hero row length (default up to 4). */
  columns?: number;
}

export const COLUMN_WIDTH = 280;
export const GAP = 16;
export const MASONRY_COLUMNS = 4;
export const GRID_MAX_COLUMNS = 4;
/** Room at the top of a section frame for its title. */
export const SECTION_HEADER = 48;
/** Space below the last item inside a section frame. */
export const SECTION_PADDING = 16;

function positive(n: number | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** Aspect ratio (w / h) of an item; 1 when unknown. */
export function aspectOf(item: LayoutItem): number {
  if (positive(item.aspectRatio)) return item.aspectRatio;
  if (positive(item.w) && positive(item.h)) return item.w / item.h;
  return 1;
}

function heightFor(item: LayoutItem, width: number): number {
  return Math.max(1, Math.round(width / aspectOf(item)));
}

function settings(opts: LayoutOptions) {
  return {
    ox: opts.origin?.x ?? 0,
    oy: opts.origin?.y ?? 0,
    col: positive(opts.columnWidth) ? Math.round(opts.columnWidth) : COLUMN_WIDTH,
    gap: typeof opts.gap === "number" && Number.isFinite(opts.gap) && opts.gap >= 0 ? Math.round(opts.gap) : GAP,
  };
}

/** One column per section in `sections` order. Items with no known section go in a last column without a frame. */
export function byDirection(items: readonly LayoutItem[], opts: LayoutOptions = {}): LayoutResult {
  const { ox, oy, col, gap } = settings(opts);
  const sectionIds: string[] = [];
  const add = (id: string) => {
    if (!sectionIds.includes(id)) sectionIds.push(id);
  };
  for (const s of opts.sections ?? []) add(s.id);
  // Sections only named by items (no list given) appear in first-seen order.
  if (!opts.sections) for (const it of items) if (it.sectionId) add(it.sectionId);

  const known = new Set(sectionIds);
  const columns: { sectionId: string | null; items: LayoutItem[] }[] = sectionIds.map((id) => ({
    sectionId: id,
    items: items.filter((it) => it.sectionId === id),
  }));
  const loose = items.filter((it) => !it.sectionId || !known.has(it.sectionId));
  if (loose.length > 0) columns.push({ sectionId: null, items: loose });

  const outItems: Rect[] = [];
  const outSections: Rect[] = [];
  columns.forEach((column, i) => {
    const x = ox + i * (col + gap);
    let y = oy + (column.sectionId ? SECTION_HEADER : 0);
    column.items.forEach((it, j) => {
      if (j > 0) y += gap;
      const h = heightFor(it, col);
      outItems.push({ id: it.id, x, y, w: col, h });
      y += h;
    });
    if (column.sectionId) {
      const bottom = column.items.length > 0 ? y + SECTION_PADDING : oy + SECTION_HEADER + SECTION_PADDING;
      outSections.push({ id: column.sectionId, x, y: oy, w: col, h: bottom - oy });
    }
  });
  return { items: outItems, sections: outSections };
}

/** Shortest-column masonry; each item is one column wide and keeps its aspect ratio. */
export function masonry(items: readonly LayoutItem[], opts: LayoutOptions = {}): LayoutResult {
  const { ox, oy, col, gap } = settings(opts);
  const n = positive(opts.columns) ? Math.floor(opts.columns) : MASONRY_COLUMNS;
  const heights: number[] = Array.from({ length: n }, () => 0);
  const out: Rect[] = [];
  for (const it of items) {
    let c = 0;
    for (let k = 1; k < n; k++) if ((heights[k] ?? 0) < (heights[c] ?? 0)) c = k;
    const top = heights[c] ?? 0;
    const y = top === 0 ? 0 : top + gap;
    const h = heightFor(it, col);
    out.push({ id: it.id, x: ox + c * (col + gap), y: oy + y, w: col, h });
    heights[c] = y + h;
  }
  return { items: out, sections: [] };
}

function gridColumns(count: number, opts: LayoutOptions): number {
  if (positive(opts.columns)) return Math.floor(opts.columns);
  return Math.max(1, Math.min(GRID_MAX_COLUMNS, count));
}

/** Equal square cells, row by row. */
export function grid(items: readonly LayoutItem[], opts: LayoutOptions = {}): LayoutResult {
  const { ox, oy, col, gap } = settings(opts);
  const n = gridColumns(items.length, opts);
  const out = items.map((it, i) => ({
    id: it.id,
    x: ox + (i % n) * (col + gap),
    y: oy + Math.floor(i / n) * (col + gap),
    w: col,
    h: col,
  }));
  return { items: out, sections: [] };
}

/**
 * The first item takes a 2x2 cell block (2 cells plus one gap on each side). The rest go in
 * rows of equal square cells below it, each row centered under the hero.
 */
export function hero(items: readonly LayoutItem[], opts: LayoutOptions = {}): LayoutResult {
  const { ox, oy, col, gap } = settings(opts);
  const [first, ...rest] = items;
  if (!first) return { items: [], sections: [] };
  const heroSize = col * 2 + gap;
  const n = gridColumns(rest.length, opts);
  const rowWidth = (k: number) => k * col + (k - 1) * gap;
  const fullRow = rest.length > 0 ? rowWidth(Math.min(n, rest.length)) : 0;
  const width = Math.max(heroSize, fullRow);

  const out: Rect[] = [
    { id: first.id, x: ox + Math.floor((width - heroSize) / 2), y: oy, w: heroSize, h: heroSize },
  ];
  rest.forEach((it, i) => {
    const row = Math.floor(i / n);
    const inRow = Math.min(n, rest.length - row * n);
    const left = Math.floor((width - rowWidth(inRow)) / 2);
    out.push({
      id: it.id,
      x: ox + left + (i % n) * (col + gap),
      y: oy + heroSize + gap + row * (col + gap),
      w: col,
      h: col,
    });
  });
  return { items: out, sections: [] };
}

export function arrange(layout: LayoutKind, items: readonly LayoutItem[], opts: LayoutOptions = {}): LayoutResult {
  switch (layout) {
    case "by_direction":
      return byDirection(items, opts);
    case "masonry":
      return masonry(items, opts);
    case "grid":
      return grid(items, opts);
    case "hero":
      return hero(items, opts);
  }
}

/** True when any two rectangles overlap (touching edges do not count). */
export function hasOverlap(rects: readonly Rect[]): boolean {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i] as Rect;
      const b = rects[j] as Rect;
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return true;
    }
  }
  return false;
}
