/**
 * X posts on the canvas (DECISIONS.md 2026-10-16, "X post embeds").
 *
 * An X post item keeps only the post URL, its id, the author's name and handle, the post text
 * and our own note and tag. The fields come from X's public oEmbed endpoint (no key, the one
 * X documents for embeds), cached by post id. The server never fetches x.com pages, never
 * stores X media and never captures a post: the web canvas shows X's official embed in the
 * browser, and a screenshot for Frankenstein comes from the user's own Claude
 * (attach_screenshot).
 *
 * X posts are never a model input: they have no thumbnail, so nothing about them reaches the
 * vision pass-through or the Atlas jobs, and the post text is not sent back by the tools.
 *
 * Pure apart from the injected fetch, so Vitest covers it with a mock (no live calls in tests).
 */
import { normalizeHost, parseHttpUrl } from "@/lib/sources/url";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** The site name every X post item carries (source chip, takedown checks, exports). */
export const X_SITE = "x.com";

/** Hosts an X post link may use. Anything else is not an X post. */
export const X_POST_HOSTS: readonly string[] = ["x.com", "www.x.com", "mobile.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"];

/** X's documented oEmbed endpoint (publish.twitter.com answers with a 301 to it). */
export const OEMBED_ENDPOINT = "https://publish.x.com/oembed";

/** X's widget script, loaded by the web canvas only, and only when a post is on screen. */
export const X_WIDGETS_SCRIPT = "https://platform.twitter.com/widgets.js";

/** Longest post text kept (long posts are cut for the card; the embed shows the whole post). */
export const MAX_POST_TEXT = 1000;
export const MAX_POST_URL = 300;

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;
const ID_RE = /^\d{1,20}$/;

/** A parsed X post link: the post id, the handle when the link names one, and the canonical URL. */
export type XPostLink = { postId: string; handle?: string; url: string };

/** What the canvas stores about a post. */
export type XPost = {
  postId: string;
  /** Canonical `https://x.com/<handle>/status/<id>`. */
  url: string;
  authorName: string;
  authorHandle: string;
  text: string;
};

/** Canonical post URL. */
export function postUrl(handle: string | undefined, postId: string): string {
  return handle ? `https://x.com/${handle}/status/${postId}` : `https://x.com/i/web/status/${postId}`;
}

/**
 * Parses an X post link: `x.com/<handle>/status/<id>` (also twitter.com, mobile and www hosts,
 * `/statuses/`, `/i/web/status/` and `/i/status/`, extra path parts like `/photo/1`, any query).
 * Returns null for anything that is not one post.
 */
export function parsePostUrl(value: unknown): XPostLink | null {
  if (typeof value !== "string" || value.length > MAX_POST_URL) return null;
  const url = parseHttpUrl(value);
  if (!url || url.username || url.password) return null;
  if (!X_POST_HOSTS.includes(normalizeHost(url.hostname))) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  let handle: string | undefined;
  let id: string | undefined;
  if (parts[0] === "i" && (parts[1] === "web" ? parts[2] === "status" : parts[1] === "status")) {
    id = parts[1] === "web" ? parts[3] : parts[2];
  } else if (parts.length >= 3 && (parts[1] === "status" || parts[1] === "statuses")) {
    if (!HANDLE_RE.test(parts[0]!)) return null;
    handle = parts[0];
    id = parts[2];
  }
  if (!id || !ID_RE.test(id)) return null;
  return { postId: id, ...(handle ? { handle } : {}), url: postUrl(handle, id) };
}

/** True for a link to one X post (used to pick X posts out of search results). */
export function isPostUrl(value: unknown): boolean {
  return parsePostUrl(value) !== null;
}

/** The oEmbed request for a post: no script tag, do not track. */
export function oembedRequestUrl(link: XPostLink): string {
  const q = new URLSearchParams({ url: link.url, omit_script: "1", dnt: "true" });
  return `${OEMBED_ENDPOINT}?${q.toString()}`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "-", ndash: "-", hellip: "..." };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** The post text from the oEmbed `html` (the first `<p>` of the blockquote), as plain text. */
export function postTextFromHtml(html: unknown): string {
  if (typeof html !== "string") return "";
  const p = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(html);
  if (!p) return "";
  const text = decodeEntities(p[1]!.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > MAX_POST_TEXT ? `${text.slice(0, MAX_POST_TEXT - 3).trimEnd()}...` : text;
}

/**
 * Reads an oEmbed answer for `link`. Null when it is not a post answer from X: wrong provider,
 * an author URL off X, or a handle that is not one.
 */
export function parseOembed(body: unknown, link: XPostLink): XPost | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const author = parseHttpUrl(b.author_url);
  if (!author || !X_POST_HOSTS.includes(normalizeHost(author.hostname))) return null;
  const handle = author.pathname.split("/").filter(Boolean)[0];
  if (!handle || !HANDLE_RE.test(handle)) return null;
  const name = typeof b.author_name === "string" && b.author_name.trim() ? b.author_name.trim().slice(0, 100) : handle;
  return { postId: link.postId, url: postUrl(handle, link.postId), authorName: name, authorHandle: handle, text: postTextFromHtml(b.html) };
}

/** "Post by Name (@handle) on X": the credit every export and source line carries. */
export function postCredit(p: { authorName?: string | null; authorHandle?: string | null }): string {
  const handle = p.authorHandle ? `@${p.authorHandle}` : "";
  const name = p.authorName && p.authorName !== p.authorHandle ? p.authorName : "";
  const who = name && handle ? `${name} (${handle})` : name || handle;
  return who ? `Post by ${who} on X` : "Post on X";
}

// ---------------------------------------------------------------------------- fetch and cache

export type FetchPostOutcome =
  | { ok: true; post: XPost; cached: boolean }
  | { ok: false; reason: "bad_url" | "not_found" | "unavailable" };

type Entry = { at: number; value: XPost | "not_found" };

/** Cache by post id, per isolate. A found post is kept a day (edits and deletions show up next day); a missing one 10 minutes. */
const FOUND_MS = 24 * 60 * 60 * 1000;
const MISSING_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;
const cache = new Map<string, Entry>();

/** Tests: start from an empty cache. */
export function clearPostCache(): void {
  cache.clear();
}

export const OEMBED_TIMEOUT_MS = 5000;

/**
 * The post behind `value` through X's oEmbed endpoint, cached by post id. Sends nothing but the
 * post URL. A deleted, private or unknown post answers not_found; X being down answers unavailable.
 */
export async function fetchXPost(value: unknown, deps: { fetchImpl?: FetchLike; now?: () => number } = {}): Promise<FetchPostOutcome> {
  const link = parsePostUrl(value);
  if (!link) return { ok: false, reason: "bad_url" };
  const now = deps.now?.() ?? Date.now();
  const hit = cache.get(link.postId);
  if (hit && now - hit.at < (hit.value === "not_found" ? MISSING_MS : FOUND_MS)) {
    return hit.value === "not_found" ? { ok: false, reason: "not_found" } : { ok: true, post: hit.value, cached: true };
  }
  const doFetch = deps.fetchImpl ?? ((input: string, init?: RequestInit) => fetch(input, init));
  let res: Response;
  try {
    res = await doFetch(oembedRequestUrl(link), { headers: { accept: "application/json" }, signal: AbortSignal.timeout(OEMBED_TIMEOUT_MS) });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (res.status === 404 || res.status === 403) {
    remember(link.postId, { at: now, value: "not_found" });
    return { ok: false, reason: "not_found" };
  }
  if (!res.ok) return { ok: false, reason: "unavailable" };
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const post = parseOembed(body, link);
  if (!post) return { ok: false, reason: "unavailable" };
  remember(link.postId, { at: now, value: post });
  return { ok: true, post, cached: false };
}

function remember(id: string, entry: Entry): void {
  cache.delete(id);
  cache.set(id, entry);
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
}
