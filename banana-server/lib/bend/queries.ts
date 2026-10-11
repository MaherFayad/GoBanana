/**
 * Focused search queries for a direction (pure, deterministic).
 *
 * A live experiment (DECISIONS.md, 2026-10-11) showed that stacking two or three ideas in one
 * query returns tag and search pages, and so does a wild idea plus UI words ("Sadu pattern app
 * ui"). What works is two lanes:
 * - inspiration: one raw ingredient with at most one anchor word ("Sadu weaving pattern",
 *   "garment care label design"). No UI words.
 * - fidelity: the brief's domain and screen type in common words ("flight checkout app ui").
 *   It depends on the brief only, so every direction of a brief shares it.
 */
import { LAYOUT_WORDS, LENSES, LISTS, STOP_WORDS, USABILITY_WORDS, lensEntries } from "./lists";
import { MOVE_DEFS } from "./moves";
import { extractSubject } from "./subject";
import { MOVES, type ListEntry, type MoveId } from "./types";

/** Hard cap on a focused query, in words. */
export const MAX_FOCUSED_QUERY_WORDS = 5;

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
  if (out.length > MAX_FOCUSED_QUERY_WORDS) out = [...core, ...anchor.slice(-1)];
  if (out.length > MAX_FOCUSED_QUERY_WORDS) out = core;
  return out.slice(0, MAX_FOCUSED_QUERY_WORDS).join(" ");
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
      const needle = ` ${words(e.query.toLowerCase()).join(" ")} `;
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
  "homepage", "booking", "cart", "player", "tracker", "login", "signup", "ticketing",
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

/**
 * The fidelity lane: real product UI for the brief's domain and screen type, in common words.
 * UI brief: "<domain> <screen noun> app ui" ("flight checkout app ui", "fleet management dashboard
 * ui", "coffee shop website design"). Other briefs: the subject plus "design" ("jazz festival
 * poster design"). Acronyms (GCC, OTA), numbers and vague words are left out.
 */
export function fidelityQuery(brief: string): string {
  // Asides in brackets are detail ("(mobile, bilingual)"): they set the platform, never the domain.
  const main = brief.replace(/\([^)]*\)?|\[[^\]]*\]?/g, " ");
  const all = tokens(brief);
  const has = (...ws: string[]) => all.some((t) => ws.includes(t.word));

  if (!isUiBrief(brief)) {
    const subject = words(extractSubject(main, 1).full);
    const out = subject.includes("design") ? subject : [...subject, "design"];
    return out.slice(-MAX_FOCUSED_QUERY_WORDS).join(" ");
  }

  const mainTokens = tokens(main);
  const screen = SCREEN_NOUNS.find((n) => mainTokens.some((t) => t.word === n)) ?? SCREEN_NOUNS.find((n) => has(n));

  // Domain: content words of the first clause; when it has none, of the clause after "for", "about" or "of".
  const chunks: Token[][] = [[]];
  for (const t of mainTokens) {
    if (BOUNDARY.has(t.word)) chunks.push([]);
    else chunks[chunks.length - 1]!.push(t);
  }
  let domain: string[] = [];
  // A clause of only screen nouns ("checkout and payment flow") names no domain.
  for (const chunk of chunks) {
    const found = [...new Set(chunk.filter((t) => domainWord(t, screen)).map((t) => t.word))];
    if (found.some((w) => !SCREEN_NOUNS.includes(w))) {
      domain = found;
      break;
    }
  }
  domain = domain.slice(-2);

  let suffix: string[];
  if (screen === "dashboard" || has("dashboard", "dashboards")) suffix = ["dashboard", "ui"];
  else if (has("mobile", "app", "apps", "ios", "android")) suffix = ["app", "ui"];
  else if (has("website", "websites", "landing", "homepage", "web", "site", "portal", "page", "pages")) suffix = ["website", "design"];
  else suffix = ["app", "ui"];

  const out: string[] = [];
  for (const w of [...domain, ...(screen ? [screen] : []), ...suffix]) if (!out.includes(w)) out.push(w);
  if (out.length === suffix.length) {
    // Nothing but the platform: fall back to the subject.
    const subject = words(extractSubject(main, 2).title).filter((w) => !out.includes(w));
    out.unshift(...subject.slice(-(MAX_FOCUSED_QUERY_WORDS - suffix.length)));
  }
  return out.slice(-MAX_FOCUSED_QUERY_WORDS).join(" ");
}
