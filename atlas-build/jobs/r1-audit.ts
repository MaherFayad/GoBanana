/**
 * R1 card audit, step 1 (refinement round 1, budget r1): an Opus critic reads all 755 J3 cards in
 * chunks and flags the ones that are vague, generic, unbuildable, incoherent, or that break the
 * culture rules (banana-plugin/skills/gobanana-culture): a tradition not named exactly, sacred text
 * as decoration, a flag or emblem as texture, a wrong or missing credit, the wrong region, a
 * tourist cliche, a fact the critic is not sure of. Cards that pass are not listed.
 *
 * Output: out/v1/card-audit (build only, the server never reads it), one record per flagged card.
 * r1-rewrite.ts rewrites the flagged cards. A flag's card id is checked against the whole J3 set,
 * not the request's chunk, so chunk order never loses a flag.
 *
 *   needs out/v1/cards (J3)
 *   npx tsx run.ts r1-audit --dry
 */
import { z } from "zod";
import { OPUS } from "../config.ts";
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob } from "../lib/job.ts";
import { PROMPT_RULES } from "../lib/prompt.ts";
import { cardForPrompt, j3CardIds } from "../lib/refine.ts";
import { escapeHtml } from "../lib/review.ts";
import { extractJson } from "../lib/validate.ts";
import type { IngredientCard } from "../schema.ts";
import { SYSTEM as J3_SYSTEM } from "./j3-cards.ts";

export const CARDS_PER_REQUEST = 20;

export const AUDIT_TAGS = [
  "vague", "generic", "unbuildable", "incoherent", "weak-copy",
  "culture-name", "sacred", "flag-emblem", "credit", "region", "cliche", "fact", "fake-script",
] as const;

export const CardAuditSchema = z.object({
  cardId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  tags: z.array(z.enum(AUDIT_TAGS)).min(1),
  problems: z.array(z.string().min(1)).min(1).max(6),
  fix: z.string().min(1),
});
export type CardAudit = z.infer<typeof CardAuditSchema>;

type Input = { n: number; cards: IngredientCard[] };

let cardsCache: IngredientCard[] | null = null;
const cards = () => (cardsCache ??= readKindRecords<IngredientCard>("cards").filter((c) => j3CardIds().has(c.id)).sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)));

const SYSTEM = `You are the critic for GoBanana's ingredient cards. Each card turns one surprising word into a whole visual system (palette, type, texture, imagery, motion) that leads the design of one app or web page. Below is the full brief the cards were written to. Read each card against it and flag only the cards with a real problem a careful design lead or a cultural reviewer would send back.

${PROMPT_RULES}

Flag a card when it is:
- vague: the idea, texture, imagery or motion does not say what to build ("a warm feel", "subtle texture", "elegant motion"), so two designers would make different things.
- generic: nothing in it belongs to the word; swap the name and it would read the same (a cream and charcoal palette with Inter on a card about a carnival).
- unbuildable: the texture or motion needs heavy custom work for little gain, hurts reading or contrast, hides state, or breaks a real UI rule (text over busy art, motion that never stops, a 2000 ms bounce).
- incoherent: palette, type, texture and motion do not belong to the same thing.
- weak-copy: the idea or surprise is filler, repeats itself, or the avoid list is generic ("avoid clutter").
- culture-name: a tradition, craft, script or culture named loosely ("Islamic art", "Arabic pattern", "African print", "Asian style", "tribal") instead of exactly (the tradition, the region, the people who make it, the medium).
- sacred: religious text or symbols (Quran verses, the shahada, names of God, mosque or Kaaba imagery, prophets, crosses, deities, temple imagery) used as decoration, texture, pattern or imagery.
- flag-emblem: a national flag, its color set read as a flag, a coat of arms, a national emblem, a royal or state seal, or a currency emblem used as decoration or texture.
- credit: culturalNotes missing where the card draws on a living culture, no "Credit:" line, a credit that names no people or tradition, or a credit given to the wrong people.
- region: the wrong region (a Levant, Maghreb, Turkish or Iranian thing marked gulf; a Gulf thing marked mena), or a card that mixes regions as if they were one.
- cliche: tourist shorthand for a culture (camels, dunes, oil, lanterns, "Arabian Nights" lettering, generic arabesque, sombreros, geishas, tribal masks), unless the word itself is that thing and the card treats it with care.
- fact: a claim you believe is wrong or cannot stand behind (a UNESCO listing, a date, a place, a maker, a meaning given to a motif whose meaning is not documented).
- fake-script: Arabic or another script used as random letters, pattern or fake lettering, or calligraphy that does not carry real words chosen with the user.

Do not flag a card for taste alone, for a font you would not pick, or for small wording. A typical chunk of 20 has 2 to 5 flagged cards; flag more only when they are truly there. Be most careful with tradition cards and anything Gulf or Arabic: those are checked by people from that culture.

For each flagged card write:
- tags: one or more of: ${AUDIT_TAGS.join(", ")}.
- problems: 1 to 4 short, specific sentences, each naming the field and what is wrong ("texture: 'subtle woven feel' says nothing to build", "culturalNotes: credits Moroccan artisans for a Tunisian craft").
- fix: one or two sentences on what the rewrite should do, concrete enough to act on ("Name it as Al Sadu weaving of Bedouin women of Kuwait and Saudi Arabia; make the texture a 12 px band strip under the header only").

Reply with one \`\`\`json block: {"flags": [{"id": "<card id>", "tags": [...], "problems": [...], "fix": "..."}]}. List only flagged cards. An empty list is fine.

The brief the cards were written to:

<brief>
${J3_SYSTEM}
</brief>`;

export default defineJob<Input, CardAudit>({
  id: "r1-audit",
  kind: "card-audit",
  model: OPUS,
  mode: "batch",
  schema: CardAuditSchema,
  system: SYSTEM,
  maxTokens: 32000,
  expectedOutputTokens: 7000,
  effort: "medium",

  loadInputs: () => {
    const all = cards();
    const out: Input[] = [];
    for (let i = 0; i < all.length; i += CARDS_PER_REQUEST) out.push({ n: out.length + 1, cards: all.slice(i, i + CARDS_PER_REQUEST) });
    return out;
  },
  requestId: (input) => `audit-${input.n}`,
  buildPrompt: (input) => `Audit these ${input.cards.length} cards.\n\n${input.cards.map((c) => "```json\n" + JSON.stringify(cardForPrompt(c)) + "\n```").join("\n\n")}`,

  parse: (text) => {
    const v = extractJson(text) as { flags?: Array<{ id?: string; tags?: unknown; problems?: unknown; fix?: unknown }> };
    const ids = j3CardIds();
    return (v.flags ?? []).filter((f) => typeof f.id === "string" && ids.has(f.id)).map((f) => ({ cardId: f.id, tags: f.tags, problems: f.problems, fix: f.fix }));
  },
  finalize: (records, ctx) => {
    const byId = new Map<string, CardAudit>();
    for (const r of records) if (!byId.has(r.cardId)) byId.set(r.cardId, r);
    const out = [...byId.values()].sort((a, b) => a.cardId.localeCompare(b.cardId));
    const tagCount = new Map<string, number>();
    for (const r of out) for (const t of r.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    ctx.log(`  flagged: ${out.length} of ${cards().length}; tags: ${[...tagCount].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(", ")}`);
    return out;
  },
  renderReview: (r) => {
    const a = r as CardAudit;
    return `<h3>${escapeHtml(a.cardId)}</h3><p><b>${escapeHtml(a.tags.join(", "))}</b></p><ul>${a.problems.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul><p>fix: ${escapeHtml(a.fix)}</p>`;
  },
});
