/**
 * Canvas layouts (spec section 9). Pure, deterministic, no overlaps.
 *
 * - spread: each section is one horizontal spread (lead art 2x, notes, a 3 column UI grid,
 *   swatches and type samples under it); sections stack top to bottom (canvas/layout-adapter.ts).
 * - by_direction: one column per section, 280 px wide, 16 px gaps.
 * - masonry: 4 columns, each item keeps its aspect ratio.
 * - grid: equal square cells (the canvas crops with object-fit: cover).
 * - hero: the first item is 2x a cell, the others sit in rows centered below it.
 *
 * All coordinates are absolute canvas pixels from `origin` (default 0,0). Items keep input
 * order inside each column or row.
 *
 * Zones (wild directions v2): inside a section, art direction items (`zone: "art"`) sit in their
 * own block on top and UI items below, each block under a ZONE_LABEL_SPACE strip where the canvas
 * draws its label ("Art direction", "UI references"). Sections without art items look as before.
 */

export type LayoutKind = "spread" | "by_direction" | "masonry" | "grid" | "hero";
/** `spread` first: it is the moodboard default (P0-13). */
export const LAYOUTS: readonly LayoutKind[] = ["spread", "by_direction", "masonry", "grid", "hero"];

export interface LayoutItem {
  id: string;
  w?: number;
  h?: number;
  /** Width divided by height. Wins over w and h when both are given. */
  aspectRatio?: number;
  sectionId?: string;
  /** "art" for art direction items. Missing means a UI item. */
  zone?: "ui" | "art";
  /** What the item is, for layouts that place kinds apart (spread). Missing means a reference image. */
  kind?: "image" | "note" | "swatch" | "typeSample";
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
  /** by_direction: vertical gap between items in a column. Default `gap`. */
  rowGap?: number;
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
/** Room above a zone block for its label, when a section has art direction items. */
export const ZONE_LABEL_SPACE = 28;

/** Art items first, then UI items, each keeping input order. */
export function splitZones<T extends { zone?: "ui" | "art" }>(items: readonly T[]): { art: T[]; ui: T[] } {
  return { art: items.filter((it) => it.zone === "art"), ui: items.filter((it) => it.zone !== "art") };
}

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
  const rowGap = typeof opts.rowGap === "number" && Number.isFinite(opts.rowGap) && opts.rowGap >= 0 ? Math.round(opts.rowGap) : gap;
  columns.forEach((column, i) => {
    const x = ox + i * (col + gap);
    let y = oy + (column.sectionId ? SECTION_HEADER : 0);
    // In a section with art direction items: the art block on top, the UI block below, each labelled.
    const { art, ui } = splitZones(column.items);
    const zoned = column.sectionId !== null && art.length > 0;
    const ordered = zoned ? [...art, ...ui] : column.items;
    if (zoned) y += ZONE_LABEL_SPACE;
    ordered.forEach((it, j) => {
      if (j > 0) y += rowGap;
      if (zoned && j === art.length) y += ZONE_LABEL_SPACE;
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

/** Lead art width in a spread: two columns plus nothing between (2x a 280 px tile). */
export const SPREAD_LEAD_WIDTH = COLUMN_WIDTH * 2;
/** UI reference columns in a spread (3 by 2 for the usual 6). */
export const SPREAD_UI_COLUMNS = 3;
/** Tallest the lead art gets, as a multiple of its width (the canvas covers the box). */
export const SPREAD_LEAD_MAX_RATIO = 1.5;

/**
 * One direction as a horizontal spread (P0-13), from `origin`:
 * - left: the lead art item (the first art direction item) at 2x, other art below it in 2 columns
 * - beside it: the notes (mechanic note and twist), one column
 * - right: the UI references in a 3 column grid at 280 px (rows as tall as their tallest item)
 * - under all of it: palette swatches and type samples in one row, at their own size.
 * When the spread has art, a ZONE_LABEL_SPACE strip on top leaves room for the "Art direction"
 * label. Blocks with no items take no room. Items keep input order inside each block.
 */
export function spread(items: readonly LayoutItem[], opts: LayoutOptions = {}): LayoutResult {
  const { ox, oy, col, gap } = settings(opts);
  const kindOf = (it: LayoutItem) => it.kind ?? "image";
  const art = items.filter((it) => kindOf(it) === "image" && it.zone === "art");
  const notes = items.filter((it) => kindOf(it) === "note");
  const ui = items.filter((it) => kindOf(it) === "image" && it.zone !== "art");
  const under = items.filter((it) => kindOf(it) === "swatch" || kindOf(it) === "typeSample");
  const out: Rect[] = [];
  const top = oy + (art.length > 0 ? ZONE_LABEL_SPACE : 0);
  let x = ox;
  let bottom = top;
  const place = (it: LayoutItem, rx: number, ry: number, w: number, h: number) => {
    out.push({ id: it.id, x: rx, y: ry, w, h });
    bottom = Math.max(bottom, ry + h);
  };

  const [lead, ...moreArt] = art;
  if (lead) {
    const leadW = col * 2;
    const leadH = Math.min(heightFor(lead, leadW), Math.round(leadW * SPREAD_LEAD_MAX_RATIO));
    place(lead, x, top, leadW, leadH);
    const half = Math.floor((leadW - gap) / 2);
    const heights = [top + leadH + gap, top + leadH + gap];
    for (const it of moreArt) {
      const c = (heights[1] ?? 0) < (heights[0] ?? 0) ? 1 : 0;
      const h = heightFor(it, half);
      place(it, x + c * (half + gap), heights[c]!, half, h);
      heights[c] = heights[c]! + h + gap;
    }
    x += leadW + gap;
  }

  if (notes.length > 0) {
    let y = top;
    for (const it of notes) {
      const h = heightFor(it, col);
      place(it, x, y, col, h);
      y += h + gap;
    }
    x += col + gap;
  }

  if (ui.length > 0) {
    const n = Math.min(SPREAD_UI_COLUMNS, ui.length);
    let y = top;
    for (let r = 0; r * n < ui.length; r++) {
      const row = ui.slice(r * n, r * n + n);
      const hs = row.map((it) => heightFor(it, col));
      row.forEach((it, c) => place(it, x + c * (col + gap), y, col, hs[c]!));
      y += Math.max(...hs) + gap;
    }
  }

  if (under.length > 0) {
    let ux = ox;
    const uy = out.length > 0 ? bottom + gap : top;
    for (const it of under) {
      const w = positive(it.w) ? Math.round(it.w) : col;
      const h = positive(it.h) ? Math.round(it.h) : heightFor(it, w);
      place(it, ux, uy, w, h);
      ux += w + gap;
    }
  }
  return { items: out, sections: [] };
}

export function arrange(layout: LayoutKind, items: readonly LayoutItem[], opts: LayoutOptions = {}): LayoutResult {
  switch (layout) {
    case "spread":
      return spread(items, opts);
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

/**
 * Arrange the contents of one section with zones: when any item is art direction, the art items
 * are laid out first under a label strip, and the UI items below them under a second strip.
 * Without art items this is `arrange` unchanged.
 */
export function arrangeZoned(layout: LayoutKind, items: readonly LayoutItem[], opts: LayoutOptions = {}): LayoutResult {
  // A spread places art and UI side by side and leaves its own label room.
  if (layout === "spread") return spread(items, opts);
  const { art, ui } = splitZones(items);
  if (art.length === 0) return arrange(layout, items, opts);
  const { ox, oy, gap } = settings(opts);
  const top = arrange(layout, art, { ...opts, origin: { x: ox, y: oy + ZONE_LABEL_SPACE } });
  const artBottom = top.items.reduce((m, r) => Math.max(m, r.y + r.h), oy + ZONE_LABEL_SPACE);
  const below = ui.length > 0 ? arrange(layout, ui, { ...opts, origin: { x: ox, y: artBottom + gap + ZONE_LABEL_SPACE } }) : { items: [] };
  return { items: [...top.items, ...below.items], sections: [] };
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
