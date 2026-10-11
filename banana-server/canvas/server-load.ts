/**
 * Server-side canvas loaders for `app/c/[id]/page.tsx` (owner, editable) and
 * `app/s/[token]/page.tsx` (anyone with the link, view only).
 *
 * Both apply the takedown filter on every load (hard rule 5) and fail closed: if the
 * takedown list cannot load, nothing is shown.
 */
import { filterBlocked, parseState, type IsBlocked } from "./state";
import type { CanvasState } from "./types";
import { loadCanvas } from "@/lib/canvas/store";
import { memoTakedowns } from "@/lib/db/takedowns";
import type { ShareRepo } from "@/lib/db/shares";
import type { Repos } from "@/lib/db/types";
import { limitsFor } from "@/lib/quota";
import type { TakedownMatcher } from "@/lib/takedown";
import type { WebUser } from "@/lib/web-session";

export interface PageCanvas {
  id: string;
  title: string;
  /** Filtered state, or null to let the client load it through the API. */
  state: CanvasState | null;
  /** `updated_at` of the loaded state (ISO), sent back as `baseUpdatedAt` on save. */
  updatedAt: string | null;
  readOnly: boolean;
  /** Current share token, for the share button. */
  shareToken: string | null;
  /** Whether the owner's plan allows share links. */
  canShare: boolean;
}

export type PageLoad = { kind: "ok"; canvas: PageCanvas } | { kind: "signed_out" } | { kind: "not_found" };

/** Accept ids the DB could hold (uuid) plus simple slugs used in tests. */
export function isPlausibleCanvasId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

/** Parse, then run the takedown filter. */
export function prepareStateForPage(raw: unknown, isBlocked?: IsBlocked): CanvasState {
  return filterBlocked(parseState(raw), isBlocked).state;
}

export type CanvasPageDeps = {
  getUser(): Promise<WebUser | null>;
  repos(): Pick<Repos, "canvases" | "takedowns">;
  /** Test-only E2E bypass (lib/web-auth.ts): skip the database, the client loads through the API. */
  bypass?: boolean;
};

export async function loadCanvasForPage(id: string, deps: CanvasPageDeps): Promise<PageLoad> {
  if (!isPlausibleCanvasId(id)) return { kind: "not_found" };
  const user = await deps.getUser();
  if (!user) return { kind: "signed_out" };
  const canShare = limitsFor(user.plan).shareLinks;
  if (deps.bypass) {
    return {
      kind: "ok",
      canvas: { id, title: "Moodboard", state: null, updatedAt: null, readOnly: false, shareToken: null, canShare },
    };
  }
  const repos = deps.repos();
  // Same answer for "missing" and "not yours", so ids cannot be probed.
  const loaded = await loadCanvas(repos, user.userId, id, memoTakedowns(repos.takedowns));
  if (!loaded) return { kind: "not_found" };
  return {
    kind: "ok",
    canvas: {
      id: loaded.canvas.id,
      title: loaded.canvas.title,
      state: loaded.state,
      updatedAt: loaded.canvas.updatedAt.toISOString(),
      readOnly: false,
      shareToken: loaded.canvas.shareToken,
      canShare,
    },
  };
}

export type SharedPageCanvas = { title: string; state: CanvasState; removed: number };

export type SharedPageDeps = {
  shares(): Pick<ShareRepo, "getShared">;
  loadMatcher(): Promise<TakedownMatcher>;
};

/**
 * A canvas by share token: title and state only. Null when the token is unknown or the
 * owner's plan no longer allows share links. The tray (search results not on the board)
 * is never sent to viewers.
 */
export async function loadSharedCanvas(token: string, deps: SharedPageDeps): Promise<SharedPageCanvas | null> {
  const shared = await deps.shares().getShared(token);
  if (!shared || !limitsFor(shared.ownerPlan).shareLinks) return null;
  const matcher = await deps.loadMatcher();
  const { state, removed } = filterBlocked(parseState(shared.state), (url) => matcher.isBlocked(url));
  return { title: shared.title, state: { ...state, tray: [] }, removed };
}
