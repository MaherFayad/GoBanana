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
 *
 * Zones (wild directions v2): inside a section, art direction items (`zone: "art"`) sit in their
 * own block on top and UI items below, each block under a ZONE_LABEL_SPACE strip where the canvas
 * draws its label ("Art direction", "UI references"). Sections without art items look as before.
 *
 * - by_cluster (V4.2): inside each section, one labelled row per cluster (what to take from the
 *   references: layout, component: <part>, type, color, motion, art, then other labels in first
 *   seen order, then "Other" for items with none). Rows wrap after CLUSTER_COLUMNS items. Items
 *   keep input order inside a row. Sections sit side by side in the order given, as in by_direction.
 */

export type LayoutKind = "by_direction" | "by_cluster" | "masonry" | "grid" | "hero";
export const LAYOUTS: readonly LayoutKind[] = ["by_direction", "by_cluster", "masonry", "grid", "hero"];

export interface LayoutItem {
  id: string;
  w?: number;
  h?: number;
  /** Width divided by height. Wins over w and h when both are given. */
  aspectRatio?: number;
  sectionId?: string;
  /** "art" for art direction items. Missing means a UI item. */
  zone?: "ui" | "art";
  /** by_cluster row label ("layout", "component: nav"). Missing means "Other" ("art" for art items). */
  cluster?: string | null;
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

/** A by_cluster row label: drawn in the ZONE_LABEL_SPACE strip whose top-left is (x, y). */
export interface ClusterLabel {
  label: string;
  x: number;
  y: number;
  /** Section the row is in; null for loose items. */
  sectionId: string | null;
}

export interface LayoutResult {
  items: Rect[];
  /** Section frames (by_direction and by_cluster). Empty for other layouts. */
  sections: Rect[];
  /** Row labels (by_cluster only). */
  labels?: ClusterLabel[];
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
/** by_cluster: items per line before a cluster row wraps. */
export const CLUSTER_COLUMNS = 6;
/** Longest cluster label. */
export const MAX_CLUSTER = 40;
/** Label of the row for items with no cluster. */
export const OTHER_CLUSTER = "Other";

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

// ---------------------------------------------------------------------------
// Clusters (by_cluster)

/** The cluster an item goes in: its label, "art" for an art item without one, else "Other". */
export function clusterOf(item: { cluster?: string | null; zone?: string | null }): string {
  const label = typeof item.cluster === "string" ? item.cluster.trim().slice(0, MAX_CLUSTER) : "";
  if (label) return label;
  return item.zone === "art" ? "art" : OTHER_CLUSTER;
}

const FIXED_RANK: Record<string, number> = { layout: 0, type: 2, color: 3, motion: 4, art: 5 };

/** Sort rank: layout, component*, type, color, motion, art, other labels, then Other. */
function clusterRank(key: string): number {
  if (key === OTHER_CLUSTER.toLowerCase()) return 7;
  if (key in FIXED_RANK) return FIXED_RANK[key]!;
  if (/^component(?:$|[\s:])/.test(key)) return 1;
  return 6;
}

/**
 * Items grouped by cluster, groups in by_cluster order, items in input order. Labels match
 * without case ("Layout" and "layout" are one row); a row shows its first seen spelling.
 */
export function clusterGroups<T extends { cluster?: string | null; zone?: string | null }>(items: readonly T[]): { label: string; items: T[] }[] {
  const groups = new Map<string, { label: string; items: T[]; seen: number }>();
  for (const it of items) {
    const label = clusterOf(it);
    const key = label.toLowerCase();
    const g = groups.get(key);
    if (g) g.items.push(it);
    else groups.set(key, { label: clusterRank(key) === 7 ? OTHER_CLUSTER : label, items: [it], seen: groups.size });
  }
  return [...groups.entries()]
    .sort(([ka, a], [kb, b]) => {
      const ra = clusterRank(ka);
      const rb = clusterRank(kb);
      if (ra !== rb) return ra - rb;
      if (ra === 1 && ka !== kb) return ka < kb ? -1 : 1;
      return a.seen - b.seen;
    })
    .map(([, g]) => ({ label: g.label, items: g.items }));
}

/**
 * Cluster rows for one block (a section's contents or loose items) from (ox, oy): per cluster a
 * label strip, then its items left to right, wrapping after `columns`. Returns the content size.
 */
export function clusterRows(
  items: readonly LayoutItem[],
  opts: LayoutOptions & { sectionId?: string | null } = {},
): { items: Rect[]; labels: ClusterLabel[]; width: number; height: number } {
  const { ox, oy, col, gap } = settings(opts);
  const perRow = positive(opts.columns) ? Math.floor(opts.columns) : CLUSTER_COLUMNS;
  const out: Rect[] = [];
  const labels: ClusterLabel[] = [];
  let y = oy;
  let width = 0;
  clusterGroups(items).forEach((group, g) => {
    if (g > 0) y += gap;
    labels.push({ label: group.label, x: ox, y, sectionId: opts.sectionId ?? null });
    y += ZONE_LABEL_SPACE;
    for (let i = 0; i < group.items.length; i += perRow) {
      if (i > 0) y += gap;
      const line = group.items.slice(i, i + perRow);
      let rowH = 0;
      line.forEach((it, k) => {
        const h = heightFor(it, col);
        out.push({ id: it.id, x: ox + k * (col + gap), y, w: col, h });
        rowH = Math.max(rowH, h);
      });
      width = Math.max(width, line.length * col + (line.length - 1) * gap);
      y += rowH;
    }
  });
  return { items: out, labels, width, height: y - oy };
}

/**
 * by_cluster: sections side by side in `sections` order (as by_direction), each holding one
 * labelled row per cluster. Items with no known section go in a last block without a frame.
 */
export function byCluster(items: readonly LayoutItem[], opts: LayoutOptions = {}): LayoutResult {
  const { ox, oy, col, gap } = settings(opts);
  const sectionIds: string[] = [];
  const add = (id: string) => {
    if (!sectionIds.includes(id)) sectionIds.push(id);
  };
  for (const s of opts.sections ?? []) add(s.id);
  if (!opts.sections) for (const it of items) if (it.sectionId) add(it.sectionId);
  const known = new Set(sectionIds);
  const blocks: { sectionId: string | null; items: LayoutItem[] }[] = sectionIds.map((id) => ({
    sectionId: id,
    items: items.filter((it) => it.sectionId === id),
  }));
  const loose = items.filter((it) => !it.sectionId || !known.has(it.sectionId));
  if (loose.length > 0) blocks.push({ sectionId: null, items: loose });

  const outItems: Rect[] = [];
  const outSections: Rect[] = [];
  const labels: ClusterLabel[] = [];
  let x = ox;
  for (const block of blocks) {
    const top = oy + (block.sectionId ? SECTION_HEADER : 0);
    const rowsOut = clusterRows(block.items, { ...opts, origin: { x, y: top }, sectionId: block.sectionId });
    outItems.push(...rowsOut.items);
    labels.push(...rowsOut.labels);
    const w = Math.max(rowsOut.width, col);
    if (block.sectionId) {
      const bottom = top + rowsOut.height + SECTION_PADDING;
      outSections.push({ id: block.sectionId, x, y: oy, w, h: bottom - oy });
    }
    x += w + gap;
  }
  return { items: outItems, sections: outSections, labels };
}

export function arrange(layout: LayoutKind, items: readonly LayoutItem[], opts: LayoutOptions = {}): LayoutResult {
  switch (layout) {
    case "by_direction":
      return byDirection(items, opts);
    case "by_cluster":
      return byCluster(items, opts);
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
 * Without art items this is `arrange` unchanged. by_cluster has no zone blocks: art items sit in
 * their cluster row (the "art" row when they have no label), as one block from the origin.
 */
export function arrangeZoned(layout: LayoutKind, items: readonly LayoutItem[], opts: LayoutOptions = {}): LayoutResult {
  if (layout === "by_cluster") {
    const rowsOut = clusterRows(items, opts);
    return { items: rowsOut.items, sections: [], labels: rowsOut.labels };
  }
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
