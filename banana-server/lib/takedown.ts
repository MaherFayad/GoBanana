/**
 * Takedown matcher (spec section 2 rule 5, section 11 `takedowns.url_or_domain`).
 *
 * Pure: give it the list of `url_or_domain` entries and ask whether a URL or a
 * reference is blocked. Loading the list from the database happens through an
 * injected loader so this file never imports `db/`.
 *
 * Matching rules:
 * - Domain entry (`example.com`, `www.example.com`, `https://example.com/`):
 *   blocks that host and every subdomain. `www.` is ignored on both sides.
 * - URL entry (`https://www.pinterest.com/pin/123/`): blocks that exact page.
 *   Scheme, `www.`, letter case, trailing slashes, default ports and `#fragment`
 *   are ignored. An entry without a query blocks the page with any query string.
 *   An entry with a query blocks only URLs that carry all of those query values.
 * - Matching is never a loose substring: `example.com` does not block `notexample.com`.
 */
import { hostMatchesDomain, normalizeHost, stripWww } from "./sources/url";

export type TakedownMatcher = {
  /** Number of usable entries. */
  readonly size: number;
  isBlocked(url: string | null | undefined): boolean;
  /** True when the source page, the image or the thumbnail is blocked. */
  isReferenceBlocked(ref: TakedownCheckable): boolean;
};

export type TakedownCheckable = {
  sourceUrl?: string | null;
  imageUrl?: string | null;
  thumbUrl?: string | null;
};

/** Loads `takedowns.url_or_domain` values. The DB-backed loader is wired in the tool layer. */
export type TakedownLoader = () => Promise<readonly string[]>;

type UrlRule = { key: string; query: [string, string][] };

type ParsedUrl = { host: string; key: string; params: URLSearchParams };

function parseLoose(value: string): ParsedUrl | null {
  let raw = value.trim();
  if (!raw) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    if (raw.startsWith("//")) raw = raw.slice(2);
    raw = `https://${raw}`;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = stripWww(normalizeHost(url.hostname));
  if (!host || !host.includes(".")) return null;
  let path = url.pathname.toLowerCase().replace(/\/+$/, "");
  try {
    path = decodeURIComponent(path).toLowerCase();
  } catch {
    // keep the raw path when it has broken escapes
  }
  return { host, key: `${host}${path}`, params: url.searchParams };
}

function lowerParams(params: URLSearchParams): [string, string][] {
  return [...params.entries()].map(([k, v]) => [k.toLowerCase(), v.toLowerCase()]);
}

/** Build a matcher from raw `url_or_domain` entries. Unparseable entries are ignored. */
export function compileTakedowns(entries: readonly (string | null | undefined)[]): TakedownMatcher {
  const domains = new Set<string>();
  const urls = new Map<string, UrlRule[]>();
  let size = 0;

  for (const entry of entries) {
    if (typeof entry !== "string") continue;
    const parsed = parseLoose(entry);
    if (!parsed) continue;
    const query = lowerParams(parsed.params);
    const isDomainOnly = parsed.key === parsed.host && query.length === 0;
    if (isDomainOnly) {
      domains.add(parsed.host);
    } else {
      const list = urls.get(parsed.key) ?? [];
      list.push({ key: parsed.key, query });
      urls.set(parsed.key, list);
    }
    size += 1;
  }

  const domainList = [...domains];

  function isBlocked(value: string | null | undefined): boolean {
    if (typeof value !== "string") return false;
    const parsed = parseLoose(value);
    if (!parsed) return false;
    if (domainList.some((d) => hostMatchesDomain(parsed.host, d))) return true;
    const rules = urls.get(parsed.key);
    if (!rules) return false;
    const have = lowerParams(parsed.params);
    return rules.some((rule) =>
      rule.query.every(([k, v]) => have.some(([hk, hv]) => hk === k && hv === v)),
    );
  }

  return {
    size,
    isBlocked,
    isReferenceBlocked(ref) {
      return isBlocked(ref.sourceUrl) || isBlocked(ref.imageUrl) || isBlocked(ref.thumbUrl);
    },
  };
}

/** Matcher that blocks nothing. Useful as a default in tests. */
export const EMPTY_TAKEDOWNS: TakedownMatcher = compileTakedowns([]);

/** Load entries through the injected loader and compile them. Loader errors are passed on. */
export async function loadTakedownMatcher(loader: TakedownLoader): Promise<TakedownMatcher> {
  return compileTakedowns(await loader());
}

/** Drop every item whose source page, image or thumbnail is on the takedown list. */
export function filterTakedowns<T extends TakedownCheckable>(
  items: readonly T[],
  matcher: TakedownMatcher,
): T[] {
  if (matcher.size === 0) return [...items];
  return items.filter((item) => !matcher.isReferenceBlocked(item));
}
