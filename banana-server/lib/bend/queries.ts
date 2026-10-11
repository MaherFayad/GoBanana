/**
 * Focused search queries for a direction (pure, deterministic).
 *
 * A live experiment (DECISIONS.md, 2026-10-11) showed that stacking two or three ideas in one
 * query returns tag and search pages, and so does a wild idea plus UI words ("Sadu pattern app
 * ui"). What works is two lanes:
 * - inspiration: one raw ingredient with at most one anchor word ("Sadu weaving pattern",
 *   "garment care label design"). No UI words.
 * - taste: the brief's domain and component plus one style word from the user's taste
 *   ("flight checkout ui soft 3d"). Style words pull toward uncluttered, high-craft shots.
 * - fidelity: the brief's domain and screen type in common words ("flight checkout app ui").
 *   It depends on the brief only, so every direction of a brief shares it.
 */
import { LAYOUT_WORDS, LENSES, LISTS, STOP_WORDS, USABILITY_WORDS, lensEntries } from "./lists";
import { DEFAULT_TASTE } from "@/lib/taste";
import { MOVE_DEFS } from "./moves";
import { cyrb53 } from "./prng";
import { extractSubject } from "./subject";
import { MOVES, type ListEntry, type MoveId } from "./types";

/** Hard cap on a focused query (any lane), in words. */
export const MAX_FOCUSED_QUERY_WORDS = 6;
/** Inspiration and fidelity queries stay at 5 words or fewer; taste may use the sixth for its style. */
export const MAX_LANE_WORDS = 5;

/** One anchor per move: what kind of picture the ingredient should come back as. */
const ANCHOR: Record<MoveId, string> = {
  transplant: "design",
  material: "texture",
  era: "graphic design",
  constraint: "graphic design",
  scale: "poster",
  lens: "pattern",
};

/** Words that already say what kind of picture it is; the anchor is skipped when one is there. */
const PICTURE_NOUNS = new Set([
  "pattern", "patterns", "poster", "posters", "texture", "design", "graphics", "graphic", "layout", "cover",
  "facade", "architecture", "typography", "interior", "screen", "screens", "panel", "wall", "print", "manual",
  "furniture", "brushwork", "gradient", "palette", "motif", "motifs", "geometry", "tessellation", "rug",
]);

const words = (s: string) => s.split(/\s+/).filter(Boolean);

/** Raw ingredient query for one move: "Sadu weaving pattern", "crushed velvet texture". */
export function inspirationQuery(move: MoveId, entryQuery: string): string {
  const def = MOVE_DEFS[move];
  const core = words(def.prefix ? `${def.prefix} ${entryQuery}` : entryQuery);
  const lower = new Set(core.map((w) => w.toLowerCase()));
  const anchor = words(ANCHOR[move]);
  const skip = core.some((w) => PICTURE_NOUNS.has(w.toLowerCase())) || anchor.some((w) => lower.has(w));
  let out = skip ? core : [...core, ...anchor];
  if (out.length > MAX_LANE_WORDS) out = [...core, ...anchor.slice(-1)];
  if (out.length > MAX_LANE_WORDS) out = core;
  return out.slice(0, MAX_LANE_WORDS).join(" ");
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
      const prefix = MOVE_DEFS[move].prefix;
      const needle = ` ${words(`${prefix} ${e.query}`.toLowerCase()).join(" ")} `;
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
 * ingredient that comes first is the direction's lead idea, so it becomes "crushed velvet
 * texture". New directions already store that query, and this returns it unchanged.
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

/** Words that mark a brief as a screen or product UI. */
const UI_BRIEF_WORDS = new Set([
  "screen", "screens", "app", "apps", "checkout", "dashboard", "dashboards", "onboarding", "page", "pages",
  "flow", "flows", "website", "websites", "ui", "ux", "mobile", "landing", "interface", "portal", "web",
  "homepage", "booking", "cart", "player", "tracker", "login", "signup", "ticketing", "widget", "widgets",
]);

/** Screen or product nouns a UI query keeps ("flight checkout app ui"). */
const SCREEN_NOUNS = [
  "checkout", "booking", "onboarding", "dashboard", "login", "signup", "registration", "profile", "cart", "search",
  "settings", "payment", "wallet", "tracker", "tracking", "player", "calendar", "inbox", "chat", "feed", "ticketing",
  "ordering", "menu",
];

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

function domainWord(t: Token, screen: string | undefined): boolean {
  const w = t.word;
  return (
    w.length > 1 &&
    !t.acronym &&
    !/\d/.test(w) &&
    !STOP_WORDS.has(w) &&
    !LAYOUT_WORDS.has(w) &&
    !USABILITY_WORDS.has(w) &&
    !GENERIC_WORDS.has(w) &&
    w !== screen &&
    !BOUNDARY.has(w)
  );
}

type BriefParts = {
  ui: boolean;
  /** Up to two domain words ("flight", "fleet management"). */
  domain: string[];
  /** Screen or product noun ("checkout", "dashboard"). */
  screen?: string;
  /** Platform words for the fidelity lane: "app ui", "dashboard ui" or "website design". */
  suffix: string[];
  /** Visual component named in the brief ("card", "widget", "ticket", "checkout"). */
  component?: string;
  /** Brief text without bracketed asides. */
  main: string;
};

/** Components a taste query can be about. Card, widget, ticket and chart read as objects; the rest get "ui". */
const COMPONENTS = ["card", "widget", "ticket", "chart", "dashboard", "checkout", "wallet", "player", "calendar"];
const OBJECT_COMPONENTS = new Set(["card", "widget", "ticket", "chart"]);
const PLURALS: Record<string, string> = { cards: "card", widgets: "widget", tickets: "ticket", charts: "chart" };

function briefParts(brief: string): BriefParts {
  // Asides in brackets are detail ("(mobile, bilingual)"): they set the platform, never the domain.
  const main = brief.replace(/\([^)]*\)?|\[[^\]]*\]?/g, " ");
  const all = tokens(brief);
  const has = (...ws: string[]) => all.some((t) => ws.includes(t.word));
  const mainTokens = tokens(main);
  const screen = SCREEN_NOUNS.find((n) => mainTokens.some((t) => t.word === n)) ?? SCREEN_NOUNS.find((n) => has(n));
  const component = COMPONENTS.find((c) => mainTokens.some((t) => (PLURALS[t.word] ?? t.word) === c));

  // Domain: content words of the first clause; when it has none, of the clause after "for", "about" or "of".
  const chunks: Token[][] = [[]];
  for (const t of mainTokens) {
    if (BOUNDARY.has(t.word)) chunks.push([]);
    else chunks[chunks.length - 1]!.push(t);
  }
  let domain: string[] = [];
  // A clause of only screen nouns or components ("checkout and payment flow") names no domain.
  for (const chunk of chunks) {
    const found = [
      ...new Set(chunk.filter((t) => domainWord(t, screen) && (PLURALS[t.word] ?? t.word) !== component).map((t) => t.word)),
    ];
    if (found.some((w) => !SCREEN_NOUNS.includes(w))) {
      domain = found;
      break;
    }
  }
  domain = domain.slice(-2);
  if (domain.length === 0) {
    const subject = words(extractSubject(main, 2).title).filter((w) => w !== screen && w !== component);
    domain = subject.slice(-2);
  }

  let suffix: string[];
  if (screen === "dashboard" || has("dashboard", "dashboards")) suffix = ["dashboard", "ui"];
  else if (has("mobile", "app", "apps", "ios", "android")) suffix = ["app", "ui"];
  else if (has("website", "websites", "landing", "homepage", "web", "site", "portal", "page", "pages")) suffix = ["website", "design"];
  else suffix = ["app", "ui"];

  return { ui: isUiBrief(brief), domain, ...(screen ? { screen } : {}), ...(component ? { component } : {}), suffix, main };
}

function joinUnique(parts: readonly string[], max: number): string {
  const out: string[] = [];
  for (const p of parts) for (const w of words(p)) if (!out.includes(w)) out.push(w);
  return out.slice(-max).join(" ");
}

/**
 * The fidelity lane: real product UI for the brief's domain and screen type, in common words.
 * UI brief: "<domain> <screen noun> app ui" ("flight checkout app ui", "fleet management dashboard
 * ui", "coffee shop website design"). Other briefs: the subject plus "design" ("jazz festival
 * poster design"). Acronyms (GCC, OTA), numbers and vague words are left out.
 */
export function fidelityQuery(brief: string): string {
  const p = briefParts(brief);
  if (!p.ui) {
    const subject = words(extractSubject(p.main, 1).full);
    return joinUnique([...subject, "design"], MAX_LANE_WORDS);
  }
  return joinUnique([...p.domain, ...(p.screen ? [p.screen] : []), ...p.suffix], MAX_LANE_WORDS);
}

/**
 * The taste lane: "{domain} {component} {style}", for example "flight checkout ui soft 3d" or
 * "travel app ui glassmorphism". Style words move results toward uncluttered, high-craft shots
 * (single cards and widgets, soft 3D, frosted glass, dark with one accent), which domain queries
 * alone do not reach. At most MAX_FOCUSED_QUERY_WORDS words: domain words go first, then "ui".
 */
export function tasteQuery(brief: string, style: string): string {
  const p = briefParts(brief);
  const styleWords = words(style.toLowerCase())
    .filter((w) => !STOP_WORDS.has(w))
    .slice(0, 3);
  let middle: string[];
  if (!p.ui) middle = [];
  else if (p.component && OBJECT_COMPONENTS.has(p.component)) middle = [p.component];
  else if (p.component) middle = [p.component, "ui"];
  else if (p.suffix[0] === "website") middle = ["website"];
  else middle = [...p.suffix];
  const head = p.ui ? p.domain : words(extractSubject(p.main, 2).title).slice(-3);
  const build = (h: string[], m: string[]) => {
    const out: string[] = [];
    for (const w of [...h, ...m, ...styleWords]) if (!out.includes(w)) out.push(w);
    return out;
  };
  let out = build(head, middle);
  if (out.length > MAX_FOCUSED_QUERY_WORDS) out = build(head.slice(-1), middle);
  if (out.length > MAX_FOCUSED_QUERY_WORDS) out = build(head.slice(-1), middle.filter((w) => w !== "ui"));
  return out.slice(0, MAX_FOCUSED_QUERY_WORDS).join(" ");
}

/** One style from the taste list, picked by a stable key (a direction id), so it never changes between calls. */
export function pickStyle(taste: readonly string[], key: string): string {
  const list = taste.length > 0 ? taste : DEFAULT_TASTE;
  return list[cyrb53(`taste|${key}`) % list.length]!;
}
