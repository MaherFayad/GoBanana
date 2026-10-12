/**
 * Which references a tool result shows as thumbnails, and the Mobbin expiry check. Pure: reads a
 * finished tool result's structured content, so the tools stay as they were and only their
 * `register` wrappers call lib/vision/thumbs.ts.
 */
import type { CanvasItem } from "@/lib/canvas/types";
import { MOBBIN_SITE, isMobbinSource } from "@/lib/sources/mobbin";
import { MAX_THUMBS, type ThumbTarget } from "./thumbs";

/** Mobbin image links expire about 30 days after the connector returns them; flag them a little earlier. */
export const MOBBIN_REFRESH_DAYS = 25;
const DAY_MS = 86_400_000;

type RefLike = { id?: unknown; title?: unknown; sourceSite?: unknown; imageUrl?: unknown; thumbUrl?: unknown };

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function refTarget(r: RefLike, prefix: string): ThumbTarget | null {
  const imageUrl = str(r.imageUrl);
  if (!imageUrl) return null;
  return {
    label: `${prefix} ${str(r.id) ?? ""}: ${str(r.title) ?? "Untitled"} (${str(r.sourceSite) ?? "source"})`,
    imageUrl,
    thumbUrl: str(r.thumbUrl) ?? null,
  };
}

/** Split targets at the per-call cap. */
export function capTargets(all: ThumbTarget[], max = MAX_THUMBS): { targets: ThumbTarget[]; rest: number } {
  return { targets: all.slice(0, max), rest: Math.max(0, all.length - max) };
}

/** search_references: one thumbnail per result, in the order the text lists them (UI, then art). */
export function searchTargets(structured: Record<string, unknown> | undefined): ThumbTarget[] {
  const refs = Array.isArray(structured?.references) ? (structured.references as (RefLike & { zone?: unknown })[]) : [];
  const ordered = [...refs.filter((r) => r.zone !== "art"), ...refs.filter((r) => r.zone === "art")];
  return ordered.flatMap((r) => refTarget(r, "Reference") ?? []);
}

/** get_canvas: placed references, section by section in reading order. */
export function canvasTargets(items: readonly CanvasItem[]): ThumbTarget[] {
  const refs = items.filter((it) => it.type === "image" || it.type === "upload");
  const sorted = [...refs].sort((a, b) => (a.sectionId ?? "").localeCompare(b.sectionId ?? "") || a.y - b.y || a.x - b.x);
  return sorted.flatMap((it) => refTarget(it as RefLike, "Item") ?? []);
}

/** add_to_canvas: the placed (or refreshed) references, from the output's `items`. */
export function placedTargets(structured: Record<string, unknown> | undefined): ThumbTarget[] {
  const list = [
    ...(Array.isArray(structured?.items) ? structured.items : []),
    ...(Array.isArray(structured?.updated) ? structured.updated : []),
  ] as RefLike[];
  return list.flatMap((it) => refTarget(it, "Item") ?? []);
}

type MobbinLike = { id: string; type: string; title?: string | null; sourceUrl?: string | null; sourceSite?: string | null; placedAt?: string | null; mobbinId?: string | null };

function isMobbinItem(it: MobbinLike): boolean {
  return it.type === "image" && (it.sourceSite === MOBBIN_SITE || isMobbinSource(it));
}

/**
 * Lines for get_canvas: Mobbin screens placed more than MOBBIN_REFRESH_DAYS ago (their image link
 * may have expired) and how to refresh them. Screens with no placed date are counted apart.
 */
export function mobbinExpiryLines(items: readonly MobbinLike[], now: Date): string[] {
  const mobbin = items.filter(isMobbinItem);
  if (mobbin.length === 0) return [];
  const stale: string[] = [];
  let undated = 0;
  for (const it of mobbin) {
    const placed = it.placedAt ? Date.parse(it.placedAt) : NaN;
    if (!Number.isFinite(placed)) {
      undated += 1;
      continue;
    }
    const days = Math.floor((now.getTime() - placed) / DAY_MS);
    if (days > MOBBIN_REFRESH_DAYS) {
      stale.push(`- ${it.id}: ${it.title ?? "Mobbin screen"} ${it.sourceUrl ?? ""}${it.mobbinId ? ` (screen id ${it.mobbinId})` : ""}, placed ${days} days ago`);
    }
  }
  const how =
    "Look each one up again in the Mobbin connector (search_screens with its app and screen) and call add_to_canvas with { type: 'screen', screenId, imageUrl: image_url, sourceUrl: mobbin_url } for the same screen: it replaces the image in place, keeping the tile, note and parts.";
  const lines: string[] = [];
  if (stale.length > 0) {
    lines.push(`Mobbin images expire about 30 days after the connector returns them. ${stale.length} on this board may have expired; until refreshed the board shows "Image expired, open on Mobbin":`, ...stale, how);
  }
  if (undated > 0) {
    lines.push(
      `${undated} Mobbin screen${undated === 1 ? " has" : "s have"} no placed date (placed before dates were kept). If the user says one shows "Image expired", refresh it the same way.${stale.length === 0 ? ` ${how}` : ""}`,
    );
  }
  return lines;
}
