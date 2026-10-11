/**
 * The landing page showcase: real, published design work shown in the hero field, the gallery
 * boards and the final call to action. Owner decision (DECISIONS.md, 2026-10-11): "Live
 * references, linked".
 *
 * URLs and metadata only (hard rule 2). Images are hotlinked from the source CDN with
 * referrerPolicy="no-referrer" and are never downloaded, proxied or stored; every item shows its
 * source link (hard rule 3). The list is filtered through the takedown list at render
 * (lib/site/showcase-load.ts), and every tile falls back to GoBanana's own generative art
 * (TileArt) when its image does not load.
 *
 * How the list was made (2026-10-11): live Serper image searches with path-scoped `site:`
 * filters (dribbble.com/shots, behance.net/gallery, pinterest.com/pin), one query per bend move
 * ("liquid glass app ui", "kufic typography", "sadu pattern", ...). Candidates were judged by eye
 * for craft and clarity; stock, templates, UI kits, shops and watermarked images were skipped,
 * and every creator appears once. `searchTitle` is the result title as Serper returned it; the
 * work's title and its creator are parsed from it (parseShowcaseTitle), and the image URL goes
 * through the same upgrade the search adapter uses (Dribbble without `?resize`, Pinterest 736x).
 * `thumbUrl` is a display size from the same CDN, for the small tiles.
 */
import { upgradeImage } from "@/lib/sources/quality";
import type { ArtKind } from "./moves";

export type ShowcaseSite = "dribbble" | "behance" | "pinterest";

/** The bend moves (lib/bend), as labelled on the site. */
export type ShowcaseMove = "material" | "era" | "lens" | "scale" | "constraint" | "transplant";

/** What the piece illustrates. Words live in the dictionaries (`landing.showcase.lenses`). */
export const SHOWCASE_LENSES = [
  "sadu",
  "kufic",
  "iridescent",
  "liquidGlass",
  "halftone",
  "bigNumbers",
  "desertModern",
  "memphis",
  "mashrabiya",
  "grain",
  "swissGrid",
  "quietSpace",
  "riso",
  "brutalist",
  "travelApp",
  "minimal",
  "bento",
  "editorial",
] as const;
export type ShowcaseLens = (typeof SHOWCASE_LENSES)[number];

/** Source data as collected: what the search returned, plus the judgement (move and lens). */
type RawItem = {
  id: string;
  searchTitle: string;
  sourceUrl: string;
  /** Image URL as the search returned it, before the upgrade. */
  searchImageUrl: string;
  thumbUrl: string;
  width?: number;
  height?: number;
  move?: ShowcaseMove;
  lens: ShowcaseLens;
};

export type ShowcaseItem = {
  id: string;
  /** The work's own title, used for alt text. */
  title: string;
  /** Designer or studio, when the source title names one. */
  creator?: string;
  sourceSite: ShowcaseSite;
  /** The item page on the source site. */
  sourceUrl: string;
  /** Full image on the source CDN (upgraded). */
  imageUrl: string;
  /** Display size on the same CDN. */
  thumbUrl: string;
  width?: number;
  height?: number;
  move?: ShowcaseMove;
  lens: ShowcaseLens;
};

const SITE_NAMES: Record<ShowcaseSite, string> = { dribbble: "Dribbble", behance: "Behance", pinterest: "Pinterest" };

/** Display name of a source site. Brand names stay in Latin script in both languages. */
export function siteName(site: ShowcaseSite): string {
  return SITE_NAMES[site];
}

/** Which site an item page belongs to, from its host. */
export function siteOf(sourceUrl: string): ShowcaseSite | null {
  let host: string;
  try {
    host = new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host === "dribbble.com" || host.endsWith(".dribbble.com")) return "dribbble";
  if (host === "behance.net" || host.endsWith(".behance.net")) return "behance";
  if (host === "pinterest.com" || host.endsWith(".pinterest.com")) return "pinterest";
  return null;
}

const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D]/gu;
const tidy = (s: string) => s.replace(EMOJI, "").replace(/\s+/g, " ").trim().replace(/^[^\p{L}\p{N}]+/u, "");

/**
 * Splits a search result title into the work's title and its creator.
 * - Dribbble: "TITLE by NAME on Dribbble", "TITLE by NAME for STUDIO on Dribbble". A role after
 *   the name ("NAME - Product Designer") is dropped.
 * - Behance: "TITLE :: Behance", "TITLE (3) | Images :: Behance", "TITLE by NAME :: Behance".
 * - Pinterest and others: "TITLE by NAME" when present.
 * Without a "by NAME" part the creator is left out.
 */
export function parseShowcaseTitle(searchTitle: string): { title: string; creator?: string } {
  let rest = searchTitle.replace(/\s+/g, " ").trim();
  rest = rest.replace(/\s+on Dribbble$/i, "").replace(/\s*::\s*Behance$/i, "");
  rest = rest.replace(/\s*\(\d+\)\s*\|\s*Images$/i, "").replace(/\s*\|\s*Images$/i, "");
  const by = /^(.*\S)\s+by\s+(.+?)$/i.exec(rest);
  if (!by) return { title: tidy(rest) };
  const title = tidy(by[1]!);
  const creator = tidy(by[2]!.split(/\s+for\s+/i)[0]!.split(/\s+[-|–]\s+/)[0]!);
  return creator ? { title, creator } : { title };
}

function build(raw: RawItem): ShowcaseItem {
  const site = siteOf(raw.sourceUrl);
  if (!site) throw new Error(`showcase: ${raw.id} is not on a known site`);
  const { title, creator } = parseShowcaseTitle(raw.searchTitle);
  const up = upgradeImage(new URL(raw.searchImageUrl), raw.width, raw.height);
  // Dribbble's `vertical` only means something next to `resize`, which the upgrade removed.
  const imageUrl = up.url.replace(/[?&]vertical=center$/, "").replace("?vertical=center&", "?");
  return {
    id: raw.id,
    title,
    ...(creator ? { creator } : {}),
    sourceSite: site,
    sourceUrl: raw.sourceUrl,
    imageUrl,
    thumbUrl: raw.thumbUrl,
    ...(up.width && up.height ? { width: up.width, height: up.height } : {}),
    ...(raw.move ? { move: raw.move } : {}),
    lens: raw.lens,
  };
}

const D = (path: string) => `https://cdn.dribbble.com/userupload/${path}`;
/** Dribbble display size: 640 by 480, centered, as WebP. */
const DT = (path: string) => `${D(path)}?format=webp&resize=640x480&vertical=center`;
const B = (folder: string, file: string) => `https://mir-s3-cdn-cf.behance.net/project_modules/${folder}/${file}`;

const RAW: readonly RawItem[] = [
  {
    id: "sadu-fabric",
    searchTitle: "Sadu Fabric :: Behance",
    sourceUrl: "https://www.behance.net/gallery/70082187/Sadu-Fabric",
    searchImageUrl: B("hd_webp", "8a888c70082187.5b97a0aa6b9d9.jpg"),
    thumbUrl: B("max_632_webp", "8a888c70082187.5b97a0aa6b9d9.jpg"),
    width: 850,
    height: 704,
    move: "material",
    lens: "sadu",
  },
  {
    id: "square-kufic",
    searchTitle: "Square Kufic Calligraphy Vol. 2 :: Behance",
    sourceUrl: "https://www.behance.net/gallery/137528153/Square-Kufic-Calligraphy-Vol-2",
    searchImageUrl: B("1400_webp", "895a30137528153.620ce1af75c31.png"),
    thumbUrl: B("max_632_webp", "895a30137528153.620ce1af75c31.png"),
    width: 1400,
    height: 1400,
    move: "lens",
    lens: "kufic",
  },
  {
    id: "iridescent-sphere",
    searchTitle: "Iridescent sphere by Aleksei Vasileika on Dribbble",
    sourceUrl: "https://dribbble.com/shots/23967504-Iridescent-sphere",
    searchImageUrl: D("13986192/file/still-de7c1bcd394512fd9af93bb616a33a1c.png"),
    thumbUrl: DT("13986192/file/still-de7c1bcd394512fd9af93bb616a33a1c.png"),
    width: 1600,
    height: 1200,
    move: "material",
    lens: "iridescent",
  },
  {
    id: "liquid-glass-finance",
    searchTitle: "Liquid Glass Finance App UI by Make Smth on Dribbble",
    sourceUrl: "https://dribbble.com/shots/26311141-Liquid-Glass-Finance-App-UI",
    searchImageUrl: `${D("44216225/file/original-fe63051e85b5c38f43260506d03552b2.png")}?resize=752x&vertical=center`,
    thumbUrl: DT("44216225/file/original-fe63051e85b5c38f43260506d03552b2.png"),
    move: "material",
    lens: "liquidGlass",
  },
  {
    id: "punk-halftone",
    searchTitle: "Punk Poster | Vol 01 #halftone by Clipse on Dribbble",
    sourceUrl: "https://dribbble.com/shots/23701911-Punk-Poster-Vol-01-halftone",
    searchImageUrl: `${D("13224707/file/original-7ed4228889afccf10ca522cfc1ad5f16.png")}?resize=3000x3000`,
    thumbUrl: DT("13224707/file/original-7ed4228889afccf10ca522cfc1ad5f16.png"),
    move: "era",
    lens: "halftone",
  },
  {
    id: "bento-numbers",
    searchTitle: "🎨 Bento Grid Dashboard by Tasfia Barshat on Dribbble",
    sourceUrl: "https://dribbble.com/shots/26364840--Bento-Grid-Dashboard",
    searchImageUrl: `${D("44384722/file/61c7491403622cbf2a9f537afe9a7dbe.png")}?crop=0x0-1365x1024`,
    thumbUrl: `${D("44384722/file/61c7491403622cbf2a9f537afe9a7dbe.png")}?crop=0x0-1365x1024&format=webp&resize=640x480&vertical=center`,
    width: 1365,
    height: 1024,
    move: "scale",
    lens: "bigNumbers",
  },
  {
    id: "kaufmann-desert",
    searchTitle: "The Full 3D Kaufmann Desert House Archive :: Behance",
    sourceUrl: "https://www.behance.net/gallery/134293871/The-Full-3D-Kaufmann-Desert-House-Archive",
    searchImageUrl: B("1400_webp", "acac69134293871.61d33995e95ee.jpg"),
    thumbUrl: B("max_632_webp", "acac69134293871.61d33995e95ee.jpg"),
    width: 1400,
    height: 933,
    move: "transplant",
    lens: "desertModern",
  },
  {
    id: "memphis-pattern",
    searchTitle: "Memphis Pattern by Stephanie Schepel on Dribbble",
    sourceUrl: "https://dribbble.com/shots/22054462-Memphis-Pattern",
    searchImageUrl: D("8722347/file/original-005416d98446f40df106a04e6b1c9bd7.png"),
    thumbUrl: DT("8722347/file/original-005416d98446f40df106a04e6b1c9bd7.png"),
    width: 2212,
    height: 1667,
    move: "era",
    lens: "memphis",
  },
  {
    id: "abiya-mashrabiya",
    searchTitle: "ABIYA Mashrabiya (6) | Images :: Behance",
    sourceUrl: "https://www.behance.net/gallery/96036275/ABIYA-Mashrabiya",
    searchImageUrl: B("fs", "89408296036275.5ea57d1407980.jpg"),
    thumbUrl: B("max_632_webp", "89408296036275.5ea57d1407980.jpg"),
    width: 1920,
    height: 1280,
    move: "lens",
    lens: "mashrabiya",
  },
  {
    id: "grainy-poster",
    searchTitle: "Grainy Poster by Cristiano Pezzati on Dribbble",
    sourceUrl: "https://dribbble.com/shots/4728966-Grainy-Poster",
    searchImageUrl: `${D("23145661/file/original-6e3dc8dd410ecfa93f27196dcc3ca0b5.jpg")}?resize=752x&vertical=center`,
    thumbUrl: DT("23145661/file/original-6e3dc8dd410ecfa93f27196dcc3ca0b5.jpg"),
    move: "material",
    lens: "grain",
  },
  {
    id: "nureyev-poster",
    searchTitle: "poster#002 by Alina Chueva on Dribbble",
    sourceUrl: "https://dribbble.com/shots/13161784-poster-002",
    searchImageUrl: `${D("28007107/file/original-160659e6dd7e94b6b20827b1a1edc644.png")}?format=webp&resize=400x300&vertical=center`,
    thumbUrl: DT("28007107/file/original-160659e6dd7e94b6b20827b1a1edc644.png"),
    move: "constraint",
    lens: "swissGrid",
  },
  {
    id: "neumorphic-radio",
    searchTitle: "Radio Player App 🎛 | Neumorphic concept by Oleksandr Plyuto 🇺🇦 for  heartbeat on Dribbble",
    sourceUrl: "https://dribbble.com/shots/11629433-Radio-Player-App-Neumorphic-concept",
    searchImageUrl: D("27397959/file/still-7214168a0fed231201487831c62efc81.png"),
    thumbUrl: DT("27397959/file/still-7214168a0fed231201487831c62efc81.png"),
    width: 1600,
    height: 1200,
    move: "constraint",
    lens: "quietSpace",
  },
  {
    id: "riso-weber",
    searchTitle: "Risograph Print by David Weber on Dribbble",
    sourceUrl: "https://dribbble.com/shots/7824201-Risograph-Print",
    searchImageUrl: D("25156322/file/original-27793d6b44b35057009a5364e217b16c.png"),
    thumbUrl: DT("25156322/file/original-27793d6b44b35057009a5364e217b16c.png"),
    width: 1600,
    height: 1200,
    move: "era",
    lens: "riso",
  },
  {
    id: "brutalist-architecture",
    searchTitle: "Brutalist Architecture UI by Isa Djan Hindic on Dribbble",
    sourceUrl: "https://dribbble.com/shots/23754977-Brutalist-Architecture-UI",
    searchImageUrl: `${D("13378235/file/original-65c9a30d29347e7d2045438e1b3b57a0.png")}?resize=752x&vertical=center`,
    thumbUrl: DT("13378235/file/original-65c9a30d29347e7d2045438e1b3b57a0.png"),
    move: "transplant",
    lens: "brutalist",
  },
  {
    id: "flight-booking",
    searchTitle: "Flight Booking App UI by Sujon Hossain for Artxis on Dribbble",
    sourceUrl: "https://dribbble.com/shots/26612486-Flight-Booking-App-UI",
    searchImageUrl: `${D("45188286/file/83a40635d76208fd92c5cbd2a67edf33.png")}?resize=752x&vertical=center`,
    thumbUrl: DT("45188286/file/83a40635d76208fd92c5cbd2a67edf33.png"),
    lens: "travelApp",
  },
  {
    id: "fintech-minimal",
    searchTitle:
      "Fintech App UI – Minimal finance Mobile Apps | Expense apps by Imrul Kayes  - SaaS Product Designer for Taqwah - SaaS UI UX Design Agency on Dribbble",
    sourceUrl: "https://dribbble.com/shots/26313484-Fintech-App-UI-Minimal-finance-Mobile-Apps-Expense-apps",
    searchImageUrl: `${D("44223508/file/original-9b9f02d63f420fb9eb05a6198b999939.png")}?resize=752x&vertical=center`,
    thumbUrl: DT("44223508/file/original-9b9f02d63f420fb9eb05a6198b999939.png"),
    move: "constraint",
    lens: "minimal",
  },
  {
    id: "bento-dashboard",
    searchTitle: "Bento dashboard UI by Serhii Antoniuk for Kreyda - Product Design Partner  on Dribbble",
    sourceUrl: "https://dribbble.com/shots/25960339-Bento-dashboard-UI",
    searchImageUrl: `${D("43110250/file/original-fc7f560b265a58d8373330800961b273.jpg")}?resize=752x&vertical=center`,
    thumbUrl: DT("43110250/file/original-fc7f560b265a58d8373330800961b273.jpg"),
    move: "constraint",
    lens: "bento",
  },
  {
    id: "casa-nero",
    searchTitle: "CASA NERO – Fashion Website Design (Editorial Landing Page) by Elux Space  on Dribbble",
    sourceUrl: "https://dribbble.com/shots/27278082-CASA-NERO-Fashion-Website-Design-Editorial-Landing-Page",
    searchImageUrl: D("47385738/file/43ebd5fbc3618338c7b2eeac43859152.png"),
    thumbUrl: DT("47385738/file/43ebd5fbc3618338c7b2eeac43859152.png"),
    width: 3200,
    height: 2400,
    move: "transplant",
    lens: "editorial",
  },
  {
    id: "swiss-shot-machine",
    searchTitle: "Swiss Style Poster Design by Shot Machine on Dribbble",
    sourceUrl: "https://dribbble.com/shots/26372570-Swiss-Style-Poster-Design",
    searchImageUrl: D("44409322/file/60f5544e776a461aab2dbeb020186b17.png"),
    thumbUrl: DT("44409322/file/60f5544e776a461aab2dbeb020186b17.png"),
    width: 1600,
    height: 1200,
    move: "constraint",
    lens: "swissGrid",
  },
  {
    id: "catania-riso",
    searchTitle: "Catania Risograph by Isaac LeFever on Dribbble",
    sourceUrl: "https://dribbble.com/shots/25640931-Catania-Risograph",
    searchImageUrl: `${D("30073324/file/original-0a227279988a3b9640b9531fe56479c5.jpg")}?resize=752x&vertical=center`,
    thumbUrl: DT("30073324/file/original-0a227279988a3b9640b9531fe56479c5.jpg"),
    move: "era",
    lens: "riso",
  },
  {
    id: "desert-sanctuary",
    searchTitle: "Desert sanctuary, Mexican architecture",
    sourceUrl: "https://fr.pinterest.com/pin/544161567498674596/",
    searchImageUrl: "https://i.pinimg.com/564x/a9/ae/9f/a9ae9fd46a09072f5e05f36f83774fa8.jpg",
    thumbUrl: "https://i.pinimg.com/736x/a9/ae/9f/a9ae9fd46a09072f5e05f36f83774fa8.jpg",
    width: 564,
    height: 697,
    move: "transplant",
    lens: "desertModern",
  },
  {
    id: "iridescent-chrome",
    searchTitle: "Iridescent Chrome (11) | Images :: Behance",
    sourceUrl: "https://www.behance.net/gallery/94044191/Iridescent-Chrome",
    searchImageUrl: B("fs", "fb5c8794044191.5e749523401e8.jpg"),
    thumbUrl: B("max_632", "fb5c8794044191.5e749523401e8.jpg"),
    width: 1400,
    height: 1500,
    move: "material",
    lens: "iridescent",
  },
];

export const SHOWCASE: readonly ShowcaseItem[] = RAW.map(build);
export type ShowcaseId = (typeof RAW)[number]["id"];

/** Image hosts the showcase hotlinks from (plain <img>, never the Next image optimizer). */
export const SHOWCASE_IMAGE_HOSTS = ["cdn.dribbble.com", "mir-s3-cdn-cf.behance.net", "i.pinimg.com"] as const;

/** The reference shown on each hero tile, by the tile's fallback art. */
export const HERO_REFS: Readonly<Record<ArtKind, string>> = {
  sadu: "sadu-fabric",
  kufic: "square-kufic",
  iridescent: "iridescent-sphere",
  fluted: "liquid-glass-finance",
  halftone: "punk-halftone",
  numerals: "bento-numbers",
  dusk: "kaufmann-desert",
  memphis: "memphis-pattern",
  mashrabiya: "abiya-mashrabiya",
  grain: "grainy-poster",
  swiss: "nureyev-poster",
  ma: "neumorphic-radio",
  riso: "riso-weber",
  blueprint: "brutalist-architecture",
};

/** The four example boards, in gallery card order, four references each (art fallbacks: GALLERY_BOARDS). */
export const GALLERY_REFS: readonly (readonly [string, string, string, string])[] = [
  ["sadu-fabric", "kaufmann-desert", "flight-booking", "fintech-minimal"],
  ["swiss-shot-machine", "casa-nero", "bento-dashboard", "neumorphic-radio"],
  ["memphis-pattern", "catania-riso", "punk-halftone", "iridescent-chrome"],
  ["abiya-mashrabiya", "liquid-glass-finance", "square-kufic", "brutalist-architecture"],
];

/** The small collage above the final call to action. */
export const FINAL_REFS: readonly string[] = [
  "nureyev-poster",
  "iridescent-sphere",
  "riso-weber",
  "desert-sanctuary",
  "grainy-poster",
  "bento-numbers",
];

/** Lookup by id over a (takedown filtered) list. A missing id means the item is not shown. */
export function showcaseIndex(items: readonly ShowcaseItem[]): ReadonlyMap<string, ShowcaseItem> {
  return new Map(items.map((i) => [i.id, i]));
}
