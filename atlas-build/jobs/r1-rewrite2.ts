/**
 * R1 second rewrite (refinement round 1, budget r1): the cards r1-recheck still flags are rewritten
 * once more, with r1-rewrite's prompt, prepare and checks. Runs after r1-rewrite in the rebuild order.
 * Output: the whole cards kind with these cards replaced.
 *
 *   needs out/v1/cards (after r1-rewrite), out/v1/card-audit-recheck (r1-recheck)
 *   npx tsx run.ts r1-rewrite2 --dry
 */
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob } from "../lib/job.ts";
import { mergeByKey } from "../lib/refine.ts";
import type { IngredientCard } from "../schema.ts";
import type { CardAudit } from "./r1-audit.ts";
import rewrite, { type Input } from "./r1-rewrite.ts";

export default defineJob<Input, IngredientCard>({
  ...rewrite,
  id: "r1-rewrite2",
  loadInputs: () => {
    const cards = new Map(readKindRecords<IngredientCard>("cards").map((c) => [c.id, c]));
    return readKindRecords<CardAudit>("card-audit-recheck")
      .filter((a) => cards.has(a.cardId))
      .sort((a, b) => a.cardId.localeCompare(b.cardId))
      .map((audit) => ({ card: cards.get(audit.cardId)!, audit }));
  },
  requestId: (input) => `rw2-${input.card.id}`.slice(0, 64),
  finalize: (rewrites, ctx) => {
    const merged = mergeByKey(readKindRecords<IngredientCard>("cards"), rewrites, (c) => c.id);
    ctx.log(`  rewritten again: ${rewrites.length}; cards: ${merged.length}`);
    return merged.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  },
});
