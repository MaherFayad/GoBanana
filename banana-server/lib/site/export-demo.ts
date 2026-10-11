/**
 * The export preview on the landing page ("Ship a kit, not a moodboard"): the six files an
 * export_kit call writes for the "Woven checkout" example board, made by the real exporters
 * (lib/export) from a demo canvas, so the preview can never drift from what the tool returns.
 *
 * The board's references are the gallery's "Souq checkout" showcase items (real work, linked to
 * its source); the palette is the one extracted from those four images (see the --st-board-souq-*
 * tokens). Pure: no network.
 */
import type { CanvasSnapshot, ContrastResult, Tag } from "@/lib/canvas/types";
import { exportKit, type ExportFormat } from "@/lib/export";
import { contrastRatio } from "@/lib/export/util";
import { SHOWCASE } from "./showcase";

/** The six files the landing page previews, in tab order. */
export const PREVIEW_FORMATS = ["design_md", "agents_md", "tokens", "tailwind", "figjam_spec", "brief"] as const satisfies readonly ExportFormat[];
export type PreviewFormat = (typeof PREVIEW_FORMATS)[number];

function pair(fg: string, bg: string, tag: Tag): ContrastResult {
  const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100;
  return { fg, bg, ratio, passesText: ratio >= 4.5, passesUi: ratio >= 3, tag };
}

const PALETTE = {
  primary: "#96172C",
  surface: "#EFE6D6",
  ink: "#2C3A42",
  accent: "#40627B",
  clay: "#8A5B41",
};

function demoSnapshot(): CanvasSnapshot {
  const ref = (id: string) => {
    const item = SHOWCASE.find((s) => s.id === id);
    if (!item) throw new Error(`export demo: no showcase item ${id}`);
    return item;
  };
  const image = (id: string, key: string, sectionId: string, x: number, tag: Tag) => {
    const s = ref(key);
    return {
      id,
      type: "image" as const,
      sectionId,
      x,
      y: 40,
      w: 280,
      h: 210,
      imageUrl: s.imageUrl,
      thumbUrl: s.thumbUrl,
      sourceUrl: s.sourceUrl,
      sourceSite: s.sourceSite,
      title: s.creator ? `${s.title}, by ${s.creator}` : s.title,
      tag,
    };
  };
  return {
    id: "cnv_woven",
    title: "Woven checkout",
    brief: "A calm flight checkout for a Gulf airline",
    wildness: 3,
    lens: "sadu",
    directions: [
      { id: "d1", move: "lens", title: "Checkout woven like a Sadu tent band", searchQuery: "sadu weaving pattern contemporary design" },
      { id: "d2", move: "transplant", title: "Booking flow borrowed from desert modern houses", searchQuery: "desert modern architecture dusk" },
    ],
    sections: [
      { id: "s1", title: "Woven progress", directionId: "d1", x: 0, y: 0, w: 640, h: 520 },
      { id: "s2", title: "Desert dusk", directionId: "d2", x: 680, y: 0, w: 640, h: 520 },
    ],
    items: [
      image("r1", "sadu-fabric", "s1", 16, "ship"),
      image("r2", "fintech-minimal", "s1", 312, "ship"),
      image("r3", "kaufmann-desert", "s2", 696, "explore"),
      image("r4", "flight-booking", "s2", 992, "ship"),
      { id: "n1", type: "note", sectionId: "s1", x: 16, y: 280, w: 280, h: 120, text: "Stripes mark progress only.\nOne accent per screen: madder on wool." },
      { id: "t1", type: "typeSample", sectionId: "s1", x: 312, y: 280, w: 280, h: 160, pairingId: "ibm-plex-arabic-plex-sans", sample: "Total due today" },
      { id: "w1", type: "swatch", sectionId: "s2", x: 696, y: 280, w: 120, h: 120, hex: PALETTE.primary, role: "primary", tag: "ship" },
    ],
    palettes: [
      {
        id: "p1",
        colors: [
          { hex: PALETTE.primary, role: "primary", tag: "ship" },
          { hex: PALETTE.surface, role: "surface", tag: "ship" },
          { hex: PALETTE.ink, role: "ink", tag: "ship" },
          { hex: PALETTE.accent, role: "accent", tag: "ship" },
          { hex: PALETTE.clay, role: "clay", tag: "explore" },
        ],
        contrast: [
          pair(PALETTE.surface, PALETTE.primary, "ship"),
          pair(PALETTE.ink, PALETTE.surface, "ship"),
          pair(PALETTE.surface, PALETTE.accent, "ship"),
          pair(PALETTE.surface, PALETTE.clay, "explore"),
        ],
      },
    ],
  };
}

export type PreviewFile = { format: PreviewFormat; name: string; content: string };

let files: PreviewFile[] | null = null;

/** The six preview files, built once per isolate. */
export function exportPreview(): PreviewFile[] {
  files ??= exportKit(demoSnapshot(), PREVIEW_FORMATS).map((f, i) => ({ format: PREVIEW_FORMATS[i]!, name: f.name, content: f.content }));
  return files;
}
