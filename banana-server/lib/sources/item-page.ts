/**
 * Single-item source pages (pure). A reference must link to one piece of work, not to a
 * search, tag, board, profile, collection, business or blog page: those are lists of other
 * people's images and their thumbnail is usually a tiny collage.
 *
 * URL shapes (checked 2026-10-11 against live Serper results and public URLs):
 * - Dribbble: `/shots/<digits>` or `/shots/<digits>-<slug>`. Drops `/search/...`, `/tags/...`,
 *   `/shots/popular`, profiles (`/<user>`) and collections.
 * - Pinterest: `/pin/<id>` on pinterest.com or any country subdomain (es., jp., kr., in., de., cl.,
 *   mx., nz., uk., fr., ie. ...). Drops boards (`/<user>/<board>/`), `/ideas/...`, `/search/...` and
 *   the business., help., policy. and newsroom. subdomains (no pins live there).
 * - Behance: `/gallery/<digits>` (one project). Drops `/search/...`, profiles and moodboards.
 * - Awwwards: `/sites/<slug>` (one site page) and `/inspiration/<slug>` (one inspiration element).
 *   Not verified from a live result: the experiment returned no Awwwards item pages, so these two
 *   shapes come from public URLs only. `/websites/...`, `/inspiration/` alone, `/blog/...` and
 *   `/academy/...` are lists or articles and are dropped.
 */
import { SOURCE_DOMAINS, type SourceSite } from "./types";
import { hostMatchesDomain, normalizeHost, stripWww } from "./url";

const PINTEREST_NON_PIN_HOSTS = new Set(["business", "help", "policy", "newsroom", "developers", "ads", "analytics"]);

const AWWWARDS_RESERVED = new Set(["search", "all", "latest", "popular", "category", "tag", "tags"]);

function pinterestHostOk(host: string): boolean {
  const h = stripWww(normalizeHost(host));
  if (h === "pinterest.com") return true;
  const sub = h.slice(0, -".pinterest.com".length);
  return !PINTEREST_NON_PIN_HOSTS.has(sub);
}

/** True when `url` is one item page on `site` (and on that site's domain). */
export function isItemPage(url: URL, site: SourceSite): boolean {
  if (!hostMatchesDomain(url.hostname, SOURCE_DOMAINS[site])) return false;
  const path = url.pathname;
  switch (site) {
    case "dribbble":
      return /^\/shots\/\d+(?:-[^/]*)?(?:\/|$)/.test(path);
    case "pinterest":
      return pinterestHostOk(url.hostname) && /^\/pin\/[A-Za-z0-9_-]+(?:\/|$)/.test(path);
    case "behance":
      return /^\/gallery\/\d+(?:\/|$)/.test(path);
    case "awwwards": {
      const m = /^\/(sites|inspiration)\/([a-z0-9][a-z0-9-]*)\/?$/i.exec(path);
      return Boolean(m && !AWWWARDS_RESERVED.has(m[2]!.toLowerCase()));
    }
  }
}
