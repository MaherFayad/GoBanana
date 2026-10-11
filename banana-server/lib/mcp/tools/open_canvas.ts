/**
 * `open_canvas` (spec section 6): open one of the user's canvases, or create one.
 * Free plan: 3 canvases. The inline UI (`ui://banana/canvas`) is registered elsewhere.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { canvasWebUrl, emptyState, itemCount, loadCanvas } from "@/lib/canvas/store";
import { canCreateCanvas, currentPeriod } from "@/lib/quota";
import {
  CANVAS_NOT_FOUND,
  lazyTool,
  plausibleId,
  takedownLoader,
  TRY_AGAIN,
  upgradeUrl,
  type CanvasToolDeps,
} from "./canvas-shared";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "open_canvas";
export const CANVAS_UI_URI = "ui://banana/canvas";

export const TOOL_DESCRIPTION =
  "Open a moodboard canvas, or create a new one when you leave out canvasId. " +
  "Use it before collecting references so results have a place to land. " +
  "Shows the canvas inline when the client supports it and always returns a web link to share with the user.";

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100).optional().describe("Canvas to open. Leave out to create a new canvas."),
  title: z.string().trim().min(1).max(80).optional().describe("Canvas title, up to 80 characters."),
  brief: z.string().trim().min(1).max(500).optional().describe("The design brief, up to 500 characters."),
});

const MESSAGES: Record<string, string> = {
  canvasId: "canvasId must be an id from open_canvas.",
  title: "title must be 1 to 80 characters.",
  brief: "brief must be 1 to 500 characters.",
};

export type OpenCanvasOutput = {
  canvas: { id: string; title: string; webUrl: string; brief: string | null; items: number; tray: number };
  created: boolean;
};

/** "Flight checkout for a budget airline ..." -> a title of at most 60 characters on a word boundary. */
export function titleFromBrief(brief: string): string {
  const flat = brief.replace(/\s+/g, " ").trim();
  if (flat.length <= 60) return flat;
  const cut = flat.slice(0, 60);
  const space = cut.lastIndexOf(" ");
  return (space > 20 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, "");
}

function text(out: OpenCanvasOutput): string {
  const c = out.canvas;
  const lines = [
    `${out.created ? "Created" : "Opened"} canvas "${c.title}" (id ${c.id}).`,
    `Web link: ${c.webUrl}`,
    `It has ${c.items} items and ${c.tray} results in its tray.`,
    "Next: pass this canvasId to bend_brief and search_references so directions and results land here, then add_to_canvas to place them.",
  ];
  return lines.join("\n");
}

export function createOpenCanvasTool(deps: CanvasToolDeps) {
  return async function openCanvas(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, MESSAGES, "Check the input: canvasId, title and brief are all optional.");
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    const { repos } = deps;

    try {
      if (input.canvasId) {
        if (!plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);
        const loaded = await loadCanvas(repos, userId, input.canvasId, takedownLoader(deps));
        if (!loaded) return toolMessage(CANVAS_NOT_FOUND);
        const patch: { title?: string; brief?: string } = {};
        if (input.title && input.title !== loaded.canvas.title) patch.title = input.title;
        if (input.brief && input.brief !== loaded.canvas.brief) patch.brief = input.brief;
        if (Object.keys(patch).length > 0) await repos.canvases.update(userId, input.canvasId, patch);
        const out: OpenCanvasOutput = {
          canvas: {
            id: loaded.canvas.id,
            title: patch.title ?? loaded.canvas.title,
            webUrl: canvasWebUrl(deps.appUrl(), loaded.canvas.id),
            brief: patch.brief ?? loaded.canvas.brief,
            items: itemCount(loaded.state),
            tray: loaded.state.tray.length,
          },
          created: false,
        };
        return toolResult(text(out), out);
      }

      const plan = await repos.users.getPlan(userId);
      const owned = await repos.canvases.countOwned(userId);
      const quota = canCreateCanvas(plan, owned, { upgradeUrl: upgradeUrl(deps), now: deps.now?.() });
      if (!quota.ok) return toolMessage(quota.message);

      const title = input.title ?? (input.brief ? titleFromBrief(input.brief) : "Untitled moodboard");
      const canvas = await repos.canvases.create({ userId, title, brief: input.brief ?? null, state: emptyState() });
      await repos.usage.addCanvases(userId, currentPeriod(deps.now?.()), 1);
      const out: OpenCanvasOutput = {
        canvas: {
          id: canvas.id,
          title: canvas.title,
          webUrl: canvasWebUrl(deps.appUrl(), canvas.id),
          brief: canvas.brief,
          items: 0,
          tray: 0,
        },
        created: true,
      };
      return toolResult(text(out), out);
    } catch {
      console.error("[open_canvas] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createOpenCanvasTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: `Open ${APP_NAME} canvas`,
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
      _meta: { ui: { resourceUri: CANVAS_UI_URI } },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
