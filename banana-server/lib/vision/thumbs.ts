/**
 * Pass-through thumbnails for agents (owner decision, 2026-10-12): on a tool call the server may
 * fetch a reference image at its source's own small size and hand the bytes to the agent as MCP
 * image content, so the agent can see colors and layout without a browser.
 *
 * The bytes live only in this call's memory. Nothing here writes to disk, R2, the Cache API, the
 * database or a log, and nothing is served at any URL. Only hosts on the image allowlist
 * (lib/sources/allowlist.ts) are fetched, every redirect hop is checked again
 * (lib/palette/fetch.ts), each fetch has a short timeout and a per-image byte cap, and a call has
 * a cap on images and on total bytes. No image processing: the source CDN's own size variants
 * keep images small; an image without a small variant that is over the cap is skipped and named.
 */
import { fetchThumbIntoMemory, type FetchLike } from "@/lib/palette/fetch";
import { allowlistFromEnv, isAllowedImageUrl, parseAllowlist, type ImageHostAllowlist } from "@/lib/sources/allowlist";
import { MOBBIN_IMAGE_HOSTS } from "@/lib/sources/mobbin";
import { parseHttpUrl } from "@/lib/sources/url";

/** Most thumbnails in one tool result. */
export const MAX_THUMBS = 12;
/** Per image: an image bigger than this after the size variant is skipped. */
export const MAX_THUMB_BYTES = 300 * 1024;
/** All thumbnails in one tool result together. */
export const MAX_TOTAL_BYTES = 1536 * 1024;
export const THUMB_TIMEOUT_MS = 3_000;

/** The line after the thumbnails that asks the agent to look before it rates, notes or places. */
export const LOOK_LINE =
  "Look at these before you rate, note or place them: name the colors and layout you see; ratings and steal notes must come from the image, not the title.";

export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image"; data: string; mimeType: string };
export type McpContent = TextContent | ImageContent;

/** A tool result that may carry images next to its text. */
export type VisionResult = {
  content: McpContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
};

export type ThumbTarget = {
  /** The text line shown right before the image, naming the reference so the agent can match them. */
  label: string;
  imageUrl?: string | null;
  thumbUrl?: string | null;
};

export type ThumbOptions = {
  fetchImpl?: FetchLike;
  allowlist?: ImageHostAllowlist;
  max?: number;
  maxBytes?: number;
  totalBytes?: number;
  timeoutMs?: number;
};

/**
 * The source CDN's own small variant of an image, when the host has one:
 * Pinterest `/236x/`, Dribbble `?resize=400x300`, Behance `project_modules/disp/`, Framer
 * `?scale-down-to=512`. Any other URL comes back unchanged.
 */
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

/** True for hosts whose small variant smallVariant knows. */
function hasKnownVariant(url: string): boolean {
  return smallVariant(url) !== url;
}

/**
 * The one URL to fetch for a reference: the image's small variant on a host that has one, else
 * the search thumbnail, else the image itself. Allowlisted hosts only; null when none is.
 */
export function pickThumbUrl(t: Pick<ThumbTarget, "imageUrl" | "thumbUrl">, allowlist: ImageHostAllowlist): string | null {
  const image = t.imageUrl ?? "";
  const candidates = [
    image && hasKnownVariant(image) ? smallVariant(image) : null,
    t.thumbUrl ? smallVariant(t.thumbUrl) : null,
    image || null,
  ];
  for (const c of candidates) if (c && isAllowedImageUrl(c, allowlist)) return c;
  return null;
}

/**
 * The hosts thumbnails may come from: the image allowlist plus Mobbin's image hosts (the
 * connector's short link and the CDN it redirects to), so agents see the Mobbin screens they
 * placed. Thumbnails only; search and extract_palette keep the plain allowlist.
 */
export function thumbAllowlist(base: ImageHostAllowlist = allowlistFromEnv()): ImageHostAllowlist {
  return parseAllowlist([...base.entries, ...MOBBIN_IMAGE_HOSTS]);
}

/** Image type from the first bytes. Only formats agents' clients accept: JPEG, PNG, GIF, WebP. */
export function sniffImageType(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

const REASONS: Record<string, string> = {
  not_allowed: "its image host is not on the image allowlist, so it is not fetched",
  invalid_url: "its image link is not valid",
  host_not_allowed: "its image host is not on the image allowlist, so it is not fetched",
  http_error: "the image did not load from its source",
  not_an_image: "the link did not return an image",
  too_large: "it is over 300 KB and its source has no small size",
  timeout: "the image took too long to load",
  network_error: "the image did not load from its source",
  too_many_redirects: "the image link redirects too many times",
  format: "its format is not one agents can read (JPEG, PNG, GIF or WebP)",
  over_cap: "over the 12 thumbnails per call",
  over_budget: "over the size budget for one call",
};

type Fetched = { ok: true; data: string; mimeType: string; bytes: number } | { ok: false; reason: string };

/**
 * Fetches each target's thumbnail (in parallel, deduplicated by URL) and returns, for every target
 * in order, its label line and then its image. A target without an image gets its label line with
 * the reason. Bytes are base64 encoded into the result and dropped; nothing else keeps them.
 */
export async function thumbBlocks(targets: readonly ThumbTarget[], opts: ThumbOptions = {}): Promise<{ blocks: McpContent[]; shown: number }> {
  const allowlist = opts.allowlist ?? thumbAllowlist();
  const max = opts.max ?? MAX_THUMBS;
  const urls = targets.map((t) => pickThumbUrl(t, allowlist));

  // The first `max` distinct URLs are fetched; later ones are over the cap.
  const order: string[] = [];
  for (const u of urls) if (u && !order.includes(u)) order.push(u);
  const toFetch = order.slice(0, max);
  const results = await Promise.all(
    toFetch.map(async (url): Promise<Fetched> => {
      const r = await fetchThumbIntoMemory(url, {
        allowedHosts: allowlist.entries,
        fetchImpl: opts.fetchImpl,
        maxBytes: opts.maxBytes ?? MAX_THUMB_BYTES,
        timeoutMs: opts.timeoutMs ?? THUMB_TIMEOUT_MS,
      });
      if (!r.ok) return { ok: false, reason: r.reason };
      const mimeType = sniffImageType(r.bytes);
      if (!mimeType) return { ok: false, reason: "format" };
      return { ok: true, data: toBase64(r.bytes), mimeType, bytes: r.bytes.byteLength };
    }),
  );

  // Total budget, in target order.
  const byUrl = new Map<string, Fetched>();
  let total = 0;
  const budget = opts.totalBytes ?? MAX_TOTAL_BYTES;
  toFetch.forEach((url, i) => {
    const r = results[i]!;
    if (r.ok && total + r.bytes > budget) {
      byUrl.set(url, { ok: false, reason: "over_budget" });
      return;
    }
    if (r.ok) total += r.bytes;
    byUrl.set(url, r);
  });

  const blocks: McpContent[] = [];
  const emitted = new Set<string>();
  let shown = 0;
  targets.forEach((t, i) => {
    const url = urls[i];
    if (!url) {
      blocks.push({ type: "text", text: `${t.label} (no thumbnail: ${REASONS.not_allowed})` });
      return;
    }
    const r = byUrl.get(url) ?? { ok: false as const, reason: "over_cap" };
    if (!r.ok) {
      blocks.push({ type: "text", text: `${t.label} (no thumbnail: ${REASONS[r.reason] ?? REASONS.http_error})` });
      return;
    }
    if (emitted.has(url)) {
      blocks.push({ type: "text", text: `${t.label} (same image as above)` });
      return;
    }
    emitted.add(url);
    shown += 1;
    blocks.push({ type: "text", text: t.label });
    blocks.push({ type: "image", data: r.data, mimeType: r.mimeType });
  });
  return { blocks, shown };
}

/** The `thumbs` flag from raw tool args: on unless the agent passed false. */
export function wantsThumbs(args: unknown): boolean {
  return !(typeof args === "object" && args !== null && (args as { thumbs?: unknown }).thumbs === false);
}

/**
 * Appends thumbnails (and `extra` text lines) to a finished tool result. Error results pass
 * through unchanged. `rest` counts targets left out before the call (over the cap).
 */
export async function withThumbs(
  result: VisionResult,
  targets: readonly ThumbTarget[],
  opts: ThumbOptions & { rest?: number; restHint?: string; extra?: string[] } = {},
): Promise<VisionResult> {
  if (result.isError) return result;
  const content: McpContent[] = [...result.content];
  if (targets.length > 0) {
    const { blocks, shown } = await thumbBlocks(targets, opts);
    content.push({ type: "text", text: `Thumbnails (${shown} of ${targets.length + (opts.rest ?? 0)}), each after the line that names it:` }, ...blocks);
    if (opts.rest) content.push({ type: "text", text: `${opts.rest} more not shown (at most ${opts.max ?? MAX_THUMBS} per call).${opts.restHint ? ` ${opts.restHint}` : ""}` });
    if (shown > 0) content.push({ type: "text", text: LOOK_LINE });
  }
  if (opts.extra?.length) content.push({ type: "text", text: opts.extra.join("\n") });
  return { ...result, content };
}
