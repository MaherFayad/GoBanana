/**
 * J4b page fit (Gate 2 round 2, banana-server/bench/GATE2-DIAGNOSIS.md cause 5): how well a card can
 * lead one page of one domain, with a short specific reason. J4 (j4-fit.ts) scores a card per domain
 * only, so inside the right domain the lead card was generic ("Sport gear suits fitness" for a
 * surfboard on a fitness empty state). The bend (banana-server lib/atlas/bend.ts) reads this kind to
 * choose the lead card.
 *
 * Kept cheap: per domain only its top TOP_CARDS cards by J4 fit (rule and layout cards left out, since
 * they never lead), against at most MAX_PAGES pages that matter for it (domainPages). One request per
 * domain, Opus 5.5, batch, with every page summary in the cached prefix. Budget j4b in config.ts.
 *
 *   needs out/v1/cards (J3), out/v1/fit (J4), out/v1/domains (J2), out/v1/anatomy (J1)
 *   npx tsx run.ts j4b-page-fit --dry
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { contentWords, isRuleCard, parseDomain, parsePage } from "../../banana-server/lib/atlas/bend.ts";
import { cyrb53 } from "../../banana-server/lib/bend/prng.ts";
import { OPUS, ROOT } from "../config.ts";
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob } from "../lib/job.ts";
import { PROMPT_RULES } from "../lib/prompt.ts";
import { extractJson } from "../lib/validate.ts";
import { PageFitScoreSchema, type DomainEntry, type FitScore, type IngredientCard, type PageAnatomy, type PageFitScore } from "../schema.ts";
import { cardBrief } from "./j4-fit.ts";

/** Cards per domain: its best J4 fits that may lead. */
export const TOP_CARDS = 40;
/** Pages per domain. */
export const MAX_PAGES = 12;

/** Pages most products of any domain ship, in the order they fill a domain's list. */
export const CORE_PAGES = ["landing-page", "onboarding", "app-home", "empty-state", "checkout", "pricing-page", "plan-picker", "offers-page", "paywall", "success-screen", "search-results", "product-detail"] as const;

/** Words of a page or domain name that say nothing about the domain on their own. */
const GENERIC = new Set(["home", "page", "screen", "app", "detail", "list", "listing", "flow", "state", "view", "dashboard", "settings", "search", "result", "plan", "form"]);

type Brief = { brief: string; pages?: string[] };

/** A card may lead: J4 fit order (score, then a stable hash per domain), rule and layout cards left out. */
export function topCards(fit: readonly FitScore[], cards: ReadonlyMap<string, IngredientCard>, domainId: string, n = TOP_CARDS): IngredientCard[] {
  return fit
    .filter((f) => f.domainId === domainId && f.score >= 2)
    .map((f) => ({ f, c: cards.get(f.cardId) }))
    .filter((x): x is { f: FitScore; c: IngredientCard } => Boolean(x.c) && !isRuleCard(x.c!))
    .sort((a, b) => b.f.score - a.f.score || (cyrb53(`${domainId}|${a.c.id}`) % 1000) - (cyrb53(`${domainId}|${b.c.id}`) % 1000) || a.c.id.localeCompare(b.c.id))
    .slice(0, n)
    .map((x) => x.c);
}

/**
 * The pages that matter for a domain, at most `max`: first the pages the Banana Bench briefs of the
 * domain name (parsed with the bend's own parsePage and parseDomain), then pages whose names share a
 * content word with the domain's own names ("flight checkout" for "flights and travel"), then the
 * core pages most products ship. Product nouns are left out of the match: they name parts ("card",
 * "order", "bill") that pull in unrelated pages.
 */
export function domainPages(domain: DomainEntry, pages: readonly PageAnatomy[], domains: readonly DomainEntry[], briefs: readonly Brief[], max = MAX_PAGES): string[] {
  const out: string[] = [];
  const add = (id: string) => {
    if (out.length < max && !out.includes(id) && pages.some((p) => p.id === id)) out.push(id);
  };
  for (const b of briefs) {
    const page = parsePage(b.pages?.[0] ?? b.brief, pages) ?? parsePage(b.brief, pages);
    const d = page ? parseDomain(b.brief, domains, page) : null;
    if (page && d?.domain.id === domain.id) add(page.id);
  }
  const want = new Set(domain.names.en.flatMap(contentWords).filter((w) => !GENERIC.has(w)));
  for (const p of pages) {
    const pw = [...p.names.en, p.id.replace(/-/g, " ")].flatMap(contentWords).filter((w) => !GENERIC.has(w));
    if (pw.some((w) => want.has(w))) add(p.id);
  }
  for (const id of CORE_PAGES) add(id);
  return out;
}

export type Input = { domain: DomainEntry; cards: IngredientCard[]; pages: string[] };

let cache: { domains: DomainEntry[]; pages: PageAnatomy[]; cards: Map<string, IngredientCard>; fit: FitScore[] } | null = null;
function atlas() {
  cache ??= {
    domains: readKindRecords<DomainEntry>("domains").sort((a, b) => a.id.localeCompare(b.id)),
    pages: readKindRecords<PageAnatomy>("anatomy").sort((a, b) => a.id.localeCompare(b.id)),
    cards: new Map(readKindRecords<IngredientCard>("cards").map((c) => [c.id, c])),
    fit: readKindRecords<FitScore>("fit"),
  };
  return cache;
}

/** The Banana Bench briefs (the J8 brief set parses to too many wrong domains to name pages). */
function readBriefs(): Brief[] {
  const out: Brief[] = [];
  const bench = join(ROOT, "..", "banana-server", "bench", "briefs.json");
  if (existsSync(bench)) out.push(...((JSON.parse(readFileSync(bench, "utf8")) as { briefs: Brief[] }).briefs ?? []));
  return out;
}

let used: PageAnatomy[] | null = null;
/** Every page some domain is scored on, in id order (the cached prefix lists only these). */
function usedPages(): PageAnatomy[] {
  if (!used) {
    const { domains, pages } = atlas();
    const briefs = readBriefs();
    const ids = new Set(domains.flatMap((d) => domainPages(d, pages, domains, briefs)));
    used = pages.filter((p) => ids.has(p.id));
  }
  return used;
}

const firstSentence = (s: string) => (/^.*?[.!?](?=\s|$)/.exec(s.trim())?.[0] ?? s.trim());

/** One page in a line: what the user does there, what it must keep and where it can go wild. */
export function pageLine(p: PageAnatomy): string {
  return `- ${p.id} (${p.names.en.slice(0, 2).join(", ")}): ${firstSentence(p.baseline)} Must keep: ${p.mustKeep.slice(0, 3).join("; ") || "none"}. Wild spots: ${p.wildSpots.map((w) => w.element).join(", ") || "none"}.`;
}

const system = () => `You judge which GoBanana ingredient card should LEAD the design of one page for one product domain. GoBanana bends one app or web page into a wild but buildable direction; the lead card (a surprising object, material, era or tradition with its own palette, type, texture and motion) sets the look of that page. All cards you see already fit the domain; your job is the page: does the card serve what the user does on THIS page?

${PROMPT_RULES}

Scores, for one card on one page of one domain:
- 3: it can lead this page. The card's world speaks to the page's job or its wild spot (a split-flap board on flight results, a ledger tick on onboarding steps, a coffee cupping card on a coffee landing page), and a team would build it.
- 2: fits the page; a clear bridge, but it would suit many pages of the domain the same way.
- 1: only decoration here, or a stretch for this page.
- 0: it fights the page's job (hides the price on a pricing page, slows a checkout, playful where the page needs trust).
Be strict: on one page, most cards are 1 or 2, and only the few cards that truly speak to the page get 3.

reason: only for scores 2 and 3, 3 to 8 plain words naming what on the page the card serves ("split-flap rows show fare changes", "cupping notes as the menu"). Never generic ("suits coffee", "fits the brand"). No em dashes.

The pages (id, names, what it is, must keeps, wild spot elements):
${usedPages().map(pageLine).join("\n")}

Reply with one \`\`\`json block: {"cards": [{"n": <card number>, "p": {"<page number>": [<score>, "<reason>"] or <score>}}]}. A score of 2 or 3 is a [score, reason] pair; 0 and 1 are a bare number. Score every card on every page listed in the request.`;

export default defineJob<Input, PageFitScore>({
  id: "j4b-page-fit",
  kind: "page-fit",
  model: OPUS,
  mode: "batch",
  schema: PageFitScoreSchema,
  get system() {
    return system();
  },
  maxTokens: 32000,
  expectedOutputTokens: 9000,
  effort: "low",

  loadInputs: (ctx) => {
    const { domains, pages, cards, fit } = atlas();
    const briefs = readBriefs();
    const out: Input[] = [];
    for (const domain of domains) {
      const top = topCards(fit, cards, domain.id);
      if (top.length === 0) continue;
      out.push({ domain, cards: top, pages: domainPages(domain, pages, domains, briefs) });
    }
    ctx.log(`Inputs: ${out.length} domains, ${out.reduce((n, i) => n + i.cards.length * i.pages.length, 0)} card and page pairs (${briefs.length} briefs read for the pages).`);
    return out;
  },
  requestId: (input) => `pf-${input.domain.id}`,
  buildPrompt: (input) =>
    [
      `Domain: ${input.domain.id} (${input.domain.names.en.slice(0, 3).join(", ")}). Products: ${input.domain.productNouns.slice(0, 8).join(", ")}. Audience: ${firstSentence(input.domain.audience)}${input.domain.regionNotes ? ` Region: ${firstSentence(input.domain.regionNotes)}` : ""}`,
      "",
      `Pages (score each card on each):`,
      ...input.pages.map((id, i) => `${i + 1}. ${id}`),
      "",
      `Cards:`,
      ...input.cards.map((c, i) => `${i + 1}. ${cardBrief(c)}`),
    ].join("\n"),

  parse: (text, input) => {
    const v = extractJson(text) as { cards?: Array<{ n?: number; p?: Record<string, unknown> }> };
    const out: unknown[] = [];
    for (const row of v.cards ?? []) {
      const card = input.cards[Number(row.n) - 1];
      if (!card) continue;
      for (const [key, val] of Object.entries(row.p ?? {})) {
        const pageId = input.pages[Number(key) - 1] ?? (input.pages.includes(key) ? key : undefined);
        if (!pageId) continue;
        const score = Array.isArray(val) ? val[0] : val;
        const reason = Array.isArray(val) && typeof val[1] === "string" && Number(score) >= 2 ? val[1].trim() : undefined;
        out.push({ cardId: card.id, domainId: input.domain.id, pageId, score, ...(reason ? { reason } : {}) });
      }
    }
    return out;
  },
  check: (r) => (r.score === 3 && !r.reason ? ["a score of 3 needs a reason"] : []),
  finalize: (records, ctx) => {
    const seen = new Set<string>();
    const out = records.filter((r) => {
      const k = `${r.domainId}|${r.pageId}|${r.cardId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const threes = out.filter((r) => r.score === 3).length;
    ctx.log(`  pairs: ${out.length}; scored 3: ${threes} (${((100 * threes) / Math.max(1, out.length)).toFixed(1)}%)`);
    return out.sort((a, b) => a.domainId.localeCompare(b.domainId) || a.pageId.localeCompare(b.pageId) || a.cardId.localeCompare(b.cardId));
  },
  shardOf: (r) => r.domainId,
});
