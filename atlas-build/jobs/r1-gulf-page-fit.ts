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
import { mergeByKey } from "../lib/refine.ts";
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
    return j4b.system;
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
  buildPrompt: (input, ctx) => j4b.buildPrompt(input, ctx),
  parse: (text, input) => j4b.parse!(text, input),
  check: (r, ctx) => j4b.check!(r, ctx),
  finalize: (records, ctx) => {
    const seen = new Set<string>();
    const mine = records.filter((r) => !seen.has(pageFitKey(r)) && seen.add(pageFitKey(r)));
    ctx.log(`  new pairs: ${mine.length}; scored 3: ${mine.filter((r) => r.score === 3).length}`);
    return mergeByKey(readKindRecords<PageFitScore>("page-fit"), mine, pageFitKey).sort(
      (a, b) => a.domainId.localeCompare(b.domainId) || a.pageId.localeCompare(b.pageId) || a.cardId.localeCompare(b.cardId),
    );
  },
  shardOf: (r) => r.domainId,
});
