/**
 * `export_kit` (spec section 6): turn a canvas into text files (DESIGN.md, AGENTS.md,
 * tokens, Tailwind theme, FigJam spec, HTML board, brief). The agent writes them to disk.
 * Free: design_md and brief. Pro: all formats.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { canvasWebUrl, loadCanvas, toSnapshot } from "@/lib/canvas/store";
import { EXPORT_FORMATS, exportKit, type ExportFile, type ExportFormat } from "@/lib/export";
import { exportLimitMessage, splitExportFormats } from "@/lib/quota";
import {
  CANVAS_NOT_FOUND,
  lazyTool,
  plausibleId,
  takedownLoader,
  TRY_AGAIN,
  upgradeUrl,
  type CanvasToolDeps,
} from "./canvas-shared";
import { lenient, parseArgs, toolMessage, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "export_kit";

export const TOOL_DESCRIPTION =
  "Export a canvas as files for the user's project: design_md (DESIGN.md), agents_md (AGENTS.md), tokens (tokens.json), " +
  "tailwind (theme.css), figjam_spec, html_board and brief. Returns each file as text; write them where the user wants. " +
  "Free plan: design_md and brief.";

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100),
  formats: z.array(z.enum(EXPORT_FORMATS)).min(1).max(EXPORT_FORMATS.length),
});

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas.",
  formats: `formats must list one or more of: ${EXPORT_FORMATS.join(", ")}.`,
};

export type ExportKitOutput = {
  canvasId: string;
  files: ExportFile[];
  /** Formats left out because they need Pro. */
  blocked: ExportFormat[];
  note?: string;
};

export function createExportKitTool(deps: CanvasToolDeps) {
  return async function exportKitTool(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, MESSAGES, MESSAGES.formats!);
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    if (!plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);

    try {
      const plan = await deps.repos.users.getPlan(userId);
      const { allowed, blocked } = splitExportFormats(plan, [...new Set(input.formats)]);
      const upgrade = blocked.length > 0 ? exportLimitMessage(blocked, { upgradeUrl: upgradeUrl(deps) }) : undefined;
      if (allowed.length === 0) return toolMessage(upgrade!);

      const loaded = await loadCanvas(deps.repos, userId, input.canvasId, takedownLoader(deps));
      if (!loaded) return toolMessage(CANVAS_NOT_FOUND);
      const [directions, palettes] = await Promise.all([
        deps.repos.directions.listForCanvas(input.canvasId),
        deps.repos.palettes.listForCanvas(input.canvasId),
      ]);
      const snapshot = toSnapshot({
        canvas: loaded.canvas,
        state: loaded.state,
        directions,
        palettes,
        webUrl: canvasWebUrl(deps.appUrl(), input.canvasId),
      });
      const files = exportKit(snapshot, allowed);
      const out: ExportKitOutput = { canvasId: input.canvasId, files, blocked, ...(upgrade ? { note: upgrade } : {}) };

      const summary = [
        `Exported ${files.length} file${files.length === 1 ? "" : "s"} from "${loaded.canvas.title}": ${files.map((f) => f.name).join(", ")}.`,
        "Write each file below to the user's project. Keep the source links in them.",
        ...(upgrade ? [upgrade] : []),
      ].join("\n");
      return {
        content: [
          { type: "text", text: summary },
          ...files.map((f) => ({ type: "text" as const, text: `File: ${f.name} (${f.mime})\n\n${f.content}` })),
        ],
        structuredContent: out as unknown as Record<string, unknown>,
      };
    } catch {
      console.error("[export_kit] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createExportKitTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Export kit",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
