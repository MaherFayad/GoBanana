/**
 * Refinement R8: page mechanics for the parts where a page's work happens: list rows, result cards,
 * the map, form fields (forms and multi-step inputs), filter and sort controls and the search field.
 * R6 found the bend had no mechanic for these parts on search, listing, browse and form pages, so the
 * idea landed on the empty state or the header. The J5 mechanics for these elements are mostly UI
 * behaviors (swipe actions, sticky date groups, price pin stacks); these are J5-shaped records of a
 * different sort: the part is built as an object or a system (a tag rail, a stamped chart, a pass
 * being filled) that a direction's idea can take over while the task still works.
 *
 * Same record shape and rules as jobs/j5-mechanics.ts (Mechanic, pages from the J1 anatomy), one
 * request per element, Sonnet, batch. Output: the whole mechanics kind with these records added
 * (ids never collide with J5's). Rebuild after j5-dedupe and r2-mechanics-fix.
 *
 *   npx tsx run.ts r8-mechanics --dry
 */
import { SONNET } from "../config.ts";
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob } from "../lib/job.ts";
import { PROMPT_RULES, typeText } from "../lib/prompt.ts";
import { mergeByKey } from "../lib/refine.ts";
import { escapeHtml } from "../lib/review.ts";
import { extractJson, toRecords } from "../lib/validate.ts";
import { MechanicSchema, type Mechanic, type PageAnatomy, type UiElement } from "../schema.ts";
import { WORK_PARTS } from "./r8-lines.ts";

export const PER_ELEMENT = 12;

type Input = { element: UiElement; pages: string[]; labels: string[]; taken: string[] };

const SYSTEM = `You write page mechanics for GoBanana, a tool that bends one app or web page into a wild but buildable design direction. A mechanic is how one working UI part is built in an unexpected way while it still does its job. A direction later gives it a world (a weaving, a departure board, a risograph zine), so the mechanic names a structure or a behavior, not a theme.

These mechanics are for the parts where the user's work happens: the list rows, the result cards, the map, the form fields, the filter and sort controls and the search field. On search, listing, browse and form pages a wild idea used to land on the header or the empty state and leave these parts plain. Each mechanic here builds the part as a physical object or a system with its own rules, one that many ideas can take over, and says how the task still works through it.

Good: element "list-row", name "Tag rail rows", how "Each result hangs as a tag from one shared rail, title and price printed plainly on the tag face, saved items get a punched eyelet, and tapping a tag swings it forward to open the item."
Good: element "map", name "Stamped chart pins", how "Each place is a round ink stamp holding its price on a plain base map, visited or saved places are stamped solid, and the selected stamp lifts with its card below."
Good: element "form-field", name "Pass panel fill", how "The form is one pass card split into fixed boxed panels, each label printed small in its box corner, a filled panel prints its value in mono, and the stub tears off on submit."
Good: element "chip-filter", name "Sieve tray filters", how "Filters stack as trays with mesh labels, an active tray drops lower and darker with its count, and a clear all bar sits under the stack."
Bad: "A luggage themed list" (a theme, not a structure), "Rows float freely around the screen" (breaks scanning), "Fields hide inside envelopes until tapped" (hides the task).

${PROMPT_RULES}

How to fill each field:
- id: "<element>-<short-slug>", lowercase words joined by hyphens, unique within your reply, and not one of the taken ids in the request.
- element: the element given in the request.
- name: 4 words or fewer, plain and specific.
- how: one sentence a front-end developer can build from: the object or system the part becomes, its structure and states, what moves, and what stays plain so the task works (names, prices, distances, typed text, labels, the selected state, the sort order). No brand names.
- buildability: 5 = plain CSS and HTML in an afternoon, 4 = a day with a small script, 3 = a few days or canvas/SVG work, 2 = heavy custom work, 1 = research project. Spread them honestly; most should be 3 to 5.
- rtl: what mirrors in Arabic right to left layouts and what must not mirror (numbers, prices, codes, maps). One sentence.
- a11y: the main WCAG 2.2 risk of this mechanic and its fix, naming the success criterion. One sentence.
- pages: 2 to 6 page ids from the list in the request where this mechanic pays off most. Only ids from that list.

Keep each part's job intact: a list stays scannable in its order, a result card keeps its title, price and one way in, a map keeps real geography and readable pins, a form keeps real labels, typed text and visible errors, a filter keeps a visible selected state and a way to clear, search keeps the typed query plain. Spread the set over different objects and systems (tags, tickets, stamps, drawers, trays, ledgers, dials, folds, specimens, cards in a catalog), different motion and different density. No two mechanics in one reply should be the same idea with different words, and none should repeat a taken name.

The record type:

${typeText("UiElement", "Mechanic")}

Reply with a JSON array of Mechanic objects.`;

function inputs(): Input[] {
  const anatomy = readKindRecords<PageAnatomy>("anatomy");
  const mechanics = readKindRecords<Mechanic>("mechanics");
  return WORK_PARTS.map((element) => {
    const pages = new Set<string>();
    const labels = new Set<string>();
    for (const a of anatomy) {
      for (const s of a.sections) {
        if (s.element === element) {
          pages.add(a.id);
          labels.add(s.label.toLowerCase());
        }
      }
      for (const w of a.wildSpots) if (w.element === element) pages.add(a.id);
    }
    const taken = mechanics.filter((m) => m.element === element).map((m) => `${m.id} (${m.name})`).sort();
    return { element, pages: [...pages].sort(), labels: [...labels].sort().slice(0, 40), taken };
  });
}

let pageIds: Set<string> | null = null;
const knownPages = () => (pageIds ??= new Set(readKindRecords<PageAnatomy>("anatomy").map((a) => a.id)));

export default defineJob<Input, Mechanic>({
  id: "r8-mechanics",
  kind: "mechanics",
  model: SONNET,
  mode: "batch",
  schema: MechanicSchema,
  system: SYSTEM,
  maxTokens: 16000,
  expectedOutputTokens: 5000,
  effort: "medium",

  loadInputs: inputs,
  requestId: (input) => `r8m-${input.element}`,
  buildPrompt: (input) =>
    `Write ${PER_ELEMENT} Mechanic records for the element "${input.element}".

Pages that have this element (use these ids for pages): ${input.pages.join(", ")}
How those pages label it: ${input.labels.join("; ") || "not labeled"}
Taken ids and names (do not reuse or repeat these ideas): ${input.taken.join("; ")}`,

  parse: (text) => toRecords(extractJson(text)),
  prepare: (raw, input) => {
    if (!raw || typeof raw !== "object") return raw;
    const r = raw as Record<string, unknown>;
    const ok = new Set(input.pages);
    const pages = Array.isArray(r.pages) ? (r.pages as unknown[]).filter((p) => typeof p === "string" && ok.has(p) && knownPages().has(p)) : r.pages;
    let id = typeof r.id === "string" ? r.id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : r.id;
    if (typeof id === "string" && !id.startsWith(`${input.element}-`)) id = `${input.element}-${id}`;
    const { styles: _s, ...rest } = r;
    return { ...rest, id, element: input.element, pages };
  },
  check: (rec) => [...(rec.pages.length === 0 ? ["no known page ids"] : []), ...(rec.buildability < 3 ? ["a page mechanic must be buildable (3 or more)"] : [])],
  finalize: (records, ctx) => {
    const base = readKindRecords<Mechanic>("mechanics");
    const byId = new Map(base.map((m) => [m.id, m]));
    const seen = new Set<string>();
    // A taken id gets "-r8" (an R8 record never replaces a J5 one); the same record from an earlier
    // run of this job keeps its id, so a rebuild over its own output gives the same kind.
    const mine = records
      .map((r) => {
        const old = byId.get(r.id);
        return old && old.name !== r.name ? { ...r, id: `${r.id}-r8` } : r;
      })
      .filter((r) => !seen.has(r.id) && seen.add(r.id));
    ctx.log(`  r8 page mechanics: ${mine.length} (${WORK_PARTS.map((e) => `${e} ${mine.filter((m) => m.element === e).length}`).join(", ")})`);
    return mergeByKey(base, mine, (m) => m.id);
  },
  shardOf: (rec) => rec.element,
  renderReview: (rec) => `<p><b>${escapeHtml(rec.element)} / ${escapeHtml(rec.name)}</b> <small>${escapeHtml(rec.id)}, build ${rec.buildability}</small><br>${escapeHtml(rec.how)}<br><i>RTL:</i> ${escapeHtml(rec.rtl)}<br><i>A11y:</i> ${escapeHtml(rec.a11y)}<br><i>Pages:</i> ${escapeHtml(rec.pages.join(", "))}</p>`,
});
