/**
 * One larger pass-through image for cutting parts (owner decision D4, 2026-10-15): `cut_parts`
 * with `look` returns one source image at the CDN's own "cut" size (at most 1200 px wide, 1.5 MB)
 * plus its pixel size, so the agent can give exact crop fractions instead of guessing from a
 * 236 to 400 px thumbnail.
 *
 * Same rules as lib/vision/thumbs.ts: allowlisted hosts only (every redirect hop checked), bytes
 * held in this call's memory, base64 encoded into the result and dropped. Nothing is written to
 * disk, R2, the Cache API, the database or a log, and nothing is served at any URL. No image
 * processing: the size comes from the source CDN's own variants, and the pixel size is read from
 * the file header.
 */
import { fetchThumbIntoMemory, type FetchLike } from "@/lib/palette/fetch";
import type { ImageHostAllowlist } from "@/lib/sources/allowlist";
import { isAllowedImageUrl } from "@/lib/sources/allowlist";
import { parseHttpUrl } from "@/lib/sources/url";
import { pickThumbUrl, sniffImageType, thumbAllowlist, toBase64, type McpContent } from "./thumbs";

/** Widest image a look may return (D4). */
export const MAX_CUT_PX = 1200;
/** Largest image a look may return. */
export const MAX_CUT_BYTES = 1536 * 1024;
export const CUT_TIMEOUT_MS = 5_000;

/**
 * The source CDN's own larger variant, at most 1200 px wide, checked against real URLs on
 * 2026-10-15: Pinterest `/1200x/` (always a .jpg), Dribbble `?resize=1200x900` (fits inside
 * the box, no crop), Behance `project_modules/max_1200/`, Framer `?scale-down-to=1024`. Any
 * other URL comes back unchanged.
 */
export function cutVariant(url: string): string {
  const u = parseHttpUrl(url);
  if (!u) return url;
  const host = u.hostname.toLowerCase();
  if (host === "i.pinimg.com") {
    const path = u.pathname.replace(/^\/(?:\d+x(?:\d+)?|originals)\//, "/1200x/");
    if (path === u.pathname) return url;
    u.pathname = path.replace(/\.(?:png|gif|webp|jpeg)$/i, ".jpg");
  } else if (host === "cdn.dribbble.com") {
    u.searchParams.set("resize", "1200x900");
    // `vertical=center` (search thumbnails carry it) crops to the box; a cut needs the whole shot.
    u.searchParams.delete("vertical");
    u.searchParams.delete("crop");
  } else if (host === "mir-s3-cdn-cf.behance.net" || host === "mir-cdn.behance.net") {
    const path = u.pathname.replace(/\/project_modules\/[^/]+\//, "/project_modules/max_1200/");
    if (path === u.pathname) return url;
    u.pathname = path;
  } else if (host === "framerusercontent.com") {
    u.searchParams.set("scale-down-to", "1024");
  } else {
    return url;
  }
  return u.toString();
}

/** Pixel size from the file header (PNG, GIF, JPEG, WebP). Null when the header is not readable. */
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  const type = sniffImageType(b);
  const u16be = (i: number) => (b[i]! << 8) | b[i + 1]!;
  const u16le = (i: number) => b[i]! | (b[i + 1]! << 8);
  const u24le = (i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
  const u32be = (i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
  const ok = (width: number, height: number) => (width > 0 && height > 0 ? { width, height } : null);
  if (type === "image/png") return b.length >= 24 ? ok(u32be(16), u32be(20)) : null;
  if (type === "image/gif") return b.length >= 10 ? ok(u16le(6), u16le(8)) : null;
  if (type === "image/webp") {
    if (b.length < 30) return null;
    const chunk = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
    if (chunk === "VP8X") return ok(u24le(24) + 1, u24le(27) + 1);
    if (chunk === "VP8L") {
      const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
      return ok((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
    }
    if (chunk === "VP8 ") return ok(u16le(26) & 0x3fff, u16le(28) & 0x3fff);
    return null;
  }
  if (type === "image/jpeg") {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = b[i + 1]!;
      // Fill bytes and markers without a length.
      if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
        i += marker === 0xff ? 1 : 2;
        continue;
      }
      // Start of frame (baseline, progressive and the rest; not DHT, JPG or DAC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return ok(u16be(i + 7), u16be(i + 5));
      }
      if (marker === 0xda || marker === 0xd9) return null;
      i += 2 + u16be(i + 2);
    }
    return null;
  }
  return null;
}

export type LookTarget = {
  /** The text line naming the image, shown before it. */
  label: string;
  imageUrl: string;
  thumbUrl?: string | null;
};

export type LookOptions = {
  fetchImpl?: FetchLike;
  allowlist?: ImageHostAllowlist;
  timeoutMs?: number;
};

export type LookResult =
  | { ok: true; blocks: McpContent[]; width: number; height: number; size: "cut" | "small" }
  | { ok: false; blocks: McpContent[] };

const FAIL: Record<string, string> = {
  host_not_allowed: "its image host is not on the image allowlist, so it is not fetched",
  too_large: "it is over 1.5 MB at every size its source offers",
  too_wide: `it is wider than ${MAX_CUT_PX} px and its source has no smaller size`,
  timeout: "the image took too long to load",
  format: "its format is not one agents can read (JPEG, PNG, GIF or WebP)",
};

/**
 * Fetches one image for the agent to cut from: the CDN's cut size first, then the image itself,
 * then its small thumbnail, keeping the first that is at most 1200 px wide and 1.5 MB. Returns the
 * label line with the pixel size, the image, and how to turn pixels into crop fractions.
 */
export async function lookBlocks(t: LookTarget, opts: LookOptions = {}): Promise<LookResult> {
  const allowlist = opts.allowlist ?? thumbAllowlist();
  const small = pickThumbUrl({ imageUrl: t.imageUrl, thumbUrl: t.thumbUrl ?? null }, allowlist);
  const tries: { url: string; size: "cut" | "small" }[] = [];
  for (const [url, size] of [
    [cutVariant(t.imageUrl), "cut"],
    [t.imageUrl, "cut"],
    [small, "small"],
  ] as const) {
    if (url && isAllowedImageUrl(url, allowlist) && !tries.some((x) => x.url === url)) tries.push({ url, size });
  }
  let reason = tries.length === 0 ? "host_not_allowed" : "http_error";
  for (const { url, size } of tries) {
    const r = await fetchThumbIntoMemory(url, {
      allowedHosts: allowlist.entries,
      fetchImpl: opts.fetchImpl,
      maxBytes: MAX_CUT_BYTES,
      timeoutMs: opts.timeoutMs ?? CUT_TIMEOUT_MS,
    });
    if (!r.ok) {
      reason = r.reason;
      continue;
    }
    const mimeType = sniffImageType(r.bytes);
    if (!mimeType) {
      reason = "format";
      continue;
    }
    const dims = imageSize(r.bytes);
    if (!dims) {
      reason = "format";
      continue;
    }
    if (dims.width > MAX_CUT_PX) {
      reason = "too_wide";
      continue;
    }
    const { width, height } = dims;
    return {
      ok: true,
      width,
      height,
      size,
      blocks: [
        { type: "text", text: `${t.label}: ${width} x ${height} px${size === "small" ? " (its small thumbnail; no larger size was readable)" : ""}.` },
        { type: "image", data: toBase64(r.bytes), mimeType },
        {
          type: "text",
          text:
            `Crop fractions from this image: x = left edge px / ${width}, w = part width px / ${width}, y = top edge px / ${height}, h = part height px / ${height}. ` +
            "Pass them as crop on cut_parts. Never download or save the image.",
        },
      ],
    };
  }
  return { ok: false, blocks: [{ type: "text", text: `${t.label}: not shown, ${FAIL[reason] ?? "the image did not load from its source"}. Cut without a crop and the server guesses one.` }] };
}
