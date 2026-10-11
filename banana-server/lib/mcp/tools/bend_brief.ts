import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { bendBrief, bendInputSchema, formatDirections, parseBendInput, type BendResult } from "@/lib/bend";
import { liveCanvasDeps, plausibleId, type CanvasToolDeps } from "./canvas-shared";
import { lenient, toolMessage, type RegisterTool, type ToolResult } from "./types";

export const BEND_BRIEF_DESCRIPTION =
  "Turn a plain design brief into wild, unexpected design directions. " +
  "Use it when the user wants fresh, bold or surprising ideas instead of the usual layout. " +
  "Each direction has a title, a search query and a prompt to riff on. " +
  "Wildness runs from 1 (Fresh) to 5 (Bananas). " +
  "Pass canvasId to save the directions there, then call search_references with a direction id.";

/** Advertised input: the bend schema plus an optional canvas to save the directions to. */
export const inputSchema = bendInputSchema.extend({
  canvasId: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe("Canvas from open_canvas. Saves the directions there so search_references can take a directionId."),
});

/**
 * Advertise the strict JSON schema to clients, but let every call through to the
 * handler so invalid input gets a plain message instead of the SDK's raw validation dump.
 */
const advertisedInput: StandardSchemaWithJSON<unknown, unknown> = lenient(inputSchema);

export type BendBriefDeps = Pick<CanvasToolDeps, "repos">;

/** Save directions on the user's canvas. Returns false when the canvas is not the user's. */
async function saveDirections(deps: BendBriefDeps, userId: string, canvasId: string, result: BendResult): Promise<boolean> {
  const canvas = await deps.repos.canvases.getOwned(userId, canvasId);
  if (!canvas) return false;
  await deps.repos.directions.upsertMany(
    canvasId,
    result.directions.map((d) => ({ bendId: d.id, move: d.move, title: d.title, searchQuery: d.searchQuery })),
  );
  await deps.repos.canvases.update(userId, canvasId, {
    wildness: result.wildness,
    lens: result.lens?.id ?? null,
    ...(canvas.brief ? {} : { brief: result.brief }),
  });
  return true;
}

/** Handler logic. `getDeps` is only called when a canvasId is passed, so plain bends never touch the database. */
export function createBendBriefTool(getDeps: () => BendBriefDeps) {
  return async function bendBriefTool(args: unknown, userId: string | undefined): Promise<ToolResult> {
    const parsed = parseBendInput(args);
    if (!parsed.ok) return toolMessage(parsed.message);
    const rawCanvasId = (args as { canvasId?: unknown }).canvasId;
    if (rawCanvasId !== undefined && (typeof rawCanvasId !== "string" || !plausibleId(rawCanvasId))) {
      return toolMessage("canvasId must be an id from open_canvas.");
    }
    const canvasId = rawCanvasId as string | undefined;

    let result: BendResult;
    try {
      result = bendBrief(parsed.input);
    } catch {
      return toolMessage("Could not bend that brief. Try a shorter brief in plain words.");
    }

    let text = formatDirections(result);
    let saved = false;
    if (canvasId) {
      if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
      try {
        saved = await saveDirections(getDeps(), userId, canvasId, result);
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
      liveTool ??= createBendBriefTool(liveCanvasDeps);
      return liveTool(args, authExtra(ctx)?.userId);
    },
  );
};
