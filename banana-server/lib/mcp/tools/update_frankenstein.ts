/**
 * `update_frankenstein` ("Frankenstein it", push slices around): change one Frankenstein page with a
 * list of operations, applied in order and all or nothing (lib/stitch/ops.ts).
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { canvasWebUrl, mutateCanvas, parseState } from "@/lib/canvas/store";
import { applyOps, type StitchOp } from "@/lib/stitch/ops";
import { MAX_PART_NOTE, MAX_STITCH_NOTE, MAX_STITCH_TITLE } from "@/lib/stitch/parse";
import { stitchSize, STITCH_HEADER } from "@/lib/stitch/size";
import { MAX_SLOTS_PER_ROW, type StitchData } from "@/lib/stitch/types";
import {
  CANVAS_NOT_FOUND,
  lazyTool,
  mutateError,
  plausibleId,
  takedownLoader,
  TRY_AGAIN,
  type CanvasToolDeps,
} from "./canvas-shared";
import { STITCH_NOT_FOUND } from "./remix_frankenstein";
import { cropSchema, idSchema, modeSchema, roleSchema, SOURCE_REMINDER, stitchNodes, stitchText, summarize, type StitchSummary } from "./stitch-shared";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "update_frankenstein";
export const MAX_OPS = 30;

export const TOOL_DESCRIPTION =
  "Frankenstein it: change one Frankenstein page with ops, applied in order, all or nothing: swap, move, moveRow, remove, insert, crop, widths, mode, note, title. " +
  "A swap drops the old part's slot note (a note the user wrote stays). Slot and row ids come from frankenstein_page or get_canvas.";

const index = z.number().int().min(0).max(100);
const widths = z.array(z.number().positive().max(12)).min(1).max(MAX_SLOTS_PER_ROW);

const op = z.discriminatedUnion("op", [
  z.object({ op: z.literal("swap"), slotId: idSchema, partId: idSchema }),
  z.object({ op: z.literal("move"), slotId: idSchema, rowId: idSchema.optional().describe("Target row; default the slot's own row."), index }),
  z.object({ op: z.literal("moveRow"), rowId: idSchema, index }),
  z.object({ op: z.literal("remove"), slotId: idSchema.optional(), rowId: idSchema.optional() }),
  z.object({
    op: z.literal("insert"),
    index: index.optional().describe("Row position for the new row, 0 is the top. Default: the end."),
    afterRowId: idSchema.optional(),
    slots: z
      .array(z.object({ partId: idSchema, role: roleSchema.optional(), crop: cropSchema.optional(), note: z.string().trim().max(MAX_PART_NOTE).optional() }))
      .min(1)
      .max(MAX_SLOTS_PER_ROW),
    widths: widths.optional(),
  }),
  z.object({ op: z.literal("crop"), slotId: idSchema, crop: cropSchema }),
  z.object({ op: z.literal("widths"), rowId: idSchema, widths }),
  z.object({ op: z.literal("mode"), mode: modeSchema }),
  z.object({ op: z.literal("note"), slotId: idSchema.optional(), note: z.string().max(MAX_STITCH_NOTE).describe("Empty clears it. Without slotId: the page's idea.") }),
  z.object({ op: z.literal("title"), title: z.string().trim().min(1).max(MAX_STITCH_TITLE) }),
]);

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100),
  stitchId: idSchema,
  ops: z.array(op).min(1).max(MAX_OPS),
});

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas.",
  stitchId: "Pass the id of a Frankenstein page from frankenstein_page or get_canvas.",
  ops:
    `ops is a list of 1 to ${MAX_OPS} ops: { op: "swap", slotId, partId }, { op: "move", slotId, rowId?, index }, { op: "moveRow", rowId, index }, ` +
    '{ op: "remove", slotId or rowId }, { op: "insert", index? or afterRowId?, slots: [{ partId, role?, crop?, note? }], widths? }, { op: "crop", slotId, crop: { x, y, w, h } }, ' +
    '{ op: "widths", rowId, widths }, { op: "mode", mode }, { op: "note", note, slotId? }, { op: "title", title }.',
};

/** Accept the older field names too (toRowId, toIndex, text). */
function normalize(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || !Array.isArray((raw as { ops?: unknown }).ops)) return raw;
  const ops = ((raw as { ops: unknown[] }).ops).map((o) => {
    if (typeof o !== "object" || o === null) return o;
    const x = { ...(o as Record<string, unknown>) };
    if (x.toRowId !== undefined && x.rowId === undefined && x.op === "move") x.rowId = x.toRowId;
    if (x.toIndex !== undefined && x.index === undefined) x.index = x.toIndex;
    if (x.text !== undefined && x.op === "note" && x.note === undefined) x.note = x.text;
    if (x.text !== undefined && x.op === "title" && x.title === undefined) x.title = x.text;
    delete x.toRowId;
    delete x.toIndex;
    delete x.text;
    return x;
  });
  return { ...(raw as object), ops };
}

export type UpdateStitchOutput = { canvasId: string; stitch: StitchSummary; webUrl: string };

export function createUpdateStitchTool(deps: CanvasToolDeps) {
  return async function updateStitch(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, normalize(raw), MESSAGES, MESSAGES.ops!);
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    if (!plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);
    try {
      const outcome = await mutateCanvas<StitchData>(deps.repos, userId, input.canvasId, takedownLoader(deps), (state) => {
        const node = stitchNodes(state).find((n) => n.id === input.stitchId);
        if (!node) return { error: STITCH_NOT_FOUND };
        const parts = state.parts ?? [];
        const result = applyOps(node.data, input.ops as StitchOp[], parts);
        if (!result.ok) return { error: result.error };
        // New height for the new rows, at the frame's current display width.
        const size = stitchSize(result.stitch, parts);
        const h = Math.round(STITCH_HEADER + (size.h - STITCH_HEADER) * (node.w / size.w));
        const nodes = state.nodes.map((n) => (n.id === node.id ? { ...n, h, data: result.stitch } : n));
        return { state: parseState({ ...state, nodes }), value: result.stitch };
      });
      if (!outcome.ok) return mutateError(outcome);
      const parts = outcome.state.parts ?? [];
      const out: UpdateStitchOutput = {
        canvasId: input.canvasId,
        stitch: summarize(input.stitchId, outcome.value, parts),
        webUrl: canvasWebUrl(deps.appUrl(), input.canvasId),
      };
      const lines = [
        `Applied ${input.ops.length} change${input.ops.length === 1 ? "" : "s"} to Frankenstein page ${input.stitchId}:`,
        ...stitchText(input.stitchId, outcome.value, parts),
        SOURCE_REMINDER,
        `Web link: ${out.webUrl}`,
      ];
      return toolResult(lines.join("\n"), out);
    } catch {
      console.error("[update_frankenstein] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createUpdateStitchTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Change Frankenstein page",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
