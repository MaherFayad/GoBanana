/**
 * Styles in search (pure, additive): a style the brief or taste names becomes the words of one
 * request, and results carry style tags. Briefs and tastes that name no style plan exactly as
 * before (tests/styles-search.test.ts and tests/genre-unchanged.test.ts).
 *
 * - Asked style (the user's brief or taste names it): the taste lane searches the style's keyword
 *   for the brief's genre with the brief's topic ("fintech glassmorphism app ui"); a deck or brand
 *   brief gets the keyword as its first genre request.
 * - A direction's own style id (bend_brief, rule 5) with nothing asked: only the direction's
 *   `tasteAlt` changes, the taste wording used when another direction on the canvas already sent
 *   the brief-level taste request. So the first direction keeps the measured taste lane and the
 *   others search their own style.
 */
import { GENRE_LANE, GENRE_NEG } from "@/lib/sources/genre";
import type { LaneTexts } from "@/lib/sources/plan";
import { cleanQuery } from "@/lib/sources/query";
import { queryWords } from "@/lib/learning/terms";
import { orderByStyle } from "./diversity";
import { cleanStyles, detectStyles, styleGenre, styleKeyword, type StyleGenre, type StyleId } from "./index";

/** The board a search result list is ordered for: a direction places 6 to 8 UI references. */
export const SEARCH_BOARD = 8;

/** The style a search used: its id and the plain words of its request. */
export type SearchStyle = { id: StyleId; words: string };

/** The genre the lanes were worded for. */
export function lanesGenre(lanes: Pick<LaneTexts, "platform" | "genre">): StyleGenre {
  return styleGenre({ platform: lanes.platform ?? null, genre: lanes.genre ?? null }) ?? "mobile";
}

/** The style's words for these lanes: the brief's topic and the style keyword, or null when the style has none. */
export function styleWords(lanes: Pick<LaneTexts, "platform" | "genre" | "topic">, id: StyleId): string | null {
  const keyword = styleKeyword(id, lanesGenre(lanes));
  if (!keyword) return null;
  // Genre lanes take the keyword alone (their subject is in the other requests).
  if (lanes.genre) return keyword;
  const topic = cleanQuery((lanes.topic ?? "").replace(/(^|\s)-\S+/g, " ")).split(" ").slice(0, 2).join(" ");
  const kw = keyword.split(" ");
  return [...(topic && !kw.includes(topic) ? [topic] : []), ...kw].join(" ").trim();
}

/**
 * Lanes with a style's words. `asked` replaces the taste lane (or adds the first genre request);
 * `direction` sets only `tasteAlt`. No style, or no keyword for the genre: the same lanes object.
 */
export function withStyleLane(lanes: LaneTexts, id: StyleId | null | undefined, mode: "asked" | "direction"): { lanes: LaneTexts; style?: SearchStyle } {
  if (!id) return { lanes };
  const words = styleWords(lanes, id);
  if (!words) return { lanes };
  if (lanes.genre && lanes.genreRequests?.length) {
    if (mode !== "asked") return { lanes };
    const lane = GENRE_LANE[lanes.genre];
    const query = `${words} ${GENRE_NEG}`;
    if (lanes.genreRequests.some((r) => r.query === query)) return { lanes, style: { id, words } };
    return { lanes: { ...lanes, genreRequests: [{ lane, query, site: "pinterest" }, ...lanes.genreRequests] }, style: { id, words } };
  }
  if (mode === "asked") {
    // A taste lane that already names the style keeps its measured wording; its results carry the style.
    if (lanes.taste && detectStyles([lanes.taste], lanesGenre(lanes)).includes(id)) return { lanes, style: { id, words: lanes.taste } };
    return { lanes: { ...lanes, taste: words }, style: { id, words } };
  }
  if (!lanes.tasteAlt) return { lanes };
  return { lanes: { ...lanes, tasteAlt: words }, style: { id, words } };
}

/**
 * Style tags on results: a result found by the style's request carries that style; a result the
 * agent tagged before on this canvas (rate_references styles) keeps its tags; else, for a plain
 * query that names styles, the styles it names (a first guess from the words, to be checked from
 * the thumbnail). Results with tags already keep them.
 */
export function tagResults<T extends { query?: string; sourceUrl: string; styles?: readonly string[]; zone?: string }>(
  refs: readonly T[],
  opts: { style?: SearchStyle; known?: ReadonlyMap<string, readonly string[]>; keyOf?: (url: string) => string; named?: readonly StyleId[] },
): T[] {
  const styleKey = opts.style ? queryWords(opts.style.words) : null;
  return refs.map((r) => {
    if (r.zone === "art") return r;
    const known = opts.known && opts.keyOf ? cleanStyles(opts.known.get(opts.keyOf(r.sourceUrl))) : undefined;
    const own = cleanStyles(r.styles);
    const found = styleKey && r.query && queryWords(r.query) === styleKey ? [opts.style!.id] : undefined;
    const named = opts.named?.length ? cleanStyles(opts.named) : undefined;
    const styles = known ?? own ?? found ?? named;
    return styles ? { ...r, styles } : r;
  });
}

/**
 * Search results ordered by the diversity rule (rules 1, 2 and 6 over the first SEARCH_BOARD UI
 * results): a tagged result over a cap moves to the end of the UI results, art stays after UI.
 * With no style tags at all the list comes back as it was (same array).
 */
export function orderResults<T extends { styles?: readonly string[]; zone?: string }>(refs: T[], count: number, asked: readonly StyleId[] = []): { refs: T[]; moved: number } {
  if (!refs.some((r) => r.styles?.length)) return { refs, moved: 0 };
  const ui = refs.filter((r) => r.zone !== "art");
  const art = refs.filter((r) => r.zone === "art");
  const ordered = orderByStyle(ui, Math.min(SEARCH_BOARD, count), { asked });
  return { refs: [...ordered.refs, ...art], moved: ordered.moved };
}

/** Style tags of a canvas by item key: tray results and placed references that carry them. */
export function canvasStyleTags(
  state: { tray: readonly { sourceUrl: string; styles?: readonly string[] }[]; nodes: readonly { data: unknown }[] },
  keyOf: (url: string) => string,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of state.tray) if (r.styles?.length) out.set(keyOf(r.sourceUrl), [...r.styles]);
  for (const n of state.nodes) {
    const d = n.data as { sourceUrl?: unknown; styles?: unknown };
    const styles = cleanStyles(d?.styles);
    if (typeof d?.sourceUrl === "string" && styles) out.set(keyOf(d.sourceUrl), styles);
  }
  return out;
}
