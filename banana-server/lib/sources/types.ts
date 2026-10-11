/**
 * Source adapter contract (spec section 8).
 *
 * Adapters return URLs and metadata only. They never fetch, store or re-host
 * image bytes (spec section 2, rules 2 and 4).
 */

/** Sites a user can search through `search_references` (spec section 6). */
export const SOURCE_SITES = ["pinterest", "dribbble", "behance", "awwwards"] as const;
export type SourceSite = (typeof SOURCE_SITES)[number];

/** Default selection when the caller picks no sources (spec section 6: "default first two"). */
export const DEFAULT_SOURCES: readonly SourceSite[] = ["pinterest", "dribbble"];

/** Registrable domain for each source site. Used for `site:` filters and source page checks. */
export const SOURCE_DOMAINS: Record<SourceSite, string> = {
  pinterest: "pinterest.com",
  dribbble: "dribbble.com",
  behance: "behance.net",
  awwwards: "awwwards.com",
};

/**
 * Search lanes of a direction search (lib/sources/plan.ts). Every lane is a UI lane: search
 * returns UI images only (app screens, web pages, dashboards, components). The direction's wild
 * idea is never searched raw; it reaches results only through the bridge lane ("vending machine
 * ui design", title must name the idea) and through style words.
 */
export const LANE_NAMES = ["fidelity", "taste", "component", "hero", "bridge", "locale"] as const;
export type LaneName = (typeof LANE_NAMES)[number];

/**
 * Accepted for backward compatibility only and ignored: results are always UI ("ui"). Older
 * clients sent "balanced" or "wild" to mix in the raw idea; that lane was removed (owner decision,
 * DECISIONS.md 2026-10-11).
 */
export const MIXES = ["ui", "balanced", "wild"] as const;
export type Mix = (typeof MIXES)[number];
export const DEFAULT_MIX: Mix = "ui";

export type SourceQuery = {
  query: string;
  count: number;
  userId: string;
  /**
   * Sites to search. Optional so the spec's base signature still fits;
   * adapters fall back to DEFAULT_SOURCES.
   */
  sources?: readonly SourceSite[];
  /** Most pages per source (one credit each). Defaults to the adapter's cap. */
  maxPages?: number;
  /** Most search provider requests (one credit each) this query may send in total. Defaults to the adapter's cap. */
  maxRequests?: number;
  /** Item keys (lib/sources/web-search.ts itemKey) never to return: the user's blocklist. */
  excludeKeys?: readonly string[];
  /** Normalized creator names (lib/learning/creator.ts) the user rated great: nudged up within each source. */
  preferCreators?: readonly string[];
};

export interface SourceAdapter {
  id: "web_search" | "pinterest_own" | "arena";
  search(q: SourceQuery): Promise<Reference[]>;
}

export type Reference = {
  id: string; // our id
  thumbUrl: string; // loaded in the browser, never re-hosted
  imageUrl: string; // loaded in the browser, never re-hosted
  sourceUrl: string; // always shown
  sourceSite: string; // "pinterest.com", "dribbble.com" ...
  title?: string;
  width?: number;
  height?: number;
  /** Direction searches: the lane that found it. */
  lane?: LaneName;
  /** Direction searches: the words of the request that found it (no negatives, no site operator). */
  query?: string;
};

/** Search outcome with an optional plain note for the agent (for example when Serper fails). */
export type SourceSearchResult = {
  references: Reference[];
  note?: string;
};
