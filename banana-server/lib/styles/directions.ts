/**
 * Each direction names its style id, and no two directions of one brief share a main style
 * (diversity rule 5, docs/styles/INDEX.md). Pure: words only, no AI.
 */
import { detectGenre } from "@/lib/sources/genre";
import { assignDirectionStyles } from "./diversity";
import { detectStyles, styleById, styleGenre, type StyleGenre, type StyleId } from "./index";

/**
 * Styles a direction takes when its words name none, per genre, in the order of the owner's picks
 * (docs/styles/INDEX.md counts): the leaning first, so a no-style brief still reads like the bar.
 */
export const FALLBACK_STYLES: Record<StyleGenre, readonly StyleId[]> = {
  mobile: ["dark-luminous", "minimal-mono-light", "photographic-hero", "dark-quiet-matte", "glass-frosted", "hero-numeral", "soft-3d-objects", "data-dense-dashboard", "big-type-display", "editorial-serif", "flat-color-field", "vivid-gradient"],
  web: ["dark-quiet-matte", "data-dense-dashboard", "minimal-mono-light", "glass-frosted", "photographic-hero", "hero-numeral", "dark-luminous", "soft-3d-objects", "editorial-serif", "vivid-gradient"],
  showcase: ["webgl-3d-scene", "playful-too-fun", "photographic-hero", "big-type-display", "illustrative-handmade", "editorial-serif", "flat-color-field", "retro-pixel-halftone", "dark-luminous"],
  deck: ["big-type-display", "hero-numeral", "dark-luminous", "editorial-serif", "photographic-hero", "flat-color-field", "minimal-mono-light", "dark-quiet-matte"],
  brand: ["type-led-brand-system", "flat-color-field", "photographic-hero", "big-type-display", "illustrative-handmade", "retro-pixel-halftone", "playful-too-fun", "editorial-serif"],
};

export type StyledDirection = {
  platform?: string | null;
  spec?: { styleWords?: readonly string[] } | null;
};

/** The style genre of a brief's directions: the deck or brand genre of an "any" brief, else the platform. */
export function briefStyleGenre(brief: string, platform: string | null | undefined): StyleGenre {
  const genre = platform === "any" || !platform ? detectGenre(brief) : null;
  return styleGenre({ platform: platform ?? null, genre }) ?? "mobile";
}

/** The styles a brief or taste asks for (their words), fitted to the genre. */
export function askedStyles(texts: readonly (string | null | undefined)[], genre: StyleGenre): StyleId[] {
  return detectStyles(texts, genre);
}

/**
 * One distinct style id per direction: the asked style and its neighbour lead, then each
 * direction's own style words, then the genre's fallback order.
 */
export function directionStyleIds(directions: readonly StyledDirection[], opts: { brief: string; taste?: readonly string[]; platform?: string | null }): { ids: StyleId[]; asked: StyleId[]; genre: StyleGenre } {
  const genre = briefStyleGenre(opts.brief, opts.platform ?? directions[0]?.platform ?? null);
  const asked = askedStyles([opts.brief, ...(opts.taste ?? [])], genre);
  const named = directions.map((d) => detectStyles(d.spec?.styleWords ?? [], genre));
  const fits = (id: StyleId) => styleById(id).genres.includes(genre);
  const ids = assignDirectionStyles(named, { asked, fits, fallback: FALLBACK_STYLES[genre] });
  return { ids, asked, genre };
}
