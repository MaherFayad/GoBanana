import { LAYOUT_WORDS, STOP_WORDS, USABILITY_WORDS } from "./lists";
import type { Wildness } from "./types";
import { WILDNESS } from "./wildness";

export interface Subject {
  /** Subject words used in search queries (layout words kept at wildness 1). */
  query: string;
  /** Subject used in titles and prompts, never with layout words. */
  title: string;
  /** Last two words of the title subject, for templates like "What if the checkout were...". */
  head: string;
  /** Subject with layout words kept, for prompts: "coffee shop landing page". */
  full: string;
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

/**
 * Product words a subject never drops, even when they lead a long thing chunk ("eSIM", "VPN").
 * Mixed case words ("eSIM", "WhatsApp", "iPhone") count too (see productWords).
 */
const PRODUCT_WORDS = new Set([
  "esim", "sim", "vpn", "wifi", "5g", "4g", "nft", "nfts", "crypto", "bitcoin", "ev", "evs", "podcast", "podcasts",
  "api", "sdk", "ai", "vr", "qr", "nfc", "bnpl", "loyalty", "visa", "mortgage", "insurance", "pharmacy",
]);

/** True for a raw token in mixed case, with a capital after its first letter: "eSIM", "WhatsApp". */
const mixedCase = (raw: string) => /\p{Ll}/u.test(raw) && /^.+\p{Lu}/u.test(raw);

/** Lowercase words of the brief that look like product nouns (mixed case or on PRODUCT_WORDS). */
function productWords(rawTokens: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of rawTokens) {
    const w = raw.toLowerCase().replace(/['’-]+$/, "");
    if (mixedCase(raw) || PRODUCT_WORDS.has(w)) out.add(w);
  }
  return out;
}

/**
 * The subject words: the head noun phrase of the thing chunk first (its last words, "eSIM plan
 * picker"), never dropping a product word, then domain words only while room is left ("coffee
 * shop checkout"). Before P0-06 the domain went first and trimmed the thing: "eSIM plan picker
 * for a GCC travel app" became "GCC travel picker" (live test, 2026-10-13).
 */
function compose(thing: string[], domain: string[], max: number, product: ReadonlySet<string>): string[] {
  if (thing.length === 0) return domain.slice(-max);
  // Product words the tail would cut ("esim" in "esim data plan picker") take the first places.
  const lost = thing.slice(0, -max).filter((w) => product.has(w)).slice(0, max - 1);
  const head = [...lost, ...thing.slice(-(max - lost.length))];
  const room = max - head.length;
  if (room <= 0 || domain.length === 0) return head;
  const d = domain.filter((w) => !head.includes(w)).slice(0, Math.min(2, room));
  return [...d, ...head];
}

/**
 * Pull a short, searchable subject out of a brief.
 * "landing page for a coffee shop" -> "coffee shop" (title), "coffee shop landing page" (query at 1).
 */
export function extractSubject(brief: string, wildness: Wildness): Subject {
  const rule = WILDNESS[wildness];
  const rawTokens = brief.match(TOKEN) ?? [];
  const tokens = rawTokens.map((t) => t.toLowerCase());
  const product = productWords(rawTokens);

  // The subject comes from the opening clause: "Retail banking app homepage: balance, quick
  // actions" is about retail banking, not "recent transactions". Ids never move: they only see `words`.
  const opening = brief.split(/[:;.!?\n]/).find((c) => /[\p{L}\p{N}]/u.test(c))?.match(TOKEN) ?? [];
  const clause = opening.length > 0 ? opening.map((t) => t.toLowerCase()) : tokens;
  const chunks: { lead: string | null; words: string[] }[] = [{ lead: null, words: [] }];
  for (const t of clause) {
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
    return compose(thing, domain, max, product);
  };

  let title = build(false, 3);
  if (title.length === 0) title = build(true, 3);
  if (title.length === 0) title = clean(tokens, { keepLayout: true, stripUsability: false }).slice(-3);
  if (title.length === 0) title = ["interface"];

  const full = build(true, 4).length ? build(true, 4) : title;
  const query = rule.keepLayoutWords ? full : title;
  // Fresh keeps the screen type in titles too ("Coffee shop landing page as a thermal receipt").
  const shown = rule.keepLayoutWords ? full : title;

  // Mixed case product words keep the brief's casing in shown text ("WhatsApp", "eSIM").
  const cased = new Map(rawTokens.filter(mixedCase).map((t) => [t.toLowerCase(), t]));
  const show = (ws: readonly string[]) => ws.map((w) => cased.get(w) ?? w).join(" ");

  return {
    query: query.join(" "),
    title: show(shown),
    head: show(shown.slice(-2)),
    full: show(full),
    words: clean(tokens, { keepLayout: true, stripUsability: false }),
  };
}
