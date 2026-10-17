/**
 * Refinement R8: card lines for the parts where a page's work happens (list rows, result cards, the
 * map, form fields, filter and sort chips, the search field). R6 found that on search, listing,
 * browse and form pages the idea lands on the empty state or the header: these parts were not
 * mechanic elements in the bend, and their J4 lines (jobs/j4-elements.ts, 5 to 12 words) only
 * decorate them ("rows separated by a hairline rule with a small ring bullet", "a square field with
 * a brown underline"). This job rewrites those six lines for every card so the idea acts on the part
 * (listing rows as luggage tags, a map as a stamped travel chart, form steps as a boarding pass being
 * filled) while the task still works. Sonnet, batch, text only.
 *
 * Output: the whole card-elements kind with these six elements' lines replaced (other elements keep
 * their J4 or R1 line). A card the reply misses keeps its old lines.
 *
 *   needs out/v1/cards (after r1-rewrite2), out/v1/card-elements (after r1-lines)
 *   npx tsx run.ts r8-lines --dry
 */
import { SONNET } from "../config.ts";
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob } from "../lib/job.ts";
import { PROMPT_RULES } from "../lib/prompt.ts";
import { mergeByKey } from "../lib/refine.ts";
import { escapeHtml } from "../lib/review.ts";
import { extractJson } from "../lib/validate.ts";
import { CardElementLineSchema, type CardElementLine, type IngredientCard, type UiElement } from "../schema.ts";
import { cardBrief } from "./j4-fit.ts";

/** The parts this job rewrites. */
export const WORK_PARTS: readonly UiElement[] = ["list-row", "card", "map", "form-field", "chip-filter", "search"];
export const CARDS_PER_REQUEST = 12;

type Input = { n: number; cards: IngredientCard[] };

const SYSTEM = `You write how a GoBanana ingredient card takes over the parts of a page where the user's work happens: the list rows, the result cards, the map, the form fields, the filter and sort controls and the search field. GoBanana bends one app or web page into a wild but buildable design direction; a card (a surprising word with its own world, palette, type, texture and motion) leads it.

The old lines for these parts only decorated them ("rows separated by a hairline rule with a small ring bullet", "a square field with a brown underline", "a ring illustration beside the list"). Now the idea must act on the part itself: the part becomes an object, a structure or a rule from the card's world, and the user's task still works through it.

Good lines (for a card about airport luggage tags):
- list-row: "Each listing hangs as a luggage tag on one rail: rent and district printed plainly on the tag face, a punched eyelet marks saved homes."
- map: "The map becomes a stamped travel chart: each home is an ink stamp holding its price, the chosen one inked solid."
- form-field: "The form fills in like a boarding pass: name, date and seat panels in fixed boxes, the stub tears off on submit."
- chip-filter: "Filters are destination tags threaded on a cord; a picked tag swings forward, filled, with a small x to clear it."
Bad lines: "Rows with a thin tag-colored border" (decoration only), "Filters are pennant tags in sky blue; a picked one fills orange" (a color swap on a chip), "Fields are cream bands with a tall caps label" (a restyle), "A luggage tag drawing in the corner of the list" (beside the part, not the part), "Rows scattered like tags dropped on a table" (breaks scanning), "Fields hidden inside folded tags" (hides the task).

${PROMPT_RULES}

For each card and each element, write:
- how: one plain sentence, 10 to 24 words, that a front-end developer can build from: what the part becomes in this card's world (its object, structure, rule or motion, named concretely) and what stays plain so the task still works (names, prices, distances, typed text, labels, the selected state). Use the card's own things, not generic UI words. Colors, borders and fonts alone are not the idea (the palette and type are set elsewhere): spend the words on the object, structure or rule the part becomes and how it behaves (a menu board line with dotted leaders, an order pad, numbered exhibit steps, a stamped chart). It must stay usable: readable text in plain type, 44 px targets, keyboard and screen reader use, visible selected and error states. A map keeps real geography, north up and readable pins; a form keeps real labels, typed text and visible errors; filters keep a visible selected state and a way to clear; a sorted list keeps its order easy to read; search keeps the typed query and suggestions plain.
- buildability: 5 = plain CSS and components in an afternoon; 4 = a day, small SVG or a little motion; 3 = custom drawing, masks or canvas; 2 = heavy custom work or real performance risk; 1 = barely shippable. Be honest: most lines are 3 or 4.
Try first to find an object or a rule in the card's world that can carry the part; most cards have one. Only when the card truly has nothing for a part, write an honest modest line with buildability 2, never a forced gimmick. Vary the six lines of one card: do not reuse the same object for every part.

The elements:
- list-row: one repeated row (a search result, a listing, a transaction, a dish, a line on a bill).
- card: one result or content card in a grid or a carousel (a restaurant, a home, a product, an offer).
- map: places, pins, an area or a route on a map.
- form-field: text inputs in a form or a multi-step input flow (sign-up, OTP code, address, payment details).
- chip-filter: filter and sort controls (chips, a sort menu, a price or room range).
- search: the search field and its suggestions.

Reply with one \`\`\`json block: {"cards": [{"id": "<card id>", "lines": {"<element>": [<buildability>, "<how>"], ...}}]}, with all ${WORK_PARTS.length} elements for every card, using the element names exactly.`;

let cardsCache: IngredientCard[] | null = null;
const cards = () => (cardsCache ??= readKindRecords<IngredientCard>("cards").sort((a, b) => a.id.localeCompare(b.id)));

const WORK = new Set<string>(WORK_PARTS);

export default defineJob<Input, CardElementLine>({
  id: "r8-lines",
  kind: "card-elements",
  model: SONNET,
  mode: "batch",
  schema: CardElementLineSchema,
  system: SYSTEM,
  maxTokens: 16000,
  expectedOutputTokens: 4500,
  effort: "low",

  loadInputs: () => {
    const all = cards();
    const out: Input[] = [];
    for (let i = 0; i < all.length; i += CARDS_PER_REQUEST) out.push({ n: out.length + 1, cards: all.slice(i, i + CARDS_PER_REQUEST) });
    return out;
  },
  // The first card id names the chunk, so a card added later shifts only the chunks after it.
  requestId: (input) => `r8l2-${input.n}-${input.cards[0]!.id}`.slice(0, 64),
  buildPrompt: (input) => `Write the ${WORK_PARTS.length} part lines for each of these ${input.cards.length} cards.\n\n${input.cards.map(cardBrief).join("\n\n")}`,

  parse: (text, input) => {
    const v = extractJson(text) as { cards?: Array<{ id?: string; lines?: Record<string, [number, string]> }> };
    const ids = new Set(input.cards.map((c) => c.id));
    const out: unknown[] = [];
    for (const c of v.cards ?? []) {
      if (!c.id || !ids.has(c.id)) continue;
      for (const [element, pair] of Object.entries(c.lines ?? {})) {
        if (!WORK.has(element)) continue;
        out.push({ cardId: c.id, element, buildability: Array.isArray(pair) ? pair[0] : pair, how: Array.isArray(pair) ? pair[1] : "" });
      }
    }
    return out;
  },
  check: (r) => {
    const n = r.how.trim().split(/\s+/).length;
    return n < 6 || n > 34 ? [`how has ${n} words`] : [];
  },
  finalize: (records, ctx) => {
    const key = (r: CardElementLine) => `${r.cardId}|${r.element}`;
    const seen = new Set<string>();
    const mine = records.filter((r) => !seen.has(key(r)) && seen.add(key(r)));
    const want = cards().length * WORK_PARTS.length;
    ctx.log(`  r8 lines: ${mine.length} of ${want} (${want - mine.length} keep their old line)`);
    return mergeByKey(readKindRecords<CardElementLine>("card-elements"), mine, key).sort((a, b) => a.cardId.localeCompare(b.cardId) || a.element.localeCompare(b.element));
  },
  shardOf: (r) => r.element,
  renderReview: (r) => `<p><b>${escapeHtml(r.cardId)}</b> / ${escapeHtml(r.element)} <small>build ${r.buildability}</small><br>${escapeHtml(r.how)}</p>`,
});
