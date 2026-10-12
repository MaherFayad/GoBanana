/**
 * Source adapter contract (spec section 8).
 *
 * Adapters return URLs and metadata only. They never fetch, store or re-host
 * image bytes (spec section 2, rules 2 and 4).
*/
import type { Zone } from "../direction-detail";
import { SOURCE_REGISTRY, sourceEntry, type RegistrySite } from "./registry";

export type { Zone };

/**
 * Sites a user can search through `search_references` (spec section 6), from the source registry
 * (lib/sources/registry.ts): adding a vetted gallery there adds it here, to the tool's `sources`
 * enum, to the item-page check and to the image host allowlist.
 */
export const SOURCE_SITES = SOURCE_REGISTRY.map((s) => s.id) as unknown as readonly [RegistrySite, ...RegistrySite[]];
export type SourceSite = RegistrySite;

/** Default selection when the caller picks no sources (spec section 6: "default first two"). */
export const DEFAULT_SOURCES: readonly SourceSite[] = ["pinterest", "dribbble"];

/** Registrable domain for each source site. Used for `site:` filters and source page checks. */
export const SOURCE_DOMAINS = Object.fromEntries(SOURCE_REGISTRY.map((s) => [s.id, s.domain])) as Record<SourceSite, string>;

/**
 * True when a site can serve a zone: art comes from Pinterest, Behance and art galleries; UI from
 * every core site and the UI galleries.
 */
export function sourceZoneOk(site: SourceSite, zone: Zone): boolean {
  const e = sourceEntry(site);
  if (zone === "art") return site === "pinterest" || site === "behance" || e.zone === "art";
  return e.zone === "ui";
}

/** True for a curated gallery (searched with topic words; not Pinterest, Dribbble or Behance). */
export function isGallery(site: SourceSite): boolean {
  return sourceEntry(site).role === "gallery";
}

/**
 * Search lanes of a direction search (lib/sources/plan.ts). Two zones (owner decision 2026-10-12):
 * - UI lanes (fidelity, taste, component, hero, bridge, locale): app screens, web pages,
 *   dashboards, components. Every result passes the UI title gate.
 * - The art lane: the direction's raw ingredients (its `artQueries`) on Pinterest pins and
 *   Behance galleries, the wild idea as images. No UI gate; a junk gate instead (shops, product
 *   listings, fashion, stock, logo sheets). Its results carry zone "art" and are never mixed into
 *   the UI references.
 */
export const LANE_NAMES = ["fidelity", "taste", "component", "hero", "bridge", "locale", "gallery", "art"] as const;
export type LaneName = (typeof LANE_NAMES)[number];
/** UI lanes. `gallery` searches curated UI galleries (lib/sources/registry.ts) with topic words. */
export const UI_LANES: readonly LaneName[] = ["fidelity", "taste", "component", "hero", "bridge", "locale", "gallery"];

/** The zone a lane's results go to. */
export function laneZone(lane: LaneName | undefined): Zone {
  return lane === "art" ? "art" : "ui";
}

/** Which zones a search fills: `both` (default for direction searches) or one of them. */
export const ZONE_INPUTS = ["ui", "art", "both"] as const;
export type ZoneInput = (typeof ZONE_INPUTS)[number];

/**
 * Accepted for backward compatibility only and ignored. The raw idea now has its own zone
 * (`zone` input), never mixed into the UI references.
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
  /** "art": the words as is on Pinterest and Behance with the art junk gate. Default "ui". */
  zone?: Zone;
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
  /**
   * Board zone: "art" for the art lane, "ui" otherwise. Set on every search result; optional in
   * the type so stored or hand-made references without it stay valid (missing means "ui").
   */
  zone?: Zone;
};

/** Search outcome with an optional plain note for the agent (for example when Serper fails). */
export type SourceSearchResult = {
  references: Reference[];
  note?: string;
};
