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
import { loadCanvas, mutateCanvas, type CanvasState } from "@/lib/canvas/store";
import type { NewFeedback, ReferenceRecord } from "@/lib/db/types";
import { parseCreator } from "@/lib/learning/creator";
import { atlasFeedbackRows, referenceAtlasIds } from "@/lib/learning/directions";
import { badHint, FEEDBACK_REASONS, FEEDBACK_VERDICTS, type FeedbackReason } from "@/lib/learning/hints";
import { itemKey } from "@/lib/sources/web-search";
import { MAX_SWIPE_ITEMS } from "@/lib/swipe";
import { LANE_NAMES, type LaneName } from "@/lib/sources/types";
import { cleanStyles, MAX_STYLE_TAGS, STYLE_IDS, type StyleId } from "@/lib/styles/ids";
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
  "Rate art direction results the same way (shop or off idea is bad). " +
  "Each bad rating returns a hint for re-searching its lane. " +
  "save: true keeps the great ones in the user's swipe file. " +
  "Add styles: 1 or 2 style ids read from the thumbnail, main first (docs/styles); the board's style mix uses them. " +
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
        styles: z.array(z.enum(STYLE_IDS)).min(1).max(MAX_STYLE_TAGS).optional().describe("Style ids read from the thumbnail, main style first."),
      }),
    )
    .min(1)
    .max(MAX_RATINGS),
  save: z.boolean().optional().describe("Also keep the great ones in the user's swipe file (links only), to reuse on other boards."),
});

export type RateReferencesInput = z.input<typeof inputSchema>;

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas, or leave it out.",
  ratings: `Pass 1 to ${MAX_RATINGS} ratings, each with a referenceId and a verdict of great or bad. Reasons: ${FEEDBACK_REASONS.join(", ")}. Styles: 1 or 2 of ${STYLE_IDS.join(", ")}.`,
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
  /** Great references newly kept in the swipe file (save: true). */
  swipeSaved?: number;
  /** References whose style tags were saved on their canvas (tray and board). */
  styled?: number;
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
  if (out.styled) lines.push(`Style tags saved on ${out.styled} reference${out.styled === 1 ? "" : "s"}; get_canvas summary checks the style mix.`);
  if (out.notFound.length > 0) lines.push(`Not found on your canvases: ${out.notFound.join(", ")}.`);
  const hints = [...new Set(out.hints.map((h) => (h.lane ? `${h.lane} lane: ${h.hint}` : h.hint)))];
  if (hints.length > 0) lines.push("Next:", ...hints.map((h) => `- ${h}`));
  return lines.join("\n");
}

const NOTHING_TO_REMOVE = "nothing to remove";

/**
 * Style tags onto a canvas: every tray result and placed image whose link has tags in `tags` (by
 * item key). Returns the count of distinct links tagged, or an error when nothing matched (so the
 * canvas is not saved for nothing).
 */
export function applyStyleTags(state: CanvasState, tags: ReadonlyMap<string, StyleId[]>): { state: CanvasState; value: number } | { error: string } {
  const hit = new Set<string>();
  const tray = state.tray.map((t) => {
    const s = tags.get(itemKey(t.sourceUrl));
    if (!s) return t;
    hit.add(itemKey(t.sourceUrl));
    return { ...t, styles: s };
  });
  const nodes = state.nodes.map((n) => {
    if (n.type !== "image" && n.type !== "upload") return n;
    const s = tags.get(itemKey(n.data.sourceUrl));
    if (!s) return n;
    hit.add(itemKey(n.data.sourceUrl));
    return { ...n, data: { ...n.data, styles: s } } as typeof n;
  });
  if (hit.size === 0) return { error: NOTHING_TO_REMOVE };
  return { state: { ...state, tray, nodes }, value: hit.size };
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

      const rows: NewFeedback[] = [];
      /** Reference id of each row in `rows`. */
      const ratedIds: string[] = [];
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
        ratedIds.push(id);
        if (rating.verdict === "great") {
          great++;
        } else {
          badKeys.add(key);
          const lane = asLane(ref.lane);
          hints.push({ referenceId: id, lane, hint: badHint(lane, reasons) });
        }
      }

      // A result found by an Atlas recipe and card: a great boosts both, a bad lowers the recipe (lane "atlas").
      const atlasRows = rows.flatMap((row, i) => {
        const ref = found.get(ratedIds[i]!);
        return ref ? atlasFeedbackRows(row, referenceAtlasIds(ref, row.verdict)) : [];
      });
      if (rows.length > 0) await deps.repos.feedback.insertMany([...rows, ...atlasRows]);

      // save: true keeps the great ones in the user's swipe file (links only; takedowns are checked).
      let swipeSaved: number | undefined;
      let swipeNote = "";
      if (input.save && great > 0) {
        try {
          const repo = deps.swipe?.();
          if (!repo) throw new Error("no swipe repo");
          const matcher = await takedownLoader(deps)();
          const items = ids.flatMap((id) => {
            const ref = found.get(id);
            if (!ref || byId.get(id)?.verdict !== "great" || matcher.isReferenceBlocked(ref)) return [];
            return [
              {
                kind: "reference" as const,
                sourceSite: ref.sourceSite,
                sourceUrl: ref.sourceUrl,
                imageUrl: ref.imageUrl,
                thumbUrl: ref.thumbUrl,
                title: ref.title,
                fromCanvasId: ref.canvasId,
              },
            ];
          });
          const res = await repo.addMany(userId, items);
          swipeSaved = res.added;
          swipeNote = res.full
            ? `Swipe file: saved ${res.added}; it is full (${MAX_SWIPE_ITEMS} items). Ask the user which items to remove on the library page.`
            : `Swipe file: saved ${res.added} great reference${res.added === 1 ? "" : "s"}${res.skipped > 0 ? `, ${res.skipped} already there` : ""}.`;
        } catch {
          console.error("[rate_references] swipe save failed");
          swipeNote = "Swipe file: could not save this time. The ratings are saved.";
        }
      }
      if (badKeys.size > 0) await deps.repos.blocklist.add(userId, [...badKeys]);

      // Style tags read from the thumbnails: saved on the tray result and the placed reference, per canvas.
      const styleByCanvas = new Map<string, Map<string, StyleId[]>>();
      for (const id of ratedIds) {
        const ref = found.get(id);
        const styles = cleanStyles(byId.get(id)?.styles);
        if (!ref || !styles) continue;
        const m = styleByCanvas.get(ref.canvasId) ?? new Map<string, StyleId[]>();
        m.set(itemKey(ref.sourceUrl), styles);
        styleByCanvas.set(ref.canvasId, m);
      }
      let styled = 0;
      for (const [canvasId, tags] of styleByCanvas) {
        const outcome = await mutateCanvas<number>(deps.repos, userId, canvasId, takedownLoader(deps), (state) => applyStyleTags(state, tags));
        if (outcome.ok) styled += outcome.value;
      }

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
        ...(swipeSaved !== undefined ? { swipeSaved } : {}),
        ...(styled > 0 ? { styled } : {}),
      };
      // Great ratings change a direction's palette weights: nudge a reconcile when one is due.
      let hint: string | null = null;
      if (input.canvasId && rows.length > 0) {
        const loaded = await loadCanvas(deps.repos, userId, input.canvasId, takedownLoader(deps));
        if (loaded) hint = await reconcileHintFor(deps.repos, userId, loaded.canvas, loaded.state);
      }
      return toolResult(`${text(out)}${swipeNote ? `\n${swipeNote}` : ""}${hint ? `\n${hint}` : ""}`, out);
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
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
