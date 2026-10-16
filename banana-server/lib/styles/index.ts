/**
 * GoBanana visual styles (docs/styles/INDEX.md): 19 styles, each with signals, a nearest neighbour,
 * keywords per genre and the words that name it in a brief or taste. Pure and dependency free
 * apart from the data file, a mirror of docs/styles/styles.json (tests/styles.test.ts keeps them
 * equal). No AI: a style is read from words here; the user's agent reads it from thumbnails and
 * passes it back with rate_references.
 */
import data from "./styles.json";
import { cleanStyles, isStyleId, MAX_STYLE_TAGS, STYLE_IDS, type StyleId } from "./ids";

export { cleanStyles, isStyleId, MAX_STYLE_TAGS, STYLE_IDS, type StyleId };

/** Kinds of work a style's keywords are written for. */
export const STYLE_GENRES = ["mobile", "web", "showcase", "deck", "brand"] as const;
export type StyleGenre = (typeof STYLE_GENRES)[number];

export type Style = {
  id: StyleId;
  name: string;
  definition: string;
  signals: string[];
  genres: StyleGenre[];
  neighbour: StyleId;
  tellApart: string;
  great: string;
  cheap: string;
  keywords: Record<StyleGenre, string[]>;
  /** Words in a brief or taste that name the style. */
  words: string[];
  /** "dark" for the two dark styles: the diversity rule counts them as one tag. */
  group?: string;
  /** A tag layered on a base style (motion-first): rarely a main style. */
  layered?: boolean;
  mergedFrom?: string[];
  /** Core owner pick ids. */
  exemplars: string[];
};

export const STYLES: readonly Style[] = data.styles as Style[];
const BY_ID = new Map<string, Style>(STYLES.map((s) => [s.id, s]));

export function styleById(id: StyleId): Style {
  return BY_ID.get(id)!;
}

/** The style's nearest neighbour. */
export function neighbourOf(id: StyleId): StyleId {
  return styleById(id).neighbour;
}

/** The dark styles, counted as one tag by the diversity rule. */
export const DARK_STYLES: readonly StyleId[] = STYLES.filter((s) => s.group === "dark").map((s) => s.id);

/**
 * The style genre of a search: deck and brand genres first, else the platform (website briefs are
 * web showcase work, web apps and dashboards are web, phones and tablets are mobile).
 */
export function styleGenre(opts: { platform?: string | null; genre?: string | null }): StyleGenre | null {
  if (opts.genre === "presentation") return "deck";
  if (opts.genre === "branding") return "brand";
  switch (opts.platform) {
    case "mobile":
    case "tablet":
      return "mobile";
    case "webapp":
      return "web";
    case "website":
      return "showcase";
    default:
      return null;
  }
}

/** Lowercase plain words with spaces at both ends: "Dark-mode, big Type!" gives " dark mode big type ". */
const plain = (text: string) => ` ${(text.toLowerCase().match(/[\p{L}\p{N}.]+/gu) ?? []).join(" ")} `;

type Hit = { id: StyleId; at: number; len: number };

/**
 * The styles a brief or taste names, in the order they are named, from each style's words (whole
 * words; the longest phrase wins where two overlap, so "dark matte" is dark-quiet-matte, not
 * dark-luminous). With a genre, styles that do not fit it are left out ("3d" on a website is the
 * WebGL scene, on a phone soft 3D objects). Empty when nothing names a style.
 */
export function detectStyles(texts: readonly (string | null | undefined)[], genre?: StyleGenre | null): StyleId[] {
  const out: StyleId[] = [];
  for (const text of texts) {
    if (!text) continue;
    const t = plain(text);
    const hits: Hit[] = [];
    for (const s of STYLES) {
      if (genre && !s.genres.includes(genre)) continue;
      for (const w of s.words) {
        const p = plain(w).trim();
        if (!p) continue;
        let from = 0;
        for (;;) {
          const i = t.indexOf(` ${p} `, from);
          if (i < 0) break;
          hits.push({ id: s.id, at: i + 1, len: p.length });
          from = i + 1;
        }
      }
    }
    // Longest first; a hit overlapping a kept one is dropped. Ties keep the style list order.
    hits.sort((a, b) => b.len - a.len);
    const kept: Hit[] = [];
    for (const h of hits) if (!kept.some((k) => h.at < k.at + k.len && k.at < h.at + h.len)) kept.push(h);
    kept.sort((a, b) => a.at - b.at);
    for (const h of kept) if (!out.includes(h.id)) out.push(h.id);
  }
  return out;
}

/** Genres to try, in order, when a style has no keywords for the asked one. */
const NEAR_GENRES: Record<StyleGenre, StyleGenre[]> = {
  mobile: ["mobile", "web"],
  web: ["web", "mobile"],
  showcase: ["showcase", "web"],
  deck: ["deck"],
  brand: ["brand"],
};

/** The style's first keyword for a genre (or the nearest genre that has one), else null. */
export function styleKeyword(id: StyleId, genre: StyleGenre): string | null {
  const s = styleById(id);
  for (const g of NEAR_GENRES[genre]) if (s.keywords[g]?.[0]) return s.keywords[g][0]!;
  return null;
}

/** Showcase ids (lib/sources/showcase.ts) to style ids, so the old words keep working. */
export const SHOWCASE_STYLE_MAP: Readonly<Record<string, readonly StyleId[]>> = data.showcase as Record<string, StyleId[]>;

/** Diversity rule numbers (docs/styles/INDEX.md). */
export const STYLE_RULE = data.rule;
