/**
 * `search_references` (spec section 6): web image search for a bend direction or a query.
 *
 * Thin layer: parse input, check quota, call the web_search adapter, optionally put
 * results in a canvas tray. Everything that needs the database comes in through
 * `SearchReferencesDeps`, so this file never imports `db/` and tests run without it.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { checkSearchQuota, createMemoryUsageStore, type Plan, type UsageStore } from "@/lib/quota";
import { DEFAULT_SOURCES, SOURCE_SITES, type Reference, type SourceSite } from "@/lib/sources/types";
import { createWebSearchAdapter, type WebSearchAdapter } from "@/lib/sources/web-search";
import { loadTakedownMatcher, type TakedownLoader } from "@/lib/takedown";
import { toolMessage, type RegisterTool } from "./types";

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

export type Direction = { id: string; searchQuery: string; canvasId?: string | null };

export type SearchReferencesDeps = {
  adapter: Pick<WebSearchAdapter, "run">;
  usage: UsageStore;
  getPlan(userId: string): Promise<Plan>;
  /** Direction owned by the user, or null. */
  getDirection(userId: string, directionId: string): Promise<Direction | null>;
  /**
   * Save references (URLs and metadata only) and put them in the canvas tray.
   * Returns false when the canvas does not exist or is not the user's.
   */
  addToTray(userId: string, canvasId: string, references: Reference[]): Promise<boolean>;
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

    try {
      let query = input.query;
      if (!query && input.directionId) {
        const direction = await deps.getDirection(userId, input.directionId);
        if (!direction) return toolMessage("That direction was not found. Run bend_brief again or pass a query.");
        query = direction.searchQuery;
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
        const added = await deps.addToTray(userId, input.canvasId, result.references);
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
 * Default deps for the live server. Built lazily on the first call so env vars are
 * read at request time (OpenNext fills process.env per request).
 *
 * TODO(db): replace each stub below with the Drizzle-backed version once db/ is in.
 */
function createDefaultDeps(): SearchReferencesDeps {
  // TODO(db): load `takedowns.url_or_domain` (spec section 11). Cache for a short time if needed,
  // but it must be checked on every search (spec section 2 rule 5).
  const loadTakedownEntries: TakedownLoader = async () => [];

  // TODO(db): usage table (user_id, period) with an upsert for addSearches. In-memory is per isolate.
  const usage = createMemoryUsageStore();

  return {
    adapter: createWebSearchAdapter({
      apiKey: process.env.SERPER_API_KEY,
      loadTakedowns: () => loadTakedownMatcher(loadTakedownEntries),
    }),
    usage,
    // TODO(db): read users.plan (ensureUser in lib/users.ts returns it).
    getPlan: async () => "free",
    // TODO(db): select from directions joined to canvases where canvases.user_id = userId.
    getDirection: async () => null,
    // TODO(db): check canvas ownership, insert into references (URLs only), append to the canvas tray.
    addToTray: async () => false,
    upgradeUrl: () => `${getConfig().appUrl ?? ""}/pricing`,
  };
}

let defaultTool: ReturnType<typeof createSearchReferencesTool> | undefined;

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Search references",
      description: TOOL_DESCRIPTION,
      inputSchema,
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args, ctx) => {
      defaultTool ??= createSearchReferencesTool(createDefaultDeps());
      return defaultTool(args, authExtra(ctx)?.userId);
    },
  );
};
