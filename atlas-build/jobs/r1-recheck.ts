/**
 * R1 recheck (refinement round 1, budget r1): the same critic (r1-audit, effort high) reads every
 * card r1-rewrite rewrote, with the problems it was rewritten for, and flags the ones still wrong or
 * made worse. Flags go to out/v1/card-audit-recheck (build only); r1-rewrite2 rewrites them once more.
 *
 *   needs out/v1/cards (after r1-rewrite), out/v1/card-audit, out/v1/card-audit-gulf
 *   npx tsx run.ts r1-recheck --dry
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { OPUS, PATHS } from "../config.ts";
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob } from "../lib/job.ts";
import { cardForPrompt } from "../lib/refine.ts";
import { extractJson } from "../lib/validate.ts";
import type { IngredientCard } from "../schema.ts";
import audit, { SYSTEM as AUDIT_SYSTEM, type CardAudit } from "./r1-audit.ts";

export const RECHECK_PER_REQUEST = 15;

type Item = { card: IngredientCard; was: CardAudit };
type Input = { n: number; items: Item[] };

/** Every card r1-rewrite rewrote, with the flag it was rewritten for, in id order. */
export function rewritten(): Item[] {
  const flags = [...readKindRecords<CardAudit>("card-audit"), ...(existsSync(join(PATHS.out, "card-audit-gulf")) ? readKindRecords<CardAudit>("card-audit-gulf") : [])];
  const cards = new Map(readKindRecords<IngredientCard>("cards").map((c) => [c.id, c]));
  return flags
    .filter((f) => cards.has(f.cardId))
    .sort((a, b) => a.cardId.localeCompare(b.cardId))
    .map((was) => ({ card: cards.get(was.cardId)!, was }));
}

const SYSTEM = `${AUDIT_SYSTEM}

This request: recheck. Every card here was rewritten after an earlier review; you get the earlier problems with each card. Flag a card when an earlier problem is still there, when the rewrite brought a new problem (a new wrong fact, a lost place word, a palette that no longer leads, a texture that went vague), or when it now contradicts itself. Do not flag a card that fixed its problems, even if you would have written it differently. Most cards should pass.`;

export default defineJob<Input, CardAudit>({
  id: "r1-recheck",
  kind: "card-audit-recheck",
  model: OPUS,
  mode: "batch",
  schema: audit.schema,
  system: SYSTEM,
  maxTokens: 32000,
  expectedOutputTokens: 8000,
  effort: "high",

  loadInputs: () => {
    const all = rewritten();
    const out: Input[] = [];
    for (let i = 0; i < all.length; i += RECHECK_PER_REQUEST) out.push({ n: out.length + 1, items: all.slice(i, i + RECHECK_PER_REQUEST) });
    return out;
  },
  requestId: (input) => `recheck-${input.n}`,
  buildPrompt: (input) =>
    `Recheck these ${input.items.length} rewritten cards.\n\n${input.items
      .map((it) => `Earlier problems of ${it.card.id}: ${it.was.problems.join(" ")}\n\`\`\`json\n${JSON.stringify(cardForPrompt(it.card))}\n\`\`\``)
      .join("\n\n")}`,
  parse: (text, input) => {
    const v = extractJson(text) as { flags?: Array<{ id?: string; tags?: unknown; problems?: unknown; fix?: unknown }> };
    const ids = new Set(input.items.map((it) => it.card.id));
    return (v.flags ?? [])
      .filter((f) => typeof f.id === "string" && ids.has(f.id))
      .map((f) => ({ cardId: f.id, tags: f.tags, problems: f.problems, fix: typeof f.fix === "string" && f.fix ? f.fix : "Fix every problem listed, keeping what works." }));
  },
  finalize: (records, ctx) => {
    const byId = new Map<string, CardAudit>();
    for (const r of records) if (!byId.has(r.cardId)) byId.set(r.cardId, r);
    const out = [...byId.values()].sort((a, b) => a.cardId.localeCompare(b.cardId));
    ctx.log(`  still flagged: ${out.length} of ${rewritten().length}`);
    return out;
  },
  renderReview: audit.renderReview,
});
