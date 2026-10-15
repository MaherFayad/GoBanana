/**
 * Shared wiring for the canvas tools (open_canvas, add_to_canvas, arrange_canvas,
 * get_canvas, extract_palette, export_kit). Not a tool itself.
 *
 * Every tool takes `CanvasToolDeps`, so tests pass in-memory repos (lib/db/memory.ts)
 * and the live server passes the Drizzle ones, built lazily so env is read per request.
 */
import { liveAtlasLoader } from "@/lib/atlas/live";
import { loaderSource, type AtlasSource } from "@/lib/atlas/source";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { getRepos, memoTakedowns } from "@/lib/db";
import type { Repos } from "@/lib/db/types";
import type { LoadMatcher, MutateOutcome } from "@/lib/canvas/store";
import { MAX_TASTE_TERM_LENGTH, MAX_TASTE_TERMS } from "@/lib/taste";
import { toolMessage, type ToolResult } from "./types";

export type CanvasToolDeps = {
  repos: Repos;
  /** Public origin without a trailing slash. */
  appUrl(): string | undefined;
  /** Node id maker, injectable for tests. */
  makeId?(prefix: string): string;
  now?(): Date;
  /** The Banana Atlas for this call (W2: cut_parts anatomy, export_kit cards), or null when there is none. */
  atlasSource?(): AtlasSource | null;
};

/** Live deps. `repos` is read lazily, so input checks run even when the database is not configured. */
export function liveCanvasDeps(): CanvasToolDeps {
  return {
    get repos() {
      return getRepos();
    },
    appUrl: () => getConfig().appUrl,
    atlasSource: () => {
      const loader = liveAtlasLoader();
      return loader ? loaderSource(loader) : null;
    },
  };
}

/** `taste` tool input (bend_brief, search_references, open_canvas): up to 5 short style terms. */
export const tasteInputSchema = z
  .array(z.string().trim().min(1).max(MAX_TASTE_TERM_LENGTH))
  .min(1)
  .max(MAX_TASTE_TERMS)
  .describe(
    'Up to 5 short style words for the look the user likes, for example ["glassmorphism", "big typography", "dark mode"]. Describe their reference boards in words. Saved on the canvas for later searches.',
  );

/** Pricing page for upgrade messages (app/(site)/[locale]/pricing). */
export function upgradeUrl(deps: Pick<CanvasToolDeps, "appUrl">): string {
  return `${deps.appUrl() ?? ""}/en/pricing`;
}

/** One takedown list read per tool call (spec section 2 rule 5). */
export function takedownLoader(deps: Pick<CanvasToolDeps, "repos">): LoadMatcher {
  return memoTakedowns(deps.repos.takedowns);
}

export const NOT_SIGNED_IN = "You are not signed in. Reconnect to sign in again.";
export const CANVAS_NOT_FOUND = "That canvas was not found. Call open_canvas to create one, or check the canvasId.";
export const CANVAS_BUSY = "The canvas changed while saving. Try again.";
export const TRY_AGAIN = "Something went wrong on our side. Try again in a minute.";

/** Plain message for a failed canvas change. */
export function mutateError(outcome: Exclude<MutateOutcome<unknown>, { ok: true }>): ToolResult {
  if (outcome.reason === "rejected") return toolMessage(outcome.message);
  if (outcome.reason === "conflict") return toolMessage(CANVAS_BUSY);
  return toolMessage(CANVAS_NOT_FOUND);
}

/**
 * Builds a tool over live deps on first call. Tools must touch `deps.repos` only inside
 * their try block, so a missing DATABASE_URL becomes a plain message, never a raw error.
 */
export function lazyTool<I, R>(
  build: (deps: CanvasToolDeps) => (input: I, userId: string | undefined) => Promise<R>,
): (input: I, userId: string | undefined) => Promise<R> {
  let tool: ((input: I, userId: string | undefined) => Promise<R>) | undefined;
  return (input, userId) => {
    tool ??= build(liveCanvasDeps());
    return tool(input, userId);
  };
}

const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
/** Shape check for ids in tool input (uuids and the `ref_` / `bd-` ids we hand out). */
export function plausibleId(value: string): boolean {
  return ID_RE.test(value);
}
