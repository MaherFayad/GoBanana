/**
 * `search_references` (spec section 6): web image search for a bend direction or a query.
 *
 * Thin layer: parse input, check quota, call the web_search adapter, optionally put
 * results in a canvas tray. Everything that needs the database comes in through
 * `SearchReferencesDeps`, so this file never imports `db/` and tests run without it.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { addToTray as addToCanvasTray, mutateCanvas } from "@/lib/canvas/store";
import type { Repos } from "@/lib/db/types";
import { checkSearchQuota, type Plan, type UsageStore } from "@/lib/quota";
import { DEFAULT_SOURCES, SOURCE_SITES, type Reference, type SourceSite } from "@/lib/sources/types";
import { createWebSearchAdapter, type WebSearchAdapter } from "@/lib/sources/web-search";
import { compileTakedowns } from "@/lib/takedown";
import { liveCanvasDeps, plausibleId, takedownLoader, upgradeUrl } from "./canvas-shared";
import { lenient, toolMessage, type RegisterTool } from "./types";

export const TOOL_NAME = "search_references";

export const TOOL_DESCRIPTION =
  "Find design references on Pinterest, Dribbble, Behance and Awwwards. " +
  "Pass a directionId from bend_brief, or a query. " +
  "Every result carries its source link: always show it next to the image. " +
  "Pass canvasId to add the results to that canvas tray.";

export const inputSchema = z.object({
  directionId: z.string().min(1).max(100).optional(),
  query: z.string().trim().min(1).max(300).optional(),
  sources: z.array(z.enum(SOURCE_SITES)).min(1).max(4).optional(),
  count: z.number().int().min(4).max(24).default(12),
  canvasId: z.string().min(1).max(100).optional(),
});

export type SearchReferencesInput = z.input<typeof inputSchema>;

export type Direction = {
  id: string;
  searchQuery: string;
  canvasId?: string | null;
  /** Stable bend_brief id, when the direction came from bend_brief. */
  bendId?: string | null;
};

export type SearchReferencesDeps = {
  adapter: Pick<WebSearchAdapter, "run">;
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
  upgradeUrl(): string;
  now?(): Date;
};

export type SearchReferencesOutput = {
  query: string;
  sources: SourceSite[];
  references: Reference[];
  note?: string;
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
  lines.push(`Found ${out.references.length} references for "${out.query}". Show each source link with its image.`);
  out.references.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.title ?? "Untitled"} (${r.sourceSite}): ${r.sourceUrl}`);
  });
  if (out.note) lines.push(out.note);
  if (out.addedToTray && out.canvasId) lines.push(`Added to the tray of canvas ${out.canvasId}.`);
  return lines.join("\n");
}

/** Handler logic, separate from MCP wiring so tests can call it directly. */
export function createSearchReferencesTool(deps: SearchReferencesDeps) {
  return async function searchReferences(
    rawInput: SearchReferencesInput,
    userId: string | undefined,
  ): Promise<SearchReferencesResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");

    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return toolMessage("Check the input: pass a directionId or a query, and a count from 4 to 24.");
    }
    const input = parsed.data;
    if (!input.directionId && !input.query) {
      return toolMessage("Pass a directionId from bend_brief or a query.");
    }
    if (input.canvasId && !plausibleId(input.canvasId)) {
      return toolMessage("That canvas was not found. Call open_canvas to create one, or check the canvasId.");
    }

    try {
      let query = input.query;
      let directionKey: string | undefined;
      if (!query && input.directionId) {
        const direction = await deps.getDirection(userId, input.directionId, input.canvasId);
        if (!direction) {
          return toolMessage(
            "That direction was not found. Directions are saved only when bend_brief gets a canvasId. Pass the direction's search text as query instead.",
          );
        }
        query = direction.searchQuery;
        directionKey = direction.bendId ?? direction.id;
      }
      if (!query) return toolMessage("Pass a directionId from bend_brief or a query.");

      const now = deps.now?.() ?? new Date();
      const plan = await deps.getPlan(userId);
      const quota = await checkSearchQuota(deps.usage, userId, plan, { upgradeUrl: deps.upgradeUrl(), now });
      if (!quota.ok) return toolMessage(quota.message);

      const sources = input.sources ? SOURCE_SITES.filter((s) => input.sources!.includes(s)) : [...DEFAULT_SOURCES];
      const result = await deps.adapter.run({ query, count: input.count, userId, sources });

      // Count the search only when the search provider answered.
      if (result.ok) await deps.usage.addSearches(userId, quota.period, 1);

      const out: SearchReferencesOutput = {
        query,
        sources,
        references: result.references,
        addedToTray: false,
      };
      if (result.note) out.note = result.note;

      if (input.canvasId && result.references.length > 0) {
        out.canvasId = input.canvasId;
        const added = await deps.addToTray(userId, input.canvasId, result.references, directionKey);
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
export function createDbDeps(repos: Repos, appUrl: () => string | undefined): SearchReferencesDeps {
  const canvasDeps = { repos, appUrl };
  return {
    adapter: createWebSearchAdapter({
      apiKey: process.env.SERPER_API_KEY,
      // Read on every search (spec section 2 rule 5); the adapter fails closed when it throws.
      loadTakedowns: async () => compileTakedowns(await repos.takedowns.list()),
    }),
    usage: repos.usage,
    getPlan: (userId) => repos.users.getPlan(userId),
    getDirection: async (userId, directionId, canvasId) => {
      const d = await repos.directions.findForUser(userId, directionId, canvasId);
      return d ? { id: d.id, searchQuery: d.searchQuery, canvasId: d.canvasId, bendId: d.bendId } : null;
    },
    addToTray: async (userId, canvasId, references, directionId) => {
      const owned = await repos.canvases.getOwned(userId, canvasId);
      if (!owned) return false;
      await repos.references.insertMany(canvasId, references);
      const outcome = await mutateCanvas(repos, userId, canvasId, takedownLoader(canvasDeps), (state) => ({
        state: addToCanvasTray(state, references, directionId),
        value: true,
      }));
      return outcome.ok;
    },
    upgradeUrl: () => upgradeUrl(canvasDeps),
  };
}

function createDefaultDeps(): SearchReferencesDeps {
  const live = liveCanvasDeps();
  return createDbDeps(live.repos, live.appUrl);
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
      const userId = authExtra(ctx)?.userId;
      if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
      try {
        defaultTool ??= createSearchReferencesTool(createDefaultDeps());
      } catch {
        console.error("[search_references] not configured");
        return toolMessage("Search is not available right now. Try again in a minute.");
      }
      return defaultTool(args as SearchReferencesInput, userId);
    },
  );
};
