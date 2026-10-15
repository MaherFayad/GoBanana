/**
 * P1-J5 Mechanics atlas, step 1: 40 Mechanic records for each of the 30 UiElements (about 1,200),
 * with the J1 page anatomy telling each element which pages it lives on. Opus, batch.
 * Step 2 is jobs/j5-dedupe.ts (Sonnet), which reads this kind back and drops near duplicates.
 * Rerunning this job (or its --from-raw) replaces the deduped set: run j5-dedupe again after.
 *
 *   npx tsx run.ts j5-mechanics --dry
 */
import { OPUS, PATHS } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { PROMPT_RULES, typeText } from "../lib/prompt.ts";
import { escapeHtml } from "../lib/review.ts";
import { extractJson, toRecords } from "../lib/validate.ts";
import { readKind } from "../lib/shards.ts";
import { MechanicSchema, UI_ELEMENTS, type Mechanic, type PageAnatomy, type UiElement } from "../schema.ts";

export const PER_ELEMENT = 40;

type Input = { element: UiElement; pages: string[]; labels: string[]; wild: string[] };

const ANATOMY = readKind<PageAnatomy>(PATHS.out, "anatomy");
const PAGE_IDS = new Set(ANATOMY.map((a) => a.id));

const SYSTEM = `You write UI mechanics for GoBanana, a tool that bends one app or web page into a wild but buildable design direction. A mechanic is how one working UI element behaves or is built in an unexpected way, while it still does its job. A direction later skins it with an ingredient (a weaving, a departure board, a risograph zine), so the mechanic itself names a structure or behavior, not a theme.

Good mechanic: element "progress", name "Split flap step counter", how "Each step is a flap card that flips down to show the next step name when the user advances, with the current step number fixed at the left."
Bad mechanic: "A sadu themed progress bar" (a theme, not a mechanic) or "Animated progress" (too vague to build).

${PROMPT_RULES}

How to fill each field:
- id: "<element>-<short-slug>", lowercase words joined by hyphens, unique within your reply.
- element: the element given in the request.
- name: 4 words or fewer, plain and specific.
- how: one sentence a front-end developer can build from: structure, states and what moves. No brand names.
- buildability: 5 = plain CSS and HTML in an afternoon, 4 = a day with a small script, 3 = a few days or canvas/SVG work, 2 = heavy custom work, 1 = research project. Spread them honestly; most should be 3 to 5.
- rtl: what mirrors in Arabic right to left layouts and what must not mirror (numbers, clocks, media controls, maps). One sentence.
- a11y: the main WCAG 2.2 risk of this mechanic and its fix, naming the success criterion (for example "2.3.3 Animation from Interactions: honor prefers-reduced-motion with a plain fade"). One sentence.
- pages: 2 to 6 page ids from the list in the request where this mechanic pays off most. Only ids from that list.

Spread the set: vary structure, motion, input method, density and scale. No two mechanics in one reply should be the same idea with different words. Keep each element's job intact: a total stays readable, a CTA stays one clear action, an error still says what went wrong and how to fix it.

The record type:

${typeText("UiElement", "Mechanic")}

Reply with a JSON array of Mechanic objects.`;

function inputs(): Input[] {
  return UI_ELEMENTS.map((element) => {
    const pages = new Set<string>();
    const labels = new Set<string>();
    const wild = new Set<string>();
    for (const a of ANATOMY) {
      for (const s of a.sections) {
        if (s.element === element) {
          pages.add(a.id);
          labels.add(s.label.toLowerCase());
        }
      }
      for (const w of a.wildSpots) if (w.element === element) wild.add(a.id);
    }
    return { element, pages: [...pages].sort(), labels: [...labels].sort().slice(0, 40), wild: [...wild].sort() };
  });
}

export default defineJob<Input, Mechanic>({
  id: "j5-mechanics",
  kind: "mechanics",
  model: OPUS,
  mode: process.env.ATLAS_DIRECT ? "direct" : "batch", // ATLAS_DIRECT=1: a small prompt test at full price
  schema: MechanicSchema,
  system: SYSTEM,
  maxTokens: 32000,
  expectedOutputTokens: 14000,

  loadInputs: inputs,
  requestId: (input) => `j5-${input.element}`,
  buildPrompt: (input) =>
    `Write ${PER_ELEMENT} Mechanic records for the element "${input.element}".

Pages that have this element (use these ids for pages): ${(input.pages.length ? input.pages : [...PAGE_IDS].sort()).join(", ")}
Pages where it is a wild spot: ${input.wild.join(", ") || "none listed"}
How those pages label it: ${input.labels.join("; ") || "not labeled"}`,

  // Two replies in the first full run had a stray JS expression in a pages array
  // ("sidebar-free".length ? "settings" : "settings"); keep the value it picks and parse the rest.
  parse: (text) => {
    const fixed = text.replace(/"[^"\n]*"\.[A-Za-z]+\s*\?\s*("[^"\n]*")\s*:\s*"[^"\n]*"/g, "$1");
    return toRecords(extractJson(fixed));
  },
  prepare: (raw, input) => {
    if (!raw || typeof raw !== "object") return raw;
    const r = raw as Record<string, unknown>;
    const pages = Array.isArray(r.pages) ? (r.pages as unknown[]).filter((p) => typeof p === "string" && PAGE_IDS.has(p)) : r.pages;
    let id = typeof r.id === "string" ? r.id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : r.id;
    if (typeof id === "string" && !id.startsWith(`${input.element}-`)) id = `${input.element}-${id}`;
    return { ...r, id, element: input.element, pages };
  },
  check: (rec) => (rec.pages.length === 0 ? ["no known page ids"] : []),
  finalize: (records) => {
    // Ids stay unique across the whole kind.
    const seen = new Map<string, number>();
    return records.map((r) => {
      const n = seen.get(r.id) ?? 0;
      seen.set(r.id, n + 1);
      return n === 0 ? r : { ...r, id: `${r.id}-${n + 1}` };
    });
  },
  shardOf: (rec) => rec.element,
  renderReview: (rec) => `<p><b>${escapeHtml(rec.element)} / ${escapeHtml(rec.name)}</b> <small>${escapeHtml(rec.id)}, build ${rec.buildability}</small><br>${escapeHtml(rec.how)}<br><i>RTL:</i> ${escapeHtml(rec.rtl)}<br><i>A11y:</i> ${escapeHtml(rec.a11y)}<br><i>Pages:</i> ${escapeHtml(rec.pages.join(", "))}</p>`,
});
