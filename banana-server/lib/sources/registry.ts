/**
 * The source registry: every site search_references can search, as data. The `sources` enum,
 * `site:` scopes, item-page checks, the image host allowlist (and so the canvas CSP) and the
 * gallery routing by platform and style all derive from this list, so adding a gallery is one
 * entry here. Vet a candidate first with `node scripts/vet-sources.mjs` (live Serper image search)
 * and record its numbers in `measured`.
 *
 * Every source is reached only through Serper `site:` image search (no scraping, no page fetches),
 * and only URLs are kept (hard rules 2 and 4).
 *
 * Fields:
 * - scope: the path-scoped `site:` filter (one source per request, never the OR form).
 * - item: one piece of work (one shot, pin, site, screen, poster). Lists, tags and search pages
 *   are dropped.
 * - imageHosts: exact hosts its images load from (never wildcards). They join the allowlist.
 * - role: "core" (Pinterest, Dribbble, Behance: searched with the UI grammar) or "gallery"
 *   (a curated gallery: searched with topic words; its item pages are design work by definition).
 * - zone: "ui" galleries feed the UI references, "art" galleries the art zone.
 * - platforms: where a UI gallery is used by default ("any" = every platform).
 * - tags: style words that pull the gallery into a search ("bento", "dark mode", "motion").
 * - query: fixed words for a gallery whose items share one subject (Swissted is all posters).
 * - baseline: searched only in the canvas baseline lane ("Shipped today", P0-03), in this rank
 *   order, never as a direction's gallery (P0-17: shipped screens that never reach the taste bar).
 * - oneWord: searched with the topic's one head word ("analytics", not "analytics dashboard").
 * - pages: picked only when the brief names one of these pages (60fps: pay, card, checkout, wallet).
 * - showcase: a web showcase gallery (Awwwards, Craftwork). When a website brief names a showcase
 *   style (lib/sources/showcase.ts: playful, 3D, WebGL, motion, ...), it is searched with that
 *   style's words, its "phrase" or its one "word", instead of the topic.
 * - styleOnly: picked only when a style word names one of its tags, never by platform alone.
 * - genres: the non-UI genres (lib/sources/genre.ts) whose lane may search this gallery. A genre
 *   gallery has no platforms and no tags of its own, so pickGalleries never picks it for a UI brief.
 * - templatesOk: every item is a template by design (Pitch's gallery): the kit filter is skipped.
 * - httpsImages: the site still links some images over http; they are asked for over https.
 */
import type { Platform, Zone } from "../direction-detail";
import { SHOWCASE_TAGS, SHOWCASE_WORD_TAGS } from "./showcase";
import type { Genre } from "./genre";

export type SourceMeasure = {
  /** Day of the live measurement (YYYY-MM-DD). */
  date: string;
  /** Serper image queries run (one credit each). */
  queries: number;
  /** Results Serper returned. */
  results: number;
  /** Results that were item pages on this site. */
  items: number;
  /** Distinct item pages. */
  unique: number;
  note?: string;
};

export type SourceEntry = {
  id: string;
  /** Plain name for notes and docs. */
  name: string;
  /** Registrable domain; the source page must be on it (or a subdomain). */
  domain: string;
  scope: string;
  item: RegExp;
  /** Extra host rule (Pinterest country subdomains, never business.pinterest.com). */
  hostOk?: (host: string) => boolean;
  imageHosts: readonly string[];
  role: "core" | "gallery";
  zone: Zone;
  platforms: readonly Platform[];
  tags: readonly string[];
  query?: string;
  /** Words added after the topic for this gallery ("community component" on 21st.dev, which mostly indexes list pages otherwise). */
  suffix?: string;
  /**
   * UI galleries whose items are not all UI (Figma Community also hosts icon sets and
   * illustrations): their titles still have to pass the UI gate.
   */
  uiTitle?: boolean;
  baseline?: number;
  oneWord?: boolean;
  pages?: readonly string[];
  /** Web showcase gallery: searched with the showcase style's phrase or one word (see the header). */
  showcase?: "phrase" | "word";
  /** Picked by a style tag only, never as one of the platform's default galleries. */
  styleOnly?: boolean;
  genres?: readonly Genre[];
  templatesOk?: boolean;
  httpsImages?: boolean;
  measured: SourceMeasure;
};

const PINTEREST_NON_PIN_HOSTS = new Set(["business", "help", "policy", "newsroom", "developers", "ads", "analytics"]);

function pinterestHostOk(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (h === "pinterest.com") return true;
  return !PINTEREST_NON_PIN_HOSTS.has(h.slice(0, -".pinterest.com".length));
}

const AWWWARDS_RESERVED = /^\/(?:sites|inspiration)\/(?:search|all|latest|popular|category|tag|tags)\/?$/i;

const day = "2026-10-12";
const gallery = (queries: number, results: number, items: number, unique: number, note?: string): SourceMeasure => ({
  date: day,
  queries,
  results,
  items,
  unique,
  ...(note ? { note } : {}),
});

/**
 * The registry. Order matters: it is the order of the `sources` enum and of SOURCE_SITES, and
 * within a platform the order galleries are tried in before the per-direction rotation.
 */
export const SOURCE_REGISTRY = [
  // Core sources (docs/search-quality-experiment.md, rounds 3 and 4).
  {
    id: "pinterest",
    name: "Pinterest",
    domain: "pinterest.com",
    scope: "pinterest.com/pin",
    item: /^\/pin\/[A-Za-z0-9_-]+(?:\/|$)/,
    hostOk: pinterestHostOk,
    imageHosts: ["i.pinimg.com"],
    role: "core",
    zone: "ui",
    platforms: ["any"],
    tags: [],
    measured: { date: "2026-10-11", queries: 6, results: 60, items: 60, unique: 56 },
  },
  {
    id: "dribbble",
    name: "Dribbble",
    domain: "dribbble.com",
    scope: "dribbble.com/shots",
    item: /^\/shots\/\d+(?:-[^/]*)?(?:\/|$)/,
    imageHosts: ["cdn.dribbble.com"],
    role: "core",
    zone: "ui",
    platforms: ["any"],
    tags: [],
    measured: { date: "2026-10-11", queries: 6, results: 60, items: 60, unique: 57 },
  },
  {
    id: "behance",
    name: "Behance",
    domain: "behance.net",
    scope: "behance.net/gallery",
    item: /^\/gallery\/\d+(?:\/|$)/,
    imageHosts: ["mir-s3-cdn-cf.behance.net", "mir-cdn.behance.net"],
    role: "core",
    zone: "ui",
    platforms: ["any"],
    tags: [],
    measured: { date: "2026-10-11", queries: 5, results: 50, items: 50, unique: 41 },
  },
  {
    id: "awwwards",
    name: "Awwwards",
    domain: "awwwards.com",
    scope: "awwwards.com/sites",
    item: /^\/(?:sites|inspiration)\/[a-z0-9][a-z0-9-]*\/?$/i,
    imageHosts: ["assets.awwwards.com"],
    role: "gallery",
    zone: "ui",
    platforms: ["website"],
    // Showcase styles (2026-10-16): a website brief that names one ("playful", "3d", "webgl")
    // searches it with the style's phrase ("playful illustration"), see lib/sources/showcase.ts.
    tags: ["award", "immersive", ...SHOWCASE_TAGS],
    showcase: "phrase",
    measured: {
      date: "2026-10-16",
      queries: 11,
      results: 110,
      items: 90,
      unique: 70,
      note: "showcase phrases 10 of 10 item pages each; topic plus style (\"3d coffee shop\", \"playful coffee shop\") 0 of 20, Google dropped the site filter; 2026-10-12: 8 of 8 through the deployed server",
    },
  },
  {
    id: "craftwork",
    name: "Craftwork",
    domain: "craftwork.design",
    scope: "craftwork.design/curated/website",
    item: /^\/curated\/website\/[a-z0-9][a-z0-9-]*\/?$/i,
    // Bunny CDN pull zones of Craftwork's own account (exact hosts). cfw6.b-cdn.net is left out: it
    // serves 512 px icons the size rule drops anyway.
    imageHosts: ["craftwork-products.b-cdn.net", "marketstorage.b-cdn.net", "curated-images.b-cdn.net"],
    role: "gallery",
    zone: "ui",
    // Owner request 2026-10-16. Pulled only by a showcase style on a website brief (styleOnly):
    // topic words matched badly ("fintech" and "coffee" gave 2 unique sites each), the style's one
    // word well ("3d", "interactive", "animation": 10 of 10).
    platforms: ["website"],
    tags: SHOWCASE_WORD_TAGS,
    showcase: "word",
    styleOnly: true,
    measured: {
      date: "2026-10-16",
      queries: 12,
      results: 81,
      items: 81,
      unique: 46,
      note: "license allows saving references and sharing links, not republishing; hotlinked thumbnails link back to the item page, which links the live site. Not used in J7 (its license bars testing AI models on its previews)",
    },
  },
  // Website galleries.
  {
    id: "lapa",
    name: "Lapa Ninja",
    domain: "lapa.ninja",
    scope: "lapa.ninja/post",
    item: /^\/post\/[a-z0-9][a-z0-9-]*\/?$/i,
    imageHosts: ["cdn.lapa.ninja"],
    role: "gallery",
    zone: "ui",
    platforms: ["website"],
    tags: ["landing page"],
    measured: gallery(5, 50, 50, 42),
  },
  {
    id: "siteinspire",
    name: "Siteinspire",
    domain: "siteinspire.com",
    scope: "siteinspire.com/website",
    item: /^\/website\/\d+(?:-[a-z0-9-]*)?\/?$/i,
    imageHosts: ["r2.siteinspire.com"],
    role: "gallery",
    zone: "ui",
    platforms: ["website"],
    tags: ["minimal", "editorial", "swiss style"],
    measured: gallery(5, 43, 43, 33),
  },
  {
    id: "cssda",
    name: "CSS Design Awards",
    domain: "cssdesignawards.com",
    scope: "cssdesignawards.com/sites",
    item: /^\/sites\/[a-z0-9][a-z0-9-]*\/\d+\/?$/i,
    imageHosts: ["www.cssdesignawards.com", "cssdesignawards.com"],
    role: "gallery",
    zone: "ui",
    platforms: ["website"],
    tags: ["award", "immersive"],
    measured: gallery(5, 50, 50, 43),
  },
  {
    id: "landinglove",
    name: "landing.love",
    domain: "landing.love",
    scope: "landing.love/sites",
    item: /^\/sites\/[a-z0-9][a-z0-9-]*\/?$/i,
    imageHosts: ["cdn.landing.love"],
    role: "gallery",
    zone: "ui",
    platforms: ["website"],
    tags: ["motion", "animation", "landing page"],
    measured: gallery(5, 50, 50, 34),
  },
  {
    id: "unsection",
    name: "Unsection",
    domain: "unsection.com",
    scope: "unsection.com/section",
    item: /^\/section\/[a-z0-9][a-z0-9-]*\/?$/i,
    imageHosts: ["unsection.b-cdn.net"],
    role: "gallery",
    zone: "ui",
    platforms: ["website"],
    tags: ["hero", "hero section", "section", "pricing", "features"],
    measured: gallery(5, 50, 50, 37),
  },
  {
    id: "supahero",
    name: "Supahero",
    domain: "supahero.io",
    scope: "supahero.io/hero",
    item: /^\/hero\/[a-z0-9][a-z0-9-]*\/?$/i,
    imageHosts: ["pub-26e6aa63ed7942ecb7e9dbc72f09f164.r2.dev"],
    role: "gallery",
    zone: "ui",
    platforms: ["website"],
    tags: ["hero", "hero section"],
    measured: gallery(5, 30, 30, 27, "2 of 5 queries thin"),
  },
  {
    id: "thefwa",
    name: "The FWA",
    domain: "thefwa.com",
    scope: "thefwa.com/cases",
    item: /^\/cases\/[a-z0-9][a-z0-9-]*\/?$/i,
    imageHosts: ["thefwa.com"],
    role: "gallery",
    zone: "ui",
    platforms: ["website"],
    tags: ["immersive", "3d", "motion", "award"],
    measured: gallery(5, 31, 31, 31, "older campaign sites rank high"),
  },
  {
    id: "httpster",
    name: "Httpster",
    domain: "httpster.net",
    scope: "httpster.net/website",
    item: /^\/website\/[a-z0-9][a-z0-9-]*\/?$/i,
    imageHosts: ["httpster.net"],
    role: "gallery",
    zone: "ui",
    platforms: ["website"],
    tags: ["brutalist", "typography", "big typography", "editorial"],
    measured: gallery(5, 50, 50, 42),
  },
  {
    id: "darkdesign",
    name: "Dark Design",
    domain: "dark.design",
    scope: "dark.design/site",
    item: /^\/site\/[a-z0-9][a-z0-9-]*\/?$/i,
    imageHosts: ["sidhvpjhuucqcehkevrl.supabase.co"],
    role: "gallery",
    zone: "ui",
    platforms: ["website"],
    tags: ["dark mode", "dark"],
    measured: gallery(5, 40, 40, 30, "image host is the site's own Supabase project (exact host, never *.supabase.co)"),
  },
  {
    id: "bentogrids",
    name: "Bento Grids",
    domain: "bentogrids.com",
    scope: "bentogrids.com/shots",
    item: /^\/shots\/[a-z0-9]{8,}\/?$/i,
    imageHosts: ["bentogrids.com"],
    role: "gallery",
    zone: "ui",
    platforms: [],
    tags: ["bento grid", "bento"],
    query: "bento grid",
    measured: gallery(5, 31, 31, 13, "topic words rarely match; searched as \"bento grid\""),
  },
  {
    id: "21st",
    name: "21st.dev",
    domain: "21st.dev",
    scope: "21st.dev",
    item: /^\/@?[a-z0-9._-]+\/components\/[a-z0-9-]+\/?$/i,
    imageHosts: ["cdn.21st.dev"],
    role: "gallery",
    zone: "ui",
    platforms: ["website", "webapp"],
    tags: ["component", "components", "react", "shadcn", "hero section", "animated"],
    suffix: "community component",
    measured: gallery(5, 50, 28, 28, "owner request; React component gallery; plain topics give 40% item pages, with \"community component\" 56%; list pages are dropped by the item check"),
  },
  // Web app galleries.
  {
    id: "refero",
    name: "Refero",
    domain: "refero.design",
    scope: "refero.design/pages",
    item: /^\/pages\/[0-9a-f]{8}-[0-9a-f-]{27,}\/?$/i,
    imageHosts: ["images.refero.design"],
    role: "gallery",
    zone: "ui",
    platforms: ["webapp"],
    tags: [],
    baseline: 2,
    oneWord: true,
    measured: gallery(5, 48, 48, 42, "round 13: 0 of 32 great, 47% on page; baseline only"),
  },
  {
    id: "saasframe",
    name: "SaaSFrame",
    domain: "saasframe.io",
    scope: "saasframe.io/examples",
    item: /^\/examples\/[a-z0-9][a-z0-9-]*\/?$/i,
    imageHosts: ["cdn.prod.website-files.com"],
    role: "gallery",
    zone: "ui",
    // Off the default routing (P0-17, round 13): it indexes companies, not pages, so a page word
    // matched landing pages, pricing, settings and emails (2 of 32 on page). Searched only when
    // a call names it in `sources`.
    platforms: [],
    tags: [],
    measured: gallery(5, 50, 50, 36, "image host is Webflow's shared CDN (owner decision); round 13: 2 of 32 on page"),
  },
  {
    id: "nicelydone",
    name: "Nicelydone",
    domain: "nicelydone.club",
    scope: "nicelydone.club/examples/screens",
    item: /^\/examples\/screens\/[a-z0-9][a-z0-9-]*\/?$/i,
    imageHosts: ["assets.nicelydone.club"],
    role: "gallery",
    zone: "ui",
    platforms: ["webapp"],
    tags: [],
    baseline: 1,
    oneWord: true,
    measured: gallery(5, 50, 50, 49, "some titles are bare product names and fail the UI gate; round 13: one head word 94% on page, two words 56%, 0 great; baseline only"),
  },
  // Mobile galleries.
  {
    id: "screensdesign",
    name: "ScreensDesign",
    domain: "screensdesign.com",
    scope: "screensdesign.com/showcase",
    item: /^\/showcase\/[a-z0-9][a-z0-9-]*\/?$/i,
    imageHosts: ["media.screensdesign.com"],
    role: "gallery",
    zone: "ui",
    // Off the default mobile routing (P0-17, round 13: 0 of 32 great, 31% on page; its "UI
    // Breakdown" pages show another screen of the app). Tablet keeps it (not measured there).
    platforms: ["tablet"],
    tags: [],
    measured: gallery(5, 50, 48, 35),
  },
  {
    id: "60fps",
    name: "60fps",
    domain: "60fps.design",
    scope: "60fps.design/shots",
    item: /^\/shots\/[a-z0-9][a-z0-9-]*\/?$/i,
    imageHosts: ["video.gumlet.io", "framerusercontent.com"],
    role: "gallery",
    zone: "ui",
    // Only for pay, card, checkout and wallet pages (P0-17, round 13: "pay" gave 4 of 8 great on
    // checkout, other pages 12% great), searched as "pay" or "card" (galleryWords).
    platforms: ["mobile"],
    tags: [],
    pages: ["checkout", "pay", "payment", "payments", "card", "cards", "wallet", "wallets"],
    measured: gallery(5, 50, 42, 26, "image hosts are shared CDNs (Gumlet, Framer): owner decision"),
  },
  {
    id: "figma",
    name: "Figma Community",
    domain: "figma.com",
    scope: "figma.com/community/file",
    item: /^\/community\/file\/\d+(?:\/[a-z0-9-]*)?\/?$/i,
    imageHosts: ["s3-alpha.figma.com", "s3-figma-hubfile-images-production-cdn-cgi.figma.com"],
    role: "gallery",
    zone: "ui",
    // Never picked by platform or style: Community files are free kits and templates, not designed
    // screens (field report, 2026-10-12: all 7 Figma results of a flight search were rated
    // stock_or_shop). Searched only when a call names it in `sources`.
    platforms: [],
    tags: [],
    uiTitle: true,
    measured: gallery(5, 50, 50, 50, "many titles are kits, icon sets or illustrations; the kit filter and the UI gate drop them; off the default routing since 2026-10-12"),
  },
  // Art galleries (art zone).
  {
    id: "fontsinuse",
    name: "Fonts In Use",
    domain: "fontsinuse.com",
    scope: "fontsinuse.com/uses",
    item: /^\/uses\/\d+(?:\/[a-z0-9-]*)?\/?$/i,
    imageHosts: ["original.fontsinuse.com", "assets.fontsinuse.com"],
    role: "gallery",
    zone: "art",
    platforms: [],
    tags: ["typography", "big typography", "editorial", "type", "lettering", "poster", "serif", "retro"],
    genres: ["branding"],
    measured: gallery(5, 50, 50, 42),
  },
  {
    id: "typoposters",
    name: "typo/graphic posters",
    domain: "typographicposters.com",
    scope: "typographicposters.com",
    item: /^\/[a-z0-9-]+\/[0-9a-f]{24}\/?$/i,
    imageHosts: ["images.typographicposters.com", "assets.typographicposters.com"],
    role: "gallery",
    zone: "art",
    platforms: [],
    tags: ["poster", "typography", "big typography", "swiss style", "experimental"],
    genres: ["branding"],
    measured: gallery(5, 50, 46, 26),
  },
  {
    id: "swissted",
    name: "Swissted",
    domain: "swissted.com",
    scope: "swissted.com/products",
    item: /^\/products\/[a-z0-9][a-z0-9-]*\/?$/i,
    imageHosts: ["www.swissted.com"],
    role: "gallery",
    zone: "art",
    platforms: [],
    tags: ["swiss style", "swiss", "international style", "punk"],
    query: "poster",
    measured: gallery(5, 28, 28, 24, "one artist's poster shop: art zone only, by style tag"),
  },
  {
    id: "brandidentity",
    name: "The Brand Identity",
    domain: "the-brandidentity.com",
    scope: "the-brandidentity.com/project",
    item: /^\/project\/[a-z0-9%-]+\/?$/i,
    imageHosts: ["the-brandidentity.com"],
    role: "gallery",
    zone: "art",
    platforms: [],
    tags: ["branding", "identity", "brand", "luxury"],
    genres: ["branding"],
    measured: gallery(5, 50, 50, 35),
  },
  {
    id: "bpando",
    name: "BP&O",
    domain: "bpando.org",
    scope: "bpando.org",
    item: /^\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+\/?$/i,
    imageHosts: ["bpando.org"],
    role: "gallery",
    zone: "art",
    platforms: [],
    tags: ["packaging", "branding", "label"],
    genres: ["branding"],
    measured: gallery(5, 50, 45, 31, "older posts (2013 to 2016) show up"),
  },
  {
    id: "cosmos",
    name: "Cosmos",
    domain: "cosmos.so",
    scope: "cosmos.so/e",
    item: /^\/e\/\d+\/?$/,
    imageHosts: ["cdn.cosmos.so"],
    role: "gallery",
    zone: "art",
    platforms: [],
    tags: ["collage", "moodboard", "texture", "grainy", "y2k"],
    measured: gallery(5, 50, 50, 48, "user saves like Pinterest; 40 of 50 on its own CDN, titles often bare"),
  },
  {
    id: "arena",
    name: "Are.na",
    domain: "are.na",
    scope: "are.na/block",
    item: /^\/block\/\d+\/?$/,
    imageHosts: ["d2w9rnfcy7mm78.cloudfront.net", "images.are.na"],
    role: "gallery",
    zone: "art",
    platforms: [],
    tags: ["collage", "moodboard", "experimental", "archive"],
    measured: gallery(5, 50, 50, 42, "user saves; 33 of 50 on its own hosts, 11 on Behance's"),
  },
  {
    id: "designspiration",
    name: "Designspiration",
    domain: "designspiration.com",
    scope: "designspiration.com/save",
    item: /^\/save\/\d+\/?$/,
    imageHosts: ["dspncdn.com"],
    role: "gallery",
    zone: "art",
    platforms: [],
    tags: ["poster", "print", "graphic design", "illustration"],
    measured: gallery(5, 50, 50, 50, "user saves; 68% big enough, the size rule drops the rest"),
  },
  // Genre galleries (2026-10-16): searched only by a genre lane (lib/sources/genre.ts) or when a
  // call names them in `sources`. No platforms and no tags, so UI briefs never pick them.
  {
    id: "pitch",
    name: "Pitch templates",
    domain: "pitch.com",
    scope: "pitch.com/templates",
    item: /^\/templates\/(?!collections\/)[A-Za-z0-9-]+-[A-Za-z0-9]{20,}\/?$/,
    imageHosts: ["imgproxy.services.pitch.com", "pitch-static-assets.imgix.net"],
    role: "gallery",
    zone: "ui",
    platforms: [],
    tags: [],
    genres: ["presentation"],
    templatesOk: true,
    measured: {
      date: "2026-10-16",
      queries: 1,
      results: 10,
      items: 6,
      unique: 6,
      note: "Pitch's own template gallery (robots allow all); 4 of 10 were the collection page; images 7 imgproxy, 2 imgix, 1 on a shared S3 bucket host (left out: thumbnail fallback)",
    },
  },
  {
    id: "brandnew",
    name: "Brand New",
    domain: "underconsideration.com",
    scope: "underconsideration.com/brandnew/archives",
    item: /^\/brandnew\/archives\/(?!tag\/)[a-z0-9_]+\.php$/i,
    imageHosts: ["www.underconsideration.com"],
    role: "gallery",
    zone: "art",
    platforms: [],
    tags: [],
    genres: ["branding"],
    httpsImages: true,
    measured: {
      date: "2026-10-16",
      queries: 1,
      results: 10,
      items: 9,
      unique: 9,
      note: "UnderConsideration's identity reviews; 1 of 10 a tag page; 3 of 10 image URLs were http (asked for over https, which the host serves); lead images are often before and after logo pairs",
    },
  },
] as const satisfies readonly SourceEntry[];

export type RegistrySite = (typeof SOURCE_REGISTRY)[number]["id"];

const BY_ID = new Map<string, SourceEntry>(SOURCE_REGISTRY.map((s) => [s.id, s]));

/** The registry entry of a site. */
export function sourceEntry(site: RegistrySite): SourceEntry {
  return BY_ID.get(site)!;
}

/** Every image host the registry needs, in registry order, no repeats. */
export function registryImageHosts(): string[] {
  return [...new Set(SOURCE_REGISTRY.flatMap((s) => s.imageHosts))];
}

/** True when the path is one piece of work on this site (Awwwards list paths excluded). */
export function registryItemPath(site: RegistrySite, host: string, path: string): boolean {
  const s = sourceEntry(site);
  if (s.hostOk && !s.hostOk(host)) return false;
  if (site === "awwwards" && AWWWARDS_RESERVED.test(path)) return false;
  return s.item.test(path);
}

/** Lowercase style words of a list ("Bento Grid", "dark-mode") as plain phrases. */
const norm = (w: string) => w.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

/** True when any style word names one of the entry's tags (whole words: "dark" matches "dark mode"). */
export function matchesTags(entry: Pick<SourceEntry, "tags">, styleWords: readonly string[]): boolean {
  const words = styleWords.map(norm).filter(Boolean);
  return entry.tags.some((tag) => {
    const t = norm(tag);
    // The tag inside a style word or phrase ("big typography" has "typography"), or a one-word
    // style word inside a tag ("dark" in "dark mode").
    return words.some((w) => ` ${w} `.includes(` ${t} `) || (!w.includes(" ") && ` ${t} `.includes(` ${w} `)));
  });
}

/** cyrb53-style 32-bit hash (no import from lib/bend, so the registry stays dependency free). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Most UI gallery requests one direction search plans. */
export const MAX_UI_GALLERIES = 2;
/** Most art gallery requests one direction search plans. */
export const MAX_ART_GALLERIES = 1;

export type GalleryPick = {
  ui: RegistrySite[];
  art: RegistrySite[];
  /** Baseline-only galleries for the platform, in rank order (P0-17: the "Shipped today" lane). */
  baseline: RegistrySite[];
};

/** True when a gallery with `pages` may run for this brief: the brief names one of its pages. */
export function pagesOk(entry: Pick<SourceEntry, "pages">, brief: string | undefined): boolean {
  if (!entry.pages?.length) return true;
  const words = ` ${(brief ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(" ") ?? ""} `;
  return entry.pages.some((p) => words.includes(` ${p} `));
}

/**
 * Galleries for one direction search (pure, deterministic):
 * - UI: galleries whose style tags the direction's style words (or the brief) name come first, in
 *   registry order ("bento grid" pulls Bento Grids, "dark mode" pulls Dark Design); then the
 *   galleries for the platform (website: Awwwards, Lapa Ninja, ...; webapp: Refero, ...; mobile:
 *   60fps for pay, card, checkout and wallet pages; tablet: ScreensDesign; never Figma Community,
 *   SaaSFrame or a baseline gallery), rotated by the direction key so two directions on one canvas
 *   search different galleries. At most MAX_UI_GALLERIES.
 * - Baseline: the platform's baseline galleries (web app: Nicelydone, then Refero), in rank order.
 * - Art: art galleries whose tags the art queries or the idea name ("swiss poster" pulls Swissted
 *   and typo/graphic posters), rotated by the key. At most MAX_ART_GALLERIES. Style words do not
 *   pick art galleries: live, "big typography" pulled Fonts In Use pages unrelated to the idea
 *   ("New Visions 2023") and "synthwave 1984" on typo/graphic posters found nothing.
 */
export function pickGalleries(input: {
  platform?: Platform;
  styleWords?: readonly string[];
  brief?: string;
  key: string;
  /** The art queries and the idea, for art galleries. */
  artText?: readonly string[];
  /**
   * Tags whose galleries go before every other tag match (a website brief's showcase styles, so
   * "landing page" in the brief does not crowd Awwwards and Craftwork out). None: no change.
   */
  prefer?: readonly string[];
}): GalleryPick {
  const words = [...(input.styleWords ?? []), ...(input.brief ? [input.brief] : [])];
  const galleries = SOURCE_REGISTRY.filter((s) => s.role === "gallery");
  const rotate = <T>(list: readonly T[], salt: string): T[] => {
    if (list.length < 2) return [...list];
    const k = hash(`${salt}|${input.key}`) % list.length;
    return [...list.slice(k), ...list.slice(0, k)];
  };
  const uiAll = galleries.filter((s) => s.zone === "ui" && pagesOk(sourceEntry(s.id), input.brief));
  const directionUi = uiAll.filter((s) => !("baseline" in s));
  const tagged = directionUi.filter((s) => matchesTags(s, words));
  const platform = input.platform && input.platform !== "any" ? input.platform : undefined;
  const forPlatform = platform ? directionUi.filter((s) => !("styleOnly" in s) && (s.platforms as readonly string[]).includes(platform)) : [];
  const baseline = platform
    ? uiAll
        .filter((s): s is Extract<(typeof uiAll)[number], { baseline: number }> => "baseline" in s && (s.platforms as readonly string[]).includes(platform))
        .sort((a, b) => a.baseline - b.baseline)
        .map((s) => s.id)
    : [];
  // Tag matches only count when the gallery suits the platform or has no platform of its own.
  const taggedOk = tagged.filter((s) => s.platforms.length === 0 || !platform || (s.platforms as readonly string[]).includes(platform));
  const ui: RegistrySite[] = [];
  const preferred = input.prefer?.length ? taggedOk.filter((s) => matchesTags(s, input.prefer!)) : [];
  for (const s of [...rotate(preferred, "prefer"), ...rotate(taggedOk, "tag"), ...rotate(forPlatform, "platform")]) {
    if (!ui.includes(s.id)) ui.push(s.id);
    if (ui.length >= MAX_UI_GALLERIES) break;
  }
  const art = rotate(
    galleries.filter((s) => s.zone === "art" && matchesTags(s, input.artText ?? [])),
    "art",
  )
    .slice(0, MAX_ART_GALLERIES)
    .map((s) => s.id);
  return { ui, art, baseline };
}
