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
 *                mobile: "dark {phrase} ui ios app {UI_NEG}" pinterest.com/pin (P0-17)
 *                web app: "dark mode minimal {domain} {page} ui {UI_NEG}" dribbble.com/shots
 *   light twin   "{phrase} ui ios app {UI_NEG}"             pinterest.com/pin, mobile, in the baseline
 *                (fidelity) lane in place of the fidelity Pinterest page
 *   component    "{core} {page} {component} {surface} {UI_NEG}"  dribbble.com/shots, up to 2 from the brief and pages
 *   baseline galleries  one head word on Nicelydone, then Refero (web app, baseline lane only)
 *
 * The hero lane ("{style} {domain} app single screen") is no longer planned (P0-17); an agent can
 * still re-search the hero lane with its own words.
 *
 * One source per request, path-scoped. At most SERPER_MAX_REQUESTS (8) requests per tool call;
 * what the base plan leaves is spent on page 2 and fallbacks (fidelity retried with the core noun).
 *
 * A plain query (no direction) is forced into UI forms too (plainQueryPlan): searched as is when
 * it already names a UI, else as "{q} app ui" and "{q} ui design", at most 4 requests.
 */
import type { Platform } from "../direction-detail";
import { hasUiWord, lensNegatives } from "./quality";
import { cleanQuery } from "./query";
import { sourceEntry } from "./registry";
import { SOURCE_SITES, isGallery, laneZone, type LaneName, type Mix, type Reference, type SourceSite, type Zone, type ZoneInput } from "./types";

/** Negatives for UI lanes: they cut template, kit and wireframe sales sheets. */
export const UI_NEG = "-template -kit -free -wireframe";
/** Negatives for the art lane: shop listings (unmeasured live; the junk gate is the real filter). */
export const ART_NEG = "-etsy -amazon -aliexpress -sale -buy";

/** Sites the art lane searches: the raw ingredient on pins and galleries (round 7: most reliable). */
export const ART_SITES: readonly SourceSite[] = ["pinterest", "behance"];
/** Most art queries a direction plans (bend gives 1 to 3). */
export const MAX_ART_QUERIES = 3;
/** Requests in a base plan; the rest of SERPER_MAX_REQUESTS (8) is kept for page 2 or a fallback. */
export const BASE_MAX_REQUESTS = 7;

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
  /** Where the taste lane searches (P0-17: Pinterest pins for mobile). Default Dribbble shots. */
  tasteSite?: SourceSite;
  /** The taste lane's retry when it brings back too little (web app: "dark {page} web app ui"). */
  tasteFallback?: string;
  fidelity?: string;
  /**
   * Mobile: the light twin of the taste lane ("paywall subscription ui ios app"), searched on
   * Pinterest in the baseline (fidelity) lane in place of the fidelity Pinterest page.
   */
  lightTwin?: string;
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
  /** Galleries searched only in the baseline (fidelity) lane, for "Shipped today" (web app: Nicelydone, Refero). */
  baselineGalleries?: SourceSite[];
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
   * Art zone: the direction's raw ingredients (its `artQueries`, else its idea), searched as is on
   * Pinterest pins and Behance galleries with the art junk gate. 1 to 3.
   */
  art?: string[];
  /**
   * Search plan v2 (P1-I3): the source an Atlas query recipe was judged on, per lane. The lane's
   * first request goes there instead of the lane's usual site.
   */
  recipeSites?: Partial<Record<LaneName, SourceSite>>;
  /**
   * False when the bridge words are an Atlas concept recipe (judged good as worded): its titles are
   * not filtered by the idea's head word.
   */
  bridgeTitleFilter?: boolean;
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
  // A page gallery (60fps) is searched with its page word: "pay" for checkout and payment, "card"
  // for card and wallet (round 13: "pay" gave CRED, Swiggy, Airbnb, Apple Pay).
  if (entry.pages?.length) {
    const t = ` ${plain.toLowerCase()} `;
    if (/ (?:card|cards|wallet|wallets) /.test(t)) return "card";
    if (/ (?:checkout|pay|payment|payments) /.test(t)) return "pay";
  }
  // One head word for galleries that match whole phrases badly (round 13: Nicelydone "analytics"
  // 94% on page, "analytics dashboard" 56%).
  const words = (entry.oneWord ? headWord(plain) : plain) || "design";
  return entry.suffix ? `${words} ${entry.suffix}` : words;
}

/** Words that are never a gallery's head word: the surface and page shells. */
const GALLERY_SHELL = new Set(["dashboard", "dashboards", "page", "pages", "screen", "screens", "web", "website", "saas", "admin", "panel"]);

/** The first word of a topic that is not a shell word ("analytics dashboard" gives "analytics"), else its first word. */
function headWord(plain: string): string {
  const ws = plain.split(" ").filter(Boolean);
  return ws.find((w) => !GALLERY_SHELL.has(w.toLowerCase())) ?? ws[0] ?? "";
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
  /** Keep a result only when its title has this word (bridge and locale lane precision filter, see titleHasWord). */
  titleWord?: string;
  /** UI lanes: drop a result whose title has any of these words (platform filter). */
  avoidWords?: string[];
  /** Art lane: the idea's head word; titles that name it rank higher (never a hard filter). */
  ideaWord?: string;
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
  // A lane's first request goes to its recipe's source (search plan v2), once.
  const recipeSiteUsed = new Set<LaneName>();
  const siteFor = (lane: LaneName, site: SourceSite): SourceSite => {
    const r = lanes.recipeSites?.[lane];
    if (!r || recipeSiteUsed.has(lane)) return site;
    recipeSiteUsed.add(lane);
    return r;
  };
  const add = (lane: LaneName, text: string | undefined, site: SourceSite, neg: boolean, fallback?: string, titleWord?: string) => {
    if (!text) return;
    out.push({
      lane,
      query: neg ? withNeg(text) : text,
      site: siteFor(lane, site),
      ...(fallback ? { fallback: neg ? withNeg(fallback) : fallback } : {}),
      ...(titleWord ? { titleWord } : {}),
      ...(avoid ? { avoidWords: avoid } : {}),
    });
  };
  const galleries = lanes.galleries ?? [];
  const addGallery = (site: SourceSite | undefined, lane: LaneName = "gallery") => {
    if (site) out.push({ lane, query: galleryWords(site, lanes.topic ?? lanes.fidelity ?? ""), site, ...(avoid ? { avoidWords: avoid } : {}) });
  };
  const baseGalleries = lanes.baselineGalleries ?? [];
  // Website and web app briefs: a platform gallery replaces the Pinterest fidelity page (Pinterest
  // is weak on web pages, round 4); for a web app it is the first baseline gallery (P0-17). Every
  // other gallery follows the first component lane.
  const web = lanes.platform === "website" || lanes.platform === "webapp";
  const first = web && !lanes.locale && baseGalleries.length === 0 ? galleries[0] : undefined;
  const components = (lanes.component ?? []).slice(0, MAX_COMPONENT_LANES);
  // P0-17: mobile and web app briefs lead with the taste bar lane (round 13: Pinterest "dark
  // {phrase} ui ios app" 50% great, Dribbble "dark mode minimal" 48% great).
  const tasteFirst = Boolean(lanes.tasteSite || lanes.tasteFallback);
  const addTaste = () => add("taste", lanes.taste, lanes.tasteSite ?? "dribbble", true, lanes.tasteFallback);
  // The bridge is the only UI lane that differs between the directions of one brief, so it goes
  // second: planned last, the both-zones cut dropped it and every direction got the same generic
  // shots (field report, 2026-10-12). A thin answer retries as "{ingredient} app ui".
  const addBridge = () => {
    if (!head || !lanes.bridge) return;
    const alt = lanes.bridge.replace(/ ui design$/, " app ui");
    add("bridge", lanes.bridge, "dribbble", true, alt !== lanes.bridge ? alt : undefined, lanes.bridgeTitleFilter === false ? undefined : head);
  };
  if (tasteFirst) {
    addTaste();
    addBridge();
    add("fidelity", lanes.fidelity, "dribbble", true, lanes.fidelityCore);
  } else {
    add("fidelity", lanes.fidelity, "dribbble", true, lanes.fidelityCore);
    addBridge();
    addTaste();
  }
  add("component", components[0], "dribbble", true);
  const rest = first ? galleries.slice(1) : galleries;
  // Mobile: a matched gallery (60fps on a pay page) goes before the light twin, which the
  // both-zones cut then drops (round 13: checkout has no Pinterest series, 60fps "pay" 4 of 8 great).
  const twinLast = Boolean(lanes.lightTwin && !lanes.locale && rest[0]);
  if (twinLast) addGallery(rest[0]);
  if (lanes.locale) add("locale", lanes.locale, "pinterest", true, undefined, lanes.localeWord);
  else if (baseGalleries[0]) addGallery(baseGalleries[0], "fidelity");
  else if (first) addGallery(first);
  else if (lanes.lightTwin) add("fidelity", lanes.lightTwin, "pinterest", true);
  else add("fidelity", lanes.fidelity, "pinterest", true, lanes.fidelityCore);
  if (!twinLast) addGallery(rest[0]);
  add("component", components[1], "dribbble", true);
  // Only an agent's own words fill the hero lane now (P0-17 dropped "{style} {domain} app single screen").
  add("hero", lanes.hero, "dribbble", false);
  for (const site of baseGalleries.slice(1)) addGallery(site, "fidelity");
  for (const site of rest.slice(1)) addGallery(site);
  return out;
}

/**
 * Art requests: the first art query on Pinterest pins, then on Behance galleries, then on a
 * matched art gallery (its fixed words or the art query); later art queries on Pinterest and
 * Behance. Galleries go after Behance: live, a niche idea on an art gallery found nothing
 * ("synthwave 1984" on typo/graphic posters, "holographic foil" on Cosmos), while Behance gave 2
 * to 7 good results. In a both-zones search the cut usually leaves them out; art-only searches
 * reach them.
 */
export function artRequests(queries: readonly string[] | undefined, galleries: readonly SourceSite[] = []): PlannedRequest[] {
  const out: PlannedRequest[] = [];
  const list = (queries ?? []).map(artWords).filter(Boolean).slice(0, MAX_ART_QUERIES);
  list.forEach((q, i) => {
    const ideaWord = bridgeHead(q) ?? undefined;
    const idea = ideaWord ? { ideaWord } : {};
    // A lens query also cuts the look-alike tradition ("talli" adds -tulle -assiut -egyptian).
    const neg = [lensNegatives(q), ART_NEG].filter(Boolean).join(" ");
    // A thin answer retries once with the bare noun ("limestone texture" retries "limestone").
    const bare = artBareNoun(q);
    const fallback = bare ? { fallback: `${bare} ${neg}` } : {};
    out.push({ lane: "art", query: `${q} ${neg}`, site: "pinterest", ...idea, ...fallback });
    out.push({ lane: "art", query: `${q} ${neg}`, site: "behance", ...idea, ...fallback });
    if (i === 0) for (const site of galleries) out.push({ lane: "art", query: galleryWords(site, q), site, ...idea });
  });
  return out;
}

/**
 * Stacked suffixes older bends added to art queries ("oversized ruler ticks graphic print
 * close-up" returned 0 results live, 2026-10-13). Saved directions still carry them, so they are
 * cut before searching (P0-16), with the "oversized" that came with them.
 */
const STACKED_ART = /\s+(?:graphic print close-up|design close-up)$/i;

/** An art query's plain words: no site operators, no negatives, no stacked suffix, at most 8 words. */
export function artWords(raw: string): string {
  let q = cleanQuery(raw.replace(/(^|\s)-\S+/g, " "));
  if (STACKED_ART.test(q)) q = q.replace(STACKED_ART, "").replace(/^oversized\s+/i, "");
  return q.split(" ").filter(Boolean).slice(0, 8).join(" ");
}

/** Medium words an art query may end with; the bare noun is what is left. */
const ART_MEDIUM = new Set(["texture", "textures", "pattern", "patterns", "poster", "posters", "graphic", "graphics", "print", "prints", "design", "close-up", "closeup", "illustration", "photo", "photography"]);

/**
 * The bare noun of an art query, for its one retry: the words left without medium words
 * ("limestone texture" gives "limestone", "synthwave 1984 poster" gives "synthwave 1984"). Null when
 * nothing would change ("ruler ticks", "exhibition catalog") or nothing is left.
 */
export function artBareNoun(query: string): string | null {
  const ws = artWords(query).split(" ").filter(Boolean);
  const bare = ws.filter((w) => !ART_MEDIUM.has(w.toLowerCase()));
  return bare.length > 0 && bare.length < ws.length ? bare.join(" ") : null;
}

/**
 * Requests in priority order (the budget cuts from the end), one page each.
 * UI: 1. fidelity on Dribbble, 2. bridge (only with a head word to filter its titles by), 3. taste,
 * 4. the first component lane, 5. fidelity on Pinterest (locale "arabic {core} {surface}" for
 * Arabic briefs, its titles filtered by the subject like the bridge lane's; website briefs search
 * a website gallery with the topic words instead, mobile briefs the light twin, web app briefs
 * their first baseline gallery), 6. a gallery, 7. the second component lane, 8. an agent's hero
 * words, then the other baseline galleries. Mobile and web app briefs start with taste (the taste
 * bar lane, P0-17), then the bridge, then fidelity; on mobile a matched gallery (60fps on a pay
 * page) goes before the light twin.
 * Art: each art query on Pinterest, then Behance.
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
 * unpicked site moves to the first picked art site; none picked, no art requests.
 */
function artOnSources(reqs: PlannedRequest[], sources?: readonly SourceSite[]): PlannedRequest[] {
  if (!sources || sources.length === 0) return reqs;
  const picked = SOURCE_SITES.filter((s) => sources.includes(s) && (ART_SITES.includes(s) || sourceEntry(s).zone === "art"));
  if (picked.length === 0) return [];
  const seen = new Set<string>();
  return reqs
    .map((r) => (picked.includes(r.site) ? r : { ...r, site: picked[0]! }))
    .filter((r) => {
      const key = `${r.query}|${r.site}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
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
  return artOnSources(artRequests([query]), sources.length > 0 ? sources : ART_SITES).map((r) => ({ query: r.query, site: r.site }));
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

/** The art zone's share of a direction search: about a third of `count`, at least 3 (never more than count). */
export function artQuota(count: number): number {
  return Math.min(count, Math.max(3, Math.round(count / 3)));
}

/**
 * Quotas when the art lane is present: art gets artQuota(count), the UI lanes share the rest
 * evenly (laneQuotas). Only art: all of it. No art: laneQuotas.
 */
export function zoneQuotas(count: number, lanes: readonly LaneName[]): Map<LaneName, number> {
  const ui = lanes.filter((l) => l !== "art");
  if (!lanes.includes("art")) return laneQuotas(count, lanes);
  if (ui.length === 0) return new Map([["art", count]]);
  const art = artQuota(count);
  const quotas = laneQuotas(count - art, ui);
  quotas.set("art", art);
  return quotas;
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
  lists: ReadonlyMap<LaneName, readonly Reference[]>,
  quotas: ReadonlyMap<LaneName, number>,
  count: number,
  keyOf: (ref: Reference) => string[],
  opts: MergeOptions = {},
): Reference[] {
  const out: Reference[] = [];
  const seen = new Set<string>();
  const groups = new Map<string, number>();
  const cap = opts.groupCap ?? CREATOR_CAP;
  const cursor = new Map<LaneName, number>();
  const placed = new Map<LaneName, number>();
  const lanes = [...lists.keys()];
  const zoneBudget = new Map<Zone, number>();
  for (const lane of lanes) zoneBudget.set(laneZone(lane), (zoneBudget.get(laneZone(lane)) ?? 0) + (quotas.get(lane) ?? 0));
  const zonePlaced = new Map<Zone, number>();
  const nextFrom = (lane: LaneName): Reference | undefined => {
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
