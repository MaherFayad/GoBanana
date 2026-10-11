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
 * listings, Pinterest and Dribbble image URLs upgraded to their larger files, nothing under
 * 600 px when the size is known, then ranked best first.
 */
import { isAllowedImageUrl, allowlistFromEnv, type ImageHostAllowlist } from "./allowlist";
import { isItemPage } from "./item-page";
import { bigEnough, isJunk, rankReferences, sizeRuleApplies, upgradeImage } from "./quality";
import { FALLBACK_MIN_GOOD, laneQuotas, mergeLanes, type LaneName, type PlannedRequest } from "./plan";
import { buildSourceQuery, normalizeSources } from "./query";
import {
  SOURCE_DOMAINS,
  type Reference,
  type SourceAdapter,
  type SourceQuery,
  type SourceSearchResult,
  type SourceSite,
} from "./types";
import { hostMatchesDomain, parseHttpUrl } from "./url";
import { EMPTY_TAKEDOWNS, type TakedownMatcher } from "../takedown";

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
  /** Results dropped as list pages or low quality (stock, shop listings, small images). Set when above 0. */
  dropped?: number;
  /** Serper requests sent (one credit each). Set once the adapter got as far as searching. */
  requests?: number;
};

export type WebSearchAdapter = SourceAdapter & {
  id: "web_search";
  /** Same as `search`, plus a plain note and whether the search provider answered. */
  run(q: SourceQuery): Promise<WebSearchResult>;
  /** Run a direction's search plan (lib/sources/plan.ts): one page per request, lanes merged by quota. */
  runPlan(plan: readonly PlannedRequest[], opts: { count: number; userId: string }): Promise<PlanSearchResult>;
};

/** What one planned request brought back. */
export type PlanRequestReport = {
  lane: LaneName;
  site: SourceSite;
  query: string;
  /** Good results (item pages that passed every filter). */
  good: number;
  /** Set when the request was retried with its fallback query. */
  retried?: string;
};

export type PlanSearchResult = WebSearchResult & { report?: PlanRequestReport[] };

export const NOTES = {
  notConfigured: "Image search is not set up yet, so no references were found.",
  unavailable: "Image search is not available right now. Try again in a few minutes.",
  rateLimited: "Image search is busy right now. Try again in a few minutes.",
  takedownsUnavailable: "Search is paused because the blocked sources list could not be loaded. Try again in a minute.",
  noResults: "No references found. Try other words or add more sources.",
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
};

export type MapResult = {
  /** Best first, at most `count`. */
  references: Reference[];
  /** List pages and low-quality results dropped (not counting off-site, unsafe or blocked ones). */
  dropped: number;
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
    const thumb = parseHttpUrl(raw.thumbnailUrl);
    const imageOk = image !== null && isAllowedImageUrl(image.toString(), opts.allowlist);
    const thumbOk = thumb !== null && isAllowedImageUrl(thumb.toString(), opts.allowlist);
    if (!imageOk && !thumbOk) continue;

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
    const title = cleanTitle(raw.title);
    if (title) ref.title = title;
    if (width && height) {
      ref.width = width;
      ref.height = height;
    }
    out.push(ref);
  }
  return { references: rankReferences(out).slice(0, Math.max(0, opts.count)), dropped };
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

    const budget = requestBudget(q.maxRequests);
    // With fewer requests than sources, search a rotating subset so lanes cover different sources.
    const offset = Math.max(0, Math.floor(q.sourceOffset ?? 0));
    const sources =
      budget >= selected.length ? selected : Array.from({ length: budget }, (_, i) => selected[(offset + i) % selected.length]!);
    const lanes = sources.map((site) => ({
      site,
      query: buildSourceQuery(q.query, site),
      images: [] as unknown[],
      full: true,
      refs: [] as Reference[],
      dropped: 0,
    }));
    const pages = serperPages(q.maxPages);
    let requests = 0;
    let references: Reference[] = [];
    let anyAnswered = false;
    let rateLimited = false;

    for (let page = 1; page <= pages && requests < budget; page++) {
      // Page 1 for every source; later pages only where the last page was full, fewest results first.
      const due = lanes
        .filter((l) => l.full)
        .sort((a, b) => a.refs.length - b.refs.length)
        .slice(0, budget - requests);
      if (due.length === 0) break;
      requests += due.length;
      const outcomes = await mapLimit(due, SERPER_MAX_IN_FLIGHT, (l) => fetchPage(apiKey, l.query, page));
      due.forEach((lane, i) => {
        const out = outcomes[i]!;
        if (!out.ok) {
          // A failed or rate limited request keeps what the other requests found.
          lane.full = false;
          if (out.status === 429) rateLimited = true;
          return;
        }
        anyAnswered = true;
        lane.full = out.images.length >= SERPER_PAGE_SIZE;
        if (out.images.length === 0) return;
        lane.images.push(...out.images);
        const mapped = mapSerperImagesWithStats(lane.images, { sources: [lane.site], allowlist, takedowns, count });
        lane.refs = mapped.references;
        lane.dropped = mapped.dropped;
      });
      if (!anyAnswered) break;
      references = interleaveReferences(
        lanes.map((l) => l.refs),
        count,
      );
      if (references.length >= count) break;
    }

    if (!anyAnswered) {
      return { ...failure(rateLimited ? NOTES.rateLimited : NOTES.unavailable), requests };
    }
    const result: WebSearchResult = { references, ok: true, requests };
    const note = countNote(references.length, count);
    if (note) result.note = note;
    const dropped = lanes.reduce((n, l) => n + l.dropped, 0);
    if (dropped > 0) result.dropped = dropped;
    return result;
  }

  async function runPlan(plan: readonly PlannedRequest[], opts: { count: number; userId: string }): Promise<PlanSearchResult> {
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

    type Slot = { req: PlannedRequest; refs: Reference[]; dropped: number; ok: boolean; status: number; retried?: string };
    const mapPage = (site: SourceSite, images: unknown[]) =>
      mapSerperImagesWithStats(images, { sources: [site], allowlist, takedowns, count: SERPER_PAGE_SIZE });

    const base = plan.slice(0, SERPER_MAX_REQUESTS);
    let requests = base.length;
    const outcomes = await mapLimit(base, SERPER_MAX_IN_FLIGHT, (r) => fetchPage(apiKey, buildSourceQuery(r.query, r.site), 1));
    const slots: Slot[] = base.map((req, i) => {
      const out = outcomes[i]!;
      if (!out.ok) return { req, refs: [], dropped: 0, ok: false, status: out.status };
      const mapped = mapPage(req.site, out.images);
      return { req, refs: mapped.references, dropped: mapped.dropped, ok: true, status: 200 };
    });
    if (!slots.some((s) => s.ok)) {
      const limited = slots.some((s) => s.status === 429);
      return { ...failure(limited ? NOTES.rateLimited : NOTES.unavailable), requests };
    }

    // Fallback ladder: a thin answer is retried once with its fallback query, within the budget.
    // A failed request (429, timeout) is not retried: that would only add load.
    const retry = slots
      .filter((s) => s.ok && s.req.fallback && s.refs.length < FALLBACK_MIN_GOOD)
      .slice(0, SERPER_MAX_REQUESTS - requests);
    requests += retry.length;
    const retried = await mapLimit(retry, SERPER_MAX_IN_FLIGHT, (s) => fetchPage(apiKey, buildSourceQuery(s.req.fallback!, s.req.site), 1));
    retry.forEach((slot, i) => {
      const out = retried[i]!;
      slot.retried = slot.req.fallback;
      if (!out.ok) return;
      const mapped = mapPage(slot.req.site, out.images);
      slot.refs = interleaveReferences([slot.refs, mapped.references], SERPER_PAGE_SIZE * 2);
      slot.dropped += mapped.dropped;
    });

    // Per lane: its requests interleaved, then lanes merged by quota.
    const lists = new Map<LaneName, Reference[]>();
    for (const slot of slots) {
      const prev = lists.get(slot.req.lane);
      lists.set(slot.req.lane, prev ? interleaveReferences([prev, slot.refs], SERPER_PAGE_SIZE * 4) : slot.refs);
    }
    const quotas = laneQuotas(count, [...lists.keys()]);
    const references = mergeLanes(lists, quotas, count, (r) => [itemKey(r.sourceUrl), dedupeKey(r.imageUrl)]);

    const result: PlanSearchResult = {
      references,
      ok: true,
      requests,
      report: slots.map((s) => ({
        lane: s.req.lane,
        site: s.req.site,
        query: s.req.query,
        good: s.refs.length,
        ...(s.retried ? { retried: s.retried } : {}),
      })),
    };
    const note = countNote(references.length, count);
    if (note) result.note = note;
    const dropped = slots.reduce((n, s) => n + s.dropped, 0);
    if (dropped > 0) result.dropped = dropped;
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
