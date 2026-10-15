/**
 * Geometry of a Frankenstein page as the canvas shows it (StitchNode + canvas/stitch/stitch.css),
 * for drawing it to one image in the browser (P0-12, owner decision D1) and for the text layout
 * map that goes with that image. Pure, so Vitest covers it.
 *
 * The page is the platform frame width. Each row is a flex row with no gap: slot widths follow
 * `row.widths` (equal by default) and the row is as tall as its tallest slot at that slot's crop
 * aspect. A shorter slot's crop covers its stretched box, centred (`.bn-crop-fit`).
 */
import { clampCrop, STITCH_FRAME_WIDTH, type Crop, type Part, type PartRole, type PartTheme, type StitchData } from "@/lib/stitch/types";
import { cropAspect } from "../stitch/crop";

export type PageCell = {
  slotId: string;
  role: PartRole;
  row: number;
  /** The part, or null when it left the library (drawn as an empty box). */
  part: Part | null;
  /** Box on the page, in page px. */
  box: { x: number; y: number; w: number; h: number };
  /** The band of the source image the box shows, as fractions of the image (crop, then cover). */
  src: Crop;
};

export type PageLayout = { width: number; height: number; cells: PageCell[] };

/**
 * Lays out a page. `aspectOf(part)` gives the source image's width / height (measured in the
 * browser, else stored, else the platform fallback).
 */
export function pageLayout(stitch: Pick<StitchData, "platform" | "rows">, parts: ReadonlyMap<string, Part>, aspectOf: (p: Part | null) => number): PageLayout {
  const width = STITCH_FRAME_WIDTH[stitch.platform] ?? STITCH_FRAME_WIDTH.website;
  const cells: PageCell[] = [];
  let y = 0;
  stitch.rows.forEach((row, r) => {
    const shares = row.slots.map((_, i) => Math.max(0, row.widths?.[i] ?? 1));
    const sum = shares.reduce((a, b) => a + b, 0) || 1;
    let x = 0;
    const draft = row.slots.map((slot, i) => {
      const part = parts.get(slot.partId) ?? null;
      const crop = clampCrop(slot.crop ?? part?.crop ?? { x: 0, y: 0, w: 1, h: 1 });
      const w = (width * shares[i]!) / sum;
      const aspect = cropAspect(crop, aspectOf(part));
      const cell = { slot, part, crop, x, w, aspect, natural: w / aspect };
      x += w;
      return cell;
    });
    const h = Math.max(0, ...draft.map((d) => d.natural));
    for (const d of draft) {
      cells.push({ slotId: d.slot.id, role: d.slot.role, row: r, part: d.part, box: { x: d.x, y, w: d.w, h }, src: coverBand(d.crop, d.aspect, h > 0 ? d.w / h : d.aspect) });
    }
    y += h;
  });
  return { width, height: y, cells };
}

/**
 * The part of `crop` that shows when a crop of aspect `cropAspectValue` covers a box of aspect
 * `boxAspect`, centred: a box wider than the crop shows a centred horizontal band of it, a
 * taller box a centred vertical band.
 */
export function coverBand(crop: Crop, cropAspectValue: number, boxAspect: number): Crop {
  if (!(boxAspect > 0) || !(cropAspectValue > 0) || Math.abs(boxAspect - cropAspectValue) < 1e-9) return crop;
  if (boxAspect > cropAspectValue) {
    const h = crop.h * (cropAspectValue / boxAspect);
    return { x: crop.x, y: crop.y + (crop.h - h) / 2, w: crop.w, h };
  }
  const w = crop.w * (boxAspect / cropAspectValue);
  return { x: crop.x + (crop.w - w) / 2, y: crop.y, w, h: crop.h };
}

const THEME: Record<PartTheme, string> = { light: "light", dark: "dark", unknown: "theme unknown" };

/**
 * The page row by row in words: role, box size in px at the frame width, theme and source. Goes
 * with the rendered image, and alone when the page cannot be drawn.
 */
export function layoutMap(title: string, stitch: Pick<StitchData, "platform" | "rows">, layout: PageLayout): string[] {
  const lines = [`Frankenstein page "${title}" (${stitch.platform}), ${layout.width} x ${Math.round(layout.height)} px, ${stitch.rows.length} rows top to bottom:`];
  stitch.rows.forEach((row, r) => {
    const cells = layout.cells.filter((c) => c.row === r);
    const parts = cells.map((c) => {
      const p = c.part;
      const size = `${Math.round(c.box.w)} x ${Math.round(c.box.h)} px`;
      if (!p) return `${c.role} (${size}, part no longer in the library)`;
      return `${c.role} (${size}, ${THEME[p.theme ?? "unknown"]}) from ${p.sourceSite} ${p.sourceUrl}${p.note ? `, ${p.note}` : ""}`;
    });
    lines.push(`Row ${r + 1}: ${parts.join(" | ")}`);
  });
  return lines;
}
