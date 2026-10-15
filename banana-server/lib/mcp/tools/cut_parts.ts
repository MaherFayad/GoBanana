/**
 * `cut_parts` ("Frankenstein it", step 1): cut parts out of board images or search results into
 * the canvas parts library. A part is a crop rectangle over the hotlinked image URL; nothing is
 * downloaded. Free (no search quota, no canvas items). All or nothing per call.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { canvasWebUrl, mutateCanvas, newNodeId, parseState, siteFromUrl } from "@/lib/canvas/store";
import type { FetchLike } from "@/lib/palette/fetch";
import type { ImageHostAllowlist } from "@/lib/sources/allowlist";
import { lookBlocks, MAX_CUT_PX } from "@/lib/vision/look";
import type { McpContent, VisionResult } from "@/lib/vision/thumbs";
import type { ReferenceRecord } from "@/lib/db/types";
import { detectPlatform } from "@/lib/platform";
import { isMobbinSource } from "@/lib/sources/mobbin";
import { defaultCrop, distinctCrop } from "@/lib/stitch/crop";
import { anatomyFor, loadCutAnatomy, type CutAnatomy } from "@/lib/atlas/wiring";
import type { PageAnatomy } from "@/lib/atlas/types";
import { MAX_PART_NOTE } from "@/lib/stitch/parse";
import { MAX_SWIPE_ITEMS } from "@/lib/swipe";
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
import { webTitle } from "@/lib/mcp/untrusted";
import { lenient, parseArgs, toolMessage, type RegisterTool } from "./types";

export const TOOL_NAME = "cut_parts";
export const MAX_CUTS = 24;

export const TOOL_DESCRIPTION =
  "Frankenstein it, step 1: cut parts (nav, hero, cards, footer) out of board images (itemId, Mobbin screens too) or search results (referenceId) into the parts library. " +
  `Look first: look { itemId } returns that one image up to ${MAX_CUT_PX} px wide with its pixel size, so you can pass an exact crop (fractions 0 to 1). With no crop the server guesses one, marked guessed. Never download images. Free.`;

/** One image to see before cutting (owner decision D4): a board item or a search result. */
const look = z
  .object({
    itemId: idSchema.optional(),
    referenceId: z.string().min(1).max(100).optional(),
  })
  .refine((l) => Boolean(l.itemId) !== Boolean(l.referenceId), { message: "one source", path: ["look"] });

const cut = z
  .object({
    itemId: idSchema.optional(),
    referenceId: z.string().min(1).max(100).optional(),
    role: roleSchema,
    crop: cropSchema.optional(),
    theme: z.enum(["light", "dark", "unknown"]).optional(),
    note: z.string().trim().min(1).max(MAX_PART_NOTE).optional().describe("What to take from this part."),
    cardId: z.string().trim().min(1).max(60).optional().describe("Atlas card id, when the part came from one. Kept with the swipe file item."),
  })
  .refine((c) => Boolean(c.itemId) !== Boolean(c.referenceId), { message: "one source", path: ["cuts"] });

export const inputSchema = z
  .object({
    canvasId: z.string().min(1).max(100),
    cuts: z.array(cut).min(1).max(MAX_CUTS).optional(),
    look: look.optional().describe(`One image to see before cutting, up to ${MAX_CUT_PX} px wide, with its pixel size. Never stored.`),
    save: z.boolean().optional().describe("Also keep the cut parts in the user's swipe file (links, roles and crops only), to reuse on other boards."),
  })
  .refine((i) => Boolean(i.cuts) || Boolean(i.look), { message: "cuts or look", path: ["cuts"] });

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas.",
  look: "look is { itemId } (a board image) or { referenceId } (a search result), one of them.",
  cuts: `Pass cuts, look or both. cuts must be a list of 1 to ${MAX_CUTS} cuts. Each is { itemId or referenceId (one of them), role, crop?, theme?, note? }. role is one of: ${ROLES_TEXT}. crop is { x, y, w, h } as fractions from 0 to 1. note is up to ${MAX_PART_NOTE} characters.`,
};

export type CutPartsOutput = {
  canvasId: string;
  /** The image shown by look, with its pixel size; absent when no look or it could not be shown. */
  look?: { itemId?: string; referenceId?: string; width: number; height: number; size: "cut" | "small" };
  parts: { id: string; role: string; crop: Crop; sourceSite: string; sourceUrl: string; guessedCrop: boolean }[];
  libraryCount: number;
  webUrl: string;
  /** Parts newly kept in the swipe file (save: true). */
  swipeSaved?: number;
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

export type CutPartsDeps = CanvasToolDeps & { fetchImpl?: FetchLike; allowlist?: () => ImageHostAllowlist };

export function createCutPartsTool(deps: CutPartsDeps) {
  return async function cutParts(raw: unknown, userId: string | undefined): Promise<VisionResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, MESSAGES, MESSAGES.cuts!);
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    if (!plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);
    try {
      const { repos } = deps;
      const owned = await repos.canvases.getOwned(userId, input.canvasId);
      if (!owned) return toolMessage(CANVAS_NOT_FOUND);
      const cuts = input.cuts ?? [];
      const refIds = [...new Set([...cuts, ...(input.look ? [input.look] : [])].flatMap((c) => (c.referenceId ? [c.referenceId] : [])))];
      const saved: Map<string, ReferenceRecord> = refIds.length > 0 ? await repos.references.getByIds(input.canvasId, refIds) : new Map();
      const loadMatcher = takedownLoader(deps);
      const matcher = await loadMatcher();
      const makeId = deps.makeId ?? newNodeId;
      // The board's platform shapes the guess: a phone shot is cut from its middle phone.
      const platform = stitchPlatform(owned.brief);

      // look: resolve the one image before any change, so a bad id fails the call with nothing cut.
      let lookSrc: (Source & { label: string }) | undefined;
      if (input.look) {
        const state = parseState(owned.state);
        const { itemId, referenceId } = input.look;
        const node = itemId ? state.nodes.find((n) => n.id === itemId) : undefined;
        const src: Source | undefined = itemId
          ? node && (node.type === "image" || node.type === "upload")
            ? node.data
            : undefined
          : (saved.get(referenceId!) ?? state.tray.find((r) => r.id === referenceId));
        if (!src) {
          return toolMessage(
            itemId
              ? `look: item ${itemId} is not an image on this canvas. Call get_canvas to see item ids. Nothing was cut.`
              : `look: reference ${referenceId} was not found for this canvas. Search with this canvasId first. Nothing was cut.`,
          );
        }
        if (matcher.isReferenceBlocked(src)) return toolMessage("look: that image was removed after a takedown request. Nothing was cut.");
        const site = src.sourceSite || siteFromUrl(src.sourceUrl);
        lookSrc = { ...src, label: `Look at ${itemId ? `item ${itemId}` : `reference ${referenceId}`}${src.title ? ` "${webTitle(src.title)}"` : ""} from ${site} ${src.sourceUrl}` };
      }

      // A guessed crop reads the page anatomy (P1-I4 bands) when the Atlas knows the page: the
      // image's direction's page, else the board's. No Atlas: ROLE_BANDS as before.
      let anatomy: CutAnatomy | null = null;
      /** The direction each cut's image belongs to, by cut index (swipe items take its lead card). */
      const cutDirection = new Map<number, string>();
      /** Page anatomies the guessed crops used (P1-I7: the agent reads their roles). */
      const usedPages = new Map<string, PageAnatomy>();
      if (cuts.some((c) => !c.crop) && deps.atlasSource) {
        try {
          const source = deps.atlasSource();
          if (source) anatomy = await loadCutAnatomy(source, await repos.directions.listForCanvas(input.canvasId), owned.brief);
        } catch {
          console.error("[cut_parts] could not read the page anatomy");
          anatomy = null;
        }
      }

      let parts: Part[] = [];
      let libraryCount = (parseState(owned.state).parts ?? []).length;
      if (cuts.length > 0) {
      const outcome = await mutateCanvas<Part[]>(repos, userId, input.canvasId, loadMatcher, (state) => {
        const library = state.parts ?? [];
        if (library.length + cuts.length > MAX_PARTS) {
          return {
            error: `The parts library holds up to ${MAX_PARTS} parts. It has ${library.length}, so cut at most ${Math.max(0, MAX_PARTS - library.length)} more. Nothing was cut.`,
          };
        }
        const tray = new Map(state.tray.map((r) => [r.id, r]));
        const nodes = new Map(state.nodes.map((n) => [n.id, n]));
        const taken = new Set(library.map((p) => p.id));
        // The direction of an image: its section's direction (board items) or the tray result's.
        const sectionDirection = new Map(
          state.nodes.filter((n) => n.type === "section").map((n) => [n.id, ((n.data as { directionId?: unknown }).directionId as string | undefined) ?? null]),
        );
        const problems: string[] = [];
        const fresh: Part[] = [];
        // Crops already cut per image: a guess never repeats one (two roles, one band).
        const cropsOf = (url: string) => [...library, ...fresh].filter((p) => p.imageUrl === url).map((p) => p.crop);
        cuts.forEach((c, i) => {
          let src: Source | undefined;
          let directionId: string | null = null;
          if (c.itemId) {
            const node = nodes.get(c.itemId);
            if (!node || (node.type !== "image" && node.type !== "upload")) {
              problems.push(`Cut ${i + 1}: item ${c.itemId} is not an image on this canvas. Call get_canvas to see item ids.`);
              return;
            }
            src = node.data;
            directionId = node.parentId ? (sectionDirection.get(node.parentId) ?? null) : null;
          } else if (c.referenceId) {
            src = saved.get(c.referenceId) ?? tray.get(c.referenceId);
            directionId = tray.get(c.referenceId)?.directionId ?? null;
            if (!src) {
              problems.push(`Cut ${i + 1}: reference ${c.referenceId} was not found for this canvas. Search with this canvasId first.`);
              return;
            }
          }
          if (directionId) cutDirection.set(i, directionId);
          if (!src) return;
          if (matcher.isReferenceBlocked(src)) {
            problems.push(`Cut ${i + 1}: that image was removed after a takedown request.`);
            return;
          }
          const imageWidth = src.width ?? undefined;
          const imageHeight = src.height ?? undefined;
          // A Mobbin screen is one screen, so a guess never looks for a middle phone in it.
          const single = isMobbinSource(src);
          const pageAnatomy = c.crop ? null : anatomyFor(anatomy, directionId);
          if (pageAnatomy) usedPages.set(pageAnatomy.id, pageAnatomy);
          const crop = c.crop
            ? clampCrop(c.crop)
            : distinctCrop(
                defaultCrop(c.role, { imageWidth, imageHeight, single, ...(platform ? { platform } : {}), anatomy: pageAnatomy }),
                cropsOf(src.imageUrl),
              );
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
      parts = outcome.value;
      libraryCount = outcome.state.parts?.length ?? parts.length;
      }

      let swipeNote = "";
      let swipeSaved: number | undefined;
      if (input.save && parts.length > 0) {
        try {
          const repo = deps.swipe?.();
          if (!repo) throw new Error("no swipe repo");
          // The agent's cardId, else the lead Atlas card of the image's direction (W2).
          const leadOf = new Map<string, string>();
          if (cutDirection.size > 0 && cuts.some((c) => !c.cardId)) {
            for (const d of await repos.directions.listForCanvas(input.canvasId)) {
              const lead = d.detail?.atlas?.cardIds[0];
              if (!lead) continue;
              leadOf.set(d.id, lead);
              if (d.bendId) leadOf.set(d.bendId, lead);
            }
          }
          const cardOf = new Map(cuts.map((c, i) => [i, c.cardId ?? leadOf.get(cutDirection.get(i) ?? "")] as const));
          const res = await repo.addMany(
            userId,
            parts.map((p, i) => ({
              kind: "part" as const,
              role: p.role,
              cardId: cardOf.get(i) ?? null,
              sourceSite: p.sourceSite,
              sourceUrl: p.sourceUrl,
              imageUrl: p.imageUrl,
              thumbUrl: p.thumbUrl ?? null,
              title: p.title ?? null,
              crop: p.crop,
              note: p.note ?? null,
              fromCanvasId: input.canvasId,
            })),
          );
          swipeSaved = res.added;
          swipeNote = res.full
            ? `Swipe file: saved ${res.added}; it is full (${MAX_SWIPE_ITEMS} items). Ask the user which items to remove on the library page.`
            : `Swipe file: saved ${res.added} part${res.added === 1 ? "" : "s"}${res.skipped > 0 ? `, ${res.skipped} already there` : ""}.`;
        } catch {
          console.error("[cut_parts] swipe save failed");
          swipeNote = "Swipe file: could not save the parts this time. The parts are on the canvas.";
        }
      }
      const lookResult = lookSrc
        ? await lookBlocks(
            { label: lookSrc.label, imageUrl: lookSrc.imageUrl, thumbUrl: lookSrc.thumbUrl ?? null },
            { fetchImpl: deps.fetchImpl, ...(deps.allowlist ? { allowlist: deps.allowlist() } : {}) },
          )
        : undefined;
      const out: CutPartsOutput = {
        canvasId: input.canvasId,
        parts: parts.map((p) => ({ id: p.id, role: p.role, crop: p.crop, sourceSite: p.sourceSite, sourceUrl: p.sourceUrl, guessedCrop: p.guessedCrop === true })),
        libraryCount,
        webUrl: canvasWebUrl(deps.appUrl(), input.canvasId),
        ...(swipeSaved !== undefined ? { swipeSaved } : {}),
        ...(lookResult?.ok && input.look ? { look: { ...input.look, width: lookResult.width, height: lookResult.height, size: lookResult.size } } : {}),
      };
      const pct = (n: number) => Math.round(n * 100);
      const lines = cuts.length > 0 ? [`Cut ${parts.length} part${parts.length === 1 ? "" : "s"} for Frankenstein pages (library: ${out.libraryCount} of ${MAX_PARTS}).`] : [];
      for (const p of parts) {
        lines.push(
          `- ${p.id}: ${p.role} from ${p.sourceSite} ${p.sourceUrl}, crop x ${pct(p.crop.x)}% y ${pct(p.crop.y)}% w ${pct(p.crop.w)}% h ${pct(p.crop.h)}%${p.guessedCrop ? " (guessed crop)" : ""}`,
        );
      }
      if (parts.some((p) => p.guessedCrop)) {
        // The page anatomy behind the guesses: its section roles, top to bottom (P1-I7).
        for (const page of usedPages.values()) {
          const roles = [...new Set(page.sections.map((s) => s.role))];
          lines.push(`Guessed bands follow the ${page.id} page anatomy (Banana Atlas). Its sections top to bottom: ${roles.join(", ")}. Use these roles, in this order, for the recipe.`);
        }
        // Honest about what nobody saw: a guess is not a look.
        lines.push(
          "Guessed crops are a band picked by role and image shape; nobody looked at the image. To cut exactly, call cut_parts with look on that image, then set the crop from what you see (update_frankenstein op crop, or cut again), or tell the user they can adjust each one in the canvas crop editor (Edit crop on a part). Do not download the images to check.",
        );
      }
      lines.push(cuts.length > 0 ? "Next: frankenstein_page with rows of part ids, or a recipe of roles." : "Next: cut_parts with cuts, each with a crop measured on the image below.");
      if (swipeNote) lines.push(swipeNote);
      lines.push(`Web link: ${out.webUrl}`);
      const content: McpContent[] = [{ type: "text", text: lines.join("\n") }, ...(lookResult?.blocks ?? [])];
      return { content, structuredContent: out as unknown as Record<string, unknown> };
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
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
