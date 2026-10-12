/**
 * `cut_parts` ("Frankenstein it", step 1): cut parts out of board images or search results into
 * the canvas parts library. A part is a crop rectangle over the hotlinked image URL; nothing is
 * downloaded. Free (no search quota, no canvas items). All or nothing per call.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { canvasWebUrl, mutateCanvas, newNodeId, parseState, siteFromUrl } from "@/lib/canvas/store";
import type { ReferenceRecord } from "@/lib/db/types";
import { detectPlatform } from "@/lib/platform";
import { isMobbinSource } from "@/lib/sources/mobbin";
import { defaultCrop, distinctCrop } from "@/lib/stitch/crop";
import { MAX_PART_NOTE } from "@/lib/stitch/parse";
import { clampCrop, MAX_PARTS, type Crop, type Part, type StitchPlatform } from "@/lib/stitch/types";
import {
  CANVAS_NOT_FOUND,
  lazyTool,
  mutateError,
  plausibleId,
  takedownLoader,
  TRY_AGAIN,
  type CanvasToolDeps,
} from "./canvas-shared";
import { cropSchema, idSchema, newPartId, roleSchema, ROLES_TEXT } from "./stitch-shared";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "cut_parts";
export const MAX_CUTS = 24;

export const TOOL_DESCRIPTION =
  "Frankenstein it, step 1: cut parts (nav, hero, cards, footer and more) out of board images (itemId, Mobbin screens too) or search results (referenceId) into the canvas parts library. " +
  "Pass a crop (fractions 0 to 1) only if your client shows you the image; else the server guesses one by role and image shape, marked guessed, for the user to adjust in the canvas. Never download images. Free.";

const cut = z
  .object({
    itemId: idSchema.optional(),
    referenceId: z.string().min(1).max(100).optional(),
    role: roleSchema,
    crop: cropSchema.optional(),
    theme: z.enum(["light", "dark", "unknown"]).optional(),
    note: z.string().trim().min(1).max(MAX_PART_NOTE).optional().describe("What to take from this part."),
  })
  .refine((c) => Boolean(c.itemId) !== Boolean(c.referenceId), { message: "one source", path: ["cuts"] });

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100),
  cuts: z.array(cut).min(1).max(MAX_CUTS),
});

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas.",
  cuts: `cuts must be a list of 1 to ${MAX_CUTS} cuts. Each is { itemId or referenceId (one of them), role, crop?, theme?, note? }. role is one of: ${ROLES_TEXT}. crop is { x, y, w, h } as fractions from 0 to 1. note is up to ${MAX_PART_NOTE} characters.`,
};

export type CutPartsOutput = {
  canvasId: string;
  parts: { id: string; role: string; crop: Crop; sourceSite: string; sourceUrl: string; guessedCrop: boolean }[];
  libraryCount: number;
  webUrl: string;
};

type Source = {
  imageUrl: string;
  thumbUrl?: string | null;
  sourceUrl: string;
  sourceSite?: string | null;
  title?: string | null;
  width?: number | null;
  height?: number | null;
};

/** The board's platform from its brief, when it names one ("mobile flight checkout" gives mobile). */
function stitchPlatform(brief: string | null | undefined): StitchPlatform | undefined {
  const p = brief ? detectPlatform(brief) : "any";
  return p === "any" ? undefined : p;
}

export function createCutPartsTool(deps: CanvasToolDeps) {
  return async function cutParts(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, MESSAGES, MESSAGES.cuts!);
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    if (!plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);
    try {
      const { repos } = deps;
      const owned = await repos.canvases.getOwned(userId, input.canvasId);
      if (!owned) return toolMessage(CANVAS_NOT_FOUND);
      const refIds = [...new Set(input.cuts.flatMap((c) => (c.referenceId ? [c.referenceId] : [])))];
      const saved: Map<string, ReferenceRecord> = refIds.length > 0 ? await repos.references.getByIds(input.canvasId, refIds) : new Map();
      const loadMatcher = takedownLoader(deps);
      const matcher = await loadMatcher();
      const makeId = deps.makeId ?? newNodeId;
      // The board's platform shapes the guess: a phone shot is cut from its middle phone.
      const platform = stitchPlatform(owned.brief);

      const outcome = await mutateCanvas<Part[]>(repos, userId, input.canvasId, loadMatcher, (state) => {
        const library = state.parts ?? [];
        if (library.length + input.cuts.length > MAX_PARTS) {
          return {
            error: `The parts library holds up to ${MAX_PARTS} parts. It has ${library.length}, so cut at most ${Math.max(0, MAX_PARTS - library.length)} more. Nothing was cut.`,
          };
        }
        const tray = new Map(state.tray.map((r) => [r.id, r]));
        const nodes = new Map(state.nodes.map((n) => [n.id, n]));
        const taken = new Set(library.map((p) => p.id));
        const problems: string[] = [];
        const fresh: Part[] = [];
        // Crops already cut per image: a guess never repeats one (two roles, one band).
        const cropsOf = (url: string) => [...library, ...fresh].filter((p) => p.imageUrl === url).map((p) => p.crop);
        input.cuts.forEach((c, i) => {
          let src: Source | undefined;
          if (c.itemId) {
            const node = nodes.get(c.itemId);
            if (!node || (node.type !== "image" && node.type !== "upload")) {
              problems.push(`Cut ${i + 1}: item ${c.itemId} is not an image on this canvas. Call get_canvas to see item ids.`);
              return;
            }
            src = node.data;
          } else if (c.referenceId) {
            src = saved.get(c.referenceId) ?? tray.get(c.referenceId);
            if (!src) {
              problems.push(`Cut ${i + 1}: reference ${c.referenceId} was not found for this canvas. Search with this canvasId first.`);
              return;
            }
          }
          if (!src) return;
          if (matcher.isReferenceBlocked(src)) {
            problems.push(`Cut ${i + 1}: that image was removed after a takedown request.`);
            return;
          }
          const imageWidth = src.width ?? undefined;
          const imageHeight = src.height ?? undefined;
          // A Mobbin screen is one screen, so a guess never looks for a middle phone in it.
          const single = isMobbinSource(src);
          const crop = c.crop
            ? clampCrop(c.crop)
            : distinctCrop(defaultCrop(c.role, { imageWidth, imageHeight, single, ...(platform ? { platform } : {}) }), cropsOf(src.imageUrl));
          fresh.push({
            id: newPartId(makeId, taken),
            role: c.role,
            imageUrl: src.imageUrl,
            ...(src.thumbUrl ? { thumbUrl: src.thumbUrl } : {}),
            sourceUrl: src.sourceUrl,
            sourceSite: src.sourceSite || siteFromUrl(src.sourceUrl),
            ...(src.title ? { title: src.title } : {}),
            crop,
            ...(imageWidth ? { imageWidth } : {}),
            ...(imageHeight ? { imageHeight } : {}),
            ...(c.theme ? { theme: c.theme } : {}),
            ...(c.note ? { note: c.note } : {}),
            ...(c.itemId ? { fromItemId: c.itemId } : { fromReferenceId: c.referenceId }),
            ...(c.crop ? {} : { guessedCrop: true }),
          });
        });
        if (problems.length > 0) return { error: `${problems.join("\n")}\nNothing was cut.` };
        const next = { ...state, parts: [...library, ...fresh] };
        // Parts the canvas parser refuses (unsafe URLs) fail the whole call too.
        const kept = new Set((parseState(next).parts ?? []).map((p) => p.id));
        const refused = fresh.filter((p) => !kept.has(p.id));
        if (refused.length > 0) return { error: "Some images have links the canvas cannot use. Nothing was cut." };
        return { state: next, value: fresh };
      });
      if (!outcome.ok) return mutateError(outcome);

      const parts = outcome.value;
      const out: CutPartsOutput = {
        canvasId: input.canvasId,
        parts: parts.map((p) => ({ id: p.id, role: p.role, crop: p.crop, sourceSite: p.sourceSite, sourceUrl: p.sourceUrl, guessedCrop: p.guessedCrop === true })),
        libraryCount: outcome.state.parts?.length ?? parts.length,
        webUrl: canvasWebUrl(deps.appUrl(), input.canvasId),
      };
      const pct = (n: number) => Math.round(n * 100);
      const lines = [`Cut ${parts.length} part${parts.length === 1 ? "" : "s"} for Frankenstein pages (library: ${out.libraryCount} of ${MAX_PARTS}).`];
      for (const p of parts) {
        lines.push(
          `- ${p.id}: ${p.role} from ${p.sourceSite} ${p.sourceUrl}, crop x ${pct(p.crop.x)}% y ${pct(p.crop.y)}% w ${pct(p.crop.w)}% h ${pct(p.crop.h)}%${p.guessedCrop ? " (guessed crop)" : ""}`,
        );
      }
      if (parts.some((p) => p.guessedCrop)) {
        // Honest about what nobody saw: the agent cannot see the image unless its client shows it.
        lines.push(
          "Guessed crops are a band picked by role and image shape; nobody looked at the image. Keep them and tell the user they can adjust each one in the canvas crop editor (Edit crop on a part). Do not download the images to check.",
        );
      }
      lines.push("Next: frankenstein_page with rows of part ids, or a recipe of roles.", `Web link: ${out.webUrl}`);
      return toolResult(lines.join("\n"), out);
    } catch {
      console.error("[cut_parts] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createCutPartsTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Cut parts",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
