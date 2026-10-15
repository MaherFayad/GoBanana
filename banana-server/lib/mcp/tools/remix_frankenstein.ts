/**
 * `remix_frankenstein` ("Frankenstein it", try combinations): new variants of a Frankenstein page with
 * other parts in its slots, placed right of the original. Lock slots or roles to keep them, or
 * name the roles to vary. Seeded, so the same call on the same board gives the same variants.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { canvasWebUrl, itemCount, mutateCanvas, newNodeId, type PlacedNode } from "@/lib/canvas/store";
import { canAddItems } from "@/lib/quota";
import { hashSeed, remix, stitchKey } from "@/lib/stitch/fill";
import { MAX_STITCH_TITLE } from "@/lib/stitch/parse";
import { MAX_VARIANTS, type StitchData } from "@/lib/stitch/types";
import {
  CANVAS_NOT_FOUND,
  lazyTool,
  mutateError,
  plausibleId,
  takedownLoader,
  TRY_AGAIN,
  upgradeUrl,
  type CanvasToolDeps,
} from "./canvas-shared";
import { idSchema, placeRightOf, roleSchema, SOURCE_REMINDER, stitchNodes, stitchText, summarize, type StitchSummary } from "./stitch-shared";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "remix_frankenstein";

export const TOOL_DESCRIPTION =
  "Frankenstein it: make variants of a Frankenstein page with other parts from the library in its slots, placed right of the original. " +
  "lock keeps slots (slot ids or roles); vary names the only roles to swap. A slot with a new part drops the old part's note. Same call, same result.";

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100),
  stitchId: idSchema,
  count: z.number().int().min(1).max(MAX_VARIANTS),
  lock: z.array(z.string().min(1).max(120)).max(42).optional().describe("Slot ids or roles to keep as they are."),
  vary: z.array(roleSchema).min(1).max(26).optional().describe("Roles to swap. When set, only these change."),
});

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas.",
  stitchId: "Pass the id of a Frankenstein page from frankenstein_page or get_canvas.",
  count: `count is how many variants to make, 1 to ${MAX_VARIANTS}.`,
  lock: "lock is a list of slot ids or roles to keep.",
  vary: "vary is a list of roles to swap.",
};

export type RemixStitchOutput = { canvasId: string; stitchId: string; stitches: StitchSummary[]; notes: string[]; webUrl: string };

export const STITCH_NOT_FOUND = "That Frankenstein page was not found on this canvas. Call get_canvas to see the page ids.";

export function createRemixStitchTool(deps: CanvasToolDeps) {
  return async function remixStitch(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, MESSAGES, MESSAGES.count!);
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    if (!plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);
    try {
      const { repos } = deps;
      const owned = await repos.canvases.getOwned(userId, input.canvasId);
      if (!owned) return toolMessage(CANVAS_NOT_FOUND);
      const plan = await repos.users.getPlan(userId);
      const makeId = deps.makeId ?? newNodeId;

      const outcome = await mutateCanvas<{ placed: PlacedNode[]; datas: StitchData[]; notes: string[] }>(repos, userId, input.canvasId, takedownLoader(deps), (state) => {
        const all = stitchNodes(state);
        const original = all.find((n) => n.id === input.stitchId);
        if (!original) return { error: STITCH_NOT_FOUND };
        const parts = state.parts ?? [];
        const seed = hashSeed(`${input.stitchId}|${input.count}|${(input.lock ?? []).join(",")}|${(input.vary ?? []).join(",")}`);
        const result = remix(original.data, parts, {
          count: input.count,
          ...(input.lock ? { lock: input.lock } : {}),
          ...(input.vary ? { vary: input.vary } : {}),
          seed,
          avoid: all.map((n) => stitchKey(n.data.rows)),
        });
        if (result.stitches.length === 0) return { error: `${result.notes.join("\n")}\nNothing was made.` };
        const cap = canAddItems(plan, itemCount(state), result.stitches.length, { upgradeUrl: upgradeUrl(deps), now: deps.now?.() });
        if (!cap.ok) return { error: cap.message };
        const family = all.filter((n) => n.data.variantOf === original.id).length;
        const base = original.data.title.replace(/, remix \d+$/, "");
        const datas: StitchData[] = result.stitches.map((d, i) => {
          const { variant: _v, ...rest } = d;
          return { ...rest, title: `${base}, remix ${family + i + 1}`.slice(0, MAX_STITCH_TITLE), variantOf: original.id, variant: family + i + 1 };
        });
        const { state: next, placed } = placeRightOf(state, original, datas, makeId);
        return { state: next, value: { placed, datas, notes: result.notes } };
      });
      if (!outcome.ok) return mutateError(outcome);

      const { placed, datas, notes } = outcome.value;
      const parts = outcome.state.parts ?? [];
      const out: RemixStitchOutput = {
        canvasId: input.canvasId,
        stitchId: input.stitchId,
        stitches: placed.map((p, i) => summarize(p.id, datas[i]!, parts)),
        notes,
        webUrl: canvasWebUrl(deps.appUrl(), input.canvasId),
      };
      const lines = [`Made ${placed.length} variant${placed.length === 1 ? "" : "s"} of Frankenstein page ${input.stitchId}:`];
      placed.forEach((p, i) => lines.push(...stitchText(p.id, datas[i]!, parts)));
      lines.push(...notes, SOURCE_REMINDER, `Web link: ${out.webUrl}`);
      return toolResult(lines.join("\n"), out);
    } catch {
      console.error("[remix_frankenstein] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createRemixStitchTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Remix Frankenstein page",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
