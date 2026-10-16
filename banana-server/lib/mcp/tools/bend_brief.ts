import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { bendBrief, bendInputSchema, formatDirections, parseBendInput, type BendResult } from "@/lib/bend";
import { mutateCanvas, parseState } from "@/lib/canvas/store";
import type { CanvasRecord } from "@/lib/db/types";
import type { DirectionDetail } from "@/lib/direction-detail";
import { globalLearningOn, K_ANON } from "@/lib/learning/arms";
import { ingredientWeights } from "@/lib/learning/directions";
import { directionTermKey } from "@/lib/learning/terms";
import { inspirationFromQuery } from "@/lib/bend/queries";
import { PART_ROLES, isPartRole, type PartRole } from "@/lib/stitch/types";
import { directionStyleIds } from "@/lib/styles/directions";
import { cleanTaste } from "@/lib/taste";
import { EMPTY_TASTE, withProfileFallback, type UserTasteProfile } from "@/lib/taste-profile";
import { createDbTasteStore } from "@/lib/taste-profile/store";
import { bendBriefAtlas, BEND_SHARD_BUDGET } from "@/lib/atlas/bend";
import { liveAtlasLoader } from "@/lib/atlas/live";
import { loaderSource, type AtlasSource } from "@/lib/atlas/source";
import { readAtlasLearning } from "@/lib/atlas/learning";
import { loadTypePairs } from "@/lib/atlas/wiring";
import type { TypePair } from "@/lib/atlas/types";
import { buildArabicPack } from "@/lib/arabic";
import { lookAtUpload, type UploadLookDeps } from "@/lib/uploads/look";
import { liveCanvasDeps, plausibleId, takedownLoader, tasteInputSchema, type CanvasToolDeps } from "./canvas-shared";
import { lenient, toolMessage, type RegisterTool, type ToolResult } from "./types";

export const BEND_BRIEF_DESCRIPTION =
  "Turn a design brief into wild directions for one wild page or two, not the product's main design. " +
  "Each has a short title, a mechanic (the UI part the idea becomes), a twist, a visual spec, art queries and a prompt. " +
  "Wildness runs from 1 (Fresh) to 5 (Bananas). " +
  "Without pages it returns wildSpots: where weirdness pays off. " +
  "Pass canvasId to save them, then call search_references with a direction id. " +
  "Optional: taste (style words), mustKeep, brand, fromUpload (a screenshot of their own page).";

/** Parts a screenshot may list. */
export const MAX_UPLOAD_ROLES = 12;

/** Advertised input: the bend schema plus an optional canvas to save the directions to. */
export const inputSchema = bendInputSchema.extend({
  canvasId: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe("Canvas from open_canvas. Saves the directions there so search_references can take a directionId."),
  taste: tasteInputSchema.optional(),
  fromUpload: z
    .object({
      uploadId: z.string().min(1).max(100).describe("The user's own screenshot, from their uploads."),
      roles: z.array(z.string().trim().min(1).max(30)).min(1).max(MAX_UPLOAD_ROLES).optional().describe("The page's parts, top to bottom, as stitch roles (nav, hero, features...). Read them from the screenshot."),
    })
    .optional()
    .describe("Bend the user's own page: their uploaded screenshot becomes the baseline."),
});

/**
 * Advertise the strict JSON schema to clients, but let every call through to the
 * handler so invalid input gets a plain message instead of the SDK's raw validation dump.
 */
const advertisedInput: StandardSchemaWithJSON<unknown, unknown> = lenient(inputSchema);

export type BendBriefDeps = Pick<CanvasToolDeps, "repos"> & {
  /** The user's uploads (VAL-02). Left out in tests that do not use fromUpload. */
  uploads?(): Promise<UploadLookDeps>;
  /** GLOBAL_LEARNING: false means only the user's own direction ratings steer their bends. Default true. */
  globalLearning?(): boolean;
  /** The user's taste profile (P2-02). Only fills the taste lane when the call and the canvas gave no words. */
  tasteProfile?(userId: string): Promise<UserTasteProfile>;
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

/** The detail saved with a direction (directions.detail). The verdict stays with rate_directions. */
export function directionDetail(
  d: BendResult["directions"][number],
  wildness: number,
  brief?: string,
  atlas?: BendResult["atlas"],
  /** Pass to save the Arabic-first pack (VAL-08) with the direction; `pairs` are the J12 pairs (null: the voice's fonts). */
  arabic?: { pairs: readonly TypePair[] | null },
): DirectionDetail {
  const detail: DirectionDetail = {
    ...(brief ? { brief } : {}),
    platform: d.platform,
    pages: d.pages,
    spec: d.spec,
    artQueries: d.artQueries,
    twist: d.twist,
    prompt: d.prompt,
    wildness,
    mechanic: d.mechanic,
    ...(d.cardIds
      ? {
          atlas: {
            cardIds: d.cardIds,
            ...(d.mechanicId ? { mechanicId: d.mechanicId } : {}),
            recipeIds: d.recipeIds ?? [],
            ...(d.shaderIds?.length ? { shaderIds: d.shaderIds } : {}),
            ...(d.motionIds?.length ? { motionIds: d.motionIds } : {}),
            ...(atlas ? { pageId: atlas.pageId, domainId: atlas.domainId, productNoun: atlas.productNoun } : {}),
            ...(atlas?.searchTopic ? { searchTopic: atlas.searchTopic } : {}),
            ...(atlas?.avoidWords?.length ? { avoidWords: atlas.avoidWords } : {}),
          },
        }
      : {}),
  };
  if (arabic) detail.arabic = buildArabicPack({ seed: d.id, detail, brief, pairs: arabic.pairs });
  return detail;
}

/** The style line of a bend: each direction's style id, and the asked style when there is one. */
export function styleLines(directions: readonly { id: string; title: string }[], ids: readonly string[], asked: readonly string[]): string {
  const list = directions.map((d, i) => `${d.id} ${ids[i]}`).join("; ");
  const lead = asked.length > 0 ? ` The brief asks for ${asked[0]}: at least 60% of each board is it or its neighbour.` : "";
  return `Styles (one per direction, never shared; read docs/styles/<id>/STYLE.md through the gobanana-taste skill): ${list}.${lead}`;
}

export const UPLOAD_NOT_FOUND =
  "That upload was not found in your uploads. Upload the screenshot on your canvas first (Pro), or attach it to the chat and list its parts yourself.";

/** The baseline line for a screenshot of the user's own page. Roles are the stitch part roles. */
export function baselineLine(roles: readonly PartRole[]): string {
  return (
    `Baseline (the user's own page, top to bottom): ${roles.join(", ")}. ` +
    "Bend this page, not a generic one: keep these parts as the baseline and change one or two. Put this line on the board as a note."
  );
}

type FromUpload = { uploadId: string; roles?: PartRole[]; unknownRoles: string[] };

/** Validate fromUpload: an id, and roles that are stitch part roles (others are listed, not used). */
function parseFromUpload(raw: unknown): { ok: true; value?: FromUpload } | { ok: false; message: string } {
  if (raw === undefined) return { ok: true };
  const bad = { ok: false as const, message: `fromUpload needs an uploadId, and up to ${MAX_UPLOAD_ROLES} roles from: ${PART_ROLES.join(", ")}.` };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return bad;
  const { uploadId, roles } = raw as { uploadId?: unknown; roles?: unknown };
  if (typeof uploadId !== "string" || uploadId.length < 1 || uploadId.length > 100) return bad;
  if (roles === undefined) return { ok: true, value: { uploadId, unknownRoles: [] } };
  if (!Array.isArray(roles) || roles.length < 1 || roles.length > MAX_UPLOAD_ROLES || roles.some((r) => typeof r !== "string")) return bad;
  const clean = (roles as string[]).map((r) => r.trim().toLowerCase());
  const known = clean.filter(isPartRole);
  const unknownRoles = [...new Set(clean.filter((r) => !isPartRole(r)))];
  return { ok: true, value: { uploadId, ...(known.length > 0 ? { roles: known } : {}), unknownRoles } };
}

/** Save directions (and new taste words) on the user's canvas. */
async function saveDirections(
  deps: BendBriefDeps,
  userId: string,
  canvas: CanvasRecord,
  result: BendResult,
  newTaste: string[],
  pairs: readonly TypePair[] | null = null,
  styleIds: readonly string[] = [],
): Promise<boolean> {
  const canvasId = canvas.id;
  await deps.repos.directions.upsertMany(
    canvasId,
    result.directions.map((d, i) => ({
      bendId: d.id,
      move: d.move,
      title: d.title,
      searchQuery: d.searchQuery,
      detail: { ...directionDetail(d, result.wildness, result.brief, result.atlas, { pairs }), ...(styleIds[i] ? { styleId: styleIds[i] } : {}) },
    })),
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

/** Which bend engine runs (BEND_ENGINE) and where the Atlas engine reads its shards. */
export type BendEngineDeps = {
  /** "atlas" tries the Atlas engine first; anything else runs the word lists. */
  mode(): string | undefined;
  /** The Atlas for this call, or null when there is none (empty manifest, no binding). */
  source(): AtlasSource | null;
};

/** BEND_ENGINE=atlas|lists (default lists until Gate 2). */
export function bendEngineMode(value: string | undefined): "atlas" | "lists" {
  return value?.trim().toLowerCase() === "atlas" ? "atlas" : "lists";
}

/**
 * Handler logic. `getDeps` is only called for a signed-in user (direction stats, and the canvas
 * when a canvasId is passed); anonymous bends never touch the database. With `engine` in atlas
 * mode the Atlas engine runs first; whenever it cannot answer, the word lists do (same output shape).
 */
export function createBendBriefTool(getDeps: () => BendBriefDeps, engine?: BendEngineDeps) {
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
    const fromUpload = parseFromUpload((args as { fromUpload?: unknown }).fromUpload);
    if (!fromUpload.ok) return toolMessage(fromUpload.message);
    if (fromUpload.value && !userId) return toolMessage("You are not signed in. Reconnect to sign in again.");

    // VAL-02: the screenshot must be the caller's own upload. The agent reads its parts (roles).
    let look: Awaited<ReturnType<typeof lookAtUpload>> | undefined;
    if (fromUpload.value && userId) {
      try {
        const uploads = await getDeps().uploads?.();
        look = uploads ? await lookAtUpload(uploads, userId, fromUpload.value.uploadId) : { ok: false, reason: "unavailable" };
      } catch {
        console.error("[bend_brief] could not check the upload");
        look = { ok: false, reason: "unavailable" };
      }
      if (!look.ok) return toolMessage(look.reason === "not_found" ? UPLOAD_NOT_FOUND : "Could not read your uploads right now. Try again in a minute.");
    }

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
    // The profile is read once: the taste lane fallback and the Atlas tie breaker share it.
    let profile: Promise<UserTasteProfile> | undefined;
    const readProfile = (id: string) =>
      (profile ??= Promise.resolve()
        .then(() => getDeps().tasteProfile?.(id) ?? EMPTY_TASTE)
        .catch(() => EMPTY_TASTE));
    const taste = await withProfileFallback(readProfile, userId, newTaste.length > 0 ? newTaste : cleanTaste(canvas ? parseState(canvas.state).taste : undefined));

    const ingredientWeights = await readWeights(getDeps, userId, canvasId);
    const bendInput = { ...parsed.input, ...(taste.length > 0 ? { taste } : {}) };
    let result: BendResult | null = null;
    if (engine && bendEngineMode(engine.mode()) === "atlas") {
      try {
        const source = engine.source();
        if (source) {
          // Atlas learning (nightly weights plus the user's own ratings) and the taste profile as
          // a tie breaker; both fail open, so a missing table or profile changes nothing.
          const learning = userId
            ? await Promise.resolve()
                .then(() => readAtlasLearning(getDeps().repos.feedback, userId, getDeps().globalLearning?.() ?? true))
                .catch(() => null)
            : null;
          const tasteTarget = userId ? await readProfile(userId) : null;
          result = await bendBriefAtlas(bendInput, source, { ingredientWeights, learning, taste: tasteTarget });
        } else {
          result = null;
        }
      } catch {
        console.error("[bend_brief] the Atlas engine failed, using the word lists");
        result = null;
      }
    }
    if (!result) {
      try {
        result = bendBrief(bendInput, { ingredientWeights });
      } catch {
        return toolMessage("Could not bend that brief. Try a shorter brief in plain words.");
      }
    }

    // Each direction names its style id, none shared (docs/styles, diversity rule 5).
    const styled = directionStyleIds(result.directions, { brief: result.brief, taste, platform: result.platform });
    let text = `${formatDirections(result)}
${styleLines(result.directions, styled.ids, styled.asked)}`;
    let saved = false;
    if (canvasId && userId) {
      try {
        if (reachable && canvas) {
          // J12 Arabic type pairs for the directions' voices; none (or no Atlas) means the voice's fonts.
          const pairs = await loadTypePairs(engine?.source() ?? null, result.directions.map((d) => ({ detail: { spec: d.spec } as DirectionDetail }))).catch(() => null);
          saved = await saveDirections(getDeps(), userId, canvas, result, newTaste, pairs, styled.ids);
        } else {
          saved = false;
        }
      } catch {
        console.error("[bend_brief] could not save directions");
        saved = false;
      }
      text += saved
        ? `\nSaved to canvas ${canvasId}. Pass a direction id as directionId (with this canvasId) to search_references.`
        : "\nThe directions were not saved: that canvas was not found or could not be reached. Pass a direction's search text as query to search_references instead.";
    } else {
      // Without a canvas nothing is kept: get_canvas shows 0 directions and search_references
      // cannot take these ids. Say so, and point at reusing a board rather than starting another.
      text +=
        "\nNot saved: no canvasId was passed, so no board lists these directions and search_references cannot take their ids. " +
        "To keep them, call bend_brief again with the same brief and a canvasId. To find a board for this brief, call get_canvas without a canvasId and reuse it instead of starting a new one.";
    }
    const blocks: ToolResult["content"] = [{ type: "text" as const, text }];
    let baseline: Record<string, unknown> | undefined;
    if (fromUpload.value && look?.ok) {
      const { uploadId, roles, unknownRoles } = fromUpload.value;
      if (roles) {
        const line = baselineLine(roles);
        baseline = { source: "upload", uploadId, roles, line };
        blocks[0] = {
          type: "text" as const,
          text: `${text}\n${line}${unknownRoles.length > 0 ? `\nLeft out, not stitch roles: ${unknownRoles.join(", ")}. Use only: ${PART_ROLES.join(", ")}.` : ""}`,
        };
      } else {
        baseline = { source: "upload", uploadId };
        const seen = look.data
          ? "The screenshot is the image below."
          : "The screenshot is too big to show here (over 1.5 MB), so ask the user to attach it to the chat.";
        blocks[0] = {
          type: "text" as const,
          text:
            `${text}\nYour own page: ${seen} Read its parts top to bottom using only these roles: ${PART_ROLES.join(", ")} (the Frankenstein part roles; there is no page anatomy data yet). ` +
            "Then call bend_brief again with the same arguments plus fromUpload.roles, which writes the baseline line. The screenshot is the user's own file; it is not stored or copied anywhere.",
        };
        if (look.data) (blocks as unknown[]).push({ type: "image", data: look.data, mimeType: look.mime });
      }
    }
    return {
      content: blocks,
      structuredContent: {
        ...result,
        directions: result.directions.map((d, i) => ({ ...d, styleId: styled.ids[i] })),
        ...(canvasId ? { canvasId, saved } : {}),
        ...(baseline ? { baseline } : {}),
      },
    };
  };
}

let liveTool: ReturnType<typeof createBendBriefTool> | undefined;
let tasteStore: ReturnType<typeof createDbTasteStore> | undefined;
const liveTasteStore = () => (tasteStore ??= createDbTasteStore());

/** Live deps; `repos` stays lazy so a missing DATABASE_URL only fails the parts that need it. */
function liveBendDeps(): BendBriefDeps {
  const canvas = liveCanvasDeps();
  return {
    get repos() {
      return canvas.repos;
    },
    globalLearning: () => globalLearningOn(process.env.GLOBAL_LEARNING),
    tasteProfile: (userId) => liveTasteStore().get(userId),
    uploads: async () => {
      const [{ createDbUploadRepo }, { getUploadsBucket }] = await Promise.all([import("@/lib/uploads/db"), import("@/lib/uploads/bucket")]);
      return { repo: createDbUploadRepo(), bucket: getUploadsBucket };
    },
  };
}

/** Live engine: BEND_ENGINE and the R2 Atlas, read per call. */
const liveEngine: BendEngineDeps = {
  mode: () => process.env.BEND_ENGINE,
  source: () => {
    const loader = liveAtlasLoader(BEND_SHARD_BUDGET);
    return loader ? loaderSource(loader) : null;
  },
};

export const register: RegisterTool = (server) => {
  server.registerTool(
    "bend_brief",
    {
      title: "Bend a design brief",
      description: BEND_BRIEF_DESCRIPTION,
      inputSchema: advertisedInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args, ctx) => {
      liveTool ??= createBendBriefTool(liveBendDeps, liveEngine);
      return liveTool(args, authExtra(ctx)?.userId);
    },
  );
};
