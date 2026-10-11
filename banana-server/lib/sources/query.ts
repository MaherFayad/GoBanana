import { DEFAULT_SOURCES, SOURCE_DOMAINS, SOURCE_SITES, type SourceSite } from "./types";

/**
 * Keep the selected sources in a stable order (the order of SOURCE_SITES),
 * drop duplicates and unknown values, and fall back to the defaults when empty.
 */
export function normalizeSources(sources?: readonly string[] | null): SourceSite[] {
  const picked = new Set((sources ?? []).map((s) => s.trim().toLowerCase()));
  const out = SOURCE_SITES.filter((s) => picked.has(s));
  return out.length > 0 ? out : [...DEFAULT_SOURCES];
}

/** `site:` filter for the selected sources, e.g. `(site:pinterest.com OR site:dribbble.com)`. */
export function buildSiteFilter(sources?: readonly string[] | null): string {
  const sites = normalizeSources(sources).map((s) => `site:${SOURCE_DOMAINS[s]}`);
  return `(${sites.join(" OR ")})`;
}

/**
 * Build the web search query (spec section 8):
 * `{searchQuery} (site:pinterest.com OR site:dribbble.com OR ...)`.
 *
 * Any `site:` operators the caller typed are removed first, so a query can never
 * widen the search to sites outside the selection.
 */
export function buildSearchQuery(searchQuery: string, sources?: readonly string[] | null): string {
  const cleaned = searchQuery
    .replace(/-?\bsite:\S+/gi, " ")
    .replace(/\bOR\b/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${cleaned} ${buildSiteFilter(sources)}`.trim();
}
