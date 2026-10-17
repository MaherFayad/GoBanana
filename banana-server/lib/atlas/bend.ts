/**
 * Bend engine v2 (P1-I2): directions from the Banana Atlas instead of word lists. Rule based and
 * deterministic, no AI: the same brief, wildness, moves and lens over the same Atlas give the same
 * directions. Behind BEND_ENGINE=atlas (default "lists" until Gate 2).
 *
 * Pipeline (docs/next-step-plan.md section 6.5):
 *   1. Parse the brief into a domain (J2), a page (J1) and a product noun.
 *   2. Candidate cards with a fit of 2 or more for the domain; fit 1 at wildness 4 and 5; the
 *      domain's clash families only at 5.
 *   3. Pick by diversity (MMR over family and kind), honoring moves, lens and Gulf-first. With a J4b
 *      page fit for the brief's page, a card leads with its page score (leadFit), and rule or
 *      layout cards never lead (isRuleCard; they can be the second card, which adds their rule).
 *   4. The second card that adds texture or motion, ranked like the lead (rankSeconds: never the
 *      lead's family, only a region the brief allows), and the clash check.
 *   5. The mechanic for the page's wild spot element (J5 plus the card's J4 lines), the element the
 *      lead's page reason names first (reasonElements).
 *   6. The spec from the lead card; a second card adds only texture or motion. The mechanic spans the
 *      page (R4, lib/atlas/page-span.ts): 2 or 3 J1 parts, at least one flow or structure part, the
 *      main task through it and the must keeps, in the layout line and the prompt.
 *   7. Queries from recipes (J7, page recipes with their topic slot filled by briefTopic), the
 *      Phase 0 lanes after them.
 *
 * Learning (W2): card and mechanic weights from `atlasWeights` and recipe draws from `pickRecipe`
 * (lib/atlas/learning.ts, the nightly `atlas_weights` table plus the user's own ratings), and the
 * user's taste profile (`applyTaste`, P2-02) only as a tie breaker between cards of equal fit.
 * With no learning and no profile the directions are the same as before.
 *
 * The output keeps the lists engine's shape (skills keep working) plus cardIds, mechanicId and
 * recipeIds. It returns null whenever the Atlas cannot answer (a page or domain it does not know,
 * too few cards, a shard it could not read): the caller then runs the lists engine.
 */
import type { TypeVoice, VisualSpec } from "@/lib/direction-detail";
import { isTypeVoice } from "@/lib/direction-detail";
import { directionTermKey } from "@/lib/learning/terms";
import { atlasTermKey } from "@/lib/learning/arms";
import { applyTaste, type TasteTarget } from "@/lib/taste-profile";
import { PLATFORM_PROFILES, resolvePlatform, type Platform } from "@/lib/platform";
import { cleanTaste } from "@/lib/taste";
import { checkCoherence, MAX_COHERENCE_TRIES } from "@/lib/bend/coherence";
import { cleanPages, clipTitle, joinList, MAX_TITLE_WORDS, MAX_TWIST_WORDS, phase0Queries, suggestLenses, takeQueries, TWIST_FROM_WILDNESS, wildSpotsFor, type BendOptions } from "@/lib/bend/index";
import { BendInputError, parseBendInput } from "@/lib/bend/input";
import { applyBrand } from "@/lib/bend/brand";
import { lensCulture } from "@/lib/culture/lens";
import { getLens } from "@/lib/bend/lists";
import { briefMarket, needsArabic, WIDER_REGION_FROM_WILDNESS } from "@/lib/bend/market";
import { brokenMustKeep, forbiddenElement, protectedElements, type Mechanic as DirectionMechanic, type MechanicElement } from "@/lib/bend/mechanic";
import { cyrb53, stableId } from "@/lib/bend/prng";
import { fixCase, PART, UI_WORDS, VERIFIED_STYLE_WORDS } from "@/lib/bend/spec";
import { extractSubject } from "@/lib/bend/subject";
import type { BendInput, BendResult, Direction, Ingredients, MoveId } from "@/lib/bend/types";
import { WILDNESS } from "@/lib/bend/wildness";
import { briefTopic as phase0Topic } from "@/lib/bend/queries";
import { askedStyles, briefStyleGenre } from "@/lib/styles/directions";
import { neighbourOf, type StyleId } from "@/lib/styles/index";
import { isStyleId } from "@/lib/styles/ids";
import { briefFit, briefWorld, occasionsIn } from "./brief-fit";
import { searchHints } from "./search-hints";
import { isStructural, platformSections, spanLayout, spanPage } from "./page-span";
import { chooseRecipe, idWeight, type AtlasLearning } from "./learning";
import { recipeId } from "./loader";
import { beatsPhase0, fillRecipes, MAX_RECIPE_WORDS, type PHASE0_PRECISION, recipeHoldsTopic } from "./recipe-fit";
import type { AtlasSource } from "./source";
import type { CardElementLine, DomainEntry, FitScore, IngredientCard, Mechanic, MotionRecipe, PageAnatomy, PageFitScore, QueryRecipe, ShaderRecipe, UiElement } from "./types";

/** Most shader and motion recipes one direction carries (VAL-14). Ids only. */
export const MAX_SHADERS = 1;
export const MAX_MOTION = 2;

type Stunning = { id: string; use: readonly UiElement[]; cardIds: readonly string[]; families: readonly string[]; lensIds: readonly string[]; styles?: readonly string[] };

/**
 * How well a J13 recipe fits a direction: the lens it follows (3), each of the direction's cards it
 * names (2 for the lead, 1 for the second), a shared card family (1), the element the
 * direction's mechanic lands on (1) and a style tag the direction targets (1, R2). Zero means no
 * fit: the recipe is never attached.
 */
export function stunningScore(r: Stunning, cards: readonly IngredientCard[], lensId: string | undefined, element: UiElement, styles: readonly string[] = []): number {
  let s = 0;
  if (lensId && r.lensIds.includes(lensId)) s += 3;
  cards.forEach((c, i) => {
    if (r.cardIds.includes(c.id)) s += i === 0 ? 2 : 1;
  });
  if (cards.some((c) => r.families.includes(c.family))) s += 1;
  if (s > 0 && r.use.includes(element)) s += 1;
  if (s > 0 && r.styles?.some((t) => styles.includes(t))) s += 1;
  return s;
}

/**
 * Up to `max` recipes for one direction, best fit first. Recipes already used by another direction
 * come after unused ones, and ties break by a seeded number so the same brief gives the same pick.
 * Motion recipes with a different trigger are preferred for the second pick.
 */
export function pickStunning<T extends Stunning & { trigger?: string }>(
  list: readonly T[],
  cards: readonly IngredientCard[],
  lensId: string | undefined,
  element: UiElement,
  max: number,
  used: Set<string>,
  seed: string,
  styles: readonly string[] = [],
): T[] {
  const scored = list
    .map((r) => ({ r, s: stunningScore(r, cards, lensId, element, styles) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => Number(used.has(a.r.id)) - Number(used.has(b.r.id)) || b.s - a.s || jitter(seed, a.r.id) - jitter(seed, b.r.id) || a.r.id.localeCompare(b.r.id));
  const out: T[] = [];
  for (const x of scored) {
    if (out.length >= max) break;
    if (out.some((o) => o.trigger !== undefined && o.trigger === x.r.trigger)) continue;
    out.push(x.r);
  }
  for (const x of scored) {
    if (out.length >= max) break;
    if (!out.includes(x.r)) out.push(x.r);
  }
  for (const r of out) used.add(r.id);
  return out;
}

/** Relevance a card gains when its main style is one the brief or taste asks for (R2). */
export const STYLE_MAIN_BONUS = 0.4;
/** Relevance a card gains when its second style is asked, or its main style is the asked style's neighbour. */
export const STYLE_NEAR_BONUS = 0.2;
/** Mechanic score a mechanic gains when its main style is the direction's target style (one buildability step). */
export const MECHANIC_STYLE_BONUS = 1;

/** A record's main style tag (R2), or null when it has none. */
export function mainStyleOf(r: { styles?: readonly string[] }): StyleId | null {
  const first = r.styles?.[0];
  return isStyleId(first) ? first : null;
}

/**
 * How much a card's style tags fit the styles a brief or taste asks for (R2): the main style asked
 * gains STYLE_MAIN_BONUS, a second style asked or the lead asked style's neighbour STYLE_NEAR_BONUS.
 * Zero with nothing asked or no tags.
 */
export function styleFit(styles: readonly string[] | undefined, asked: readonly StyleId[]): number {
  if (!styles || styles.length === 0 || asked.length === 0) return 0;
  const set = new Set<string>(asked);
  if (set.has(styles[0]!)) return STYLE_MAIN_BONUS;
  if (styles.slice(1).some((t) => set.has(t)) || styles[0] === neighbourOf(asked[0]!)) return STYLE_NEAR_BONUS;
  return 0;
}

/** Mechanic style score (R2): the target's main style as the mechanic's main style is a full bonus, any other overlap half. */
export function mechanicStyleScore(styles: readonly string[] | undefined, target: readonly string[]): number {
  if (!styles || styles.length === 0 || target.length === 0) return 0;
  if (styles[0] === target[0]) return MECHANIC_STYLE_BONUS;
  return styles.some((t) => target.includes(t)) ? MECHANIC_STYLE_BONUS / 2 : 0;
}

/**
 * Diversity rule 5 for leads (R2, docs/styles/INDEX.md): when no style is asked, the first `count`
 * leads take different main styles where the pool allows. A lead whose main style is already taken
 * moves after the others (never dropped); untagged leads keep their place. Stable otherwise.
 * R7: a lead `demote` marks (an expected card on a wild brief) never takes a front place for its
 * style; it only fills the front when too few others are left.
 */
export function spreadByStyle<T extends { styles?: readonly string[] }>(leads: readonly T[], count: number, demote?: (lead: T) => boolean): T[] {
  const front: T[] = [];
  const later: T[] = [];
  const used = new Set<string>();
  for (const l of leads) {
    const main = mainStyleOf(l);
    if (front.length < count && (!main || !used.has(main)) && !demote?.(l)) {
      front.push(l);
      if (main) used.add(main);
    } else later.push(l);
  }
  // Too few distinct styles: fill the front in the original order.
  while (front.length < Math.min(count, leads.length)) front.push(later.shift()!);
  return [...front, ...later];
}

const ENGINE_VERSION = "atlas-v1";
/** Directions generated before slicing to count, as the lists engine does. */
const GENERATED = 8;
/** Most candidate cards read per bend (the best fits first). */
export const MAX_CANDIDATES = 40;
/** MMR: how much a repeated family or kind costs against relevance. */
const LAMBDA = 0.5;
/** Relevance a Gulf tradition gains on a Gulf brief (Gulf-first, P0-07). */
const GULF_BONUS = 0.5;
/** Relevance any other Gulf card (an object, material or era from the Gulf) gains on a Gulf brief. */
const GULF_CARD_BONUS = 0.3;
/** Share of the theme domain's fit a card adds (0 to 3 times this). */
const THEME_SHARE = 0.4;
/** Fit a card gains per brief word its fit reason names, and the most it gains that way. */
const REASON_STEP = 0.25;
const REASON_MAX = 0.5;
/** A brief word counts for REASON_STEP only when fewer than this share of the domain's fit reasons name it. */
const RARE_SHARE = 0.15;
/** Fit a card gains per domain fit step over 2 when the page fit leads (Gate 2 round 3: the brief's product world counts too). */
export const DOMAIN_STEP = 0.25;
/** A bend needs at least this many lead cards (or `count` when smaller), else lists. */
const MIN_LEADS = 3;
/** The fallback subrequest budget the tool gives a bend (lib/atlas/loader.ts COST). */
export const BEND_SHARD_BUDGET = 40;

/** Atlas elements the direction's mechanic field can carry (lib/bend/mechanic.ts elements). */
export const ELEMENT_TO_MECHANIC: Readonly<Partial<Record<UiElement, MechanicElement>>> = {
  progress: "progress",
  stepper: "progress",
  total: "total",
  "price-breakdown": "total",
  cta: "cta",
  // Plan cards are picked, not pressed: not the main button "one primary action" protects (Gate 2 round 3).
  "paywall-plan": "plan",
  divider: "divider",
  "nav-tabs": "section-nav",
  "section-nav": "section-nav",
  "bottom-nav": "section-nav",
  header: "header",
  hero: "header",
  "empty-state": "empty-state",
  success: "empty-state",
};
/** Elements tried after the page's wild spots, safest first. */
const FALLBACK_ELEMENTS: readonly UiElement[] = ["header", "divider", "progress", "section-nav", "empty-state", "hero", "total", "cta"];

/** The move a card kind plays (lib/bend/moves.ts). */
export const KIND_MOVE: Readonly<Record<IngredientCard["kind"], MoveId>> = {
  object: "transplant",
  element: "transplant",
  material: "material",
  era: "era",
  tradition: "lens",
  constraint: "constraint",
  scale: "scale",
};
const KIND_SLOT: Readonly<Record<IngredientCard["kind"], Exclude<keyof Ingredients, "mood">>> = {
  object: "object",
  element: "element",
  material: "material",
  era: "era",
  tradition: "tradition",
  constraint: "constraint",
  scale: "element",
};

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
const words = (s: string) => s.split(/\s+/).filter(Boolean);
const has = (hay: string, phrase: string) => phrase.trim() !== "" && norm(hay).includes(norm(phrase));

/** Words too common to tell a page or a domain apart on their own. */
const STOP = new Set(["a", "an", "and", "app", "apps", "for", "the", "of", "to", "in", "on", "with", "page", "pages", "screen", "screens", "site", "web", "website", "online", "mobile", "digital", "services", "service", "platform", "platforms", "tools", "tool", "my", "your", "our", "its", "this", "that"]);

/** Content words of a phrase, singular ("shops" is "shop"), stop words left out. */
export function contentWords(text: string): string[] {
  return words(norm(text).trim())
    .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

/**
 * The page a brief (or the first page given) names: the longest matching name wins. With no name
 * in the text, the nearest page: the most content words shared with one of its names (two or more,
 * or one when the name has a single content word), so "bank onboarding flow" still finds a page.
 */
export function parsePage(text: string, pages: readonly PageAnatomy[]): PageAnatomy | null {
  let best: { page: PageAnatomy; score: number; name: string } | null = null;
  for (const page of pages) {
    for (const name of [...page.names.en, page.id.replace(/-/g, " ")]) {
      if (!has(text, name)) continue;
      const score = words(name).length;
      if (!best || score > best.score) best = { page, score, name };
    }
    for (const name of page.names.ar) if (name && text.includes(name) && !best) best = { page, score: 1, name: "" };
  }
  const brief = new Set(contentWords(text));
  if (best && !best.name) return best.page;
  if (best) {
    // R4: a narrower page whose name holds the matched name's words and more of the brief's own
    // ("kids reading app home screen": "kids app home screen" over "app home screen").
    const base = new Set(contentWords(best.name));
    let narrow: { page: PageAnatomy; n: number } | null = null;
    for (const page of pages) {
      for (const name of page.names.en) {
        const w = [...new Set(contentWords(name))];
        if (w.length > base.size && [...base].every((x) => w.includes(x)) && w.every((x) => brief.has(x)) && (!narrow || w.length > narrow.n)) narrow = { page, n: w.length };
      }
    }
    return narrow?.page ?? best.page;
  }
  let near: { page: PageAnatomy; score: number } | null = null;
  for (const page of pages) {
    for (const name of [...page.names.en, page.id.replace(/-/g, " ")]) {
      const nameWords = [...new Set(contentWords(name))];
      const shared = nameWords.filter((w) => brief.has(w)).length;
      if (shared === 0 || (shared < 2 && nameWords.length > 1)) continue;
      const score = shared / nameWords.length + shared;
      if (!near || score > near.score) near = { page, score };
    }
  }
  return near?.page ?? null;
}

/**
 * The domain a brief names. A whole domain name counts most (two per word), then a product noun
 * (one plus its words), then single content words shared with the domain's names (one each, only
 * words that name three domains or fewer, so "banking" finds the banking domains and "apps" finds
 * nothing). Product nouns that are page words ("page", "dashboard", "screen", or the head word of
 * one of the matched page's names) are left out: "coffee shop landing page" is a coffee brief, not a notes app.
 */
export function parseDomain(text: string, domains: readonly DomainEntry[], page?: PageAnatomy | null): { domain: DomainEntry; productNoun: string | null } | null {
  const top = rankDomains(text, domains, page)[0];
  return top ? { domain: top.domain, productNoun: top.productNoun } : null;
}

/**
 * The second domain a brief names by its own words ("Ramadan" in "Ramadan offers page for a food
 * delivery app" names faith and lifestyle), or null. A product noun alone never makes a theme.
 */
export function parseTheme(text: string, domains: readonly DomainEntry[], page?: PageAnatomy | null): DomainEntry | null {
  const [first, ...rest] = rankDomains(text, domains, page);
  if (!first) return null;
  // Gate 2 round 3: a theme only from a whole domain name or an occasion word its names hold. A
  // shared single word made noise ("home" gave kids reading a real estate theme, "pay" gave Qatar
  // services a BNPL theme, "food" gave Ramadan offers restaurants instead of faith and lifestyle).
  const occasions = occasionsIn(text);
  const strong = (d: DomainEntry) =>
    d.names.en.some((n) => has(text, n)) || d.names.ar.some((n) => n && text.includes(n)) || (occasions.length > 0 && occasionsIn(d.names.en.join(" ")).some((o) => occasions.includes(o)));
  const byOccasion = occasions.length > 0 ? domains.find((d) => d !== first.domain && occasionsIn(d.names.en.join(" ")).some((o) => occasions.includes(o))) : undefined;
  return rest.find((r) => r.named && strong(r.domain))?.domain ?? byOccasion ?? null;
}

type RankedDomain = { domain: DomainEntry; productNoun: string | null; score: number; named: boolean };

function rankDomains(text: string, domains: readonly DomainEntry[], page?: PageAnatomy | null): RankedDomain[] {
  const pageWords = new Set(page ? [...page.names.en, page.id.replace(/-/g, " ")].map((n) => contentWords(n).at(-1) ?? "") : []);
  const isPageWord = (noun: string) => {
    const w = contentWords(noun);
    return w.length === 0 || w.every((x) => pageWords.has(x) || PAGE_NOUNS.has(x));
  };
  const nameWords = domains.map((d) => new Set(d.names.en.flatMap(contentWords)));
  const spread = new Map<string, number>();
  for (const set of nameWords) for (const w of set) spread.set(w, (spread.get(w) ?? 0) + 1);
  const brief = new Set(contentWords(text));
  const out: RankedDomain[] = [];
  domains.forEach((domain, i) => {
    let score = 0;
    let named = 0;
    let noun: string | null = null;
    for (const p of domain.productNouns) {
      if (has(text, p) && !isPageWord(p)) {
        score = Math.max(score, 1 + words(p).length);
        noun ??= p;
      }
    }
    for (const n of domain.names.en) if (has(text, n)) named = Math.max(named, 2 * words(n).length);
    for (const n of domain.names.ar) if (n && text.includes(n)) named = Math.max(named, 2);
    named += [...nameWords[i]!].filter((w) => brief.has(w) && (spread.get(w) ?? 0) <= 3).length;
    score = Math.max(score, named) + (score > 0 && named > 0 ? Math.min(score, named) / 2 : 0);
    if (score > 0) out.push({ domain, productNoun: noun, score, named: named > 0 });
  });
  // Ties keep the Atlas order (sort is stable).
  return out.sort((a, b) => b.score - a.score);
}

/** Nouns that name a page or a part of one, never a product. */
const PAGE_NOUNS = new Set(["page", "screen", "dashboard", "home", "landing", "listing", "profile", "settings", "checkout", "onboarding", "template", "widget", "report", "chart", "form"]);

/** The product noun as the brief writes it ("eSIM", not "esim"). */
function briefCasing(brief: string, noun: string): string {
  const at = brief.toLowerCase().indexOf(noun.toLowerCase());
  return at >= 0 ? brief.slice(at, at + noun.length) : noun;
}

/** Element card families that are a layout or UI part, not an idea (Progress Bars, toggles). */
const LAYOUT_FAMILIES = new Set(["controls and UI bits"]);

/**
 * A rule or layout card ("Everything in a Bento Grid", "Numbers in Tabular Figures", Progress Bars):
 * a constraint, or an element card that is itself a UI part. It never leads a direction, it can only
 * be the second card (Gate 2 round 2: rules as leads read as a rule with no idea).
 */
export function isRuleCard(c: { kind: IngredientCard["kind"]; family: string }): boolean {
  return c.kind === "constraint" || (c.kind === "element" && LAYOUT_FAMILIES.has(c.family));
}

/**
 * R7: card families native to screen design (glyphs, data marks, stamps and badges, UI bits, the
 * digital and internet eras). On a UI page they are the move a designer makes anyway: in run r5a the
 * judge rated 9 of 14 such leads wow 3 or less ("expected", "tame for wildness 5"), against 3 of 16
 * other leads.
 */
export const UI_NATIVE_FAMILIES: ReadonlySet<string> = new Set(["controls and UI bits", "data marks", "glyphs and punctuation", "marks and stamps", "digital and internet"]);
/** R7: main styles that are the screen default (the polished Dribbble look): a lead with one is expected too. */
export const UI_DEFAULT_STYLES: ReadonlySet<string> = new Set(["minimal-mono-light", "dark-luminous", "data-dense-dashboard", "glass-frosted"]);
/** R7: regions whose cards can be the expected move (the screen design canon); cards without a region count as global. */
const CANON_REGIONS: ReadonlySet<string> = new Set(["global", "europe", "north-america"]);
/** R7: lead relevance an expected card loses at wildness 1, and the extra it loses per wildness step. */
export const EXPECTED_BASE = 0.2;
export const EXPECTED_STEP = 0.06;
/** R7: from this wildness an expected lead is never picked to spread the styles (spreadByStyle). */
export const EXPECTED_DEMOTE_FROM = 3;

/**
 * True when a card is the expected move on a screen (UI_NATIVE_FAMILIES or a UI_DEFAULT_STYLES main
 * style). A card from a region outside the screen design canon is never expected: Eastern Arabic
 * Digits carry a place and a culture (rated wow 4 twice in r5a), the plain Numerals do not. Europe and
 * North America are that canon (Swiss Style 1960s is the web default), so their cards are judged by
 * family and style like global ones.
 */
export function isExpectedCard(c: Pick<IngredientCard, "family" | "styles" | "region">): boolean {
  if (c.region && !CANON_REGIONS.has(c.region)) return false;
  return UI_NATIVE_FAMILIES.has(c.family) || UI_DEFAULT_STYLES.has(c.styles?.[0] ?? "");
}

/**
 * Lead relevance an expected card loses: 0.1 at wildness 1 up to 0.42 at wildness 5 (one fit step is
 * 0.33), so a wilder brief needs a clearly better fit before it leads with a glyph, a stamp or the
 * minimal default. Never for a lens card (the user asked for it).
 */
export function expectedPenalty(c: Pick<IngredientCard, "family" | "styles" | "region">, wildness: number): number {
  return isExpectedCard(c) ? EXPECTED_BASE + EXPECTED_STEP * (Math.max(1, Math.min(5, wildness)) - 1) : 0;
}

/**
 * How much less a card counts when the domain's page fit (J4b) did not judge it on this page. Two: a
 * fit 3 card outside the judged top cards ranks with a page 1, so a Gulf bonus alone never lifts an
 * unjudged card over the cards judged for the page (the first round 2 dry run led Dubai listings
 * with unjudged carvings, "suits property").
 */
export const PAGE_UNJUDGED_DROP = 2;

/** Words of a page fit reason and the UI elements they name, in the order they are tried. */
const REASON_ELEMENTS: ReadonlyArray<readonly [RegExp, readonly UiElement[]]> = [
  // Not "stage": "dark stage around highlighted plan" is a theatre stage, not a step (round 3).
  [/\b(step|steps|progress|streak|journey|stops?|legs?)\b/, ["progress", "stepper"]],
  [/\b(done|finished|success|stamp|stamps|stamped|confirmed|completed?)\b/, ["success", "progress"]],
  [/\b(total|totals|fare|fares|bill|sum)\b/, ["total", "price-breakdown"]],
  // An offer or a deal is announced (a banner); a price or a plan is picked (the plan, its button).
  [/\b(offer|offers|deal|deals|discount|discounts|sale)\b/, ["header", "hero"]],
  [/\b(price|prices|plan|plans|tier|tiers|package|packages|bundle|bundles)\b/, ["paywall-plan", "price-breakdown", "total", "cta"]],
  // Picking an amount ("slide jaw to pick data amount") is the plan choice, then the total.
  [/\b(amount|amounts|pick|picks|choose|select|compare)\b/, ["paywall-plan", "total"]],
  [/\b(header|hero|banner|headline|title|masthead|cover|welcome)\b/, ["header", "hero"]],
  [/\b(empty|zero|invites?|first)\b/, ["empty-state"]],
  [/\b(tabs?|sections?|anchors?|nav)\b/, ["section-nav", "nav-tabs", "bottom-nav"]],
  [/\b(button|press|tap)\b/, ["cta"]],
  [/\b(divider|dividers|band|bands)\b/, ["divider"]],
];
/** R4: score an element gains when the page has it (a section on this platform or a wild spot). */
export const ON_PAGE_BONUS = 3;
/** R4: score a flow or structure element gains over a surface one (header strip, dividers, one button). */
export const STRUCTURE_BONUS = 1.5;
/** Score an element gains when the lead card's page reason names it (over the wild spot order). */
export const REASON_ELEMENT_BONUS = 4;

/** The UI elements a page fit reason names, in REASON_ELEMENTS order, without repeats. */
export function reasonElements(reason: string): UiElement[] {
  const text = reason.toLowerCase();
  return [...new Set(REASON_ELEMENTS.filter(([re]) => re.test(text)).flatMap(([, els]) => els))];
}

/**
 * True when a page fit reason names elements and every one is a part a must-keep protects (a total,
 * the main button or the plan cards): the idea would land somewhere it does not belong (Gate 2
 * round 3: "plans as stepped shades" built as a header strip).
 */
export function aimsAtProtected(reason: string, protect: ReadonlySet<MechanicElement>): boolean {
  const named = reasonElements(reason).map((el) => ELEMENT_TO_MECHANIC[el]).filter((m): m is MechanicElement => m !== undefined);
  return named.length > 0 && named.every((m) => forbiddenElement(m, protect));
}

/**
 * The fit a card leads this page with: its J4b page score when the page was judged for the domain,
 * else its domain fit less PAGE_UNJUDGED_DROP. `page` undefined: no page fit for this page, the
 * domain fit as before.
 */
export function leadFit(domainFit: number, page: number | null | undefined): number {
  if (page === undefined) return domainFit;
  return page === null ? Math.max(0, domainFit - PAGE_UNJUDGED_DROP) : page;
}

/**
 * What the brief is about, in its own words, for the J7 topic slot and the recipe guard: the product
 * noun it names ("eSIM"), else the longest domain name it holds ("food delivery", "real estate"), else
 * its words the domain's names share ("kids reading", "banking"), else the subject head. The subject
 * head alone gave "fitness empty", "estate listing" and "services dashboard" (Gate 2 round 2).
 */
export function briefTopic(brief: string, domain: DomainEntry, noun: string | null, fallback: string): string {
  if (noun) return briefCasing(brief, noun);
  const named = domain.names.en.filter((n) => has(brief, n)).sort((a, b) => words(b).length - words(a).length || b.length - a.length)[0];
  if (named) return briefCasing(brief, named);
  const nameWords = new Set(domain.names.en.flatMap(contentWords));
  const shared = [...new Set(contentWords(brief).filter((w) => nameWords.has(w)))];
  return shared.length > 0 ? shared.slice(0, 3).join(" ") : fallback;
}

/** True when the card's avoid list names the other card (its name or family). */
export function clashes(a: IngredientCard, b: IngredientCard): boolean {
  const hit = (x: IngredientCard, y: IngredientCard) => x.avoid.some((av) => has(av, y.name) || has(av, y.family));
  return hit(a, b) || hit(b, a);
}

/**
 * Family, kind and name overlap between two cards, for MMR. A shared name word counts as a shared
 * family (round 3: "Manila File Folder" and "Folder Tabs", "Stickers" and "Sticker Sheet" led two
 * directions of one board with the same idea).
 */
export function similarity(a: { family: string; kind: string; name: string }, b: { family: string; kind: string; name: string }): number {
  const nameA = new Set(contentWords(a.name));
  const sameName = contentWords(b.name).some((w) => nameA.has(w));
  return (a.family === b.family || sameName ? 1 : 0) + (a.kind === b.kind ? 0.4 : 0);
}

/**
 * True when a card from a named region can be the second card on a market brief (round 3b). On a
 * Gulf brief only Gulf and global cards; on a MENA brief Gulf, MENA and global cards. A card from
 * elsewhere passes only when the brief asks for it: the brief names its region ("south asia") or a
 * word of its name ("Ankara"), or the card names the brief's occasion (an Egyptian fanous on a
 * Ramadan brief). A brief with no market takes any region (the brief fit already scores it).
 * Round 3 drew the second card by jitter: a South Asian tiffin carrier reached a Saudi souq sign,
 * an Ankara 1930s texture the Dubai wind towers.
 */
export function secondRegionOk(card: Pick<IngredientCard, "name" | "region" | "idea" | "surprise" | "culturalNotes">, brief: string, market: "gulf" | "mena" | null): boolean {
  if (!market || !card.region || card.region === "global" || card.region === "gulf") return true;
  if (market === "mena" && card.region === "mena") return true;
  if (has(brief, card.region.replace(/-/g, " "))) return true;
  const briefWords = new Set(contentWords(brief));
  if (contentWords(card.name).some((w) => briefWords.has(w))) return true;
  const occasions = occasionsIn(brief);
  return occasions.length > 0 && occasionsIn([card.name, card.idea, card.surprise, card.culturalNotes ?? ""].join(" ")).some((o) => occasions.includes(o));
}

/**
 * The second card for a lead (round 3b): never the lead's family or a card sharing a name word with
 * it (`similarity` of 1 or more), only a region the brief allows (`secondRegionOk`), then cards no
 * earlier direction took first, then cards that share no name word with another lead of the board (`others`:
 * "Sticker Sheet" under one lead while "Stickers" leads the next), then the best `score` (the lead's own brief, page and region
 * relevance), the seeded jitter and the id last, so the same brief gives the same pick.
 */
export function rankSeconds<T extends Pick<IngredientCard, "id" | "name" | "family" | "kind" | "region" | "idea" | "surprise" | "culturalNotes">>(
  lead: Pick<IngredientCard, "name" | "family" | "kind">,
  pool: readonly T[],
  opts: { brief: string; market: "gulf" | "mena" | null; score: (c: T) => number; used: ReadonlySet<string>; seed: string; others?: ReadonlyArray<Pick<IngredientCard, "name">> },
): T[] {
  const otherWords = new Set((opts.others ?? []).flatMap((o) => contentWords(o.name)));
  const repeats = (c: T) => Number(contentWords(c.name).some((w) => otherWords.has(w)));
  return pool
    .filter((c) => similarity(lead, c) < 1 && secondRegionOk(c, opts.brief, opts.market))
    .map((c) => ({ c, s: opts.score(c) }))
    .sort((a, b) => Number(opts.used.has(a.c.id)) - Number(opts.used.has(b.c.id)) || repeats(a.c) - repeats(b.c) || b.s - a.s || jitter(opts.seed, a.c.id) - jitter(opts.seed, b.c.id) || a.c.id.localeCompare(b.c.id))
    .map((x) => x.c);
}

/** A seeded number in [0, 1) per card, so ties break the same way for the same brief. */
const jitter = (key: string, id: string) => (cyrb53(`${key}|${id}`) % 1000) / 1000;

/** Options of the Atlas bend: the lists engine's options plus Atlas learning and the taste profile. */
export type AtlasBendOptions = BendOptions & {
  /** Atlas id weights and recipe stats (lib/atlas/learning.ts). None: no learning. */
  learning?: AtlasLearning | null;
  /** The user's taste profile (P2-02): a tie breaker between cards of equal fit, never more. */
  taste?: TasteTarget | null;
};

/** Words that describe a card for the taste profile: its name, family, kind and style words. */
function cardWords(c: IngredientCard): string[] {
  const voice: TypeVoice = isTypeVoice(c.type.voice) ? c.type.voice : "grotesk";
  return [...new Set([c.family, c.kind, c.name.toLowerCase(), ...words(c.name.toLowerCase()), ...cardStyleWords(c, voice)])];
}

/**
 * The tie breaker of each card in [0, 1): the seeded jitter, or with a taste profile the card's
 * place among the cards of the same fit after `applyTaste` (liked and matching cards first, the
 * jitter order after). It is scaled below one fit step, so taste never beats a better fit.
 */
export function tieBreaks(cards: readonly IngredientCard[], fitOf: (c: IngredientCard) => number, key: string, taste: TasteTarget | null | undefined): Map<string, number> {
  const silent = (taste?.likedCardIds?.length ?? 0) === 0 && (taste?.styleWords?.length ?? 0) === 0;
  if (silent) return new Map(cards.map((c) => [c.id, jitter(key, c.id)]));
  const byJitter = [...cards].sort((a, b) => jitter(key, b.id) - jitter(key, a.id) || a.id.localeCompare(b.id));
  const ordered = applyTaste(byJitter.map((c) => ({ id: c.id, fit: fitOf(c), words: cardWords(c) })), taste);
  const groups = new Map<string, string[]>();
  for (const c of ordered) {
    const g = c.fit.toFixed(2);
    groups.set(g, [...(groups.get(g) ?? []), c.id]);
  }
  const out = new Map<string, number>();
  for (const ids of groups.values()) ids.forEach((id, r) => out.set(id, 1 - (r + 0.5) / ids.length));
  return out;
}

interface CardPick {
  lead: IngredientCard;
  second: IngredientCard | null;
  /** What the second card adds: its texture, its motion, or (a rule or layout card) its rule. */
  adds: "texture" | "motion" | "rule" | null;
}

/** The Atlas elements a direction's mechanic may land on, wild spots first. */
function elementOrder(page: PageAnatomy, protect: ReadonlySet<MechanicElement>): UiElement[] {
  const risky = (el: UiElement) => {
    const m = ELEMENT_TO_MECHANIC[el];
    return m !== undefined && forbiddenElement(m, protect);
  };
  const out: UiElement[] = [];
  for (const el of [...page.wildSpots.map((w) => w.element), ...FALLBACK_ELEMENTS]) {
    if (ELEMENT_TO_MECHANIC[el] && !risky(el) && !out.includes(el)) out.push(el);
  }
  return out;
}

/** A spec sentence: acronyms fixed, first letter up, one closing period. */
function sentence(text: string): string {
  const t = fixCase(text.trim()).replace(/[.\s]+$/, "");
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}.`;
}

const ICONS: Record<IngredientCard["radius"], string> = {
  none: "Square line icons with sharp corners, 2px stroke",
  small: "Line icons with small corner radius, 1.5px stroke",
  soft: "Soft rounded line icons, 1.5px stroke",
  round: "Round filled icons",
};

/** Relative luminance of a hex color, 0 dark to 1 light. */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1]!, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

/** 1 to 3 verified style words from the card (VERIFIED_STYLE_WORDS only). */
function cardStyleWords(card: IngredientCard, voice: TypeVoice): string[] {
  const out: string[] = [];
  const surface = card.palette.find((p) => p.role === "surface");
  if (surface && luminance(surface.hex) < 0.2) out.push("dark mode");
  if (/\bgrain|grainy|paper|print\b/i.test(card.texture)) out.push("grainy");
  if (voice === "serif-editorial" || voice === "serif-classic") out.push("editorial");
  if (voice === "mono" || voice === "condensed") out.push("big typography");
  if (card.density === "airy") out.push("minimal");
  if (card.palette.length <= 2) out.push("monochrome");
  const kept = [...new Set(out)].filter((w) => VERIFIED_STYLE_WORDS.includes(w)).slice(0, 3);
  return kept.length > 0 ? kept : ["minimal"];
}

interface SpecInput {
  pick: CardPick;
  platform: Platform;
  arabic: boolean;
  element: MechanicElement;
  mechanic: Mechanic | null;
  how: string;
  pageLabel: string;
  why: string;
}

/** The visual spec from the lead card (P1-I2 step 6). */
export function cardSpec(input: SpecInput): VisualSpec {
  const { lead, second, adds } = input.pick;
  const profile = PLATFORM_PROFILES[input.platform];
  const voice: TypeVoice = isTypeVoice(lead.type.voice) ? lead.type.voice : "grotesk";
  const role = (r: IngredientCard["palette"][number]["role"]) => lead.palette.find((p) => p.role === r);
  const colors = (["surface", "ink", "accent", "support"] as const)
    .map((r) => role(r))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => `${p.role} ${p.hex.toUpperCase()}`);
  const pairs = lead.shipPairs.slice(0, 2).map(([fg, bg]) => `${fg.toUpperCase()} on ${bg.toUpperCase()}`);
  const motionCard = adds === "motion" && second ? second : lead;
  const textureCard = adds === "texture" && second ? second : lead;
  const part = PART[input.element];
  const grid = profile.gridShort ? ` on ${profile.gridShort}` : "";
  return {
    typography: sentence(
      `${lead.type.latin.display} for display at ${profile.display}, ${lead.type.latin.body} for body at ${profile.body}` +
        (input.arabic ? `; Arabic in ${lead.type.arabic.display} and ${lead.type.arabic.body} at the same sizes, right to left` : ""),
    ),
    typeVoice: voice,
    color: sentence(`Palette from ${lead.name}: ${colors.join(", ")}${pairs.length ? `; ship pairs ${pairs.join(", ")}` : ""}; text at 4.5 to 1 or more`),
    layout: sentence(`${lead.name} carries the ${part}, the ${input.pageLabel} keeps its usual order around it${grid}${adds === "rule" && second ? `; one rule from ${second.name}: ${second.idea.replace(/[.\s]+$/, "")}` : ""}`),
    imagery: sentence(lead.imagery),
    motion: sentence(`${motionCard.motion.verb} in ${motionCard.motion.ms}ms${motionCard !== lead ? ` (from ${motionCard.name})` : ""}; with reduced motion on, ${motionCard.motion.reduced}`),
    texture: sentence(`${textureCard.texture}${textureCard !== lead ? ` (from ${textureCard.name})` : ""}; text sits on solid panels, never on the texture`),
    iconography: sentence(input.platform === "mobile" ? `${ICONS[lead.radius]}, 24pt in the tab bar` : ICONS[lead.radius]),
    // R7: a dense card no longer reads "Dense; ... generous spacing" (the draft judge's most named contradiction).
    density: sentence(`${lead.density.charAt(0).toUpperCase()}${lead.density.slice(1)}; ${(lead.density === "dense" ? profile.density.replace(/generous spacing/i, "tight spacing") : profile.density).replace(/^./, (c) => c.toLowerCase())}`),
    signature: sentence(input.how),
    pattern: sentence(`${lead.name} on the ${part}${input.mechanic ? `: ${input.mechanic.name}` : ""}`),
    steal: [
      `The palette of ${lead.name}: ${lead.palette.map((p) => p.name).join(", ")}`,
      `The surface: ${textureCard.texture}`,
      `The imagery: ${lead.imagery}`,
    ].map(sentence),
    avoid: [...lead.avoid.slice(0, 2), ...profile.avoid.slice(0, 1)].slice(0, 3).map(sentence),
    styleWords: cardStyleWords(lead, voice),
    whyItFits: sentence(input.why),
  };
}

/** True when a UI lane query holds the product noun or the page's noun phrase (P0-16). */
function holdsNoun(query: string, productNoun: string | null, page: PageAnatomy): boolean {
  const nouns = [...(productNoun ? [productNoun] : []), ...page.queryNouns, ...page.names.en];
  return nouns.some((n) => has(query, n));
}

/**
 * Best recipe among the keys in order of specificity: for the first key with a usable recipe, the
 * best judged (precision, then judged), or a Thompson draw when the learning has ratings for one
 * of them (lib/atlas/learning.ts chooseRecipe).
 */
function bestRecipe(
  byKey: ReadonlyMap<string, QueryRecipe[]>,
  keys: readonly QueryRecipe["key"][],
  ok: (r: QueryRecipe) => boolean,
  skip: ReadonlySet<string>,
  learning?: AtlasLearning | null,
  seed = "",
): QueryRecipe | null {
  for (const key of keys) {
    const k = JSON.stringify(normKey(key));
    const list = (byKey.get(k) ?? [])
      .filter((r) => ok(r) && !skip.has(recipeId(r)))
      .sort((a, b) => b.precision - a.precision || b.judged - a.judged || a.query.localeCompare(b.query));
    if (list[0]) return chooseRecipe(list, learning, `${seed}|${k}`);
  }
  return null;
}

/** A recipe key with its fields in one order and no empty fields, for lookups. */
function normKey(key: QueryRecipe["key"]): QueryRecipe["key"] {
  return {
    lane: key.lane,
    ...(key.page ? { page: key.page } : {}),
    ...(key.platform ? { platform: key.platform } : {}),
    ...(key.element ? { element: key.element } : {}),
    ...(key.cardId ? { cardId: key.cardId } : {}),
  };
}

/** The Atlas platform for a server platform ("any" has none). */
const atlasPlatform = (p: Platform): QueryRecipe["key"]["platform"] => (p === "any" ? undefined : p);

/**
 * Directions from the Atlas, or null when it cannot answer (the caller runs the lists engine).
 * Throws BendInputError on invalid input, like bendBrief.
 */
export async function bendBriefAtlas(raw: BendInput, source: AtlasSource, options: AtlasBendOptions = {}): Promise<BendResult | null> {
  const parsed = parseBendInput(raw);
  if (!parsed.ok) throw new BendInputError(parsed.message);
  const input = parsed.input;
  const taste = cleanTaste(raw.taste);
  const wildness = input.wildness;
  const rule = WILDNESS[wildness];
  const platform = resolvePlatform(input.brief, input.platform);
  const profile = PLATFORM_PROFILES[platform];
  const pagesIn = cleanPages(input.pages);
  const subject = extractSubject(input.brief, wildness);
  const lens = input.lens ? getLens(input.lens) : undefined;
  const market = briefMarket(input.brief);
  const arabic = needsArabic(input.brief);
  const key = JSON.stringify([ENGINE_VERSION, input.brief.trim().toLowerCase().replace(/\s+/g, " "), wildness, input.moves ? [...new Set(input.moves)].sort() : null, input.lens ?? null]);
  // R2 styles (docs/styles): the styles the brief or taste names. Asked: cards and mechanics tagged
  // with them lead. None asked: the directions spread over different main styles (rule 5).
  const asked = askedStyles([input.brief, ...taste], briefStyleGenre(input.brief, platform));

  // 1. Brief to page, domain and product noun.
  const [pages, domains] = [await source.pages(), await source.domains()];
  if (!pages || !domains) return null;
  const page = parsePage(pagesIn[0] ?? input.brief, pages) ?? (pagesIn[0] ? parsePage(input.brief, pages) : null);
  const parsedDomain = parseDomain(input.brief, domains, page);
  if (!page || !parsedDomain) return null;
  const { domain } = parsedDomain;
  const productNoun = briefTopic(input.brief, domain, parsedDomain.productNoun, subject.head);
  const pageLabel = pagesIn[0] ?? page.names.en[0] ?? page.id.replace(/-/g, " ");

  // 2. Candidates by fit. A theme domain the brief also names ("Ramadan" on a food delivery page)
  // adds a share of its own fit, and lets in its best cards that still fit the main domain at 1.
  const fit = await source.fit(domain.id);
  if (!fit) return null;
  const theme = parseTheme(input.brief, domains, page);
  const themeFit = theme ? ((await source.fit(theme.id)) ?? []) : [];
  const themeOf = new Map<string, number>(themeFit.map((f) => [f.cardId, f.score]));
  const minFit = wildness >= 4 ? 1 : 2;
  const fitOf = new Map<string, FitScore>(fit.map((f) => [f.cardId, f]));
  // J4b page fit (Gate 2 round 2): how well a card can lead this page of this domain. A failed read
  // or no rows for the page leaves the domain fit in charge (the bend before J4b).
  const pageFitOf = new Map<string, PageFitScore>(((await source.pageFit(domain.id)) ?? []).filter((r) => r.pageId === page.id).map((r) => [r.cardId, r]));
  // Brief words that tell this domain's cards apart: named by fewer than RARE_SHARE of its fit
  // reasons ("reading" on a kids reading brief counts, "kids" does not).
  const reasonWords = new Map<string, Set<string>>(fit.map((f) => [f.cardId, new Set(contentWords(`${f.reason} ${pageFitOf.get(f.cardId)?.reason ?? ""}`))]));
  const briefWords = new Set(
    contentWords(`${input.brief} ${pageLabel}`).filter((w) => [...reasonWords.values()].filter((r) => r.has(w)).length < RARE_SHARE * Math.max(1, fit.length)),
  );
  /** Fit for this brief: the domain fit, plus a share of the theme fit and of rare brief words in the fit reason. */
  const fitScore = (cardId: string): number => {
    const shared = [...(reasonWords.get(cardId) ?? [])].filter((w) => briefWords.has(w)).length;
    return leadFit(fitOf.get(cardId)?.score ?? 0, pageFitOf.size > 0 ? (pageFitOf.get(cardId)?.score ?? null) : undefined) + THEME_SHARE * (themeOf.get(cardId) ?? 0) + Math.min(REASON_MAX, REASON_STEP * shared);
  };
  const candidateIds = fit
    .filter((f) => f.score >= minFit || (f.score >= 1 && themeOf.get(f.cardId) === 3))
    .sort((a, b) => fitScore(b.cardId) - fitScore(a.cardId) || jitter(key, a.cardId) - jitter(key, b.cardId))
    .slice(0, MAX_CANDIDATES)
    .map((f) => f.cardId);
  const cardMap = await source.cards(candidateIds);
  if (!cardMap) return null;
  const allowedMoves = new Set<MoveId>(input.moves ?? ["transplant", "material", "era", "constraint", "scale", "lens"]);
  const protect = protectedElements(input.brief, input.mustKeep ?? []);
  const lensTerms = lens ? [lens.id.replace(/-/g, " "), lens.name.en, ...lens.terms] : [];
  const isLensCard = (c: IngredientCard) => c.kind === "tradition" && (c.id.includes(lens?.id ?? "\u0000") || lensTerms.some((t) => has(c.name, t) || has(t, c.name)));
  // Region rule (P0-07, Gulf-first): on a Gulf or MENA brief a tradition comes from the region,
  // and an era or tradition from another named region (Beirut 1960s, Ankara 1930s, Cairo posters on
  // a Gulf brief) waits for wildness 4.
  const regional = (c: IngredientCard) => Boolean(c.region) && c.region !== "global";
  const regionOk = (c: IngredientCard) => {
    if (!market) return true;
    const narrow = market === "gulf" && wildness < WIDER_REGION_FROM_WILDNESS;
    const home = (r: string | undefined) => (narrow ? r === "gulf" : r === "gulf" || r === "mena");
    if (c.kind === "tradition") return home(c.region);
    if (c.kind === "era" && narrow && regional(c)) return home(c.region);
    return true;
  };
  // Brief-level fit (Gate 2 round 3, lib/atlas/brief-fit.ts): the card against the brief's world
  // (product, audience, region, occasion), not only the page. Drops Gulf cards on other briefs and
  // cards from another Gulf country; moves the rest by fit steps.
  const world = briefWorld(input.brief, market, domain, domains, page);
  const briefDelta = new Map<string, number>();
  const briefOk = (c: IngredientCard) => {
    const v = briefFit(c, [fitOf.get(c.id)?.reason ?? "", pageFitOf.get(c.id)?.reason ?? ""].filter(Boolean), world, { lensAsked: Boolean(lens && isLensCard(c)) });
    if (!v.drop) briefDelta.set(c.id, v.delta);
    return !v.drop;
  };
  const cards = candidateIds
    .map((id) => cardMap.get(id))
    .filter((c): c is IngredientCard => Boolean(c))
    .filter((c) => (lens && isLensCard(c)) || (allowedMoves.has(KIND_MOVE[c.kind]) && regionOk(c)))
    .filter((c) => wildness >= 5 || !domain.clashFamilies.includes(c.family))
    .filter((c) => !brokenMustKeep({ mood: "", [KIND_SLOT[c.kind]]: c.name }, protect))
    .filter(briefOk);
  /** Fit for this brief and page: the page fit, the brief fit, and a step for a domain fit of 3 over 2. */
  const briefScore = (c: IngredientCard) => fitScore(c.id) + (briefDelta.get(c.id) ?? 0) + (pageFitOf.size > 0 ? DOMAIN_STEP * ((fitOf.get(c.id)?.score ?? 2) - 2) : 0);

  // 3. MMR by family and kind; learning weights and Gulf-first scale relevance. The taste
  // profile only reorders cards of equal fit (the tie breaker stays under one fit step).
  const learning = options.learning ?? null;
  const tie = tieBreaks(cards, (c) => fitOf.get(c.id)?.score ?? 0, key, options.taste);
  const relevance = (c: IngredientCard, asLead = true) => {
    const base = briefScore(c) / 3 + 0.3 * (tie.get(c.id) ?? jitter(key, c.id));
    // Gulf-first lifts a lead only where the page fit judged it 2 or more (or no page fit exists):
    // with 88 Gulf cards (Atlas refine round 1) a page 1 tradition otherwise led on its bonus alone
    // (a Hejazi stick dance on a flight checkout). A second card adds a texture or motion, not the
    // page's idea, so it keeps the bonus.
    const pageOk = !asLead || pageFitOf.size === 0 || (pageFitOf.get(c.id)?.score ?? 0) >= 2;
    const gulf = market === "gulf" && c.region === "gulf" && pageOk ? (c.kind === "tradition" ? GULF_BONUS : GULF_CARD_BONUS) : 0;
    const weight = (options.ingredientWeights?.get(directionTermKey(c.name.toLowerCase())) ?? 1) * idWeight(learning, atlasTermKey("card", c.id));
    // R7: a lead that is the expected move on a screen gives way to a wilder card of near fit.
    const expected = asLead && !(lens && isLensCard(c)) ? expectedPenalty(c, wildness) : 0;
    return (base + gulf + styleFit(c.styles, asked) - expected) * weight;
  };
  const mmr = (pool: IngredientCard[], n: number, chosen: IngredientCard[] = []): IngredientCard[] => {
    const left = [...pool];
    const out: IngredientCard[] = [];
    while (out.length < n && left.length > 0) {
      let bestI = 0;
      let bestScore = -Infinity;
      left.forEach((c, i) => {
        const sim = Math.max(0, ...[...chosen, ...out].map((s) => similarity(c, s)));
        const score = relevance(c) - LAMBDA * sim;
        if (score > bestScore + 1e-9) {
          bestScore = score;
          bestI = i;
        }
      });
      out.push(left.splice(bestI, 1)[0]!);
    }
    return out;
  };
  const lensCards = lens ? cards.filter(isLensCard) : [];
  if (lens && lensCards.length === 0) return null;
  // Rule and layout cards never lead (Gate 2 round 2); they stay in the pool for the second card.
  // A card whose page reason aims only at elements a must-keep protects ("plans as stepped shades"
  // with the plan cards protected) gives way to the next card (Gate 2 round 3), unless too few are left.
  const nonLensAll = cards.filter((c) => !lensCards.includes(c) && !isRuleCard(c));
  const free = nonLensAll.filter((c) => !aimsAtProtected(pageFitOf.get(c.id)?.reason ?? "", protect));
  const nonLens = free.length >= Math.max(input.count, MIN_LEADS) ? free : nonLensAll;
  const leadsLens = mmr(lensCards, GENERATED);
  const drawn = [...leadsLens, ...mmr(nonLens, GENERATED - leadsLens.length, leadsLens)].slice(0, GENERATED);
  // No style asked and no lens: the first directions take different main styles (R2).
  // R7: on a wild brief (wildness 3 or more) an expected lead never takes a place for its style alone.
  const demote = (c: IngredientCard) => wildness >= EXPECTED_DEMOTE_FROM && isExpectedCard(c);
  const leads = asked.length === 0 && !lens ? spreadByStyle(drawn, input.count, demote) : drawn;
  if (leads.length < Math.min(input.count, MIN_LEADS)) return null;

  // 4. The second card (texture or motion) and the clash check.
  const usedSecond = new Set<string>();
  const picks: CardPick[] = leads.map((lead, i) => {
    const wantsSecond = wildness >= TWIST_FROM_WILDNESS || (lens && !isLensCard(lead));
    if (!wantsSecond) return { lead, second: null, adds: null };
    const adds: "texture" | "motion" = i % 2 === 0 ? "texture" : "motion";
    const pool = (lens && !isLensCard(lead) ? lensCards : cards).filter((c) => c.id !== lead.id && !leads.includes(c) && !clashes(lead, c));
    const pool2 = pool.length > 0 ? pool : (lens && !isLensCard(lead) ? lensCards : []).filter((c) => c.id !== lead.id);
    // Round 3b: ranked by the lead's own relevance (brief fit, page fit, Gulf-first), never the lead's
    // family, never a region the brief does not allow. A lens card added to a non-lens lead keeps the
    // lens rule (the lens is the ask), so only the family and the ranking apply to it.
    const lensSecond = Boolean(lens && !isLensCard(lead));
    const ranked = rankSeconds(lead, pool2, { brief: input.brief, market: lensSecond ? null : market, score: (c) => relevance(c, false), used: usedSecond, seed: `${key}|second|${i}`, others: leads.slice(0, input.count).filter((l) => l !== lead) });
    const second = ranked[0] ?? null;
    if (second) usedSecond.add(second.id);
    // A rule or layout card as the second card adds its rule, not its texture or motion.
    return { lead, second, adds: second ? (isRuleCard(second) ? "rule" : lens && !isLensCard(lead) ? "texture" : adds) : null };
  });

  // 5. Mechanics: the page's wild spot elements, by the lead card's lines, spread over the bend.
  const lines = await source.lines(leads.map((c) => c.id));
  if (!lines) return null;
  const lineOf = new Map<string, CardElementLine>(lines.map((l) => [`${l.cardId}|${l.element}`, l]));
  const order = elementOrder(page, protect);
  if (order.length === 0) return null;
  const mechanicsByElement = new Map<UiElement, Mechanic[]>();
  const mechanicsFor = async (el: UiElement): Promise<Mechanic[] | null> => {
    if (!mechanicsByElement.has(el)) {
      const list = await source.mechanics(el);
      if (!list) return null;
      mechanicsByElement.set(el, list);
    }
    return mechanicsByElement.get(el)!;
  };
  const elementUse = new Map<MechanicElement, number>();
  const usedMechanics = new Set<string>();
  // R4: page parts earlier directions named, so a board's directions spread over the page.
  const partUse = new Map<UiElement, number>();
  // R4: the mechanic's own part should be one the page has (a section on this platform or a wild
  // spot): r4-0 put a dotted-leader total on an offers page with no total. A flow or structure part
  // comes before a surface one (a header strip, the dividers, one button), the judge's thin idea.
  const onPage = new Set<UiElement>([...platformSections(page, platform).map((s) => s.element), ...page.wildSpots.map((w) => w.element)]);
  const pageHas = (el: UiElement) => onPage.has(el) || [...onPage].some((o) => ELEMENT_TO_MECHANIC[o] !== undefined && ELEMENT_TO_MECHANIC[o] === ELEMENT_TO_MECHANIC[el] && o !== "hero" && el !== "hero");
  const ranked = (lead: IngredientCard) => {
    // The element the lead's page reason names comes first (Gate 2 round 2 run g2g: "each finished
    // step lands as stamp" was built as a divider, "punched holes show step progress" as a header).
    // Round 3: a named element always comes before an unnamed one (the spread over the bend no longer
    // moves "punched holes show step progress" to the header); a protected one is not in `order`, so
    // the next element the reason names takes its place.
    const named = reasonElements(pageFitOf.get(lead.id)?.reason ?? "");
    // R4: a named element counts only when the page has it (r4-0: "total" on an offers page), and
    // among named elements a flow or structure one comes before a surface one ("offer" names the
    // header and the hero: the season banner, not the top bar).
    const namedRank = (el: UiElement) => (named.includes(el) && pageHas(el) ? named.length - named.indexOf(el) + (isStructural(el) ? 1 : 0) : 0);
    return order
      .map((el, idx) => ({
        el,
        // Among named elements, the reason's own order first ("prices per plan": the plan cards).
        named: namedRank(el),
        score:
          (lineOf.get(`${lead.id}|${el}`)?.buildability ?? 2) +
          Math.max(0, 3 - idx) -
          2 * (elementUse.get(ELEMENT_TO_MECHANIC[el]!) ?? 0) +
          (named.includes(el) ? REASON_ELEMENT_BONUS : 0) +
          (pageHas(el) ? ON_PAGE_BONUS : 0) +
          (isStructural(el) ? STRUCTURE_BONUS : 0),
        idx,
      }))
      .sort((a, b) => Number(b.named > 0) - Number(a.named > 0) || b.named - a.named || b.score - a.score || a.idx - b.idx)
      .map((x) => x.el);
  };

  type Built = { pick: CardPick; id: string; element: UiElement; mechanic: Mechanic | null; d: Direction };
  const built: Built[] = [];
  const titles = new Set<string>();
  const whys = new Set<string>();
  const scope = pagesIn.length > 0 ? `Use it only on the ${joinList(pagesIn)}, one or two pages, not the whole product.` : `Use it on the ${pageLabel}, one or two pages, not the whole product.`;

  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i]!;
    const { lead, second } = pick;
    const cardIds = [lead.id, ...(second ? [second.id] : [])];
    const id = stableId(`${key}|${i}|${cardIds.join("+")}`);
    const moves: MoveId[] = [...new Set([KIND_MOVE[lead.kind], ...(second ? [KIND_MOVE[second.kind]] : [])])];
    const ingredients: Ingredients = { mood: lead.family, [KIND_SLOT[lead.kind]]: lead.name };
    if (second && !ingredients[KIND_SLOT[second.kind]]) ingredients[KIND_SLOT[second.kind]] = second.name;
    const idea = words(lead.name.toLowerCase()).slice(0, 5).join(" ");
    const elements = ranked(lead);
    const target: readonly string[] = asked.length > 0 ? asked : (lead.styles ?? []);
    // The page reason (J4b) says what on this page the card serves; the domain reason is the fallback.
    const pageReason = pageFitOf.get(lead.id);
    let why = (pageReason && pageReason.score >= 2 && pageReason.reason) || fitOf.get(lead.id)?.reason || `${lead.idea}`;
    if (whys.has(why)) why = `${lead.name}: ${why}`;

    const draw = async (attempt: number) => {
      const el = elements[attempt % elements.length]!;
      const list = (await mechanicsFor(el)) ?? [];
      // Mechanics ratings weight buildability (W2); with none it is the plain buildability order.
      // R2: a mechanic tagged with the direction's target style (the asked styles, else the lead's own) gains a step.
      const mechScore = (m: Mechanic) => m.buildability * idWeight(learning, atlasTermKey("mechanic", m.id)) + mechanicStyleScore(m.styles, target);
      const mech =
        [...list]
          .filter((m) => !usedMechanics.has(m.id))
          .sort((a, b) => Number(b.pages.includes(page.id)) - Number(a.pages.includes(page.id)) || mechScore(b) - mechScore(a) || a.id.localeCompare(b.id))[0] ?? null;
      const line = lineOf.get(`${lead.id}|${el}`);
      const how = fixCase(line?.how ?? (mech ? `${lead.name}: ${mech.how}` : `${lead.name} as the ${PART[ELEMENT_TO_MECHANIC[el]!]}`));
      const element = ELEMENT_TO_MECHANIC[el]!;
      const spec = cardSpec({ pick, platform, arabic, element, mechanic: mech, how, pageLabel, why });
      const dm: DirectionMechanic = { element, how: sentence(how).replace(/\.$/, "") };
      return { el, mech, spec, dm };
    };
    let drawn = await draw(0);
    const prior = built.map((b) => b.d);
    for (let attempt = 1; attempt < MAX_COHERENCE_TRIES; attempt++) {
      if (checkCoherence({ id, moves, ingredients, searchQuery: idea, mechanic: drawn.dm, spec: drawn.spec }, prior).length === 0) break;
      drawn = await draw(attempt);
    }
    elementUse.set(drawn.dm.element, (elementUse.get(drawn.dm.element) ?? 0) + 1);
    if (drawn.mech) usedMechanics.add(drawn.mech.id);
    whys.add(why);

    // R4: the mechanic acts on the page, not one element: 2 or 3 parts, the main task, the must keeps.
    const span = spanPage({
      brief: input.brief,
      page,
      platform,
      main: { element: drawn.el, mechanic: drawn.dm.element, how: drawn.dm.how },
      lineOf: (el) => lineOf.get(`${lead.id}|${el}`),
      mechanicsOf: (el) => mechanicsByElement.get(el) ?? [],
      named: reasonElements(pageReason?.reason ?? ""),
      forbidden: (el) => {
        const m = ELEMENT_TO_MECHANIC[el];
        return m !== undefined && forbiddenElement(m, protect);
      },
      used: partUse,
      mustKeep: input.mustKeep ?? [],
      protect,
    });
    if (span) {
      for (const p of span.parts.slice(1)) partUse.set(p.element, (partUse.get(p.element) ?? 0) + 1);
      drawn.dm = { ...drawn.dm, parts: span.parts.map(({ element, label, how }) => ({ element, label, how })), task: span.task };
      drawn.spec = { ...drawn.spec, layout: spanLayout(lead.name, pageLabel, span, profile.gridShort ? ` on ${profile.gridShort}` : "") + (pick.adds === "rule" && second ? ` One rule from ${second.name}: ${sentence(second.idea)}` : "") };
    }

    // A long card name is the title on its own ("Layout Mirrors by Language", not "The Layout Mirrors").
    const name = lead.name.replace(/^(the|a|an)\s+/i, "");
    const titleBase = words(name).length >= MAX_TITLE_WORDS ? clipTitle(name) : clipTitle(`${name} ${subject.head}`);
    const title = !titles.has(titleBase.toLowerCase()) && words(titleBase).length <= MAX_TITLE_WORDS ? titleBase : clipTitle(name);
    titles.add(title.toLowerCase());
    const twist = second && (wildness >= TWIST_FROM_WILDNESS || lens)
      ? words(`with the ${pick.adds} of ${second.name}`).slice(0, MAX_TWIST_WORDS).join(" ")
      : "";
    const prompt = fixCase(
      [
        sentence(lead.idea),
        sentence(lead.surprise),
        `Build it this way: ${drawn.dm.how}.`,
        drawn.dm.task ? `Across the page: ${drawn.spec.layout}` : "",
        second ? `${second.name} adds only its ${pick.adds}.` : "",
        lead.culturalNotes ? sentence(lead.culturalNotes) : "",
        platform === "any" ? "Built for any screen." : `Built for a ${profile.label}.`,
        scope,
        rule.hint,
      ]
        .filter(Boolean)
        .join(" "),
    );
    built.push({
      pick,
      id,
      element: drawn.el,
      mechanic: drawn.mech,
      d: {
        id,
        move: moves.join(" + "),
        moves,
        title: fixCase(title),
        twist: fixCase(twist ? `${twist.charAt(0).toUpperCase()}${twist.slice(1)}` : ""),
        searchQuery: idea,
        searchQueries: [],
        prompt,
        ingredients,
        platform,
        pages: [...pagesIn],
        spec: drawn.spec,
        artQueries: [],
        mechanic: drawn.dm,
        cardIds,
        ...(lead.styles && lead.styles.length > 0 ? { cardStyles: [...lead.styles] } : {}),
        ...(drawn.mech ? { mechanicId: drawn.mech.id } : {}),
        recipeIds: [],
        story: fixCase(`${sentence(lead.idea)} ${sentence(lead.surprise)}${second ? ` ${second.name} adds its ${pick.adds}.` : ""}`),
      },
    });
  }

  // 7. Queries from recipes, then the Phase 0 lanes; no query shared between directions.
  const ap = atlasPlatform(platform);
  const keysFor = (b: Built) => {
    const cardId = b.pick.lead.id;
    const el = b.element;
    return {
      concept: [
        { lane: "concept" as const, page: page.id, platform: ap, element: el, cardId },
        { lane: "concept" as const, element: el, cardId },
        { lane: "concept" as const, cardId },
      ],
      component: [
        { lane: "component" as const, page: page.id, platform: ap, element: el },
        { lane: "component" as const, page: page.id, element: el },
        { lane: "component" as const, platform: ap, element: el },
      ],
      art: [{ lane: "art" as const, cardId }],
      baseline: [
        { lane: "baseline" as const, page: page.id, platform: ap },
        { lane: "baseline" as const, page: page.id },
      ],
    };
  };
  const allKeys = built.flatMap((b) => Object.values(keysFor(b)).flat()).map(normKey);
  const uniqueKeys = [...new Map(allKeys.map((k) => [JSON.stringify(k), k])).values()];
  // Missing recipes are not an error: the Phase 0 lanes (P0-17 taste lanes included) take over.
  // J7 page recipes are templates: the slot takes the brief's product noun (lib/atlas/recipe-fit.ts).
  const recipes = fillRecipes((await source.recipes(uniqueKeys)) ?? [], productNoun);
  const byKey = new Map<string, QueryRecipe[]>();
  for (const r of recipes) {
    const k = JSON.stringify(normKey(r.key));
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  // A UI recipe must name the brief's topic, not only the page, and be judged at least as precise as
  // the Phase 0 lane it replaces (lib/atlas/recipe-fit.ts).
  const topicOk = recipeHoldsTopic({ productNoun, topic: subject.head, pageId: page.id });
  const uiOk = (r: QueryRecipe) => holdsNoun(r.query, productNoun, page) && topicOk(r.query) && words(r.query).length <= MAX_RECIPE_WORDS;
  const laneOk = (lane: keyof typeof PHASE0_PRECISION) => (r: QueryRecipe) => uiOk(r) && beatsPhase0(r, lane);
  const artOk = (r: QueryRecipe) => !UI_WORDS.test(r.query);
  const usedQueries = new Set<string>();
  const usedRecipes = new Set<string>();
  const baseline = bestRecipe(byKey, keysFor(built[0]!).baseline, laneOk("fidelity"), new Set(), learning, key);

  for (const b of built) {
    const keys = keysFor(b);
    const recipeIds: string[] = [];
    const own: string[] = [];
    for (const lane of ["concept", "component"] as const) {
      const r = bestRecipe(byKey, keys[lane], laneOk(lane === "concept" ? "bridge" : "component"), usedRecipes, learning, `${key}|${b.id}`);
      if (!r) continue;
      usedRecipes.add(recipeId(r));
      recipeIds.push(recipeId(r));
      own.push(r.query);
    }
    const p0 = phase0Queries({
      brief: input.brief,
      idea: b.d.searchQuery,
      taste,
      id: b.id,
      platform,
      styleWords: b.d.spec.styleWords,
      pages: pagesIn,
      element: b.d.mechanic.element,
      rule: b.pick.lead.kind === "constraint",
    });
    b.d.searchQueries = takeQueries({ own: [...own, ...p0.own], shared: p0.shared }, usedQueries);
    const artScore = (r: QueryRecipe) => r.precision * idWeight(learning, atlasTermKey("recipe", recipeId(r)));
    const art = keys.art.flatMap((k) => (byKey.get(JSON.stringify(normKey(k))) ?? []).filter(artOk)).sort((x, y) => artScore(y) - artScore(x)).slice(0, 2);
    for (const r of art) recipeIds.push(recipeId(r));
    const artQueries: string[] = [];
    for (const q of [...art.map((r) => r.query), ...b.pick.lead.artQueries, ...(b.pick.second?.artQueries ?? [])]) {
      const t = words(q).slice(0, 6).join(" ");
      if (!t || UI_WORDS.test(t) || artQueries.some((o) => o.toLowerCase() === t.toLowerCase())) continue;
      artQueries.push(t);
      if (artQueries.length >= 3) break;
    }
    b.d.artQueries = artQueries.length > 0 ? artQueries : [b.d.searchQuery];
    if (baseline) recipeIds.push(recipeId(baseline));
    b.d.recipeIds = [...new Set(recipeIds)];
  }

  // 8. The stunning layer (J13, VAL-14): up to 1 shader and 2 motion recipes per direction, by the
  // cards' families and the lens. Ids only; a missing layer or a failed read changes nothing.
  let shaders: ShaderRecipe[] = [];
  let motion: MotionRecipe[] = [];
  try {
    shaders = (await source.shaders()) ?? [];
    motion = (await source.motion()) ?? [];
  } catch {
    shaders = [];
    motion = [];
  }
  if (shaders.length > 0 || motion.length > 0) {
    const usedShaders = new Set<string>();
    const usedMotion = new Set<string>();
    for (const b of built) {
      const cardsOf = [b.pick.lead, ...(b.pick.second ? [b.pick.second] : [])];
      const target = asked.length > 0 ? asked : (b.pick.lead.styles ?? []);
      const s = pickStunning(shaders, cardsOf, lens?.id, b.element, MAX_SHADERS, usedShaders, `${key}|shader|${b.id}`, target).map((r) => r.id);
      const m = pickStunning(motion, cardsOf, lens?.id, b.element, MAX_MOTION, usedMotion, `${key}|motion|${b.id}`, target).map((r) => r.id);
      if (s.length > 0) b.d.shaderIds = s;
      if (m.length > 0) b.d.motionIds = m;
    }
  }

  return applyBrand({
    brief: input.brief,
    subject: fixCase(subject.title),
    wildness,
    wildnessLabel: rule.label,
    lens: lens ? { id: lens.id, name: lens.name, arabicFont: lens.arabicFont, culture: lensCulture(lens) } : null,
    suggestedLenses: lens ? [] : suggestLenses(input.brief),
    platform,
    pages: pagesIn,
    wildSpots: pagesIn.length > 0 ? [] : wildSpotsFor(platform),
    directions: built.map((b) => b.d).slice(0, input.count),
    atlas: { pageId: page.id, domainId: domain.id, productNoun, ...searchHints({ brief: input.brief, domain, theme, page, topic: productNoun, phase0Topic: phase0Topic(input.brief, platform) }) },
  }, input.brand);
}
