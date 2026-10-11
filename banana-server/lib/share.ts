/**
 * Share links (spec hard rule 6): unlisted, view-only, never indexed.
 * Pure: Web Crypto only, safe on Workers, in the browser and in Vitest.
 */
import type { Metadata } from "next";

/** 18 random bytes = 144 bits, encoded as 24 url-safe base64 characters. */
export const SHARE_TOKEN_BYTES = 18;
export const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/;

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** New unguessable token for `canvases.share_token`. */
export function generateShareToken(bytes: number = SHARE_TOKEN_BYTES): string {
  if (!Number.isInteger(bytes) || bytes < 16) throw new RangeError("share tokens need at least 16 random bytes");
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Cheap shape check before any database lookup. */
export function isValidShareToken(token: unknown): token is string {
  return typeof token === "string" && SHARE_TOKEN_RE.test(token);
}

export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/s/${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------------
// noindex
// ---------------------------------------------------------------------------

export const ROBOTS_HEADER = "X-Robots-Tag";
export const NOINDEX_HEADER_VALUE = "noindex";

/** Paths that must never be indexed: shared canvases and the private canvas editor. */
export function needsNoindex(pathname: string): boolean {
  return /^\/(s|c)(\/|$)/.test(pathname);
}

/** Adds `X-Robots-Tag: noindex` to a Headers object (for route handlers and proxy.ts). */
export function applyNoindex(headers: Headers): Headers {
  headers.set(ROBOTS_HEADER, NOINDEX_HEADER_VALUE);
  return headers;
}

/** Renders `<meta name="robots" content="noindex, nofollow">` (plus the googlebot variant). */
export const noindexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};
