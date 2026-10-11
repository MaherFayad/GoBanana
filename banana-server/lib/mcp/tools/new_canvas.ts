/**
 * `new_canvas`: create a canvas without showing it. The agent fills it (bend_brief,
 * search_references, add_to_canvas, arrange_canvas) and then calls open_canvas with its id, so
 * the inline view appears once, with the finished board. Same plan limit as open_canvas.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { cleanTaste } from "@/lib/taste";
import { lazyTool, TRY_AGAIN, tasteInputSchema, type CanvasToolDeps } from "./canvas-shared";
import { createCanvas } from "./open_canvas";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "new_canvas";

export const TOOL_DESCRIPTION =
  "Create a moodboard canvas without showing it, and get its canvasId. " +
  "Pass the canvasId to bend_brief, search_references and add_to_canvas, then call open_canvas with it to show the finished board. " +
  "Pass taste with a few style words; searches on this canvas use them.";

export const inputSchema = z.object({
  title: z.string().trim().min(1).max(80).optional().describe("Canvas title, up to 80 characters."),
  brief: z.string().trim().min(1).max(500).optional().describe("The design brief, up to 500 characters."),
  taste: tasteInputSchema.optional(),
});

const MESSAGES: Record<string, string> = {
  title: "title must be 1 to 80 characters.",
  brief: "brief must be 1 to 500 characters.",
  taste: "taste must be 1 to 5 short style words, for example minimal or dark mode.",
};

export function createNewCanvasTool(deps: CanvasToolDeps) {
  return async function newCanvas(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, MESSAGES, "Check the input: title, brief and taste are all optional.");
    if (!parsed.ok) return toolMessage(parsed.message);
    try {
      const made = await createCanvas(deps, userId, parsed.data, cleanTaste(parsed.data.taste));
      if (!made.ok) return toolMessage(made.message);
      const c = made.out.canvas;
      const lines = [
        `Created canvas "${c.title}" (id ${c.id}). It is not shown yet.`,
        `Web link: ${c.webUrl}`,
        "Next: pass this canvasId to bend_brief and search_references, place results with add_to_canvas, then call open_canvas with this canvasId to show the finished board.",
      ];
      if (c.taste) lines.splice(2, 0, `Taste for searches: ${c.taste.join(", ")}.`);
      return toolResult(lines.join("\n"), made.out);
    } catch {
      console.error("[new_canvas] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createNewCanvasTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "New canvas",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
