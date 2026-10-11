import { LAYOUT_WORDS, STOP_WORDS, USABILITY_WORDS } from "./lists";
import type { Wildness } from "./types";
import { WILDNESS } from "./wildness";

export interface Subject {
  /** Subject words used in search queries (layout words kept at wildness 1). */
  query: string;
  /** Subject used in titles and prompts, never with layout words. */
  title: string;
  /** Last word of the title subject, for templates like "What if the checkout were...". */
  head: string;
  /** Every content word, for avoiding list entries that echo the brief. */
  words: string[];
}

const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
/** Words that start a new clause in a brief. */
const BOUNDARY = new Set([
  "for", "about", "of", "with", "that", "which", "where", "who", "aimed", "targeting", "so",
  "using", "like", "to", "in", "on", "at", "by", "from", "featuring", "including", "inspired",
]);
/** Boundary words that introduce the domain: "landing page for a coffee shop". */
const DOMAIN_LEADS = new Set(["for", "about", "of"]);

interface CleanOptions {
  keepLayout: boolean;
  stripUsability: boolean;
}

function clean(words: readonly string[], opts: CleanOptions): string[] {
  const out: string[] = [];
  for (const raw of words) {
    const w = raw.replace(/['’-]+$/, "");
    if (!w || STOP_WORDS.has(w)) continue;
    if (!opts.keepLayout && LAYOUT_WORDS.has(w)) continue;
    if (opts.stripUsability && USABILITY_WORDS.has(w)) continue;
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

function compose(thing: string[], domain: string[], max: number): string[] {
  if (thing.length === 0) return domain.slice(-max);
  if (domain.length === 0) return thing.slice(-max);
  const d = domain.slice(0, 2);
  const t = thing.slice(-Math.max(1, max - d.length));
  return [...d, ...t.filter((w) => !d.includes(w))].slice(0, max);
}

/**
 * Pull a short, searchable subject out of a brief.
 * "landing page for a coffee shop" -> "coffee shop" (title), "coffee shop landing page" (query at 1).
 */
export function extractSubject(brief: string, wildness: Wildness): Subject {
  const rule = WILDNESS[wildness];
  const tokens = brief.toLowerCase().match(TOKEN) ?? [];

  const chunks: { lead: string | null; words: string[] }[] = [{ lead: null, words: [] }];
  for (const t of tokens) {
    if (BOUNDARY.has(t)) chunks.push({ lead: t, words: [] });
    else chunks[chunks.length - 1]?.words.push(t);
  }
  const thingRaw = chunks[0]?.words ?? [];
  const domainRaw = chunks.slice(1).find((c) => c.lead && DOMAIN_LEADS.has(c.lead))?.words ?? [];

  const build = (keepLayout: boolean, max: number): string[] => {
    const opts = { keepLayout, stripUsability: rule.ignoreUsabilityWords };
    let thing = clean(thingRaw, opts);
    let domain = clean(domainRaw, opts);
    if (thing.length === 0 && domain.length === 0 && thingRaw.length === 0) {
      // Brief started with a boundary word ("for a coffee shop landing page").
      thing = clean(chunks.flatMap((c) => c.words), opts);
      domain = [];
    }
    return compose(thing, domain, max);
  };

  let title = build(false, 3);
  if (title.length === 0) title = build(true, 3);
  if (title.length === 0) title = clean(tokens, { keepLayout: true, stripUsability: false }).slice(-3);
  if (title.length === 0) title = ["interface"];

  let query = rule.keepLayoutWords ? build(true, 4) : title;
  if (query.length === 0) query = title;

  return {
    query: query.join(" "),
    title: title.join(" "),
    head: title[title.length - 1] ?? "interface",
    words: clean(tokens, { keepLayout: true, stripUsability: false }),
  };
}
