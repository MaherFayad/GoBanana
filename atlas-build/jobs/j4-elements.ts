/**
 * P1-J4 Fit matrix, part 2 (docs/next-step-plan.md 6.3): a CardElementLine for every card (J3) and
 * UI element pair, on Sonnet, batch, with the element list in the cached prefix. Shares the j4
 * budget with j4-fit.ts.
 *
 * Each request covers CARDS_PER_REQUEST cards. The reply is compact JSON
 * ({"cards": [{"id", "lines": {"<element>": [buildability, how]}}]}) that the script expands.
 *
 *   needs out/v1/cards/ (J3)
 *   npx tsx run.ts j4-elements --dry
 */
import { SONNET } from "../config.ts";
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob } from "../lib/job.ts";
import { PROMPT_RULES } from "../lib/prompt.ts";
import { extractJson } from "../lib/validate.ts";
import { CardElementLineSchema, UI_ELEMENTS, type CardElementLine, type IngredientCard } from "../schema.ts";
import { cardBrief } from "./j4-fit.ts";

export const CARDS_PER_REQUEST = 8;

type Input = { n: number; cards: IngredientCard[] };

let cardsCache: IngredientCard[] | null = null;
const cards = () => (cardsCache ??= readKindRecords<IngredientCard>("cards").sort((a, b) => a.id.localeCompare(b.id)));

const SYSTEM = `You write how a GoBanana ingredient card shows up in each UI element. GoBanana bends one app or web page into a wild but buildable design direction; a card (a surprising word with its own palette, type, texture and motion) leads the look, and the engine picks the line for the page's wild spot element.

${PROMPT_RULES}

For each card and each element, write:
- how: one plain sentence (6 to 14 words) a developer can build from: what the element becomes, using the card's own shapes, type, texture or motion. Name concrete parts ("the progress track is a row of perforated stub tears"), not moods. It must stay usable: real labels, readable text, 44 px targets, nothing that hides state.
- buildability: 5 = plain CSS and components in an afternoon; 4 = a day, small SVG or a little motion; 3 = custom drawing, masks or canvas; 2 = heavy custom work or real performance risk; 1 = barely shippable. Be honest: most lines are 3 or 4.
Elements where the card truly adds little still get an honest, modest line with a low buildability, never a forced gimmick.

The elements: ${UI_ELEMENTS.join(", ")}.
(header: top bar; nav-tabs: top tabs; bottom-nav: tab bar; hero: top feature area; cta: main button; progress and stepper: where the user is in a flow; total and price-breakdown: money summary; card and list-row: repeated items; divider; section-nav: in-page anchors; empty-state, loading, success, error, toast: states; sheet and modal: overlays; form-field, toggle, chip-filter, search: inputs; map; chart; avatar; onboarding-slide; paywall-plan: a plan option on a paywall.)

Reply with one \`\`\`json block: {"cards": [{"id": "<card id>", "lines": {"<element>": [<buildability>, "<how>"], ...}}]}, with all ${UI_ELEMENTS.length} elements for every card, using the element names exactly.`;

export default defineJob<Input, CardElementLine>({
  id: "j4-elements",
  kind: "card-elements",
  model: SONNET,
  mode: "batch",
  schema: CardElementLineSchema,
  system: SYSTEM,
  maxTokens: 20000,
  expectedOutputTokens: 6500,
  effort: "low",

  loadInputs: () => {
    const all = cards();
    const out: Input[] = [];
    for (let i = 0; i < all.length; i += CARDS_PER_REQUEST) out.push({ n: out.length + 1, cards: all.slice(i, i + CARDS_PER_REQUEST) });
    return out;
  },
  requestId: (input) => `elements-${input.n}`,
  buildPrompt: (input) => `Write the ${UI_ELEMENTS.length} element lines for each of these ${input.cards.length} cards.\n\n${input.cards.map(cardBrief).join("\n\n")}`,

  parse: (text, input) => {
    const v = extractJson(text) as { cards?: Array<{ id?: string; lines?: Record<string, [number, string]> }> };
    const ids = new Set(input.cards.map((c) => c.id));
    const out: unknown[] = [];
    for (const c of v.cards ?? []) {
      if (!c.id || !ids.has(c.id)) continue;
      for (const [element, pair] of Object.entries(c.lines ?? {})) {
        out.push({ cardId: c.id, element, buildability: Array.isArray(pair) ? pair[0] : pair, how: Array.isArray(pair) ? pair[1] : "" });
      }
    }
    return out;
  },
  finalize: (records, ctx) => {
    const seen = new Set<string>();
    const out = records.filter((r) => {
      const k = `${r.cardId}|${r.element}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const want = cards().length * UI_ELEMENTS.length;
    ctx.log(`  pairs: ${out.length} of ${want} (${want - out.length} missing)`);
    return out.sort((a, b) => a.cardId.localeCompare(b.cardId) || a.element.localeCompare(b.element));
  },
  shardOf: (r) => r.element,
});
