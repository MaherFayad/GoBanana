/** Builders for new nodes. Pure, so they can run in Vitest and on the server (add_to_canvas). */
import { DEFAULT_PAIRING_ID } from "./fonts";
import { siteFromUrl } from "./state";
import {
  DEFAULT_SIZE,
  type ImageFlowNode,
  type NoteFlowNode,
  type SectionFlowNode,
  type SwatchFlowNode,
  type Tag,
  type TrayReference,
  type TypeSampleFlowNode,
} from "./types";

export function newNodeId(prefix = "n"): string {
  const c = globalThis.crypto as Crypto | undefined;
  const raw = c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${raw}`;
}

type Point = { x: number; y: number };

/** Tile size for a reference: 280 px wide, height from its aspect ratio (clamped). */
export function referenceSize(ref: { width?: number | null; height?: number | null }): { w: number; h: number } {
  const w = DEFAULT_SIZE.image.w;
  if (ref.width && ref.height && ref.width > 0 && ref.height > 0) {
    return { w, h: Math.min(560, Math.max(120, Math.round((w * ref.height) / ref.width))) };
  }
  return { w, h: DEFAULT_SIZE.image.h };
}

/** Top-left position that centers a box of `size` on `center`. */
function centered(center: Point, size: { w: number; h: number }): Point {
  return { x: Math.round(center.x - size.w / 2), y: Math.round(center.y - size.h / 2) };
}

export function referenceNode(ref: TrayReference, center: Point, id = newNodeId("img")): ImageFlowNode {
  const size = referenceSize(ref);
  return {
    id,
    type: "image",
    position: centered(center, size),
    width: size.w,
    height: size.h,
    data: {
      imageUrl: ref.imageUrl,
      thumbUrl: ref.thumbUrl || null,
      sourceUrl: ref.sourceUrl,
      sourceSite: ref.sourceSite || siteFromUrl(ref.sourceUrl),
      title: ref.title ?? null,
      note: null,
      tag: null,
      width: ref.width ?? null,
      height: ref.height ?? null,
    },
  };
}

export function noteNode(center: Point, text = "", id = newNodeId("note")): NoteFlowNode {
  const size = DEFAULT_SIZE.note;
  return { id, type: "note", position: centered(center, size), width: size.w, height: size.h, data: { text, color: "yellow" } };
}

export function sectionNode(center: Point, title = "New section", id = newNodeId("sec")): SectionFlowNode {
  const size = DEFAULT_SIZE.section;
  return { id, type: "section", position: centered(center, size), width: size.w, height: size.h, data: { title } };
}

export function swatchNode(center: Point, hex: string, opts: { role?: string; oklch?: string; tag?: Tag } = {}, id = newNodeId("sw")): SwatchFlowNode {
  const size = DEFAULT_SIZE.swatch;
  return {
    id,
    type: "swatch",
    position: centered(center, size),
    width: size.w,
    height: size.h,
    data: { hex, role: opts.role ?? null, oklch: opts.oklch ?? null, tag: opts.tag ?? "explore" },
  };
}

export function typeSampleNode(center: Point, pairingId = DEFAULT_PAIRING_ID, id = newNodeId("type")): TypeSampleFlowNode {
  const size = DEFAULT_SIZE.typeSample;
  return { id, type: "typeSample", position: centered(center, size), width: size.w, height: size.h, data: { pairingId } };
}
