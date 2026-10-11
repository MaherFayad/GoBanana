/**
 * Shared wiring for the canvas tools (open_canvas, add_to_canvas, arrange_canvas,
 * get_canvas, extract_palette, export_kit). Not a tool itself.
 *
 * Every tool takes `CanvasToolDeps`, so tests pass in-memory repos (lib/db/memory.ts)
 * and the live server passes the Drizzle ones, built lazily so env is read per request.
 */
import { getConfig } from "@/lib/config";
import { getRepos, memoTakedowns } from "@/lib/db";
import type { Repos } from "@/lib/db/types";
import type { LoadMatcher, MutateOutcome } from "@/lib/canvas/store";
import { toolMessage, type ToolResult } from "./types";

export type CanvasToolDeps = {
  repos: Repos;
  /** Public origin without a trailing slash. */
  appUrl(): string | undefined;
  /** Node id maker, injectable for tests. */
  makeId?(prefix: string): string;
  now?(): Date;
};

export function liveCanvasDeps(): CanvasToolDeps {
  return { repos: getRepos(), appUrl: () => getConfig().appUrl };
}

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

/** Lazily builds a tool from live deps on first call, so env is read at request time. */
export function lazyTool<I, R>(
  build: (deps: CanvasToolDeps) => (input: I, userId: string | undefined) => Promise<R>,
): (input: I, userId: string | undefined) => Promise<R | ToolResult> {
  let tool: ((input: I, userId: string | undefined) => Promise<R>) | undefined;
  return async (input, userId) => {
    if (!userId) return toolMessage(NOT_SIGNED_IN);
    try {
      tool ??= build(liveCanvasDeps());
    } catch {
      // For example DATABASE_URL missing. Never pass the raw error to the agent.
      console.error("[mcp] canvas tools are not configured");
      return toolMessage(TRY_AGAIN);
    }
    return tool(input, userId);
  };
}

const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
/** Shape check for ids in tool input (uuids and the `ref_` / `bd-` ids we hand out). */
export function plausibleId(value: string): boolean {
  return ID_RE.test(value);
}
