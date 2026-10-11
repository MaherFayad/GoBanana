/**
 * Server-side canvas loader for `app/c/[id]/page.tsx`.
 *
 * TODO(db, lead): replace this stub with a real loader once `db/` lands:
 *   1. Check the session (WorkOS AuthKit) and that the canvas belongs to the user;
 *      return null (page renders notFound) otherwise.
 *   2. Select `canvases.title` and `canvases.state` for `id`.
 *   3. Load the takedown list (`loadTakedownMatcher` from lib/takedown.ts) and pass
 *      `matcher.isBlocked` as `isBlocked` below (hard rule 5: check on every canvas load).
 *   4. Return `{ id, title, state }` with the filtered state.
 *
 * Until then it returns `state: null`, so the client loads through
 * `GET /api/canvas/:id` (canvas/persistence.ts), and that route must apply the
 * same takedown filter (`filterBlocked` from canvas/state.ts).
 */
import { filterBlocked, parseState, type IsBlocked } from "./state";
import type { CanvasState } from "./types";

export interface PageCanvas {
  id: string;
  title: string;
  /** Filtered state, or null to let the client load it through the API. */
  state: CanvasState | null;
  readOnly: boolean;
}

/** Accept ids the DB could hold (uuid) plus simple slugs used in tests. */
export function isPlausibleCanvasId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

/** Pure part of the loader, ready for the real implementation: parse, then run the takedown filter. */
export function prepareStateForPage(raw: unknown, isBlocked?: IsBlocked): CanvasState {
  return filterBlocked(parseState(raw), isBlocked).state;
}

export async function loadCanvasForPage(id: string): Promise<PageCanvas | null> {
  if (!isPlausibleCanvasId(id)) return null;
  // TODO(db, lead): see the file comment. Stub: no server data yet.
  return { id, title: "Moodboard", state: null, readOnly: false };
}
