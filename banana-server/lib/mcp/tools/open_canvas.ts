/**
 * `open_canvas` (spec section 6): open one of the user's canvases, or create one.
 * Free plan: 3 canvases. The inline UI (`ui://banana/canvas`) is registered in
 * lib/mcp/resources/canvas.ts. It reads the board from the result `_meta["banana/canvas"]`
 * (`state`, `updatedAt`), which MCP Apps hosts hand to the view but not to the model, so the
 * model only pays for the small `structuredContent`.
 */
import { z } from "zod";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { authExtra } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { canvasWebUrl, emptyState, itemCount, loadCanvas, mutateCanvas, type CanvasState } from "@/lib/canvas/store";
import { cleanTaste } from "@/lib/taste";
import { canCreateCanvas, currentPeriod } from "@/lib/quota";
import {
  CANVAS_NOT_FOUND,
  lazyTool,
  plausibleId,
  takedownLoader,
  TRY_AGAIN,
  tasteInputSchema,
  upgradeUrl,
  type CanvasToolDeps,
} from "./canvas-shared";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "open_canvas";
export const CANVAS_UI_URI = "ui://banana/canvas";

export const TOOL_DESCRIPTION =
  "Show a canvas inline (or create and show one without canvasId) and get its web link. " +
  "To show a finished board, create it with new_canvas, fill it, then call this with its canvasId. " +
  "Pass taste with a few style words that describe the user's references (for example from their mood boards); searches on this canvas use them.";

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100).optional().describe("Canvas to open. Leave out to create a new canvas."),
  title: z.string().trim().min(1).max(80).optional().describe("Canvas title, up to 80 characters."),
  brief: z.string().trim().min(1).max(500).optional().describe("The design brief, up to 500 characters."),
  taste: tasteInputSchema.optional(),
});

const MESSAGES: Record<string, string> = {
  canvasId: "canvasId must be an id from open_canvas.",
  title: "title must be 1 to 80 characters.",
  brief: "brief must be 1 to 500 characters.",
  taste: "taste must be 1 to 5 short style words, for example minimal or dark mode.",
};

export type OpenCanvasOutput = {
  canvas: {
    id: string;
    title: string;
    webUrl: string;
    brief: string | null;
    /** Style words saved on the canvas for searches, if any. */
    taste?: string[];
    items: number;
    sections: number;
    tray: number;
  };
  created: boolean;
};

/** Key of the view-only payload in the result `_meta`. */
export const VIEW_META_KEY = "banana/canvas";

/** View-only payload: the board for the inline canvas (MCP Apps). Never shown to the model. */
export type OpenCanvasViewMeta = {
  /** Saved state (takedown filtered). */
  state: CanvasState;
  /** Version of that state; the inline canvas sends it back as `baseUpdatedAt` when it saves. */
  updatedAt: string;
};

function withViewMeta(result: ToolResult, meta: OpenCanvasViewMeta): ToolResult {
  return { ...result, _meta: { [VIEW_META_KEY]: meta } };
}

const sectionCount = (state: CanvasState) => state.nodes.filter((n) => n.type === "section").length;

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
  if (c.taste) lines.splice(2, 0, `Taste for searches: ${c.taste.join(", ")}.`);
  return lines.join("\n");
}

/**
 * Creates a canvas within the plan's canvas limit. Shared with new_canvas, which creates one
 * without showing it, so the inline view can open once the board is built.
 */
export async function createCanvas(
  deps: CanvasToolDeps,
  userId: string,
  input: { title?: string; brief?: string },
  taste: string[],
): Promise<{ ok: false; message: string } | { ok: true; out: OpenCanvasOutput; view: OpenCanvasViewMeta }> {
  const { repos } = deps;
  const plan = await repos.users.getPlan(userId);
  const owned = await repos.canvases.countOwned(userId);
  const quota = canCreateCanvas(plan, owned, { upgradeUrl: upgradeUrl(deps), now: deps.now?.() });
  if (!quota.ok) return { ok: false, message: quota.message };

  const title = input.title ?? (input.brief ? titleFromBrief(input.brief) : "Untitled moodboard");
  const state: CanvasState = taste.length > 0 ? { ...emptyState(), taste } : emptyState();
  const canvas = await repos.canvases.create({ userId, title, brief: input.brief ?? null, state });
  await repos.usage.addCanvases(userId, currentPeriod(deps.now?.()), 1);
  const out: OpenCanvasOutput = {
    canvas: {
      id: canvas.id,
      title: canvas.title,
      webUrl: canvasWebUrl(deps.appUrl(), canvas.id),
      brief: canvas.brief,
      ...(taste.length > 0 ? { taste } : {}),
      items: 0,
      sections: 0,
      tray: 0,
    },
    created: true,
  };
  return { ok: true, out, view: { state, updatedAt: canvas.updatedAt.toISOString() } };
}

export function createOpenCanvasTool(deps: CanvasToolDeps) {
  return async function openCanvas(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, MESSAGES, "Check the input: canvasId, title and brief are all optional.");
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    const taste = cleanTaste(input.taste);
    try {
      const { repos } = deps;
      if (input.canvasId) {
        if (!plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);
        let loaded = await loadCanvas(repos, userId, input.canvasId, takedownLoader(deps));
        if (!loaded) return toolMessage(CANVAS_NOT_FOUND);
        if (taste.length > 0) {
          const saved = await mutateCanvas(repos, userId, input.canvasId, takedownLoader(deps), (state) => ({
            state: { ...state, taste },
            value: true,
          }));
          if (saved.ok) loaded = { ...loaded, state: saved.state, canvas: saved.canvas };
        }
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
            ...(loaded.state.taste ? { taste: loaded.state.taste } : {}),
            items: itemCount(loaded.state),
            sections: sectionCount(loaded.state),
            tray: loaded.state.tray.length,
          },
          created: false,
        };
        return withViewMeta(toolResult(text(out), out), {
          state: loaded.state,
          updatedAt: loaded.canvas.updatedAt.toISOString(),
        });
      }

      const made = await createCanvas(deps, userId, input, taste);
      if (!made.ok) return toolMessage(made.message);
      return withViewMeta(toolResult(text(made.out), made.out), made.view);
    } catch {
      console.error("[open_canvas] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createOpenCanvasTool);

export const register: RegisterTool = (server) => {
  // registerAppTool also writes the legacy `_meta["ui/resourceUri"]` key for older hosts.
  registerAppTool(
    server,
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
