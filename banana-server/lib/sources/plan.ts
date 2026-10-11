/**
 * Search plan for a direction (pure): which query goes to which source, in what order, and how
 * the lanes share the results. Grammar verified on 386 live queries (DECISIONS.md, 2026-10-11;
 * docs/search-quality-experiment.md, "The grammar"), bridge lane on 32 more (round 10):
 *
 *   UI_NEG       -template -kit -free -wireframe
 *   inspiration  "{ingredient}"                            pinterest.com/pin + behance.net/gallery
 *   fidelity     "{domain} {surface} {UI_NEG}"             dribbble.com/shots + pinterest.com/pin
 *   taste        "{style} {domain} {component} ui design {UI_NEG}"  dribbble.com/shots
 *   bridge       "{ingredient} ui design {UI_NEG}"         dribbble.com/shots, title must name the idea
 *   hero         "{style} {coreDomain} app single screen"  dribbble.com/shots (app surface only)
 *   locale (ar)  "arabic {surface} {UI_NEG}"               replaces the fidelity Pinterest page
 *
 * One source per request, path-scoped. At most SERPER_MAX_REQUESTS (8) requests per tool call;
 * what the base plan leaves is spent on page 2 and fallbacks (fidelity retried with the core noun).
 */
import { DEFAULT_MIX, SOURCE_SITES, type LaneName, type Mix, type Reference, type SourceSite } from "./types";

/** Negatives for UI lanes: they cut template, kit and wireframe sales sheets. */
export const UI_NEG = "-template -kit -free -wireframe";

export type { LaneName, Mix };

/** Plain lane words (no negatives, no site operator), as bend_brief and the tool output show them. */
export type LaneTexts = {
  inspiration: string;
  taste?: string;
  fidelity?: string;
  /** Fidelity with the domain cut to its core noun ("saudi fintech" to "fintech"), when different. */
  fidelityCore?: string;
  /** The idea applied to UI: "{ingredient} ui design" (UI briefs whose ingredient has a head word). */
  bridge?: string;
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
   * Head word the bridge lane's titles must have. Defaults to bridgeHead(lanes.inspiration);
   * pass it when the inspiration words were changed (an arm), so it stays the direction's idea.
   */
  bridgeWord?: string | null;
};

/**
 * Requests in priority order (the budget cuts from the end): one page each. Bridge comes after
 * fidelity and taste and before hero.
 * `sources`, when the caller picked them, limits the UI lanes to those sites: a request on
 * another site moves to the first picked site, and repeats are dropped. The inspiration lane is
 * not UI, so it always uses Pinterest pins and Behance galleries (the best sources for raw
 * material, craft and identity work), whatever the caller picked.
 * The bridge lane is planned only when there is a head word to filter its titles by.
 */
export function planRequests(lanes: LaneTexts, sources?: readonly SourceSite[], opts: PlanOptions = {}): PlannedRequest[] {
  const out: PlannedRequest[] = [];
  const add = (lane: LaneName, text: string | undefined, site: SourceSite, ui: boolean, fallback?: string, titleWord?: string) => {
    if (!text) return;
    out.push({
      lane,
      query: ui ? withNeg(text) : text,
      site,
      ...(fallback ? { fallback: ui ? withNeg(fallback) : fallback } : {}),
      ...(titleWord ? { titleWord } : {}),
    });
  };
  const head = opts.bridgeWord === undefined ? bridgeHead(lanes.inspiration) : opts.bridgeWord;
  add("inspiration", lanes.inspiration, "pinterest", false);
  add("fidelity", lanes.fidelity, "dribbble", true, lanes.fidelityCore);
  add("taste", lanes.taste, "dribbble", true);
  if (head) add("bridge", lanes.bridge, "dribbble", true, undefined, head);
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
    const key = `${r.query}|${site}|${r.page ?? 1}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ ...r, site });
  }
  return kept;
}

/** Inspiration's share of a direction search per mix. */
export const MIX_INSPIRATION: Record<Mix, number> = { ui: 0.2, balanced: 0.4, wild: 0.6 };

/**
 * Inspiration's quota: "ui" about 20%, rounded down but at least 1 (2 of 12, 3 of 16), "balanced"
 * 40% and "wild" 60%, rounded.
 */
export function inspirationQuota(count: number, mix: Mix = DEFAULT_MIX): number {
  const share = count * MIX_INSPIRATION[mix];
  return Math.min(count, mix === "ui" ? Math.max(1, Math.floor(share)) : Math.round(share));
}

/**
 * Lane order for merging: in the "ui" mix the UI lanes go first and inspiration last, so the
 * result list leads with UI; otherwise inspiration first, as before. Order is otherwise kept.
 */
export function laneOrder(lanes: readonly LaneName[], mix: Mix = DEFAULT_MIX): LaneName[] {
  const ui = lanes.filter((l) => l !== "inspiration");
  if (!lanes.includes("inspiration")) return ui;
  return mix === "ui" ? [...ui, "inspiration"] : ["inspiration", ...ui];
}

/**
 * How many results each lane may place: inspiration its mix share (inspirationQuota), the rest
 * split evenly over the UI lanes in order (earlier lanes get the rounding). One lane takes everything.
 */
export function laneQuotas(count: number, lanes: readonly LaneName[], mix: Mix = DEFAULT_MIX): Map<LaneName, number> {
  const quotas = new Map<LaneName, number>();
  if (lanes.length === 0) return quotas;
  if (lanes.length === 1) return quotas.set(lanes[0]!, count);
  const hasInspiration = lanes.includes("inspiration");
  const first = hasInspiration ? inspirationQuota(count, mix) : 0;
  const rest = lanes.filter((l) => l !== "inspiration");
  let left = count - first;
  for (const lane of lanes) {
    if (lane === "inspiration") {
      quotas.set(lane, first);
      continue;
    }
    const i = rest.indexOf(lane);
    const share = Math.ceil(left / (rest.length - i));
    quotas.set(lane, share);
    left -= share;
  }
  return quotas;
}

export type MergeOptions = {
  /**
   * "ui" mix: leftover places go to the UI lanes before inspiration, and the merged list puts
   * every UI result before the inspiration ones (both keep their order).
   */
  uiFirst?: boolean;
};

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
  opts: MergeOptions = {},
): Reference[] {
  const out: { ref: Reference; lane: LaneName }[] = [];
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
  const roundRobin = (pool: readonly LaneName[], capped: boolean) => {
    let progress = true;
    while (out.length < count && progress) {
      progress = false;
      for (const lane of pool) {
        if (out.length >= count) break;
        if (capped && (placed.get(lane) ?? 0) >= (quotas.get(lane) ?? 0)) continue;
        const ref = nextFrom(lane);
        if (!ref) continue;
        out.push({ ref, lane });
        placed.set(lane, (placed.get(lane) ?? 0) + 1);
        progress = true;
      }
    }
  };
  roundRobin(lanes, true);
  if (opts.uiFirst) {
    roundRobin(
      lanes.filter((l) => l !== "inspiration"),
      false,
    );
  }
  roundRobin(lanes, false);
  if (!opts.uiFirst) return out.map((o) => o.ref);
  return [...out.filter((o) => o.lane !== "inspiration"), ...out.filter((o) => o.lane === "inspiration")].map((o) => o.ref);
}
