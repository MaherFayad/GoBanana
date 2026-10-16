/**
 * R1 Gulf depth, check (refinement round 1, budget r1): the r1-audit critic, with a stricter fact
 * check, over the cards r1-gulf-cards added. Gulf and Arabic cards are read by people from that
 * culture, so a wrong name, place, date or credit is worse than a dull texture. Flags go to
 * out/v1/card-audit-gulf (build only); r1-rewrite rewrites them with the J3 flags.
 *
 *   needs out/v1/cards (with the new cards)
 *   npx tsx run.ts r1-gulf-audit --dry
 */
import { OPUS } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { cardForPrompt } from "../lib/refine.ts";
import { extractJson } from "../lib/validate.ts";
import type { IngredientCard } from "../schema.ts";
import audit, { CARDS_PER_REQUEST, SYSTEM as AUDIT_SYSTEM, type CardAudit } from "./r1-audit.ts";
import { newCards } from "./r1-gulf-fit.ts";

type Input = { n: number; cards: IngredientCard[] };

const SYSTEM = `${AUDIT_SYSTEM}

This request: new Gulf and Arabic cards. Check every fact line by line as a historian of the Gulf would: the Arabic name and its spelling, the place (country, Saudi region, town), dates, UNESCO listings, who makes or made the thing, what it is made of and how it is used, and whether the meaning given is documented. Check that the name carries the right place word, that nothing reads as a flag, emblem or religious symbol, that occasions (Ramadan, Eid) are treated with care, and that the card is not a near duplicate of another card in the chunk. Flag a fact you are not sure of as "fact" and say what to remove or soften. Expect more flags than usual if the facts are loose; none if they are sound.`;

export default defineJob<Input, CardAudit>({
  id: "r1-gulf-audit",
  kind: "card-audit-gulf",
  model: OPUS,
  mode: "batch",
  schema: audit.schema,
  system: SYSTEM,
  maxTokens: 32000,
  expectedOutputTokens: 9000,
  effort: "high",

  loadInputs: () => {
    const all = newCards();
    const out: Input[] = [];
    for (let i = 0; i < all.length; i += CARDS_PER_REQUEST) out.push({ n: out.length + 1, cards: all.slice(i, i + CARDS_PER_REQUEST) });
    return out;
  },
  requestId: (input) => `gaudit-${input.n}`,
  buildPrompt: (input, ctx) => audit.buildPrompt(input, ctx),
  parse: (text) => {
    const v = extractJson(text) as { flags?: Array<{ id?: string; tags?: unknown; problems?: unknown; fix?: unknown }> };
    const ids = new Set(newCards().map((c) => c.id));
    return (v.flags ?? [])
      .filter((f) => typeof f.id === "string" && ids.has(f.id))
      .map((f) => ({ cardId: f.id, tags: f.tags, problems: f.problems, fix: typeof f.fix === "string" && f.fix ? f.fix : "Fix every problem listed, keeping what works." }));
  },
  finalize: (records, ctx) => {
    const byId = new Map<string, CardAudit>();
    for (const r of records) if (!byId.has(r.cardId)) byId.set(r.cardId, r);
    const out = [...byId.values()].sort((a, b) => a.cardId.localeCompare(b.cardId));
    ctx.log(`  flagged: ${out.length} of ${newCards().length}`);
    return out;
  },
  renderReview: audit.renderReview,
});
