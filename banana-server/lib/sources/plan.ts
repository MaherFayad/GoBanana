/**
 * Search plan for a direction (pure): which query goes to which source, in what order, and how
 * the lanes share the results. Search returns UI images only (owner decision, DECISIONS.md
 * 2026-10-11; docs/search-quality-experiment.md rounds 11a and 11b): every lane is a UI form, and
 * every result passes the UI title gate (lib/sources/quality.ts isUiResult). The direction's wild
 * idea is never searched raw; it reaches results only through the bridge lane and style words.
 *
 *   UI_NEG       -template -kit -free -wireframe
 *   fidelity     "{domain} {page} {surface} {UI_NEG}"      dribbble.com/shots, then pinterest.com/pin
 *   bridge       "{ingredient} ui design {UI_NEG}"         dribbble.com/shots, title must name the idea
 *   locale (ar)  "arabic {surface} {UI_NEG}"               replaces the fidelity Pinterest page
 *   taste        "{style} {domain} {component} ui design {UI_NEG}"  dribbble.com/shots
 *   component    "{core} {page} {component} {surface} {UI_NEG}"  dribbble.com/shots, up to 2 from the brief and pages
 *   hero         "{style} {coreDomain} app single screen"  dribbble.com/shots (app surface only)
 *   art          a ladder per art query (lib/sources/art-ladder.ts): "{ingredient} identity system"
 *                on behance.net/gallery, then graphic, pattern and raw rungs on pinterest.com/pin
 *
 * One source per request, path-scoped. At most SERPER_MAX_REQUESTS (8) requests per tool call;
 * what the base plan leaves is spent on page 2 and fallbacks (fidelity retried with the core noun).
 *
 * A plain query (no direction) is forced into UI forms too (plainQueryPlan): searched as is when
 * it already names a UI, else as "{q} app ui" and "{q} ui design", at most 4 requests.
 */
import type { Platform } from "../direction-detail";
import { buildArtLadder } from "./art-ladder";
import { hasUiWord, lensNegatives } from "./quality";
import { cleanQuery } from "./query";
import { sourceEntry } from "./registry";
import {
  ART_LANES,
  SOURCE_SITES,
  isGallery,
  laneZone,
  type ArtLane,
  type LaneName,
  type Mix,
  type Reference,
  type SearchLane,
  type SourceSite,
  type Zone,
  type ZoneInput,
} from "./types";

/** Negatives for UI lanes: they cut template, kit and wireframe sales sheets. */
export const UI_NEG = "-template -kit -free -wireframe";
/** Negatives for the art lane: shop listings (unmeasured live; the junk gate is the real filter). */
export const ART_NEG = "-etsy -amazon -aliexpress -sale -buy";

/** Sites the art lane searches: Behance galleries for systems, Pinterest pins for the rest (round 7). */
export const ART_SITES: readonly SourceSite[] = ["pinterest", "behance"];
/** Most art queries a direction plans (bend gives 1 to 3). */
export const MAX_ART_QUERIES = 3;
/** Requests in a base plan; the rest of SERPER_MAX_REQUESTS (8) is kept for page 2 or a fallback. */
export const BASE_MAX_REQUESTS = 7;

export type { LaneName, Mix, SearchLane };

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
  /** Component lanes from the brief and pages: "{core} {page} {component} {surface}" ("flight checkout fare summary app ui"), at most 2. */
  component?: string[];
  /** The idea applied to UI: "{ingredient} ui design" (UI briefs whose ingredient has a head word). */
  bridge?: string;
  hero?: string;
  locale?: string;
  /** The subject the locale lane's titles must name, so off-topic Arabic apps drop out. */
  localeWord?: string;
  /**
   * Topic words for curated galleries ("fintech", "analytics"): galleries index site and product
   * names and topics, not "app ui" forms.
   */
  topic?: string;
  /** UI galleries this direction searches (lib/sources/registry.ts pickGalleries), in order. */
  galleries?: SourceSite[];
  /** Art galleries this direction searches (style tag matches only). */
  artGalleries?: SourceSite[];
  /** Platform the UI lanes were worded for (lib/platform.ts). */
  platform?: Platform;
  /**
   * Title words the UI lanes drop for this platform ("web", "dashboard" on an iPhone brief),
   * minus words the brief itself uses.
   */
  avoid?: string[];
  /**
   * Art zone: the direction's art queries (its `artQueries`, else its idea), 1 to 3. Each is
   * searched as a ladder (lib/sources/art-ladder.ts): identity or signage system on Behance, then
   * graphic design or poster, pattern or typography, and the raw words on Pinterest, with the art
   * junk gate.
   */
  art?: string[];
};

/** True when the lanes have anything to search (a brief gave them UI lanes). */
export function hasUiLanes(lanes: LaneTexts): boolean {
  return Boolean(
    lanes.fidelity || lanes.taste || lanes.component?.length || lanes.bridge || lanes.hero || lanes.locale || lanes.galleries?.length,
  );
}

/** True when the lanes have art queries. */
export function hasArtLane(lanes: LaneTexts): boolean {
  return Boolean(lanes.art?.some((q) => q.trim()));
}

/**
 * Words for one gallery: its fixed query when it has one (Swissted: "poster"), else the topic with
 * UI words and negatives taken out ("fintech app ui -template" gives "fintech"). Nothing left:
 * "design".
 */
export function galleryWords(site: SourceSite, topic: string): string {
  const entry = sourceEntry(site);
  if (entry.query) return entry.query;
  const plain = cleanQuery(topic.replace(/(^|\s)-\S+/g, " "))
    .replace(/\b(app ui|ui design|website ui|dashboard ui|ui ux|ui|ux|single screen|app|design)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = plain || "design";
  return entry.suffix ? `${words} ${entry.suffix}` : words;
}

export type PlannedRequest = {
  lane: SearchLane;
  /** Query words sent before the site operator (negatives included). */
  query: string;
  site: SourceSite;
  /** Retry once with this query when the request brings back fewer than FALLBACK_MIN_GOOD results. */
  fallback?: string;
  /** Serper page (default 1). A learned arm may ask for page 2 of the same query. */
  page?: number;
  /** Keep a result only when its title has this word (bridge and locale lane precision filter, see titleHasWord). */
  titleWord?: string;
  /** UI lanes: drop a result whose title has any of these words (platform filter). */
  avoidWords?: string[];
  /** Art lane: the idea's head word; titles that name it rank higher (never a hard filter). */
  ideaWord?: string;
  /**
   * Art lane: the rest of this ingredient's ladder (lib/sources/art-ladder.ts), in order. The next
   * rung is sent only when this one keeps fewer than ART_RUNG_MIN usable results and the art zone
   * is still short of its quota (lib/sources/web-search.ts runPlan).
   */
  next?: PlannedRequest[];
};

/** Zone of a planned request's results. */
export function requestZone(req: Pick<PlannedRequest, "lane">): Zone {
  return laneZone(req.lane);
}

/** A request that brings back fewer good results than this is retried once with its fallback. */
export const FALLBACK_MIN_GOOD = 5;

const withNeg = (text: string) => `${text} ${UI_NEG}`;

/** Words that are never an ingredient's head word. */
const HEAD_STOP = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "with", "in", "on", "at", "by", "from", "as", "into",
  "ui", "ux", "app", "design",
]);

/**
 * Common words that alone say little about the idea: as a title filter they let anything through
 * ("rawashin windows" filtered by "windows" kept Windows 11 desktop shots, live 2026-10-12). The
 * head word skips them when the ingredient has a more telling word.
 */
const GENERIC_HEADS = new Set([
  "window", "windows", "texture", "textures", "pattern", "patterns", "poster", "posters", "style", "styles", "art",
  "paper", "record", "records", "light", "lights", "color", "colors", "colour", "colours", "shape", "shapes",
  "sign", "signs", "giant", "oversized", "big", "huge", "tiny", "small", "old", "vintage", "retro", "modern",
  "classic", "screen", "screens", "page", "pages", "card", "cards", "print", "prints", "type", "look", "mood",
]);

/**
 * The ingredient's head word for the bridge lane filter: its last token that is not a stop word,
 * has at least 3 characters and is not a bare number, preferring one that is not a common word
 * (GENERIC_HEADS). "vending machine" gives "machine", "Art Nouveau 1900" gives "nouveau",
 * "oversized numerals" gives "numerals", "rawashin windows" gives "rawashin". Null when none.
 */
export function bridgeHead(ingredient: string | undefined): string | null {
  const tokens = ((ingredient ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (t) => t.length >= 3 && !HEAD_STOP.has(t) && /\p{L}/u.test(t),
  );
  return [...tokens].reverse().find((t) => !GENERIC_HEADS.has(t)) ?? tokens.at(-1) ?? null;
}

/**
 * The title word for a re-search of the bridge lane: the head word of the agent's new words,
 * leaving out UI words and the brief's own words (`lanes`), so "islamic pattern app" filters by
 * "islamic" and "velvet checkout ui" by "velvet". Null when the new words name nothing beyond the
 * brief: then no title filter. The old idea's word is never used: it dropped every result of the
 * new words (field report, 2026-10-12: "islamic pattern app" filtered by "windows").
 */
export function retryBridgeWord(text: string, lanes: Pick<LaneTexts, "fidelity" | "component" | "topic" | "locale">): string | null {
  const brief = new Set(
    [lanes.fidelity, ...(lanes.component ?? []), lanes.topic, lanes.locale]
      .join(" ")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? [],
  );
  const own = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => !brief.has(t) && !hasUiWord(t));
  return bridgeHead(own.join(" "));
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
  /** Zones to search. Default: "both" when the lanes have art queries, else "ui". */
  zone?: ZoneInput;
};

/** UI requests in priority order (see planRequests). */
function uiRequests(lanes: LaneTexts, head: string | null): PlannedRequest[] {
  const out: PlannedRequest[] = [];
  const avoid = lanes.avoid?.length ? lanes.avoid : undefined;
  const add = (lane: LaneName, text: string | undefined, site: SourceSite, neg: boolean, fallback?: string, titleWord?: string) => {
    if (!text) return;
    out.push({
      lane,
      query: neg ? withNeg(text) : text,
      site,
      ...(fallback ? { fallback: neg ? withNeg(fallback) : fallback } : {}),
      ...(titleWord ? { titleWord } : {}),
      ...(avoid ? { avoidWords: avoid } : {}),
    });
  };
  const galleries = lanes.galleries ?? [];
  const addGallery = (site: SourceSite | undefined) => {
    if (site) out.push({ lane: "gallery", query: galleryWords(site, lanes.topic ?? lanes.fidelity ?? ""), site, ...(avoid ? { avoidWords: avoid } : {}) });
  };
  // Website and web app briefs: a platform gallery replaces the Pinterest fidelity page (Pinterest
  // is weak on web pages, round 4). Every other gallery follows the first component lane.
  const web = lanes.platform === "website" || lanes.platform === "webapp";
  const first = web && !lanes.locale ? galleries[0] : undefined;
  const components = (lanes.component ?? []).slice(0, MAX_COMPONENT_LANES);
  add("fidelity", lanes.fidelity, "dribbble", true, lanes.fidelityCore);
  // The bridge is the only UI lane that differs between the directions of one brief, so it goes
  // second: planned last, the both-zones cut dropped it and every direction got the same generic
  // shots (field report, 2026-10-12). A thin answer retries as "{ingredient} app ui".
  if (head && lanes.bridge) {
    const alt = lanes.bridge.replace(/ ui design$/, " app ui");
    add("bridge", lanes.bridge, "dribbble", true, alt !== lanes.bridge ? alt : undefined, head);
  }
  add("taste", lanes.taste, "dribbble", true);
  add("component", components[0], "dribbble", true);
  if (lanes.locale) add("locale", lanes.locale, "pinterest", true, undefined, lanes.localeWord);
  else if (first) addGallery(first);
  else add("fidelity", lanes.fidelity, "pinterest", true, lanes.fidelityCore);
  const rest = first ? galleries.slice(1) : galleries;
  addGallery(rest[0]);
  add("component", components[1], "dribbble", true);
  add("hero", lanes.hero, "dribbble", false);
  for (const site of rest.slice(1)) addGallery(site);
  return out;
}

/** Negatives of one art request: the lens's look-alike tradition ("talli" adds -tulle -assiut -egyptian), then shop words. */
const artNeg = (q: string) => [lensNegatives(q), ART_NEG].filter(Boolean).join(" ");

/**
 * Art requests, one ladder per art query (lib/sources/art-ladder.ts): each ingredient's first
 * rung ("{ingredient} identity system" on Behance; a lens keeps its own words), carrying the
 * rest of its ladder in `next`, in ingredient order; then the matched art galleries for the
 * first ingredient (their fixed words or the ingredient), as graphic rung requests. Galleries go
 * last: live, a niche idea on an art gallery found nothing ("synthwave 1984" on typo/graphic
 * posters), while Behance gave 2 to 7 good results.
 */
export function artRequests(queries: readonly string[] | undefined, galleries: readonly SourceSite[] = []): PlannedRequest[] {
  const out: PlannedRequest[] = [];
  const list = (queries ?? []).map(artWords).filter(Boolean).slice(0, MAX_ART_QUERIES);
  list.forEach((q) => {
    const ladder = buildArtLadder(q);
    const ideaWord = bridgeHead(ladder.ingredient) ?? bridgeHead(q) ?? undefined;
    const idea = ideaWord ? { ideaWord } : {};
    const rungs: PlannedRequest[] = ladder.rungs.map((step) => ({
      lane: `art:${step.rung}` as ArtLane,
      query: `${step.query} ${artNeg(step.query)}`,
      site: step.site,
      ...idea,
    }));
    const [first, ...rest] = rungs;
    if (first) out.push(rest.length > 0 ? { ...first, next: rest } : first);
  });
  const lead = list[0];
  if (lead) {
    const ideaWord = bridgeHead(buildArtLadder(lead).ingredient) ?? undefined;
    for (const site of galleries) out.push({ lane: "art:graphic", query: galleryWords(site, lead), site, ...(ideaWord ? { ideaWord } : {}) });
  }
  return out;
}

/**
 * Raw art requests: the words as is on Pinterest pins, then Behance galleries, then the matched
 * art galleries. A lane re-search with the agent's words (lane "art:retry") and the plain art
 * query path use these: the agent's words are its choice, never laddered.
 */
export function rawArtRequests(text: string, galleries: readonly SourceSite[] = [], lane: SearchLane = "art:retry"): PlannedRequest[] {
  const q = artWords(text);
  if (!q) return [];
  const ideaWord = bridgeHead(q) ?? undefined;
  const idea = ideaWord ? { ideaWord } : {};
  return [
    { lane, query: `${q} ${artNeg(q)}`, site: "pinterest", ...idea },
    { lane, query: `${q} ${artNeg(q)}`, site: "behance", ...idea },
    ...galleries.map((site) => ({ lane, query: galleryWords(site, q), site, ...idea })),
  ];
}

/** A lane re-search of the art lane: the agent's words raw, lane "art:retry", on the picked art sites. */
export function artRetryPlan(text: string, sources?: readonly SourceSite[], galleries: readonly SourceSite[] = []): PlannedRequest[] {
  return artOnSources(rawArtRequests(text, galleries), sources).slice(0, BASE_MAX_REQUESTS);
}

/** An art query's plain words: no site operators, no negatives, at most 8 words. */
export function artWords(raw: string): string {
  return cleanQuery(raw.replace(/(^|\s)-\S+/g, " "))
    .split(" ")
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");
}

/**
 * Requests in priority order (the budget cuts from the end), one page each.
 * UI: 1. fidelity on Dribbble, 2. bridge (only with a head word to filter its titles by), 3. taste,
 * 4. the first component lane, 5. fidelity on Pinterest (locale "arabic {core} {surface}" for
 * Arabic briefs, its titles filtered by the subject like the bridge lane's; website briefs search
 * Awwwards with the `web` words instead), 6. a gallery, 7. the second component lane, 8. hero.
 * Art: each art query's first ladder rung (lib/sources/art-ladder.ts), its later rungs in `next`.
 * Both zones: UI and art alternate for the first two of each (fidelity, art, fidelity, art), then
 * the rest of UI, then the rest of art, cut to BASE_MAX_REQUESTS so one request is left for page 2
 * or a fallback (lib/sources/web-search.ts runPlan).
 * `sources`, when the caller picked them, limits the lanes to those sites (see onSources).
 */
export function planRequests(lanes: LaneTexts, sources?: readonly SourceSite[], opts: PlanOptions = {}): PlannedRequest[] {
  const head = opts.bridgeWord === undefined ? bridgeHead(lanes.idea) : opts.bridgeWord;
  const zone: ZoneInput = opts.zone ?? (hasArtLane(lanes) ? "both" : "ui");
  const ui = zone === "art" ? [] : onSources(uiRequests(lanes, head), sources);
  const art = zone === "ui" ? [] : artOnSources(artRequests(lanes.art, lanes.artGalleries), sources);
  if (art.length === 0) return ui;
  if (ui.length === 0) return art.slice(0, BASE_MAX_REQUESTS);
  const merged = [ui[0]!, art[0]!, ...(ui[1] ? [ui[1]] : []), ...(art[1] ? [art[1]] : []), ...ui.slice(2), ...art.slice(2)];
  return merged.slice(0, BASE_MAX_REQUESTS);
}

/**
 * Move requests on unpicked sites to the picked sites, round robin (so ["awwwards", "behance"]
 * searches both, not only the first), dropping repeats. A request moved to a website gallery
 * gets topic words (galleryWords). No pick, no change. Art requests go through artOnSources.
 */
function onSources<T extends { query: string; site: SourceSite; page?: number; fallback?: string }>(reqs: T[], sources?: readonly SourceSite[]): T[] {
  if (!sources || sources.length === 0) return reqs;
  const picked = SOURCE_SITES.filter((s) => sources.includes(s));
  if (picked.length === 0) return reqs;
  const seen = new Set<string>();
  const kept: T[] = [];
  let moved = 0;
  for (const r of reqs) {
    const site = picked.includes(r.site) ? r.site : picked[moved++ % picked.length]!;
    const toWeb = isGallery(site) && !isGallery(r.site);
    const next: T = toWeb ? { ...r, site, query: galleryWords(site, r.query) } : { ...r, site };
    if (toWeb) delete next.fallback;
    const key = `${next.query}|${site}|${r.page ?? 1}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(next);
  }
  return kept;
}

/**
 * Art requests stay on the picked art sites (Pinterest, Behance, art galleries); a request on an
 * unpicked site moves to the first picked art site; none picked, no art requests. Each ladder's
 * later rungs move the same way.
 */
function artOnSources(reqs: PlannedRequest[], sources?: readonly SourceSite[]): PlannedRequest[] {
  if (!sources || sources.length === 0) return reqs;
  const picked = SOURCE_SITES.filter((s) => sources.includes(s) && (ART_SITES.includes(s) || sourceEntry(s).zone === "art"));
  if (picked.length === 0) return [];
  const seen = new Set<string>();
  const move = (r: PlannedRequest): PlannedRequest => (picked.includes(r.site) ? r : { ...r, site: picked[0]! });
  const fresh = (r: PlannedRequest) => {
    const key = `${r.query}|${r.site}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  return reqs.map(move).filter(fresh).map((r) => {
    if (!r.next) return r;
    const next = r.next.map(move).filter(fresh);
    const { next: _old, ...rest } = r;
    return next.length > 0 ? { ...rest, next } : rest;
  });
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
  // A website gallery indexes topics and site names: it gets website words, never "app ui".
  if (hasUiWord(q)) return sites.slice(0, PLAIN_MAX_REQUESTS).map((site) => ({ query: isGallery(site) ? galleryWords(site, q) : q, site }));
  const forced: PlainRequest[] = [
    { query: withNeg(`${q} app ui`), site: "dribbble" },
    { query: withNeg(`${q} ui design`), site: "dribbble" },
    { query: withNeg(`${q} app ui`), site: "pinterest" },
  ];
  // Picked galleries get their own topic-word request first (they never match "app ui" forms).
  forced.unshift(...sites.filter(isGallery).map((site) => ({ query: galleryWords(site, q), site })));
  return onSources(forced, sites).slice(0, PLAIN_MAX_REQUESTS);
}

/** A plain query in the art zone: the words as is, on the picked art sites (Pinterest, Behance). */
export function artQueryPlan(query: string, sources: readonly SourceSite[]): PlainRequest[] {
  return artOnSources(rawArtRequests(query), sources.length > 0 ? sources : ART_SITES).map((r) => ({ query: r.query, site: r.site }));
}

/** Words dropped from the short form of a plain query: filler and UI words. */
const SHORT_STOP = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "with", "in", "on", "at", "by", "from", "as", "into", "it", "is",
  "my", "me", "make", "cool", "style", "inspired", "like", "design", "designs", "ui", "ux", "app", "apps",
  "page", "pages",
]);

/**
 * Style words a short retry keeps (lib/taste.ts verified words plus common style names). One
 * word each: multi-word styles keep their head ("big typography" keeps "typography").
 */
const STYLE_WORDS = new Set([
  "brutalist", "brutalism", "neubrutalism", "neubrutalist", "minimal", "minimalist", "glassmorphism", "neumorphism",
  "skeuomorphic", "skeuomorphism", "claymorphism", "retro", "vintage", "y2k", "swiss", "editorial", "bauhaus", "memphis",
  "vaporwave", "synthwave", "cyberpunk", "monochrome", "grainy", "luxury", "dark", "neon", "pastel", "gradient",
  "futuristic", "organic", "typography", "bento", "isometric", "pixel", "8-bit", "holographic", "chrome", "glass",
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
  // Style words survive the cut ("brutalist landing page ai startup" keeps "brutalist"), then the
  // last 2 other words.
  const styles = tokens.filter((t) => STYLE_WORDS.has(t)).slice(0, 2);
  const rest = tokens.filter((t) => !STYLE_WORDS.has(t)).slice(-2);
  const words = `${[...styles, ...rest].join(" ")} ui design`;
  const plain = (s: string) => cleanQuery(s.replace(/(^|\s)-\S+/g, " ")).toLowerCase();
  if (sent.some((s) => plain(s) === words)) return null;
  return withNeg(words);
}

/**
 * How many results each lane may place: split evenly over the lanes in order (earlier lanes get
 * the rounding). One lane takes everything.
 */
export function laneQuotas(count: number, lanes: readonly SearchLane[]): Map<SearchLane, number> {
  const quotas = new Map<SearchLane, number>();
  if (lanes.length === 0) return quotas;
  let left = count;
  lanes.forEach((lane, i) => {
    const share = Math.ceil(left / (lanes.length - i));
    quotas.set(lane, share);
    left -= share;
  });
  return quotas;
}

/** The art zone's share of a direction search: about a third of `count`, at least 3 (never more than count). */
export function artQuota(count: number): number {
  return Math.min(count, Math.max(3, Math.round(count / 3)));
}

/** Art lanes best rung first: "art" and "art:system", then graphic, pattern, raw, retry. */
export const artLaneRank = (lane: SearchLane) => (lane === "art" ? -1 : (ART_LANES as readonly string[]).indexOf(lane));

/**
 * Quotas when an art lane is present: art gets artQuota(count), the UI lanes share the rest
 * evenly (laneQuotas). Only art: all of it. No art: laneQuotas. The art share goes to the best
 * rung lane present ("art:system" before "art:raw"); mergeLanes gives what it leaves to the other
 * art lanes.
 */
export function zoneQuotas(count: number, lanes: readonly SearchLane[]): Map<SearchLane, number> {
  const ui = lanes.filter((l) => laneZone(l) !== "art");
  const art = lanes.filter((l) => laneZone(l) === "art").sort((a, b) => artLaneRank(a) - artLaneRank(b));
  if (art.length === 0) return laneQuotas(count, lanes);
  const share = ui.length === 0 ? count : artQuota(count);
  const quotas = ui.length === 0 ? new Map<SearchLane, number>() : laneQuotas(count - share, ui);
  art.forEach((lane, i) => quotas.set(lane, i === 0 ? share : 0));
  return quotas;
}

/** The art quota of a plan with these lanes: artQuota(count) next to UI lanes, all of count alone. */
export function artNeed(count: number, lanes: readonly SearchLane[]): number {
  return lanes.some((l) => laneZone(l) !== "art") ? artQuota(count) : count;
}

/** At most this many results by one creator or studio per search (owner, 2026-10-12). */
export const CREATOR_CAP = 2;

export type MergeOptions = {
  /** Creator or studio keys of a reference (lib/learning/creator.ts creatorKeys); each is capped. */
  groupsOf?: (ref: Reference) => readonly string[];
  /** Cap per group. Default CREATOR_CAP. */
  groupCap?: number;
};

/**
 * Merge lane lists: round robin across lanes (in the map's order), each lane up to its quota;
 * then places left in a zone go to that zone's other lanes first (an empty UI lane's places go
 * to the other UI lanes, not to art, and the other way round); then whatever is left, round robin,
 * until `count`. `keyOf` gives the dedupe keys of a reference; a reference that shares any key
 * with one already placed is skipped. With `groupsOf`, a reference whose creator or studio already
 * has `groupCap` places is skipped too (the studio cap).
 */
export function mergeLanes(
  lists: ReadonlyMap<SearchLane, readonly Reference[]>,
  quotas: ReadonlyMap<SearchLane, number>,
  count: number,
  keyOf: (ref: Reference) => string[],
  opts: MergeOptions = {},
): Reference[] {
  const out: Reference[] = [];
  const seen = new Set<string>();
  const groups = new Map<string, number>();
  const cap = opts.groupCap ?? CREATOR_CAP;
  const cursor = new Map<SearchLane, number>();
  const placed = new Map<SearchLane, number>();
  const lanes = [...lists.keys()];
  const zoneBudget = new Map<Zone, number>();
  for (const lane of lanes) zoneBudget.set(laneZone(lane), (zoneBudget.get(laneZone(lane)) ?? 0) + (quotas.get(lane) ?? 0));
  const zonePlaced = new Map<Zone, number>();
  const nextFrom = (lane: SearchLane): Reference | undefined => {
    const list = lists.get(lane) ?? [];
    let i = cursor.get(lane) ?? 0;
    while (i < list.length) {
      const ref = list[i++]!;
      const keys = keyOf(ref);
      if (keys.some((k) => seen.has(k))) continue;
      const g = opts.groupsOf?.(ref) ?? [];
      if (g.some((k) => (groups.get(k) ?? 0) >= cap)) continue;
      cursor.set(lane, i);
      for (const k of keys) seen.add(k);
      for (const k of g) groups.set(k, (groups.get(k) ?? 0) + 1);
      return ref;
    }
    cursor.set(lane, i);
    return undefined;
  };
  const roundRobin = (limit: "lane" | "zone" | "none") => {
    let progress = true;
    while (out.length < count && progress) {
      progress = false;
      for (const lane of lanes) {
        if (out.length >= count) break;
        if (limit === "lane" && (placed.get(lane) ?? 0) >= (quotas.get(lane) ?? 0)) continue;
        const zone = laneZone(lane);
        if (limit === "zone" && (zonePlaced.get(zone) ?? 0) >= (zoneBudget.get(zone) ?? 0)) continue;
        const ref = nextFrom(lane);
        if (!ref) continue;
        out.push(ref);
        placed.set(lane, (placed.get(lane) ?? 0) + 1);
        zonePlaced.set(zone, (zonePlaced.get(zone) ?? 0) + 1);
        progress = true;
      }
    }
  };
  roundRobin("lane");
  roundRobin("zone");
  roundRobin("none");
  return out;
}

/** UI results first, then art (stable): the agent places UI references and the art row apart. */
export function byZone<T extends { zone?: Zone }>(refs: readonly T[]): T[] {
  return [...refs.filter((r) => r.zone !== "art"), ...refs.filter((r) => r.zone === "art")];
}

/** The words of one lane: a string, or several for the component and art lanes; gallery lanes use the topic. */
export function laneValue(lanes: LaneTexts, lane: LaneName): string | string[] | undefined {
  switch (lane) {
    case "gallery":
      return lanes.galleries?.length ? lanes.topic || "design" : undefined;
    case "art":
      return lanes.art?.length ? lanes.art : undefined;
    case "component":
      return lanes.component?.length ? lanes.component : undefined;
    default:
      return lanes[lane];
  }
}
