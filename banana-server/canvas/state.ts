/**
 * Convert between React Flow nodes + viewport and the JSON stored in
 * `canvases.state`. Pure and React free: used by the client app, the server
 * page and Vitest.
 *
 * Hard rules enforced here:
 * - Only URLs and metadata are kept. `data:`, `blob:` and other non-http URLs are
 *   dropped, so image bytes can never end up in saved state (spec section 2 rule 2).
 * - Every reference keeps its `sourceUrl`; a reference without one is dropped (rule 3).
 * - Load runs a takedown predicate and hides blocked items and tray results (rule 5).
 */
import type { CanvasItem } from "@/lib/canvas/types";
import { cleanCulture } from "@/lib/culture";
import type { Zone } from "@/lib/direction-detail";
import { cleanStitchData, parseParts, pruneStitch } from "@/lib/stitch/parse";
import type { Part } from "@/lib/stitch/types";
import { cleanTaste } from "@/lib/taste";
import { MAX_POST_TEXT, parsePostUrl, X_SITE } from "@/lib/xpost";
import {
  type CanvasBaseline,
  type CanvasFlowNode,
  type CanvasNodeType,
  type CanvasState,
  DEFAULT_SIZE,
  type ImageNodeData,
  isTag,
  NODE_TYPES,
  type NodeDataByType,
  type NoteNodeData,
  type SectionNodeData,
  STATE_VERSION,
  type StoredNode,
  type StoredViewport,
  type SwatchNodeData,
  type TrayReference,
  type TypeSampleNodeData,
  type XPostNodeData,
} from "./types";

/** Predicate for the takedown list. The matcher lives in `lib/takedown.ts`; pass `matcher.isBlocked`. */
export type IsBlocked = (url: string) => boolean;

export const DEFAULT_VIEWPORT: StoredViewport = { x: 0, y: 0, zoom: 1 };
/** Height of a collapsed section (its header only). */
export const SECTION_HEADER_HEIGHT = 48;

export function emptyState(): CanvasState {
  return { version: STATE_VERSION, viewport: { ...DEFAULT_VIEWPORT }, nodes: [], tray: [] };
}

// ---------------------------------------------------------------------------
// Small validators

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function positiveNum(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

function str(v: unknown, max = 2000): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

/**
 * Accept absolute http(s) URLs and same-origin paths ("/api/uploads/..").
 * Anything else (data:, blob:, javascript:, protocol-relative) is refused.
 */
export function safeUrl(v: unknown): string | undefined {
  const s = str(v, 4000);
  if (!s) return undefined;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}

function isZone(v: unknown): v is Zone {
  return v === "ui" || v === "art";
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function hex(v: unknown): string | undefined {
  const s = str(v, 16);
  if (!s) return undefined;
  const withHash = s.startsWith("#") ? s : `#${s}`;
  return HEX.test(withHash) ? withHash.toLowerCase() : undefined;
}

/** Drop undefined keys so saved JSON stays small and stable. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) if (obj[key] === undefined) delete obj[key];
  return obj;
}

// ---------------------------------------------------------------------------
// Node data

function referenceData(d: Record<string, unknown>): ImageNodeData | null {
  const imageUrl = safeUrl(d.imageUrl);
  const sourceUrl = safeUrl(d.sourceUrl);
  if (!imageUrl || !sourceUrl) return null;
  return compact({
    imageUrl,
    thumbUrl: safeUrl(d.thumbUrl) ?? null,
    sourceUrl,
    sourceSite: str(d.sourceSite, 200) ?? siteFromUrl(sourceUrl),
    title: str(d.title, 300) ?? null,
    note: str(d.note, 2000) ?? null,
    tag: isTag(d.tag) ? d.tag : null,
    zone: isZone(d.zone) ? d.zone : undefined,
    mobbinId: str(d.mobbinId, 100),
    placedAt: typeof d.placedAt === "string" && Number.isFinite(Date.parse(d.placedAt)) ? d.placedAt.slice(0, 40) : undefined,
    kind: d.kind === "build" ? ("build" as const) : undefined,
    stitchId: str(d.stitchId, 120),
    culture: cleanCulture(d.culture),
    width: positiveNum(d.width) ?? null,
    height: positiveNum(d.height) ?? null,
  });
}

/** Same-origin upload path only (`/api/uploads/<uuid>`): an attached screenshot is always the user's own upload. */
function uploadPathOnly(v: unknown): string | undefined {
  const s = str(v, 120);
  return s && /^\/api\/uploads\/[0-9a-f-]{36}$/i.test(s) ? s : undefined;
}

/** An X post: a real post link with its id, the author and text. Never media URLs (lib/xpost). */
function xpostData(d: Record<string, unknown>): XPostNodeData | null {
  const link = parsePostUrl(d.sourceUrl);
  const handle = str(d.authorHandle, 15);
  if (!link || !handle || !/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
  const screenshotUrl = uploadPathOnly(d.screenshotUrl);
  return compact({
    sourceUrl: `https://x.com/${handle}/status/${link.postId}`,
    sourceSite: X_SITE,
    postId: link.postId,
    authorName: str(d.authorName, 100) ?? handle,
    authorHandle: handle,
    text: typeof d.text === "string" ? d.text.trim().slice(0, MAX_POST_TEXT) : "",
    note: str(d.note, 2000) ?? null,
    tag: isTag(d.tag) ? d.tag : null,
    zone: isZone(d.zone) ? d.zone : undefined,
    culture: cleanCulture(d.culture),
    screenshotUrl,
    screenshotWidth: screenshotUrl ? positiveNum(d.screenshotWidth) : undefined,
    screenshotHeight: screenshotUrl ? positiveNum(d.screenshotHeight) : undefined,
    placedAt: typeof d.placedAt === "string" && Number.isFinite(Date.parse(d.placedAt)) ? d.placedAt.slice(0, 40) : undefined,
  });
}

/** Clean node data of a given type. Returns null when required fields are missing or unsafe. */
export function cleanData<K extends CanvasNodeType>(type: K, raw: unknown): NodeDataByType[K] | null {
  const d = isObject(raw) ? raw : {};
  switch (type) {
    case "image":
    case "upload":
      return referenceData(d) as NodeDataByType[K] | null;
    case "xpost":
      return xpostData(d) as NodeDataByType[K] | null;
    case "note": {
      const out: NoteNodeData = compact({
        text: typeof d.text === "string" ? d.text.slice(0, 2000) : "",
        color: str(d.color, 32) ?? null,
        culture: cleanCulture(d.culture),
        manualHeight: d.manualHeight === true ? true : undefined,
      });
      return out as NodeDataByType[K];
    }
    case "swatch": {
      const h = hex(d.hex);
      if (!h) return null;
      const out: SwatchNodeData = compact({
        hex: h,
        oklch: str(d.oklch, 80) ?? null,
        role: str(d.role, 60) ?? null,
        tag: isTag(d.tag) ? d.tag : "explore",
      });
      return out as NodeDataByType[K];
    }
    case "typeSample": {
      const pairingId = str(d.pairingId, 80);
      if (!pairingId) return null;
      const out: TypeSampleNodeData = compact({ pairingId, sample: str(d.sample, 200) ?? null });
      return out as NodeDataByType[K];
    }
    case "section": {
      const out: SectionNodeData = compact({
        title: str(d.title, 120) ?? "Untitled section",
        directionId: str(d.directionId, 80) ?? null,
        collapsed: d.collapsed === true ? true : undefined,
        expandedHeight: positiveNum(d.expandedHeight) ?? undefined,
      });
      return out as NodeDataByType[K];
    }
    case "stitch":
      // Slots whose part is missing from the library are pruned in parseState, which sees the parts.
      return cleanStitchData(d) as NodeDataByType[K];
    default:
      return null;
  }
}

/** "https://www.pinterest.com/pin/1" -> "pinterest.com". */
export function siteFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function isNodeType(v: unknown): v is CanvasNodeType {
  return typeof v === "string" && (NODE_TYPES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Parse and filter stored JSON

function parseViewport(v: unknown): StoredViewport {
  if (!isObject(v)) return { ...DEFAULT_VIEWPORT };
  const zoom = num(v.zoom, 1);
  return { x: num(v.x, 0), y: num(v.y, 0), zoom: zoom > 0 ? zoom : 1 };
}

function parseStoredNode(v: unknown): StoredNode | null {
  if (!isObject(v) || !isNodeType(v.type)) return null;
  const id = str(v.id, 120);
  if (!id) return null;
  const data = cleanData(v.type, v.data);
  if (!data) return null;
  const size = DEFAULT_SIZE[v.type];
  return compact({
    id,
    type: v.type,
    x: num(v.x, 0),
    y: num(v.y, 0),
    w: positiveNum(v.w) ?? size.w,
    h: positiveNum(v.h) ?? size.h,
    parentId: str(v.parentId, 120),
    z: typeof v.z === "number" && Number.isFinite(v.z) ? v.z : undefined,
    data,
  } as StoredNode);
}

export function parseTrayReference(v: unknown): TrayReference | null {
  if (!isObject(v)) return null;
  const id = str(v.id, 120);
  const imageUrl = safeUrl(v.imageUrl);
  const sourceUrl = safeUrl(v.sourceUrl);
  if (!id || !imageUrl || !sourceUrl) return null;
  return compact({
    id,
    imageUrl,
    thumbUrl: safeUrl(v.thumbUrl) ?? imageUrl,
    sourceUrl,
    sourceSite: str(v.sourceSite, 200) ?? siteFromUrl(sourceUrl),
    title: str(v.title, 300),
    width: positiveNum(v.width),
    height: positiveNum(v.height),
    directionId: str(v.directionId, 80),
    zone: isZone(v.zone) ? v.zone : undefined,
  });
}

/**
 * Validate unknown JSON into a CanvasState. Malformed nodes are dropped, duplicate
 * ids keep the first, parent links to missing or non-section nodes are removed,
 * and sections come first (React Flow needs parents before children).
 */
export function parseState(raw: unknown): CanvasState {
  const src = isObject(raw) ? raw : {};
  const seen = new Set<string>();
  const nodes: StoredNode[] = [];
  for (const v of Array.isArray(src.nodes) ? src.nodes : []) {
    const node = parseStoredNode(v);
    if (!node || seen.has(node.id)) continue;
    seen.add(node.id);
    nodes.push(node);
  }
  const sectionIds = new Set(nodes.filter((n) => n.type === "section").map((n) => n.id));
  for (const n of nodes) {
    if (n.parentId && (n.type === "section" || !sectionIds.has(n.parentId))) delete n.parentId;
  }
  const traySeen = new Set<string>();
  const tray: TrayReference[] = [];
  for (const v of Array.isArray(src.tray) ? src.tray : []) {
    const ref = parseTrayReference(v);
    if (!ref || traySeen.has(ref.id)) continue;
    traySeen.add(ref.id);
    tray.push(ref);
  }
  const taste = cleanTaste(src.taste);
  // Parts library. Kept as a key only when the input has it, so a save without it (an older canvas
  // UI) keeps the stored library (lib/db/keep.ts) instead of wiping it.
  const hasParts = Array.isArray(src.parts);
  const parts = hasParts ? parseParts(src.parts, safeUrl, siteFromUrl) : [];
  const baseline = parseBaseline(src.baseline);
  return {
    version: STATE_VERSION,
    viewport: parseViewport(src.viewport),
    nodes: orderStored(hasParts ? pruneStitches(nodes, parts) : nodes),
    tray,
    ...(taste.length > 0 ? { taste } : {}),
    ...(hasParts ? { parts } : {}),
    ...(baseline ? { baseline } : {}),
  };
}

/** The saved baseline search, or undefined when missing or malformed. Ids only, at most 24. */
function parseBaseline(v: unknown): CanvasBaseline | undefined {
  if (!isObject(v)) return undefined;
  const key = str(v.key, 300);
  const at = str(v.at, 40);
  if (!key || !at || !Number.isFinite(Date.parse(at)) || !Array.isArray(v.referenceIds)) return undefined;
  const referenceIds = [...new Set(v.referenceIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 80))].slice(0, 24);
  return { key, referenceIds, at };
}

/** Drop stitch slots whose part is not in the library. */
function pruneStitches(nodes: StoredNode[], parts: readonly Part[]): StoredNode[] {
  if (!nodes.some((n) => n.type === "stitch")) return nodes;
  const ids = new Set(parts.map((p) => p.id));
  return nodes.map((n) => (n.type === "stitch" ? { ...n, data: pruneStitch(n.data, ids) } : n));
}

function orderStored(nodes: StoredNode[]): StoredNode[] {
  return [...nodes.filter((n) => n.type === "section"), ...nodes.filter((n) => n.type !== "section")];
}

function blockedRef(ref: { imageUrl?: string | null; thumbUrl?: string | null; sourceUrl?: string | null }, isBlocked: IsBlocked): boolean {
  // An X post has no image: its post link (and the author's profile) is what a takedown names.
  return [ref.sourceUrl, ref.imageUrl, ref.thumbUrl].some((u) => typeof u === "string" && u !== "" && isBlocked(u));
}

/**
 * Takedown filter (spec section 9: "on load, hide any item whose URL or domain is on
 * the takedown list"). Runs on the server page and again in the client for the inline app.
 */
export function filterBlocked(state: CanvasState, isBlocked?: IsBlocked): { state: CanvasState; removed: number } {
  if (!isBlocked) return { state, removed: 0 };
  let removed = 0;
  const nodes = state.nodes.filter((n) => {
    if ((n.type === "image" || n.type === "upload" || n.type === "xpost") && blockedRef(n.data, isBlocked)) {
      removed += 1;
      return false;
    }
    return true;
  });
  const tray = state.tray.filter((r) => {
    if (blockedRef(r, isBlocked)) {
      removed += 1;
      return false;
    }
    return true;
  });
  if (!state.parts) return { state: { ...state, nodes, tray }, removed };
  const parts = state.parts.filter((p) => {
    if (blockedRef(p, isBlocked)) {
      removed += 1;
      return false;
    }
    return true;
  });
  return { state: { ...state, nodes: parts.length < state.parts.length ? pruneStitches(nodes, parts) : nodes, tray, parts }, removed };
}

// ---------------------------------------------------------------------------
// Stored <-> React Flow

/** Order nodes so every section comes before the nodes inside it. */
export function orderNodes<T extends { type?: string }>(nodes: readonly T[]): T[] {
  return [...nodes.filter((n) => n.type === "section"), ...nodes.filter((n) => n.type !== "section")];
}

export function storedToFlowNode(n: StoredNode, collapsedSections: ReadonlySet<string> = new Set()): CanvasFlowNode {
  const base = {
    id: n.id,
    position: { x: n.x, y: n.y },
    width: n.w,
    height: n.h,
    ...(n.parentId ? { parentId: n.parentId } : {}),
    ...(n.z !== undefined ? { zIndex: n.z } : {}),
    ...(n.parentId && collapsedSections.has(n.parentId) ? { hidden: true } : {}),
  };
  return { ...base, type: n.type, data: n.data } as CanvasFlowNode;
}

export function stateToNodes(state: CanvasState): CanvasFlowNode[] {
  const collapsed = new Set(
    state.nodes.filter((n) => n.type === "section" && n.data.collapsed).map((n) => n.id),
  );
  return orderStored(state.nodes).map((n) => storedToFlowNode(n, collapsed));
}

export interface DeserializeOptions {
  isBlocked?: IsBlocked;
}

export interface Deserialized {
  nodes: CanvasFlowNode[];
  viewport: StoredViewport;
  tray: TrayReference[];
  /** Parts library for stitch frames (empty when the canvas has none). */
  parts: Part[];
  /** How many items, tray results and parts the takedown filter hid. */
  removed: number;
}

/** Stored JSON (unknown) -> React Flow nodes, viewport and tray, with the takedown filter applied. */
export function deserializeState(raw: unknown, opts: DeserializeOptions = {}): Deserialized {
  const { state, removed } = filterBlocked(parseState(raw), opts.isBlocked);
  return { nodes: stateToNodes(state), viewport: state.viewport, tray: state.tray, parts: state.parts ?? [], removed };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function flowNodeToStored(node: CanvasFlowNode): StoredNode | null {
  const data = cleanData(node.type, node.data);
  if (!data) return null;
  const size = DEFAULT_SIZE[node.type];
  const w = node.width ?? node.measured?.width ?? size.w;
  const h = node.height ?? node.measured?.height ?? size.h;
  return compact({
    id: node.id,
    type: node.type,
    x: round(node.position.x),
    y: round(node.position.y),
    w: round(w),
    h: round(h),
    parentId: node.parentId,
    z: typeof node.zIndex === "number" ? node.zIndex : undefined,
    data,
  } as StoredNode);
}

/**
 * React Flow nodes + viewport + tray (+ parts library) -> the JSON saved in `canvases.state`.
 * Leave `parts` out to keep the stored library on save; pass a list (even empty) to replace it.
 */
export function serializeState(
  nodes: readonly CanvasFlowNode[],
  viewport: StoredViewport,
  tray: readonly TrayReference[] = [],
  parts?: readonly Part[],
): CanvasState {
  const stored: StoredNode[] = [];
  for (const n of orderNodes(nodes)) {
    const s = flowNodeToStored(n);
    if (s) stored.push(s);
  }
  const cleanTray: TrayReference[] = [];
  for (const r of tray) {
    const c = parseTrayReference(r);
    if (c) cleanTray.push(c);
  }
  const cleanParts = parts ? parseParts(parts, safeUrl, siteFromUrl) : undefined;
  return {
    version: STATE_VERSION,
    viewport: { x: round(viewport.x), y: round(viewport.y), zoom: round(viewport.zoom) || 1 },
    nodes: cleanParts ? pruneStitches(stored, cleanParts) : stored,
    tray: cleanTray,
    ...(cleanParts ? { parts: cleanParts } : {}),
  };
}

// ---------------------------------------------------------------------------
// Bridge to the CanvasSnapshot shape in lib/canvas/types.ts (exports, get_canvas)

/**
 * Stored state -> CanvasItem list with absolute coordinates (children converted from parent-relative).
 * Stitch frames are not CanvasItems; lib/canvas/store.ts toSnapshot lists them as `stitches`.
 */
export function stateToItems(state: CanvasState): CanvasItem[] {
  const sections = new Map(state.nodes.filter((n) => n.type === "section").map((n) => [n.id, n]));
  return state.nodes.flatMap((n): CanvasItem[] => {
    const parent = n.parentId ? sections.get(n.parentId) : undefined;
    const geo = {
      id: n.id,
      x: n.x + (parent?.x ?? 0),
      y: n.y + (parent?.y ?? 0),
      w: n.w,
      h: n.h,
      sectionId: parent ? parent.id : null,
    };
    switch (n.type) {
      case "image": {
        const { width: _w, height: _h, ...d } = n.data;
        return [{ ...geo, type: "image", ...d }];
      }
      case "upload": {
        const { width: _w, height: _h, ...d } = n.data;
        return [{ ...geo, type: "upload", ...d }];
      }
      case "xpost": {
        // The post text stays in the canvas (web card); snapshots never carry it (lib/xpost).
        const { text: _t, ...d } = n.data;
        return [{ ...geo, type: "xpost", ...d }];
      }
      case "note": {
        const { manualHeight: _m, ...d } = n.data;
        return [{ ...geo, type: "note", ...d }];
      }
      case "swatch":
        return [{ ...geo, type: "swatch", ...n.data }];
      case "typeSample":
        return [{ ...geo, type: "typeSample", ...n.data }];
      case "section": {
        const { collapsed: _c, expandedHeight: _e, ...d } = n.data;
        return [{ ...geo, type: "section", ...d }];
      }
      case "stitch":
        return [];
    }
  });
}

/** Stable string for change detection (skip saves when nothing changed). */
export function stateKey(state: CanvasState): string {
  return JSON.stringify(state);
}
