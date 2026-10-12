/**
 * `delete_canvas`: delete one of the user's canvases for good (lib/canvas-delete/delete.ts).
 * `confirm: true` is required, so an agent cannot delete by accident; the description tells it
 * to ask the user first. Frees a canvas slot on the free plan (the limit counts owned canvases).
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { deleteCanvas, type CanvasDeleteDeps } from "@/lib/canvas-delete/delete";
import { liveCanvasDeleteDeps } from "@/lib/canvas-delete/db";
import { NOT_SIGNED_IN, TRY_AGAIN } from "./canvas-shared";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "delete_canvas";

export const TOOL_DESCRIPTION =
  "Delete a canvas for good: its sections, items, tray, directions and view link. This cannot be undone. " +
  "Ask the user first and name the canvas; call only after they say yes, with confirm: true. " +
  "On the free plan this frees a canvas slot.";

export const inputSchema = z.object({
  canvasId: z.string().trim().min(1).max(100).describe("The canvas to delete."),
  confirm: z.literal(true).describe("Must be true. Set it only after the user said yes to deleting this canvas."),
});

const MESSAGES: Record<string, string> = {
  canvasId: "canvasId is required.",
  confirm: "Nothing was deleted. Ask the user to confirm, then call again with confirm: true.",
};

export const CANVAS_GONE = "That canvas was not found. It may already be deleted; get_canvas lists your canvases.";
export const STORAGE_DOWN = "Nothing was deleted: image storage is not available right now. Try again in a minute.";

export function createDeleteCanvasTool(deps: () => CanvasDeleteDeps) {
  return async function deleteCanvasTool(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage(NOT_SIGNED_IN);
    const parsed = parseArgs(inputSchema, raw, MESSAGES, "Pass canvasId and confirm: true.");
    if (!parsed.ok) return toolMessage(parsed.message);
    try {
      const out = await deleteCanvas(deps(), userId, parsed.data.canvasId);
      if (!out.ok) return toolMessage(out.reason === "storage_unavailable" ? STORAGE_DOWN : CANVAS_GONE);
      return toolResult(`Deleted canvas "${out.title}" for good.`, {
        deleted: true,
        canvasId: parsed.data.canvasId,
        title: out.title,
        uploadsDeleted: out.uploadsDeleted,
      });
    } catch {
      console.error("[delete_canvas] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

let live: ReturnType<typeof createDeleteCanvasTool> | undefined;

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Delete canvas",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args, ctx) => {
      live ??= createDeleteCanvasTool(liveCanvasDeleteDeps);
      return live(args, authExtra(ctx)?.userId);
    },
  );
};
