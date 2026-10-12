/**
 * `export_kit` (spec section 6, wild directions v2): turn a canvas into text files for one wild
 * page (default scope "page") or a whole design system (scope "system"). Each file comes with a
 * suggested repo path; the agent writes them to disk.
 * Free: design_md, brief, direction_md, build_prompt and stitch_md. Pro: all formats.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { canvasWebUrl, loadCanvas, toSnapshot } from "@/lib/canvas/store";
import { EXPORT_FORMATS, MAX_PAGES, SCOPES, appSlug, exportKit, type ExportFile, type ExportFormat } from "@/lib/export";
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
  "Export a canvas as files. Default scope page: one wild page on top of the project's design system. Formats: design_md, direction_md, build_prompt, review, agents_md, claude_md, cursor_rules, copilot, " +
  "tokens, tailwind, figjam_spec, html_board, brief, stitch_md, wireframe_html (Frankenstein pages). " +
  "Write each file to its path. Free: design_md, brief, direction_md, build_prompt, stitch_md.";

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100),
  formats: z.array(z.enum(EXPORT_FORMATS)).min(1).max(EXPORT_FORMATS.length),
  directionId: z.string().min(1).max(100).optional(),
  pages: z.array(z.string().trim().min(1).max(80)).min(1).max(MAX_PAGES).optional(),
  scope: z.enum(SCOPES).optional(),
});

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas.",
  formats: `formats must list one or more of: ${EXPORT_FORMATS.join(", ")}.`,
  directionId: "Pass a directionId from get_canvas, or leave it out to export the kept directions.",
  pages: `pages takes 1 to ${MAX_PAGES} route names or globs, each up to 80 characters (for example "pricing page", "/launch" or "app/pricing/**").`,
  scope: 'scope must be "page" (one wild page, the default) or "system" (the whole design system).',
};

export const DIRECTION_NOT_FOUND = "This canvas has no direction with that id. Call get_canvas to see the direction ids.";

export type ExportKitOutput = {
  canvasId: string;
  scope: "page" | "system";
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
    const scope = input.scope ?? "page";

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
      // Accept the stored id or the bend id; the snapshot keys directions by bend id when there is one.
      const row = input.directionId ? directions.find((d) => d.id === input.directionId || d.bendId === input.directionId) : undefined;
      if (input.directionId && !row) return toolMessage(DIRECTION_NOT_FOUND);
      const directionId = row ? (row.bendId ?? row.id) : undefined;

      const files = exportKit(snapshot, allowed, { scope, directionId, pages: input.pages });
      const out: ExportKitOutput = { canvasId: input.canvasId, scope, files, blocked, ...(upgrade ? { note: upgrade } : {}) };

      const summary = [
        `Exported ${files.length} file${files.length === 1 ? "" : "s"} from "${loaded.canvas.title}": ${files.map((f) => f.name).join(", ")}.`,
        scope === "page"
          ? "Scope: one wild page. These files sit on top of the project's own design system and do not replace it or its DESIGN.md."
          : "Scope: the whole design system.",
        `Write each file below to its path in the user's project. AGENTS.md and CLAUDE.md are sections between ${appSlug()}:<slug> markers: replace the marked block if it exists, else append it. Keep the source links.`,
        ...(upgrade ? [upgrade] : []),
      ].join("\n");
      return {
        content: [
          { type: "text", text: summary },
          ...files.map((f) => ({
            type: "text" as const,
            text: `File: ${f.name} (${f.mime})\npath: ${f.path}${f.append ? " (merge into the existing file by its markers)" : ""}\n\n${f.content}`,
          })),
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
