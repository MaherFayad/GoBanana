/**
 * `web_search` source adapter (spec section 8): Serper image search, link-out only.
 *
 * Serper images API (checked 2026-10-11):
 *   POST https://google.serper.dev/images
 *   headers: X-API-KEY, Content-Type: application/json
 *   body: { q, num }
 *   response: { searchParameters, images: [{ title, imageUrl, imageWidth, imageHeight,
 *     thumbnailUrl, thumbnailWidth, thumbnailHeight, source, domain, link, position }] }
 *   Widths and heights are numbers. thumbnailUrl is a Google thumbnail on encrypted-tbn0.gstatic.com.
 *
 * Hard rules this file keeps:
 * - Never fetch image bytes. The only network call is the Serper request.
 * - Never scrape, never fall back to another source on failure.
 * - Never log or return the API key.
 *
 * Image host policy (see DECISIONS.md): every URL we return must be on the image host
 * allowlist, because the inline canvas CSP only loads those hosts.
 * - image and thumb hosts allowed: keep both.
 * - only the image host allowed: use the image URL as the thumb too.
 * - only the thumb host allowed: keep the result and use the thumb URL as the image too.
 * - neither allowed: drop.
 *
 * Quality (see item-page.ts and quality.ts): only single-item source pages, no stock or shop
 * listings, no kit or template sales sheets, then per zone: UI results need a title that names a
 * UI (the UI gate, isUiResult; curated gallery items pass by definition); art results pass the art
 * junk gate instead (isArtJunk: no shops, prices, fashion, product listings, logo sheets).
 * Pinterest and Dribbble image URLs upgraded to their larger files, nothing under 600 px when the
 * size is known, then ranked best first (newer work and on-idea art titles score up).
 */
import { isAllowedImageUrl, allowlistFromEnv, type ImageHostAllowlist } from "./allowlist";
import { isItemPage } from "./item-page";
import { artDropReason, bigEnough, isJunk, isKitTitle, isUiResult, laneDropLine, lensExcludeWords, rankReferences, sizeRuleApplies, titleHasAny, upgradeImage } from "./quality";
import {
  CREATOR_CAP,
  FALLBACK_MIN_GOOD,
  PLAIN_MAX_REQUESTS,
  PLAIN_MIN_GOOD,
  artQueryPlan,
  bridgeHead,
  byZone,
  genreQueryPlan,
  plainGenre,
  mergeLanes,
  plainQueryPlan,
  plainRetryQuery,
  requestZone,
  titleHasWord,
  zoneQuotas,
  type LaneName,
  type PlannedRequest,
} from "./plan";
import { buildSourceQuery, normalizeSources } from "./query";
import { isGenreTitle, laneGenre, type Genre } from "./genre";
import { sourceEntry } from "./registry";
import {
  SOURCE_DOMAINS,
  isGallery,
  type Reference,
  type SourceAdapter,
  type SourceQuery,
  type SourceSearchResult,
  type SourceSite,
} from "./types";
import { hostMatchesDomain, parseHttpUrl } from "./url";
import { EMPTY_TAKEDOWNS, type TakedownMatcher } from "../takedown";
import { creatorKeys, nudgeByCreator } from "../learning/creator";
import { queryWords } from "../learning/terms";

export const SERPER_IMAGES_ENDPOINT = "https://google.serper.dev/images";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** One item of Serper's `images` array. Every field is optional because we never trust the shape. */
export type SerperImage = {
  title?: unknown;
  imageUrl?: unknown;
  imageWidth?: unknown;
  imageHeight?: unknown;
  thumbnailUrl?: unknown;
  thumbnailWidth?: unknown;
  thumbnailHeight?: unknown;
  source?: unknown;
  domain?: unknown;
  link?: unknown;
  position?: unknown;
};

export type WebSearchConfig = {
  /** SERPER_API_KEY. When missing the adapter returns no results with a note. */
  apiKey: string | undefined;
  /** Injectable for tests. Defaults to global fetch. */
  fetch?: FetchLike;
  /** Defaults to IMAGE_HOST_ALLOWLIST or the built-in list. */
  allowlist?: ImageHostAllowlist;
  /** Called on every search (spec section 2 rule 5). Defaults to an empty list. */
  loadTakedowns?: () => Promise<TakedownMatcher>;
  /** Request timeout. Default 8 seconds. */
  timeoutMs?: number;
};

export type WebSearchResult = SourceSearchResult & {
  /** True when Serper answered with 200. Callers count quota only then. */
  ok: boolean;
  /** Results dropped as list pages, low quality (stock, shop listings, small images) or not UI. Set when above 0. */
  dropped?: number;
  /** Why some of the dropped results went: off-tradition lens results, music or merch and shop or product art titles. Set when above 0. */
  droppedWhy?: DropWhy;
  /** Serper requests sent (one credit each). Set once the adapter got as far as searching. */
  requests?: number;
  /** Plain query path: what was searched, in order, each with its site operator. */
  queries?: string[];
};

/** Counts of results dropped for a reason the agent can act on (rephrase the query). */
export type DropWhy = { lens?: number; offTopic?: number; junk?: number };

/** Sum of drop reasons, or undefined when nothing was dropped for one. */
export function sumWhy(list: readonly (DropWhy | undefined)[]): DropWhy | undefined {
  const out: DropWhy = {};
  for (const k of ["lens", "offTopic", "junk"] as const) {
    const n = list.reduce((sum, w) => sum + (w?.[k] ?? 0), 0);
    if (n > 0) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export type WebSearchAdapter = SourceAdapter & {
  id: "web_search";
  /**
   * A plain query, forced into UI forms (lib/sources/plan.ts plainQueryPlan), at most 4 requests,
   * plus a plain note and whether the search provider answered.
   */
  run(q: SourceQuery): Promise<WebSearchResult>;
  /**
   * Run a direction's search plan (lib/sources/plan.ts): one page per request, lanes merged by
   * quota. Every result passes the UI gate; the bridge lane also needs the idea in its titles.
   */
  runPlan(plan: readonly PlannedRequest[], opts: RunPlanOptions): Promise<PlanSearchResult>;
};

export type RunPlanOptions = {
  count: number;
  userId: string;
  /** Source links already on the canvas: never returned again. */
  exclude?: readonly string[];
  /** Item keys (itemKey) the user blocked with rate_references: never returned again. */
  excludeKeys?: readonly string[];
  /** Normalized creators the user rated great (lib/learning/creator.ts): nudged up within each lane. */
  preferCreators?: readonly string[];
};

/** What one planned request brought back. */
export type PlanRequestReport = {
  lane: LaneName;
  site: SourceSite;
  query: string;
  /** Good results (item pages that passed every filter). */
  good: number;
  /** Results the quality and lane filters dropped (P0-16 lane waste log). */
  dropped?: number;
  /** Set when the request was retried with its fallback query. */
  retried?: string;
  /** Set when page 2 was fetched because page 1 was mostly already on the canvas or blocked. */
  page2?: true;
};

export type PlanSearchResult = WebSearchResult & { report?: PlanRequestReport[] };

export const NOTES = {
  notConfigured: "Image search is not set up yet, so no references were found.",
  unavailable: "Image search is not available right now. Try again in a few minutes.",
  rateLimited: "Image search is busy right now. Try again in a few minutes.",
  takedownsUnavailable: "Search is paused because the blocked sources list could not be loaded. Try again in a minute.",
  noResults: "No UI references found for that. Try naming the screen or product, for example 'banking app home'.",
} as const;

const MAX_TITLE = 200;

/**
 * Serper's free plan rejects `site:` queries that ask for more than 10 results
 * ("Query pattern not allowed for free accounts"), so we ask page by page, 10 at a time.
 */
export const SERPER_PAGE_SIZE = 10;

/**
 * Most pages one source query may fetch (one Serper credit each). The quality filters drop a lot,
 * so a query keeps paging until it has `count` references, a page comes back short, or a cap.
 */
export const SERPER_MAX_PAGES = 3;

/**
 * Serper allows 5 requests per second (HTTP 429 above that). At most 4 requests are in flight,
 * and one search_references call sends at most 8 requests (8 credits) in total.
 */
export const SERPER_MAX_IN_FLIGHT = 4;
export const SERPER_MAX_REQUESTS = 8;

/** Requests one run may send: `maxRequests` when given, never more than SERPER_MAX_REQUESTS. */
export function requestBudget(maxRequests?: number): number {
  if (maxRequests === undefined || !Number.isFinite(maxRequests)) return SERPER_MAX_REQUESTS;
  return Math.min(SERPER_MAX_REQUESTS, Math.max(1, Math.floor(maxRequests)));
}

/** Pages one source may fetch per run: `maxPages` when given, never more than SERPER_MAX_PAGES. */
export function serperPages(maxPages?: number): number {
  if (maxPages === undefined || !Number.isFinite(maxPages)) return SERPER_MAX_PAGES;
  return Math.min(SERPER_MAX_PAGES, Math.max(1, Math.floor(maxPages)));
}

/** FNV-1a 64-bit, hex. Sync and dependency free so it runs the same on Workers and Node. */
function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const bytes = new TextEncoder().encode(input);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

/** Stable reference id from the source page and the image URL. */
export function referenceId(sourceUrl: string, imageUrl: string): string {
  return `ref_${fnv1a64(`${sourceUrl}\n${imageUrl}`)}`;
}

function positiveInt(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n);
}

function cleanTitle(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  return t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE - 3).trimEnd()}...` : t;
}

/**
 * Key for one piece of work: Dribbble shot id, Pinterest pin id (the same on every country
 * subdomain), Behance gallery id, else the normalized URL.
 */
export function itemKey(sourceUrl: string): string {
  try {
    const u = new URL(sourceUrl);
    const host = u.hostname.toLowerCase();
    const shot = /^\/shots\/(\d+)/.exec(u.pathname);
    if (shot && hostMatchesDomain(host, "dribbble.com")) return `dribbble:${shot[1]}`;
    const pin = /^\/pin\/([A-Za-z0-9_-]+)/.exec(u.pathname);
    if (pin && hostMatchesDomain(host, "pinterest.com")) return `pinterest:${pin[1]}`;
    const gallery = /^\/gallery\/(\d+)/.exec(u.pathname);
    if (gallery && hostMatchesDomain(host, "behance.net")) return `behance:${gallery[1]}`;
  } catch {
    // fall through
  }
  return dedupeKey(sourceUrl);
}

/** Key used to spot the same image twice. */
export function dedupeKey(url: string): string {
  const u = new URL(url);
  u.hash = "";
  return u.toString().toLowerCase().replace(/\/+$/, "");
}

/** Which selected site a source page belongs to, or null when it is on none of them. */
export function matchSourceSite(link: URL, sources: readonly SourceSite[]): SourceSite | null {
  for (const site of sources) {
    if (hostMatchesDomain(link.hostname, SOURCE_DOMAINS[site])) return site;
  }
  return null;
}

export type MapOptions = {
  sources: readonly SourceSite[];
  allowlist: ImageHostAllowlist;
  takedowns: TakedownMatcher;
  count: number;
  /**
   * "ui" (default): the UI title gate. "art": the art junk gate instead (art zone). "genre": a
   * deck or brand search (lib/sources/genre.ts): core site titles must name the genre, gallery
   * items pass, and a templatesOk gallery (Pitch) skips the kit filter.
   */
  gate?: "ui" | "art" | "genre";
  /** With gate "genre": which genre's title words. */
  genre?: Genre;
  /** Art gate: the art query, so a product word it names is not junk ("persian rug"). */
  artQuery?: string;
  /** Art zone ranking: titles that name the idea's head word score up. */
  ideaWord?: string;
  /** UI zone: the query words, so a lens query drops off-tradition titles (the art gate uses artQuery). */
  lensQuery?: string;
};

export type MapResult = {
  /** Best first, at most `count`. */
  references: Reference[];
  /** List pages, low-quality and non-UI results dropped (not counting off-site, unsafe or blocked ones). */
  dropped: number;
  /** Of those, the ones dropped as off-tradition (lens) or music and merch (art). Set when above 0. */
  why?: DropWhy;
};

/**
 * Map Serper `images` to references and count what the quality rules dropped. Pure: no network,
 * no storage. Keeps only title, image URL, thumb URL, size, source page link and site.
 */
export function mapSerperImagesWithStats(images: unknown, opts: MapOptions): MapResult {
  if (!Array.isArray(images)) return { references: [], dropped: 0 };
  const out: Reference[] = [];
  const seenSource = new Set<string>();
  const seenImage = new Set<string>();
  let dropped = 0;
  const why = { lens: 0, offTopic: 0, junk: 0 };
  const lensWords = opts.gate === "art" ? [] : lensExcludeWords(opts.lensQuery);

  for (const raw of images as SerperImage[]) {
    if (!raw || typeof raw !== "object") continue;

    const link = parseHttpUrl(raw.link);
    if (!link) continue; // no source link, no reference (spec section 2 rule 3)
    const site = matchSourceSite(link, opts.sources);
    if (!site) continue; // source page is not on a selected site
    if (!isItemPage(link, site)) {
      dropped++; // search, tag, board, profile or collection page
      continue;
    }

    const image = parseHttpUrl(raw.imageUrl);
    // A site that still links some images over http (Brand New) is asked for them over https.
    if (image && image.protocol === "http:" && sourceEntry(site).httpsImages) image.protocol = "https:";
    const thumb = parseHttpUrl(raw.thumbnailUrl);
    const imageOk = image !== null && isAllowedImageUrl(image.toString(), opts.allowlist);
    const thumbOk = thumb !== null && isAllowedImageUrl(thumb.toString(), opts.allowlist);
    if (!imageOk && !thumbOk) continue;

    // Gallery item pages carry search state in the query ("?source=search"): the page is the same.
    if (isGallery(site)) {
      link.search = "";
      link.hash = "";
    }
    const sourceUrl = link.toString();
    // Check every URL Serper gave us, including one we are about to drop.
    if (
      opts.takedowns.isBlocked(sourceUrl) ||
      (image && opts.takedowns.isBlocked(image.toString())) ||
      (thumb && opts.takedowns.isBlocked(thumb.toString()))
    ) {
      continue;
    }

    if (
      isJunk({
        title: raw.title,
        source: raw.source,
        domain: raw.domain,
        sourceUrl,
        imageUrl: image?.toString(),
        thumbUrl: thumb?.toString(),
      })
    ) {
      dropped++; // stock, shop listing or list page title
      continue;
    }

    const title = cleanTitle(raw.title);
    // Kits and templates are sales sheets, never one designed screen (both zones). A genre gallery
    // whose items are all templates by design (Pitch) is the exception.
    const genreGate = opts.gate === "genre" && opts.genre ? opts.genre : null;
    if (isKitTitle(title) && !(genreGate && sourceEntry(site).templatesOk)) {
      dropped++;
      continue;
    }
    // UI zone: the title names a UI (untitled ones go too). Art zone: the junk gate instead.
    // Art zone: lens exclusions, shop junk, music and merch titles. UI zone: the gate, then lens exclusions.
    // Genre: gallery items pass, core site titles must name the genre.
    const reason = genreGate
      ? isGallery(site) || isGenreTitle(title, genreGate)
        ? null
        : "junk"
      : opts.gate === "art"
        ? artDropReason(title, opts.artQuery)
        : !isUiResult(title, sourceUrl)
          ? "junk"
          : titleHasAny(title, lensWords)
            ? "lens"
            : null;
    if (reason) {
      dropped++;
      if (reason === "lens") why.lens++;
      if (reason === "offTopic") why.offTopic++;
      // Art zone shop and product listings (the UI gate's non-UI titles are not counted here).
      if (reason === "junk" && opts.gate === "art") why.junk++;
      continue;
    }

    let imageUrl: string;
    let thumbUrl: string;
    let width: number | undefined;
    let height: number | undefined;
    if (imageOk && image) {
      // Larger file on the same host: Pinterest 736x, Dribbble original. The thumb stays as is.
      const up = upgradeImage(image, positiveInt(raw.imageWidth), positiveInt(raw.imageHeight));
      if (up.url !== image.toString() && (!isAllowedImageUrl(up.url, opts.allowlist) || opts.takedowns.isBlocked(up.url))) {
        continue;
      }
      imageUrl = up.url;
      thumbUrl = thumbOk && thumb ? thumb.toString() : image.toString();
      width = up.width;
      height = up.height;
    } else {
      // Only the thumbnail host is allowlisted: the thumbnail stands in for the image.
      thumbUrl = (thumb as URL).toString();
      imageUrl = thumbUrl;
      width = positiveInt(raw.thumbnailWidth) ?? positiveInt(raw.imageWidth);
      height = positiveInt(raw.thumbnailHeight) ?? positiveInt(raw.imageHeight);
    }

    // The size rule looks at the image the canvas will show (not Dribbble: its sizes are of resized variants).
    if (sizeRuleApplies(imageUrl) && !bigEnough(width, height)) {
      dropped++;
      continue;
    }

    const sourceKey = itemKey(sourceUrl);
    const imageKey = dedupeKey(imageUrl);
    if (seenSource.has(sourceKey) || seenImage.has(imageKey)) continue;
    seenSource.add(sourceKey);
    seenImage.add(imageKey);

    const ref: Reference = {
      id: referenceId(sourceUrl, imageUrl),
      thumbUrl,
      imageUrl,
      sourceUrl,
      sourceSite: SOURCE_DOMAINS[site],
    };
    if (title) ref.title = title;
    if (width && height) {
      ref.width = width;
      ref.height = height;
    }
    out.push(ref);
  }
  const reasons = sumWhy([why]);
  return {
    references: rankReferences(out, opts.ideaWord ? { ideaWord: opts.ideaWord } : {}).slice(0, Math.max(0, opts.count)),
    dropped,
    ...(reasons ? { why: reasons } : {}),
  };
}

/** Same as mapSerperImagesWithStats, references only. */
export function mapSerperImages(images: unknown, opts: MapOptions): Reference[] {
  return mapSerperImagesWithStats(images, opts).references;
}

/**
 * Merge result lists round robin (first list first), dropping repeats of a source page or an
 * image, up to `count`. Used to interleave the two lanes of a direction search.
 */
export function interleaveReferences(lists: readonly (readonly Reference[])[], count: number): Reference[] {
  const out: Reference[] = [];
  const seenSource = new Set<string>();
  const seenImage = new Set<string>();
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest && out.length < count; i++) {
    for (const list of lists) {
      const ref = list[i];
      if (!ref || out.length >= count) continue;
      const sourceKey = itemKey(ref.sourceUrl);
      const imageKey = dedupeKey(ref.imageUrl);
      if (seenSource.has(sourceKey) || seenImage.has(imageKey)) continue;
      seenSource.add(sourceKey);
      seenImage.add(imageKey);
      out.push(ref);
    }
  }
  return out;
}

/**
 * The studio cap (owner, 2026-10-12): at most `cap` results per creator or studio named in the
 * titles (lib/learning/creator.ts creatorKeys), keeping the order. Untitled or unnamed: no cap.
 */
export function capByCreator<T extends Pick<Reference, "title">>(refs: readonly T[], cap = CREATOR_CAP): T[] {
  const seen = new Map<string, number>();
  return refs.filter((r) => {
    const keys = creatorKeys(r.title);
    if (keys.some((k) => (seen.get(k) ?? 0) >= cap)) return false;
    for (const k of keys) seen.set(k, (seen.get(k) ?? 0) + 1);
    return true;
  });
}

/** Plain note for a search that found `found` of `count` references. */
export function countNote(found: number, count: number): string | undefined {
  if (found === 0) return NOTES.noResults;
  if (found < count) return `Found ${found} of ${count} requested references.`;
  return undefined;
}

function failure(note: string): WebSearchResult {
  return { references: [], note, ok: false };
}

type PageOutcome = { ok: true; images: unknown[] } | { ok: false; status: number };

/** Run `fn` over `items` with at most `limit` calls in flight, keeping the order of results. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export function createWebSearchAdapter(config: WebSearchConfig): WebSearchAdapter {
  const doFetch: FetchLike | undefined =
    config.fetch ?? (typeof fetch === "function" ? (input, init) => fetch(input, init) : undefined);
  const timeoutMs = config.timeoutMs ?? 8000;

  /** One Serper request. Never throws; the status code is logged, never the body. */
  async function fetchPage(apiKey: string, q: string, page: number): Promise<PageOutcome> {
    const init: RequestInit = {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(page === 1 ? { q, num: SERPER_PAGE_SIZE } : { q, num: SERPER_PAGE_SIZE, page }),
    };
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      init.signal = AbortSignal.timeout(timeoutMs);
    }
    try {
      const res = await doFetch!(SERPER_IMAGES_ENDPOINT, init);
      if (res.status !== 200) {
        // Status code only: the body or headers may echo request details.
        console.warn(`[search] serper page ${page} status ${res.status}`);
        return { ok: false, status: res.status };
      }
      const json: unknown = await res.json();
      const images = json && typeof json === "object" ? (json as { images?: unknown }).images : undefined;
      return { ok: true, images: Array.isArray(images) ? images : [] };
    } catch {
      // Network error, timeout or bad JSON. Never surface the raw error (it may echo request details).
      return { ok: false, status: 0 };
    }
  }

  /**
   * The plain query path: the query forced into UI forms (plainQueryPlan), page 1 of each; when
   * fewer than PLAIN_MIN_GOOD results survive, one retry with the short form (plainRetryQuery,
   * "teletext 1980s" to "teletext ui design"); then page 2 of full answers while results are short.
   * At most PLAIN_MAX_REQUESTS requests. Every result passes the UI gate.
   */
  async function run(q: SourceQuery): Promise<WebSearchResult> {
    const count = Math.min(50, Math.max(1, Math.floor(q.count)));
    const selected = normalizeSources(q.sources);
    const allowlist = config.allowlist ?? allowlistFromEnv();

    const apiKey = config.apiKey?.trim();
    if (!apiKey || !doFetch) return failure(NOTES.notConfigured);

    let takedowns: TakedownMatcher = EMPTY_TAKEDOWNS;
    if (config.loadTakedowns) {
      try {
        takedowns = await config.loadTakedowns();
      } catch {
        // Fail closed: never show results we could not check.
        return failure(NOTES.takedownsUnavailable);
      }
    }

    const excludedKeys = new Set(q.excludeKeys ?? []);
    const prefer = q.preferCreators ?? [];
    const budget = Math.min(requestBudget(q.maxRequests), PLAIN_MAX_REQUESTS);
    const art = q.zone === "art";
    // A deck or brand query (lib/sources/genre.ts) gets its genre's wordings and title gate.
    const genre = art ? null : plainGenre(q.query, q.genre);
    const planned = (
      art ? artQueryPlan(q.query, q.sources ?? []) : genre ? genreQueryPlan(q.query, genre, q.sources ?? []) : plainQueryPlan(q.query, selected)
    ).slice(0, budget);
    const artIdea = art ? bridgeHead(q.query) ?? undefined : undefined;
    if (planned.length === 0) return failure(NOTES.noResults);

    type Slot = { site: SourceSite; query: string; images: unknown[]; full: boolean; page: number; refs: Reference[]; dropped: number; why?: DropWhy };
    const slots: Slot[] = [];
    const sent: string[] = [];
    let requests = 0;
    let anyAnswered = false;
    let rateLimited = false;
    let references: Reference[] = [];

    /** Fetch the next page of each slot, keep what passes every filter, and re-merge. */
    const fetchRound = async (due: Slot[]) => {
      requests += due.length;
      const outcomes = await mapLimit(due, SERPER_MAX_IN_FLIGHT, (slot) => fetchPage(apiKey, slot.query, slot.page));
      due.forEach((slot, i) => {
        const out = outcomes[i]!;
        if (!out.ok) {
          // A failed or rate limited request keeps what the other requests found.
          slot.full = false;
          if (out.status === 429) rateLimited = true;
          return;
        }
        anyAnswered = true;
        slot.full = out.images.length >= SERPER_PAGE_SIZE;
        if (out.images.length === 0) return;
        slot.images.push(...out.images);
        const mapped = mapSerperImagesWithStats(slot.images, {
          sources: [slot.site],
          allowlist,
          takedowns,
          count: excludedKeys.size > 0 ? 50 : count,
          ...(art
            ? { gate: "art" as const, artQuery: q.query, ...(artIdea ? { ideaWord: artIdea } : {}) }
            : genre
              ? { gate: "genre" as const, genre }
              : { lensQuery: q.query }),
        });
        const kept = excludedKeys.size > 0 ? mapped.references.filter((r) => !excludedKeys.has(itemKey(r.sourceUrl))) : mapped.references;
        slot.refs = nudgeByCreator(kept.slice(0, count), prefer).map((r) => ({ ...r, zone: art ? ("art" as const) : ("ui" as const) }));
        slot.dropped = mapped.dropped;
        slot.why = mapped.why;
      });
      references = capByCreator(
        interleaveReferences(
          slots.map((s) => s.refs),
          count * 2,
        ),
      ).slice(0, count);
    };
    const addSlot = (query: string, site: SourceSite): Slot => {
      const slot: Slot = { site, query: buildSourceQuery(query, site), images: [], full: true, page: 1, refs: [], dropped: 0 };
      slots.push(slot);
      sent.push(slot.query);
      return slot;
    };

    await fetchRound(planned.map((r) => addSlot(r.query, r.site)));
    if (!anyAnswered) {
      return { ...failure(rateLimited ? NOTES.rateLimited : NOTES.unavailable), requests };
    }

    // Too few UI results: retry once with the short form on the first planned site.
    if (!art && !genre && references.length < PLAIN_MIN_GOOD && requests < budget) {
      const retry = plainRetryQuery(q.query, planned.map((r) => r.query));
      if (retry) await fetchRound([addSlot(retry, planned[0]!.site)]);
    }
    // A thin genre search: its first wording again without the subject (the measured wording).
    const genreRetry = genre ? planned.find((r) => r.fallback) : undefined;
    if (genreRetry?.fallback && references.length < PLAIN_MIN_GOOD && requests < budget) await fetchRound([addSlot(genreRetry.fallback, genreRetry.site)]);

    // Page 2 of full answers while results are short, fewest results first, within the budget.
    for (let page = 2; page <= serperPages(q.maxPages) && requests < budget && references.length < count; page++) {
      const due = slots
        .filter((s) => s.full && s.page === page - 1)
        .sort((a, b) => a.refs.length - b.refs.length)
        .slice(0, budget - requests);
      if (due.length === 0) break;
      for (const slot of due) slot.page = page;
      await fetchRound(due);
    }

    const result: WebSearchResult = { references, ok: true, requests, queries: sent };
    const note = countNote(references.length, count);
    if (note) result.note = note;
    const dropped = slots.reduce((n, s) => n + s.dropped, 0);
    if (dropped > 0) result.dropped = dropped;
    const droppedWhy = sumWhy(slots.map((s) => s.why));
    if (droppedWhy) result.droppedWhy = droppedWhy;
    return result;
  }

  async function runPlan(plan: readonly PlannedRequest[], opts: RunPlanOptions): Promise<PlanSearchResult> {
    const count = Math.min(50, Math.max(1, Math.floor(opts.count)));
    const allowlist = config.allowlist ?? allowlistFromEnv();
    const apiKey = config.apiKey?.trim();
    if (!apiKey || !doFetch) return failure(NOTES.notConfigured);
    if (plan.length === 0) return failure(NOTES.noResults);

    let takedowns: TakedownMatcher = EMPTY_TAKEDOWNS;
    if (config.loadTakedowns) {
      try {
        takedowns = await config.loadTakedowns();
      } catch {
        return failure(NOTES.takedownsUnavailable);
      }
    }

    type Slot = {
      req: PlannedRequest;
      refs: Reference[];
      dropped: number;
      why?: DropWhy;
      ok: boolean;
      status: number;
      /** Page 1 came back full (10 images), so a page 2 may exist. */
      full: boolean;
      /** Good results before the exclude filter. */
      before: number;
      retried?: string;
      page2?: true;
    };
    // References already on the canvas, or blocked by the user, are skipped, so sections that share
    // lanes get fresh results instead of the same shots (and a later search never pulls a kept
    // reference into another section).
    const excluded = new Set([...(opts.exclude ?? []).map(itemKey), ...(opts.excludeKeys ?? [])]);
    const mapPage = (req: PlannedRequest, query: string, images: unknown[]) => {
      const zone = requestZone(req);
      const words = queryWords(query);
      const genre = laneGenre(req.lane);
      const mapped = mapSerperImagesWithStats(images, {
        sources: [req.site],
        allowlist,
        takedowns,
        count: SERPER_PAGE_SIZE,
        ...(zone === "art"
          ? { gate: "art" as const, artQuery: words, ...(req.ideaWord ? { ideaWord: req.ideaWord } : {}) }
          : genre
            ? { gate: "genre" as const, genre }
            : { lensQuery: words }),
      });
      // Precision filter for the bridge lane (titles name the idea; round 10: 11 of 39 did) and the
      // locale lane (titles name the subject, so Quran and calligraphy apps drop out of "arabic flight app ui").
      const word = req.titleWord;
      const avoid = req.avoidWords ?? [];
      // Platform filter: an iPhone brief drops "web", "dashboard" and "landing" titles, and so on.
      const onTopic = mapped.references.filter((r) => (!word || titleHasWord(r.title, word)) && !titleHasAny(r.title, avoid));
      const kept = excluded.size === 0 ? onTopic : onTopic.filter((r) => !excluded.has(itemKey(r.sourceUrl)));
      return {
        references: kept.map((r) => ({ ...r, lane: req.lane, query: words, zone })),
        dropped: mapped.dropped + (mapped.references.length - onTopic.length),
        ...(mapped.why ? { why: mapped.why } : {}),
        before: onTopic.length,
      };
    };

    const base = plan.slice(0, SERPER_MAX_REQUESTS);
    let requests = base.length;
    const outcomes = await mapLimit(base, SERPER_MAX_IN_FLIGHT, (r) => fetchPage(apiKey, buildSourceQuery(r.query, r.site), r.page ?? 1));
    const slots: Slot[] = base.map((req, i) => {
      const out = outcomes[i]!;
      if (!out.ok) return { req, refs: [], dropped: 0, ok: false, status: out.status, full: false, before: 0 };
      const mapped = mapPage(req, req.query, out.images);
      return {
        req,
        refs: mapped.references,
        dropped: mapped.dropped,
        ...(mapped.why ? { why: mapped.why } : {}),
        ok: true,
        status: 200,
        full: out.images.length >= SERPER_PAGE_SIZE,
        before: mapped.before,
      };
    });
    if (!slots.some((s) => s.ok)) {
      const limited = slots.some((s) => s.status === 429);
      return { ...failure(limited ? NOTES.rateLimited : NOTES.unavailable), requests };
    }

    // Second round, within the budget, in priority order:
    // 1. Page 2 of a request whose page 1 was full and good but mostly already on the canvas or
    //    blocked (exhausted by the exclude filter, not a thin answer).
    // 2. The fallback query (core noun) of a thin answer.
    // A failed request (429, timeout) is not retried: that would only add load.
    const planned = new Set(base.map((r) => `${r.query}|${r.site}|${r.page ?? 1}`));
    const exhausted = slots.filter(
      (s) =>
        s.ok &&
        (s.req.page ?? 1) === 1 &&
        s.full &&
        s.before >= FALLBACK_MIN_GOOD &&
        s.refs.length < FALLBACK_MIN_GOOD &&
        !planned.has(`${s.req.query}|${s.req.site}|2`),
    );
    const thin = slots.filter((s) => s.ok && s.req.fallback && s.refs.length < FALLBACK_MIN_GOOD && !exhausted.includes(s));
    const jobs = [
      ...exhausted.map((slot) => ({ slot, page2: true })),
      ...thin.map((slot) => ({ slot, page2: false })),
    ].slice(0, Math.max(0, SERPER_MAX_REQUESTS - requests));
    requests += jobs.length;
    const second = await mapLimit(jobs, SERPER_MAX_IN_FLIGHT, (j) =>
      j.page2
        ? fetchPage(apiKey, buildSourceQuery(j.slot.req.query, j.slot.req.site), 2)
        : fetchPage(apiKey, buildSourceQuery(j.slot.req.fallback!, j.slot.req.site), 1),
    );
    jobs.forEach(({ slot, page2 }, i) => {
      const out = second[i]!;
      if (page2) slot.page2 = true;
      else slot.retried = slot.req.fallback;
      if (!out.ok) return;
      const mapped = mapPage(slot.req, page2 ? slot.req.query : slot.req.fallback!, out.images);
      // Page 2 goes after page 1 (rank order); a fallback answer is interleaved with the thin one.
      slot.refs = page2
        ? interleaveReferences([[...slot.refs, ...mapped.references]], SERPER_PAGE_SIZE * 2)
        : interleaveReferences([slot.refs, mapped.references], SERPER_PAGE_SIZE * 2);
      slot.dropped += mapped.dropped;
      const why = sumWhy([slot.why, mapped.why]);
      if (why) slot.why = why;
    });

    // Per lane: its requests interleaved, newer work first within the lane's rank, preferred
    // creators nudged up, then lanes merged by quota in plan order. An empty lane's quota goes to
    // the other lanes of its zone first.
    const byLane = new Map<LaneName, Reference[]>();
    for (const slot of slots) {
      const prev = byLane.get(slot.req.lane);
      byLane.set(slot.req.lane, prev ? interleaveReferences([prev, slot.refs], SERPER_PAGE_SIZE * 4) : slot.refs);
    }
    const prefer = opts.preferCreators ?? [];
    const lists = new Map<LaneName, Reference[]>();
    for (const [lane, list] of byLane) lists.set(lane, prefer.length > 0 ? nudgeByCreator(list, prefer) : list);
    // Art zone about a third (at least 3), UI lanes share the rest; at most 2 per creator or studio;
    // UI references first, then art (the agent places them in their own rows).
    const quotas = zoneQuotas(count, [...lists.keys()]);
    const references = byZone(
      mergeLanes(lists, quotas, count, (r) => [itemKey(r.sourceUrl), dedupeKey(r.imageUrl)], { groupsOf: (r) => creatorKeys(r.title) }),
    );

    const result: PlanSearchResult = {
      references,
      ok: true,
      requests,
      report: slots.map((s) => ({
        lane: s.req.lane,
        site: s.req.site,
        query: s.req.query,
        good: s.refs.length,
        dropped: s.dropped,
        ...(s.retried ? { retried: s.retried } : {}),
        ...(s.page2 ? { page2: true as const } : {}),
      })),
    };
    // Lane waste log (P0-16): dropped / returned per request; see docs/search-quality-experiment.md.
    for (const s of slots) {
      if (s.ok) console.info(laneDropLine({ lane: s.req.lane, site: s.req.site, query: s.req.query, dropped: s.dropped, kept: Math.max(s.before, s.refs.length) }));
    }
    const note = countNote(references.length, count);
    if (note) result.note = note;
    const dropped = slots.reduce((n, s) => n + s.dropped, 0);
    if (dropped > 0) result.dropped = dropped;
    const droppedWhy = sumWhy(slots.map((s) => s.why));
    if (droppedWhy) result.droppedWhy = droppedWhy;
    return result;
  }

  return {
    id: "web_search",
    run,
    runPlan,
    async search(q) {
      return (await run(q)).references;
    },
  };
}
