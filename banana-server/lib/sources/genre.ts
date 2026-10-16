/**
 * Non-UI genres (owner request, 2026-10-16): presentation design (pitch decks, keynote slides,
 * editorial report layouts) and graphic and branding design (identities, logo systems, brand
 * guidelines, posters, packaging, type-led work). Pure and dependency free.
 *
 * A genre is a search mode next to the platforms, never a platform: mobile, tablet, website and
 * web app briefs plan exactly as before (tests/genre-unchanged.test.ts). A brief gets a genre
 * only when the caller passes one, or when its platform is "any" (it names no device and no web
 * surface) and its words name the genre ("pitch deck for a fintech startup", "brand identity for
 * a coffee roaster"). Its results come from one lane per genre (`deck`, `brand`), worded from
 * the measured wordings below, gated by the genre's title words instead of the UI gate
 * (curated galleries pass by definition), and shown in the UI zone.
 *
 * Measured live 2026-10-16 (docs/taste-bar.md, "Presentation" and "Branding"; DECISIONS.md):
 * Dribbble "pitch deck presentation design" 10 of 10 deck shots; Pinterest "big number data slide
 * presentation design" and "keynote presentation slide design" 10 of 10 pins, about half kits;
 * Behance "editorial annual report presentation layout" 10 of 10 projects; Pitch templates 6 of
 * 10 item pages; Brand New 9 of 10.
 */
import type { LaneName, SourceSite } from "./types";

export const GENRES = ["presentation", "branding"] as const;
export type Genre = (typeof GENRES)[number];

export function isGenre(value: unknown): value is Genre {
  return typeof value === "string" && (GENRES as readonly string[]).includes(value);
}

/** The search lane of each genre (lib/sources/types.ts LANE_NAMES). */
export const GENRE_LANE = { presentation: "deck", branding: "brand" } as const satisfies Record<Genre, LaneName>;
export type GenreLane = (typeof GENRE_LANE)[Genre];

/** The genre of a genre lane, or null for every other lane. */
export function laneGenre(lane: LaneName | undefined): Genre | null {
  if (lane === "deck") return "presentation";
  if (lane === "brand") return "branding";
  return null;
}

/** Negatives on core sites (Pinterest, Dribbble, Behance): template and kit sales sheets. */
export const GENRE_NEG = "-template -kit -free";

/** One kind of work in a genre, with the wordings that find it. `{s}` is the subject (may be empty). */
type Kind = {
  /** The style keyword ("pitch deck", "logo system"). */
  keyword: string;
  /** Brief words that pick this kind. */
  match: RegExp;
  /** Wordings in priority order, on core sites or galleries. */
  wordings: readonly { site: SourceSite; text: string }[];
};

export type GenreProfile = {
  genre: Genre;
  label: string;
  lane: GenreLane;
  /** Style keywords: the kinds of work in this genre, as people say them. */
  keywords: readonly string[];
  /** Brief words that name the genre. */
  detect: RegExp;
  /** Core site results must name one of these in their title (galleries pass by definition). */
  titleWords: RegExp;
  /** Style word used when the brief and the taste name none (the owner's bar: dark first). */
  defaultStyle?: string;
  /** Galleries of this genre searched with the subject words, in order. */
  galleries: readonly SourceSite[];
  kinds: readonly Kind[];
};

const re = (words: string) => new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${words})(?![\\p{L}\\p{N}])`, "iu");

export const GENRE_PROFILES: Record<Genre, GenreProfile> = {
  presentation: {
    genre: "presentation",
    label: "presentation design",
    lane: "deck",
    keywords: ["pitch deck", "keynote", "slide layout", "data slide", "editorial deck", "dark deck", "big number slide"],
    detect: re("pitch ?decks?|slide ?decks?|decks?|slides?|keynotes?|presentations?|powerpoint|investor (?:deck|update)|annual reports?|sales decks?"),
    titleWords: re("pitch ?decks?|decks?|slides?|keynotes?|presentations?|powerpoint|annual reports?|reports?"),
    defaultStyle: "dark",
    galleries: ["pitch"],
    kinds: [
      {
        keyword: "big number slide",
        match: re("big numbers?|numbers?|stats?|figures?|metrics?|kpis?"),
        wordings: [
          { site: "pinterest", text: "big number data slide presentation design" },
          { site: "dribbble", text: "{style} {s} big number slide presentation" },
        ],
      },
      {
        keyword: "data slide",
        match: re("data|charts?|graphs?|dashboards?|results"),
        wordings: [
          { site: "dribbble", text: "{style} {s} data slide presentation design" },
          { site: "pinterest", text: "data slide presentation design" },
        ],
      },
      {
        keyword: "editorial deck",
        match: re("editorial|annual reports?|reports?|magazine|lookbook"),
        wordings: [
          { site: "behance", text: "{s} editorial annual report presentation layout" },
          { site: "pinterest", text: "editorial presentation layout design" },
        ],
      },
      {
        keyword: "keynote",
        match: re("keynotes?|talks?|conference|stage|event"),
        wordings: [
          { site: "dribbble", text: "{style} {s} keynote presentation slides" },
          { site: "pinterest", text: "keynote presentation slide design" },
        ],
      },
      {
        keyword: "slide layout",
        match: re("slide layouts?|layouts?|slide design|slides?"),
        wordings: [
          { site: "pinterest", text: "{s} presentation slide layout design" },
          { site: "dribbble", text: "{style} {s} presentation slide layout" },
        ],
      },
      {
        // The default kind: last so a more telling kind wins.
        keyword: "pitch deck",
        match: re("pitch ?decks?|decks?|investors?|fundrais\\w*|startup|sales"),
        wordings: [
          { site: "dribbble", text: "{style} {s} pitch deck presentation design" },
          { site: "behance", text: "{s} pitch deck presentation design" },
          { site: "pinterest", text: "{style} {s} pitch deck slides" },
        ],
      },
    ],
  },
  branding: {
    genre: "branding",
    label: "graphic and branding design",
    lane: "brand",
    keywords: ["brand identity", "logo system", "brand guidelines", "visual identity", "poster", "packaging", "typographic"],
    detect: re(
      "brand identity|branding|rebrand\\w*|logos?|logotypes?|wordmarks?|monograms?|visual identity|identity system|brand guidelines|brand ?book|style guide|posters?|packaging|labels?|typographic|type-led|lettering|brand marks?",
    ),
    titleWords: re(
      "brand(?:ing)?|identity|identities|logos?|logotypes?|wordmarks?|monograms?|guidelines|brand ?book|posters?|packaging|package|labels?|typograph\\w*|type|lettering|visual system",
    ),
    galleries: ["brandidentity", "bpando", "brandnew", "fontsinuse"],
    kinds: [
      {
        keyword: "packaging",
        match: re("packaging|package|labels?|bottles?|boxes|cans?|wine|coffee bags?"),
        wordings: [
          { site: "bpando", text: "{s} packaging" },
          { site: "pinterest", text: "{s} packaging design" },
          { site: "behance", text: "{s} packaging design" },
        ],
      },
      {
        keyword: "poster",
        match: re("posters?|prints?|flyers?|festival"),
        wordings: [
          { site: "typoposters", text: "{s} poster" },
          { site: "pinterest", text: "{s} poster design" },
          { site: "behance", text: "{s} poster design" },
        ],
      },
      {
        keyword: "typographic",
        match: re("typographic|typography|type-led|type|lettering|typefaces?"),
        wordings: [
          { site: "fontsinuse", text: "{s}" },
          { site: "pinterest", text: "{s} typographic identity design" },
        ],
      },
      {
        keyword: "brand guidelines",
        match: re("brand guidelines|guidelines|brand ?book|style guide"),
        wordings: [
          { site: "behance", text: "{s} brand guidelines" },
          { site: "pinterest", text: "{s} brand guidelines layout" },
        ],
      },
      {
        keyword: "logo system",
        match: re("logos?|logotypes?|wordmarks?|monograms?|marks?|logo system"),
        wordings: [
          { site: "brandnew", text: "{s} logo" },
          { site: "dribbble", text: "{s} logo system brand mark" },
          { site: "behance", text: "{s} logo design brand identity" },
        ],
      },
      {
        keyword: "visual identity",
        match: re("visual identity|identity system"),
        wordings: [
          { site: "behance", text: "{s} visual identity" },
          { site: "brandidentity", text: "{s} identity" },
        ],
      },
      {
        // The default kind.
        keyword: "brand identity",
        match: re("brand identity|branding|rebrand\\w*|brand"),
        wordings: [
          { site: "brandidentity", text: "{s} identity" },
          { site: "behance", text: "{s} brand identity" },
          { site: "dribbble", text: "{s} brand identity logo system" },
          { site: "pinterest", text: "{s} brand identity design" },
        ],
      },
    ],
  },
};

/**
 * The genre a brief or query names, or null. Presentation words win ("brand guidelines deck" is a
 * deck). Never call this for a brief whose platform is not "any": that brief is a UI brief.
 */
export function detectGenre(text: string | null | undefined): Genre | null {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return null;
  for (const g of GENRES) if (GENRE_PROFILES[g].detect.test(t)) return g;
  return null;
}

/** True when a core site result's title names the genre (galleries skip this: their items are the genre). */
export function isGenreTitle(title: string | undefined, genre: Genre): boolean {
  return Boolean(title) && GENRE_PROFILES[genre].titleWords.test(title!);
}

/** Words never kept in a genre subject: filler, genre words and generic business words. */
const SUBJECT_STOP = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "with", "in", "on", "at", "by", "from", "as", "into", "my", "our", "your",
  "new", "make", "design", "designs", "designed", "create", "need", "want", "some", "that", "this", "its", "it", "is", "be",
  "company", "companies", "startup", "startups", "business", "businesses", "brand", "brands", "agency", "studio", "client",
  "style", "look", "like", "inspired", "dark", "light", "minimal", "bold", "modern", "clean", "premium", "big", "one",
  "system", "systems", "page", "pages", "set", "series", "kit", "template", "templates", "free",
  "pitch", "update", "updates", "annual", "investor", "investors", "layout", "layouts", "visual", "deck", "decks",
]);

/** Every word any genre kind or detector names, so the subject keeps only what the work is about. */
function isGenreWord(word: string): boolean {
  return GENRES.some((g) => {
    const p = GENRE_PROFILES[g];
    return p.detect.test(word) || p.titleWords.test(word) || p.kinds.some((k) => k.match.test(word));
  });
}

/**
 * The subject of a genre brief: its first two content words that are not genre or filler words
 * ("pitch deck for a saudi fintech startup" gives "saudi fintech", "brand identity for a coffee
 * roaster" gives "coffee roaster"). Empty when the brief names only the genre.
 */
export function genreSubject(text: string): string {
  const main = text.replace(/\([^)]*\)?|\[[^\]]*\]?/g, " ").toLowerCase();
  const words = main.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? [];
  return words
    .filter((w) => w.length > 1 && !/^\d+$/.test(w) && !SUBJECT_STOP.has(w) && !isGenreWord(w))
    .slice(0, 2)
    .join(" ");
}

/** Style words the genre honours from the brief or taste ("dark", "minimal", "swiss"). */
const STYLE_WORDS = /\b(dark|light|minimal|minimalist|editorial|swiss|brutalist|bold|monochrome|luxury|playful|retro|vintage|neon|grainy|serif)\b/i;

/** The kinds a text names, in profile order; the genre's default kind when it names none. */
export function genreKinds(text: string, genre: Genre): Kind[] {
  const p = GENRE_PROFILES[genre];
  const named = p.kinds.filter((k) => k.match.test(text));
  return named.length > 0 ? named : [p.kinds[p.kinds.length - 1]!];
}

export type GenreRequest = { lane: GenreLane; query: string; site: SourceSite };

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * The genre lane's requests for a brief, in priority order, at most `max`: the first wording of
 * each named kind (the most telling kind first), then the genre's first gallery with the subject,
 * then the kinds' other wordings. Core sites get GENRE_NEG; galleries get plain words.
 * `style` is the user's taste word, else a style word the brief names, else the genre default.
 */
export function genreRequests(text: string, genre: Genre, opts: { style?: string; max?: number } = {}): GenreRequest[] {
  const p = GENRE_PROFILES[genre];
  const s = genreSubject(text);
  const style = (opts.style?.trim() || text.match(STYLE_WORDS)?.[1] || p.defaultStyle || "").toLowerCase();
  const core = (site: SourceSite) => site === "pinterest" || site === "dribbble" || site === "behance";
  const word = (site: SourceSite, t: string) => {
    const filled = tidy(t.replace("{style}", style).replace("{s}", s));
    if (core(site)) return `${filled} ${GENRE_NEG}`;
    // Galleries index names and topics: no style word, and "design" when nothing is left.
    return tidy(t.replace("{style}", "").replace("{s}", s)) || "design";
  };
  const kinds = genreKinds(text, genre);
  const ordered: { site: SourceSite; text: string }[] = [];
  kinds.forEach((k) => ordered.push(k.wordings[0]!));
  // The genre's lead gallery with the subject (Pitch: "pitch deck" for a pitch deck, else "presentation").
  const galleryText = genre === "branding" ? "{s} identity" : kinds[0]!.keyword === "pitch deck" ? "{s} pitch deck" : "{s} presentation";
  for (const g of p.galleries.slice(0, 1)) ordered.push({ site: g, text: galleryText });
  kinds.forEach((k) => ordered.push(...k.wordings.slice(1)));
  const seen = new Set<string>();
  const out: GenreRequest[] = [];
  for (const w of ordered) {
    const query = word(w.site, w.text);
    const key = `${w.site}|${query}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ lane: p.lane, query, site: w.site });
    if (out.length >= (opts.max ?? 7)) break;
  }
  return out;
}
