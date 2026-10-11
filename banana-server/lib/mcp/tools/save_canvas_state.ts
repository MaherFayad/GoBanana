/**
 * `save_canvas_state`: app-only tool the inline canvas (MCP Apps) calls through the host
 * bridge to auto-save. Hidden from the model with `_meta.ui.visibility: ["app"]`.
 *
 * Same rules as `PUT /api/canvas/:id`, through the same code in lib/canvas/store.ts:
 * ownership (missing and not yours look the same), 1 MB cap, node cap, no `data:`,
 * `blob:` or `filesystem:` strings anywhere (hard rule 2), and an optimistic check on
 * `baseUpdatedAt`. On a conflict the result carries the latest saved state (takedown
 * filtered) so the canvas can offer "load latest" or "keep mine" without another call.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { loadCanvas, validateSaveBody, type CanvasState } from "@/lib/canvas/store";
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

export const TOOL_NAME = "save_canvas_state";

export const TOOL_DESCRIPTION =
  "Saves the inline canvas after the user changes it. Only the canvas view calls this tool. " +
  "Agents: do not call it; use add_to_canvas and arrange_canvas instead.";

export const CONFLICT_MESSAGE = "This canvas changed somewhere else since it was opened here.";

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100).describe("Canvas id from open_canvas."),
  state: z.object({}).loose().describe("Canvas state: version, viewport, nodes and tray."),
  baseUpdatedAt: z.string().optional().describe("updatedAt of the version this state was based on."),
});

const ID_ONLY = z.object({ canvasId: z.string().min(1).max(100) }).loose();

export type SaveCanvasOutput =
  | { ok: true; updatedAt: string }
  | { ok: false; reason: "conflict"; message: string; state: CanvasState; updatedAt: string; title: string }
  | { ok: false; reason: "not_found" | "invalid" | "too_large" | "signed_out" | "error"; message: string };

function result(out: SaveCanvasOutput): ToolResult {
  return {
    content: [{ type: "text", text: out.ok ? `Saved at ${out.updatedAt}.` : out.message }],
    structuredContent: out as unknown as Record<string, unknown>,
    ...(out.ok ? {} : { isError: true }),
  };
}

function jsonBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value) ?? "").byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function createSaveCanvasStateTool(deps: CanvasToolDeps) {
  return async function saveCanvasState(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return result({ ok: false, reason: "signed_out", message: NOT_SIGNED_IN });
    const parsed = parseArgs(ID_ONLY, raw, {}, "Pass the canvasId from open_canvas.");
    if (!parsed.ok) return result({ ok: false, reason: "invalid", message: parsed.message });
    const { canvasId } = parsed.data;
    if (!plausibleId(canvasId)) return result({ ok: false, reason: "not_found", message: CANVAS_NOT_FOUND });

    // One validator for web and inline saves: size cap, schema, no embedded bytes.
    const body = { state: parsed.data.state, baseUpdatedAt: parsed.data.baseUpdatedAt };
    const valid = validateSaveBody(body, jsonBytes(body));
    if (!valid.ok) {
      return result({ ok: false, reason: valid.status === 413 ? "too_large" : "invalid", message: valid.message });
    }

    try {
      const { repos } = deps;
      const saved = await repos.canvases.saveState(userId, canvasId, valid.state, {
        ...(valid.baseUpdatedAt ? { ifUpdatedAt: valid.baseUpdatedAt } : {}),
      });
      if (saved.ok) return result({ ok: true, updatedAt: saved.updatedAt.toISOString() });
      if (saved.reason === "not_found") return result({ ok: false, reason: "not_found", message: CANVAS_NOT_FOUND });
      const latest = await loadCanvas(repos, userId, canvasId, takedownLoader(deps));
      if (!latest) return result({ ok: false, reason: "not_found", message: CANVAS_NOT_FOUND });
      return result({
        ok: false,
        reason: "conflict",
        message: CONFLICT_MESSAGE,
        state: latest.state,
        updatedAt: latest.canvas.updatedAt.toISOString(),
        title: latest.canvas.title,
      });
    } catch {
      console.error("[save_canvas_state] failed");
      return result({ ok: false, reason: "error", message: TRY_AGAIN });
    }
  };
}

const live = lazyTool(createSaveCanvasStateTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Save canvas (canvas view only)",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      // MCP Apps: callable by the canvas view, hidden from the model.
      _meta: { ui: { visibility: ["app"] } },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
