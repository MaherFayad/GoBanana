/**
 * R1 element lines (refinement round 1, budget r1): J4 card-element lines (jobs/j4-elements.ts,
 * same prompt and cached prefix, Sonnet, batch) for the cards r1-gulf-cards added and the cards
 * r1-rewrite rewrote, so the bend's "how" lines match the cards as they are now.
 * Output: the whole card-elements kind; every line of these cards is replaced.
 *
 *   needs out/v1/cards, out/v1/card-audit (r1-audit), out/v1/card-elements (J4)
 *   npx tsx run.ts r1-lines --dry
 */
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob } from "../lib/job.ts";
import { mergeByKey } from "../lib/refine.ts";
import type { CardElementLine, IngredientCard } from "../schema.ts";
import j4Elements, { CARDS_PER_REQUEST } from "./j4-elements.ts";
import type { CardAudit } from "./r1-audit.ts";
import { newCards } from "./r1-gulf-fit.ts";

type Input = { n: number; cards: IngredientCard[] };

function targets(): IngredientCard[] {
  const audited = new Set(readKindRecords<CardAudit>("card-audit").map((a) => a.cardId));
  const rewritten = readKindRecords<IngredientCard>("cards").filter((c) => audited.has(c.id));
  // New cards first, then rewritten ones, each in id order, so adding rewrites never shifts the new cards' chunks.
  return [...newCards(), ...rewritten.sort((a, b) => a.id.localeCompare(b.id))];
}

export default defineJob<Input, CardElementLine>({
  id: "r1-lines",
  kind: "card-elements",
  model: j4Elements.model,
  mode: j4Elements.mode,
  schema: j4Elements.schema,
  system: j4Elements.system,
  maxTokens: j4Elements.maxTokens,
  expectedOutputTokens: j4Elements.expectedOutputTokens,
  effort: j4Elements.effort,

  loadInputs: () => {
    const all = targets();
    const out: Input[] = [];
    for (let i = 0; i < all.length; i += CARDS_PER_REQUEST) out.push({ n: out.length + 1, cards: all.slice(i, i + CARDS_PER_REQUEST) });
    return out;
  },
  requestId: (input) => `lines-${input.n}`,
  buildPrompt: (input, ctx) => j4Elements.buildPrompt(input, ctx),
  parse: (text, input) => j4Elements.parse!(text, input),
  finalize: (records, ctx) => {
    const key = (r: CardElementLine) => `${r.cardId}|${r.element}`;
    const seen = new Set<string>();
    const mine = records.filter((r) => !seen.has(key(r)) && seen.add(key(r)));
    ctx.log(`  lines: ${mine.length} for ${new Set(mine.map((r) => r.cardId)).size} cards`);
    return mergeByKey(readKindRecords<CardElementLine>("card-elements"), mine, key).sort((a, b) => a.cardId.localeCompare(b.cardId) || a.element.localeCompare(b.element));
  },
  shardOf: (r) => r.element,
});
