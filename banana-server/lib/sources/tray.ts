/**
 * The tray write of a search (pure, runs inside the canvas mutation so parallel searches see each
 * other's writes):
 * - Each result belongs to one direction (plan P0-04): a direction's result whose link is already
 *   on the canvas for anything else (another direction's tray results, the baseline, a plain
 *   search, or an item placed outside this direction's section) is dropped, not added.
 * - The baseline's results (plan P0-03) go in with no direction, and the baseline is saved.
 */
import { addToTray, type CanvasState } from "@/lib/canvas/store";
import type { SavedReference } from "@/lib/db/types";
import { mergeBaseline, type CanvasBaseline } from "./baseline";
import { itemKey } from "./web-search";

/** Item keys of every link on the canvas that is not this direction's own. */
export function takenByOthers(state: CanvasState, directionId: string): Set<string> {
  const taken = new Set<string>();
  for (const r of state.tray) if (r.directionId !== directionId) taken.add(itemKey(r.sourceUrl));
  const own = new Set(
    state.nodes.filter((n) => n.type === "section" && (n.data as { directionId?: unknown }).directionId === directionId).map((n) => n.id),
  );
  for (const n of state.nodes) {
    const url = (n.data as { sourceUrl?: unknown }).sourceUrl;
    if (typeof url === "string" && !(n.parentId && own.has(n.parentId))) taken.add(itemKey(url));
  }
  return taken;
}

export type SearchTrayWrite = { state: CanvasState; /** Ids of results dropped as another direction's. */ dropped: string[] };

export function writeSearchTray(
  state: CanvasState,
  references: readonly SavedReference[],
  directionId: string | undefined,
  baseline?: CanvasBaseline,
): SearchTrayWrite {
  const shipped = new Set(baseline?.referenceIds ?? []);
  const base = references.filter((r) => shipped.has(r.id));
  let own = references.filter((r) => !shipped.has(r.id));
  const dropped: string[] = [];
  if (directionId) {
    const taken = takenByOthers(state, directionId);
    own = own.filter((r) => {
      if (!taken.has(itemKey(r.sourceUrl))) return true;
      dropped.push(r.id);
      return false;
    });
  }
  let next = base.length > 0 ? addToTray(state, base) : state;
  next = own.length > 0 ? addToTray(next, own, directionId) : next;
  if (baseline) next = { ...next, baseline: mergeBaseline(state.baseline, baseline, new Date(baseline.at)) };
  return { state: next, dropped };
}
