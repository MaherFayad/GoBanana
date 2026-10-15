/**
 * Thumbnails for judging jobs (plan 6.1): fetched into memory and sent to the API as base64,
 * never written to disk, logged or cached.
 *
 * The host allowlist and the in-memory fetch (redirect checks, timeout, byte cap) are imported
 * from banana-server so both stay the same list: lib/sources/allowlist.ts, lib/sources/mobbin.ts and
 * lib/palette/fetch.ts. Those files have no "@/" imports, so they load here as is. The size
 * variant rules below are copied from banana-server/lib/vision/thumbs.ts (keep them in step).
 */
import type Anthropic from "@anthropic-ai/sdk";
import { fetchThumbIntoMemory, type FetchLike } from "../../banana-server/lib/palette/fetch.ts";
import { DEFAULT_IMAGE_HOSTS, isAllowedImageUrl, parseAllowlist, type ImageHostAllowlist } from "../../banana-server/lib/sources/allowlist.ts";
import { MOBBIN_IMAGE_HOSTS } from "../../banana-server/lib/sources/mobbin.ts";
import { parseHttpUrl } from "../../banana-server/lib/sources/url.ts";

/** Same caps as banana-server/lib/vision/thumbs.ts. */
export const MAX_THUMB_BYTES = 300 * 1024;
export const THUMB_TIMEOUT_MS = 3_000;

/** The thumbnail allowlist: the image allowlist plus Mobbin's image hosts (as the server does). */
export function thumbAllowlist(): ImageHostAllowlist {
  return parseAllowlist([...DEFAULT_IMAGE_HOSTS, ...MOBBIN_IMAGE_HOSTS]);
}

/** Copied from banana-server/lib/vision/thumbs.ts: the source CDN's own small variant. */
export function smallVariant(url: string): string {
  const u = parseHttpUrl(url);
  if (!u) return url;
  const host = u.hostname.toLowerCase();
  if (host === "i.pinimg.com") {
    u.pathname = u.pathname.replace(/^\/(?:\d+x(?:\d+)?|originals)\//, "/236x/");
  } else if (host === "cdn.dribbble.com") {
    u.searchParams.set("resize", "400x300");
  } else if (host === "mir-s3-cdn-cf.behance.net" || host === "mir-cdn.behance.net") {
    u.pathname = u.pathname.replace(/\/project_modules\/[^/]+\//, "/project_modules/disp/");
  } else if (host === "framerusercontent.com") {
    u.searchParams.set("scale-down-to", "512");
  } else {
    return url;
  }
  return u.toString();
}

/** Copied from banana-server/lib/vision/thumbs.ts: the one URL to fetch, or null. */
export function pickThumbUrl(t: { imageUrl?: string | null; thumbUrl?: string | null }, allowlist: ImageHostAllowlist): string | null {
  const image = t.imageUrl ?? "";
  const candidates = [image && smallVariant(image) !== image ? smallVariant(image) : null, t.thumbUrl ? smallVariant(t.thumbUrl) : null, image || null];
  for (const c of candidates) if (c && isAllowedImageUrl(c, allowlist)) return c;
  return null;
}

/** Copied from banana-server/lib/vision/thumbs.ts: JPEG, PNG, GIF or WebP from the first bytes. */
export function sniffImageType(b: Uint8Array): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

export type ThumbResult = { ok: true; url: string; block: Anthropic.ImageBlockParam } | { ok: false; reason: string };

/**
 * Fetches one reference's thumbnail into memory and returns it as an API image block (base64).
 * The bytes exist only in the returned object.
 */
export async function fetchThumbBlock(
  t: { imageUrl?: string | null; thumbUrl?: string | null },
  opts: { allowlist?: ImageHostAllowlist; fetchImpl?: FetchLike; maxBytes?: number; timeoutMs?: number } = {},
): Promise<ThumbResult> {
  const allowlist = opts.allowlist ?? thumbAllowlist();
  const url = pickThumbUrl(t, allowlist);
  if (!url) return { ok: false, reason: "not_allowed" };
  const r = await fetchThumbIntoMemory(url, {
    allowedHosts: allowlist.entries,
    fetchImpl: opts.fetchImpl,
    maxBytes: opts.maxBytes ?? MAX_THUMB_BYTES,
    timeoutMs: opts.timeoutMs ?? THUMB_TIMEOUT_MS,
  });
  if (!r.ok) return { ok: false, reason: r.reason };
  const mediaType = sniffImageType(r.bytes);
  if (!mediaType) return { ok: false, reason: "format" };
  return { ok: true, url, block: { type: "image", source: { type: "base64", media_type: mediaType, data: Buffer.from(r.bytes).toString("base64") } } };
}
