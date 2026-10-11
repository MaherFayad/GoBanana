/**
 * Search plan for a direction (pure): which query goes to which source, in what order, and how
 * the lanes share the results. Search returns UI images only (owner decision, DECISIONS.md
 * 2026-10-11; docs/search-quality-experiment.md rounds 11a and 11b): every lane is a UI form, and
 * every result passes the UI title gate (lib/sources/quality.ts isUiResult). The direction's wild
 * idea is never searched raw; it reaches results only through the bridge lane and style words.
 *
 *   UI_NEG       -template -kit -free -wireframe
 *   fidelity     "{domain} {surface} {UI_NEG}"             dribbble.com/shots, then pinterest.com/pin
 *   locale (ar)  "arabic {surface} {UI_NEG}"               replaces the fidelity Pinterest page
 *   taste        "{style} {domain} {component} ui design {UI_NEG}"  dribbble.com/shots
 *   component    "{core} {component} ui {UI_NEG}"          dribbble.com/shots, up to 2 from the brief
 *   hero         "{style} {coreDomain} app single screen"  dribbble.com/shots (app surface only)
 *   bridge       "{ingredient} ui design {UI_NEG}"         dribbble.com/shots, title must name the idea
 *
 * One source per request, path-scoped. At most SERPER_MAX_REQUESTS (8) requests per tool call;
 * what the base plan leaves is spent on page 2 and fallbacks (fidelity retried with the core noun).
 *
 * A plain query (no direction) is forced into UI forms too (plainQueryPlan): searched as is when
 * it already names a UI, else as "{q} app ui" and "{q} ui design", at most 4 requests.
 */
import { hasUiWord } from "./quality";
import { cleanQuery } from "./query";
import { SOURCE_SITES, type LaneName, type Mix, type Reference, type SourceSite } from "./types";

/** Negatives for UI lanes: they cut template, kit and wireframe sales sheets. */
export const UI_NEG = "-template -kit -free -wireframe";

export type { LaneName, Mix };

/** Most component lanes a direction search plans. */
export const MAX_COMPONENT_LANES = 2;

/** Plain lane words (no negatives, no site operator), as bend_brief and the tool output show them. */
export type LaneTexts = {
  /**
   * The direction's wild idea (its lead ingredient, "Sadu weaving"). Never searched raw: it only
   * feeds the bridge lane and its title filter, and the learning term keys.
   */
  idea: string;
  taste?: string;
  fidelity?: string;
  /** Fidelity with the domain cut to its core noun ("saudi fintech" to "fintech"), when different. */
  fidelityCore?: string;
  /** Component lanes from the brief: "{core} {component} ui" ("banking quick actions ui"), at most 2. */
  component?: string[];
  /** The idea applied to UI: "{ingredient} ui design" (UI briefs whose ingredient has a head word). */
  bridge?: string;
  hero?: string;
  locale?: string;
  /** The subject the locale lane's titles must name, so off-topic Arabic apps drop out. */
  localeWord?: string;
};

/** True when the lanes have anything to search (a brief gave them UI lanes). */
export function hasUiLanes(lanes: LaneTexts): boolean {
  return Boolean(lanes.fidelity || lanes.taste || lanes.component?.length || lanes.bridge || lanes.hero || lanes.locale);
}

export type PlannedRequest = {
  lane: LaneName;
  /** Query words sent before the site operator (negatives included). */
  query: string;
  site: SourceSite;
  /** Retry once with this query when the request brings back fewer than FALLBACK_MIN_GOOD results. */
  fallback?: string;
  /** Serper page (default 1). A learned arm may ask for page 2 of the same query. */
  page?: number;
  /** Keep a result only when its title has this word (bridge lane precision filter, see titleHasWord). */
  titleWord?: string;
};

/** A request that brings back fewer good results than this is retried once with its fallback. */
export const FALLBACK_MIN_GOOD = 5;

const withNeg = (text: string) => `${text} ${UI_NEG}`;

/** Words that are never an ingredient's head word. */
const HEAD_STOP = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "with", "in", "on", "at", "by", "from", "as", "into",
  "ui", "ux", "app", "design",
]);

/**
 * The ingredient's head word for the bridge lane filter: its last token that is not a stop word,
 * has at least 3 characters and is not a bare number. "vending machine" gives "machine",
 * "Art Nouveau 1900" gives "nouveau", "oversized numerals" gives "numerals". Null when none.
 */
export function bridgeHead(ingredient: string | undefined): string | null {
  const tokens = (ingredient ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i]!;
    if (t.length >= 3 && !HEAD_STOP.has(t) && /\p{L}/u.test(t)) return t;
  }
  return null;
}

/** Singular stem for the plural tolerance: "machines" and "glasses" lose their ending, "glass" keeps it. */
function singular(word: string): string {
  if (word.length > 4 && /(?:ss|sh|ch|x|z)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * True when `title` has `word` as a whole word, any case, singular or plural: "machine" matches
 * "Vending Machines UI", not "machinery"; "numerals" matches "numeral".
 */
export function titleHasWord(title: string | undefined, word: string): boolean {
  if (!title || !word) return false;
  const stem = escapeRe(singular(word.toLowerCase()));
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${stem}(?:s|es)?(?![\\p{L}\\p{N}])`, "iu").test(title);
}

export type PlanOptions = {
  /**
   * Head word the bridge lane's titles must have. Defaults to bridgeHead(lanes.idea); pass it
   * when the bridge words were changed (an arm), so it stays the direction's idea.
   */
  bridgeWord?: string | null;
};

/**
 * Requests in priority order (the budget cuts from the end), one page each:
 * 1. fidelity on Dribbble, 2. fidelity on Pinterest (locale "arabic {core} {surface}" for Arabic
 * briefs, its titles filtered by the subject like the bridge lane's),
 * 3. taste, 4. and 5. the component lanes, 6. hero, 7. bridge. The 8th request is left for page 2
 * or the fidelity fallback (lib/sources/web-search.ts runPlan).
 * `sources`, when the caller picked them, limits the lanes to those sites: a request on another
 * site moves to the first picked site, and repeats are dropped.
 * The bridge lane is planned only when there is a head word to filter its titles by.
 */
export function planRequests(lanes: LaneTexts, sources?: readonly SourceSite[], opts: PlanOptions = {}): PlannedRequest[] {
  const out: PlannedRequest[] = [];
  const add = (lane: LaneName, text: string | undefined, site: SourceSite, neg: boolean, fallback?: string, titleWord?: string) => {
    if (!text) return;
    out.push({
      lane,
      query: neg ? withNeg(text) : text,
      site,
      ...(fallback ? { fallback: neg ? withNeg(fallback) : fallback } : {}),
      ...(titleWord ? { titleWord } : {}),
    });
  };
  const head = opts.bridgeWord === undefined ? bridgeHead(lanes.idea) : opts.bridgeWord;
  add("fidelity", lanes.fidelity, "dribbble", true, lanes.fidelityCore);
  if (lanes.locale) add("locale", lanes.locale, "pinterest", true, undefined, lanes.localeWord);
  else add("fidelity", lanes.fidelity, "pinterest", true, lanes.fidelityCore);
  add("taste", lanes.taste, "dribbble", true);
  for (const c of (lanes.component ?? []).slice(0, MAX_COMPONENT_LANES)) add("component", c, "dribbble", true);
  add("hero", lanes.hero, "dribbble", false);
  if (head) add("bridge", lanes.bridge, "dribbble", true, undefined, head);
  return onSources(out, sources);
}

/** Move requests on unpicked sites to the first picked site, dropping repeats. No pick, no change. */
function onSources<T extends { query: string; site: SourceSite; page?: number }>(reqs: T[], sources?: readonly SourceSite[]): T[] {
  if (!sources || sources.length === 0) return reqs;
  const picked = SOURCE_SITES.filter((s) => sources.includes(s));
  if (picked.length === 0) return reqs;
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const r of reqs) {
    const site = picked.includes(r.site) ? r.site : picked[0]!;
    const key = `${r.query}|${site}|${r.page ?? 1}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ ...r, site });
  }
  return kept;
}

// ---------------------------------------------------------------------------
// Plain query path (search_references with `query` and no directionId)

/** Most requests a plain query sends. */
export const PLAIN_MAX_REQUESTS = 4;
/** A plain query that keeps fewer than this many results is retried once with its short form. */
export const PLAIN_MIN_GOOD = 4;

export type PlainRequest = { query: string; site: SourceSite };

/** "{text} app ui": a lane-only re-search's words with UI forced in when they name no UI. */
export function forceUi(text: string): string {
  const q = cleanQuery(text);
  return hasUiWord(q) ? q : `${q} app ui`;
}

/**
 * Requests for a plain query, at most PLAIN_MAX_REQUESTS. A query that already names a UI (the
 * gate's word list) is searched as is on every picked source. Otherwise it is forced into UI
 * forms: "{q} app ui" and "{q} ui design" on Dribbble, and "{q} app ui" on Pinterest (moved to the
 * first picked source when Dribbble or Pinterest is not picked).
 */
export function plainQueryPlan(query: string, sources: readonly SourceSite[]): PlainRequest[] {
  const q = cleanQuery(query);
  if (!q) return [];
  const picked = SOURCE_SITES.filter((s) => sources.includes(s));
  const sites = picked.length > 0 ? picked : (["pinterest", "dribbble"] as SourceSite[]);
  if (hasUiWord(q)) return sites.slice(0, PLAIN_MAX_REQUESTS).map((site) => ({ query: q, site }));
  const forced: PlainRequest[] = [
    { query: withNeg(`${q} app ui`), site: "dribbble" },
    { query: withNeg(`${q} ui design`), site: "dribbble" },
    { query: withNeg(`${q} app ui`), site: "pinterest" },
  ];
  return onSources(forced, sites).slice(0, PLAIN_MAX_REQUESTS);
}

/** Words dropped from the short form of a plain query: filler and UI words. */
const SHORT_STOP = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "with", "in", "on", "at", "by", "from", "as", "into", "it", "is",
  "my", "me", "make", "cool", "style", "inspired", "like", "design", "designs", "ui", "ux", "app", "apps",
]);

/**
 * The retry form of a plain query: numbers and years stripped ("1980s", "1985", "'80s"), filler
 * and UI words dropped, cut to its last 2 words, then "ui design". "teletext 1980s" gives
 * "teletext ui design". Null when nothing is left or it was already sent (`sent`, plain words).
 */
export function plainRetryQuery(query: string, sent: readonly string[] = []): string | null {
  const tokens = (cleanQuery(query).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [])
    .map((t) => t.replace(/['’-]+$/, ""))
    .filter((t) => t && /\p{L}/u.test(t) && !/^['’]?\d+(s|th|st|nd|rd)?$/i.test(t) && !SHORT_STOP.has(t) && !hasUiWord(t));
  if (tokens.length === 0) return null;
  const words = `${tokens.slice(-2).join(" ")} ui design`;
  const plain = (s: string) => cleanQuery(s.replace(/(^|\s)-\S+/g, " ")).toLowerCase();
  if (sent.some((s) => plain(s) === words)) return null;
  return withNeg(words);
}

/**
 * How many results each lane may place: split evenly over the lanes in order (earlier lanes get
 * the rounding). One lane takes everything.
 */
export function laneQuotas(count: number, lanes: readonly LaneName[]): Map<LaneName, number> {
  const quotas = new Map<LaneName, number>();
  if (lanes.length === 0) return quotas;
  let left = count;
  lanes.forEach((lane, i) => {
    const share = Math.ceil(left / (lanes.length - i));
    quotas.set(lane, share);
    left -= share;
  });
  return quotas;
}

/**
 * Merge lane lists: round robin across lanes (in the map's order), each lane up to its quota,
 * then whatever is left (round robin again) until `count`. `keyOf` gives the dedupe keys of a
 * reference; a reference that shares any key with one already placed is skipped.
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
  const roundRobin = (capped: boolean) => {
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
  };
  roundRobin(true);
  roundRobin(false);
  return out;
}
