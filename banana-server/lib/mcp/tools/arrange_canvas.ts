/**
 * `arrange_canvas` (spec section 6): lay out a canvas or one section with lib/layout,
 * through the same adapter the canvas toolbar uses, and save the new positions.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { arrangeState, canvasWebUrl, mutateCanvas, type ArrangedRect } from "@/lib/canvas/store";
import { LAYOUTS, type LayoutKind } from "@/lib/layout";
import {
  CANVAS_NOT_FOUND,
  lazyTool,
  mutateError,
  plausibleId,
  takedownLoader,
  TRY_AGAIN,
  type CanvasToolDeps,
} from "./canvas-shared";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "arrange_canvas";

export const TOOL_DESCRIPTION =
  "Tidy a canvas or one section. Layouts: spread (best for moodboards: each direction one row, lead art large, notes, a 3 column UI grid, swatches below; Frankenstein pages last), " +
  "by_direction (one column per section), masonry (4 columns, keeps image shapes), " +
  "grid (equal cells) and hero (first item large, the rest below). Use it after adding items, or when the user asks for a cleaner board.";

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100),
  layout: z.enum(LAYOUTS as [LayoutKind, ...LayoutKind[]]),
  sectionId: z.string().min(1).max(120).optional().describe("Arrange only this section."),
});

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas.",
  layout: `layout must be one of: ${LAYOUTS.join(", ")}.`,
  sectionId: "sectionId must be the id of a section on this canvas.",
};

export type ArrangeCanvasOutput = { canvasId: string; layout: LayoutKind; items: ArrangedRect[]; webUrl: string };

export function createArrangeCanvasTool(deps: CanvasToolDeps) {
  return async function arrangeCanvas(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, MESSAGES, "Pass a canvasId and a layout.");
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    if (!plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);

    try {
      const outcome = await mutateCanvas<ArrangedRect[]>(deps.repos, userId, input.canvasId, takedownLoader(deps), (state) => {
        const result = arrangeState(state, input.layout, input.sectionId);
        if ("error" in result) return { error: "That section was not found on this canvas. Call get_canvas to see section ids." };
        return { state: result.state, value: result.items };
      });
      if (!outcome.ok) return mutateError(outcome);
      const out: ArrangeCanvasOutput = {
        canvasId: input.canvasId,
        layout: input.layout,
        items: outcome.value,
        webUrl: canvasWebUrl(deps.appUrl(), input.canvasId),
      };
      const scope = input.sectionId ? `section ${input.sectionId}` : `"${outcome.canvas.title}"`;
      return toolResult(`Arranged ${out.items.length} items in ${scope} with the ${input.layout} layout.\nWeb link: ${out.webUrl}`, out);
    } catch {
      console.error("[arrange_canvas] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createArrangeCanvasTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Arrange canvas",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
