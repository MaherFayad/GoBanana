/**
 * get_snapshot's view of a board, a section or a Frankenstein page: text lines plus the thumbnail
 * targets that go between them. A parts view, not a rendered composite: nothing is drawn or
 * stitched on the server; each part is its source image with the crop rect that says which band
 * the page uses.
 */
import type { CanvasItem, CanvasSnapshot, StitchSnapshot } from "@/lib/canvas/types";
import { webTitle } from "@/lib/mcp/untrusted";
import { postCredit } from "@/lib/xpost";
import { roleName } from "@/lib/stitch/skeleton";
import type { ThumbTarget } from "./thumbs";

/** How the agent gets the composed page as one image (P0-12): the user sends it from the inline canvas. */
export const SHOW_IN_CHAT_HINT =
  'To see the page composed as one image, ask the user to press "Show in chat" in the inline canvas and pick this page; it reaches you with their next message (drawn in their browser, never stored).';

export const SNAPSHOT_END ="Build each row from what you see here; check your build against these images.";

export type SnapshotView = {
  head: string[];
  targets: ThumbTarget[];
  tail: string[];
  structured: Record<string, unknown>;
};

const pct = (n: number) => n.toFixed(2);

function itemLine(it: CanvasItem): string {
  const pos = `at (${Math.round(it.x)}, ${Math.round(it.y)}), ${Math.round(it.w)} x ${Math.round(it.h)}`;
  switch (it.type) {
    case "image":
    case "upload": {
      const kind = it.type === "image" && it.kind === "build" ? "build" : it.zone === "art" ? "art" : "ui";
      return `Item ${it.id} (${kind}) ${pos}: ${webTitle(it.title)} (${it.sourceSite}) ${it.sourceUrl}${it.note ? ` note: ${it.note}` : ""}`;
    }
    case "xpost":
      // No picture: an X post is never a model input (lib/xpost). The link and credit only.
      return `X post ${it.id} ${pos}: ${postCredit(it)} ${it.sourceUrl}${it.note ? ` note: ${it.note}` : ""}`;
    case "note":
      return `Note ${it.id} ${pos}: ${it.text.replace(/\s+/g, " ").slice(0, 200)}`;
    case "swatch":
      return `Swatch ${it.id} ${pos}: ${it.hex}${it.role ? ` ${it.role}` : ""}`;
    case "typeSample":
      return `Type sample ${it.id} ${pos}: ${it.pairingId}`;
    case "section":
      return `Section ${it.id}: ${it.title}`;
  }
}

function isRef(it: CanvasItem): it is Extract<CanvasItem, { type: "image" | "upload" }> {
  return it.type === "image" || it.type === "upload";
}

/** Items in reading order, with a thumbnail target for each reference and a text line for the rest. */
function itemsView(items: readonly CanvasItem[]): { lines: string[]; targets: ThumbTarget[] } {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: string[] = [];
  const targets: ThumbTarget[] = [];
  for (const it of sorted) {
    if (isRef(it)) targets.push({ label: itemLine(it), imageUrl: it.imageUrl, thumbUrl: it.thumbUrl ?? null });
    else lines.push(itemLine(it));
  }
  return { lines, targets };
}

export function sectionView(c: CanvasSnapshot, sectionId: string): SnapshotView | null {
  const section = c.sections.find((s) => s.id === sectionId);
  if (!section) return null;
  const items = c.items.filter((it) => it.sectionId === sectionId);
  const { lines, targets } = itemsView(items);
  return {
    head: [
      `Section "${section.title}" (${section.id}) on canvas "${c.title}": ${items.length} item${items.length === 1 ? "" : "s"}, positions in canvas pixels, top to bottom.`,
      ...lines,
      ...(targets.length > 0 ? ["References, each image after the line that names it:"] : []),
    ],
    targets,
    tail: [SNAPSHOT_END],
    structured: { canvasId: c.id, sectionId, items: items.map(({ id, type, x, y, w, h }) => ({ id, type, x, y, w, h })) },
  };
}

export function boardView(c: CanvasSnapshot): SnapshotView {
  const { lines, targets } = itemsView(c.items);
  const stitches = c.stitches ?? [];
  return {
    head: [
      `Canvas "${c.title}" (${c.id}): ${c.sections.length} sections, ${c.items.length} items, ${stitches.length} Frankenstein pages. Positions in canvas pixels.`,
      ...c.sections.map((s) => `Section ${s.id}: ${s.title}`),
      ...stitches.map((s) => `Frankenstein page ${s.id}: ${s.title} (${s.platform}). Call get_snapshot with this stitchId to see its parts.`),
      ...lines,
      ...(targets.length > 0 ? ["References, each image after the line that names it:"] : []),
    ],
    targets,
    tail: [SNAPSHOT_END],
    structured: { canvasId: c.id, sections: c.sections.map((s) => s.id), stitches: stitches.map((s) => s.id) },
  };
}

export function stitchView(c: CanvasSnapshot, stitchId: string): SnapshotView | null {
  const st: StitchSnapshot | undefined = (c.stitches ?? []).find((s) => s.id === stitchId);
  if (!st) return null;
  const targets: ThumbTarget[] = [];
  st.rows.forEach((row, r) => {
    const total = (row.widths ?? row.slots.map(() => 1)).reduce((a, b) => a + b, 0);
    row.slots.forEach((slot, i) => {
      const share = row.slots.length > 1 ? `, ${Math.round(((row.widths?.[i] ?? 1) / total) * 100)}% of the width` : "";
      const crop = slot.crop;
      targets.push({
        label:
          `Row ${r + 1}${row.slots.length > 1 ? `, slot ${i + 1} of ${row.slots.length}${share}` : ""}: ${roleName(slot.role)} (part ${slot.partId}) from ${slot.sourceSite} ${slot.sourceUrl}. ` +
          `Crop x ${pct(crop.x)}, y ${pct(crop.y)}, w ${pct(crop.w)}, h ${pct(crop.h)} (fractions of the image below; the page uses only this band)` +
          `${slot.theme && slot.theme !== "unknown" ? `, ${slot.theme}` : ""}${slot.note ? `. Note: ${slot.note}` : ""}`,
        imageUrl: slot.imageUrl,
        thumbUrl: slot.thumbUrl ?? null,
      });
    });
  });
  const builds = c.items.filter((it) => it.type === "image" && it.kind === "build" && it.stitchId === st.id);
  return {
    head: [
      `Frankenstein page "${st.title}" (${st.id}, ${st.platform}, ${st.mode}), ${st.rows.length} rows top to bottom.${st.note ? ` Idea: ${st.note}` : ""}`,
      "This is a parts view, not a rendered composite: each part below is its full source image, and its crop rect says which band of it the page uses.",
      SHOW_IN_CHAT_HINT,
      ...(st.rows.length === 0 ? ["The page has no rows yet."] : []),
    ],
    targets,
    tail: [
      ...builds.map((b) => `Build next to this page: ${b.id} ${isRef(b) ? `${b.title ?? "Build"} ${b.sourceUrl}` : ""}`),
      SNAPSHOT_END,
    ],
    structured: {
      canvasId: c.id,
      stitchId: st.id,
      platform: st.platform,
      rows: st.rows.map((row) => ({
        id: row.id,
        ...(row.widths ? { widths: row.widths } : {}),
        slots: row.slots.map((s) => ({ role: s.role, partId: s.partId, crop: s.crop, sourceUrl: s.sourceUrl, sourceSite: s.sourceSite, ...(s.note ? { note: s.note } : {}) })),
      })),
      builds: builds.map((b) => b.id),
    },
  };
}
