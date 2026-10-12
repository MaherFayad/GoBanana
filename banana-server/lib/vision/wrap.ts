/**
 * Thumbnail wrappers for finished tool results. Each tool's `register` calls one after its
 * handler, so the handlers (and their tests) stay text and structured content only.
 */
import type { CanvasItem } from "@/lib/canvas/types";
import { canvasTargets, capTargets, mobbinExpiryLines, placedTargets, searchTargets } from "./board";
import { wantsThumbs, withThumbs, type ThumbOptions, type VisionResult } from "./thumbs";

export type WrapOptions = ThumbOptions & { now?: Date };

/** search_references: a thumbnail per result (first 12). */
export async function searchWithThumbs(result: VisionResult, args: unknown, opts: WrapOptions = {}): Promise<VisionResult> {
  if (!wantsThumbs(args)) return result;
  const { targets, rest } = capTargets(searchTargets(result.structuredContent));
  return withThumbs(result, targets, { ...opts, rest });
}

/** add_to_canvas: a thumbnail per placed or refreshed reference. */
export async function placedWithThumbs(result: VisionResult, args: unknown, opts: WrapOptions = {}): Promise<VisionResult> {
  if (!wantsThumbs(args)) return result;
  const { targets, rest } = capTargets(placedTargets(result.structuredContent));
  return withThumbs(result, targets, { ...opts, rest });
}

/** get_canvas: thumbnails of placed references (first 12) and the Mobbin expiry check. */
export async function canvasWithThumbs(result: VisionResult, args: unknown, opts: WrapOptions = {}): Promise<VisionResult> {
  if (result.isError) return result;
  const canvas = result.structuredContent?.canvas as { items?: CanvasItem[] } | undefined;
  const items = Array.isArray(canvas?.items) ? canvas.items : [];
  const extra = mobbinExpiryLines(
    items.map((it) => ({ ...it, title: "title" in it ? it.title : null, sourceUrl: "sourceUrl" in it ? it.sourceUrl : null, sourceSite: "sourceSite" in it ? it.sourceSite : null })),
    opts.now ?? new Date(),
  );
  const { targets, rest } = wantsThumbs(args) ? capTargets(canvasTargets(items)) : { targets: [], rest: 0 };
  return withThumbs(result, targets, { ...opts, rest, restHint: "Call get_snapshot with a sectionId to see a section's references.", extra });
}
