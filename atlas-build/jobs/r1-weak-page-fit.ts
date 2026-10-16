/**
 * R1 weak domains (refinement round 1, budget r1): the Qatar services and flight checkout boards
 * were the weakest in Gate 2 (banana-server/bench/GATE2-DIAGNOSIS.md, round 3). This rejudges J4b
 * page fit for every page of their domains (government, travel, airline) with a stricter prompt:
 * a reason must name the page part the card changes in the page's own words and the user's task
 * there, never the protected total, pay button or legal text, and Opus thinks harder (effort high).
 * The pool is J4b's top cards plus the new Gulf cards that fit the domain (r1-gulf-fit), so a Gulf
 * brief on these pages can lead with a Gulf card.
 * Output: the whole page-fit kind with these domains' pairs replaced.
 *
 *   needs out/v1/cards, out/v1/fit (with r1-gulf-fit), out/v1/domains, out/v1/anatomy, out/v1/page-fit
 *   npx tsx run.ts r1-weak-page-fit --dry
 */
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob } from "../lib/job.ts";
import { j3CardIds, mergeByKey } from "../lib/refine.ts";
import type { DomainEntry, FitScore, IngredientCard, PageAnatomy, PageFitScore } from "../schema.ts";
import j4b, { domainPages, topCards, type Input } from "./j4b-page-fit.ts";
import { newCards } from "./r1-gulf-fit.ts";
import { WEAK_DOMAINS, newLeads, pageFitKey, readBenchBriefs } from "./r1-gulf-page-fit.ts";

const ADDENDUM = `

Rejudge request: the boards built from earlier scores for this domain were weak, because many reasons named a mood or a generic part ("stripe band marks step", "arrows on service tiles"). Judge again, stricter:
- A reason names the exact part of THIS page the card changes, in the page's own words, and what the user does there: "seat map rows as flight strips", "fine list as stamped notices", "ID renewal steps as routing slips", "bag add-on rows as luggage tags". Never only a mood, a color or "hero".
- Aim at the page's wild spots and supporting parts. The money total, the main pay or submit button, prices on the plan cards and legal or consent text stay plain; a card that only works by restyling them scores 1.
- 3 only when a product team for this domain would ship it on this page and a user would understand the page faster or trust it more; most cards are 1 or 2.
- Region: some cards belong to one Gulf place (a name with Najdi, Emirati, Qatari, Omani, ...). The engine matches places to briefs separately, and Gulf briefs on these pages need Gulf cards that work. So judge a Gulf or Arabic card by whether its grammar maps to a part of this page (a seal as the request stamp, a parapet rhythm as the service grid, a station line as the checkout steps), exactly as you judge any other card. Heritage used only as a backdrop or hero picture is 1; a real mapping earns 2 or 3.`;

/** Every card that may lead in a weak domain: J4b's J3 top cards plus the new Gulf cards that fit it. */
export function weakPool(domainId: string, fit: readonly FitScore[], all: readonly IngredientCard[]): IngredientCard[] {
  const j3 = j3CardIds();
  const top = topCards(fit, new Map(all.filter((c) => j3.has(c.id)).map((c) => [c.id, c])), domainId);
  return [...top, ...newLeads(domainId, fit, newCards())];
}

export default defineJob<Input, PageFitScore>({
  id: "r1-weak-page-fit",
  kind: "page-fit",
  model: j4b.model,
  mode: j4b.mode,
  schema: j4b.schema,
  get system() {
    return j4b.system + ADDENDUM;
  },
  maxTokens: 48000,
  expectedOutputTokens: 20000,
  effort: "high",

  loadInputs: (ctx) => {
    const domains = readKindRecords<DomainEntry>("domains").sort((a, b) => a.id.localeCompare(b.id));
    const pages = readKindRecords<PageAnatomy>("anatomy").sort((a, b) => a.id.localeCompare(b.id));
    const fit = readKindRecords<FitScore>("fit");
    const cards = readKindRecords<IngredientCard>("cards");
    const briefs = readBenchBriefs();
    const out: Input[] = [];
    for (const id of WEAK_DOMAINS) {
      const domain = domains.find((d) => d.id === id);
      if (!domain) continue;
      out.push({ domain, cards: weakPool(id, fit, cards), pages: domainPages(domain, pages, domains, briefs) });
    }
    ctx.log(`Inputs: ${out.map((i) => `${i.domain.id} ${i.cards.length} cards x ${i.pages.length} pages`).join("; ")}`);
    return out;
  },
  requestId: (input) => `wpf-${input.domain.id}`,
  buildPrompt: (input, ctx) => j4b.buildPrompt(input, ctx),
  parse: (text, input) => j4b.parse!(text, input),
  check: (r, ctx) => j4b.check!(r, ctx),
  finalize: (records, ctx) => {
    const seen = new Set<string>();
    const mine = records.filter((r) => !seen.has(pageFitKey(r)) && seen.add(pageFitKey(r)));
    const doms = new Set(mine.map((r) => r.domainId));
    // These domains are judged anew: their old pairs go, so a card that left the pool keeps no stale score.
    const base = readKindRecords<PageFitScore>("page-fit").filter((r) => !doms.has(r.domainId));
    ctx.log(`  rejudged pairs: ${mine.length} in ${[...doms].join(", ")}; scored 3: ${mine.filter((r) => r.score === 3).length}`);
    return mergeByKey(base, mine, pageFitKey).sort((a, b) => a.domainId.localeCompare(b.domainId) || a.pageId.localeCompare(b.pageId) || a.cardId.localeCompare(b.cardId));
  },
  shardOf: (r) => r.domainId,
});
