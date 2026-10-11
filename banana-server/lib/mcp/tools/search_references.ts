/**
 * `search_references` (spec section 6): web image search for a bend direction or a query.
 *
 * Thin layer: parse input, check quota, call the web_search adapter, optionally put
 * results in a canvas tray. Everything that needs the database comes in through
 * `SearchReferencesDeps`, so this file never imports `db/` and tests run without it.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { addToTray as addToCanvasTray, canvasSourceUrls, mutateCanvas, parseState } from "@/lib/canvas/store";
import type { Repos } from "@/lib/db/types";
import { checkSearchQuota, type Plan, type UsageStore } from "@/lib/quota";
import { inspirationFromQuery, laneTexts } from "@/lib/bend/queries";
import { planRequests, type LaneTexts } from "@/lib/sources/plan";
import { buildSourceQuery } from "@/lib/sources/query";
import { DEFAULT_SOURCES, SOURCE_SITES, type Reference, type SourceSite } from "@/lib/sources/types";
import { cleanTaste, DEFAULT_TASTE } from "@/lib/taste";
import {
  SERPER_MAX_REQUESTS,
  createWebSearchAdapter,
  type WebSearchAdapter,
  type WebSearchResult,
} from "@/lib/sources/web-search";
import { compileTakedowns } from "@/lib/takedown";
import { getConfig } from "@/lib/config";
import { getRepos } from "@/lib/db";
import { plausibleId, takedownLoader, tasteInputSchema, upgradeUrl } from "./canvas-shared";
import { lenient, toolMessage, type RegisterTool } from "./types";

export const TOOL_NAME = "search_references";

export const TOOL_DESCRIPTION =
  "Find design references on Pinterest and Dribbble (add Behance or Awwwards in sources). " +
  "Pass a directionId from bend_brief (best: it searches the direction's idea, the user's taste and real screens for the brief), or a query. " +
  "Every result carries its source link: always show it next to the image. " +
  "Pass canvasId to add the results to that canvas tray. " +
  "Pass taste with a few style words that describe the user's references (for example from their mood boards), such as minimal, glassmorphism, dark mode, big typography, editorial; it is saved on the canvas. " +
  "Results are links to the source pages only.";

export const inputSchema = z.object({
  directionId: z.string().min(1).max(100).optional(),
  query: z.string().trim().min(1).max(300).optional(),
  sources: z.array(z.enum(SOURCE_SITES)).min(1).max(4).optional(),
  count: z.number().int().min(4).max(24).default(12),
  canvasId: z.string().min(1).max(100).optional(),
  taste: tasteInputSchema.optional(),
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
  /** Style words saved on that canvas (lib/taste.ts), if any. */
  taste?: readonly string[] | null;
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
   */
  addToTray(userId: string, canvasId: string, references: Reference[], directionId?: string): Promise<boolean>;
  /** Save style words on the user's canvas for later searches. Returns false when it is not theirs. */
  saveTaste?(userId: string, canvasId: string, taste: string[]): Promise<boolean>;
  /** Source links already on the user's canvas (tray and board), or [] when it is not theirs. */
  getCanvasSourceUrls?(userId: string, canvasId: string): Promise<string[]>;
  upgradeUrl(): string;
  now?(): Date;
};

export type SearchReferencesOutput = {
  query: string;
  /** What was searched, in order (direction searches: each request's query with its site operator). */
  queries: string[];
  /** Direction searches only: the plain words of each lane. */
  lanes?: LaneTexts;
  sources: SourceSite[];
  references: Reference[];
  note?: string;
  /** Results dropped as list pages or low quality. */
  dropped?: number;
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

function resultText(out: SearchReferencesOutput): string {
  const lines: string[] = [];
  if (out.references.length === 0) {
    lines.push(out.note ?? "No references found.");
    return lines.join("\n");
  }
  const lanes = out.lanes;
  const searched = lanes
    ? Object.entries(lanes)
        .filter(([k]) => k !== "fidelityCore")
        .map(([k, v]) => `${k} "${v}"`)
        .join(", ")
    : `"${out.query}"`;
  lines.push(`Found ${out.references.length} references for ${searched}. Show each source link with its image.`);
  out.references.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.title ?? "Untitled"} (${r.sourceSite}): ${r.sourceUrl}`);
  });
  if (out.note) lines.push(out.note);
  if (out.addedToTray && out.canvasId) lines.push(`Added to the tray of canvas ${out.canvasId}.`);
  return lines.join("\n");
}

/**
 * Lane words for a saved direction (lib/bend/queries.ts). Inspiration comes from the stored search
 * text (older directions stored a stacked query; the lead ingredient is pulled out of it). Taste,
 * fidelity, hero and locale come from the canvas brief; without one there is only inspiration.
 */
export function directionLanes(direction: Direction, taste: readonly string[]): LaneTexts {
  return laneTexts(direction.brief, inspirationFromQuery(direction.searchQuery), taste, direction.bendId ?? direction.id);
}

type Searched = { result: WebSearchResult; queries: string[]; lanes?: LaneTexts };

/** Handler logic, separate from MCP wiring so tests can call it directly. */
export function createSearchReferencesTool(deps: SearchReferencesDeps) {
  return async function searchReferences(
    rawInput: SearchReferencesInput,
    userId: string | undefined,
  ): Promise<SearchReferencesResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");

    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return toolMessage("Check the input: pass a directionId or a query, a count from 4 to 24, and at most 5 short taste words.");
    }
    const input = parsed.data;
    if (!input.directionId && !input.query) {
      return toolMessage("Pass a directionId from bend_brief or a query.");
    }
    if (input.canvasId && !plausibleId(input.canvasId)) {
      return toolMessage("That canvas was not found. Call open_canvas to create one, or check the canvasId.");
    }

    const inputTaste = cleanTaste(input.taste);
    try {
      const query = input.query;
      let directionKey: string | undefined;
      let directionCanvasId: string | undefined;
      let lanes: LaneTexts | undefined;
      if (!query && input.directionId) {
        const direction = await deps.getDirection(userId, input.directionId, input.canvasId);
        if (!direction) {
          return toolMessage(
            "That direction was not found. Directions are saved only when bend_brief gets a canvasId. Pass the direction's search text as query instead.",
          );
        }
        const taste = inputTaste.length > 0 ? inputTaste : cleanTaste(direction.taste);
        lanes = directionLanes(direction, taste.length > 0 ? taste : DEFAULT_TASTE);
        directionKey = direction.bendId ?? direction.id;
        directionCanvasId = direction.canvasId ?? undefined;
      }
      if (!query && !lanes) return toolMessage("Pass a directionId from bend_brief or a query.");

      const now = deps.now?.() ?? new Date();
      const plan = await deps.getPlan(userId);
      const quota = await checkSearchQuota(deps.usage, userId, plan, { upgradeUrl: deps.upgradeUrl(), now });
      if (!quota.ok) return toolMessage(quota.message);

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
      let searched: Searched;
      if (lanes) {
        // One path-scoped request per lane and source, at most SERPER_MAX_REQUESTS in all (fallbacks included).
        const plan = planRequests(lanes, input.sources ? sources : undefined).slice(0, SERPER_MAX_REQUESTS);
        const exclude = input.canvasId && deps.getCanvasSourceUrls ? await deps.getCanvasSourceUrls(userId, input.canvasId) : [];
        const result = await deps.adapter.runPlan(plan, { count: input.count, userId, exclude });
        const queries = plan.map((r) => buildSourceQuery(r.query, r.site));
        searched = { result, queries, lanes };
      } else {
        searched = { result: await deps.adapter.run({ query: query!, count: input.count, userId, sources }), queries: [query!] };
      }
      const { result } = searched;

      // One tool call is one search for the quota, whatever the lanes cost in provider credits.
      // Counted only when the search provider answered.
      if (result.ok) await deps.usage.addSearches(userId, quota.period, 1);

      const out: SearchReferencesOutput = {
        query: lanes ? lanes.inspiration : query!,
        queries: searched.queries,
        sources,
        references: result.references,
        addedToTray: false,
      };
      if (searched.lanes) out.lanes = searched.lanes;
      if (inputTaste.length > 0) {
        out.taste = inputTaste;
        out.tasteSaved = tasteSaved;
      }
      if (result.note) out.note = result.note;
      if (result.dropped) out.dropped = result.dropped;

      if (input.canvasId && result.references.length > 0) {
        out.canvasId = input.canvasId;
        const added = directionKey
          ? await deps.addToTray(userId, input.canvasId, result.references, directionKey)
          : await deps.addToTray(userId, input.canvasId, result.references);
        if (added) out.addedToTray = true;
        else out.note = [out.note, "That canvas was not found, so the results were not added to a tray."].filter(Boolean).join(" ");
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
        brief: canvas?.brief ?? null,
        taste: canvas ? (parseState(canvas.state).taste ?? null) : null,
      };
    },
    saveTaste: async (userId, canvasId, taste) => {
      const outcome = await mutateCanvas(r(), userId, canvasId, takedownLoader(canvasDeps), (state) => ({
        state: { ...state, taste },
        value: true,
      }));
      return outcome.ok;
    },
    getCanvasSourceUrls: async (userId, canvasId) => {
      const canvas = await r().canvases.getOwned(userId, canvasId);
      return canvas ? canvasSourceUrls(parseState(canvas.state)) : [];
    },
    addToTray: async (userId, canvasId, references, directionId) => {
      const db = r();
      const owned = await db.canvases.getOwned(userId, canvasId);
      if (!owned) return false;
      await db.references.insertMany(canvasId, references);
      const outcome = await mutateCanvas(db, userId, canvasId, takedownLoader(canvasDeps), (state) => ({
        state: addToCanvasTray(state, references, directionId),
        value: true,
      }));
      return outcome.ok;
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
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args, ctx) => {
      defaultTool ??= createSearchReferencesTool(createDefaultDeps());
      return defaultTool(args as SearchReferencesInput, authExtra(ctx)?.userId);
    },
  );
};
