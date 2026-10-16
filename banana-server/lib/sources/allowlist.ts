import { registryImageHosts } from "./registry";
import { normalizeHost, parseHttpUrl } from "./url";

/** Google image thumbnails Serper returns as thumbnailUrl (the fallback image for any source). */
export const THUMBNAIL_HOSTS: readonly string[] = [
  "encrypted-tbn0.gstatic.com",
  "encrypted-tbn1.gstatic.com",
  "encrypted-tbn2.gstatic.com",
  "encrypted-tbn3.gstatic.com",
];

/**
 * Museum open access image hosts for the CC0 art index (P1-J9), approved by the owner on 2026-10-16.
 * Items are public domain or CC0 by the museum API's own flag (CC0Item.rights).
 */
export const MUSEUM_IMAGE_HOSTS: readonly string[] = ["images.metmuseum.org", "openaccess-cdn.clevelandart.org"];

/**
 * Best Designs on X (bestdesignsonx.com, owner request 2026-10-16): design posts from X, mirrored
 * on the site's own Cloudflare CDN (posters, photos and clips; measured on 288 posts: every media
 * URL on this one host). Searched from a curated local index (lib/sources/bdox.ts), never Serper.
 */
export const BDOX_IMAGE_HOSTS: readonly string[] = ["cdn.bestdesignsonx.com"];

/**
 * Image hosts whose pictures are never a model input: no thumbnail pass-through to the agent
 * (lib/vision), no Atlas judging job (atlas-build/lib/thumbs.ts). They still show on the canvas,
 * linked to their source. Best Designs on X: X posts by third-party designers, no license for AI
 * use (X's terms bar using its content to train or fine-tune models). DECISIONS.md 2026-10-16.
 */
export const NO_MODEL_IMAGE_HOSTS: readonly string[] = [...BDOX_IMAGE_HOSTS];

/** The allowlist without the hosts in `drop` (exact entries): for model inputs. */
export function withoutHosts(allowlist: ImageHostAllowlist, drop: readonly string[] = NO_MODEL_IMAGE_HOSTS): ImageHostAllowlist {
  const out = new Set(drop.map((h) => h.toLowerCase()));
  return parseAllowlist(allowlist.entries.filter((e) => !out.has(e)));
}

/**
 * Image hosts the canvas may load from (spec sections 9 and 15): the Google thumbnail hosts plus
 * every source's image hosts from the source registry (lib/sources/registry.ts), each measured on
 * live Serper results. Exact hosts only. Shared CDNs in the list, flagged in the registry:
 * framerusercontent.com and video.gumlet.io (60fps), cdn.prod.website-files.com (SaaSFrame).
 * Bunny CDN hosts (*.b-cdn.net) are listed one exact pull zone at a time, each the source's own
 * (Unsection; Craftwork's craftwork-products, marketstorage and curated-images), never the zone.
 *
 * The same list feeds `_meta.ui.csp.resourceDomains` for the inline canvas, so any
 * search result whose image would load from another host is changed or dropped
 * at search time (see web-search.ts).
 *
 * Entry syntax:
 * - `i.pinimg.com`   exact host only.
 * - `*.example.com`  any subdomain of example.com (not example.com itself).
 *   A leading dot (`.example.com`) means the same thing.
 * Matching is exact host or listed suffix, never a loose substring.
 */
export const DEFAULT_IMAGE_HOSTS: readonly string[] = [...THUMBNAIL_HOSTS, ...registryImageHosts(), ...MUSEUM_IMAGE_HOSTS, ...BDOX_IMAGE_HOSTS];

export type ImageHostAllowlist = {
  /** Exact hosts. */
  hosts: ReadonlySet<string>;
  /** Suffixes including the leading dot, e.g. ".pinimg.com". */
  suffixes: readonly string[];
  /** Normalized entries in their original form, for CSP `resourceDomains`. */
  entries: readonly string[];
};

const HOST_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Parse a comma or whitespace separated list. Invalid entries are skipped. */
export function parseAllowlist(raw: string | readonly string[]): ImageHostAllowlist {
  const parts = typeof raw === "string" ? raw.split(/[\s,]+/) : raw;
  const hosts = new Set<string>();
  const suffixes = new Set<string>();
  const entries: string[] = [];
  for (const part of parts) {
    let entry = normalizeHost(part);
    if (!entry) continue;
    // Allow full URLs in the env var by mistake: keep only the host.
    if (entry.includes("://")) {
      const url = parseHttpUrl(entry);
      if (!url) continue;
      entry = normalizeHost(url.hostname);
    }
    let wildcard = false;
    if (entry.startsWith("*.")) {
      wildcard = true;
      entry = entry.slice(2);
    } else if (entry.startsWith(".")) {
      wildcard = true;
      entry = entry.slice(1);
    }
    if (!HOST_RE.test(entry)) continue;
    if (wildcard) {
      if (!suffixes.has(`.${entry}`)) entries.push(`*.${entry}`);
      suffixes.add(`.${entry}`);
    } else {
      if (!hosts.has(entry)) entries.push(entry);
      hosts.add(entry);
    }
  }
  return { hosts, suffixes: [...suffixes], entries };
}

/**
 * Allowlist from `IMAGE_HOST_ALLOWLIST`. When the variable is unset or has no valid
 * entries, the defaults are used. The env var replaces the defaults; it does not add to them.
 */
export function allowlistFromEnv(envValue: string | undefined = readEnv()): ImageHostAllowlist {
  if (envValue && envValue.trim()) {
    const parsed = parseAllowlist(envValue);
    if (parsed.entries.length > 0) return parsed;
  }
  return parseAllowlist(DEFAULT_IMAGE_HOSTS);
}

export function isAllowedHost(host: string, allowlist: ImageHostAllowlist): boolean {
  const h = normalizeHost(host);
  if (!h) return false;
  if (allowlist.hosts.has(h)) return true;
  return allowlist.suffixes.some((s) => h.endsWith(s) && h.length > s.length);
}

/** True for an https URL on an allowlisted host. Plain http is refused (mixed content in the canvas). */
export function isAllowedImageUrl(value: unknown, allowlist: ImageHostAllowlist): boolean {
  const url = parseHttpUrl(value);
  if (!url || url.protocol !== "https:") return false;
  return isAllowedHost(url.hostname, allowlist);
}

/** CSP `resourceDomains` values for the inline canvas (`https://host` or `https://*.host`). */
export function allowlistToCspDomains(allowlist: ImageHostAllowlist): string[] {
  return allowlist.entries.map((e) => `https://${e}`);
}

function readEnv(): string | undefined {
  try {
    return typeof process !== "undefined" ? process.env?.IMAGE_HOST_ALLOWLIST : undefined;
  } catch {
    return undefined;
  }
}
