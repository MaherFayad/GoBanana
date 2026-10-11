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

export type SourceQuery = {
  query: string;
  count: number;
  userId: string;
  /**
   * Sites to search. Optional so the spec's base signature still fits;
   * adapters fall back to DEFAULT_SOURCES.
   */
  sources?: readonly SourceSite[];
  /** Most search provider pages (one credit each) this query may use. Defaults to the adapter's cap. */
  maxPages?: number;
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
};

/** Search outcome with an optional plain note for the agent (for example when Serper fails). */
export type SourceSearchResult = {
  references: Reference[];
  note?: string;
};
