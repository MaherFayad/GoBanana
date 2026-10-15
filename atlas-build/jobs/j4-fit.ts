/**
 * P1-J4 Fit matrix, part 1 (docs/next-step-plan.md 6.3): a FitScore for every card (J3) and domain
 * (J2) pair, on Sonnet, batch, with every domain in the cached prefix. Part 2 is j4-elements.ts;
 * both share the j4 budget.
 *
 * Each request scores CARDS_PER_REQUEST cards against all domains. The reply is compact JSON
 * ({"cards": [{"id", "fit": {"<domainId>": [score, reason]}}]}) that the script expands into one
 * FitScore record per pair, so the long record shape is never paid for in output tokens.
 *
 *   needs out/v1/cards/ (J3) and out/v1/domains/ (J2)
 *   npx tsx run.ts j4-fit --dry
 */
import { SONNET } from "../config.ts";
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob } from "../lib/job.ts";
import { PROMPT_RULES } from "../lib/prompt.ts";
import { extractJson } from "../lib/validate.ts";
import { FitScoreSchema, type DomainEntry, type FitScore, type IngredientCard } from "../schema.ts";

export const CARDS_PER_REQUEST = 8;

type Input = { n: number; cards: IngredientCard[] };

let domainsCache: DomainEntry[] | null = null;
const domains = () => (domainsCache ??= readKindRecords<DomainEntry>("domains").sort((a, b) => a.id.localeCompare(b.id)));
let cardsCache: IngredientCard[] | null = null;
const cards = () => (cardsCache ??= readKindRecords<IngredientCard>("cards").sort((a, b) => a.id.localeCompare(b.id)));

/** One card in a few lines: what the fit judgement needs, nothing more. */
export function cardBrief(c: IngredientCard): string {
  return [
    `### ${c.id} (${c.kind}, family "${c.family}"${c.region ? `, region ${c.region}` : ""})`,
    `${c.name}: ${c.idea} ${c.surprise}`,
    `look: ${c.palette.map((p) => p.name).join(", ")}; ${c.type.voice} type; ${c.texture}; motion ${c.motion.verb}; radius ${c.radius}, ${c.density}`,
    ...(c.culturalNotes ? [`culture: ${c.culturalNotes}`] : []),
  ].join("\n");
}

function domainLines(): string {
  return domains()
    .map((d) =>
      [
        `- ${d.id}: ${d.names.en.join(", ")}. Products: ${d.productNouns.join(", ")}. Audience: ${d.audience}.`,
        d.regionNotes ? ` Region: ${d.regionNotes}.` : "",
        d.fitsFamilies.length ? ` Fits: ${d.fitsFamilies.join("; ")}.` : "",
        d.clashFamilies.length ? ` Clashes on purpose: ${d.clashFamilies.join("; ")}.` : "",
      ].join(""),
    )
    .join("\n");
}

const system = () => `You score how well GoBanana ingredient cards fit product domains. GoBanana bends one app or web page into a wild but buildable design direction; a card (a surprising word with its own palette, type, texture and motion) leads the look. The bend engine takes cards with a fit of 2 or more for the brief's domain, allows 1 only at wildness 4 and 5, and never uses 0.

${PROMPT_RULES}

Scores:
- 3: a strong, natural fit. The card's world echoes the domain's products or users (a split-flap board for flights), and a real product team would ship it.
- 2: fits. A clear, defensible bridge; it would surprise in a good way.
- 1: a stretch. Only for a deliberately wild bend; the bridge is thin or the mood fights the domain's trust needs.
- 0: wrong. It undermines the domain (playful kitsch for a cancer clinic, gambling cues for kids or finance, a sacred or care-tier tradition used where it would offend), or a culture card is out of place for the domain's region.
Use the whole range. Most pairs are 1 or 2; give 3 and 0 when they are earned. A domain's "Fits" and "Clashes on purpose" family lists are hints, not rules.

reason: 3 to 10 plain words naming the bridge or the problem ("boarding pass rhythm suits fares", "casino cues clash with savings"). No em dashes.

The domains:
${domainLines()}

Reply with one \`\`\`json block: {"cards": [{"id": "<card id>", "fit": {"<domain id>": [<score>, "<reason>"], ...}}]}. Score every card against every domain id listed above, using the ids exactly.`;

export default defineJob<Input, FitScore>({
  id: "j4-fit",
  kind: "fit",
  model: SONNET,
  mode: "batch",
  schema: FitScoreSchema,
  get system() {
    return system();
  },
  maxTokens: 20000,
  expectedOutputTokens: 9000,
  effort: "low",

  loadInputs: () => {
    const all = cards();
    const out: Input[] = [];
    for (let i = 0; i < all.length; i += CARDS_PER_REQUEST) out.push({ n: out.length + 1, cards: all.slice(i, i + CARDS_PER_REQUEST) });
    return out;
  },
  requestId: (input) => `fit-${input.n}`,
  buildPrompt: (input) => `Score these ${input.cards.length} cards against all ${domains().length} domains.\n\n${input.cards.map(cardBrief).join("\n\n")}`,

  parse: (text, input) => {
    const v = extractJson(text) as { cards?: Array<{ id?: string; fit?: Record<string, [number, string]> }> };
    const ids = new Set(input.cards.map((c) => c.id));
    const out: unknown[] = [];
    for (const c of v.cards ?? []) {
      if (!c.id || !ids.has(c.id)) continue;
      for (const [domainId, pair] of Object.entries(c.fit ?? {})) {
        out.push({ cardId: c.id, domainId, score: Array.isArray(pair) ? pair[0] : pair, reason: Array.isArray(pair) ? pair[1] : "" });
      }
    }
    return out;
  },
  check: (r) => (domains().some((d) => d.id === r.domainId) ? [] : [`unknown domain "${r.domainId}"`]),
  finalize: (records, ctx) => {
    const seen = new Set<string>();
    const out = records.filter((r) => {
      const k = `${r.cardId}|${r.domainId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const want = cards().length * domains().length;
    ctx.log(`  pairs: ${out.length} of ${want} (${want - out.length} missing)`);
    return out.sort((a, b) => a.cardId.localeCompare(b.cardId) || a.domainId.localeCompare(b.domainId));
  },
  shardOf: (r) => r.domainId,
});
