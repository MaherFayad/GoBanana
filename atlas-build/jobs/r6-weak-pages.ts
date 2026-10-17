/**
 * Refinement R6, task B: page fit (J4b) where the weak domains are thin. J4b judged each domain on 12
 * pages (domainPages: Bench brief pages, name matches, then core pages), so telecom never got its
 * sign-up, bill payment or plan comparison pages and real estate never got search, the map or
 * booking a viewing; it got a paywall and a hotel page instead. A brief on an unjudged page bends on
 * the domain fit alone (the lead is any fit 3 card and the mechanic falls back to the page's own
 * parts): on the R6 briefs, telecom sign-up led with a gauge dial hero and the rental search with an
 * empty state.
 *
 * This job scores the cards each of these domains already has page fit for (J4b's top cards and the
 * R1 Gulf leads) on the pages its products use most that J4b skipped, with J4b's own prompt, parse
 * and cached prefix (Opus, batch). Existing pairs are never rejudged: R1's joint rejudge of these
 * domains flattened their 3s and was dropped (r1-gulf-page-fit.ts WEAK_DOMAINS). Calibration as R1
 * did for the Gulf cards: each new page shows how the domain's cards scored on its nearest judged
 * page, and the new page is scored on that scale.
 *
 * Output: the whole page-fit kind with the new pairs added. A domain whose shard would pass the
 * size budget drops the score 1 rows of the new pages (the bend reads an unjudged card about as a 1).
 *
 *   needs out/v1/cards, out/v1/domains, out/v1/anatomy, out/v1/page-fit (after r1-weak-page-fit)
 *   npx tsx run.ts r6-weak-pages --dry
 */
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob } from "../lib/job.ts";
import { mergeByKey } from "../lib/refine.ts";
import type { DomainEntry, IngredientCard, PageAnatomy, PageFitScore } from "../schema.ts";
import j4b, { pageLine, type Input } from "./j4b-page-fit.ts";
import { PAGE_FIT_SHARD_BUDGET, pageFitKey } from "./r1-gulf-page-fit.ts";

/** Per weak domain: each page its products use that J4b did not judge, with the judged page closest to it (the scale anchor). */
export const NEW_PAGES: Record<string, Record<string, string>> = {
  telecom: {
    "sign-up": "onboarding",
    "otp-verification": "onboarding",
    "identity-verification": "onboarding",
    "bill-payment": "checkout",
    "plan-comparison": "plan-picker",
    "subscription-management": "app-home",
  },
  "food-delivery": {
    cart: "checkout",
    "order-confirmation": "order-tracking",
    search: "food-delivery-home",
  },
  "real-estate": {
    search: "property-listing",
    "search-results": "property-listing",
    "filters-sheet": "property-listing",
    "maps-directions": "property-listing",
    "appointment-booking": "property-listing",
    "loan-application": "pricing-page",
    wishlist: "app-home",
  },
};

const CALIBRATE = `

Added pages: this request scores the domain's cards on pages its first scoring skipped. They are listed in the request with their summaries (they may be missing from the page list above). For each new page the request shows how the same cards already scored on the closest judged page of this domain; score the new page on exactly that scale (about the same share of 3s and 2s), and judge each card against what the user does on the NEW page. A card that only suited the old page's job is 1 here.`;

let pfCache: PageFitScore[] | null = null;
const pageFit = () => (pfCache ??= readKindRecords<PageFitScore>("page-fit"));

/** The anchor block: per new page, how the cards scored on its closest judged page. */
export function anchorBlock(domainId: string, pages: readonly string[], rows: readonly PageFitScore[], anchors: Readonly<Record<string, string>>): string {
  const lines = pages.map((pageId, i) => {
    const near = anchors[pageId]!;
    const at = rows.filter((r) => r.domainId === domainId && r.pageId === near);
    const fmt = (r: PageFitScore) => `${r.cardId} (${r.reason ?? ""})`;
    const threes = at.filter((r) => r.score === 3).map(fmt);
    const twos = at.filter((r) => r.score === 2).slice(0, 8).map(fmt);
    return `${i + 1}. ${pageId}, closest judged page ${near}: 3: ${threes.join("; ") || "none"}. 2: ${twos.join("; ") || "none"}. ${at.filter((r) => r.score <= 1).length} of ${at.length} scored 1 or 0.`;
  });
  return ["How the domain's cards scored on the closest judged page (the scale to match):", ...lines].join("\n");
}

/** Drops the score 1 rows of the new pages in a domain whose page-fit shard would pass the budget. */
export function trimNewPages(records: PageFitScore[], fresh: ReadonlySet<string>, log: (line: string) => void, budget = PAGE_FIT_SHARD_BUDGET): PageFitScore[] {
  const bytes = new Map<string, number>();
  for (const r of records) bytes.set(r.domainId, (bytes.get(r.domainId) ?? 0) + Buffer.byteLength(JSON.stringify(r)) + 1);
  const over = new Set([...bytes].filter(([, b]) => b > budget).map(([d]) => d));
  if (over.size === 0) return records;
  const out = records.filter((r) => !(over.has(r.domainId) && fresh.has(pageFitKey(r)) && r.score <= 1));
  log(`  page-fit over ${budget} bytes in ${[...over].join(", ")}: dropped ${records.length - out.length} score 0 and 1 rows of the new pages`);
  return out;
}

export default defineJob<Input, PageFitScore>({
  id: "r6-weak-pages",
  kind: "page-fit",
  model: j4b.model,
  mode: j4b.mode,
  schema: j4b.schema,
  get system() {
    return j4b.system + CALIBRATE;
  },
  maxTokens: j4b.maxTokens,
  expectedOutputTokens: 9000,
  effort: j4b.effort,

  loadInputs: (ctx) => {
    const domains = readKindRecords<DomainEntry>("domains");
    const anatomy = new Set(readKindRecords<PageAnatomy>("anatomy").map((p) => p.id));
    const cards = new Map(readKindRecords<IngredientCard>("cards").map((c) => [c.id, c]));
    const out: Input[] = [];
    for (const [domainId, anchors] of Object.entries(NEW_PAGES)) {
      const domain = domains.find((d) => d.id === domainId);
      if (!domain) continue;
      const rows = pageFit().filter((r) => r.domainId === domainId);
      const judged = new Set(rows.map((r) => r.pageId));
      const pages = Object.keys(anchors).filter((p) => anatomy.has(p) && !judged.has(p));
      // The pool J4b and R1 already judged in this domain, in id order.
      const pool = [...new Set(rows.map((r) => r.cardId))].sort().map((id) => cards.get(id)).filter((c): c is IngredientCard => Boolean(c));
      if (pages.length && pool.length) out.push({ domain, cards: pool, pages });
    }
    ctx.log(`Inputs: ${out.map((i) => `${i.domain.id} ${i.cards.length} cards x ${i.pages.length} new pages`).join("; ")}`);
    return out;
  },
  requestId: (input) => `r6wp-${input.domain.id}`,
  buildPrompt: async (input, ctx) => {
    const pages = readKindRecords<PageAnatomy>("anatomy");
    const lines = input.pages.map((id) => pageLine(pages.find((p) => p.id === id)!));
    return [await j4b.buildPrompt(input, ctx), "", "The added pages (id, names, what it is, must keeps, wild spot elements):", ...lines, "", anchorBlock(input.domain.id, input.pages, pageFit(), NEW_PAGES[input.domain.id]!)].join("\n");
  },
  parse: (text, input) => j4b.parse!(text, input),
  check: (r, ctx) => j4b.check!(r, ctx),
  finalize: (records, ctx) => {
    const seen = new Set<string>();
    const mine = records.filter((r) => !seen.has(pageFitKey(r)) && seen.add(pageFitKey(r)));
    for (const d of Object.keys(NEW_PAGES)) {
      const xs = mine.filter((r) => r.domainId === d);
      if (xs.length) ctx.log(`  ${d}: ${xs.length} new pairs, scored 3: ${xs.filter((r) => r.score === 3).length}, 2: ${xs.filter((r) => r.score === 2).length}`);
    }
    const merged = mergeByKey(pageFit(), mine, pageFitKey);
    return trimNewPages(merged, new Set(mine.map(pageFitKey)), ctx.log).sort((a, b) => a.domainId.localeCompare(b.domainId) || a.pageId.localeCompare(b.pageId) || a.cardId.localeCompare(b.cardId));
  },
  shardOf: (r) => r.domainId,
});
