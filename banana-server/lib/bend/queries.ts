/**
 * Lane words for a direction search (pure, deterministic). The grammar was verified on 386 live
 * queries (docs/search-quality-experiment.md, "The grammar"; DECISIONS.md, 2026-10-11):
 *
 * - inspiration: the direction's lead ingredient, raw ("Sadu weaving", "crushed velvet"). Stacking
 *   ideas, or adding UI words or "poster" to a niche idea, returns tag pages or nothing.
 * - fidelity: "{domain} {surface}" ("flight app ui"): real product UI for the brief.
 * - taste: "{style} {component} ui" ("minimal checkout ui"). No domain: with it, this lane
 *   returned the same shots as fidelity.
 * - hero: "{style} {coreDomain} app single screen" (app briefs): one floating phone, uncluttered.
 * - locale: "arabic {surface}" when the brief is Arabic or right to left.
 *
 * Site operators and negatives are added by lib/sources/plan.ts; these are the plain words.
 */
import type { LaneTexts } from "@/lib/sources/plan";
import { DEFAULT_TASTE } from "@/lib/taste";
import { LAYOUT_WORDS, LENSES, LISTS, STOP_WORDS, USABILITY_WORDS, lensEntries } from "./lists";
import { MOVE_DEFS } from "./moves";
import { cyrb53 } from "./prng";
import { extractSubject } from "./subject";
import { MOVES, type ListEntry, type MoveId } from "./types";

/** Hard cap on any lane query, in words (before negatives and the site operator). */
export const MAX_FOCUSED_QUERY_WORDS = 7;
/** The inspiration lane is a raw ingredient: at most 5 words. */
export const MAX_LANE_WORDS = 5;

const words = (s: string) => s.split(/\s+/).filter(Boolean);

/** The raw ingredient for one move ("Sadu weaving", "oversized numerals"). */
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
 * The inspiration lane for a saved direction, from its stored search text. Older directions
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
  "sign up page", "kanban board", "onboarding", "login", "paywall", "settings", "profile", "checkout", "chat",
  "notification", "search", "calendar", "widget", "map", "stats", "wallet", "booking", "feed", "camera", "timer",
  "footer", "dashboard", "card",
];

/** Screen nouns: never part of the domain ("flight checkout" names the flight domain). */
const SCREEN_NOUNS = new Set([
  "checkout", "booking", "onboarding", "dashboard", "login", "signup", "registration", "profile", "cart", "search",
  "settings", "payment", "payments", "wallet", "tracker", "tracking", "player", "calendar", "inbox", "chat", "feed",
  "ticketing", "ordering", "menu", "paywall", "notification", "notifications", "widget", "widgets", "card", "cards",
  "map", "stats", "camera", "timer", "footer", "pricing",
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

const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

type Token = { word: string; acronym: boolean };

function tokens(text: string): Token[] {
  return (text.match(TOKEN) ?? []).map((raw) => ({
    word: raw.toLowerCase().replace(/['’-]+$/, ""),
    acronym: raw.length >= 2 && raw === raw.toUpperCase() && /\p{L}/u.test(raw),
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

export type Surface = "app" | "web" | "dashboard";

/** The surface words of the fidelity and locale lanes. */
export const SURFACE_WORDS: Record<Surface, string> = { app: "app ui", web: "website ui", dashboard: "dashboard ui" };
/** Component when the brief names none (rule 6 of the grammar). */
const DEFAULT_COMPONENT: Record<Surface, string> = { app: "card", web: "hero section", dashboard: "dashboard" };

type BriefParts = {
  ui: boolean;
  surface: Surface;
  /** Up to two domain words ("flight", "fleet management"). */
  domain: string[];
  component: string;
  arabic: boolean;
  /** Brief text without bracketed asides. */
  main: string;
};

function domainWord(t: Token): boolean {
  const w = t.word;
  return (
    w.length > 1 &&
    !t.acronym &&
    !/\d/.test(w) &&
    !STOP_WORDS.has(w) &&
    !LAYOUT_WORDS.has(w) &&
    !USABILITY_WORDS.has(w) &&
    !GENERIC_WORDS.has(w) &&
    !SCREEN_NOUNS.has(w) &&
    !BOUNDARY.has(w)
  );
}

function briefParts(brief: string): BriefParts {
  // Asides in brackets are detail ("(mobile, bilingual)"): they set the surface, never the domain.
  const main = brief.replace(/\([^)]*\)?|\[[^\]]*\]?/g, " ");
  const all = tokens(brief);
  const has = (...ws: string[]) => all.some((t) => ws.includes(t.word));
  const flatMain = ` ${tokens(main).map((t) => t.word).join(" ")} `;

  let surface: Surface = "app";
  if (has("dashboard", "dashboards", "admin")) surface = "dashboard";
  else if (has("mobile", "app", "apps", "ios", "android")) surface = "app";
  else if (has("website", "websites", "landing", "homepage", "web", "site", "portal", "page", "pages")) surface = "web";

  const named = COMPONENTS.find((c) => flatMain.includes(` ${c} `) || flatMain.includes(` ${c}s `));
  const component = named ?? DEFAULT_COMPONENT[surface];

  // Domain: content words of the first clause that has any; up to two, closest to the noun.
  const chunks: Token[][] = [[]];
  for (const t of tokens(main)) {
    if (BOUNDARY.has(t.word)) chunks.push([]);
    else chunks[chunks.length - 1]!.push(t);
  }
  let domain: string[] = [];
  for (const chunk of chunks) {
    const found = [...new Set(chunk.filter(domainWord).map((t) => t.word))];
    if (found.length > 0) {
      domain = found.slice(-2);
      break;
    }
  }
  if (domain.length === 0) {
    domain = words(extractSubject(main, 2).title)
      .filter((w) => !SCREEN_NOUNS.has(w))
      .slice(-2);
  }

  return { ui: isUiBrief(brief), surface, domain, component, arabic: isArabicBrief(brief), main };
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

/** Fidelity lane: "{domain} {surface}" for UI briefs ("flight app ui"), "{subject} design" otherwise. */
export function fidelityQuery(brief: string): string {
  const p = briefParts(brief);
  if (!p.ui) return capWords(`${extractSubject(p.main, 1).full} design`, MAX_LANE_WORDS);
  return capWords(`${p.domain.join(" ")} ${SURFACE_WORDS[p.surface]}`);
}

/** Last words that are not the core of a domain ("fleet management" is about fleets). */
const NOT_CORE = new Set(["management", "system", "systems", "solutions", "services", "software", "tool", "tools"]);

/** Core noun of the domain: its last word ("saudi fintech" to "fintech"), skipping NOT_CORE words. */
function coreNoun(domain: readonly string[]): string | undefined {
  return [...domain].reverse().find((w) => !NOT_CORE.has(w)) ?? domain.at(-1);
}

/** Fidelity with the domain cut to its core noun ("saudi fintech app ui" to "fintech app ui"), or null. */
export function fidelityCoreQuery(brief: string): string | null {
  const p = briefParts(brief);
  if (!p.ui || p.domain.length < 2) return null;
  return capWords(`${coreNoun(p.domain)} ${SURFACE_WORDS[p.surface]}`);
}

/** Taste lane: "{style} {component} ui" ("minimal checkout ui"); "{style} {subject}" for other briefs. */
export function tasteQuery(brief: string, style: string): string {
  const p = briefParts(brief);
  const s = styleWords(style);
  if (!p.ui) return capWords(`${s} ${extractSubject(p.main, 2).title}`);
  return capWords(`${s} ${p.component} ui`);
}

/** Hero lane (app surface only): "{style} {coreDomain} app single screen", or null. */
export function heroQuery(brief: string, style: string): string | null {
  const p = briefParts(brief);
  if (!p.ui || p.surface !== "app" || p.domain.length === 0) return null;
  return capWords(`${styleWords(style)} ${coreNoun(p.domain)} app single screen`);
}

/** Locale lane: "arabic {surface}" when the brief is Arabic or right to left, or null. */
export function localeQuery(brief: string): string | null {
  const p = briefParts(brief);
  return p.ui && p.arabic ? `arabic ${SURFACE_WORDS[p.surface]}` : null;
}

/** One style from the taste list, picked by a stable key (a direction id), so it never changes between calls. */
export function pickStyle(taste: readonly string[], key: string, offset = 0): string {
  const list = taste.length > 0 ? taste : DEFAULT_TASTE;
  return list[(cyrb53(`taste|${key}`) + offset) % list.length]!;
}

/**
 * Every lane's words for one direction. `key` (the direction id) picks the styles: taste gets
 * one, hero the next, so a direction shows two looks from the list. Without a brief there is
 * only the inspiration lane.
 */
export function laneTexts(brief: string | null | undefined, inspiration: string, taste: readonly string[], key: string): LaneTexts {
  const lanes: LaneTexts = { inspiration };
  const b = brief?.trim();
  if (!b) return lanes;
  lanes.taste = tasteQuery(b, pickStyle(taste, key));
  lanes.fidelity = fidelityQuery(b);
  const core = fidelityCoreQuery(b);
  if (core && core !== lanes.fidelity) lanes.fidelityCore = core;
  const hero = heroQuery(b, pickStyle(taste, key, 1));
  if (hero) lanes.hero = hero;
  const locale = localeQuery(b);
  if (locale) lanes.locale = locale;
  return lanes;
}
