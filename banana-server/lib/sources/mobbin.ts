/**
 * Mobbin screens on the board (owner decision, 2026-10-12). The agent finds them with the user's
 * own Mobbin connector (search_screens, search_flows, search_sections) and places them with
 * add_to_canvas `{ type: "screen" }`. GoBanana never searches Mobbin and never fetches its images:
 * the canvas hotlinks the image URL the connector returned and links every tile to its Mobbin page.
 *
 * Image URLs from the connector are short links on mobbin.com that redirect to a signed, expiring
 * URL on bytescale.mobbin.com (measured 2026-10-12; the connector says they expire after 30 days).
 * When one no longer loads, the tile turns into a link card to the Mobbin page.
 *
 * These hosts join the inline canvas CSP only, not the search image allowlist, so search results
 * and extract_palette (which reads allowlisted thumbnails in memory) never touch Mobbin images.
 */
import { hostMatchesDomain, normalizeHost, parseHttpUrl, stripWww } from "./url";

export const MOBBIN_SITE = "mobbin.com";
/** Hosts a Mobbin image loads from: the short link, then the CDN it redirects to. */
export const MOBBIN_IMAGE_HOSTS: readonly string[] = ["mobbin.com", "bytescale.mobbin.com"];
export const MAX_MOBBIN_SOURCE_URL = 500;
export const MAX_MOBBIN_IMAGE_URL = 2048;

/** A clean https URL: no credentials, no custom port, within `max` characters. */
function cleanHttps(value: string, max: number): URL | null {
  if (value.length > max) return null;
  const url = parseHttpUrl(value);
  if (!url || url.protocol !== "https:" || url.username || url.password || url.port) return null;
  return url;
}

/**
 * Checks a screen's page and image URLs. The page must be an https page on mobbin.com (not the
 * home page); the image must be https on mobbin.com or one of its subdomains. Returns the reason
 * when either fails.
 */
export function checkMobbinScreen(sourceUrl: string, imageUrl: string): { ok: true } | { ok: false; reason: string } {
  const page = cleanHttps(sourceUrl, MAX_MOBBIN_SOURCE_URL);
  if (!page || stripWww(normalizeHost(page.hostname)) !== MOBBIN_SITE || page.pathname.length < 2) {
    return { ok: false, reason: "sourceUrl must be the https link to the screen's page on mobbin.com." };
  }
  const image = cleanHttps(imageUrl, MAX_MOBBIN_IMAGE_URL);
  if (!image || !hostMatchesDomain(image.hostname, MOBBIN_SITE)) {
    return { ok: false, reason: "imageUrl must be the https image link the Mobbin connector returned (on mobbin.com)." };
  }
  return { ok: true };
}

/** True for a reference whose source page is on mobbin.com. */
export function isMobbinSource(ref: { sourceUrl?: string | null }): boolean {
  const url = parseHttpUrl(ref.sourceUrl);
  return url !== null && hostMatchesDomain(url.hostname, MOBBIN_SITE);
}
