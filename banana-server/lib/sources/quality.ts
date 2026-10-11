/**
 * Result quality (pure): hard drops for stock, marketplace and list pages, image URL upgrades,
 * the minimum size rule, and a deterministic score to rank what is left.
 *
 * The bar: polished, high-resolution design work (curated Dribbble shots, good pins), never
 * clip art, stock previews, product listings or tiny thumbnails.
 */
import type { Reference } from "./types";

/**
 * Stock, marketplace and download-shop signals. Matched case-insensitively against the title,
 * Serper's `source` and `domain`, the source page URL and the image URL.
 * Plain "template" is not here: many good Dribbble shots are "UI kit template"; only sales
 * wording around it ("editable template", "template download") is.
 */
const JUNK_PATTERNS: readonly RegExp[] = [
  /shutterstock/i,
  /\bstock\s+(vector|illustration|photo|photos|image|images|footage)\b/i,
  /\bpremium\s+vector\b/i,
  /\bfree\s+vector\b/i,
  /\bistock(photo)?\b/i,
  /freepik/i,
  /vecteezy/i,
  /dreamstime/i,
  /depositphotos/i,
  /\badobe\s+stock\b/i,
  /\b123rf\b/i,
  /\balamy\b/i,
  /getty\s*images/i,
  /\betsy\b/i,
  /etsystatic/i,
  /zazzle/i,
  /redbubble/i,
  /teepublic/i,
  /creative\s*market/i,
  /\benvato\b/i,
  /\bcanva\b/i,
  /\bsvg\s+(bundle|files?|cut)\b/i,
  /\bclip\s?-?art\b/i,
  /\b(digital|instant)\s+download\b/i,
  /\bprintables?\b/i,
  /\broyalty[\s-]+free\b/i,
  /\b(editable|printable|downloadable|instant)\s+(\w+\s+){0,3}templates?\b/i,
  /\btemplates?\s+(download|for sale)\b/i,
  // List pages that slip past the URL check: Pinterest board titles and Dribbble search titles.
  /^\d+\+?\s.*\bideas\b/i,
  /\bbrowse thousands of\b/i,
];

export type JunkInput = {
  title?: unknown;
  source?: unknown;
  domain?: unknown;
  sourceUrl?: string;
  imageUrl?: string;
  thumbUrl?: string;
};

/** True when any text Serper gave us reads like stock, a shop listing or a list page. */
export function isJunk(input: JunkInput): boolean {
  const texts = [input.title, input.source, input.domain, input.sourceUrl, input.imageUrl, input.thumbUrl].filter(
    (t): t is string => typeof t === "string" && t.length > 0,
  );
  return texts.some((t) => JUNK_PATTERNS.some((re) => re.test(t)));
}

/** Smallest larger side we keep, when Serper gives a size. */
export const MIN_IMAGE_SIDE = 600;

/** False when both sides are known and the larger one is under MIN_IMAGE_SIDE. */
export function bigEnough(width: number | undefined, height: number | undefined): boolean {
  if (!width || !height) return true;
  return Math.max(width, height) >= MIN_IMAGE_SIDE;
}

export type ImageUpgrade = { url: string; width?: number; height?: number };

const PINIMG_SIZED = /^\/(236|474|564)x\//;
export const PINIMG_UPGRADE_WIDTH = 736;

/**
 * i.pinimg.com serves the same file at several widths (`/236x/`, `/474x/`, `/564x/`, `/736x/`).
 * Ask for 736x. When the reported width equals the small bucket, the original is at least that
 * wide, so the 736x file is about 736 wide: scale the size. Otherwise the original is smaller than
 * the bucket and the 736x file is the same size.
 */
export function upgradePinterestImage(url: URL, width?: number, height?: number): ImageUpgrade {
  const m = PINIMG_SIZED.exec(url.pathname);
  if (url.hostname !== "i.pinimg.com" || !m) return { url: url.toString(), width, height };
  const bucket = Number(m[1]);
  const next = new URL(url.toString());
  next.pathname = url.pathname.replace(PINIMG_SIZED, `/${PINIMG_UPGRADE_WIDTH}x/`);
  if (width && height && width === bucket) {
    const scale = PINIMG_UPGRADE_WIDTH / bucket;
    return { url: next.toString(), width: PINIMG_UPGRADE_WIDTH, height: Math.round(height * scale) };
  }
  return { url: next.toString(), width, height };
}

/**
 * cdn.dribbble.com resizes on the fly with `?resize=WxH` (Serper often returns 400x300 or 752x);
 * without it the CDN serves the original upload. Strip it. The reported size was the resized
 * variant's, so width and height are dropped, and the size rule skips Dribbble images.
 */
export function upgradeDribbbleImage(url: URL, width?: number, height?: number): ImageUpgrade {
  if (url.hostname !== "cdn.dribbble.com" || !url.searchParams.has("resize")) return { url: url.toString(), width, height };
  const next = new URL(url.toString());
  next.searchParams.delete("resize");
  return { url: next.toString() };
}

/** True when the size rule applies to this image host (Dribbble's reported sizes are of resized variants). */
export function sizeRuleApplies(url: string): boolean {
  try {
    return new URL(url).hostname !== "cdn.dribbble.com";
  } catch {
    return true;
  }
}

/** Both upgrades (Pinterest 736x, Dribbble original); a URL on any other host passes through unchanged. */
export function upgradeImage(url: URL, width?: number, height?: number): ImageUpgrade {
  if (url.hostname === "i.pinimg.com") return upgradePinterestImage(url, width, height);
  if (url.hostname === "cdn.dribbble.com") return upgradeDribbbleImage(url, width, height);
  return { url: url.toString(), width, height };
}

/** Title words that read like design work. */
const DESIGN_WORDS =
  /\b(app|apps|ui|ux|dashboard|mobile|concept|case study|interface|redesign|branding|brand identity|identity|poster|typography|pattern|web design|website|landing page|design system|illustration|packaging|editorial|layout)\b/i;
/** Title words that read like a product listing. */
const LISTING_WORDS =
  /\b(sale|buy|price|sticker|stickers|mug|t-?shirt|shirt|hoodie|tee|gift|gifts|wall art|art print|invitation|invitations|wedding|bundle|amazon|ebay|aliexpress|wallpaper|decor)\b/i;

/** Uncluttered work (a single card or widget, a clean concept) scores up a little. */
const UNCLUTTERED_WORDS = /\b(card|cards|widget|widgets|component|components|minimal|minimalist|concept|clean)\b/i;
/** Busy multi-screen dumps and kits score down a little. */
const CLUTTERED_WORDS = /\b(ui kit|app ui kit|screens|full app|templates?|complete)\b/i;

function sizeScore(ref: Reference): number {
  if (!ref.width || !ref.height) return 1;
  const side = Math.max(ref.width, ref.height);
  if (side >= 1600) return 3;
  if (side >= 1200) return 2;
  if (side >= 800) return 1;
  return 0;
}

function siteScore(ref: Reference): number {
  switch (ref.sourceSite) {
    case "dribbble.com":
    case "behance.net":
      return 1.5;
    case "awwwards.com":
      return 1;
    default:
      return 0;
  }
}

/**
 * Higher is better. Larger images, curated sites and design-work titles score up; listings down;
 * a small nudge toward uncluttered work. Metadata only: the server never looks at the pixels.
 */
export function qualityScore(ref: Reference): number {
  const title = ref.title ?? "";
  let score = sizeScore(ref) + siteScore(ref);
  if (DESIGN_WORDS.test(title)) score += 2;
  if (LISTING_WORDS.test(title)) score -= 2;
  if (UNCLUTTERED_WORDS.test(title)) score += 1;
  if (CLUTTERED_WORDS.test(title)) score -= 1;
  return score;
}

/** Best first. Ties keep the search engine's order, so the result is deterministic. */
export function rankReferences(refs: readonly Reference[]): Reference[] {
  return refs
    .map((ref, i) => ({ ref, i, score: qualityScore(ref) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.ref);
}
