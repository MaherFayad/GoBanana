import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { bendBrief, bendInputSchema, formatDirections, parseBendInput, type BendResult } from "@/lib/bend";
import { mutateCanvas, parseState } from "@/lib/canvas/store";
import type { CanvasRecord } from "@/lib/db/types";
import { globalLearningOn, K_ANON } from "@/lib/learning/arms";
import { ingredientWeights } from "@/lib/learning/directions";
import { directionTermKey } from "@/lib/learning/terms";
import { inspirationFromQuery } from "@/lib/bend/queries";
import { cleanTaste } from "@/lib/taste";
import { liveCanvasDeps, plausibleId, takedownLoader, tasteInputSchema, type CanvasToolDeps } from "./canvas-shared";
import { lenient, toolMessage, type RegisterTool, type ToolResult } from "./types";

export const BEND_BRIEF_DESCRIPTION =
  "Turn a plain design brief into wild, unexpected design directions. " +
  "Use it when the user wants fresh, bold or surprising ideas instead of the usual layout. " +
  "Each direction has a short title, a twist, a search query and a prompt to riff on. " +
  "Wildness runs from 1 (Fresh) to 5 (Bananas). " +
  "Pass canvasId to save the directions there, then call search_references with a direction id. " +
  "Optional taste: style words that describe the user's mood boards.";

/** Advertised input: the bend schema plus an optional canvas to save the directions to. */
export const inputSchema = bendInputSchema.extend({
  canvasId: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe("Canvas from open_canvas. Saves the directions there so search_references can take a directionId."),
  taste: tasteInputSchema.optional(),
});

/**
 * Advertise the strict JSON schema to clients, but let every call through to the
 * handler so invalid input gets a plain message instead of the SDK's raw validation dump.
 */
const advertisedInput: StandardSchemaWithJSON<unknown, unknown> = lenient(inputSchema);

export type BendBriefDeps = Pick<CanvasToolDeps, "repos"> & {
  /** GLOBAL_LEARNING: false means only the user's own direction ratings steer their bends. Default true. */
  globalLearning?(): boolean;
};

/**
 * Ingredient weights from rate_directions feedback: one grouped read per call. Fails open: any
 * error, or no user, gives no weights, so the bend is exactly what it was without feedback.
 */
/** How many of the user's latest canvases count as "recent" for idea variety. */
export const RECENT_CANVASES = 3;
/** Weight of an ingredient the user already saw on a recent canvas: rare, not impossible. */
export const RECENT_WEIGHT = 0.05;

/**
 * Ingredient weights: rate_directions feedback (one grouped read) plus variety across the user's
 * own boards, so the ideas of their last few canvases (say "Uzbek suzani") do not come back on
 * every new brief. Fails open: any error, or no user, gives no weights, so the bend is exactly
 * what it was without them.
 */
async function readWeights(
  getDeps: () => BendBriefDeps,
  userId: string | undefined,
  canvasId?: string,
): Promise<Map<string, number>> {
  if (!userId) return new Map();
  let weights = new Map<string, number>();
  try {
    const deps = getDeps();
    const stats = await deps.repos.feedback.directionStats(userId, K_ANON);
    weights = ingredientWeights(stats, { global: deps.globalLearning?.() ?? true });
  } catch {
    console.error("[bend_brief] could not read direction stats");
  }
  try {
    const recent = await getDeps().repos.directions.recentQueriesForUser(userId, {
      canvasLimit: RECENT_CANVASES,
      ...(canvasId ? { excludeCanvasId: canvasId } : {}),
    });
    for (const q of recent) {
      const key = directionTermKey(inspirationFromQuery(q));
      weights.set(key, Math.min(weights.get(key) ?? 1, RECENT_WEIGHT));
    }
  } catch {
    console.error("[bend_brief] could not read recent directions");
  }
  return weights;
}

/** Save directions (and new taste words) on the user's canvas. */
async function saveDirections(
  deps: BendBriefDeps,
  userId: string,
  canvas: CanvasRecord,
  result: BendResult,
  newTaste: string[],
): Promise<boolean> {
  const canvasId = canvas.id;
  await deps.repos.directions.upsertMany(
    canvasId,
    result.directions.map((d) => ({ bendId: d.id, move: d.move, title: d.title, searchQuery: d.searchQuery })),
  );
  await deps.repos.canvases.update(userId, canvasId, {
    wildness: result.wildness,
    lens: result.lens?.id ?? null,
    ...(canvas.brief ? {} : { brief: result.brief }),
  });
  if (newTaste.length > 0) {
    const saved = await mutateCanvas(deps.repos, userId, canvasId, takedownLoader(deps), (state) => ({
      state: { ...state, taste: newTaste },
      value: true,
    }));
    if (!saved.ok) console.error("[bend_brief] could not save taste");
  }
  return true;
}

/**
 * Handler logic. `getDeps` is only called for a signed-in user (direction stats, and the canvas
 * when a canvasId is passed); anonymous bends never touch the database.
 */
export function createBendBriefTool(getDeps: () => BendBriefDeps) {
  return async function bendBriefTool(args: unknown, userId: string | undefined): Promise<ToolResult> {
    const parsed = parseBendInput(args);
    if (!parsed.ok) return toolMessage(parsed.message);
    const rawCanvasId = (args as { canvasId?: unknown }).canvasId;
    if (rawCanvasId !== undefined && (typeof rawCanvasId !== "string" || !plausibleId(rawCanvasId))) {
      return toolMessage("canvasId must be an id from open_canvas.");
    }
    const canvasId = rawCanvasId as string | undefined;
    const rawTaste = (args as { taste?: unknown }).taste;
    if (rawTaste !== undefined && !tasteInputSchema.safeParse(rawTaste).success) {
      return toolMessage("taste must be 1 to 5 short style words, for example minimal or dark mode.");
    }
    const newTaste = cleanTaste(rawTaste);
    if (canvasId && !userId) return toolMessage("You are not signed in. Reconnect to sign in again.");

    // A saved canvas taste steers the taste lane when this call gives none.
    let canvas: CanvasRecord | null = null;
    let reachable = true;
    if (canvasId && userId) {
      try {
        canvas = await getDeps().repos.canvases.getOwned(userId, canvasId);
      } catch {
        console.error("[bend_brief] could not load the canvas");
        reachable = false;
      }
    }
    const taste = newTaste.length > 0 ? newTaste : cleanTaste(canvas ? parseState(canvas.state).taste : undefined);

    const ingredientWeights = await readWeights(getDeps, userId, canvasId);
    let result: BendResult;
    try {
      result = bendBrief({ ...parsed.input, ...(taste.length > 0 ? { taste } : {}) }, { ingredientWeights });
    } catch {
      return toolMessage("Could not bend that brief. Try a shorter brief in plain words.");
    }

    let text = formatDirections(result);
    let saved = false;
    if (canvasId && userId) {
      try {
        saved = reachable && canvas ? await saveDirections(getDeps(), userId, canvas, result, newTaste) : false;
      } catch {
        console.error("[bend_brief] could not save directions");
        saved = false;
      }
      text += saved
        ? `\nSaved to canvas ${canvasId}. Pass a direction id as directionId (with this canvasId) to search_references.`
        : "\nThe directions were not saved: that canvas was not found or could not be reached. Pass a direction's search text as query to search_references instead.";
    }
    return {
      content: [{ type: "text" as const, text }],
      structuredContent: { ...result, ...(canvasId ? { canvasId, saved } : {}) },
    };
  };
}

let liveTool: ReturnType<typeof createBendBriefTool> | undefined;

/** Live deps; `repos` stays lazy so a missing DATABASE_URL only fails the parts that need it. */
function liveBendDeps(): BendBriefDeps {
  const canvas = liveCanvasDeps();
  return {
    get repos() {
      return canvas.repos;
    },
    globalLearning: () => globalLearningOn(process.env.GLOBAL_LEARNING),
  };
}

export const register: RegisterTool = (server) => {
  server.registerTool(
    "bend_brief",
    {
      title: "Bend a design brief",
      description: BEND_BRIEF_DESCRIPTION,
      inputSchema: advertisedInput,
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args, ctx) => {
      liveTool ??= createBendBriefTool(liveBendDeps);
      return liveTool(args, authExtra(ctx)?.userId);
    },
  );
};
