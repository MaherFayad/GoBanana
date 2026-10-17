/**
 * R1 Gulf depth, page fit (refinement round 1, budget r1): J4b page fit for the cards r1-gulf-cards
 * added, with J4b's own prompt, parse and cached prefix (jobs/j4b-page-fit.ts), Opus, batch. Per
 * domain, the new cards that may lead there (J4 fit of 2 or more from r1-gulf-fit, rule and layout
 * cards left out) are scored on the domain's pages (domainPages). The bend counts a card J4b did not
 * judge two steps lower, so without this the new cards would never lead.
 *
 * The weak domains (government, travel, airline) are left to r1-weak-page-fit, which rejudges their
 * pages with the new cards in the pool.
 * Output: the whole page-fit kind with the new pairs added.
 *
 *   needs out/v1/cards, out/v1/fit (with r1-gulf-fit), out/v1/domains, out/v1/anatomy, out/v1/page-fit
 *   npx tsx run.ts r1-gulf-page-fit --dry
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isRuleCard } from "../../banana-server/lib/atlas/bend.ts";
import { ROOT } from "../config.ts";
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob } from "../lib/job.ts";
import { j3CardIds, mergeByKey } from "../lib/refine.ts";
import type { DomainEntry, FitScore, IngredientCard, PageAnatomy, PageFitScore } from "../schema.ts";
import j4b, { domainPages, type Input } from "./j4b-page-fit.ts";
import { newCards } from "./r1-gulf-fit.ts";

/** Domains whose pages r1-weak-page-fit rejudges in full (Qatar services and flight checkout boards). */
export const WEAK_DOMAINS = ["government", "travel", "airline"] as const;

export function readBenchBriefs(): Array<{ brief: string; pages?: string[] }> {
  const bench = join(ROOT, "..", "banana-server", "bench", "briefs.json");
  return existsSync(bench) ? ((JSON.parse(readFileSync(bench, "utf8")) as { briefs: Array<{ brief: string; pages?: string[] }> }).briefs ?? []) : [];
}

/** The new cards that may lead in a domain: J4 fit 2 or more, no rule or layout cards, in id order. */
export function newLeads(domainId: string, fit: readonly FitScore[], cards: readonly IngredientCard[]): IngredientCard[] {
  const ok = new Set(fit.filter((f) => f.domainId === domainId && f.score >= 2).map((f) => f.cardId));
  return cards.filter((c) => ok.has(c.id) && !isRuleCard(c));
}

/** A domain's page-fit is one server shard (lib/layout.ts), read whole: it stays under this many bytes. */
export const PAGE_FIT_SHARD_BUDGET = 98 * 1024;

/**
 * Keeps each domain's page-fit under PAGE_FIT_SHARD_BUDGET: in a domain over it, the score 1 rows of
 * the new cards go (tourism-culture took 46 new Gulf cards). The bend ranks an unjudged card about as
 * a page 1, so little changes; scores 0, 2 and 3 all stay.
 */
export function fitShardBudget(records: PageFitScore[], fresh: ReadonlySet<string>, log: (line: string) => void, budget = PAGE_FIT_SHARD_BUDGET): PageFitScore[] {
  const bytes = new Map<string, number>();
  for (const r of records) bytes.set(r.domainId, (bytes.get(r.domainId) ?? 0) + Buffer.byteLength(JSON.stringify(r)) + 1);
  const over = new Set([...bytes].filter(([, b]) => b > budget).map(([d]) => d));
  if (over.size === 0) return records;
  const out = records.filter((r) => !(over.has(r.domainId) && fresh.has(r.cardId) && r.score === 1));
  log(`  page-fit over ${budget} bytes in ${[...over].join(", ")}: dropped ${records.length - out.length} score 1 rows of new cards`);
  return out;
}

/**
 * Calibration (second run, 2026-10-17): the first run scored the new cards alone and gave 2 or 3 to
 * 27% of pairs against 18% for J4b's own top cards, so a thin Gulf card (rock carvings on an eSIM
 * plan picker) could outrank the cards J4b chose. Each request now shows how J4b already scored the
 * domain's J3 cards on these pages, and the new cards are scored on that scale.
 */
const CALIBRATE = `

Calibration requests: the cards in the request are new. The same pages were already scored for this domain's other cards; the request lists, per page, the cards that got 3 and 2 there with their reasons. Score the new cards on exactly that scale: a new card gets 3 only when it serves the page as clearly as the listed 3s, and 2 only when it is as good as the listed 2s. A card that is only a place, a heritage scene or a mood on this page is 1. Most new cards are 1 on most pages.`;

let anchorCache: PageFitScore[] | null = null;
/** How J4b scored the J3 cards on each page of the request: the 3s and up to 6 of the 2s, with reasons. */
export function anchorLines(input: Input): string {
  const j3 = j3CardIds();
  anchorCache ??= readKindRecords<PageFitScore>("page-fit").filter((r) => j3.has(r.cardId));
  const lines = input.pages.map((pageId, i) => {
    const rows = anchorCache!.filter((r) => r.domainId === input.domain.id && r.pageId === pageId);
    const fmt = (r: PageFitScore) => `${r.cardId} (${r.reason ?? ""})`;
    const threes = rows.filter((r) => r.score === 3).map(fmt);
    const twos = rows.filter((r) => r.score === 2).slice(0, 6).map(fmt);
    const low = rows.filter((r) => r.score <= 1).length;
    return `${i + 1}. ${pageId}: 3: ${threes.join("; ") || "none"}. 2: ${twos.join("; ") || "none"}. ${low} of ${rows.length} scored 1 or 0.`;
  });
  return ["How the domain's other cards already scored on these pages (the scale to match):", ...lines].join("\n");
}

export function pageFitKey(r: PageFitScore): string {
  return `${r.domainId}|${r.pageId}|${r.cardId}`;
}

export default defineJob<Input, PageFitScore>({
  id: "r1-gulf-page-fit",
  kind: "page-fit",
  model: j4b.model,
  mode: j4b.mode,
  schema: j4b.schema,
  get system() {
    return j4b.system + CALIBRATE;
  },
  maxTokens: j4b.maxTokens,
  expectedOutputTokens: 4000,
  effort: j4b.effort,

  loadInputs: (ctx) => {
    const domains = readKindRecords<DomainEntry>("domains").sort((a, b) => a.id.localeCompare(b.id));
    const pages = readKindRecords<PageAnatomy>("anatomy").sort((a, b) => a.id.localeCompare(b.id));
    const fit = readKindRecords<FitScore>("fit");
    const cards = newCards();
    const briefs = readBenchBriefs();
    const out: Input[] = [];
    for (const domain of domains) {
      if ((WEAK_DOMAINS as readonly string[]).includes(domain.id)) continue;
      const leads = newLeads(domain.id, fit, cards);
      if (leads.length > 0) out.push({ domain, cards: leads, pages: domainPages(domain, pages, domains, briefs) });
    }
    ctx.log(`Inputs: ${out.length} domains, ${out.reduce((n, i) => n + i.cards.length * i.pages.length, 0)} card and page pairs.`);
    return out;
  },
  requestId: (input) => `gpf-${input.domain.id}`,
  buildPrompt: async (input, ctx) => `${await j4b.buildPrompt(input, ctx)}\n\n${anchorLines(input)}`,
  parse: (text, input) => j4b.parse!(text, input),
  check: (r, ctx) => j4b.check!(r, ctx),
  finalize: (records, ctx) => {
    const seen = new Set<string>();
    const mine = records.filter((r) => !seen.has(pageFitKey(r)) && seen.add(pageFitKey(r)));
    ctx.log(`  new pairs: ${mine.length}; scored 3: ${mine.filter((r) => r.score === 3).length}`);
    const merged = mergeByKey(readKindRecords<PageFitScore>("page-fit"), mine, pageFitKey);
    return fitShardBudget(merged, new Set(mine.map((r) => r.cardId)), ctx.log).sort(
      (a, b) => a.domainId.localeCompare(b.domainId) || a.pageId.localeCompare(b.pageId) || a.cardId.localeCompare(b.cardId),
    );
  },
  shardOf: (r) => r.domainId,
});
