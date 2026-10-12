/**
 * Canvas state service: load, change and save `canvases.state`, and map it to the
 * CanvasSnapshot that exports and get_canvas use.
 *
 * The stored JSON shape belongs to the canvas UI (`canvas/types.ts`, `canvas/state.ts`):
 * `{ version, viewport, nodes: StoredNode[], tray: TrayReference[] }`, with child node
 * positions relative to their section (`parentId`). This file reuses that parser so the
 * server and the UI always agree, and adds the server rules on top:
 * - Takedown filter on every load (hard rule 5), fail closed when the list cannot load.
 * - No `data:`, `blob:` or `filesystem:` URLs anywhere in saved state (hard rule 2).
 * - Every reference keeps its source link (rule 3; parseState drops ones without it).
 */
import { z } from "zod";
import { filterBlocked, parseState, stateToItems, siteFromUrl, emptyState } from "@/canvas/state";
import { arrangeNodes } from "@/canvas/layout-adapter";
import { estimateNoteHeight } from "@/canvas/note-layout";
import { flowNodeToStored, stateToNodes } from "@/canvas/state";
import {
  DEFAULT_SIZE,
  NODE_TYPES,
  type CanvasNodeType,
  type CanvasState,
  type NodeDataByType,
  type StoredNode,
  type TrayReference,
} from "@/canvas/types";
import type {
  CanvasDirection,
  CanvasItem,
  CanvasPalette,
  CanvasSection,
  CanvasSnapshot,
  ContrastResult,
  PaletteColor,
  StitchSnapshot,
} from "@/lib/canvas/types";
import type { Part, StitchData } from "@/lib/stitch/types";
import type { CanvasRecord, DirectionRecord, PaletteRecord, Repos } from "@/lib/db/types";
import { GAP, ZONE_LABEL_SPACE, type LayoutKind } from "@/lib/layout";
import type { TakedownMatcher } from "@/lib/takedown";
import type { Reference } from "@/lib/sources/types";
import { ZONES, type Zone } from "@/lib/direction-detail";

function isZone(v: unknown): v is Zone {
  return typeof v === "string" && (ZONES as readonly string[]).includes(v);
}

export type { CanvasState, StoredNode, TrayReference } from "@/canvas/types";
export { emptyState, parseState } from "@/canvas/state";

/** Largest `canvases.state` we accept, in bytes of JSON. */
export const MAX_STATE_BYTES = 1_000_000;
/** Most search results kept in a canvas tray; the oldest drop off first. */
export const MAX_TRAY = 200;
export const MAX_NODES = 2000;
/** Inner padding of a section frame and the room for its title (same as the canvas UI). */
export const SECTION_PAD = 16;
export const SECTION_HEADER = 48;
/** Space between top-level blocks (sections, loose rows). */
export const BLOCK_GAP = 48;
/** New items per row when appended. */
export const ROW_ITEMS = 4;

export type LoadMatcher = () => Promise<TakedownMatcher>;

// ---------------------------------------------------------------------------
// Validation for incoming state (PUT /api/canvas/:id)

const BANNED_SCHEME = /^\s*(data|blob|filesystem):/i;

/** Path of the first string that is a data:, blob: or filesystem: URL, or null. */
export function findForbiddenUrl(value: unknown, path = "state", depth = 0): string | null {
  if (depth > 12) return null;
  if (typeof value === "string") return BANNED_SCHEME.test(value) ? path : null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findForbiddenUrl(value[i], `${path}[${i}]`, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const hit = findForbiddenUrl(v, `${path}.${k}`, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

const finite = z.number().finite();
const storedNodeSchema = z
  .object({
    id: z.string().min(1).max(120),
    type: z.enum(NODE_TYPES as [CanvasNodeType, ...CanvasNodeType[]]),
    x: finite,
    y: finite,
    w: finite.positive().optional(),
    h: finite.positive().optional(),
    parentId: z.string().max(120).optional(),
    z: finite.optional(),
    data: z.record(z.string(), z.unknown()),
  })
  .loose();

/** Body of `PUT /api/canvas/:id`. Matches canvas/persistence.ts (`{ state }`), plus an optional base version. */
export const saveBodySchema = z.object({
  state: z
    .object({
      version: z.number().int().optional(),
      viewport: z.object({ x: finite, y: finite, zoom: finite.positive() }).optional(),
      nodes: z.array(storedNodeSchema).max(MAX_NODES),
      tray: z.array(z.record(z.string(), z.unknown())).max(MAX_TRAY * 2).optional(),
    })
    .loose(),
  /** `updatedAt` from the last GET. When given, a newer save on the server gives 409. */
  baseUpdatedAt: z.iso.datetime({ offset: true }).optional(),
});

export type ValidatedSave =
  | { ok: true; state: CanvasState; baseUpdatedAt?: Date }
  | { ok: false; status: 400 | 413; message: string };

/** Validate a raw request body (already size checked as text) into clean state. */
export function validateSaveBody(body: unknown, rawBytes: number): ValidatedSave {
  if (rawBytes > MAX_STATE_BYTES) return { ok: false, status: 413, message: "This canvas is too large to save." };
  const parsed = saveBodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, message: "The canvas data is not valid." };
  const forbidden = findForbiddenUrl(parsed.data.state);
  if (forbidden) {
    return { ok: false, status: 400, message: "Images must be links. Embedded image data cannot be saved." };
  }
  const state = parseState(parsed.data.state);
  return {
    ok: true,
    state,
    ...(parsed.data.baseUpdatedAt ? { baseUpdatedAt: new Date(parsed.data.baseUpdatedAt) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Load and save

export type LoadedCanvas = {
  canvas: CanvasRecord;
  state: CanvasState;
  /** Items and tray results the takedown filter hid. */
  removed: number;
};

/** Load the user's canvas with the takedown filter applied. Null when missing or not the user's. */
export async function loadCanvas(
  repos: Pick<Repos, "canvases">,
  userId: string,
  canvasId: string,
  loadMatcher: LoadMatcher,
): Promise<LoadedCanvas | null> {
  const canvas = await repos.canvases.getOwned(userId, canvasId);
  if (!canvas) return null;
  // Fail closed: if the list cannot load, the caller gets an error, never unfiltered items.
  const matcher = await loadMatcher();
  const { state, removed } = filterBlocked(parseState(canvas.state), (url) => matcher.isBlocked(url));
  return { canvas, state, removed };
}

export type MutateOutcome<T> =
  | { ok: true; value: T; state: CanvasState; canvas: CanvasRecord }
  | { ok: false; reason: "not_found" | "conflict" }
  | { ok: false; reason: "rejected"; message: string };

export type Mutator<T> = (
  state: CanvasState,
  canvas: CanvasRecord,
) => Promise<{ state: CanvasState; value: T } | { error: string }> | { state: CanvasState; value: T } | { error: string };

/**
 * Load, change and save a canvas with an optimistic check on `updated_at`, retrying once
 * when another save (for example the open web canvas) landed in between.
 */
export async function mutateCanvas<T>(
  repos: Pick<Repos, "canvases">,
  userId: string,
  canvasId: string,
  loadMatcher: LoadMatcher,
  fn: Mutator<T>,
): Promise<MutateOutcome<T>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const loaded = await loadCanvas(repos, userId, canvasId, loadMatcher);
    if (!loaded) return { ok: false, reason: "not_found" };
    const out = await fn(loaded.state, loaded.canvas);
    if ("error" in out) return { ok: false, reason: "rejected", message: out.error };
    const saved = await repos.canvases.saveState(userId, canvasId, out.state, { ifUpdatedAt: loaded.canvas.updatedAt });
    if (saved.ok) return { ok: true, value: out.value, state: out.state, canvas: { ...loaded.canvas, updatedAt: saved.updatedAt } };
    if (saved.reason === "not_found") return { ok: false, reason: "not_found" };
  }
  return { ok: false, reason: "conflict" };
}

// ---------------------------------------------------------------------------
// Snapshot (exports, get_canvas)

export function canvasWebUrl(appUrl: string | undefined, canvasId: string): string {
  return `${appUrl ?? ""}/c/${encodeURIComponent(canvasId)}`;
}

/** Wildness used for exports when the canvas was never bent (3, "Weird", the middle of the scale). */
export const DEFAULT_WILDNESS = 3;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function paletteColors(raw: unknown): PaletteColor[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObj).flatMap((c) =>
    typeof c.hex === "string"
      ? [{ hex: c.hex, oklch: typeof c.oklch === "string" ? c.oklch : null, role: typeof c.role === "string" ? c.role : null }]
      : [],
  );
}

function contrastResults(raw: unknown): ContrastResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObj).flatMap((c) =>
    typeof c.fg === "string" && typeof c.bg === "string" && typeof c.ratio === "number"
      ? [
          {
            fg: c.fg,
            bg: c.bg,
            ratio: c.ratio,
            passesText: c.passesText === true,
            passesUi: c.passesUi === true,
            tag: c.tag === "ship" ? ("ship" as const) : ("explore" as const),
          },
        ]
      : [],
  );
}

export function toSnapshot(input: {
  canvas: CanvasRecord;
  state: CanvasState;
  directions?: readonly DirectionRecord[];
  palettes?: readonly PaletteRecord[];
  webUrl?: string | null;
}): CanvasSnapshot {
  const all = stateToItems(input.state);
  const sections: CanvasSection[] = [];
  const items: CanvasItem[] = [];
  for (const it of all) {
    if (it.type === "section") {
      sections.push({ id: it.id, title: it.title, directionId: it.directionId ?? null, x: it.x, y: it.y, w: it.w, h: it.h });
    } else {
      items.push(it);
    }
  }
  const directions: CanvasDirection[] = (input.directions ?? []).map((d) => ({
    id: d.bendId ?? d.id,
    move: d.move,
    title: d.title,
    searchQuery: d.searchQuery,
    detail: d.detail ?? null,
  }));
  const palettes: CanvasPalette[] = (input.palettes ?? []).map((p) => ({
    id: p.id,
    colors: paletteColors(p.colors),
    contrast: contrastResults(p.contrast),
  }));
  const parts = input.state.parts ?? [];
  return {
    id: input.canvas.id,
    title: input.canvas.title,
    brief: input.canvas.brief ?? "",
    wildness: input.canvas.wildness ?? DEFAULT_WILDNESS,
    lens: input.canvas.lens,
    directions,
    sections,
    items,
    palettes,
    parts,
    stitches: stitchSnapshots(input.state),
    webUrl: input.webUrl ?? null,
    updatedAt: input.canvas.updatedAt.toISOString(),
  };
}

/** One stitch's rows with each slot's part resolved. Slots whose part is gone are left out. */
export function resolveStitchRows(data: StitchData, parts: readonly Part[] | ReadonlyMap<string, Part>): StitchSnapshot["rows"] {
  const byId = parts instanceof Map ? parts : new Map((parts as readonly Part[]).map((p) => [p.id, p]));
  return data.rows.flatMap((row) => {
    const slots = row.slots.flatMap((slot) => {
      const p = byId.get(slot.partId);
      if (!p) return [];
      const note = slot.note ?? p.note;
      return [
        {
          id: slot.id,
          role: slot.role,
          partId: p.id,
          imageUrl: p.imageUrl,
          ...(p.thumbUrl ? { thumbUrl: p.thumbUrl } : {}),
          sourceUrl: p.sourceUrl,
          sourceSite: p.sourceSite,
          ...(p.title ? { title: p.title } : {}),
          crop: slot.crop ?? p.crop,
          ...(note ? { note } : {}),
          ...(p.theme ? { theme: p.theme } : {}),
          ...(p.imageWidth ? { imageWidth: p.imageWidth } : {}),
          ...(p.imageHeight ? { imageHeight: p.imageHeight } : {}),
        },
      ];
    });
    if (slots.length === 0) return [];
    return [{ id: row.id, slots, ...(row.widths && slots.length === row.slots.length ? { widths: row.widths } : {}) }];
  });
}

/** Stitch frames with absolute geometry, in reading order (top to bottom, left to right). */
export function stitchSnapshots(state: CanvasState): StitchSnapshot[] {
  const parts = new Map((state.parts ?? []).map((p) => [p.id, p]));
  const sections = new Map(state.nodes.filter((n) => n.type === "section").map((n) => [n.id, n]));
  const out: StitchSnapshot[] = [];
  for (const n of state.nodes) {
    if (n.type !== "stitch") continue;
    const parent = n.parentId ? sections.get(n.parentId) : undefined;
    const d = n.data;
    out.push({
      id: n.id,
      title: d.title,
      platform: d.platform,
      mode: d.mode,
      ...(d.note ? { note: d.note } : {}),
      ...(d.directionId ? { directionId: d.directionId } : {}),
      ...(d.variantOf ? { variantOf: d.variantOf } : {}),
      ...(d.variant ? { variant: d.variant } : {}),
      x: n.x + (parent?.x ?? 0),
      y: n.y + (parent?.y ?? 0),
      w: n.w,
      h: n.h,
      sectionId: parent ? parent.id : null,
      rows: resolveStitchRows(d, parts),
    });
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
}

// ---------------------------------------------------------------------------
// Tray

/** Add search results to the tray (newest first, no duplicates, capped). */
/** Every web source link on a canvas (tray and placed references), for skipping repeats in searches. */
export function canvasSourceUrls(state: CanvasState): string[] {
  const urls = state.tray.map((r) => r.sourceUrl);
  for (const node of state.nodes) {
    const data = node.data as { sourceUrl?: unknown };
    if (typeof data?.sourceUrl === "string") urls.push(data.sourceUrl);
  }
  return urls;
}

export function addToTray(state: CanvasState, refs: readonly Reference[], directionId?: string): CanvasState {
  const incoming: TrayReference[] = refs.map((r) => {
    const zone: unknown = (r as { zone?: unknown }).zone;
    return {
    id: r.id,
    thumbUrl: r.thumbUrl,
    imageUrl: r.imageUrl,
    sourceUrl: r.sourceUrl,
    sourceSite: r.sourceSite,
    ...(r.title ? { title: r.title } : {}),
    ...(r.width ? { width: r.width } : {}),
    ...(r.height ? { height: r.height } : {}),
    ...(directionId ? { directionId } : {}),
    // The search tags each result with its zone (art direction or UI); the tray keeps it.
    ...(isZone(zone) ? { zone } : {}),
    };
  });
  const ids = new Set(incoming.map((r) => r.id));
  const tray = [...incoming, ...state.tray.filter((r) => !ids.has(r.id))].slice(0, MAX_TRAY);
  // Round-trip through the UI parser so the tray holds exactly what the canvas accepts.
  return parseState({ ...state, tray });
}

// ---------------------------------------------------------------------------
// Placing new nodes

export function newNodeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export type NewNode = {
  [K in CanvasNodeType]: { type: K; data: NodeDataByType[K]; w?: number; h?: number; id?: string };
}[CanvasNodeType];

export type PlacedNode = { id: string; type: CanvasNodeType; x: number; y: number; w: number; h: number; sectionId: string | null };

const PREFIX: Record<CanvasNodeType, string> = {
  image: "img",
  upload: "up",
  note: "note",
  swatch: "sw",
  typeSample: "type",
  section: "sec",
  stitch: "st",
};

/** Tile size for a reference: 280 px wide, height from its aspect ratio (clamped), like the canvas UI. */
export function referenceSize(width?: number | null, height?: number | null): { w: number; h: number } {
  const w = DEFAULT_SIZE.image.w;
  if (width && height && width > 0 && height > 0) {
    return { w, h: Math.min(560, Math.max(120, Math.round((w * height) / width))) };
  }
  return { w, h: DEFAULT_SIZE.image.h };
}

function bottomOf(nodes: readonly StoredNode[]): number {
  return nodes.reduce((m, n) => Math.max(m, n.y + n.h), -Infinity);
}

/** An art direction reference (zone "art"): placed in its own block on top of a section. */
function isArtNode(n: { type: CanvasNodeType; data: unknown }): boolean {
  return n.type === "image" && (n.data as { zone?: unknown }).zone === "art";
}

/** Lay `sizes` out in rows of up to ROW_ITEMS, starting at (x0, y0). Returns top-left points. */
function rows(sizes: readonly { w: number; h: number }[], x0: number, y0: number, perRow = ROW_ITEMS) {
  const out: { x: number; y: number }[] = [];
  let y = y0;
  for (let i = 0; i < sizes.length; i += perRow) {
    const row = sizes.slice(i, i + perRow);
    let x = x0;
    for (const s of row) {
      out.push({ x, y });
      x += s.w + GAP;
    }
    y += Math.max(...row.map((s) => s.h)) + GAP;
  }
  return out;
}

/**
 * Append nodes to the canvas without overlapping what is there:
 * - Sections go in a row to the right of the existing top-level content.
 * - Items with a target section go below that section's contents, and the frame grows.
 * - Other items go below all top-level content.
 * `targetFor` picks a section per node (or null for loose). Returns absolute positions.
 */
export function appendNodes(
  state: CanvasState,
  incoming: readonly NewNode[],
  targetFor: (node: NewNode, index: number) => string | null,
  makeId: (prefix: string) => string = newNodeId,
): { state: CanvasState; placed: PlacedNode[] } {
  const nodes: StoredNode[] = state.nodes.map((n) => ({ ...n }));
  const sections = new Map<string, StoredNode>(nodes.filter((n) => n.type === "section").map((n) => [n.id, n]));
  const placed: (PlacedNode | undefined)[] = new Array(incoming.length);

  const sized = incoming.map((n) => {
    const def = DEFAULT_SIZE[n.type];
    const w = n.w ?? def.w;
    // Notes start as tall as their text (canvas/note-layout.ts), so the board looks right
    // before the canvas measures them.
    const h = n.h ?? (n.type === "note" ? estimateNoteHeight(n.data.text, w) : def.h);
    return { node: n, w, h, id: n.id ?? makeId(PREFIX[n.type]) };
  });

  // 1. New sections, to the right of current top-level content.
  const topLevel = () => nodes.filter((n) => !n.parentId);
  let right = topLevel().reduce((m, n) => Math.max(m, n.x + n.w), -Infinity);
  const top = topLevel().reduce((m, n) => Math.min(m, n.y), Infinity);
  sized.forEach((s, i) => {
    if (s.node.type !== "section") return;
    const x = Number.isFinite(right) ? right + BLOCK_GAP : 0;
    const y = Number.isFinite(top) ? top : 0;
    const node = { id: s.id, type: "section", x, y, w: s.w, h: s.h, data: s.node.data } as StoredNode;
    nodes.push(node);
    sections.set(node.id, node);
    right = x + s.w;
    placed[i] = { id: s.id, type: "section", x, y, w: s.w, h: s.h, sectionId: null };
  });

  // 2. Group the other nodes by target section.
  const groups = new Map<string | null, number[]>();
  sized.forEach((s, i) => {
    if (s.node.type === "section") return;
    const t = targetFor(s.node, i);
    const key = t && sections.has(t) ? t : null;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });

  for (const [sectionId, idxs] of groups) {
    if (sectionId) {
      const section = sections.get(sectionId)!;
      const kids = nodes.filter((n) => n.parentId === sectionId);
      let maxRight = section.w - SECTION_PAD;
      const put = (list: readonly number[], y0: number) => {
        const points = rows(list.map((i) => sized[i]!), SECTION_PAD, y0);
        list.forEach((i, k) => {
          const s = sized[i]!;
          const p = points[k]!;
          nodes.push({ id: s.id, type: s.node.type, x: p.x, y: p.y, w: s.w, h: s.h, parentId: sectionId, data: s.node.data } as StoredNode);
          maxRight = Math.max(maxRight, p.x + s.w);
          placed[i] = { id: s.id, type: s.node.type, x: section.x + p.x, y: section.y + p.y, w: s.w, h: s.h, sectionId };
        });
      };
      const newArt = idxs.filter((i) => isArtNode(sized[i]!.node));
      const artKids = kids.filter(isArtNode);
      if (newArt.length + artKids.length === 0) {
        put(idxs, kids.length > 0 ? bottomOf(kids) + GAP : SECTION_HEADER);
      } else {
        // Zones: art direction items in a labelled block on top, UI references below their own label.
        // Existing UI items keep their arrangement and only move down when the art block grows into them.
        const uiKids = kids.filter((n) => !isArtNode(n));
        const newUi = idxs.filter((i) => !isArtNode(sized[i]!.node));
        put(newArt, artKids.length > 0 ? bottomOf(artKids) + GAP : SECTION_HEADER + ZONE_LABEL_SPACE);
        const artBottom = bottomOf(nodes.filter((n) => n.parentId === sectionId && isArtNode(n)));
        const uiTop = artBottom + GAP + ZONE_LABEL_SPACE;
        const uiMin = uiKids.reduce((m, n) => Math.min(m, n.y), Infinity);
        if (Number.isFinite(uiMin) && uiMin < uiTop) for (const n of uiKids) n.y += uiTop - uiMin;
        put(newUi, uiKids.length > 0 ? bottomOf(uiKids) + GAP : uiTop);
      }
      const maxBottom = bottomOf(nodes.filter((n) => n.parentId === sectionId));
      section.w = Math.max(section.w, maxRight + SECTION_PAD);
      const frameH = maxBottom + SECTION_PAD;
      if (section.type === "section" && section.data.collapsed) {
        section.data = { ...section.data, expandedHeight: Math.max(section.data.expandedHeight ?? 0, frameH) };
      } else {
        section.h = Math.max(section.h, frameH);
      }
    } else {
      const tops = topLevel();
      const left = tops.length > 0 ? Math.min(...tops.map((n) => n.x)) : 0;
      const y0 = tops.length > 0 ? bottomOf(tops) + BLOCK_GAP : 0;
      const points = rows(idxs.map((i) => sized[i]!), left, y0);
      idxs.forEach((i, k) => {
        const s = sized[i]!;
        const p = points[k]!;
        nodes.push({ id: s.id, type: s.node.type, x: p.x, y: p.y, w: s.w, h: s.h, data: s.node.data } as StoredNode);
        placed[i] = { id: s.id, type: s.node.type, x: p.x, y: p.y, w: s.w, h: s.h, sectionId: null };
      });
    }
  }

  const next = parseState({ ...state, nodes });
  return { state: next, placed: placed.filter((p): p is PlacedNode => Boolean(p)) };
}

// ---------------------------------------------------------------------------
// Arrange (same code as the toolbar button: canvas/layout-adapter.ts over lib/layout)

export type ArrangedRect = { id: string; x: number; y: number; w: number; h: number };

export function arrangeState(
  state: CanvasState,
  layout: LayoutKind,
  sectionId?: string,
): { state: CanvasState; items: ArrangedRect[] } | { error: "no_section" } {
  if (sectionId && !state.nodes.some((n) => n.id === sectionId && n.type === "section")) return { error: "no_section" };
  const arranged = arrangeNodes(stateToNodes(state), layout, sectionId ? { sectionId } : {});
  const stored: StoredNode[] = [];
  for (const n of arranged) {
    const s = flowNodeToStored(n);
    if (s) stored.push(s);
  }
  const next = parseState({ ...state, nodes: stored });
  // Absolute positions of everything in scope: the whole canvas, or one section and its contents.
  const items = stateToItems(next)
    .filter((it) => !sectionId || it.id === sectionId || it.sectionId === sectionId)
    .map((it) => ({ id: it.id, x: it.x, y: it.y, w: it.w, h: it.h }));
  return { state: next, items };
}

/** Count of nodes that count toward the per-canvas item cap (every node, sections included). */
export function itemCount(state: CanvasState): number {
  return state.nodes.length;
}

export { siteFromUrl };
export const EMPTY_STATE: () => CanvasState = emptyState;
