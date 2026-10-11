/**
 * Canvas persistence over the MCP Apps bridge (inline canvas in chat, spec section 9).
 *
 * - Load: the state comes from the `open_canvas` tool result (`structuredContent.canvas`),
 *   which the host hands to the view as `ui/notifications/tool-result`. No extra call.
 * - Save: `app.callServerTool({ name: "save_canvas_state", ... })`, proxied by the host to
 *   our MCP server with the user's token. The server checks ownership, size, embedded
 *   bytes and `baseUpdatedAt` (lib/mcp/tools/save_canvas_state.ts).
 * - Conflict: when an agent tool (add_to_canvas, arrange_canvas) or the web canvas saved
 *   in between, the save fails with the latest state. Further saves are held (no server
 *   calls) until the user picks "load latest" or "keep mine".
 *
 * Framework free and typed against a minimal caller, so Vitest can drive it with the
 * real tool and in-memory repos.
 */
import type { CanvasPersistence } from "./persistence";
import { PersistenceError } from "./persistence";
import type { CanvasState } from "./types";

export const SAVE_TOOL = "save_canvas_state";
export const OPEN_TOOL = "open_canvas";

/** The part of `CallToolResult` the canvas reads. */
export type ToolCallResult = {
  content?: readonly { type: string; text?: string }[];
  structuredContent?: unknown;
  isError?: boolean;
};

/** The part of the ext-apps `App` the canvas needs (`app.callServerTool`). */
export interface ToolCaller {
  callServerTool(params: { name: string; arguments?: Record<string, unknown> }): Promise<ToolCallResult>;
}

/** What the inline canvas needs from an `open_canvas` result. */
export type OpenedCanvas = {
  id: string;
  title: string;
  webUrl: string;
  updatedAt: string;
  state: unknown;
};

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** First text block of a tool result, for plain error messages. */
export function resultText(result: ToolCallResult): string {
  const block = result.content?.find((c) => c.type === "text" && typeof c.text === "string");
  return block?.text?.trim() ?? "";
}

/**
 * Read an `open_canvas` result. Returns the canvas, or a plain message when the tool
 * answered with an error (for example the free canvas limit) or an unexpected shape.
 */
export function readOpenCanvasResult(result: ToolCallResult): { ok: true; canvas: OpenedCanvas } | { ok: false; message: string } {
  const fallback = "Could not open this canvas.";
  if (result.isError) return { ok: false, message: resultText(result) || fallback };
  const c = isObj(result.structuredContent) ? result.structuredContent.canvas : undefined;
  if (!isObj(c) || typeof c.id !== "string" || !c.id) return { ok: false, message: resultText(result) || fallback };
  return {
    ok: true,
    canvas: {
      id: c.id,
      title: typeof c.title === "string" && c.title ? c.title : "Untitled canvas",
      webUrl: typeof c.webUrl === "string" ? c.webUrl : "",
      updatedAt: typeof c.updatedAt === "string" ? c.updatedAt : "",
      state: c.state ?? null,
    },
  };
}

export type ConflictInfo = {
  /** Latest saved state on the server (takedown filtered). */
  state: unknown;
  updatedAt: string;
  title?: string;
  /** The local state that could not be saved. */
  mine: CanvasState;
};

export class ConflictError extends PersistenceError {
  constructor(message = "This canvas changed somewhere else.") {
    super(message, 409);
    this.name = "ConflictError";
  }
}

export interface BridgePersistence extends CanvasPersistence {
  /** `updatedAt` of the last version this view loaded or saved. */
  readonly baseUpdatedAt: string | undefined;
  /** The unresolved conflict, if any. */
  readonly conflict: ConflictInfo | null;
  /** Drop local changes: the caller reloads the canvas from `conflict.state`. */
  acceptLatest(): void;
  /** Overwrite the newer version with `state` (by default the one that failed). Resolves when saved. */
  keepMine(state?: CanvasState): Promise<void>;
}

export interface BridgePersistenceOptions {
  app: ToolCaller;
  canvasId: string;
  /** State from the open_canvas result. */
  initialState: unknown;
  /** `updatedAt` from the open_canvas result. */
  updatedAt?: string;
  onConflict?: (info: ConflictInfo) => void;
}

export function createBridgePersistence(opts: BridgePersistenceOptions): BridgePersistence {
  let base = opts.updatedAt || undefined;
  let conflict: ConflictInfo | null = null;

  async function send(state: CanvasState, baseUpdatedAt: string | undefined): Promise<void> {
    let result: ToolCallResult;
    try {
      result = await opts.app.callServerTool({
        name: SAVE_TOOL,
        arguments: { canvasId: opts.canvasId, state, ...(baseUpdatedAt ? { baseUpdatedAt } : {}) },
      });
    } catch {
      // Transport failure or the host refused the call. The auto-saver keeps the state and retries.
      throw new PersistenceError("Could not reach the server to save this canvas.");
    }
    const out: Record<string, unknown> = isObj(result.structuredContent) ? result.structuredContent : {};
    if (!result.isError && out.ok === true) {
      if (typeof out.updatedAt === "string") base = out.updatedAt;
      return;
    }
    if (out.reason === "conflict" && typeof out.updatedAt === "string") {
      conflict = {
        state: out.state,
        updatedAt: out.updatedAt,
        ...(typeof out.title === "string" ? { title: out.title } : {}),
        mine: state,
      };
      opts.onConflict?.(conflict);
      throw new ConflictError(resultText(result) || undefined);
    }
    const status = out.reason === "not_found" ? 404 : out.reason === "too_large" ? 413 : out.reason === "invalid" ? 400 : undefined;
    throw new PersistenceError(resultText(result) || "Could not save this canvas.", status);
  }

  return {
    get baseUpdatedAt() {
      return base;
    },
    get conflict() {
      return conflict;
    },
    async load() {
      return opts.initialState ?? null;
    },
    async save(state) {
      if (conflict) {
        // Hold saves until the user decides; keep the newest local state for "keep mine".
        conflict = { ...conflict, mine: state };
        throw new ConflictError();
      }
      await send(state, base);
    },
    acceptLatest() {
      if (!conflict) return;
      base = conflict.updatedAt;
      conflict = null;
    },
    async keepMine(state) {
      if (!conflict) return;
      const pending = conflict;
      await send(state ?? pending.mine, pending.updatedAt);
      conflict = null;
    },
  };
}
