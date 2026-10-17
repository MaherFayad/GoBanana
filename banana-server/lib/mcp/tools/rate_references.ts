/**
 * `rate_references`: the agent's verdict on search results, so search improves over time with
 * no AI on the server. Free (no search quota).
 *
 * - bad: blocked for this user in every later search (blocked_items), and removed from the canvas
 *   tray when canvasId is given.
 * - great: kept; a positive signal.
 * Every rating is one search_feedback row (personal data, 12-month retention). Ratings feed the
 * per-user creator affinity and the lane wording bandit (lib/learning). Only references saved on
 * the user's own canvases can be rated.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { loadCanvas, mutateCanvas } from "@/lib/canvas/store";
import type { NewFeedback, ReferenceRecord } from "@/lib/db/types";
import { parseCreator } from "@/lib/learning/creator";
import { ART_ONLY_REASONS, badHint, FEEDBACK_REASONS, FEEDBACK_VERDICTS, isArtOnlyReason, type FeedbackReason } from "@/lib/learning/hints";
import { itemKey } from "@/lib/sources/web-search";
import { LANE_NAMES, type LaneName } from "@/lib/sources/types";
import {
  CANVAS_NOT_FOUND,
  lazyTool,
  NOT_SIGNED_IN,
  plausibleId,
  takedownLoader,
  TRY_AGAIN,
  type CanvasToolDeps,
} from "./canvas-shared";
import { reconcileHintFor } from "./reconcile_direction";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "rate_references";

export const TOOL_DESCRIPTION =
  "Rate search results so later searches get better. Free. " +
  'Pass referenceIds from search_references with verdict "bad" (off topic, shop or stock, cluttered, duplicate) or "great" (standouts only). ' +
  "Bad results leave the canvas tray and never come back in this user's searches. " +
  "Rate art direction results the same way (shop or off idea is bad); art only bad reasons: object_only (an object photo, no graphic system) and no_translation (nothing maps to a UI part). " +
  "Each bad rating returns a hint for re-searching its lane. " +
  "Rate from the thumbnails search_references returned, never from the titles alone.";

export const MAX_RATINGS = 50;

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100).optional().describe("Canvas whose tray holds the results. Bad ones are removed from it."),
  ratings: z
    .array(
      z.object({
        referenceId: z.string().min(1).max(100),
        verdict: z.enum(FEEDBACK_VERDICTS),
        reasons: z.array(z.enum(FEEDBACK_REASONS)).max(FEEDBACK_REASONS.length).optional(),
      }),
    )
    .min(1)
    .max(MAX_RATINGS),
});

export type RateReferencesInput = z.input<typeof inputSchema>;

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas, or leave it out.",
  ratings: `Pass 1 to ${MAX_RATINGS} ratings, each with a referenceId and a verdict of great or bad. Reasons: ${FEEDBACK_REASONS.join(", ")}.`,
};

export type RateHint = { referenceId: string; lane: LaneName | null; hint: string };

export type RateReferencesOutput = {
  rated: number;
  great: number;
  bad: number;
  /** Bad items now blocked for this user. */
  blocked: number;
  /** Items taken out of the canvas tray. */
  removedFromTray: number;
  /** Ids that are not saved on the user's canvases (or on the given canvas). */
  notFound: string[];
  hints: RateHint[];
  canvasId?: string;
};

const asLane = (lane: string | null): LaneName | null => (LANE_NAMES as readonly string[]).includes(lane ?? "") ? (lane as LaneName) : null;

function text(out: RateReferencesOutput): string {
  const lines: string[] = [];
  if (out.rated === 0) {
    lines.push("No ratings saved: those results are not on your canvases. Search with a canvasId, then rate the results.");
  } else {
    lines.push(`Rated ${out.rated}: ${out.great} great, ${out.bad} bad.`);
    if (out.bad > 0) {
      const tray = out.removedFromTray > 0 ? ` ${out.removedFromTray} removed from the tray.` : "";
      lines.push(`Bad results will not come back in later searches.${tray}`);
    }
  }
  if (out.notFound.length > 0) lines.push(`Not found on your canvases: ${out.notFound.join(", ")}.`);
  const hints = [...new Set(out.hints.map((h) => (h.lane ? `${h.lane} lane: ${h.hint}` : h.hint)))];
  if (hints.length > 0) lines.push("Next:", ...hints.map((h) => `- ${h}`));
  return lines.join("\n");
}

const NOTHING_TO_REMOVE = "nothing to remove";

/** Plain refusal when art only reasons are given for UI results. Nothing is saved. */
export function artOnlyMessage(ids: readonly string[]): string {
  const which = ids.length === 1 ? `${ids[0]} is a UI result` : `${ids.join(", ")} are UI results`;
  return `${ART_ONLY_REASONS.join(" and ")} are for art direction results only, and ${which}. Use another reason, such as off_topic or not_ui. Nothing was saved.`;
}

export function createRateReferencesTool(deps: CanvasToolDeps) {
  return async function rateReferences(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage(NOT_SIGNED_IN);
    const parsed = parseArgs(inputSchema, raw, MESSAGES, MESSAGES.ratings!);
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    if (input.canvasId && !plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);

    // One rating per reference: the last one wins.
    const byId = new Map(input.ratings.map((r) => [r.referenceId, r]));
    const ids = [...byId.keys()].filter(plausibleId);
    const notFound = [...byId.keys()].filter((id) => !plausibleId(id));

    try {
      let found: Map<string, ReferenceRecord>;
      if (input.canvasId) {
        if (!(await deps.repos.canvases.getOwned(userId, input.canvasId))) return toolMessage(CANVAS_NOT_FOUND);
        found = await deps.repos.references.getByIds(input.canvasId, ids);
      } else {
        found = await deps.repos.references.findOwned(userId, ids);
      }

      // Art only reasons: refuse the call when any is given for a UI result (lane, tray or board zone).
      const artOnly = ids.filter((id) => found.has(id) && (byId.get(id)!.reasons ?? []).some(isArtOnlyReason) && !(found.get(id)!.lane ?? "").startsWith("art"));
      if (artOnly.length > 0) {
        const artKeys = new Set<string>();
        if (input.canvasId) {
          const loaded = await loadCanvas(deps.repos, userId, input.canvasId, takedownLoader(deps));
          for (const t of loaded?.state.tray ?? []) if (t.zone === "art") artKeys.add(itemKey(t.sourceUrl));
          for (const n of loaded?.state.nodes ?? []) if (n.type === "image" && n.data.zone === "art") artKeys.add(itemKey(n.data.sourceUrl));
        }
        const ui = artOnly.filter((id) => !artKeys.has(itemKey(found.get(id)!.sourceUrl)));
        if (ui.length > 0) return toolMessage(artOnlyMessage(ui));
      }

      const rows: NewFeedback[] = [];
      const hints: RateHint[] = [];
      const badKeys = new Set<string>();
      let great = 0;
      for (const id of ids) {
        const rating = byId.get(id)!;
        const ref = found.get(id);
        if (!ref) {
          notFound.push(id);
          continue;
        }
        const key = itemKey(ref.sourceUrl);
        const reasons = [...new Set(rating.reasons ?? [])] as FeedbackReason[];
        rows.push({
          userId,
          itemKey: key,
          sourceSite: ref.sourceSite,
          lane: ref.lane,
          query: ref.query,
          termKey: ref.termKey,
          arm: ref.arm,
          verdict: rating.verdict,
          reasons,
          creator: parseCreator(ref.title),
        });
        if (rating.verdict === "great") {
          great++;
        } else {
          badKeys.add(key);
          const lane = asLane(ref.lane);
          hints.push({ referenceId: id, lane, hint: badHint(lane, reasons) });
        }
      }

      if (rows.length > 0) await deps.repos.feedback.insertMany(rows);
      if (badKeys.size > 0) await deps.repos.blocklist.add(userId, [...badKeys]);

      let removedFromTray = 0;
      if (input.canvasId && badKeys.size > 0) {
        const outcome = await mutateCanvas<number>(deps.repos, userId, input.canvasId, takedownLoader(deps), (state) => {
          const tray = state.tray.filter((t) => !badKeys.has(itemKey(t.sourceUrl)));
          // Nothing in the tray to take out: skip the save so an open canvas is not disturbed.
          if (tray.length === state.tray.length) return { error: NOTHING_TO_REMOVE };
          return { state: { ...state, tray }, value: state.tray.length - tray.length };
        });
        if (outcome.ok) removedFromTray = outcome.value;
      }

      const out: RateReferencesOutput = {
        rated: rows.length,
        great,
        bad: rows.length - great,
        blocked: badKeys.size,
        removedFromTray,
        notFound,
        hints,
        ...(input.canvasId ? { canvasId: input.canvasId } : {}),
      };
      // Great ratings change a direction's palette weights: nudge a reconcile when one is due.
      let hint: string | null = null;
      if (input.canvasId && rows.length > 0) {
        const loaded = await loadCanvas(deps.repos, userId, input.canvasId, takedownLoader(deps));
        if (loaded) hint = await reconcileHintFor(deps.repos, userId, loaded.canvas, loaded.state);
      }
      return toolResult(`${text(out)}${hint ? `\n${hint}` : ""}`, out);
    } catch {
      console.error("[rate_references] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createRateReferencesTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Rate references",
      description: TOOL_DESCRIPTION,
      // Validated in the handler so bad input gets a plain message, not the SDK's raw dump.
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
