/**
 * Search plan for a direction (pure): which query goes to which source, in what order, and how
 * the lanes share the results. Grammar verified on 386 live queries (DECISIONS.md, 2026-10-11;
 * docs/search-quality-experiment.md, "The grammar"):
 *
 *   UI_NEG       -template -kit -free -wireframe
 *   inspiration  "{ingredient}"                            pinterest.com/pin + behance.net/gallery
 *   fidelity     "{domain} {surface} {UI_NEG}"             dribbble.com/shots + pinterest.com/pin
 *   taste        "{style} {component} ui {UI_NEG}"         dribbble.com/shots
 *   hero         "{style} {coreDomain} app single screen"  dribbble.com/shots (app surface only)
 *   locale (ar)  "arabic {surface} {UI_NEG}"               replaces the fidelity Pinterest page
 *
 * One source per request, path-scoped. At most SERPER_MAX_REQUESTS (8) requests per tool call;
 * what the base plan leaves is spent on fallbacks (fidelity retried with the core domain noun).
 */
import { SOURCE_SITES, type Reference, type SourceSite } from "./types";

/** Negatives for UI lanes: they cut template, kit and wireframe sales sheets. */
export const UI_NEG = "-template -kit -free -wireframe";

export const LANE_NAMES = ["inspiration", "taste", "fidelity", "hero", "locale"] as const;
export type LaneName = (typeof LANE_NAMES)[number];

/** Plain lane words (no negatives, no site operator), as bend_brief and the tool output show them. */
export type LaneTexts = {
  inspiration: string;
  taste?: string;
  fidelity?: string;
  /** Fidelity with the domain cut to its core noun ("saudi fintech" to "fintech"), when different. */
  fidelityCore?: string;
  hero?: string;
  locale?: string;
};

export type PlannedRequest = {
  lane: LaneName;
  /** Query words sent before the site operator (negatives included). */
  query: string;
  site: SourceSite;
  /** Retry once with this query when the request brings back fewer than FALLBACK_MIN_GOOD results. */
  fallback?: string;
};

/** A request that brings back fewer good results than this is retried once with its fallback. */
export const FALLBACK_MIN_GOOD = 5;

const withNeg = (text: string) => `${text} ${UI_NEG}`;

/**
 * Requests in priority order (the budget cuts from the end): one page each.
 * `sources`, when the caller picked them, limits the UI lanes to those sites: a request on
 * another site moves to the first picked site, and repeats are dropped. The inspiration lane is
 * not UI, so it always uses Pinterest pins and Behance galleries (the best sources for raw
 * material, craft and identity work), whatever the caller picked.
 */
export function planRequests(lanes: LaneTexts, sources?: readonly SourceSite[]): PlannedRequest[] {
  const out: PlannedRequest[] = [];
  const add = (lane: LaneName, text: string | undefined, site: SourceSite, ui: boolean, fallback?: string) => {
    if (!text) return;
    out.push({
      lane,
      query: ui ? withNeg(text) : text,
      site,
      ...(fallback ? { fallback: ui ? withNeg(fallback) : fallback } : {}),
    });
  };
  add("inspiration", lanes.inspiration, "pinterest", false);
  add("fidelity", lanes.fidelity, "dribbble", true, lanes.fidelityCore);
  add("taste", lanes.taste, "dribbble", true);
  add("inspiration", lanes.inspiration, "behance", false);
  add("hero", lanes.hero, "dribbble", false);
  if (lanes.locale) add("locale", lanes.locale, "pinterest", true);
  else add("fidelity", lanes.fidelity, "pinterest", true, lanes.fidelityCore);

  if (!sources || sources.length === 0) return out;
  const picked = SOURCE_SITES.filter((s) => sources.includes(s));
  const seen = new Set<string>();
  const kept: PlannedRequest[] = [];
  for (const r of out) {
    const site = r.lane === "inspiration" || picked.includes(r.site) ? r.site : picked[0]!;
    const key = `${r.query}|${site}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ ...r, site });
  }
  return kept;
}

/**
 * How many results each lane may place, in lane order: inspiration about 40%, the rest split
 * evenly (earlier lanes get the rounding). One lane takes everything.
 */
export function laneQuotas(count: number, lanes: readonly LaneName[]): Map<LaneName, number> {
  const quotas = new Map<LaneName, number>();
  if (lanes.length === 0) return quotas;
  if (lanes.length === 1) return quotas.set(lanes[0]!, count);
  const hasInspiration = lanes[0] === "inspiration";
  const first = hasInspiration ? Math.round(count * 0.4) : 0;
  const rest = hasInspiration ? lanes.slice(1) : lanes;
  if (hasInspiration) quotas.set("inspiration", first);
  let left = count - first;
  rest.forEach((lane, i) => {
    const share = Math.ceil(left / (rest.length - i));
    quotas.set(lane, share);
    left -= share;
  });
  return quotas;
}

/**
 * Merge lane lists: round robin across lanes, each lane up to its quota, then whatever is left
 * (round robin again) until `count`. `keyOf` gives the dedupe keys of a reference; a reference
 * that shares any key with one already placed is skipped.
 */
export function mergeLanes(
  lists: ReadonlyMap<LaneName, readonly Reference[]>,
  quotas: ReadonlyMap<LaneName, number>,
  count: number,
  keyOf: (ref: Reference) => string[],
): Reference[] {
  const out: Reference[] = [];
  const seen = new Set<string>();
  const cursor = new Map<LaneName, number>();
  const placed = new Map<LaneName, number>();
  const lanes = [...lists.keys()];
  const nextFrom = (lane: LaneName): Reference | undefined => {
    const list = lists.get(lane) ?? [];
    let i = cursor.get(lane) ?? 0;
    while (i < list.length) {
      const ref = list[i++]!;
      const keys = keyOf(ref);
      if (keys.some((k) => seen.has(k))) continue;
      cursor.set(lane, i);
      for (const k of keys) seen.add(k);
      return ref;
    }
    cursor.set(lane, i);
    return undefined;
  };
  for (const capped of [true, false]) {
    let progress = true;
    while (out.length < count && progress) {
      progress = false;
      for (const lane of lanes) {
        if (out.length >= count) break;
        if (capped && (placed.get(lane) ?? 0) >= (quotas.get(lane) ?? 0)) continue;
        const ref = nextFrom(lane);
        if (!ref) continue;
        out.push(ref);
        placed.set(lane, (placed.get(lane) ?? 0) + 1);
        progress = true;
      }
    }
  }
  return out;
}
