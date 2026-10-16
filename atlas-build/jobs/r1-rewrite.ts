/**
 * R1 card audit, step 2 (refinement round 1, budget r1): every card the r1-audit critic flagged is
 * rewritten by Opus with the J3 brief as the cached prefix, the critic's problems and fix, and the
 * old card. The id, kind and family stay; the region changes only when the critic flagged it.
 *
 * Output: the whole cards kind, with each rewritten card in place of the old one (lib/refine.ts
 * mergeByKey). A rewrite that fails the schema or the J3 checks leaves the old card in place and is
 * listed in rejects/r1-rewrite.jsonl.
 *
 *   needs out/v1/cards (J3 and r1-gulf-cards), out/v1/card-audit (r1-audit), out/v1/card-audit-gulf (r1-gulf-audit)
 *   npx tsx run.ts r1-rewrite --dry
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { OPUS, PATHS } from "../config.ts";
import { readKindRecords } from "../lib/atlas-read.ts";
import type { FontIndex } from "../lib/fonts.ts";
import { defineJob, withShipPairs } from "../lib/job.ts";
import { cardForPrompt, mergeByKey } from "../lib/refine.ts";
import { extractJson } from "../lib/validate.ts";
import { IngredientCardSchema, type IngredientCard } from "../schema.ts";
import { SYSTEM as J3_SYSTEM, canonicalFont, check } from "./j3-cards.ts";
import type { CardAudit } from "./r1-audit.ts";

type Input = { card: IngredientCard; audit: CardAudit };

const SYSTEM = `${J3_SYSTEM}

Rewrite requests: a critic flagged an existing card. You get the card, the critic's problems and the fix it asks for. Write the whole card again so every problem is gone, keeping what was good. Keep the same word and the same kind and family. Keep the name unless the critic says the name itself is loose or wrong (a tradition named only as "Islamic art"), then name it exactly. When the card cannot be made respectful or accurate (it rests on sacred text, a flag or a fact you cannot stand behind), turn it into the nearest sound card on the same word, for example the craft's construction grammar instead of its sacred content, and say so in culturalNotes. Reply with {"cards": [the one card], "dropped": []}.`;

/**
 * Cards that stay region "gulf" whatever the critic says about region: square Kufic carries
 * GoBanana's Gulf "kufic" lens; its rewrite still fixes the credit (Iranian and Central Asian banna'i
 * brickwork). Mashrabiya is not kept: its rewrite credits the turners of Cairo and is now "mena"
 * (the Gulf form is the Hejazi rawashin card), although banana-server lib/bend/market.ts still lists
 * it as a Gulf tradition for the word-list path.
 */
const KEEP_GULF = new Set(["square-kufic-lettering"]);

/** Request ids stay unique and within 64 characters. */
const requestId = (cardId: string) => `rw-${cardId}`.slice(0, 64);

function prepare(raw: unknown, input: Input, ctx: { fonts: () => FontIndex }): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = { ...(raw as Record<string, unknown>) };
  delete r.word;
  const old = input.card;
  r.id = old.id;
  r.kind = old.kind;
  r.family = old.family;
  if (!input.audit.tags.includes("region") || KEEP_GULF.has(old.id)) {
    if (old.region) r.region = old.region;
    else delete r.region;
  }
  if (r.region === "south-east-asia") r.region = "southeast-asia";
  const t = r.type as { latin?: Record<string, unknown>; arabic?: Record<string, unknown> } | undefined;
  if (t?.latin && t.arabic) {
    const fonts = ctx.fonts();
    for (const slot of [t.latin, t.arabic]) {
      slot.display = canonicalFont(slot.display, fonts);
      slot.body = canonicalFont(slot.body, fonts);
    }
  }
  if (typeof r.culturalNotes === "string" && !r.culturalNotes.trim()) delete r.culturalNotes;
  return withShipPairs(r);
}

export default defineJob<Input, IngredientCard>({
  id: "r1-rewrite",
  kind: "cards",
  model: OPUS,
  mode: "batch",
  schema: IngredientCardSchema,
  system: SYSTEM,
  maxTokens: 16000,
  expectedOutputTokens: 3500,
  effort: "medium",

  loadInputs: () => {
    const cards = new Map(readKindRecords<IngredientCard>("cards").map((c) => [c.id, c]));
    // J3 flags (r1-audit) and flags on the new Gulf cards (r1-gulf-audit, once it has run).
    const gulf = existsSync(join(PATHS.out, "card-audit-gulf")) ? readKindRecords<CardAudit>("card-audit-gulf") : [];
    return [...readKindRecords<CardAudit>("card-audit"), ...gulf]
      .filter((a) => cards.has(a.cardId))
      .sort((a, b) => a.cardId.localeCompare(b.cardId))
      .map((audit) => ({ card: cards.get(audit.cardId)!, audit }));
  },
  requestId: (input) => requestId(input.card.id),
  buildPrompt: (input) =>
    [
      `Rewrite this ${input.card.kind} card. The word: "${input.card.name}". Kind: ${input.card.kind}. Family: "${input.card.family}".`,
      "",
      `Critic tags: ${input.audit.tags.join(", ")}`,
      `Problems:`,
      ...input.audit.problems.map((p) => `- ${p}`),
      `Fix: ${input.audit.fix}`,
      "",
      "The card now:",
      "```json",
      JSON.stringify(cardForPrompt(input.card), null, 1),
      "```",
    ].join("\n"),

  parse: (text) => {
    const v = extractJson(text) as { cards?: unknown[] } | unknown[];
    const list = Array.isArray(v) ? v : (v.cards ?? []);
    return list.slice(0, 1);
  },
  prepare: (raw, input, ctx) => prepare(raw, input, ctx),
  check,
  finalize: (rewrites, ctx) => {
    const base = readKindRecords<IngredientCard>("cards");
    const merged = mergeByKey(base, rewrites, (c) => c.id);
    ctx.log(`  rewritten: ${rewrites.length}; cards: ${merged.length}`);
    return merged.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  },
  shardOf: (card) => card.kind,
});
