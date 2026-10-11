/**
 * FigJam layout spec (spec section 10) for the moodboard skill to build with the Figma MCP.
 * Item coordinates are relative to their section, like children of a Figma section.
 */
import type { CanvasItem, Tag } from "../canvas/types";
import { isReference } from "../canvas/types";
import type { KitModel, Reference } from "./model";
import { findPairing, defaultPairing } from "./model";
import { finite, normalizeHex, oneLine, plainBlock, safeUrl } from "./util";

export interface FigjamItem {
  type: CanvasItem["type"];
  x: number;
  y: number;
  w: number;
  h: number;
  imageUrl?: string;
  text?: string;
  hex?: string;
  /**
   * Source link for references (null only when the stored link is not a safe http(s) URL);
   * the board link (or null) for notes and swatches; the font link for type samples.
   */
  sourceUrl: string | null;
  title?: string;
  sourceSite?: string;
  role?: string;
  tag?: Tag;
}

export interface FigjamSection {
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  items: FigjamItem[];
}

export interface FigjamSpec {
  title: string;
  coordinates: "items are relative to their section";
  sections: FigjamSection[];
}

const PAD = 40;

function toItem(item: CanvasItem, origin: { x: number; y: number }, m: KitModel, refs: Map<string, Reference>): FigjamItem | null {
  const base = {
    x: Math.round(finite(item.x) - origin.x),
    y: Math.round(finite(item.y) - origin.y),
    w: Math.round(Math.max(0, finite(item.w))),
    h: Math.round(Math.max(0, finite(item.h))),
  };
  if (isReference(item)) {
    const ref = refs.get(item.id);
    const out: FigjamItem = { type: item.type, ...base, sourceUrl: ref?.url ?? safeUrl(item.sourceUrl) };
    const img = ref?.id === item.id ? ref.imageUrl : (safeUrl(item.imageUrl) ?? safeUrl(item.thumbUrl));
    if (img) out.imageUrl = img;
    out.title = ref?.title ?? (oneLine(item.title, 160) || "Reference");
    out.sourceSite = ref?.site ?? oneLine(item.sourceSite, 60);
    if (item.tag) out.tag = item.tag;
    return out;
  }
  switch (item.type) {
    case "note":
      return { type: "note", ...base, text: plainBlock(item.text, 2000), sourceUrl: m.webUrl };
    case "swatch": {
      const hex = normalizeHex(item.hex);
      if (!hex) return null;
      const out: FigjamItem = { type: "swatch", ...base, hex, text: [oneLine(item.role, 40), hex, oneLine(item.oklch, 80)].filter(Boolean).join(" "), sourceUrl: m.webUrl, tag: item.tag };
      if (item.role) out.role = oneLine(item.role, 40);
      return out;
    }
    case "typeSample": {
      const p = findPairing(item.pairingId) ?? defaultPairing();
      return { type: "typeSample", ...base, text: `${p.display.family} / ${p.body.family}: ${oneLine(item.sample, 200) || p.sample}`, sourceUrl: p.url };
    }
    default:
      return null;
  }
}

export function figjamSpec(m: KitModel): FigjamSpec {
  const refs = new Map(m.references.map((r) => [r.id, r]));
  const sections: FigjamSection[] = m.sections.map((s) => ({
    title: s.title,
    x: Math.round(s.x),
    y: Math.round(s.y),
    w: Math.round(s.w),
    h: Math.round(s.h),
    items: s.items.map((i) => toItem(i, s, m, refs)).filter((i): i is FigjamItem => i !== null),
  }));

  if (m.unsorted.length > 0) {
    const minX = Math.min(...m.unsorted.map((i) => finite(i.x)));
    const minY = Math.min(...m.unsorted.map((i) => finite(i.y)));
    const maxX = Math.max(...m.unsorted.map((i) => finite(i.x) + finite(i.w)));
    const maxY = Math.max(...m.unsorted.map((i) => finite(i.y) + finite(i.h)));
    const origin = { x: minX - PAD, y: minY - PAD };
    sections.push({
      title: "Unsorted",
      x: Math.round(origin.x),
      y: Math.round(origin.y),
      w: Math.round(maxX - minX + PAD * 2),
      h: Math.round(maxY - minY + PAD * 2),
      items: m.unsorted.map((i) => toItem(i, origin, m, refs)).filter((i): i is FigjamItem => i !== null),
    });
  }

  return { title: m.title, coordinates: "items are relative to their section", sections };
}

export function figjamSpecJson(m: KitModel): string {
  return `${JSON.stringify(figjamSpec(m), null, 2)}\n`;
}
