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
 */
import { isAllowedImageUrl, allowlistFromEnv, type ImageHostAllowlist } from "./allowlist";
import { buildSearchQuery, normalizeSources } from "./query";
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
};

export type WebSearchAdapter = SourceAdapter & {
  id: "web_search";
  /** Same as `search`, plus a plain note and whether the search provider answered. */
  run(q: SourceQuery): Promise<WebSearchResult>;
};

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

/** Pages to fetch: about twice what we need (filtering drops some), at most 3 (one credit each). */
export function serperPages(count: number): number {
  return Math.min(3, Math.max(1, Math.ceil((Math.max(1, count) * 2) / SERPER_PAGE_SIZE)));
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

function dedupeKey(url: string): string {
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

/**
 * Map Serper `images` to references. Pure: no network, no storage.
 * Keeps only title, image URL, thumb URL, size, source page link and site.
 */
export function mapSerperImages(images: unknown, opts: MapOptions): Reference[] {
  if (!Array.isArray(images)) return [];
  const out: Reference[] = [];
  const seenSource = new Set<string>();
  const seenImage = new Set<string>();

  for (const raw of images as SerperImage[]) {
    if (out.length >= opts.count) break;
    if (!raw || typeof raw !== "object") continue;

    const link = parseHttpUrl(raw.link);
    if (!link) continue; // no source link, no reference (spec section 2 rule 3)
    const site = matchSourceSite(link, opts.sources);
    if (!site) continue; // source page is not on a selected site

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

    let imageUrl: string;
    let thumbUrl: string;
    let width: number | undefined;
    let height: number | undefined;
    if (imageOk && image) {
      imageUrl = image.toString();
      thumbUrl = thumbOk && thumb ? thumb.toString() : imageUrl;
      width = positiveInt(raw.imageWidth);
      height = positiveInt(raw.imageHeight);
    } else {
      // Only the thumbnail host is allowlisted: the thumbnail stands in for the image.
      thumbUrl = (thumb as URL).toString();
      imageUrl = thumbUrl;
      width = positiveInt(raw.thumbnailWidth) ?? positiveInt(raw.imageWidth);
      height = positiveInt(raw.thumbnailHeight) ?? positiveInt(raw.imageHeight);
    }

    const sourceKey = dedupeKey(sourceUrl);
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
  return out;
}

function failure(note: string): WebSearchResult {
  return { references: [], note, ok: false };
}

export function createWebSearchAdapter(config: WebSearchConfig): WebSearchAdapter {
  const doFetch: FetchLike | undefined =
    config.fetch ?? (typeof fetch === "function" ? (input, init) => fetch(input, init) : undefined);
  const timeoutMs = config.timeoutMs ?? 8000;

  async function run(q: SourceQuery): Promise<WebSearchResult> {
    const count = Math.min(50, Math.max(1, Math.floor(q.count)));
    const sources = normalizeSources(q.sources);
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

    const searchQuery = buildSearchQuery(q.query, sources);
    const pages = serperPages(count);
    const images: unknown[] = [];
    let references: Reference[] = [];

    for (let page = 1; page <= pages; page++) {
      const init: RequestInit = {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(
          page === 1 ? { q: searchQuery, num: SERPER_PAGE_SIZE } : { q: searchQuery, num: SERPER_PAGE_SIZE, page },
        ),
      };
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        init.signal = AbortSignal.timeout(timeoutMs);
      }

      let json: unknown;
      try {
        const res = await doFetch(SERPER_IMAGES_ENDPOINT, init);
        if (res.status !== 200) {
          // Status code only: the body or headers may echo request details.
          console.warn(`[search] serper page ${page} status ${res.status}`);
          if (page > 1) break; // keep what earlier pages found
          return failure(res.status === 429 ? NOTES.rateLimited : NOTES.unavailable);
        }
        json = await res.json();
      } catch {
        // Network error, timeout or bad JSON. Never surface the raw error (it may echo request details).
        if (page > 1) break;
        return failure(NOTES.unavailable);
      }

      const pageImages = json && typeof json === "object" ? (json as { images?: unknown }).images : undefined;
      if (!Array.isArray(pageImages) || pageImages.length === 0) break;
      images.push(...pageImages);
      references = mapSerperImages(images, { sources, allowlist, takedowns, count });
      if (references.length >= count || pageImages.length < SERPER_PAGE_SIZE) break;
    }

    const result: WebSearchResult = { references, ok: true };
    if (references.length === 0) result.note = NOTES.noResults;
    else if (references.length < count) {
      result.note = `Found ${references.length} of ${count} requested references.`;
    }
    return result;
  }

  return {
    id: "web_search",
    run,
    async search(q) {
      return (await run(q)).references;
    },
  };
}
