/**
 * Sweep plan (pure): search_references with `sweep` looks at the space around one page before
 * directions exist (docs/gobanana-v4-plan.md section 4). UI lanes only, one site per request with
 * path scoping, UI_NEG on every request, at most SERPER_MAX_REQUESTS (8) in all:
 *
 *   sweep-fidelity   "{domain} {page} {surface}"                dribbble.com/shots, then pinterest.com/pin
 *   sweep-component  "{core} {page} {component} {surface}"      dribbble.com/shots, up to 2
 *   sweep-adjacent   "{same job elsewhere} {surface}"           dribbble.com/shots, up to 2
 *   locale (ar)      "arabic {core} {surface}"                  pinterest.com/pin, titles name the subject
 *   taste            "{style} {domain} {page} ui design"        dribbble.com/shots, with the canvas taste only
 *
 * Fallbacks follow the niche ladder (docs/search-quality-experiment.md round 8): a thin answer is
 * retried once with the core noun. Priority order is the order above (fidelity on Dribbble, the
 * first component and adjacent lanes, fidelity on Pinterest, locale, the second component and
 * adjacent lanes, taste), so a cut keeps breadth first.
 */
import type { Platform } from "../direction-detail";
import { avoidWords, isArabicBrief, localeQuery, localeWord, sweepAdjacentQuery, sweepComponentQuery, sweepWords, tasteQuery } from "../bend/queries";
import { UI_NEG, type PlannedRequest } from "./plan";
import type { SearchLane, SourceSite } from "./types";
import { SERPER_MAX_REQUESTS } from "./web-search";

/** Most component and adjacent lanes a sweep plans (each takes up to 3, the first 2 are searched). */
export const MAX_SWEEP_COMPONENTS = 2;
export const MAX_SWEEP_ADJACENT = 2;

export type SweepInput = {
  /** The page or screen ("flight checkout"). */
  page: string;
  /** Short component nouns ("fare summary", "seat map"). */
  components?: readonly string[];
  /** The same job in other industries ("concert ticketing"). */
  adjacent?: readonly string[];
  platform: Platform;
  /** The canvas brief: Arabic or right to left adds the locale lane; its words keep platform title words. */
  brief?: string | null;
  /** One style word or phrase for the taste lane (the canvas taste), or none for no taste lane. */
  style?: string;
};

/** Plain words of each sweep lane, as the tool output shows them. */
export type SweepTexts = {
  page: string;
  platform: Platform;
  fidelity: string;
  component?: string[];
  adjacent?: string[];
  taste?: string;
  locale?: string;
};

const withNeg = (text: string) => `${text} ${UI_NEG}`;

/** The sweep's requests in priority order, at most SERPER_MAX_REQUESTS, and the lane words. */
export function planSweep(input: SweepInput): { plan: PlannedRequest[]; texts: SweepTexts } {
  const w = sweepWords(input.page, input.platform);
  const brief = input.brief?.trim() ?? "";
  const avoid = avoidWords(`${brief} ${input.page}`, input.platform);
  const avoidPart = avoid.length > 0 ? { avoidWords: avoid } : {};
  const req = (lane: SearchLane, query: string, site: SourceSite, fallback?: string, titleWord?: string): PlannedRequest => ({
    lane,
    query: withNeg(query),
    site,
    ...(fallback ? { fallback: withNeg(fallback) } : {}),
    ...(titleWord ? { titleWord } : {}),
    ...avoidPart,
  });

  const components = (input.components ?? [])
    .map((c) => sweepComponentQuery(w, c))
    .filter((c): c is NonNullable<typeof c> => c !== null && c.query !== w.fidelity)
    .filter((c, i, all) => all.findIndex((o) => o.query === c.query) === i)
    .slice(0, MAX_SWEEP_COMPONENTS);
  const adjacent = (input.adjacent ?? [])
    .map((a) => sweepAdjacentQuery(w, a))
    .filter((a): a is NonNullable<typeof a> => a !== null && a.query !== w.fidelity)
    .filter((a, i, all) => all.findIndex((o) => o.query === a.query) === i)
    .slice(0, MAX_SWEEP_ADJACENT);
  // The locale lane follows the canvas brief's market (or Arabic words in the page itself).
  const arabic = isArabicBrief(brief) || isArabicBrief(input.page);
  const locale = arabic ? localeQuery(`${w.brief} arabic`, input.platform) : null;
  const localeTitle = locale ? localeWord(`${w.brief} arabic`, input.platform) : undefined;
  const taste = input.style?.trim() ? tasteQuery(w.brief, input.style, input.platform) : undefined;

  const plan: PlannedRequest[] = [req("sweep-fidelity", w.fidelity, "dribbble", w.fidelityCore)];
  if (components[0]) plan.push(req("sweep-component", components[0].query, "dribbble", components[0].fallback));
  if (adjacent[0]) plan.push(req("sweep-adjacent", adjacent[0].query, "dribbble", adjacent[0].fallback));
  plan.push(req("sweep-fidelity", w.fidelity, "pinterest", w.fidelityCore));
  if (locale) plan.push(req("locale", locale, "pinterest", undefined, localeTitle));
  if (components[1]) plan.push(req("sweep-component", components[1].query, "dribbble", components[1].fallback));
  if (adjacent[1]) plan.push(req("sweep-adjacent", adjacent[1].query, "dribbble", adjacent[1].fallback));
  if (taste) plan.push(req("taste", taste, "dribbble"));

  const texts: SweepTexts = { page: input.page, platform: input.platform, fidelity: w.fidelity };
  if (components.length > 0) texts.component = components.map((c) => c.query);
  if (adjacent.length > 0) texts.adjacent = adjacent.map((a) => a.query);
  if (taste) texts.taste = taste;
  if (locale) texts.locale = locale;
  return { plan: plan.slice(0, SERPER_MAX_REQUESTS), texts };
}
