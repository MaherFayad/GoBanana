/**
 * The art ladder (pure, rule based, no AI): per ingredient, the art lane searches the world's
 * graphic systems before its objects. Raw ingredients return product photos and shop listings
 * ("seersucker texture", "barometer dial") that give a UI designer nothing to take
 * (docs/gobanana-v4-plan.md section 6). Rungs, tried in order:
 *
 *   system   "{ingredient} identity system", or "signage system" for places, transport, maps,
 *            boards and signs                                       behance.net/gallery
 *   graphic  "{ingredient} graphic design", or "poster" for a popular art subject (an era or
 *            movement from lib/bend/lists/eras.json)                 pinterest.com/pin
 *   pattern  "{ingredient} pattern", or "typography" for lettering, signage, print and type
 *                                                                    pinterest.com/pin
 *   raw      the raw art query, as before                            pinterest.com/pin
 *
 * Round 7 of docs/search-quality-experiment.md: Behance galleries are the best source for brand
 * identity and craft; "poster" and "graphic design" add art direction on popular topics only.
 * A lens ingredient (a craft tradition: Sadu, talli, bojagi) keeps its tested lens words: on
 * Behance as its system rung, then raw on Pinterest. "poster" on a niche tradition found 0.
 */
import erasJson from "../bend/lists/eras.json";
import traditionsJson from "../bend/lists/traditions.json";
import lensesJson from "../bend/lenses.json";
import type { ArtRung, SourceSite } from "./types";

export type ArtLadderStep = { rung: ArtRung; query: string; site: SourceSite };
export type ArtLadder = { ingredient: string; rungs: ArtLadderStep[] };

/** A rung that keeps fewer usable item-page results than this falls through to the next rung. */
export const ART_RUNG_MIN = 4;

/** Most words in one rung query. */
const MAX_WORDS = 8;

type RawEntry = string | { label: string; query?: string };
const entryTexts = (list: readonly RawEntry[]) =>
  list.flatMap((e) => (typeof e === "string" ? [e] : [e.label, ...(e.query ? [e.query] : [])])).map((t) => t.toLowerCase());

const YEAR = /(?<![\p{L}\p{N}])(1[89]\d\d|20\d\d)(?![\p{L}\p{N}])/gu;
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const noYears = (s: string) => squash(s.replace(YEAR, " "));

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Era and movement names (lib/bend/lists/eras.json), years dropped: the popular art subjects. */
const POPULAR: readonly string[] = [...new Set(entryTexts(erasJson as RawEntry[]).map(noYears).filter((t) => t.length >= 3))];
/** Craft traditions (lib/bend/lists/traditions.json) and lens presets (lib/bend/lenses.json). */
const TRADITIONS: readonly string[] = entryTexts(traditionsJson as RawEntry[]);
const LENSES: readonly { anchors: readonly string[]; terms: readonly string[] }[] = lensesJson;

const wordsRe = (alternatives: string): RegExp => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives})(?![\\p{L}\\p{N}_])`, "iu");

/** Whole-phrase matchers of the popular subjects ("op art" must not match "shop art"). */
const POPULAR_RE: readonly RegExp[] = POPULAR.map((p) => wordsRe(escapeRe(p).replace(/ /g, "\\s+")));

/** Places, transport, maps, boards and signs: their graphic system is a signage system. */
const PLACE_WORDS = wordsRe(
  [
    "airports?|airlines?|aviation|flights?|departures?|arrivals?|terminals?|boarding",
    "stations?|metro|subway|underground|tube|trains?|rail|railways?|tram|trams|bus|buses|transit|transport|transportation",
    "highways?|roads?|streets?|motorway|parking|traffic|wayfinding|platforms?",
    "maps?|charts?|atlas|timetables?|scoreboards?|billboards?|split-flap",
    "(?:departure|arrivals|notice|bulletin|sign) boards?",
    "signs?|signage|neon",
    "city|cities|town|museums?|stadiums?|hospital|campus|zoo|library|hotels?|harbou?r|port|souq|souk|market|mall|elevators?",
  ].join("|"),
);

/** Lettering, signage, print and type: their pattern is typography. */
const TYPE_WORDS = wordsRe(
  [
    "letters?|lettering|letterpress|type|typefaces?|typography|typographic|fonts?|glyphs?|alphabets?|numerals?|calligraphy|calligraphic|script|kufic|khatt",
    "signs?|signage|neon|split-flap|(?:departure|arrivals) boards?|scoreboards?|billboards?",
    "prints?|printing|printed|printmaking|risograph|riso|screen ?print|woodblock|linocut|stencils?|ink",
    "labels?|tags?|stamps?|tickets?|posters?|playbills?|newspapers?|magazines?|zines?|masthead|headlines?|typewriter|receipts?|printouts?|menus?|timetables?|license plates?|banknotes?|cover|covers|sleeve|sleeves|wrappers?|packets?",
  ].join("|"),
);

/** Tails lib/bend/spec.ts artQueries adds to an ingredient, and the art arms' words (lib/learning/arms.ts). */
const TAILS = /\s+(?:graphic print close-up|design close-up|close-up|color palette|graphic design|texture|textures|pattern|patterns|poster|posters)$/i;

/**
 * The ingredient an art query is about: the tail the bend added cut off ("crushed velvet texture"
 * gives "crushed velvet", "vending machine design close-up" gives "vending machine"), and the
 * scale word "oversized" dropped ("oversized numerals graphic print close-up" gives "numerals").
 * The query itself when nothing is left.
 */
export function artIngredient(artQuery: string): string {
  const q = squash(artQuery);
  let out = q;
  for (let i = 0; i < 2; i++) {
    const next = out.replace(TAILS, "");
    if (next === out || !next.trim()) break;
    out = next;
  }
  out = squash(out.replace(/^(?:oversized|giant|huge)\s+/i, ""));
  return out || q;
}

/** True when the words are about a craft tradition: a lens anchor ("talli"), a lens term, or a traditions entry. */
export function isLensQuery(text: string): boolean {
  const q = squash(text.toLowerCase());
  if (!q) return false;
  if (LENSES.some((l) => l.anchors.some((a) => wordsRe(a).test(q)) || l.terms.some((t) => q.includes(t.toLowerCase())))) return true;
  return TRADITIONS.some((t) => q.includes(t));
}

/** True for a popular art subject (an era or movement from the bend lists): "poster" adds art direction on these. */
export function isPopularArtSubject(ingredient: string): boolean {
  const q = noYears(ingredient.toLowerCase());
  if (!q) return false;
  const whole = wordsRe(escapeRe(q).replace(/ /g, "\\s+"));
  return POPULAR_RE.some((re, i) => re.test(q) || (q.split(" ").length >= 2 && whole.test(POPULAR[i]!)));
}

/** True when the ingredient is a place, transport, map, board or sign. */
export const isPlaceIngredient = (ingredient: string) => PLACE_WORDS.test(ingredient);
/** True when the ingredient is lettering, signage, print or type. */
export const isTypeIngredient = (ingredient: string) => TYPE_WORDS.test(ingredient);

const cut = (s: string) => squash(s).split(" ").slice(0, MAX_WORDS).join(" ");
const hasWord = (s: string, w: RegExp) => w.test(s);

/**
 * The ladder for one art query (one of a direction's `artQueries`), in the order the art lane
 * tries it. `lens` says the query is a lens move's (lib/bend/spec.ts knows); left out, it is
 * detected from the words (isLensQuery), so a saved direction gets the same ladder back.
 */
export function buildArtLadder(artQuery: string, opts: { lens?: boolean } = {}): ArtLadder {
  const raw = cut(artQuery);
  const ingredient = artIngredient(raw);
  if (opts.lens ?? isLensQuery(raw)) {
    return {
      ingredient,
      rungs: [
        { rung: "system", query: raw, site: "behance" },
        { rung: "raw", query: raw, site: "pinterest" },
      ],
    };
  }
  // Years help the raw query find the period; on a system or poster they only narrow it ("Bauhaus 1923").
  const base = noYears(ingredient) || ingredient;
  // A mark or brand is identity work even when it belongs to a place ("airline logo").
  const brand = /\b(logos?|logotypes?|brands?|branding|crests?|emblems?|monograms?)\b/i.test(base);
  const system = hasWord(base, /\b(identity|signage|system)\b/i)
    ? base
    : `${base} ${isPlaceIngredient(base) && !brand ? "signage system" : "identity system"}`;
  const popular = isPopularArtSubject(ingredient);
  const graphic = hasWord(base, /\b(posters?|graphic design)\b/i)
    ? base
    : hasWord(base, /\b(graphics|design)$/i)
      ? (popular ? `${base} poster` : base)
      : `${base} ${popular ? "poster" : "graphic design"}`;
  const pattern = hasWord(base, /\b(pattern|patterns|typography)\b/i) ? base : `${base} ${isTypeIngredient(base) ? "typography" : "pattern"}`;
  const steps: ArtLadderStep[] = [
    { rung: "system", query: cut(system), site: "behance" },
    { rung: "graphic", query: cut(graphic), site: "pinterest" },
    { rung: "pattern", query: cut(pattern), site: "pinterest" },
    { rung: "raw", query: raw, site: "pinterest" },
  ];
  // The same words on the same site twice cost a request for nothing: keep the earlier rung.
  const seen = new Set<string>();
  const rungs = steps.filter((s) => {
    const key = `${s.query.toLowerCase()}|${s.site}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { ingredient, rungs };
}

/** "Behance", "Pinterest": a site as the text output names it. */
export function siteLabel(site: SourceSite): string {
  return site.charAt(0).toUpperCase() + site.slice(1);
}
