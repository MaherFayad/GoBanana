/**
 * `frankenstein_page` ("Frankenstein it", step 2): stack parts from the library into new pages. Pass
 * explicit rows of part ids, or a recipe of roles plus a number of variants and the server fills
 * each role from the library (seeded, so the same call gives the same pages). Frames go side by
 * side in the "Frankenstein pages" section. Each frame is one canvas item; all or nothing.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { canvasWebUrl, itemCount, mutateCanvas, newNodeId, type PlacedNode } from "@/lib/canvas/store";
import { isPlatform } from "@/lib/direction-detail";
import { canAddItems } from "@/lib/quota";
import { fillRecipe, hashSeed } from "@/lib/stitch/fill";
import { MAX_PART_NOTE, MAX_STITCH_NOTE, MAX_STITCH_TITLE } from "@/lib/stitch/parse";
import {
  clampCrop,
  MAX_SLOTS_PER_ROW,
  MAX_STITCH_ROWS,
  MAX_VARIANTS,
  type StitchData,
  type StitchPlatform,
  type StitchRow,
} from "@/lib/stitch/types";
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
import {
  cropSchema,
  idSchema,
  modeSchema,
  placeInStitchSection,
  platformSchema,
  roleSchema,
  ROLES_TEXT,
  SOURCE_REMINDER,
  STITCH_SECTION_TITLE,
  stitchText,
  summarize,
  type StitchSummary,
} from "./stitch-shared";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "frankenstein_page";

export const TOOL_DESCRIPTION =
  "Frankenstein it, step 2: stack parts from the library into new Frankenstein pages, top to bottom, in a frame for the platform. " +
  `Pass rows of part ids (1 to ${MAX_SLOTS_PER_ROW} per row), or a recipe of roles plus variants (1 to ${MAX_VARIANTS}) and each role is filled from the library, mixing sources. ` +
  "For ideas, not a finished design.";

const slotInput = z.object({
  partId: idSchema,
  crop: cropSchema.optional(),
  note: z.string().trim().min(1).max(MAX_PART_NOTE).optional(),
});

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(MAX_STITCH_TITLE).optional(),
  platform: platformSchema.optional().describe("Frame: mobile 390, tablet 834, website or webapp 1440 px. Default: the direction's platform, else website."),
  mode: modeSchema.optional().describe("collage (default, parts as they are), wireframe (grayscale with role labels) or even (one theme)."),
  directionId: z.string().min(1).max(100).optional(),
  note: z.string().trim().min(1).max(MAX_STITCH_NOTE).optional().describe("The idea in one line."),
  rows: z
    .array(
      z.object({
        slots: z.array(slotInput).min(1).max(MAX_SLOTS_PER_ROW),
        widths: z.array(z.number().positive().max(12)).min(2).max(MAX_SLOTS_PER_ROW).optional(),
      }),
    )
    .min(1)
    .max(MAX_STITCH_ROWS)
    .optional(),
  recipe: z.array(roleSchema).min(1).max(MAX_STITCH_ROWS).optional().describe('Roles top to bottom, for example ["nav", "hero", "cards", "footer"].'),
  variants: z.number().int().min(1).max(MAX_VARIANTS).optional(),
});

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas.",
  title: `title is up to ${MAX_STITCH_TITLE} characters.`,
  platform: "platform must be mobile, tablet, website or webapp.",
  mode: "mode must be collage, wireframe or even.",
  directionId: "Pass a directionId from get_canvas, or leave it out.",
  note: `note is the idea in one line, up to ${MAX_STITCH_NOTE} characters.`,
  rows: `rows is a list of 1 to ${MAX_STITCH_ROWS} rows, each { slots: [{ partId, crop?, note? }] (1 to ${MAX_SLOTS_PER_ROW}), widths? (one number per slot) }.`,
  recipe: `recipe is a list of 1 to ${MAX_STITCH_ROWS} roles from: ${ROLES_TEXT}.`,
  variants: `variants is 1 to ${MAX_VARIANTS}.`,
};

export type StitchPageOutput = {
  canvasId: string;
  sectionId: string;
  stitches: StitchSummary[];
  notes: string[];
  webUrl: string;
};

const PLATFORM_OF: Record<string, StitchPlatform> = { mobile: "mobile", tablet: "tablet", website: "website", webapp: "webapp" };

export function createStitchPageTool(deps: CanvasToolDeps) {
  return async function stitchPage(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, MESSAGES, MESSAGES.rows!);
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    if (!plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);
    if (Boolean(input.rows) === Boolean(input.recipe)) {
      return toolMessage("Pass either rows (part ids you picked) or a recipe (roles to fill from the library), not both.");
    }
    for (const row of input.rows ?? []) {
      if (row.widths && row.widths.length !== row.slots.length) return toolMessage("Each row's widths needs one number per slot.");
    }
    try {
      const { repos } = deps;
      const owned = await repos.canvases.getOwned(userId, input.canvasId);
      if (!owned) return toolMessage(CANVAS_NOT_FOUND);
      const plan = await repos.users.getPlan(userId);
      const directions = input.directionId ? await repos.directions.listForCanvas(input.canvasId) : [];
      const direction = input.directionId ? directions.find((d) => d.id === input.directionId || d.bendId === input.directionId) : undefined;
      if (input.directionId && !direction) return toolMessage("This canvas has no direction with that id. Call get_canvas to see the direction ids.");
      const dirPlatform = direction?.detail?.platform;
      const platform: StitchPlatform = input.platform ?? (dirPlatform && isPlatform(dirPlatform) ? PLATFORM_OF[dirPlatform] : undefined) ?? "website";
      const mode = input.mode ?? "collage";
      const makeId = deps.makeId ?? newNodeId;

      const outcome = await mutateCanvas<{ placed: PlacedNode[]; datas: StitchData[]; notes: string[]; sectionId: string }>(
        repos,
        userId,
        input.canvasId,
        takedownLoader(deps),
        (state) => {
          const parts = state.parts ?? [];
          if (parts.length === 0) return { error: "The parts library is empty. Cut parts from board images or search results with cut_parts first." };
          const byId = new Map(parts.map((p) => [p.id, p]));
          let datas: StitchData[];
          let notes: string[] = [];
          const common = {
            mode,
            ...(direction ? { directionId: direction.bendId ?? direction.id } : {}),
            ...(input.note ? { note: input.note } : {}),
          };
          if (input.rows) {
            const missing = input.rows.flatMap((r) => r.slots.filter((s) => !byId.has(s.partId)).map((s) => s.partId));
            if (missing.length > 0) {
              return { error: `These parts are not in the library: ${[...new Set(missing)].join(", ")}. Call get_canvas to see part ids. Nothing was made.` };
            }
            let n = 0;
            const rows: StitchRow[] = input.rows.map((r, i) => ({
              id: `rw-${i + 1}`,
              slots: r.slots.map((s) => ({
                id: `sl-${++n}`,
                role: byId.get(s.partId)!.role,
                partId: s.partId,
                ...(s.crop ? { crop: clampCrop(s.crop) } : {}),
                ...(s.note ? { note: s.note } : {}),
              })),
              ...(r.widths && r.slots.length > 1 ? { widths: r.widths } : {}),
            }));
            datas = [{ title: input.title ?? "Frankenstein page", platform, rows, ...common }];
            if (input.variants && input.variants > 1) notes.push("variants works with a recipe. With rows you get one page; use remix_frankenstein for variants.");
          } else {
            const seed = hashSeed(`${input.canvasId}|${input.recipe!.join(",")}|${input.variants ?? 1}|${platform}`);
            const filled = fillRecipe(input.recipe!, parts, { variants: input.variants ?? 1, seed, platform, ...(input.title ? { title: input.title } : {}) });
            notes = filled.notes;
            if (filled.stitches.length === 0) return { error: `${notes.join("\n")}\nNothing was made.` };
            datas = filled.stitches.map((d) => ({ ...d, ...common }));
          }
          const { state: next, placed, sectionId, createdSection } = placeInStitchSection(state, datas, makeId);
          const cap = canAddItems(plan, itemCount(state), datas.length + (createdSection ? 1 : 0), { upgradeUrl: upgradeUrl(deps), now: deps.now?.() });
          if (!cap.ok) return { error: cap.message };
          return { state: next, value: { placed, datas, notes, sectionId } };
        },
      );
      if (!outcome.ok) return mutateError(outcome);

      const { placed, datas, notes, sectionId } = outcome.value;
      const parts = outcome.state.parts ?? [];
      const stitches = placed.map((p, i) => summarize(p.id, datas[i]!, parts));
      const out: StitchPageOutput = { canvasId: input.canvasId, sectionId, stitches, notes, webUrl: canvasWebUrl(deps.appUrl(), input.canvasId) };
      const lines = [`Made ${stitches.length} Frankenstein page${stitches.length === 1 ? "" : "s"} in the "${STITCH_SECTION_TITLE}" section (${sectionId}):`];
      placed.forEach((p, i) => lines.push(...stitchText(p.id, datas[i]!, parts)));
      lines.push(...notes, SOURCE_REMINDER, "Change one with update_frankenstein, or make variants with remix_frankenstein.", `Web link: ${out.webUrl}`);
      return toolResult(lines.join("\n"), out);
    } catch {
      console.error("[frankenstein_page] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createStitchPageTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Frankenstein page",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
