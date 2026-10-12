/**
 * Result quality (pure): hard drops for stock, marketplace and list pages, image URL upgrades,
 * the minimum size rule, and a deterministic score to rank what is left.
 *
 * The bar: polished, high-resolution design work (curated Dribbble shots, good pins), never
 * clip art, stock previews, product listings or tiny thumbnails.
 */
import { SOURCE_REGISTRY, registryItemPath } from "./registry";
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
export function qualityScore(ref: Reference, opts: RankOptions = {}): number {
  const title = ref.title ?? "";
  let score = sizeScore(ref) + siteScore(ref) + recencyScore(ref, opts.year);
  // Art zone: a title that names the idea is more likely on idea; untitled pins rank last.
  if (opts.ideaWord) score += titleHasAny(title, [opts.ideaWord, `${opts.ideaWord}s`]) ? 2 : title ? 0 : -1;
  if (DESIGN_WORDS.test(title)) score += 2;
  if (LISTING_WORDS.test(title)) score -= 2;
  if (UNCLUTTERED_WORDS.test(title)) score += 1;
  if (CLUTTERED_WORDS.test(title)) score -= 1;
  return score;
}

export type RankOptions = {
  /** Art zone: the idea's head word; titles naming it score up. */
  ideaWord?: string;
  /** Current year for the recency score (tests pin it). */
  year?: number;
};

/** Best first. Ties keep the search engine's order, so the result is deterministic. */
export function rankReferences(refs: readonly Reference[], opts: RankOptions = {}): Reference[] {
  return refs
    .map((ref, i) => ({ ref, i, score: qualityScore(ref, opts) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.ref);
}

// ---------------------------------------------------------------------------
// UI title gate (owner: "100% of all search results are UI images, and component images, no
// matter what I ask"). Ported from the round 11 audit (docs/search-quality-experiment.md,
// rounds 11a and 11b): about 460 live results, every kept one UI by eye.

/** Whole word or phrase, any case, Unicode aware (like Python's `\b` on str). */
const wordsRe = (alternatives: string) => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives})(?![\\p{L}\\p{N}_])`, "iu");

/** Words that name a UI: the title must have one. */
const UI_TITLE_WORDS = wordsRe(
  "app|apps|ui|ux|dashboard|website|web ?site|landing|interface|screens?|mobile|ios|android|saas|onboarding|checkout|login|sign ?up|component|widget|widgets|design system|figma|web ?app|homepage|home screen|admin|cards? ui|player|tracker",
);
/** Words that name other design work: such a title passes only with a strong UI word too. */
const NON_UI_TITLE_WORDS = wordsRe(
  "logo|logos|logotype|branding|brand identity|identity|illustrations?|poster|character|mascot|3d model|icon set|icons|packaging|t-?shirt|print|lettering|typeface|font",
);
const STRONG_UI_TITLE_WORDS = wordsRe("app|ui|dashboard|website");

/** True when `text` has a UI word (the gate's word list): "banking app home", "checkout". */
export function hasUiWord(text: string | undefined): boolean {
  return Boolean(text) && UI_TITLE_WORDS.test(text!);
}

/**
 * An item page on a curated UI gallery (Awwwards, Lapa Ninja, Refero, ... in lib/sources/registry.ts)
 * is design work by definition: its title is usually the site or product name.
 */
export function isUiGalleryItem(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return SOURCE_REGISTRY.some(
      (s) =>
        s.role === "gallery" &&
        s.zone === "ui" &&
        !("uiTitle" in s && s.uiTitle) &&
        (host === s.domain || host.endsWith(`.${s.domain}`)) &&
        registryItemPath(s.id, host, u.pathname),
    );
  } catch {
    return false;
  }
}

/**
 * The UI gate, applied to every search result (metadata only, the server never looks at pixels).
 * Keep a result when its title has a UI word, unless it also names other design work (logo,
 * branding, poster, illustration, packaging, ...) without saying app, ui, dashboard or website.
 * Untitled results are dropped (Pinterest often has no title). A titled item page on a curated UI
 * gallery passes: it is a website or product screen.
 */
export function isUiResult(title: string | undefined, url?: string): boolean {
  // Site suffixes are not title words: "Finance Graphics Visual Assets | Figma" names no UI.
  const t = (title ?? "").replace(/\s+/g, " ").replace(/\s*[|:-]+\s*figma\s*$/i, "").trim();
  if (!t) return false;
  // A gallery item is a site or screen by definition, unless its title names other work only.
  if (isUiGalleryItem(url)) return !(NON_UI_TITLE_WORDS.test(t) && !STRONG_UI_TITLE_WORDS.test(t));
  if (!UI_TITLE_WORDS.test(t)) return false;
  return !(NON_UI_TITLE_WORDS.test(t) && !STRONG_UI_TITLE_WORDS.test(t));
}

// ---------------------------------------------------------------------------
// Kits and templates (owner, 2026-10-12): sales sheets, never one designed screen. A 2018
// "Fashion Editorial UI Kit for Adobe XD" passed the old filter, which only ranked "template" down.

const KIT_TITLE = wordsRe(
  "(?:ui|ux|app|web|website|mobile|dashboard|design|figma|sketch|xd|wireframe|starter|icon|component)s? kits?|templates?|for adobe xd|adobe xd|for figma|for sketch|freebie|free download|psd",
);

/** True when the title sells a kit or template ("UI Kit", "Template", "for Adobe XD", "Figma kit", "Freebie"). */
export function isKitTitle(title: string | undefined): boolean {
  return Boolean(title) && KIT_TITLE.test(title!);
}

// ---------------------------------------------------------------------------
// Art zone junk gate. The art lane has no UI gate (it is the raw ingredient as images), so it
// gets its own filter for what made the round 11 board 60% junk: seed packets, jackets, a car air
// freshener. Metadata only, like every other filter.

/** Shop and listing signals: always junk, whatever the idea. */
const SHOP_WORDS = wordsRe(
  "price|prices|buy|buying|shop|shopping|store|sale|for sale|on sale|sold|etsy|amazon|aliexpress|alibaba|ebay|walmart|temu|shein|free shipping|in stock|add to cart|discount|coupon|wholesale|sku|order now|dropship",
);
/** "$12.99", "12,50 €", "£40", "US $5". */
const PRICE = /(?:[$€£¥₹]\s?\d|\d\s?(?:[$€£¥₹]|usd|eur|gbp|aed|sar)(?![\p{L}]))/iu;
/** Listing sizes and calls to visit a shop: "12 x 12", "8x10 in", "Visit NewRetro.Net". */
/** Stock style tag lists as titles: "80s,abstract,art,backdrop,background,banner,...". */
const TAG_SPAM = /^(?:[^,]{1,24},){6,}/;
const LISTING_SHAPES = /\b\d+(?:\.\d+)?\s?(?:x|×)\s?\d+(?:\.\d+)?\b|\bvisit\s+\S+\.(?:com|net|co|shop|store|org)\b|\bsample packs?\b|\b\d+(?:\.\d+)?\s?-?\s?(?:inch|inches|in\.|cm|mm|ft\.?|feet|yards?|oz|ml)(?![a-z])|\brolls?\s*\(|\b(?:foot|feet|yard|yards|meter|metres?)\s+(?:roll|collection)\b/i;
/** Product codes such as "SKU 12345", "AB-12345", "#A1234". */
const SKU_LIKE = /\b(?:[A-Z]{1,4}-\d{4,}|#[A-Z]?\d{5,}|item\s*(?:no\.?|#)\s*\d+)\b/;
/** Fashion and clothing listings (suzani jackets, kimono dresses). */
const FASHION_WORDS = wordsRe(
  "jacket|jackets|coat|coats|dress|dresses|shirt|shirts|t-?shirt|tee|tees|hoodie|hoodies|sweater|sweatshirt|cardigan|blouse|skirt|skirts|pants|trousers|jeans|shorts|kimono|robe|vest|outfit|outfits|clothing|apparel|menswear|womenswear|women'?s|men'?s|fashion|sneakers|shoes|boots|sandals|handbag|handbags|purse|tote|backpack|earrings|necklace|bracelet|jewelry|jewellery|scarf|scarves|hat|cap|socks|leggings|swimsuit|bikini|lingerie|costume",
);
/** Product listings that are not the idea itself (exempt when the art query names them). */
const PRODUCT_WORDS = wordsRe(
  "air freshener|seed packets?|seeds|sticker|stickers|mug|mugs|phone case|iphone case|pillow|pillows|cushion|cushions|pillowcase|blanket|mousepad|keychain|magnet|candle|candles|wallpaper|wall decal|decal|decor|home decor|gift|gifts|gift card|business cards?|wedding invitations?|invitations?|bundle|pack of|set of \\d+|toy|toys|plush|kit|kits|craft kit|diy kit|pattern pdf|sewing pattern|crochet pattern|knitting pattern|cross stitch pattern|svg|png file|clipart|vector pack",
);
/** Logo sheets and icon sets: marks, not art direction. */
const LOGO_SHEET_WORDS = wordsRe("logo|logos|logotype|logo set|logo collection|logo design ideas|icon set|icons set|icon pack|vector set");
/** Stock libraries that slip past isJunk. */
const STOCK_WORDS = wordsRe("stock|unsplash|pexels|pixabay|rawpixel|vector illustration|stock photo|royalty");

const tokensOf = (text: string) => new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map((w) => w.replace(/s$/, "")));

/**
 * The art lane's junk gate. Drops shops, prices and product codes, fashion and clothing
 * listings, product listings (stickers, mugs, pillows, air fresheners, seed packets), logo sheets
 * and stock. A product word the art query itself names is not junk ("persian rug" may show rugs,
 * "seed packet" may show seed packets), but shop and price signals always are. Untitled results
 * pass (Pinterest often has no title); the URL and host checks still apply to them.
 */
export function isArtJunk(title: string | undefined, artQuery = ""): boolean {
  const t = (title ?? "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (SHOP_WORDS.test(t) || PRICE.test(t) || SKU_LIKE.test(t) || LISTING_SHAPES.test(t) || TAG_SPAM.test(t) || STOCK_WORDS.test(t) || LOGO_SHEET_WORDS.test(t)) return true;
  const asked = tokensOf(artQuery);
  const named = (re: RegExp) => {
    const m = re.exec(t);
    if (!m) return false;
    // Exempt only when every word of the match is in the art query ("rug" in "persian rug").
    return ![...tokensOf(m[0])].every((w) => asked.has(w));
  };
  return named(FASHION_WORDS) || named(PRODUCT_WORDS);
}

// ---------------------------------------------------------------------------
// Platform title filter: an iPhone brief must not fill up with "Finance web ui design".

/** True when the title has one of `words` as a whole word or phrase, any case. */
export function titleHasAny(title: string | undefined, words: readonly string[]): boolean {
  if (!title || words.length === 0) return false;
  const alt = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")).join("|");
  return wordsRe(alt).test(title);
}

// ---------------------------------------------------------------------------
// Recency (metadata only): newer work ranks higher. Dribbble shot ids, Dribbble userupload ids,
// Behance gallery ids and Awwwards asset paths all grow with time; Pinterest pins are older on
// average (round 4) and carry no usable date, so they stay neutral.

/**
 * Rough age bands, checked against dated public items (approximate, used only to rank):
 * Dribbble shot 6,000,000 was posted around early 2019 and 17,000,000 around 2022; Behance
 * gallery 75,000,000 around early 2019 and 150,000,000 around 2022.
 */
const OLD = { dribbble: 6_000_000, behance: 75_000_000 } as const;
const NEW = { dribbble: 17_000_000, behance: 150_000_000 } as const;

/** Year of a piece of work when its URLs tell it (Awwwards assets `/2023/06/`), else undefined. */
function assetYear(url: string): number | undefined {
  const m = /assets\.awwwards\.com\/awards\/[a-z]+\/(20\d\d)\//i.exec(url);
  return m ? Number(m[1]) : undefined;
}

/** Comparable "newness" number for a reference, or undefined when nothing tells. */
export function itemAge(ref: Pick<Reference, "sourceUrl" | "imageUrl">): { site: "dribbble" | "behance" | "awwwards"; id: number } | undefined {
  const shot = /dribbble\.com\/shots\/(\d+)/.exec(ref.sourceUrl);
  if (shot) return { site: "dribbble", id: Number(shot[1]) };
  const gallery = /behance\.net\/gallery\/(\d+)/.exec(ref.sourceUrl);
  if (gallery) return { site: "behance", id: Number(gallery[1]) };
  const year = assetYear(ref.imageUrl);
  if (year) return { site: "awwwards", id: year };
  return undefined;
}

/** Title years: "2016" in a title is an old shot; the current or last year is a fresh one. */
function titleYearScore(title: string, now: number): number {
  const years = (title.match(/\b(20[0-3]\d)\b/g) ?? []).map(Number).filter((y) => y <= now + 1);
  if (years.length === 0) return 0;
  const y = Math.max(...years);
  if (y >= now - 1) return 0.5;
  if (y <= now - 5) return -1.5;
  return 0;
}

/**
 * Recency score from -2 to +2: old ids (before about 2019) score down, recent ones up, unknown
 * ages neutral; a year in the title nudges it.
 */
export function recencyScore(ref: Pick<Reference, "sourceUrl" | "imageUrl" | "title">, now = new Date().getUTCFullYear()): number {
  let score = 0;
  const age = itemAge(ref);
  if (age?.site === "dribbble" || age?.site === "behance") {
    if (age.id < OLD[age.site]) score -= 1.5;
    else if (age.id >= NEW[age.site]) score += 1;
  } else if (age?.site === "awwwards") {
    if (age.id <= now - 5) score -= 1.5;
    else if (age.id >= now - 2) score += 1;
  }
  score += titleYearScore(ref.title ?? "", now);
  return Math.max(-2, Math.min(2, score));
}
