/**
 * `search_references` (spec section 6): web image search for a bend direction or a query.
 *
 * Thin layer: parse input, check quota, call the web_search adapter, optionally put
 * results in a canvas tray. Everything that needs the database comes in through
 * `SearchReferencesDeps`, so this file never imports `db/` and tests run without it.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { canvasSourceUrls, mutateCanvas, parseState } from "@/lib/canvas/store";
import type { ArmStatRow, Repos, SavedReference } from "@/lib/db/types";
import { canSpendCredits, checkSearchQuota, serperCreditCap, type Plan, type UsageStore } from "@/lib/quota";
import { directionTasteVariants, inspirationFromQuery, isArabicBrief, laneTexts } from "@/lib/bend/queries";
import type { DirectionDetail } from "@/lib/direction-detail";
import {
  agentArm,
  builtInArms,
  defaultArm,
  globalLearningOn,
  pickArm,
  planLane,
  planWithArms,
  type ArmVariants,
} from "@/lib/learning/arms";
import { preferredCreators, type CreatorRating } from "@/lib/learning/creator";
import { queryWords, termKey } from "@/lib/learning/terms";
import { pickGalleries } from "@/lib/sources/registry";
import { BASELINE_LANE, baselineKey, deepenBaseline, isFreshBaseline, POOL_LANES, poolOf, sentKey, takeFromPool, withoutBaselineLane, withoutSent, withPoolShare, withSent, type CanvasBaseline } from "@/lib/sources/baseline";
import { writeSearchTray } from "@/lib/sources/tray";
import { ART_SITES, artQuota, artWords, bridgeHead, byZone, forceUi, hasUiLanes, laneValue, planRequests, type LaneTexts, type PlannedRequest } from "@/lib/sources/plan";
import { buildSourceQuery, cleanQuery } from "@/lib/sources/query";
import {
  DEFAULT_SOURCES,
  LANE_NAMES,
  MIXES,
  SOURCE_SITES,
  ZONE_INPUTS,
  sourceZoneOk,
  type LaneName,
  type Mix,
  type Reference,
  type SourceSite,
  type Zone,
  type ZoneInput,
} from "@/lib/sources/types";
import { cleanTaste } from "@/lib/taste";
import {
  MAX_X_POSTS,
  SERPER_MAX_REQUESTS,
  capByCreator,
  countNote,
  createWebSearchAdapter,
  itemKey,
  sumWhy,
  type DropWhy,
  type WebSearchAdapter,
  type WebSearchResult,
} from "@/lib/sources/web-search";
import { compileTakedowns, type TakedownMatcher } from "@/lib/takedown";
import { atlasSearchPlan, provenanceFor, SEARCH_SHARD_BUDGET, type AtlasIds, type AtlasPlan } from "@/lib/atlas/search";
import { liveAtlasLoader } from "@/lib/atlas/live";
import { loaderSource, type AtlasSource } from "@/lib/atlas/source";
import { readAtlasLearning, type AtlasLearning } from "@/lib/atlas/learning";
import { briefMarket } from "@/lib/bend/market";
import { allowlistFromEnv, isAllowedImageUrl } from "@/lib/sources/allowlist";
import { getConfig } from "@/lib/config";
import { getRepos } from "@/lib/db";
import { plausibleId, takedownLoader, tasteInputSchema, upgradeUrl } from "./canvas-shared";
import { UNTRUSTED_NOTE, webTitle } from "@/lib/mcp/untrusted";
import { lenient, toolMessage, type RegisterTool } from "./types";
import { searchWithThumbs } from "@/lib/vision/wrap";

export const TOOL_NAME = "search_references";

export const TOOL_DESCRIPTION =
  "Find design references for a bend direction or a query. Results come in two zones: " +
  "UI references (real screens, pages and components, worded for the platform) and art direction (the direction's wild idea as images, from Pinterest, Behance and art galleries). " +
  "Show both, but place art results in the art row of the direction, never among the UI references. " +
  "UI is the main grid of a board: per direction place 6 to 8 UI references and only 2 to 4 art items; when fewer than 6 UI results are good, search a UI lane again with better words before placing. " +
  "Every result links to its source: always show the source link next to the image. " +
  "Pass a directionId from bend_brief, or a query. zone picks ui, art or both (default both for a directionId, ui for a query). " +
  "Pass canvasId to add the results to that canvas tray. " +
  "Pass taste with a few style words for the look the user likes, such as minimal, glassmorphism, dark mode, big typography; it is saved on the canvas. " +
  "To redo one lane with better words, pass directionId, lane and query (lane art takes raw words, no UI words). " +
  "Rate results with rate_references so later searches improve. mix is ignored. " +
  "The result carries a small thumbnail of up to 12 results (thumbs: false to skip): rate and note from the thumbnails, not the titles.";

export const inputSchema = z.object({
  directionId: z.string().min(1).max(100).optional(),
  query: z.string().trim().min(1).max(300).optional(),
  sources: z.array(z.enum(SOURCE_SITES)).min(1).max(4).optional(),
  count: z.number().int().min(4).max(24).default(12),
  canvasId: z.string().min(1).max(100).optional(),
  taste: tasteInputSchema.optional(),
  lane: z
    .enum(LANE_NAMES)
    .optional()
    .describe('With directionId and query: search only this lane of the direction, with the query as its words ("app ui" is added to UI lanes when they name no UI; art takes the words as is).'),
  zone: z
    .enum(ZONE_INPUTS)
    .optional()
    .describe('"ui" for UI references, "art" for art direction (the wild idea as images), "both" (default for a directionId; a query defaults to "ui").'),
  mix: z.enum(MIXES).optional().describe("Ignored. Kept so older calls still work."),
  thumbs: z.boolean().optional().describe("Show a small thumbnail of each result (up to 12). Default true."),
});

export type SearchReferencesInput = z.input<typeof inputSchema>;

export type Direction = {
  id: string;
  searchQuery: string;
  canvasId?: string | null;
  /** Stable bend_brief id, when the direction came from bend_brief. */
  bendId?: string | null;
  /** Brief of the canvas the direction is on. Feeds the taste and fidelity lanes. */
  brief?: string | null;
  /**
   * The canvas's own brief when `brief` is the shorter brief bend_brief was given. Its market
   * (Arabic, right to left) still applies to the direction's lanes.
   */
  canvasBrief?: string | null;
  /** Style words saved on that canvas (lib/taste.ts), if any. */
  taste?: readonly string[] | null;
  /** Wild directions v2 detail (directions.detail): platform, style words, art queries. */
  detail?: DirectionDetail | null;
};


export type SearchReferencesDeps = {
  adapter: Pick<WebSearchAdapter, "run" | "runPlan">;
  usage: UsageStore;
  getPlan(userId: string): Promise<Plan>;
  /**
   * Direction on one of the user's canvases, by row id or bend_brief id, or null.
   * `canvasId` narrows the lookup when the call names a canvas.
   */
  getDirection(userId: string, directionId: string, canvasId?: string): Promise<Direction | null>;
  /**
   * Save references (URLs and metadata only) and put them in the canvas tray, tagged with
   * the direction they were found for. Returns false when the canvas is not the user's.
   * With `opts.baseline`, the baseline's results go in with no direction and the baseline is
   * saved on the canvas (lib/sources/baseline.ts). With a directionId, results already on the
   * canvas for anything else are not added; their ids come back in `dropped` (lib/sources/tray.ts).
   */
  addToTray(
    userId: string,
    canvasId: string,
    references: SavedReference[],
    directionId?: string,
    opts?: { baseline?: CanvasBaseline },
  ): Promise<boolean | { dropped: string[] }>;
  /** The canvas's saved baseline search, or null. A failure runs the baseline lane again. */
  getBaseline?(userId: string, canvasId: string): Promise<CanvasBaseline | null>;
  /** Save style words on the user's canvas for later searches. Returns false when it is not theirs. */
  saveTaste?(userId: string, canvasId: string, taste: string[]): Promise<boolean>;
  /**
   * Source links already on the user's canvas (tray and board), or [] when it is not theirs. Used
   * to skip repeats, so two directions on one canvas never show the same references.
   */
  getCanvasSourceUrls?(userId: string, canvasId: string): Promise<string[]>;
  /**
   * What the user taught search with rate_references: blocked item keys (never shown again) and
   * their ratings of results with a known creator. A failure fails the search (blocked stays blocked).
   */
  getUserLearning?(userId: string): Promise<{ blocked: string[]; creatorRatings: CreatorRating[] }>;
  /** Ratings per term key and arm (lib/db/feedback.ts). A failure falls back to the default arms. */
  getArmStats?(userId: string, termKeys: string[]): Promise<ArmStatRow[]>;
  /** GLOBAL_LEARNING: false means only the user's own ratings steer their searches. Default true. */
  globalLearning?(): boolean;
  /** SERPER_MONTHLY_CREDIT_CAP: most Serper credits all users may spend in a month, or null for no cap. */
  creditCap?(): number | null;
  upgradeUrl(): string;
  now?(): Date;
  /** Search plan v2 (P1-I3): the Atlas for this call, or null (no Atlas: the Phase 0 lanes run). */
  atlasSource?(): AtlasSource | null;
  /** Atlas learning for recipe draws (W2): nightly weights plus the user's own ratings. Fails open. */
  atlasLearning?(userId: string): Promise<AtlasLearning>;
  /** Image host check for CC0 index results (the image host allowlist). Missing: none are shown. */
  allowImage?(url: string): boolean;
  /** Takedown list for results that skip the search adapter (CC0 index). Missing or failing: none are shown. */
  loadTakedowns?(): Promise<TakedownMatcher>;
};

/**
 * CC0 index results join the art zone: UI first, then CC0, then the web art results. Over `count`,
 * web art results go first, then the tail.
 */
export function mergeCc0(refs: readonly Reference[], cc0: readonly Reference[], count: number): Reference[] {
  const ui = refs.filter((r) => r.zone !== "art");
  const art = refs.filter((r) => r.zone === "art");
  const keepArt = Math.max(0, Math.min(art.length, count - ui.length - cc0.length));
  return [...ui, ...cc0, ...art.slice(0, keepArt)].slice(0, Math.max(count, ui.length));
}

export type SearchReferencesOutput = {
  query: string;
  /** What was searched, in order (direction searches: each request's query with its site operator). */
  queries: string[];
  /** Direction searches only: the plain words of each lane. */
  lanes?: LaneTexts;
  /** Direction searches only: the arm (wording) each lane used (lib/learning/arms.ts). */
  arms?: Partial<Record<LaneName, string>>;
  /** Direction searches only: true when ratings steered a lane away from its default wording. */
  learned?: boolean;
  /** Lane-only re-search: the lane that was searched. */
  lane?: LaneName;
  /** Zones this search filled ("both", "ui" or "art"). */
  zone: ZoneInput;
  /** Results per zone. */
  zones: Record<Zone, number>;
  /** Kept for older clients; always "ui". */
  mix: Mix;
  sources: SourceSite[];
  references: Reference[];
  note?: string;
  /** Results dropped as list pages or low quality. */
  dropped?: number;
  /** Of those, the ones dropped as another tradition (lens), as music and merch, or as shop listings (art). */
  droppedWhy?: DropWhy;
  /**
   * X post links the search provider returned as result pages (never references: no image is
   * kept). Place one with add_to_canvas { type: "xpost", url }; the canvas shows X's own embed.
   */
  xPosts?: string[];
  /**
   * Direction searches on a canvas: the baseline (fidelity) lane, run once per canvas. `reused`
   * means it was skipped because it already ran; its results are in the tray with no direction.
   */
  baseline?: { referenceIds: string[]; at: string; reused: boolean };
  /** Direction results not added because another direction (or the baseline) on the canvas has them. */
  droppedShared?: number;
  /** The one extra UI request run because the direction had fewer than MIN_DIRECTION_UI UI results left. */
  extraLane?: { lane: LaneName; query: string };
  /** Style words given in this call, and whether they were saved on the canvas. */
  taste?: string[];
  tasteSaved?: boolean;
  canvasId?: string;
  addedToTray: boolean;
};

export type SearchReferencesResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/**
 * One line on results the lens and junk filters dropped, so the agent can rephrase, or "" when none
 * were dropped for a reason it can act on.
 */
export function dropLine(why: DropWhy | undefined): string {
  const parts: string[] = [];
  if (why?.lens) parts.push(`${why.lens} from a look-alike tradition (the lens's excluded words, such as Egyptian tulle for talli)`);
  if (why?.offTopic) parts.push(`${why.offTopic} art results about music, bands, tours or merch`);
  if (why?.junk) parts.push(`${why.junk} art results that were shop, stock or product listings`);
  if (parts.length === 0) return "";
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
  return `Dropped ${list}. If too few are left, rephrase as subject, medium and composition ("talli braid sleeve trim close-up").`;
}

/** X post links found, as one line the agent can act on, or "" when none. Links only: no picture, no text. */
export function xPostLine(xPosts: readonly string[] | undefined): string {
  if (!xPosts?.length) return "";
  return `X posts found (links only, no image): ${xPosts.join(" ")}. To use one, add_to_canvas { type: "xpost", url }: the canvas shows X's own embed.`;
}

function resultText(out: SearchReferencesOutput): string {
  const text = resultBody(out);
  const x = xPostLine(out.xPosts);
  return x ? `${text}
${x}` : text;
}

function resultBody(out: SearchReferencesOutput): string {
  const lines: string[] = [];
  const drops = dropLine(out.droppedWhy);
  if (out.references.length === 0) {
    lines.push(out.note ?? "No references found.");
    if (drops) lines.push(drops);
    return lines.join("\n");
  }
  const searched = out.lane ? `the ${out.lane} lane "${out.query}"` : `"${out.query}"`;
  lines.push(`Found ${out.zones.ui} UI references and ${out.zones.art} art direction references for ${searched}. Show each source link with its image.`);
  // Fresh baseline results are listed on their own: they go to the "Shipped today" section.
  const shipped = new Set(out.baseline && !out.baseline.reused ? out.baseline.referenceIds : []);
  let n = 0;
  const list = (zone: Zone | "shipped", heading: string) => {
    const refs = out.references.filter((r) =>
      zone === "shipped" ? shipped.has(r.id) : (r.zone ?? "ui") === zone && !shipped.has(r.id),
    );
    if (refs.length === 0) return;
    lines.push(heading);
    for (const r of refs) {
      const tag = r.lane ? `${r.id}, ${r.lane}` : r.id;
      lines.push(`${++n}. [${tag}] ${webTitle(r.title)} (${r.sourceSite}, ${zone === "shipped" ? "ui" : zone}): ${r.sourceUrl}`);
    }
  };
  list("ui", "UI references:");
  list("art", "Art direction (place these in the art row, not with the UI references):");
  list("shipped", 'Shipped today (the page as apps ship it, found once per canvas): place these in one "Shipped today" section, never in a direction:');
  const directionUi = out.zones.ui - shipped.size;
  if (out.zones.art > 0 || directionUi > 0) {
    lines.push(
      directionUi < 6
        ? `Place 6 to 8 UI references per direction and at most 4 art items. Only ${directionUi} UI came back for this direction: search a UI lane (component, bridge or taste) with other words first, so art does not outnumber UI.`
        : "Place 6 to 8 UI references per direction and at most 4 art items: UI is the main grid, art is the accent row.",
    );
  }
  if (out.baseline?.reused) {
    lines.push(
      `The baseline lane (fidelity) already ran for this canvas on ${out.baseline.at.slice(0, 10)}, so it was skipped, as was every search another direction on this canvas already sent (their results are in the tray already).${out.baseline.referenceIds.length > 0 ? ` Its ${out.baseline.referenceIds.length} results are in the tray with no direction; place the good ones once in the "Shipped today" section: ${out.baseline.referenceIds.join(", ")}.` : ""}`,
    );
  }
  // The bridge is the direction's own UI lane: say so when it found nothing, with a retry that works.
  if (!out.lane && out.lanes?.bridge && out.zones.ui > 0 && !out.references.some((r) => r.lane === "bridge")) {
    lines.push(
      `No UI shot named this direction's idea (${out.lanes.idea}), so the UI above is for the brief only. ` +
        `For UI that carries the idea, redo the bridge lane with 2 or 3 words for its pattern or material and the screen, for example lane "bridge" and query "${retryExample(out.lanes)}", or a broader word for the same pattern or material ("islamic pattern app") if that finds nothing.`,
    );
  }
  if (out.droppedShared) {
    lines.push(`Left out ${out.droppedShared} results that another direction on this canvas already has: each result belongs to one direction.`);
  }
  if (out.extraLane) lines.push(`Searched one more UI request (${out.extraLane.lane} "${out.extraLane.query}") to fill this direction.`);
  if (out.note) lines.push(out.note);
  if (drops) lines.push(drops);
  if (out.addedToTray && out.canvasId) lines.push(`Added to the tray of canvas ${out.canvasId}.`);
  if (out.learned) lines.push("Some lanes used wording that rated better before.");
  lines.push("Rate standouts and misses with rate_references (ids in brackets).", UNTRUSTED_NOTE);
  return lines.join("\n");
}

/** A short bridge retry for the steering line: the idea's head word, "pattern" and the surface ("rawashin pattern app"). */
function retryExample(lanes: LaneTexts): string {
  const head = bridgeHead(lanes.idea) ?? lanes.idea;
  const surface = lanes.platform === "website" ? "website" : lanes.platform === "webapp" ? "dashboard" : "app";
  return `${head} pattern ${surface}`;
}

/**
 * Lane words for a saved direction (lib/bend/queries.ts). The idea comes from the stored search
 * text (older directions stored a stacked query; the lead ingredient is pulled out of it). The UI
 * lanes come from the canvas brief, worded for the direction's platform (its detail, else the
 * brief's words); the taste lane uses the user's taste, else the direction's style words, never a
 * default. The art lane searches the direction's art queries, else its idea, raw.
 */
export function directionLanes(direction: Direction, taste: readonly string[]): LaneTexts {
  const detail = direction.detail ?? undefined;
  const idea = inspirationFromQuery(direction.searchQuery);
  // A bend brief cut to the screen ("flight checkout screen for a GCC travel OTA") loses the board's
  // "EN + AR/RTL": the locale lane follows the canvas brief too (field report, 2026-10-12).
  const brief =
    direction.brief && direction.canvasBrief && isArabicBrief(direction.canvasBrief) && !isArabicBrief(direction.brief)
      ? `${direction.brief}, Arabic RTL`
      : direction.brief;
  const lanes = laneTexts(brief, idea, taste, direction.bendId ?? direction.id, {
    ...(detail?.platform ? { platform: detail.platform } : {}),
    ...(detail?.spec?.styleWords?.length ? { styleWords: detail.spec.styleWords } : {}),
    ...(detail?.pages?.length ? { pages: detail.pages } : {}),
    ...(detail?.mechanic?.element ? { mechanic: detail.mechanic.element } : {}),
  });
  const art = (detail?.artQueries ?? []).map(artWords).filter(Boolean);
  const fallback = artWords(idea);
  if (art.length > 0) lanes.art = art.slice(0, 3);
  else if (fallback) lanes.art = [fallback];
  // Art galleries follow what the art queries name ("swiss poster" pulls Swissted).
  const artGalleries = pickGalleries({ key: direction.bendId ?? direction.id, artText: [...(lanes.art ?? []), idea] }).art;
  if (artGalleries.length > 0) lanes.artGalleries = artGalleries;
  else delete lanes.artGalleries;
  return lanes;
}

type Searched = {
  result: WebSearchResult;
  queries: string[];
  lanes?: LaneTexts;
  arms?: Partial<Record<LaneName, string>>;
  learned?: boolean;
  termKeys?: Partial<Record<LaneName, string>>;
  /** Direction searches: the next UI request not sent yet, and how to run it (P0-04 retry). */
  extra?: { req: PlannedRequest; run(exclude: string[]): Promise<WebSearchResult> };
};

/** A direction search that keeps fewer UI results than this runs one extra UI request. */
export const MIN_DIRECTION_UI = 6;

/**
 * The next UI request for a direction after `sent`: the first UI-only plan request not sent yet
 * (never the baseline lane), else page 2 of the first UI request sent. Requests another direction
 * already sent on the canvas (`canvasSent`, sentKey form) are never chosen. Undefined when there is none.
 */
export function nextUiRequest(
  lanes: LaneTexts,
  sent: readonly PlannedRequest[],
  sources?: readonly SourceSite[],
  canvasSent: ReadonlySet<string> = new Set(),
): PlannedRequest | undefined {
  const done = new Set([...sent.map(sentKey), ...canvasSent]);
  const ui = withoutBaselineLane(planRequests(lanes, sources, { zone: "ui" }));
  const fresh = ui.find((r) => !done.has(sentKey(r)));
  if (fresh) return fresh;
  const first = sent.find((r) => r.lane !== "art" && r.lane !== BASELINE_LANE && !canvasSent.has(sentKey(r)));
  if (!first) return undefined;
  const page2 = { ...first, page: (first.page ?? 1) + 1 };
  delete page2.fallback;
  return done.has(sentKey(page2)) ? undefined : page2;
}

/** Results per zone. */
function zoneCounts(refs: readonly Reference[]): Record<Zone, number> {
  return { ui: refs.filter((r) => r.zone !== "art").length, art: refs.filter((r) => r.zone === "art").length };
}

/** Term key of every lane a direction has (the component lanes share one: their texts joined by " + "). */
export function laneTermKeys(lanes: LaneTexts): Partial<Record<LaneName, string>> {
  const out: Partial<Record<LaneName, string>> = {};
  for (const lane of LANE_NAMES) {
    const value = laneValue(lanes, lane);
    const text = Array.isArray(value) ? value.join(" + ") : value;
    if (text) out[lane] = termKey(lane, text);
  }
  return out;
}

/** UTC day, so arm picks stay put for a user and term within a day. */
const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * One arm per lane from the ratings (lib/learning/arms.ts). Lanes with no usable ratings keep
 * the default; a stats failure keeps every default.
 */
async function pickArms(
  deps: SearchReferencesDeps,
  userId: string,
  lanes: LaneTexts,
  termKeys: Partial<Record<LaneName, string>>,
  variants: ArmVariants,
  now: Date,
): Promise<Partial<Record<LaneName, string>>> {
  const present = LANE_NAMES.filter((l) => termKeys[l]);
  const arms: Partial<Record<LaneName, string>> = Object.fromEntries(present.map((l) => [l, defaultArm(l)]));
  if (!deps.getArmStats) return arms;
  let stats: ArmStatRow[];
  try {
    stats = await deps.getArmStats(userId, present.map((l) => termKeys[l]!));
  } catch {
    console.error("[search_references] could not read arm stats");
    return arms;
  }
  const global = deps.globalLearning?.() ?? true;
  for (const lane of present) {
    arms[lane] = pickArm({
      termKey: termKeys[lane]!,
      candidates: builtInArms(lane, lanes, variants),
      stats,
      global,
      seed: `${userId}|${day(now)}`,
    }).arm;
  }
  return arms;
}

/** Handler logic, separate from MCP wiring so tests can call it directly. */
export function createSearchReferencesTool(deps: SearchReferencesDeps) {
  return async function searchReferences(
    rawInput: SearchReferencesInput,
    userId: string | undefined,
  ): Promise<SearchReferencesResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");

    // Older agents ask for the removed inspiration lane: it lives on as the art lane.
    if (rawInput && typeof rawInput === "object" && (rawInput as { lane?: unknown }).lane === "inspiration") {
      rawInput = { ...(rawInput as object), lane: "art" } as SearchReferencesInput;
    }
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return toolMessage(
        `Check the input: pass a directionId or a query (at most 300 characters), a count from 4 to 24, at most 5 short taste words, zone as ui, art or both, at most 4 sources, and lane as one of ${LANE_NAMES.join(", ")}.`,
      );
    }
    const input = parsed.data;
    if (!input.directionId && !input.query) {
      return toolMessage("Pass a directionId from bend_brief or a query.");
    }
    if (input.lane && (!input.directionId || !input.query)) {
      return toolMessage("To redo one lane, pass directionId, lane and query (the new words for that lane).");
    }
    const laneWords = input.lane ? cleanQuery(input.query!) : undefined;
    if (input.lane && !laneWords) return toolMessage("Pass a few words in query for that lane.");
    // UI lanes: the agent's words get "app ui" when they name no UI. Art and gallery lanes take them as is.
    const laneUiWords = laneWords ? (input.lane === "art" || input.lane === "gallery" ? laneWords : forceUi(laneWords)) : undefined;
    if (input.canvasId && !plausibleId(input.canvasId)) {
      return toolMessage("That canvas was not found. Call open_canvas to create one, or check the canvasId.");
    }

    const inputTaste = cleanTaste(input.taste);
    try {
      // A lane re-search uses the direction; its query is the lane's new words.
      let query = input.lane ? undefined : input.query;
      let directionKey: string | undefined;
      let directionCanvasId: string | undefined;
      let lanes: LaneTexts | undefined;
      let variants: ArmVariants = {};
      /** Atlas ids of a direction the Atlas engine made, its mechanic part and its brief (search plan v2). */
      let atlasIds: AtlasIds | undefined;
      let atlasMechanic: string | undefined;
      let atlasBrief = "";
      if (!query && input.directionId) {
        const direction = await deps.getDirection(userId, input.directionId, input.canvasId);
        if (!direction) {
          return toolMessage(
            "That direction was not found. Directions are saved only when bend_brief gets a canvasId. Pass the direction's search text as query instead.",
          );
        }
        // No DEFAULT_TASTE here: without the user's taste the direction's own style words lead.
        const taste = inputTaste.length > 0 ? inputTaste : cleanTaste(direction.taste);
        lanes = directionLanes(direction, taste);
        atlasIds = direction.detail?.atlas;
        atlasMechanic = direction.detail?.mechanic?.element;
        atlasBrief = [direction.canvasBrief, direction.brief].filter(Boolean).join(" ");
        directionKey = direction.bendId ?? direction.id;
        directionCanvasId = direction.canvasId ?? undefined;
        const v = directionTasteVariants(direction.brief, taste, directionKey, {
          ...(lanes.platform ? { platform: lanes.platform } : {}),
          ...(direction.detail?.spec?.styleWords?.length ? { styleWords: direction.detail.spec.styleWords } : {}),
        });
        variants = { ...(v.app ? { tasteApp: v.app } : {}), ...(v.core ? { tasteCore: v.core } : {}) };
        if (!hasUiLanes(lanes) && input.lane !== "art") {
          // No brief, so no UI lanes: search the direction's idea on the plain path (UI forms, gated,
          // plus the art zone when asked for).
          if (input.lane) {
            return toolMessage(
              "That direction has no lanes to redo because its canvas has no brief. Search it without lane, or pass a query.",
            );
          }
          query = lanes.idea;
          lanes = undefined;
          variants = {};
        } else if (input.lane && input.lane !== "taste" && !laneValue(lanes, input.lane)) {
          // A taste re-search is always allowed: with no taste given the direction has no taste
          // lane, and the agent's style words make one.
          const has = LANE_NAMES.filter((l) => laneValue(lanes!, l)).join(", ");
          return toolMessage(`That direction has no ${input.lane} lane. Its lanes: ${has}.`);
        }
      }
      if (!query && !lanes) return toolMessage("Pass a directionId from bend_brief or a query.");

      const now = deps.now?.() ?? new Date();
      const plan = await deps.getPlan(userId);
      const quota = await checkSearchQuota(deps.usage, userId, plan, { upgradeUrl: deps.upgradeUrl(), now });
      if (!quota.ok) return toolMessage(quota.message);
      // Global guard on provider spend (D2): checked before any request, same graceful message shape.
      const cap = deps.creditCap?.() ?? null;
      if (cap !== null) {
        const credit = canSpendCredits(await deps.usage.creditsUsed(quota.period), cap, { now });
        if (!credit.ok) return toolMessage(credit.message);
      }

      // New style words are saved on the canvas so later searches and bends reuse them.
      const tasteCanvas = input.canvasId ?? directionCanvasId;
      let tasteSaved = false;
      if (inputTaste.length > 0 && tasteCanvas && deps.saveTaste) {
        try {
          tasteSaved = await deps.saveTaste(userId, tasteCanvas, inputTaste);
        } catch {
          console.error("[search_references] could not save taste");
        }
      }

      const sources = input.sources ? SOURCE_SITES.filter((s) => input.sources!.includes(s)) : [...DEFAULT_SOURCES];
      // mix is accepted for older clients and ignored: zones replace it.
      const mix: Mix = "ui";
      // Direction searches fill both zones by default; a plain query is UI unless asked.
      const zone: ZoneInput = input.lane ? (input.lane === "art" ? "art" : "ui") : (input.zone ?? (input.directionId ? "both" : "ui"));
      const artNote =
        zone !== "ui" && input.sources && !input.sources.some((s) => sourceZoneOk(s, "art"))
          ? `Art direction searches ${ART_SITES.join(" and ")} and art galleries; add one of them to sources for art results.`
          : undefined;
      // What the user taught search: blocked items never come back, liked creators move up.
      const learning = deps.getUserLearning ? await deps.getUserLearning(userId) : { blocked: [], creatorRatings: [] };
      const preferCreators = preferredCreators(learning.creatorRatings);
      // Search plan v2 (P1-I3): a direction the Atlas engine made searches its query recipes; with
      // no Atlas or no readable recipes its Phase 0 lanes run unchanged.
      let atlasPlan: AtlasPlan | null = null;
      if (lanes && !input.lane && atlasIds && deps.atlasSource) {
        try {
          const source = deps.atlasSource();
          const atlasLearning = source && deps.atlasLearning ? await deps.atlasLearning(userId).catch(() => null) : null;
          atlasPlan = source
            ? await atlasSearchPlan(lanes, atlasIds, source, {
                ...(atlasMechanic ? { mechanic: atlasMechanic } : {}),
                market: briefMarket(atlasBrief),
                allowImage: deps.allowImage ?? (() => false),
                withArt: zone !== "ui",
                learning: atlasLearning,
              })
            : null;
        } catch {
          console.error("[search_references] could not read the Atlas recipes");
          atlasPlan = null;
        }
        if (atlasPlan) lanes = atlasPlan.lanes;
      }
      /** Source links already on the canvas: CC0 results skip them too. */
      let canvasUrls: readonly string[] = [];
      let searched: Searched;
      /** The baseline key of a direction search on a canvas, and the saved baseline when it was reused. */
      let baseline: { key: string; reused?: CanvasBaseline; sent?: string[] } | undefined;
      /** The first direction search on a board: its brief-level leftovers become the board's pool. */
      let poolLanes: readonly LaneName[] | undefined;
      /** A later direction search: its share of the board's pool. */
      let pooled: Reference[] = [];
      if (lanes) {
        const picked = input.sources ? sources : undefined;
        const termKeys = laneTermKeys(lanes);
        let plan: PlannedRequest[];
        let arms: Partial<Record<LaneName, string>> = {};
        let learned = false;
        if (input.lane) {
          // Only this lane, with the agent's words; they become an arm of the lane's term.
          arms = { [input.lane]: agentArm(laneUiWords!) };
          plan = planLane(input.lane, queryWords(laneUiWords!), picked, lanes.idea, lanes);
        } else {
          arms = await pickArms(deps, userId, lanes, termKeys, variants, deps.now?.() ?? new Date());
          learned = Object.entries(arms).some(([lane, arm]) => arm !== defaultArm(lane as LaneName));
          plan = learned ? planWithArms(lanes, arms, picked, variants, zone) : planRequests(lanes, picked, { zone });
        }
        // One path-scoped request per lane and source, at most SERPER_MAX_REQUESTS in all (fallbacks included).
        plan = plan.slice(0, SERPER_MAX_REQUESTS);
        // The baseline (fidelity) lane runs once per canvas: skip it when it ran for this key lately.
        const baseCanvas = input.canvasId ?? directionCanvasId;
        const key = input.lane ? null : baselineKey(lanes);
        if (key && baseCanvas) {
          let saved: CanvasBaseline | null = null;
          try {
            saved = (await deps.getBaseline?.(userId, baseCanvas)) ?? null;
          } catch {
            console.error("[search_references] could not read the baseline");
          }
          if (isFreshBaseline(saved, key, now)) {
            // The baseline lane and every request another direction already sent on this canvas
            // (their results are on the canvas already): no request runs twice on one board.
            const before = withoutBaselineLane(plan);
            plan = withoutSent(before, saved);
            // A brief-level taste request another direction sent gives way to this direction's own
            // taste wording (lanes.tasteAlt), in the same place, so the direction keeps a taste lane.
            const tasteAt = before.findIndex((r) => r.lane === "taste" && !plan.includes(r));
            if (tasteAt >= 0 && lanes.tasteAlt) {
              const alt = withoutSent(planRequests({ ...lanes, taste: lanes.tasteAlt }, picked, { zone }).filter((r) => r.lane === "taste"), saved);
              const at = plan.findIndex((r) => before.indexOf(r) > tasteAt);
              plan = at < 0 ? [...plan, ...alt] : [...plan.slice(0, at), ...alt, ...plan.slice(at)];
              plan = plan.slice(0, SERPER_MAX_REQUESTS);
            }
            baseline = { key, reused: saved };
          } else {
            baseline = { key };
            // One deep shared request per board: the fidelity lane goes one page deeper, and what the
            // brief-level lanes find but this direction does not place is pooled for the later ones.
            if (directionKey) {
              plan = deepenBaseline(plan, SERPER_MAX_REQUESTS);
              poolLanes = POOL_LANES;
            }
          }
          baseline.sent = plan.map(sentKey);
        }
        // Everything already on the canvas (any direction's tray or board) is skipped: cross-direction dedupe.
        const excludeCanvas = input.canvasId ?? directionCanvasId;
        const exclude = excludeCanvas && deps.getCanvasSourceUrls ? await deps.getCanvasSourceUrls(userId, excludeCanvas) : [];
        canvasUrls = exclude;
        if (baseline?.reused && directionKey) pooled = takeFromPool(baseline.reused.pool, exclude, learning.blocked);
        const runOpts = {
          count: input.count,
          userId,
          ...(learning.blocked.length > 0 ? { excludeKeys: learning.blocked } : {}),
          ...(preferCreators.length > 0 ? { preferCreators } : {}),
        };
        const result = await deps.adapter.runPlan(plan, { ...runOpts, exclude, ...(poolLanes ? { poolLanes } : {}) });
        const queries = plan.map((r) => buildSourceQuery(r.query, r.site));
        searched = { result, queries, lanes, arms, learned, termKeys };
        const next = input.lane ? undefined : nextUiRequest(lanes, plan, picked, new Set(baseline?.reused?.sent ?? []));
        if (next) {
          searched.extra = { req: next, run: (more) => deps.adapter.runPlan([next], { ...runOpts, exclude: [...exclude, ...more] }) };
        }
      } else {
        const base = {
          query: query!,
          userId,
          ...(learning.blocked.length > 0 ? { excludeKeys: learning.blocked } : {}),
          ...(preferCreators.length > 0 ? { preferCreators } : {}),
        };
        const artCount = zone === "both" ? artQuota(input.count) : input.count;
        const artSources = input.sources ? input.sources.filter((s) => sourceZoneOk(s, "art")) : [...ART_SITES];
        const [ui, art] = await Promise.all([
          zone === "art" ? undefined : deps.adapter.run({ ...base, count: input.count, sources }),
          zone === "ui" || artSources.length === 0
            ? undefined
            : deps.adapter.run({ ...base, count: artCount, sources: artSources, zone: "art", maxRequests: 2 }),
        ]);
        const uiRefs = ui?.references ?? [];
        const artRefs = art?.references ?? [];
        // Both zones: art takes about a third, UI fills the rest (and art fills in when UI is short).
        const uiTake = zone === "both" ? Math.max(input.count - Math.min(artRefs.length, artCount), 0) : input.count;
        const references = capByCreator([...uiRefs.slice(0, uiTake), ...artRefs]).slice(0, input.count);
        const ok = Boolean(ui?.ok || art?.ok);
        const result: WebSearchResult = {
          references,
          ok,
          requests: (ui?.requests ?? 0) + (art?.requests ?? 0),
          queries: [...(ui ? (ui.queries ?? [query!]) : []), ...(art ? (art.queries ?? [`${query!} (art)`]) : [])],
        };
        const dropped = (ui?.dropped ?? 0) + (art?.dropped ?? 0);
        if (dropped > 0) result.dropped = dropped;
        const droppedWhy = sumWhy([ui?.droppedWhy, art?.droppedWhy]);
        if (droppedWhy) result.droppedWhy = droppedWhy;
        const xPosts = [...new Set([...(ui?.xPosts ?? []), ...(art?.xPosts ?? [])])].slice(0, MAX_X_POSTS);
        if (xPosts.length > 0) result.xPosts = xPosts;
        const note = ok ? countNote(references.length, input.count) : (ui?.note ?? art?.note);
        if (note) result.note = note;
        searched = { result, queries: result.queries ?? [query!] };
      }
      const { result } = searched;

      // One tool call is one search for the visible quota, counted only when the provider answered.
      // The credits it really spent (one per Serper request sent, up to 10) are stored apart, even
      // when the provider failed, so the global cap sees every request.
      if (result.ok) await deps.usage.addSearches(userId, quota.period, 1);
      if (result.requests) await deps.usage.addCredits(userId, quota.period, result.requests);

      // Every result carries its zone ("art" for the art lane, "ui" otherwise).
      const withZone = (list: readonly Reference[]) =>
        list.map((r) => ({ ...r, zone: r.zone ?? (r.lane === "art" ? "art" : "ui") }) as Reference);
      let references = withPoolShare(withZone(result.references), pooled, input.count);
      if (atlasPlan) {
        // Provenance on every result (saved on the reference row): the recipe and the card.
        const plan = atlasPlan;
        const lead = atlasIds?.cardIds[0];
        references = references.map((r) => ({ ...r, ...provenanceFor(r, plan, lead) }));
        // CC0 index matches join the art zone, checked against the takedown list (fails closed).
        if (plan.cc0.length > 0 && zone !== "ui" && deps.loadTakedowns) {
          let takedowns: TakedownMatcher | null = null;
          try {
            takedowns = await deps.loadTakedowns();
          } catch {
            console.error("[search_references] could not load takedowns for CC0 results");
          }
          if (takedowns) {
            const seen = new Set([...references.map((r) => r.sourceUrl), ...canvasUrls]);
            const blocked = new Set(learning.blocked);
            const fresh = plan.cc0
              .filter((r) => !seen.has(r.sourceUrl) && !takedowns!.isReferenceBlocked(r) && !blocked.has(itemKey(r.sourceUrl)))
              .map((r) => ({ ...r, ...(lead ? { cardId: lead } : {}) }));
            references = mergeCc0(references, fresh, input.count);
          }
        }
      }
      const zones = zoneCounts(references);
      const out: SearchReferencesOutput = {
        query: input.lane ? queryWords(laneUiWords!) : lanes ? lanes.idea : query!,
        queries: searched.queries,
        sources,
        references,
        zone,
        zones,
        mix,
        addedToTray: false,
      };
      if (searched.lanes) out.lanes = searched.lanes;
      if (searched.arms) {
        out.arms = searched.arms;
        out.learned = searched.learned ?? false;
      }
      if (input.lane) out.lane = input.lane;
      if (inputTaste.length > 0) {
        out.taste = inputTaste;
        out.tasteSaved = tasteSaved;
      }
      const note = [result.note, artNote].filter(Boolean).join(" ");
      if (note) out.note = note;
      if (result.dropped) out.dropped = result.dropped;
      if (result.droppedWhy) out.droppedWhy = result.droppedWhy;
      if (result.xPosts?.length) out.xPosts = result.xPosts;
      // A new baseline: the ids of what the fidelity lane found (saved below with the tray).
      let newBaseline: CanvasBaseline | undefined;
      /** The baseline saved with the tray: a new one, or the reused one with this search's requests added to `sent`. */
      let baselineToSave: CanvasBaseline | undefined;
      if (baseline?.reused) {
        out.baseline = { referenceIds: baseline.reused.referenceIds, at: baseline.reused.at, reused: true };
        baselineToSave = withSent(baseline.reused, [...(baseline.reused.sent ?? []), ...(baseline.sent ?? [])]);
      } else if (baseline) {
        const ids = references.filter((r) => r.lane === BASELINE_LANE).map((r) => r.id);
        const pool = poolOf((result as { leftover?: Reference[] }).leftover);
        // Saved even when the lane found nothing, so its requests (`sent`) are never sent again on
        // this board (run 2026-10-16g2g: an empty gallery fidelity lane ran on two directions).
        newBaseline = withSent({ key: baseline.key, referenceIds: ids, at: now.toISOString(), ...(pool.length > 0 ? { pool } : {}) }, baseline.sent ?? []);
        baselineToSave = newBaseline;
        out.baseline = { referenceIds: ids, at: newBaseline.at, reused: false };
      }

      if (input.canvasId && references.length > 0) {
        const canvasId = input.canvasId;
        out.canvasId = canvasId;
        // Saved with how they were found (zone included), so rate_references can credit the lane wording.
        const toSave = (list: readonly Reference[]): SavedReference[] =>
          list.map((r) => {
            const lane = r.lane;
            const tk = lane ? searched.termKeys?.[lane] : undefined;
            const arm = lane ? searched.arms?.[lane] ?? defaultArm(lane) : undefined;
            return {
              ...r,
              ...(r.query ? {} : { query: queryWords(query ?? "") || undefined }),
              ...(tk ? { termKey: tk } : {}),
              ...(tk && arm ? { arm } : {}),
            };
          });
        const write = async (list: readonly Reference[], baselineToSave?: CanvasBaseline) =>
          baselineToSave
            ? deps.addToTray(userId, canvasId, toSave(list), directionKey, { baseline: baselineToSave })
            : directionKey
              ? deps.addToTray(userId, canvasId, toSave(list), directionKey)
              : deps.addToTray(userId, canvasId, toSave(list));
        // Each result belongs to one direction: what another direction already has is left out.
        const keep = (list: Reference[], added: boolean | { dropped: string[] }) => {
          const dropped = new Set(typeof added === "object" ? added.dropped : []);
          if (dropped.size > 0) out.droppedShared = (out.droppedShared ?? 0) + dropped.size;
          return list.filter((r) => !dropped.has(r.id));
        };
        const added = await write(references, baselineToSave);
        if (added) {
          out.addedToTray = true;
          out.references = keep(references, added);
          // Too few UI left for this direction: one extra UI request (cap 1), deduped the same way.
          const shippedIds = new Set(newBaseline?.referenceIds ?? []);
          const directionUi = () => out.references.filter((r) => r.zone !== "art" && !shippedIds.has(r.id)).length;
          // Never past the per-call budget (SERPER_MAX_REQUESTS): the extra request uses a spare one.
          const spare = (result.requests ?? 0) < SERPER_MAX_REQUESTS;
          if (directionKey && searched.extra && spare && directionUi() < MIN_DIRECTION_UI) {
            const { req } = searched.extra;
            const more = await searched.extra.run(references.map((r) => r.sourceUrl));
            if (more.requests) await deps.usage.addCredits(userId, quota.period, more.requests);
            out.extraLane = { lane: req.lane, query: queryWords(req.query) };
            out.queries = [...out.queries, buildSourceQuery(req.query, req.site)];
            const seen = new Set(out.references.map((r) => r.id));
            const fresh = withZone(more.ok ? more.references : [])
              .filter((r) => r.zone !== "art" && !seen.has(r.id))
              .slice(0, MIN_DIRECTION_UI - directionUi());
            if (fresh.length > 0) {
              const more2 = await write(fresh);
              if (more2) out.references = byZone([...out.references, ...keep(fresh, more2)]);
            }
          }
          out.zones = zoneCounts(out.references);
        } else out.note = [out.note, "That canvas was not found, so the results were not added to a tray."].filter(Boolean).join(" ");
      }

      return {
        content: [{ type: "text" as const, text: resultText(out) }],
        structuredContent: out as unknown as Record<string, unknown>,
      };
    } catch {
      return toolMessage("Search failed. Try again in a minute.");
    }
  };
}

/**
 * Deps over the live database, built lazily on the first call so env vars are read at
 * request time (OpenNext fills process.env per request).
 *
 * Without a canvasId nothing is saved: `references.canvas_id` is NOT NULL, and the
 * result ids (`ref_...`) are stable anyway, so a later search with a canvasId saves them.
 */
export function createDbDeps(repos: Repos | (() => Repos), appUrl: () => string | undefined): SearchReferencesDeps {
  const r = typeof repos === "function" ? repos : () => repos;
  const canvasDeps = {
    get repos() {
      return r();
    },
    appUrl,
  };
  return {
    adapter: createWebSearchAdapter({
      apiKey: process.env.SERPER_API_KEY,
      // Read on every search (spec section 2 rule 5); the adapter fails closed when it throws.
      loadTakedowns: async () => compileTakedowns(await r().takedowns.list()),
    }),
    usage: {
      get: (userId, period) => r().usage.get(userId, period),
      addSearches: (userId, period, by) => r().usage.addSearches(userId, period, by),
      addCredits: (userId, period, by) => r().usage.addCredits(userId, period, by),
      creditsUsed: (period) => r().usage.creditsUsed(period),
    },
    getPlan: (userId) => r().users.getPlan(userId),
    getDirection: async (userId, directionId, canvasId) => {
      const d = await r().directions.findForUser(userId, directionId, canvasId);
      if (!d) return null;
      const canvas = await r().canvases.getOwned(userId, d.canvasId);
      return {
        id: d.id,
        searchQuery: d.searchQuery,
        canvasId: d.canvasId,
        bendId: d.bendId,
        brief: d.detail?.brief ?? canvas?.brief ?? null,
        canvasBrief: canvas?.brief ?? null,
        taste: canvas ? (parseState(canvas.state).taste ?? null) : null,
        detail: d.detail ?? null,
      };
    },
    saveTaste: async (userId, canvasId, taste) => {
      const outcome = await mutateCanvas(r(), userId, canvasId, takedownLoader(canvasDeps), (state) => ({
        state: { ...state, taste },
        value: true,
      }));
      return outcome.ok;
    },
    getUserLearning: async (userId) => {
      const [blocked, creatorRatings] = await Promise.all([r().blocklist.list(userId), r().feedback.listCreatorRatings(userId)]);
      return { blocked, creatorRatings };
    },
    getArmStats: (userId, termKeys) => r().feedback.armStats(userId, termKeys),
    globalLearning: () => globalLearningOn(process.env.GLOBAL_LEARNING),
    creditCap: () => serperCreditCap(),
    getCanvasSourceUrls: async (userId, canvasId) => {
      const canvas = await r().canvases.getOwned(userId, canvasId);
      return canvas ? canvasSourceUrls(parseState(canvas.state)) : [];
    },
    addToTray: async (userId, canvasId, references, directionId, opts) => {
      const db = r();
      const owned = await db.canvases.getOwned(userId, canvasId);
      if (!owned) return false;
      await db.references.insertMany(canvasId, references);
      // The dedupe runs inside the mutation, so two directions searched at once never share a result.
      const outcome = await mutateCanvas(db, userId, canvasId, takedownLoader(canvasDeps), (state) => {
        const written = writeSearchTray(state, references, directionId, opts?.baseline);
        return { state: written.state, value: written.dropped };
      });
      return outcome.ok ? { dropped: outcome.value } : false;
    },
    atlasSource: () => {
      const loader = liveAtlasLoader(SEARCH_SHARD_BUDGET);
      return loader ? loaderSource(loader) : null;
    },
    atlasLearning: async (userId) => readAtlasLearning(r().feedback, userId, globalLearningOn(process.env.GLOBAL_LEARNING)),
    allowImage: (url) => isAllowedImageUrl(url, allowlistFromEnv()),
    loadTakedowns: async () => compileTakedowns(await r().takedowns.list()),
    getBaseline: async (userId, canvasId) => {
      const canvas = await r().canvases.getOwned(userId, canvasId);
      return canvas ? (parseState(canvas.state).baseline ?? null) : null;
    },
    upgradeUrl: () => upgradeUrl(canvasDeps),
  };
}

/** Live deps: the database is reached lazily, so input checks still run without it. */
function createDefaultDeps(): SearchReferencesDeps {
  return createDbDeps(getRepos, () => getConfig().appUrl);
}

let defaultTool: ReturnType<typeof createSearchReferencesTool> | undefined;

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Search references",
      description: TOOL_DESCRIPTION,
      // Validated in the handler so bad input gets a plain message, not the SDK's raw dump.
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args, ctx) => {
      defaultTool ??= createSearchReferencesTool(createDefaultDeps());
      return searchWithThumbs(await defaultTool(args as SearchReferencesInput, authExtra(ctx)?.userId), args);
    },
  );
};
