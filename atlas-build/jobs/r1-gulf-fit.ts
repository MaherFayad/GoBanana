/**
 * R1 Gulf depth, fit (refinement round 1, budget r1): J4 domain fit for the cards r1-gulf-cards
 * added, with J4's own prompt, parse and cached prefix (jobs/j4-fit.ts), on Sonnet, batch.
 * Output: the whole fit kind with the new cards' pairs added.
 *
 *   needs out/v1/cards (with the new cards), out/v1/domains, out/v1/fit (J4)
 *   npx tsx run.ts r1-gulf-fit --dry
 */
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob } from "../lib/job.ts";
import { j3CardIds, mergeByKey } from "../lib/refine.ts";
import type { FitScore, IngredientCard } from "../schema.ts";
import j4Fit, { CARDS_PER_REQUEST } from "./j4-fit.ts";

type Input = { n: number; cards: IngredientCard[] };

/** Cards that are not J3 cards: the ones r1-gulf-cards added. */
export function newCards(): IngredientCard[] {
  const j3 = j3CardIds();
  return readKindRecords<IngredientCard>("cards")
    .filter((c) => !j3.has(c.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export default defineJob<Input, FitScore>({
  id: "r1-gulf-fit",
  kind: "fit",
  model: j4Fit.model,
  mode: j4Fit.mode,
  schema: j4Fit.schema,
  get system() {
    return j4Fit.system;
  },
  maxTokens: j4Fit.maxTokens,
  expectedOutputTokens: j4Fit.expectedOutputTokens,
  effort: j4Fit.effort,

  loadInputs: () => {
    const all = newCards();
    const out: Input[] = [];
    for (let i = 0; i < all.length; i += CARDS_PER_REQUEST) out.push({ n: out.length + 1, cards: all.slice(i, i + CARDS_PER_REQUEST) });
    return out;
  },
  requestId: (input) => `gfit-${input.n}`,
  buildPrompt: (input, ctx) => j4Fit.buildPrompt(input, ctx),
  parse: (text, input) => j4Fit.parse!(text, input),
  check: (r, ctx) => j4Fit.check!(r, ctx),
  finalize: (records, ctx) => {
    const key = (r: FitScore) => `${r.cardId}|${r.domainId}`;
    const seen = new Set<string>();
    const mine = records.filter((r) => !seen.has(key(r)) && seen.add(key(r)));
    const domains = new Set(readKindRecords<{ id: string }>("domains").map((d) => d.id)).size;
    ctx.log(`  new pairs: ${mine.length} of ${newCards().length * domains}`);
    return mergeByKey(readKindRecords<FitScore>("fit"), mine, key).sort((a, b) => a.cardId.localeCompare(b.cardId) || a.domainId.localeCompare(b.domainId));
  },
  shardOf: (r) => r.domainId,
});
