import { SOURCE_REGISTRY } from "./registry";
import { DEFAULT_SOURCES, SOURCE_SITES, type SourceSite } from "./types";

/**
 * Keep the selected sources in a stable order (the order of SOURCE_SITES),
 * drop duplicates and unknown values, and fall back to the defaults when empty.
 */
export function normalizeSources(sources?: readonly string[] | null): SourceSite[] {
  const picked = new Set((sources ?? []).map((s) => s.trim().toLowerCase()));
  const out = SOURCE_SITES.filter((s) => picked.has(s));
  return out.length > 0 ? out : [...DEFAULT_SOURCES];
}

/**
 * Path-scoped `site:` filter per source. A live test (DECISIONS.md, 2026-10-11) on 6 queries x 10
 * results: `site:pinterest.com/pin` gave 60/60 item pages and `site:dribbble.com/shots` 60/60,
 * against 28/60 for `(site:dribbble.com OR site:pinterest.com)`. So every source gets its own
 * query, and the OR form is never used.
 */
export const SOURCE_SCOPES = Object.fromEntries(SOURCE_REGISTRY.map((s) => [s.id, s.scope])) as Record<SourceSite, string>;

/**
 * Remove any `site:` operators, OR and brackets the caller typed, so a query can never widen
 * the search to other sites.
 */
export function cleanQuery(searchQuery: string): string {
  return searchQuery
    .replace(/-?\bsite:\S+/gi, " ")
    .replace(/\bOR\b/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Web search query for one source (spec section 8): `{query} site:pinterest.com/pin`. */
export function buildSourceQuery(searchQuery: string, source: SourceSite): string {
  return `${cleanQuery(searchQuery)} site:${SOURCE_SCOPES[source]}`.trim();
}
