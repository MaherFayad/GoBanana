/**
 * Lane words for a direction search (pure, deterministic). Search returns UI images only (owner
 * decision, DECISIONS.md 2026-10-11; docs/search-quality-experiment.md rounds 11a and 11b), so
 * every lane is a UI form. The grammar was verified on 386 live queries ("The grammar") and the
 * UI-only audit (about 460 results):
 *
 * - idea: the direction's lead ingredient, raw ("Sadu weaving", "crushed velvet"). It is never
 *   searched raw; it feeds the bridge lane only.
 * - fidelity: "{domain} {page} {surface}" ("flight checkout app ui"): real product UI for the page the
 *   brief names. "{domain} {surface}" ("flight app ui") pulled tracking, search and seat screens
 *   for a checkout brief (field report, 2026-10-12).
 * - taste: "{style} {domain} {component} ui design" ("big typography flight checkout ui design").
 *   Without the domain this lane went off topic (1 of 24 on topic); with it, 20 of 21. Mobile and
 *   web app briefs use the taste bar wordings instead (P0-17, round 13): mobile "dark {phrase} ui
 *   ios app" on Pinterest ("dark paywall subscription ui ios app"), web app "dark mode minimal
 *   {domain} {page} ui" on Dribbble. The user's style words replace "dark".
 * - light twin (mobile): "{phrase} ui ios app" on Pinterest, in the baseline lane in place of the
 *   Pinterest fidelity page.
 * - component: "{core} {page} {component} {surface}" ("flight checkout fare summary app ui",
 *   "banking quick actions app ui"), up to 2, from the pages given to bend_brief and the components
 *   the brief names.
 * - bridge: "{ingredient} ui design" (UI briefs): the idea already applied to UI. Kept only when
 *   the result title names the idea (round 10: 11 of 39 good results did; lib/sources/plan.ts).
 * - locale: "arabic {core} {surface}" when the brief is Arabic or right to left and names a subject.
 *
 * A brief that names no UI and no genre ("a meditation timer") still gets UI forms: fidelity
 * "{subject} app ui", taste "{style} {subject} ui design". A brief that names no device or web
 * surface but names a deck or a brand ("a poster for a jazz festival", "pitch deck for a fintech
 * startup") gets its genre lane instead (lib/sources/genre.ts, 2026-10-16).
 *
 * Site operators and negatives are added by lib/sources/plan.ts; these are the plain words.
 */
import type { Platform } from "@/lib/direction-detail";
import { detectPlatform } from "@/lib/platform";
import { detectGenre, genreRequests, genreSubject, type Genre } from "@/lib/sources/genre";
import { bridgeHead, MAX_COMPONENT_LANES, type LaneTexts } from "@/lib/sources/plan";
import { pickGalleries } from "@/lib/sources/registry";
import { showcaseLane } from "@/lib/sources/showcase";
import { DEFAULT_TASTE } from "@/lib/taste";
import { LAYOUT_WORDS, LENSES, LISTS, STOP_WORDS, USABILITY_WORDS, lensEntries } from "./lists";
import { MOVE_DEFS } from "./moves";
import { cyrb53 } from "./prng";
import { extractSubject, isProductWord } from "./subject";
import { MOVES, type ListEntry, type MoveId } from "./types";

/** Hard cap on any lane query, in words (before negatives and the site operator). */
export const MAX_FOCUSED_QUERY_WORDS = 7;
/** The direction's idea is a raw ingredient: at most 5 words. */
export const MAX_LANE_WORDS = 5;

const words = (s: string) => s.split(/\s+/).filter(Boolean);

/** The raw ingredient (the direction's idea) for one move ("Sadu weaving", "oversized numerals"). */
export function inspirationQuery(move: MoveId, entryQuery: string): string {
  const def = MOVE_DEFS[move];
  return words(def.prefix ? `${def.prefix} ${entryQuery}` : entryQuery)
    .slice(0, MAX_LANE_WORDS)
    .join(" ");
}

type IndexedEntry = { move: MoveId; query: string; needle: string };

let entryIndex: IndexedEntry[] | undefined;

/** Every list entry and lens term, with the move it belongs to. Built once. */
function allEntries(): IndexedEntry[] {
  if (entryIndex) return entryIndex;
  const seen = new Set<string>();
  const out: IndexedEntry[] = [];
  const add = (move: MoveId, entries: readonly ListEntry[]) => {
    for (const e of entries) {
      // The needle carries the move's prefix ("oversized emoji"), as stacked queries did, so the
      // same words in two lists ("emoji") still map back to the right move.
      const needle = ` ${words(`${MOVE_DEFS[move].prefix} ${e.query}`.toLowerCase()).join(" ")} `;
      if (seen.has(needle)) continue;
      seen.add(needle);
      out.push({ move, query: e.query, needle });
    }
  };
  for (const move of MOVES) add(move, LISTS[MOVE_DEFS[move].list]);
  for (const lens of LENSES) add("lens", lensEntries(lens));
  entryIndex = out;
  return out;
}

/**
 * The idea of a saved direction, from its stored search text. Older directions
 * stored a stacked query ("crushed velvet texture ui design garment care label packaging"): the
 * ingredient that comes first is the direction's lead idea, so it becomes "crushed velvet".
 * New directions already store the raw ingredient, and this returns it unchanged.
 * Text with no known ingredient comes back trimmed but otherwise as is.
 */
export function inspirationFromQuery(text: string): string {
  const hay = ` ${words(text.toLowerCase()).join(" ")} `;
  let best: { at: number; entry: IndexedEntry } | null = null;
  for (const entry of allEntries()) {
    const at = hay.indexOf(entry.needle);
    if (at < 0) continue;
    if (!best || at < best.at || (at === best.at && entry.needle.length > best.entry.needle.length)) best = { at, entry };
  }
  return best ? inspirationQuery(best.entry.move, best.entry.query) : words(text).join(" ");
}

// ---------------------------------------------------------------------------
// Reading the brief

/** Words that mark a brief as a screen or product UI. */
const UI_BRIEF_WORDS = new Set([
  "screen", "screens", "app", "apps", "checkout", "dashboard", "dashboards", "onboarding", "page", "pages",
  "flow", "flows", "website", "websites", "ui", "ux", "mobile", "landing", "interface", "portal", "web",
  "homepage", "booking", "cart", "player", "tracker", "login", "signup", "ticketing", "widget", "widgets",
]);

/**
 * Component nouns verified on Dribbble shots and Pinterest pins (round 4), longest first so
 * "pricing page" wins over "page". The brief's first match becomes the taste lane's component.
 */
const COMPONENTS = [
  "order tracking", "product detail", "music player", "empty state", "bottom sheet", "tab bar", "landing page",
  "pricing page", "hero section", "saas dashboard", "analytics dashboard", "data table", "admin panel", "404 page",
  "sign up page", "kanban board", "onboarding", "login", "paywall", "settings", "profile", "checkout", "payment", "chat",
  "notification", "search", "calendar", "widget", "map", "stats", "wallet", "booking", "feed", "camera", "timer",
  "footer", "dashboard", "card",
];

/**
 * Components for the component lanes: COMPONENTS plus parts that real product briefs name (round
 * 11a: "{core} {component} ui" on Dribbble shots was UI by eye on 8 briefs). Matched as whole
 * phrases, singular or plural.
 */
const LANE_COMPONENTS = [
  ...COMPONENTS,
  "quick actions", "recent transactions", "transactions", "balance", "seat selection", "seat map", "boarding pass",
  "flight search", "fare calendar", "itinerary", "property listing", "property detail", "search filters", "filters",
  "cart", "order history", "menu", "product card", "portfolio", "swap", "price chart", "order book", "watchlist",
  "fleet map", "route map", "live tracking", "delivery tracking", "shipment tracking", "data table", "kpi cards",
  "chart", "leaderboard", "progress", "workout", "meal plan", "habit tracker", "sleep tracker", "streak",
  "playlist", "now playing", "send money", "transfer", "payment method", "receipt", "budget", "goals",
  "sidebar", "navigation", "date picker", "pricing table", "testimonials", "feature section", "gallery",
  "inbox", "messages", "reviews", "virtual tour", "floor plan", "mortgage calculator", "course", "quiz",
  "fare summary", "price breakdown", "order summary", "payment bottom sheet", "passenger details", "promo code",
  "trip summary", "baggage", "payment methods",
].filter((c, i, all) => all.indexOf(c) === i);

/** Components that only repeat the surface: never a component lane of their own. */
const SURFACE_COMPONENTS = new Set(["dashboard", "saas dashboard", "analytics dashboard", "landing page", "card", "widget"]);

/** Screen nouns: never part of the domain ("flight checkout" names the flight domain). */
const SCREEN_NOUNS = new Set([
  "checkout", "booking", "onboarding", "dashboard", "login", "signup", "registration", "profile", "cart", "search",
  "settings", "payment", "payments", "wallet", "tracker", "tracking", "player", "calendar", "inbox", "chat", "feed",
  "ticketing", "ordering", "menu", "paywall", "notification", "notifications", "widget", "widgets", "card", "cards",
  "map", "stats", "camera", "timer", "footer", "pricing", "picker", "pickers", "selector", "chooser", "list", "lists",
  "form", "forms", "table", "item", "items",
]);

/**
 * Words that are never a topic alone (P0-16): the live eSIM test searched galleries for "picker"
 * and got calendar date pickers, task apps and a warehouse "picking" app.
 */
export const TOPIC_STOP: ReadonlySet<string> = new Set([
  "picker", "selector", "chooser", "list", "card", "cards", "form", "screen", "screens", "page", "view", "app", "ui",
  "flow", "menu", "table", "item", "items", "home", "widget", "sheet", "modal", "design", "interface",
]);

/** Words too vague to name a domain. */
const GENERIC_WORDS = new Set([
  "company", "companies", "brand", "brands", "startup", "startups", "business", "businesses", "platform",
  "service", "product", "products", "user", "users", "customer", "customers", "team", "teams", "people",
  "new", "modern", "better", "bilingual", "arabic", "english", "rtl", "ltr",
]);

/** Clause boundaries, as in subject.ts. */
const BOUNDARY = new Set([
  "for", "about", "of", "with", "that", "which", "where", "who", "aimed", "targeting", "so",
  "using", "like", "to", "in", "on", "at", "by", "from", "featuring", "including", "inspired",
]);

/** Words after which a brief's component list ends ("..., recent transactions, into bold territory"). */
const LIST_END = new Set([...BOUNDARY, "into", "toward", "towards", "but", "while", "make", "making", "feel", "feels"]);

const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

type Token = { word: string; acronym: boolean; product: boolean };

function tokens(text: string): Token[] {
  return (text.match(TOKEN) ?? []).map((raw) => ({
    word: raw.toLowerCase().replace(/['’-]+$/, ""),
    acronym: raw.length >= 2 && raw === raw.toUpperCase() && /\p{L}/u.test(raw),
    product: isProductWord(raw),
  }));
}

/** True when the brief is about a screen, app, page or other product UI. */
export function isUiBrief(brief: string): boolean {
  return tokens(brief).some((t) => UI_BRIEF_WORDS.has(t.word));
}

/** True when the brief asks for Arabic or right-to-left UI (or is written in Arabic). */
export function isArabicBrief(brief: string): boolean {
  return /\p{Script=Arabic}/u.test(brief) || tokens(brief).some((t) => t.word === "arabic" || t.word === "rtl");
}

export type Surface = "app" | "tablet" | "web" | "dashboard";

/** The surface words of the fidelity and locale lanes. */
export const SURFACE_WORDS: Record<Surface, string> = { app: "app ui", tablet: "ipad app ui", web: "website ui", dashboard: "dashboard ui" };
/** Component when the brief names none (rule 6 of the grammar). */
const DEFAULT_COMPONENT: Record<Surface, string> = { app: "card", tablet: "card", web: "hero section", dashboard: "dashboard" };

/** The surface a platform searches with; "any" (or none) keeps the surface the brief's words give. */
const PLATFORM_SURFACE: Partial<Record<Platform, Surface>> = { mobile: "app", tablet: "tablet", website: "web", webapp: "dashboard" };

/**
 * Title words the UI lanes drop for a platform (live test 2026-10-12: an iPhone brief got
 * "Finance web ui design", "Fintech Web App" and a SaaS dashboard). A word the brief itself uses
 * is kept ("a mobile dashboard" keeps dashboards).
 */
const PLATFORM_AVOID: Partial<Record<Platform, readonly string[]>> = {
  mobile: ["web", "website", "web app", "webapp", "dashboard", "landing", "landing page", "desktop", "saas", "admin"],
  tablet: ["website", "landing", "landing page", "desktop"],
  webapp: ["mobile", "ios", "android", "iphone", "smartphone", "mobile app"],
  website: ["mobile", "mobile app", "ios", "android", "iphone", "smartphone"],
};

/** Platform title filter words for a brief (minus words the brief uses), or []. */
export function avoidWords(brief: string, platform: Platform): string[] {
  const text = ` ${tokens(brief).map((t) => t.word).join(" ")} `;
  return (PLATFORM_AVOID[platform] ?? []).filter((w) => !text.includes(` ${w} `) && !text.includes(` ${w}s `));
}

type BriefParts = {
  ui: boolean;
  surface: Surface;
  /** Up to two domain words ("flight", "fleet management"); a product word is always kept ("esim plan"). */
  domain: string[];
  /** Domain words that are product nouns ("esim"): the core and the topic keep them (P0-16). */
  product: ReadonlySet<string>;
  component: string;
  /** Components the brief names, in brief order (its list first), for the component lanes. */
  components: string[];
  arabic: boolean;
  /** Brief text without bracketed asides. */
  main: string;
};

function domainWord(t: Token): boolean {
  const w = t.word;
  return (
    w.length > 1 &&
    (!t.acronym || t.product) &&
    !/\d/.test(w) &&
    !STOP_WORDS.has(w) &&
    !LAYOUT_WORDS.has(w) &&
    !USABILITY_WORDS.has(w) &&
    !GENERIC_WORDS.has(w) &&
    !SCREEN_NOUNS.has(w) &&
    !BOUNDARY.has(w)
  );
}

/** Recent briefParts answers: one bend reads the same brief about 50 times. Small, pure, never stale. */
const partsCache = new Map<string, BriefParts>();
const PARTS_CACHE_SIZE = 32;

function briefParts(brief: string, platform?: Platform): BriefParts {
  const key = `${platform ?? ""}|${brief}`;
  const hit = partsCache.get(key);
  if (hit) return hit;
  const parts = readBriefParts(brief, platform);
  if (partsCache.size >= PARTS_CACHE_SIZE) partsCache.delete(partsCache.keys().next().value!);
  partsCache.set(key, parts);
  return parts;
}

function readBriefParts(brief: string, platform?: Platform): BriefParts {
  // Asides in brackets are detail ("(mobile, bilingual)"): they set the surface, never the domain.
  const main = brief.replace(/\([^)]*\)?|\[[^\]]*\]?/g, " ");
  const all = tokens(brief);
  const has = (...ws: string[]) => all.some((t) => ws.includes(t.word));
  const flatMain = ` ${tokens(main).map((t) => t.word).join(" ")} `;

  let surface: Surface = "app";
  if (has("dashboard", "dashboards", "admin")) surface = "dashboard";
  else if (has("mobile", "app", "apps", "ios", "android")) surface = "app";
  else if (has("website", "websites", "landing", "homepage", "web", "site", "portal", "page", "pages")) surface = "web";
  if (platform && PLATFORM_SURFACE[platform]) surface = PLATFORM_SURFACE[platform]!;

  const named = COMPONENTS.find((c) => flatMain.includes(` ${c} `) || flatMain.includes(` ${c}s `));
  const component = named ?? DEFAULT_COMPONENT[surface];

  // Domain: content words of the first clause that has any; up to two, closest to the noun.
  // Clauses end at punctuation (":", ".", ",", ";") as well as at boundary words, so a long brief
  // ("Retail banking mobile app homepage: balance, ... into bold, unexpected territory.") takes its
  // domain from the opening clause ("retail banking"), never from a later sentence.
  const chunks: Token[][] = [[]];
  for (const clause of main.split(/[:.;,!?\n]+/)) {
    if (chunks[chunks.length - 1]!.length > 0) chunks.push([]);
    for (const t of tokens(clause)) {
      if (BOUNDARY.has(t.word)) chunks.push([]);
      else chunks[chunks.length - 1]!.push(t);
    }
  }
  let domain: string[] = [];
  const product = new Set<string>();
  for (const chunk of chunks) {
    const kept = chunk.filter(domainWord);
    const found = [...new Set(kept.map((t) => t.word))];
    if (found.length > 0) {
      for (const t of kept) if (t.product) product.add(t.word);
      // The last two words, unless that cuts a product word ("esim data plan" keeps "esim plan").
      const lost = found.slice(0, -2).find((w) => product.has(w));
      domain = lost ? [lost, found.at(-1)!] : found.slice(-2);
      break;
    }
  }
  if (domain.length === 0) {
    domain = words(extractSubject(main, 2).title.toLowerCase())
      .filter((w) => !SCREEN_NOUNS.has(w))
      .slice(-2);
  }
  for (const w of [...product]) if (!domain.includes(w)) product.delete(w);

  return { ui: isUiBrief(brief), surface, domain, product, component, components: briefComponents(main), arabic: isArabicBrief(brief), main };
}

/** A known component at the start of `ws` (longest first), as its list form, or undefined. */
function knownAt(ws: readonly string[], i: number): { phrase: string; len: number } | undefined {
  let best: { phrase: string; len: number } | undefined;
  for (const c of LANE_COMPONENTS) {
    const cw = c.split(" ");
    if (i + cw.length > ws.length) continue;
    const ok = cw.every((w, j) => {
      const t = ws[i + j]!;
      return t === w || (j === cw.length - 1 && (t === `${w}s` || t === `${w}es`));
    });
    if (ok && (!best || cw.length > best.len)) best = { phrase: c, len: cw.length };
  }
  return best;
}

/** Content word for an unknown list item ("loyalty points"): no stop, layout or generic word. */
function listWord(t: Token): boolean {
  return domainWord(t) || SCREEN_NOUNS.has(t.word);
}

/**
 * Components the brief names, in order: first its list (after a colon, or after "with",
 * "showing", "including" or "featuring"), each item as the known component it contains or as
 * its own words (1 to 3 content words); the list stops at the first item that is neither. Then
 * known components anywhere else in the brief. "Retail banking app homepage: balance, quick
 * actions, recent transactions, into bold, unexpected territory." gives balance, quick actions,
 * recent transactions.
 */
export function briefComponents(main: string): string[] {
  const hit = componentsCache.get(main);
  if (hit) return [...hit];
  const out = readBriefComponents(main);
  if (componentsCache.size >= PARTS_CACHE_SIZE) componentsCache.delete(componentsCache.keys().next().value!);
  componentsCache.set(main, out);
  return [...out];
}

/** Recent briefComponents answers (pure; a bend reads the same brief many times). */
const componentsCache = new Map<string, readonly string[]>();

function readBriefComponents(main: string): string[] {
  const out: string[] = [];
  const push = (c: string) => {
    if (!out.includes(c)) out.push(c);
  };
  const lead = /:|\b(?:with|showing|including|featuring)\b/i.exec(main);
  if (lead) {
    const rest = main.slice(lead.index + lead[0].length).split(/[.!?;\n]/)[0] ?? "";
    for (const item of rest.split(/,|\band\b|&|\/|\+/i)) {
      const toks: Token[] = [];
      for (const t of tokens(item)) {
        if (LIST_END.has(t.word)) break;
        toks.push(t);
      }
      const ws = toks.map((t) => t.word);
      let known: string | undefined;
      for (let i = 0; i < ws.length && !known; i++) known = knownAt(ws, i)?.phrase;
      if (known) push(known);
      else if (toks.length >= 1 && toks.length <= 3 && toks.every(listWord)) push(ws.join(" "));
      else break;
    }
  }
  const ws = tokens(main).map((t) => t.word);
  for (let i = 0; i < ws.length; i++) {
    const hit = knownAt(ws, i);
    if (!hit) continue;
    push(hit.phrase);
    i += hit.len - 1;
  }
  return out;
}

const capWords = (text: string, max = MAX_FOCUSED_QUERY_WORDS) => {
  const out: string[] = [];
  for (const w of words(text)) if (!out.includes(w)) out.push(w);
  return out.slice(0, max).join(" ");
};

/** Style words as they go into a query: lowercase, no filler words, at most 3. */
function styleWords(style: string): string {
  return words(style.toLowerCase())
    .filter((w) => !STOP_WORDS.has(w))
    .slice(0, 3)
    .join(" ");
}

/**
 * Fidelity lane: "{domain} {surface}" for UI briefs ("flight app ui"); "{subject} app ui" for a
 * brief that names no UI ("jazz festival app ui"), since search returns UI only.
 */
export function fidelityQuery(brief: string, platform?: Platform): string {
  const p = briefParts(brief, platform);
  if (!p.ui) return capWords(`${extractSubject(p.main, 1).full} app ui`, MAX_LANE_WORDS + 1);
  return pageForm(p.domain, briefPage(p), SURFACE_WORDS[p.surface], p.product);
}

/**
 * The page the brief names, for the UI lanes ("checkout" in "flight checkout screen"), or "" when
 * it names none or only the surface (dashboard, landing page, card, widget).
 */
function briefPage(p: BriefParts): string {
  const flat = ` ${tokens(p.main).map((t) => t.word).join(" ")} `;
  return PAGE_NOUNS.find((c) => flat.includes(` ${c} `)) ?? "";
}

/** The parts a page is judged by, searched when the brief names only the page. */
const PAGE_PARTS: Readonly<Record<string, readonly string[]>> = {
  checkout: ["price breakdown", "payment bottom sheet"],
  payment: ["payment bottom sheet", "payment methods"],
  cart: ["order summary", "promo code"],
  booking: ["date picker", "price breakdown"],
};
/** Domains whose price breakdown is a fare summary. */
const FARE_DOMAINS = new Set(["flight", "flights", "airline", "airlines", "travel", "airport", "rail", "train", "bus"]);

function pageParts(page: string, core: string): string[] {
  const parts = PAGE_PARTS[page] ?? [];
  return parts.map((c) => (c === "price breakdown" && FARE_DOMAINS.has(core) ? "fare summary" : c));
}

/** Components that are whole pages or screens (a part like "data table" or "tab bar" is not), longest first. */
const PAGE_NOUNS = [
  "order tracking", "product detail", "music player", "empty state", "pricing page", "sign up page", "404 page",
  "onboarding", "login", "paywall", "settings", "profile", "checkout", "payment", "chat", "search", "calendar",
  "wallet", "booking", "feed", "inbox", "cart", "notification",
];

/** "{domain} {page} {surface}" within MAX_FOCUSED_QUERY_WORDS: the domain drops to its core noun, then the page goes. */
function pageForm(domain: readonly string[], page: string, surface: string, product: ReadonlySet<string> = NO_PRODUCT): string {
  const fits = (d: string, pg: string) => words(`${d} ${pg} ${surface}`).length <= MAX_FOCUSED_QUERY_WORDS;
  const full = domain.join(" ");
  const core = coreNoun(domain, product) ?? "";
  if (fits(full, page)) return capWords(`${full} ${page} ${surface}`);
  if (fits(core, page)) return capWords(`${core} ${page} ${surface}`);
  return capWords(`${full} ${surface}`);
}

/** Last words that are not the core of a domain ("fleet management" is about fleets). */
const NOT_CORE = new Set(["management", "system", "systems", "solutions", "services", "software", "tool", "tools", "times", "time", "tracking", "tracker"]);

const NO_PRODUCT: ReadonlySet<string> = new Set();

/**
 * Core noun of the domain: its last word ("saudi fintech" to "fintech"), skipping NOT_CORE words.
 * A domain with a product word stays whole ("esim plan"): cutting it lost the brief's nouns
 * (P0-16, live test 2026-10-13).
 */
function coreNoun(domain: readonly string[], product: ReadonlySet<string> = NO_PRODUCT): string | undefined {
  if (domain.some((w) => product.has(w))) return domain.join(" ");
  return [...domain].reverse().find((w) => !NOT_CORE.has(w)) ?? domain.at(-1);
}

/** Fidelity with the domain cut to its core noun ("saudi fintech app ui" to "fintech app ui"), or null. */
export function fidelityCoreQuery(brief: string, platform?: Platform): string | null {
  const p = briefParts(brief, platform);
  if (!p.ui || p.domain.length < 2 || p.product.size > 0) return null;
  return pageForm([coreNoun(p.domain)!], briefPage(p), SURFACE_WORDS[p.surface]);
}

/**
 * The topic of a UI brief (P0-16): galleries search it and every UI lane carries it. A noun
 * phrase that keeps the product noun ("esim plan"), else the core noun with the page ("flight
 * checkout"), else the two domain words ("fleet management"), else the core noun alone when the
 * brief gives nothing more ("fintech"). Never a lone generic word (TOPIC_STOP): "" then.
 */
function uiTopic(p: BriefParts): string {
  const page = briefPage(p);
  // A page word read as a domain word ("fitness app empty state" gave the domain "fitness empty")
  // is left out of the core, so the topic is "fitness empty state", not "empty empty state".
  const pageWords = new Set(words(page));
  const domain = p.domain.filter((w) => !pageWords.has(w));
  const core = coreNoun(domain.length > 0 ? domain : p.domain, p.product) ?? "";
  let topic = words(core);
  if (topic.length < 2 && page) topic = [...new Set([...topic, ...words(page)])];
  if (topic.length < 2 && p.domain.length > 1) topic = [...p.domain];
  return topic.filter((w) => !TOPIC_STOP.has(w)).join(" ");
}

/** Topic of any brief: uiTopic for UI briefs, else the subject ("jazz festival"); never a lone generic word. */
export function briefTopic(brief: string, platform?: Platform): string {
  const p = briefParts(brief, platform);
  if (p.ui) return uiTopic(p);
  const subject = words(extractSubject(p.main, 1).title.toLowerCase()).filter((w) => !TOPIC_STOP.has(w));
  return subject.join(" ");
}

/**
 * "{style} {domain} {component} ui design" within MAX_FOCUSED_QUERY_WORDS: when it runs long the
 * domain drops to its core noun, then style words drop from the end. "ui design" always stays.
 */
function tasteUiQuery(p: BriefParts, style: string, domain: readonly string[], tail = "ui design", app = false): string {
  const dom = [...domain];
  let s = words(styleWords(style));
  const build = () => words(`${s.join(" ")} ${dom.join(" ")} ${app ? "app " : ""}${p.component} ${tail}`);
  const fits = () => new Set(build()).size <= MAX_FOCUSED_QUERY_WORDS;
  if (!fits() && dom.length > 1) dom.splice(0, dom.length, ...words(coreNoun(dom, p.product)!));
  while (!fits() && s.length > 1) s = s.slice(0, -1);
  return capWords(build().join(" "));
}

/**
 * Taste lane: "{style} {domain} {component} ui design" ("big typography flight checkout ui design");
 * "{style} {subject} ui design" for a brief that names no UI. The domain keeps results on topic (live test 2026-10-11:
 * 20 of 21 on topic against 1 of 24 for "{style} {component} ui", and 19 of 21 still new against
 * the fidelity lane).
 */
export function tasteQuery(brief: string, style: string, platform?: Platform): string {
  const p = briefParts(brief, platform);
  if (!p.ui) return capWords(`${styleWords(style)} ${extractSubject(p.main, 2).title} ui design`);
  return tasteUiQuery(p, style, p.domain);
}

/**
 * Alternative taste wordings the search learner (lib/learning/arms.ts) can try for UI briefs:
 * `app` = "{style} {domain} app {component} ui" (app briefs only), `core` = the default template
 * with the domain cut to its core noun (compound domains only). Absent when they would not differ.
 */
export function tasteVariants(brief: string, style: string, platform?: Platform): { app?: string; core?: string } {
  const p = briefParts(brief, platform);
  // Mobile and web app taste lanes use the taste bar wording, which has no variants.
  if (!p.ui || platform === "mobile" || platform === "webapp") return {};
  const base = tasteUiQuery(p, style, p.domain);
  const out: { app?: string; core?: string } = {};
  if (p.surface === "app") {
    const app = tasteUiQuery(p, style, p.domain, "ui", true);
    if (app !== base) out.app = app;
  }
  if (p.domain.length > 1) {
    const core = tasteUiQuery(p, style, words(coreNoun(p.domain, p.product)!));
    if (core !== base) out.core = core;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Taste bar lanes (P0-17, docs/search-quality-experiment.md round 13). The hero lane ("{style}
// {domain} app single screen") is gone: it kept 0 and 1 of 10 for paywall and wallet.

/** Words a taste lane never sends: they added nothing in round 13 ("2025", "product design", "saas", "single screen"). */
const NEVER_SEND = /\b(?:20\d\d|product design|saas|single screen)\b/gi;

/** The default taste word per platform when the user gave none: the owner's bar, not a house style. */
export const BAR_STYLE: Readonly<Partial<Record<Platform, string>>> = { mobile: "dark", webapp: "dark mode minimal" };

/**
 * The phrase of the Pinterest series of shipped screens ("Paywall & Subscription UI from Flighty iOS
 * App") for a mobile brief, or the brief's topic. A brief with a product noun keeps its topic
 * ("esim plan", P0-16); paywall, plan picker, subscription and pricing give "paywall subscription";
 * onboarding, welcome and sign up give "welcome screen"; wallet, balance and a finance home give
 * "wallet balance"; anything else the topic ("flight checkout"), else the component.
 */
function seriesPhrase(p: BriefParts): string {
  const topic = uiTopic(p);
  if (p.product.size > 0 && topic) return topic;
  const flat = ` ${tokens(p.main).map((t) => t.word).join(" ")} `;
  const has = (...ws: string[]) => ws.some((w) => flat.includes(` ${w} `));
  if (has("paywall", "paywalls", "subscription", "subscriptions", "plan picker", "pricing")) return "paywall subscription";
  if (has("onboarding", "welcome", "sign up", "signup", "get started")) return "welcome screen";
  if (has("wallet", "wallets", "balance") || (has("finance", "banking", "bank", "fintech") && has("home", "homepage", "home screen"))) return "wallet balance";
  return topic || p.component;
}

/** "ios app", or "android app" when the brief says Android. */
function mobileTail(p: BriefParts): string {
  return tokens(p.main).some((t) => t.word === "android") ? "android app" : "ios app";
}

/** A taste lane's words without NEVER_SEND words, within MAX_FOCUSED_QUERY_WORDS. */
function cleanTasteWords(text: string): string {
  return capWords(text.replace(NEVER_SEND, " "));
}

/**
 * The page a web app taste lane names: the brief's page ("settings"), else its component
 * ("analytics dashboard", "data table"), else "dashboard".
 */
function webAppPage(p: BriefParts): string {
  return briefPage(p) || (p.component && p.component !== "card" && p.component !== "widget" ? p.component : "dashboard");
}

/**
 * Taste bar lane for mobile and web app briefs, or null for other platforms and briefs that name
 * no UI. Mobile: "{style} {phrase} ui ios app" ("dark paywall subscription ui ios app"), searched on
 * Pinterest pins. Web app: "{style} {domain} {page} ui" ("dark mode minimal fleet management
 * dashboard ui") on Dribbble, with the fallback "{style} {page} web app ui" ("dark dashboard web app
 * ui"; round 13 used "dark" there). `style` is the user's style word, else BAR_STYLE. Over the word
 * cap the domain drops to its core noun, then style words drop from the end.
 */
export function barTasteQuery(
  brief: string,
  style: string | undefined,
  platform: Platform | undefined,
): { text: string; site: "pinterest" | "dribbble"; fallback?: string } | null {
  if (platform !== "mobile" && platform !== "webapp") return null;
  const p = briefParts(brief, platform);
  if (!p.ui) return null;
  let s = words(styleWords(style?.trim() ? style : BAR_STYLE[platform]!).replace(NEVER_SEND, " "));
  if (s.length === 0) s = words(BAR_STYLE[platform]!);
  if (platform === "mobile") {
    const phrase = words(seriesPhrase(p).replace(NEVER_SEND, " "));
    const tail = ["ui", ...words(mobileTail(p))];
    while (s.length > 1 && new Set([...s, ...phrase, ...tail]).size > MAX_FOCUSED_QUERY_WORDS) s = s.slice(0, -1);
    return { text: cleanTasteWords([...s, ...phrase, ...tail].join(" ")), site: "pinterest" };
  }
  const page = webAppPage(p);
  let dom = p.domain.filter((w) => !page.split(" ").includes(w));
  const build = () => [...s, ...dom, ...words(page), "ui"];
  const fits = () => new Set(build()).size <= MAX_FOCUSED_QUERY_WORDS;
  if (!fits() && dom.length > 1) dom = words(coreNoun(dom, p.product) ?? "");
  while (!fits() && s.length > 1) s = s.slice(0, -1);
  const fallbackStyle = style?.trim() ? s : ["dark"];
  const fallback = cleanTasteWords([...fallbackStyle, ...words(page), "web", "app", "ui"].join(" "));
  return { text: cleanTasteWords(build().join(" ")), site: "dribbble", fallback };
}

/**
 * The light twin of the mobile taste lane: "{phrase} ui ios app" ("paywall subscription ui ios
 * app"), searched on Pinterest in the baseline lane in place of the Pinterest fidelity page. Null
 * for other platforms and briefs that name no UI.
 */
export function lightTwinQuery(brief: string, platform: Platform | undefined): string | null {
  if (platform !== "mobile") return null;
  const p = briefParts(brief, platform);
  if (!p.ui) return null;
  return cleanTasteWords(`${seriesPhrase(p)} ui ${mobileTail(p)}`);
}

/**
 * Bridge lane: "{ingredient} ui design" for UI briefs whose ingredient has a head word to filter
 * result titles by (lib/sources/plan.ts bridgeHead), or null.
 */
export function bridgeQuery(brief: string, ingredient: string): string | null {
  if (!isUiBrief(brief) || !bridgeHead(ingredient)) return null;
  return capWords(`${ingredient} ui design`);
}

/**
 * Components of the pages given to bend_brief ("fare summary", "payment bottom sheet"): each page
 * as the known component it contains, else its own words (1 to 3 content words).
 */
function pageComponents(pages: readonly string[] | undefined): string[] {
  const out: string[] = [];
  for (const page of pages ?? []) {
    const toks = tokens(page);
    const ws = toks.map((t) => t.word);
    let known: string | undefined;
    for (let i = 0; i < ws.length && !known; i++) known = knownAt(ws, i)?.phrase;
    const c = known ?? (ws.length >= 1 && ws.length <= 3 && toks.every(listWord) ? ws.join(" ") : undefined);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

/**
 * Component lanes: "{core} {page} {component} {surface}" for up to 2 components ("flight checkout
 * fare summary app ui", "banking quick actions app ui"): the pages given to bend_brief first, then
 * the components the brief names. Page plus component finds the part on the right screen ("flight
 * app ui" pulled tracking, search and seat screens for a checkout, field report 2026-10-12). Over
 * the word cap the page goes, then the core noun. The taste lane's component goes last, so the
 * lanes differ from taste when the brief names more. A component that only repeats the surface
 * (dashboard, card, widget, landing page) gets no lane. Empty for briefs that name no UI.
 */
export function componentQueries(brief: string, platform?: Platform, pages?: readonly string[]): string[] {
  const p = briefParts(brief, platform);
  if (!p.ui) return [];
  const core = coreNoun(p.domain, p.product) ?? "";
  const page = briefPage(p);
  const surface = SURFACE_WORDS[p.surface];
  let named = [...pageComponents(pages), ...p.components].filter((c, i, all) => !SURFACE_COMPONENTS.has(c) && all.indexOf(c) === i);
  // Only the page named: search its standard parts ("flight checkout fare summary app ui").
  if (named.every((c) => c === page)) named = [...pageParts(page, core), ...named];
  const ordered = [...named.filter((c) => c !== p.component), ...named.filter((c) => c === p.component)];
  const fidelity = fidelityQuery(brief, platform);
  const out: string[] = [];
  for (const c of ordered) {
    const pg = page && !c.split(" ").includes(page) ? page : "";
    const options = [`${core} ${pg} ${c} ${surface}`, `${core} ${c} ${surface}`, `${c} ${surface}`];
    const form = options.find((o) => words(o).length <= MAX_FOCUSED_QUERY_WORDS) ?? options.at(-1)!;
    const q = capWords(form);
    if (q !== fidelity && !out.includes(q)) out.push(q);
    if (out.length >= MAX_COMPONENT_LANES) break;
  }
  return out;
}

/** A mechanic element (lib/bend/mechanic.ts) as the UI noun designers search for. */
export const ELEMENT_NOUN: Readonly<Record<string, string>> = {
  progress: "progress bar",
  total: "price summary",
  cta: "button",
  divider: "section divider",
  "section-nav": "tabs",
  header: "header",
  "empty-state": "empty state",
};

/**
 * Mechanic lane (P0-05): "{topic} {element noun} {surface}" ("flight checkout progress bar app
 * ui"), the brief's page with the part this direction's idea becomes. Over the word cap the topic
 * drops to the core noun, then goes. Null for briefs that name no UI or an unknown element.
 */
export function mechanicQuery(brief: string, element: string, platform?: Platform): string | null {
  const noun = ELEMENT_NOUN[element];
  const p = briefParts(brief, platform);
  if (!noun || !p.ui) return null;
  const core = coreNoun(p.domain, p.product) ?? "";
  const surface = SURFACE_WORDS[p.surface];
  // The topic carries the product noun or the page ("esim plan", "flight checkout", "coffee shop").
  const options = [`${uiTopic(p)} ${noun} ${surface}`, `${core} ${noun} ${surface}`, `${noun} ${surface}`];
  return capWords(options.find((o) => words(o).length <= MAX_FOCUSED_QUERY_WORDS) ?? options.at(-1)!);
}

/** The idea on its mechanic part: "{ingredient} {element noun} ui" ("sadu weaving progress bar ui"), or null. */
export function ideaMechanicQuery(idea: string, element: string): string | null {
  const noun = ELEMENT_NOUN[element];
  if (!noun || !idea.trim()) return null;
  const ideaWords = words(idea.toLowerCase()).slice(0, Math.max(1, MAX_FOCUSED_QUERY_WORDS - words(noun).length - 1));
  return capWords(`${ideaWords.join(" ")} ${noun} ui`);
}

/** Order-free key of a query: "plan picker app ui" and "picker plan app ui" are one query. */
export function queryKey(text: string): string {
  return [...new Set(words(text.toLowerCase()))].sort().join(" ");
}

/** Component lane words for the `app` arm: "{core} {component} app ui". */
export function componentAppText(text: string): string {
  return / (?:app|ipad app|website|dashboard) ui$/.test(text) ? text : text.replace(/ ui$/, " app ui");
}

/**
 * Locale lane: "arabic {core} {surface}" ("arabic flight app ui") when the brief is Arabic or right
 * to left, or null. Without a subject there is no lane: a bare "arabic app ui" returns mostly Quran,
 * prayer and calligraphy apps (live audit, 2026-10-11), so the Pinterest fidelity page runs instead.
 */
export function localeQuery(brief: string, platform?: Platform): string | null {
  const p = briefParts(brief, platform);
  const word = localeWord(brief, platform);
  return p.ui && p.arabic && word ? capWords(`arabic ${coreNoun(p.domain, p.product)} ${SURFACE_WORDS[p.surface]}`) : null;
}

/** Words that name the market or script, not the subject ("arabic app" has no subject). */
const LOCALE_NOT_SUBJECT = /^(arabic|arab|rtl|bilingual|english|gcc|gulf|saudi|ksa|uae|emirati|qatari|kuwaiti|omani|bahraini|khaleeji)$/i;

/** The subject word the locale lane's titles must name ("flight"; the product word when there is one, "esim"), or undefined. */
export function localeWord(brief: string, platform?: Platform): string | undefined {
  const p = briefParts(brief, platform);
  const core = p.domain.find((w) => p.product.has(w)) ?? coreNoun(p.domain);
  return core && !LOCALE_NOT_SUBJECT.test(core) ? core : undefined;
}

/** One style from the taste list, picked by a stable key (a direction id), so it never changes between calls. */
export function pickStyle(taste: readonly string[], key: string, offset = 0): string {
  const list = taste.length > 0 ? taste : DEFAULT_TASTE;
  return list[(cyrb53(`taste|${key}`) + offset) % list.length]!;
}

/** The style list a direction searches with: the user's taste, else the direction's style words. Never DEFAULT_TASTE. */
export function directionStyles(taste: readonly string[], styleWords?: readonly string[]): string[] {
  return [...(taste.length > 0 ? taste : styleWords ?? [])].map((w) => w.trim()).filter(Boolean);
}

/** One style from a list, picked by a stable key, or "" when the list is empty. */
function pickFrom(list: readonly string[], key: string, offset = 0): string {
  return list.length > 0 ? list[(cyrb53(`taste|${key}`) + offset) % list.length]! : "";
}

export type LaneOptions = {
  /** Where the design lives; else detectPlatform(brief). "any" keeps the brief's own surface words. */
  platform?: Platform;
  /** The direction's verified style words (spec.styleWords): the taste lane uses them when the user gave no taste. */
  styleWords?: readonly string[];
  /** Pages given to bend_brief ("fare summary"): their components lead the component lanes. */
  pages?: readonly string[];
  /**
   * The direction's mechanic element ("progress"): its lane ("flight checkout progress bar app ui")
   * leads the component lanes, so directions of one brief search different parts (P0-05).
   */
  mechanic?: string;
  /** A non-UI genre (lib/sources/genre.ts); else detected from the brief when its platform is "any". */
  genre?: Genre;
};

/** Taste lane variants for a direction (same style pick as laneTexts; no taste lane, none). */
export function directionTasteVariants(
  brief: string | null | undefined,
  taste: readonly string[],
  key: string,
  opts: LaneOptions = {},
): { app?: string; core?: string } {
  const b = brief?.trim();
  const style = pickFrom(directionStyles(taste, opts.styleWords), key);
  if (!b || !style) return {};
  return tasteVariants(b, style, opts.platform ?? detectPlatform(b));
}

/**
 * Every lane's words for one direction. `key` (the direction id) picks the taste lane's style.
 * Mobile and web app briefs get the taste bar wording (barTasteQuery: the user's style word, else
 * "dark" or "dark mode minimal"). Other platforms use the user's taste, else `opts.styleWords` (the
 * direction's spec); with neither there is no taste lane and its places go to the other lanes
 * (never the owner's DEFAULT_TASTE). The platform (`opts`, else
 * detectPlatform) words the UI lanes ("ipad app ui", "dashboard ui"), sets the title words they
 * drop, and with the style words picks the curated galleries (lib/sources/registry.ts). Without a
 * brief there are no UI lanes, only the idea (search_references then searches it in UI forms).
 */
export function laneTexts(
  brief: string | null | undefined,
  idea: string,
  taste: readonly string[],
  key: string,
  opts: LaneOptions = {},
): LaneTexts {
  const lanes: LaneTexts = { idea };
  const b = brief?.trim();
  if (!b) return lanes;
  const platform = opts.platform ?? detectPlatform(b);
  // A deck or brand brief (lib/sources/genre.ts): only when the caller says so, or the brief names
  // no device and no web surface (platform "any") and names the genre. Its genre lane replaces the
  // UI lanes; every other brief continues below exactly as before.
  const genre = opts.genre ?? (platform === "any" ? detectGenre(b) : null);
  if (genre) {
    const style = pickFrom(taste.map((w) => w.trim()).filter(Boolean), key);
    lanes.genre = genre;
    lanes.genreRequests = genreRequests(b, genre, style ? { style } : {});
    lanes.platform = platform;
    const subject = genreSubject(b);
    if (subject) lanes.topic = subject;
    return lanes;
  }
  const styles = directionStyles(taste, opts.styleWords);
  // Mobile and web app: the taste bar wording (P0-17), styled by the user's own taste words only;
  // without them, "dark" (mobile) or "dark mode minimal" (web app).
  const bar = barTasteQuery(b, pickFrom(taste.map((w) => w.trim()).filter(Boolean), key) || undefined, platform);
  if (bar) {
    lanes.taste = bar.text;
    lanes.tasteSite = bar.site;
    if (bar.fallback) lanes.tasteFallback = bar.fallback;
  } else {
    const style = pickFrom(styles, key);
    if (style) lanes.taste = tasteQuery(b, style, platform);
  }
  lanes.fidelity = fidelityQuery(b, platform);
  const twin = lightTwinQuery(b, platform);
  if (twin) lanes.lightTwin = twin;
  const core = fidelityCoreQuery(b, platform);
  if (core && core !== lanes.fidelity) lanes.fidelityCore = core;
  const mechanic = opts.mechanic ? mechanicQuery(b, opts.mechanic, platform) : null;
  const components = [...(mechanic ? [mechanic] : []), ...componentQueries(b, platform, opts.pages)]
    .filter((q, i, all) => q !== lanes.fidelity && all.findIndex((o) => queryKey(o) === queryKey(q)) === i)
    .slice(0, MAX_COMPONENT_LANES);
  if (components.length > 0) lanes.component = components;
  const bridge = bridgeQuery(b, idea);
  if (bridge) lanes.bridge = bridge;
  const locale = localeQuery(b, platform);
  if (locale) {
    lanes.locale = locale;
    lanes.localeWord = localeWord(b, platform);
  }
  lanes.platform = platform;
  const avoid = avoidWords(b, platform);
  if (avoid.length > 0) lanes.avoid = avoid;
  // P0-16: the topic keeps the product noun and is never a lone generic word ("picker" pulled
  // calendar date pickers). Galleries search it.
  const topic = briefTopic(b, platform);
  if (topic) lanes.topic = topic;
  // Website briefs that name a showcase style ("playful", "too fun", "3d", "webgl", "motion"):
  // showcase galleries search the style's words (lib/sources/showcase.ts), and the style's tag
  // pulls them. Other platforms never get this, so mobile, tablet and web app lanes are unchanged.
  const showcase = platform === "website" ? showcaseLane([...styles, ...(opts.styleWords ?? [])], b) : null;
  if (showcase) {
    lanes.showcase = showcase.phrase;
    if (showcase.word) lanes.showcaseWord = showcase.word;
  }
  const picked = pickGalleries({ platform, styleWords: [...styles, ...(opts.styleWords ?? []), ...(showcase?.ids ?? [])], brief: b, key, artText: [idea], ...(showcase ? { prefer: showcase.ids } : {}) });
  if (picked.ui.length > 0) lanes.galleries = picked.ui;
  if (picked.baseline.length > 0) lanes.baselineGalleries = picked.baseline;
  if (picked.art.length > 0) lanes.artGalleries = picked.art;
  return lanes;
}
