/**
 * `load_canvas_state`: app-only tool (MCP Apps `visibility: ["app"]`, hidden from the model).
 * The inline canvas calls it when the `open_canvas` result reached the view without its
 * `_meta["banana/canvas"]` board (a host that drops result `_meta`).
 *
 * Same load as everywhere else: lib/canvas/store.ts `loadCanvas`, so ownership (missing and
 * not yours look the same) and the takedown filter (fail closed) apply.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { loadCanvas, type CanvasState } from "@/lib/canvas/store";
import {
  CANVAS_NOT_FOUND,
  lazyTool,
  NOT_SIGNED_IN,
  plausibleId,
  takedownLoader,
  TRY_AGAIN,
  type CanvasToolDeps,
} from "./canvas-shared";
import { lenient, parseArgs, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "load_canvas_state";

export const TOOL_DESCRIPTION =
  "Loads the board for the inline canvas. Only the canvas view calls this tool. " +
  "Agents: do not call it; use get_canvas instead.";

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100).describe("Canvas id from open_canvas."),
});

export type LoadCanvasOutput =
  | { ok: true; state: CanvasState; updatedAt: string; title: string; removed: number }
  | { ok: false; reason: "not_found" | "invalid" | "signed_out" | "error"; message: string };

function result(out: LoadCanvasOutput): ToolResult {
  return {
    content: [{ type: "text", text: out.ok ? `Loaded canvas "${out.title}".` : out.message }],
    structuredContent: out as unknown as Record<string, unknown>,
    ...(out.ok ? {} : { isError: true }),
  };
}

export function createLoadCanvasStateTool(deps: CanvasToolDeps) {
  return async function loadCanvasState(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return result({ ok: false, reason: "signed_out", message: NOT_SIGNED_IN });
    const parsed = parseArgs(inputSchema, raw, {}, "Pass the canvasId from open_canvas.");
    if (!parsed.ok) return result({ ok: false, reason: "invalid", message: parsed.message });
    const { canvasId } = parsed.data;
    if (!plausibleId(canvasId)) return result({ ok: false, reason: "not_found", message: CANVAS_NOT_FOUND });
    try {
      const loaded = await loadCanvas(deps.repos, userId, canvasId, takedownLoader(deps));
      if (!loaded) return result({ ok: false, reason: "not_found", message: CANVAS_NOT_FOUND });
      return result({
        ok: true,
        state: loaded.state,
        updatedAt: loaded.canvas.updatedAt.toISOString(),
        title: loaded.canvas.title,
        removed: loaded.removed,
      });
    } catch {
      console.error("[load_canvas_state] failed");
      return result({ ok: false, reason: "error", message: TRY_AGAIN });
    }
  };
}

const live = lazyTool(createLoadCanvasStateTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Load canvas (canvas view only)",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      // MCP Apps: callable by the canvas view, hidden from the model.
      _meta: { ui: { visibility: ["app"] } },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
