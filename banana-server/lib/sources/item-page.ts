/**
 * Single-item source pages (pure). A reference must link to one piece of work, not to a
 * search, tag, board, profile, collection, business or blog page: those are lists of other
 * people's images and their thumbnail is usually a tiny collage.
 *
 * The URL shape of every site lives in the source registry (lib/sources/registry.ts `item`),
 * checked against live Serper results:
 * - Dribbble `/shots/<digits>` or `/shots/<digits>-<slug>` (no search, tag, profile pages).
 * - Pinterest `/pin/<id>` on pinterest.com or a country subdomain, never business., help.,
 *   policy. or newsroom. (no boards, `/ideas/`, `/search/`).
 * - Behance `/gallery/<digits>` (one project).
 * - Awwwards `/sites/<slug>` and `/inspiration/<slug>` (confirmed live 2026-10-12), never
 *   `/sites/search` and the like.
 * - Galleries: one entry each (Lapa Ninja `/post/<slug>`, Refero `/pages/<uuid>`, ...).
 */
import { registryItemPath } from "./registry";
import { SOURCE_DOMAINS, type SourceSite } from "./types";
import { hostMatchesDomain } from "./url";

/** True when `url` is one item page on `site` (and on that site's domain). */
export function isItemPage(url: URL, site: SourceSite): boolean {
  if (!hostMatchesDomain(url.hostname, SOURCE_DOMAINS[site])) return false;
  return registryItemPath(site, url.hostname, url.pathname);
}
