/**
 * `rate_directions`: the agent's triage of bend_brief directions for one canvas. Free (no search
 * quota), no AI on the server.
 *
 * - drop: the direction leaves the canvas: its row, its section with everything inside, and the
 *   tray results found for it. Nothing else references a direction row.
 * - keep: nothing changes on the canvas; a positive signal.
 * Every rating is one search_feedback row (no new table): lane "direction", item key the bend id,
 * source site "bend", term key `direction|{ingredient}`, arm the move, keep as great and drop as
 * bad, plus reasons. bend_brief weights ingredients by these ratings (lib/learning/directions.ts).
 * Only directions on the user's own canvas can be rated.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { inspirationFromQuery } from "@/lib/bend/queries";
import { mutateCanvas, type CanvasState } from "@/lib/canvas/store";
import type { DirectionRecord, NewFeedback } from "@/lib/db/types";
import {
  DIRECTION_LANE,
  DIRECTION_REASONS,
  DIRECTION_SOURCE,
  DIRECTION_VERDICTS,
  directionVerdict,
  type DirectionReason,
  type DirectionVerdict,
} from "@/lib/learning/directions";
import { directionTermKey, queryWords } from "@/lib/learning/terms";
import {
  CANVAS_BUSY,
  CANVAS_NOT_FOUND,
  lazyTool,
  NOT_SIGNED_IN,
  plausibleId,
  takedownLoader,
  TRY_AGAIN,
  type CanvasToolDeps,
} from "./canvas-shared";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "rate_directions";

export const TOOL_DESCRIPTION =
  "Keep or drop bend_brief directions on a canvas after you judge them, so the board shows only usable ideas. Free. " +
  'Pass the canvasId and one rating per directionId: "drop" (with reasons) for an idea with no UI path for this screen, ' +
  'too few usable references, off brief or a near duplicate; "keep" for the ones you show. ' +
  "A dropped direction leaves the canvas with its section, the items in it and its tray results. " +
  "Later bends suggest often dropped ideas less.";

export const MAX_RATINGS = 20;

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100).describe("Canvas the directions were saved to (bend_brief with canvasId)."),
  ratings: z
    .array(
      z.object({
        directionId: z.string().min(1).max(100),
        verdict: z.enum(DIRECTION_VERDICTS),
        reasons: z.array(z.enum(DIRECTION_REASONS)).max(DIRECTION_REASONS.length).optional(),
      }),
    )
    .min(1)
    .max(MAX_RATINGS),
});

export type RateDirectionsInput = z.input<typeof inputSchema>;

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas.",
  ratings: `Pass 1 to ${MAX_RATINGS} ratings, each with a directionId and a verdict of keep or drop. Reasons: ${DIRECTION_REASONS.join(", ")}.`,
};

export type RateDirectionsOutput = {
  canvasId: string;
  rated: number;
  kept: string[];
  dropped: string[];
  /** Sections taken off the canvas, and the items that were inside them. */
  removedSections: number;
  removedItems: number;
  /** Tray results found for a dropped direction. */
  removedFromTray: number;
  /** Ids that are not directions of this canvas. */
  notFound: string[];
};

function text(out: RateDirectionsOutput): string {
  const lines: string[] = [];
  if (out.rated === 0) {
    lines.push("No ratings saved: those directions are not on this canvas. Save them with bend_brief and this canvasId first.");
  } else {
    lines.push(`Rated ${out.rated} directions: kept ${out.kept.length}, dropped ${out.dropped.length}.`);
    if (out.dropped.length > 0) {
      lines.push(
        `Dropped ${out.dropped.join(", ")}: removed ${out.removedSections} section${out.removedSections === 1 ? "" : "s"}, ` +
          `${out.removedItems} item${out.removedItems === 1 ? "" : "s"} and ${out.removedFromTray} tray result${out.removedFromTray === 1 ? "" : "s"}.`,
      );
    }
  }
  if (out.notFound.length > 0) lines.push(`Not directions of this canvas: ${out.notFound.join(", ")}.`);
  return lines.join("\n");
}

/** The id a direction goes by on the canvas (sections and tray tags): its bend id, else its row id. */
const keyOf = (d: DirectionRecord) => d.bendId ?? d.id;

/**
 * Take dropped directions off a canvas state: sections tagged with one of `ids`, every node inside
 * them (nested sections too), and tray results tagged with one of `ids`. Pure.
 */
export function removeDirections(
  state: CanvasState,
  ids: ReadonlySet<string>,
): { state: CanvasState; sections: number; items: number; tray: number } {
  const gone = new Set(
    state.nodes.filter((n) => n.type === "section" && n.data.directionId && ids.has(n.data.directionId)).map((n) => n.id),
  );
  const sections = gone.size;
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of state.nodes) {
      if (!gone.has(n.id) && n.parentId && gone.has(n.parentId)) {
        gone.add(n.id);
        grew = true;
      }
    }
  }
  const nodes = state.nodes.filter((n) => !gone.has(n.id));
  const tray = state.tray.filter((t) => !(t.directionId && ids.has(t.directionId)));
  return {
    state: { ...state, nodes, tray },
    sections,
    items: gone.size - sections,
    tray: state.tray.length - tray.length,
  };
}

const NOTHING_TO_REMOVE = "nothing to remove";

type Removed = { sections: number; items: number; tray: number };

export function createRateDirectionsTool(deps: CanvasToolDeps) {
  return async function rateDirections(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage(NOT_SIGNED_IN);
    const parsed = parseArgs(inputSchema, raw, MESSAGES, MESSAGES.ratings!);
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    if (!plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);

    // One rating per direction: the last one wins.
    const byId = new Map(input.ratings.map((r) => [r.directionId, r]));

    try {
      const { repos } = deps;
      if (!(await repos.canvases.getOwned(userId, input.canvasId))) return toolMessage(CANVAS_NOT_FOUND);
      const directions = await repos.directions.listForCanvas(input.canvasId);

      const notFound: string[] = [];
      const rated: { direction: DirectionRecord; verdict: DirectionVerdict; reasons: DirectionReason[] }[] = [];
      const seen = new Set<string>();
      for (const [id, rating] of byId) {
        const direction = directions.find((d) => d.bendId === id || d.id === id.toLowerCase());
        if (!direction || seen.has(direction.id)) {
          if (!direction) notFound.push(id);
          continue;
        }
        seen.add(direction.id);
        rated.push({ direction, verdict: rating.verdict, reasons: [...new Set(rating.reasons ?? [])] });
      }

      const drops = rated.filter((r) => r.verdict === "drop").map((r) => r.direction);
      let removed: Removed = { sections: 0, items: 0, tray: 0 };
      if (drops.length > 0) {
        // Sections and tray results may carry the bend id or the row id.
        const ids = new Set(drops.flatMap((d) => [d.id, ...(d.bendId ? [d.bendId] : [])]));
        const outcome = await mutateCanvas<Removed>(repos, userId, input.canvasId, takedownLoader(deps), (state) => {
          const next = removeDirections(state, ids);
          // Nothing on the canvas for these directions: skip the save so an open canvas is not disturbed.
          if (next.sections + next.items + next.tray === 0) return { error: NOTHING_TO_REMOVE };
          return { state: next.state, value: { sections: next.sections, items: next.items, tray: next.tray } };
        });
        if (outcome.ok) removed = outcome.value;
        else if (outcome.reason === "conflict") return toolMessage(CANVAS_BUSY);
        else if (outcome.reason === "not_found") return toolMessage(CANVAS_NOT_FOUND);
        await repos.directions.deleteMany(
          input.canvasId,
          drops.map((d) => d.id),
        );
      }

      const rows: NewFeedback[] = rated.map(({ direction, verdict, reasons }) => {
        const ingredient = queryWords(inspirationFromQuery(direction.searchQuery));
        return {
          userId,
          itemKey: keyOf(direction),
          sourceSite: DIRECTION_SOURCE,
          lane: DIRECTION_LANE,
          query: ingredient || null,
          termKey: directionTermKey(ingredient),
          arm: direction.move,
          verdict: directionVerdict(verdict),
          reasons,
          creator: null,
        };
      });
      if (rows.length > 0) await repos.feedback.insertMany(rows);

      const out: RateDirectionsOutput = {
        canvasId: input.canvasId,
        rated: rated.length,
        kept: rated.filter((r) => r.verdict === "keep").map((r) => keyOf(r.direction)),
        dropped: drops.map(keyOf),
        removedSections: removed.sections,
        removedItems: removed.items,
        removedFromTray: removed.tray,
        notFound,
      };
      return toolResult(text(out), out);
    } catch {
      console.error("[rate_directions] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createRateDirectionsTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Rate directions",
      description: TOOL_DESCRIPTION,
      // Validated in the handler so bad input gets a plain message, not the SDK's raw dump.
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
