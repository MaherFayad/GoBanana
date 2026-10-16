/**
 * Brief-level fit (Gate 2 round 3, bench/GATE2-DIAGNOSIS.md). J4b scores a card against the page
 * within a domain, so a card that does the page's job scores 3 even when nothing ties it to the
 * brief's world: Swiss columns on SaaS pricing, an ice cream truck menu on Saudi Ramadan offers,
 * Najdi mud walls on Dubai apartments. This scores each candidate card against the brief itself
 * (product, audience, region, occasion) from text the Atlas already has: the card's own words, its
 * region, and its J4 and J4b reasons. Pure and deterministic, no AI.
 *
 *   - Gulf places: cities and countries map to a Gulf country and, for Saudi Arabia, a region. A Gulf
 *     card only goes on a Gulf brief, and a card that names a country goes only on a brief from that
 *     country (or one that names no country), unless a lens asks for it.
 *   - A card from another named region (Europe, North America) costs a fit step on a Gulf or MENA
 *     brief; an era or tradition from a named region whose fit reason is only a style ("visible grid
 *     suits dashboards") costs a fit step on a brief with no market.
 *   - Occasions: a card that names the brief's occasion (Ramadan) gains, one that names another
 *     occasion loses; drink, pork and gambling cards never go on a Gulf, occasion or kids brief.
 *   - Audience: kids cards gain on a kids brief and lose on a business brief.
 *   - Telling words: brief and domain words (product nouns, names) the card's own text names gain.
 *   - A J4 or J4b reason that names a Gulf place the brief does not ("Najdi mass suits Saudi
 *     services" on a Qatar brief) loses.
 */
import type { Market } from "@/lib/bend/market";
import type { DomainEntry, IngredientCard, PageAnatomy } from "./types";

export type GulfCountry = "sa" | "ae" | "qa" | "kw" | "bh" | "om";
/** A Gulf place: the country and, inside Saudi Arabia, the region. */
export type Place = { country: GulfCountry; area?: "najd" | "hejaz" | "asir" | "eastern" | "north" };

/** Words that name a Gulf place, longest first where they overlap ("abu dhabi" before "dhabi"). */
const PLACE_WORDS: ReadonlyArray<readonly [RegExp, Place]> = [
  [/\b(riyadh|najd|najdi|diriyah|qassim|sudair|unaizah|buraidah)\b/i, { country: "sa", area: "najd" }],
  [/\b(jeddah|jiddah|hejaz|hijaz|hejazi|hijazi|makkah|mecca|madinah|medina|taif|yanbu|al balad|rawashin)\b/i, { country: "sa", area: "hejaz" }],
  [/\b(asir|aseer|asiri|abha|rijal almaa|qatt)\b/i, { country: "sa", area: "asir" }],
  [/\b(dammam|khobar|dhahran|al ahsa|hofuf|qatif)\b/i, { country: "sa", area: "eastern" }],
  [/\b(alula|al ula|tabuk|neom|hail)\b/i, { country: "sa", area: "north" }],
  [/\b(saudi|ksa|saudi arabia)\b/i, { country: "sa" }],
  [/\b(uae|emirati|emirates|dubai|abu dhabi|sharjah|ajman|fujairah|ras al khaimah|umm al quwain|al ain|al fahidi)\b/i, { country: "ae" }],
  [/\b(qatar|qatari|doha)\b/i, { country: "qa" }],
  [/\b(kuwait|kuwaiti)\b/i, { country: "kw" }],
  [/\b(bahrain|bahraini|manama|muharraq)\b/i, { country: "bh" }],
  [/\b(oman|omani|muscat|salalah|dhofar|nizwa)\b/i, { country: "om" }],
];

/** Words that name the Gulf as a whole: a card that says them is pan-Gulf even when it names a city. */
const WHOLE_GULF = /\b(gulf|gcc|khaleeji|arabian peninsula|across arabia)\b/i;

const samePlace = (a: Place, b: Place) => a.country === b.country && a.area === b.area;

/** The Gulf places a text names, without repeats. */
export function placesIn(text: string): Place[] {
  const out: Place[] = [];
  for (const [re, place] of PLACE_WORDS) if (re.test(text) && !out.some((p) => samePlace(p, place))) out.push(place);
  // "Saudi" with a Saudi region named is that region only.
  return out.filter((p) => p.area || !out.some((o) => o.country === p.country && o.area));
}

/**
 * The Gulf places a card belongs to, or [] for a pan-Gulf or non-Gulf card. Its name decides first
 * ("Najdi Painted Doors", "Emirati Talli Braiding"); else its text, unless the text names the Gulf as
 * a whole ("coastal towns such as Jeddah and Muharraq ... the Hejaz and Gulf shores" is pan-Gulf).
 */
export function cardPlaces(card: Pick<IngredientCard, "name" | "idea" | "surprise" | "culturalNotes">): Place[] {
  const byName = placesIn(card.name);
  if (byName.length > 0) return byName;
  const text = [card.idea, card.surprise, card.culturalNotes ?? ""].join(" ");
  return WHOLE_GULF.test(`${card.name} ${text}`) ? [] : placesIn(text);
}

/** Occasions a brief or a card can name, with the words that name each. */
const OCCASIONS: ReadonlyArray<readonly [string, RegExp]> = [
  ["ramadan", /\b(ramadan|ramadhan|iftar|suhoor|sohour|fanoos|fanous)\b/i],
  ["eid", /\b(eid|eidiya|eidi)\b/i],
  ["hajj", /\b(hajj|umrah)\b/i],
  ["national-day", /\bnational day\b/i],
  ["wedding", /\b(wedding|weddings|bridal)\b/i],
  ["christmas", /\b(christmas|xmas|santa)\b/i],
  ["halloween", /\b(halloween)\b/i],
  ["valentine", /\b(valentine|valentines)\b/i],
  ["lunar-new-year", /\b(lunar new year|chinese new year)\b/i],
  ["diwali", /\b(diwali|deepavali)\b/i],
  ["thanksgiving", /\b(thanksgiving)\b/i],
  ["easter", /\b(easter)\b/i],
  ["black-friday", /\b(black friday|cyber monday)\b/i],
];
/** Occasions that sit together: an Eid card fits a Ramadan brief (Eid ends Ramadan), and back. */
const NEAR_OCCASIONS: Readonly<Record<string, readonly string[]>> = { ramadan: ["eid"], eid: ["ramadan"] };

/** The occasions a text names. */
export function occasionsIn(text: string): string[] {
  return OCCASIONS.filter(([, re]) => re.test(text)).map(([id]) => id);
}

/** Cards about drink, pork or gambling: never on a Gulf, occasion or kids brief. */
const UNFIT = /\b(beer|beers|wine|wines|whisky|whiskey|cocktail|cocktails|pub|pubs|brewery|liquor|vodka|pork|bacon|casino|casinos|gambling|poker|cigarette|cigarettes|cigar|tobacco)\b/i;
/** Words that say a card is about children. */
const KIDS = /\b(kid|kids|children|child|childhood|toddler|toddlers|toy|toys|nursery|playroom|preschool)\b/i;
/** Briefs for business or official use, where a children's card is off brief. */
const SERIOUS = /\b(b2b|saas|enterprise|bank|banking|government|gov|ministry|legal|insurance|invoice|payroll|crm|erp|analytics)\b/i;

/** Fit words a reason uses when it names only a style ("visible grid", "civic modernism", "clean"). */
const STYLE_ONLY = /\b(grid|grids|modernism|modernist|clean|clear|calm|order|ordered|minimal|geometric|structure|structured|rational|systematic|crisp)\b/i;

/** Words too common, or part of every cultural note, to tie a card to a brief. */
const TIE_STOP = new Set([
  "and", "for", "the", "with", "from", "into", "that", "this", "your", "our", "its", "their", "view", "new", "make", "made",
  "meaning", "steal", "credit", "care", "open", "tier", "use", "used", "user", "users", "people", "screen", "page", "app", "apps",
  "about", "then", "such", "much", "still", "should", "between", "full", "front", "second", "other", "every", "each", "one", "two",
  "set", "sets", "line", "lines", "card", "cards", "box", "white", "flat", "level", "notes", "date", "dates", "order", "orders",
  "detail", "details", "action", "actions", "fast", "clear", "price", "prices", "plan", "plans", "home", "time", "day", "days",
  "big", "button", "buttons", "list", "fee", "fees", "number", "numbers", "top", "add", "pay", "renew",
]);

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** A rough stem, so "banking" and "banks" meet "bank". */
export const stem = (w: string) => (w.length > 5 && w.endsWith("ing") ? w.slice(0, -3) : w.length > 4 && w.endsWith("es") && !w.endsWith("ses") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const wordsOf = (text: string) => norm(text).split(/\s+/).filter((w) => w.length >= 3);

/** Everything the bend knows about the brief's world. */
export interface BriefWorld {
  market: Market | null;
  /** Gulf places the brief names (cities and countries); [] for a Gulf-wide or non-Gulf brief. */
  places: Place[];
  occasions: string[];
  kids: boolean;
  serious: boolean;
  /** Telling stems of the brief and its domain: brief words and one-word domain names and nouns that name few domains, page words left out. */
  tie: Set<string>;
  /** Telling phrases of the domain: its multi-word names and product nouns ("cold brew", "food delivery"), matched whole. */
  tiePhrases: string[];
}

/** Most domains a domain word may name and still tie a card to the brief ("coffee" yes, "order" no). */
const TIE_SPREAD = 3;

/**
 * The brief's world: its market, Gulf places, occasions, audience, and the telling words of the brief
 * and its domain. `domains` is every domain (for how many domains a word names); `page` gives the
 * page words left out (they are the page fit's job).
 */
export function briefWorld(brief: string, market: Market | null, domain: DomainEntry, domains: readonly DomainEntry[], page: PageAnatomy | null): BriefWorld {
  const vocab = (d: DomainEntry) => new Set([...d.names.en, ...d.productNouns].flatMap(wordsOf).map(stem));
  const spread = new Map<string, number>();
  for (const d of domains) for (const w of vocab(d)) spread.set(w, (spread.get(w) ?? 0) + 1);
  const pageWords = new Set(page ? [...page.names.en, ...page.queryNouns, page.id.replace(/-/g, " ")].flatMap(wordsOf).map(stem) : []);
  const telling = (w: string) => (spread.get(w) ?? 0) <= TIE_SPREAD && !pageWords.has(w) && !TIE_STOP.has(w);
  // Single words: the brief's own, and one-word domain names and nouns ("eSIM", "coffee", "barista").
  // A word of a multi-word noun alone ties nothing ("cold" of "cold brew", "single" of "single origin").
  const oneWord = [...domain.names.en, ...domain.productNouns].filter((n) => wordsOf(n).length === 1).flatMap(wordsOf);
  const tie = new Set([...wordsOf(brief), ...oneWord].map(stem).filter(telling));
  const tiePhrases = [...domain.names.en, ...domain.productNouns]
    .map(norm)
    .filter((n) => n.split(" ").length > 1 && n.split(" ").map(stem).some((w) => telling(w)));
  return {
    market,
    places: placesIn(brief),
    occasions: occasionsIn(brief),
    kids: KIDS.test(brief) || /\bkids?\b|\bchildren\b/i.test(domain.names.en.join(" ")),
    serious: SERIOUS.test(brief),
    tie,
    tiePhrases,
  };
}

/** Fit a card gains per telling word its own text names, and the most it gains that way. */
export const TIE_STEP = 0.25;
export const TIE_MAX = 0.5;
/** Fit a card gains when it names the brief's occasion. */
export const OCCASION_BONUS = 0.75;
/** Fit a card loses: one page fit step. */
export const OFF_BRIEF = 1;
/** Fit a card loses when a reason names a Gulf place the brief does not, or a same-country region. */
export const PLACE_DROP = 0.5;
/** Fit a card from a named region loses on a brief with no market when nothing ties it to the brief. */
export const REGIONAL_UNTIED = 0.75;
/**
 * Fit a regional era or tradition loses on a brief with no market when its J4 reason names only a
 * style ("visible grid suits dashboards", "civic modernism suits banks"): more than a page step, so
 * the seeded tie breaker (up to 0.9 of a step) cannot lift it back (Swiss columns on SaaS pricing
 * and Ankara 1930s on banking were rated 3 in every round 2 run).
 */
export const STYLE_ONLY_DROP = 1.5;

export type BriefFit = { drop: boolean; delta: number; why: string[] };

/** The card's own words, never its fit reasons (they always name the domain). */
function cardText(card: IngredientCard): string {
  return [card.name, card.idea, card.surprise, card.culturalNotes ?? "", card.imagery, ...card.artQueries].join(" ");
}

/**
 * How a card fits the brief's world: dropped, or a change to its fit (in page fit steps). `reasons`
 * are its J4 and J4b reasons for this domain and page. `lensAsked`: a lens the user passed, whose
 * cards are never dropped for their place.
 */
export function briefFit(card: IngredientCard, reasons: readonly string[], world: BriefWorld, opts: { lensAsked?: boolean } = {}): BriefFit {
  const why: string[] = [];
  let delta = 0;
  const text = cardText(card);
  const reasonText = reasons.join(" ");
  const gulfCard = card.region === "gulf";
  const own = cardPlaces(card);

  // Gulf cards only on Gulf briefs; a card from one Gulf country only on that country's briefs.
  if (!opts.lensAsked) {
    if ((gulfCard || own.length > 0) && world.market !== "gulf") return { drop: true, delta: 0, why: ["a Gulf card on a brief with no Gulf market"] };
    if (own.length > 0 && world.places.length > 0) {
      const countries = new Set(world.places.map((p) => p.country));
      if (!own.some((p) => countries.has(p.country))) return { drop: true, delta: 0, why: ["a card from another Gulf country"] };
      const areas = world.places.filter((p) => p.area);
      if (areas.length > 0 && !own.some((p) => areas.some((a) => a.country === p.country && a.area === p.area))) {
        delta -= PLACE_DROP;
        why.push("another region of the same country");
      }
    }
  }
  // A reason that names a Gulf place the brief does not ("Najdi mass suits Saudi services" on Qatar).
  const reasonPlaces = placesIn(reasonText);
  if (reasonPlaces.length > 0) {
    const countries = new Set(world.places.map((p) => p.country));
    const off = world.market !== "gulf" || (countries.size > 0 && !reasonPlaces.some((p) => countries.has(p.country)));
    if (off) {
      delta -= PLACE_DROP;
      why.push("its fit reason names another place");
    }
  }

  // Unfit for the audience or the occasion: drink, pork, gambling and tobacco.
  if (UNFIT.test(text) && (world.market === "gulf" || world.market === "mena" || world.occasions.length > 0 || world.kids)) {
    return { drop: true, delta: 0, why: ["drink, pork, gambling or tobacco on this brief"] };
  }

  // Another named region: on a market brief always, on a brief with no market for a style-only era or tradition.
  const named = card.region && card.region !== "global" && card.region !== "gulf" && card.region !== "mena";
  if (named && world.market) {
    delta -= OFF_BRIEF;
    why.push(`a ${card.region} card on a ${world.market} brief`);
  } else if (card.region === "mena" && world.market === "gulf" && (card.kind === "era" || card.kind === "tradition") && !occasionsIn(text).some((o) => world.occasions.includes(o))) {
    // Turkey, the Levant or North Africa on a Gulf brief: the region, not the brief's own place.
    delta -= OFF_BRIEF / 2;
    why.push("a wider region card on a Gulf brief");
  } else if (card.region && card.region !== "global" && !world.market && (card.kind === "era" || card.kind === "tradition") && reasons[0] !== undefined && STYLE_ONLY.test(reasons[0])) {
    delta -= STYLE_ONLY_DROP;
    why.push("a regional style whose fit reason names only a style");
  }

  // Occasions: the brief's own gains, another one loses.
  const cardOcc = occasionsIn(text);
  if (world.occasions.length > 0 && cardOcc.length > 0) {
    const near = new Set(world.occasions.flatMap((o) => [o, ...(NEAR_OCCASIONS[o] ?? [])]));
    if (cardOcc.some((o) => near.has(o))) {
      delta += OCCASION_BONUS;
      why.push(`names the occasion (${cardOcc.join(", ")})`);
    } else {
      delta -= OFF_BRIEF;
      why.push(`names another occasion (${cardOcc.join(", ")})`);
    }
  } else if (world.occasions.length === 0 && cardOcc.some((o) => !["wedding", "eid"].includes(o) || world.market !== "gulf")) {
    // A seasonal card (Christmas, Ramadan) on a brief with no occasion.
    delta -= OFF_BRIEF / 2;
    why.push("names an occasion the brief does not");
  }

  // Audience.
  const kidsCard = KIDS.test(text);
  if (world.kids && kidsCard) {
    delta += TIE_STEP;
    why.push("a kids card on a kids brief");
  } else if (!world.kids && world.serious && kidsCard) {
    delta -= OFF_BRIEF / 2;
    why.push("a kids card on a business brief");
  }

  // Telling words of the brief and its domain the card's own text names.
  const own2 = new Set(wordsOf(text).map(stem));
  const flat = ` ${norm(text)} `;
  const ties = [...[...world.tie].filter((w) => own2.has(w)), ...world.tiePhrases.filter((p) => flat.includes(` ${p} `))];
  const styleOnly = why.some((w) => w.startsWith("a regional style"));
  if (ties.length > 0 && !styleOnly) {
    delta += Math.min(TIE_MAX, TIE_STEP * ties.length);
    why.push(`names ${ties.slice(0, 3).join(", ")}`);
  } else if (ties.length === 0 && !world.market && card.region && card.region !== "global" && card.region !== "gulf" && !styleOnly) {
    // A card from a named region on a brief with no market, with nothing tying it to the brief:
    // Iznik tiles or Scandinavian rooms on a coffee shop (rated 2 and 3 in g2a and g2d).
    delta -= REGIONAL_UNTIED;
    why.push(`a ${card.region} card with no tie to a brief with no market`);
  }
  return { drop: false, delta, why };
}
