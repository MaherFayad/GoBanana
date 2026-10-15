/**
 * `export_kit` (spec section 6, wild directions v2): turn a canvas into text files for one wild
 * page (default scope "page") or a whole design system (scope "system"). Each file comes with a
 * suggested repo path; the agent writes them to disk.
 * Free: design_md, brief, direction_md, build_prompt and stitch_md. Pro: all formats.
 *
 * Before building, every direction in the export that changed since its last reconcile (images
 * added, removed or rated) is reconciled first, so DESIGN.md reads the board's own colors. With
 * more than one kept direction and no directionId, each direction gets its own file set in its own
 * folder, never merged. Inline output is capped at about 20k characters: the rest is listed with
 * how to fetch each file (the `file` input returns one file per call).
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { canvasWebUrl, loadCanvas, toSnapshot } from "@/lib/canvas/store";
import {
  EXPORT_FORMATS,
  MAX_PAGES,
  SCOPES,
  appSlug,
  exportKit,
  exportKitByDirection,
  keptDirectionIds,
  type DirectionFileSet,
  type ExportFile,
  type ExportFormat,
} from "@/lib/export";
import { exportLimitMessage, splitExportFormats } from "@/lib/quota";
import { CANVAS_NOT_FOUND, lazyTool, plausibleId, takedownLoader, TRY_AGAIN, upgradeUrl } from "./canvas-shared";
import { directionStates, reconcileDirection, type ReconcileDeps } from "./reconcile_direction";
import { recordFunnel } from "@/lib/funnel";
import { lenient, parseArgs, toolMessage, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "export_kit";

export const TOOL_DESCRIPTION =
  "Export a canvas as files for one wild page (default) or the design system. Formats: design_md, direction_md, build_prompt, review, agents_md, claude_md, cursor_rules, copilot, " +
  "tokens, tailwind, figjam_spec, html_board, brief, stitch_md, wireframe_html, claude_settings. " +
  "Kept directions get a folder each. Big exports list files: fetch each with file. Pro formats come back as a plan message.";

/** Inline output cap in characters (file contents plus headers), so results stay readable. */
export const INLINE_CAP = 20_000;

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100),
  formats: z.array(z.enum(EXPORT_FORMATS)).min(1).max(EXPORT_FORMATS.length),
  directionId: z.string().min(1).max(100).optional(),
  pages: z.array(z.string().trim().min(1).max(80)).min(1).max(MAX_PAGES).optional(),
  scope: z.enum(SCOPES).optional(),
  file: z.string().trim().min(1).max(300).optional().describe("Return only this file, by the path (or name) from an earlier export_kit list."),
});

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas.",
  formats: `formats must list one or more of: ${EXPORT_FORMATS.join(", ")}.`,
  directionId: "Pass a directionId from get_canvas, or leave it out to export the kept directions.",
  pages: `pages takes 1 to ${MAX_PAGES} route names or globs, each up to 80 characters (for example "pricing page", "/launch" or "app/pricing/**").`,
  scope: 'scope must be "page" (one wild page, the default) or "system" (the whole design system).',
  file: "file must be a path from the export_kit file list, up to 300 characters.",
};

export const DIRECTION_NOT_FOUND = "This canvas has no direction with that id. Call get_canvas to see the direction ids.";
export const FILE_NOT_FOUND = "No file with that path in this export. Call export_kit without file to see the list.";

/** A file in the result: full content when inline, else its size and how to fetch it. */
export type ListedFile = ExportFile & { size: number; inline: boolean; directionId?: string };

export type ExportKitOutput = {
  canvasId: string;
  scope: "page" | "system";
  files: ListedFile[];
  /** One entry per direction when several kept directions were exported separately. */
  directions?: { directionId: string; title: string; dir: string; paths: string[] }[];
  /** Directions reconciled with their board before this export. */
  reconciled: string[];
  /** Formats left out because they need Pro. */
  blocked: ExportFormat[];
  note?: string;
};

export type ExportKitDeps = ReconcileDeps;

export function createExportKitTool(deps: ExportKitDeps) {
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
      const webUrl = canvasWebUrl(deps.appUrl(), input.canvasId);
      const palettes = await deps.repos.palettes.listForCanvas(input.canvasId);
      let directions = await deps.repos.directions.listForCanvas(input.canvasId);
      const snap = () => toSnapshot({ canvas: loaded.canvas, state: loaded.state, directions, palettes, webUrl });
      // Accept the stored id or the bend id; the snapshot keys directions by bend id when there is one.
      const row = input.directionId ? directions.find((d) => d.id === input.directionId || d.bendId === input.directionId) : undefined;
      if (input.directionId && !row) return toolMessage(DIRECTION_NOT_FOUND);
      const directionId = row ? (row.bendId ?? row.id) : undefined;

      let snapshot = snap();
      const kept = directionId ? [] : keptDirectionIds(snapshot);
      const exported = directionId ? [directionId] : kept;

      // Reconcile the exported directions that changed since their last run (or never ran).
      const reconciled: string[] = [];
      const states = await directionStates(deps.repos, userId, snapshot, directions.filter((d) => exported.includes(d.bendId ?? d.id)));
      for (const s of states) {
        if (!s.stale || s.images.length === 0) continue;
        try {
          await reconcileDirection(deps, userId, snapshot, s.row);
          reconciled.push(s.row.title);
        } catch {
          // Export still works with the saved spec; the agent can run reconcile_direction itself.
        }
      }
      if (reconciled.length > 0) {
        directions = await deps.repos.directions.listForCanvas(input.canvasId);
        snapshot = snap();
      }

      if (allowed.length > 0) await recordFunnel(userId, "export");
      const opts = { scope, pages: input.pages } as const;
      let sets: DirectionFileSet[] | null = null;
      let files: (ExportFile & { directionId?: string })[];
      if (!directionId && kept.length > 1) {
        sets = exportKitByDirection(snapshot, allowed, kept, opts);
        files = sets.flatMap((s) => s.files.map((f) => ({ ...f, directionId: s.directionId })));
      } else {
        files = exportKit(snapshot, allowed, { ...opts, directionId });
      }

      if (input.file) {
        const wanted = input.file.replace(/^\.?\//, "");
        const hit = files.find((f) => f.path === wanted) ?? files.find((f) => f.name === wanted);
        if (!hit) return toolMessage(FILE_NOT_FOUND);
        const out: ExportKitOutput = { canvasId: input.canvasId, scope, files: [{ ...hit, size: hit.content.length, inline: true }], reconciled, blocked };
        return { content: [{ type: "text", text: fileBlock(hit) }], structuredContent: out as unknown as Record<string, unknown> };
      }

      // Inline files in order while they fit the cap; list the rest with how to fetch them.
      let budget = INLINE_CAP;
      const listed: ListedFile[] = files.map((f) => {
        const block = fileBlock(f).length;
        const inline = block <= budget;
        if (inline) budget -= block;
        return { ...f, size: f.content.length, inline };
      });
      const later = listed.filter((f) => !f.inline);

      const out: ExportKitOutput = {
        canvasId: input.canvasId,
        scope,
        files: listed.map((f) => (f.inline ? f : { ...f, content: "" })),
        ...(sets ? { directions: sets.map((s) => ({ directionId: s.directionId, title: s.title, dir: s.dir, paths: s.files.map((f) => f.path) })) } : {}),
        reconciled,
        blocked,
        ...(upgrade ? { note: upgrade } : {}),
      };

      const summary = [
        `Exported ${files.length} file${files.length === 1 ? "" : "s"} from "${loaded.canvas.title}": ${files.map((f) => f.path).join(", ")}.`,
        ...(reconciled.length > 0 ? [`Reconciled with the board first (the board's colors now lead the spec): ${reconciled.join(", ")}.`] : []),
        ...(sets
          ? [
              `${sets.length} kept directions, one folder each (never merged): ${sets.map((s) => `"${s.title}" in ${s.dir}/`).join("; ")}.`,
              "Build one direction at a time: finish and review one folder before starting the next, and ask the user which to start with.",
            ]
          : []),
        scope === "page"
          ? "Scope: one wild page. These files sit on top of the project's own design system and do not replace it or its DESIGN.md."
          : "Scope: the whole design system.",
        `Write each file below to its path in the user's project. AGENTS.md and CLAUDE.md are sections between ${appSlug()}:<slug> markers: replace the marked block if it exists, else append it. Keep the source links. A .claude/settings.json file is JSON: add its keys to the existing file and keep everything already in it.`,
        ...(later.length > 0
          ? [
              `The export is larger than ${INLINE_CAP.toLocaleString("en")} characters, so ${later.length} file${later.length === 1 ? " is" : "s are"} not inline. Fetch each with export_kit and the same arguments plus file:`,
              ...later.map((f) => `- file: "${f.path}" (${f.size.toLocaleString("en")} characters)`),
            ]
          : []),
        ...(upgrade ? [upgrade] : []),
      ].join("\n");
      return {
        content: [{ type: "text", text: summary }, ...listed.filter((f) => f.inline).map((f) => ({ type: "text" as const, text: fileBlock(f) }))],
        structuredContent: out as unknown as Record<string, unknown>,
      };
    } catch {
      console.error("[export_kit] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

function fileBlock(f: ExportFile): string {
  return `File: ${f.name} (${f.mime})\npath: ${f.path}${f.append ? " (merge into the existing file by its markers)" : f.merge ? " (merge these keys into the existing JSON file, never replace it)" : ""}\n\n${f.content}`;
}

const live = lazyTool(createExportKitTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Export kit",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      // Not read only: it reconciles changed directions (saves their board palette) before building.
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
