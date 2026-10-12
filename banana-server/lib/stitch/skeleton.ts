/**
 * Compact page skeletons of stitches for tool output and exports: row by row, each slot's role,
 * source site and source link. Every slot keeps its source (hard rule 3).
 */
import type { StitchRowSnapshot, StitchSnapshot } from "@/lib/canvas/types";
import type { PartRole } from "./types";

export interface SkeletonSlot {
  slotId: string;
  role: PartRole;
  partId: string;
  sourceSite: string;
  sourceUrl: string;
  sourceTitle?: string;
  note?: string;
}

export interface SkeletonRow {
  rowId: string;
  slots: SkeletonSlot[];
  widths?: number[];
}

export function skeleton(rows: readonly StitchRowSnapshot[]): SkeletonRow[] {
  return rows.map((r) => ({
    rowId: r.id,
    slots: r.slots.map((s) => ({
      slotId: s.id,
      role: s.role,
      partId: s.partId,
      sourceSite: s.sourceSite,
      sourceUrl: s.sourceUrl,
      ...(s.title ? { sourceTitle: s.title } : {}),
      ...(s.note ? { note: s.note } : {}),
    })),
    ...(r.widths ? { widths: r.widths } : {}),
  }));
}

/** Plain role name: "status-header" reads "status header". */
export function roleName(role: string): string {
  return role.replace(/-/g, " ");
}

/**
 * One line per row: "1. row rw-1: nav (slot sl-1, part pt-a) from "Title" on dribbble.com <link>".
 * Slots in a row are joined with " | ".
 */
export function skeletonLines(rows: readonly StitchRowSnapshot[], indent = "  "): string[] {
  return rows.map((r, i) => {
    const cells = r.slots.map(
      (s) =>
        `${roleName(s.role)} (slot ${s.id}, part ${s.partId}) from ${s.title ? `"${s.title.replace(/\s+/g, " ").slice(0, 80)}" on ` : ""}${s.sourceSite} ${s.sourceUrl}${s.note ? ` note: ${s.note}` : ""}`,
    );
    return `${indent}${i + 1}. row ${r.id}${r.widths ? ` (widths ${r.widths.join(":")})` : ""}: ${cells.join(" | ")}`;
  });
}

/** Distinct source sites of a stitch, in order of first use. */
export function sourceSites(s: Pick<StitchSnapshot, "rows">): string[] {
  return [...new Set(s.rows.flatMap((r) => r.slots.map((x) => x.sourceSite)))];
}
