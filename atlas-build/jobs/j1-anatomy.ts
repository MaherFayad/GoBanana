/**
 * P1-J1 Page anatomy library: one PageAnatomy per page in data/pages.json (the owner's list,
 * derived from wild-spots.json, bench briefs, evals and common product pages). Opus, batch.
 *
 *   npx tsx run.ts j1-anatomy --dry
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { OPUS, ROOT } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { applyTextFixes } from "../lib/refine.ts";
import { PROMPT_RULES, typeText } from "../lib/prompt.ts";
import { escapeHtml } from "../lib/review.ts";
import { PART_ROLES } from "../../banana-server/lib/stitch/types.ts";
import { PageAnatomySchema, type PageAnatomy, type Platform } from "../schema.ts";

type Input = { id: string; name: string; platforms: Platform[]; from: string };

const WILD_SPOTS = readFileSync(resolve(ROOT, "..", "banana-server", "lib", "bend", "wild-spots.json"), "utf8").replace(/\r\n/g, "\n").trim();

const SYSTEM = `You write page anatomy records for GoBanana, a tool that bends one app or web page into a wild but buildable design direction. An anatomy record says what a page is made of, top to bottom, so the tool knows which parts must stay familiar and where a wild idea pays off. Write it from what shipped products really do, not from one brand.

${PROMPT_RULES}

How to fill each field:
- id: given in the request. Copy it exactly.
- names.en: 2 to 5 names people and design galleries use for this page. names.ar: 2 to 4 Arabic names a Saudi product team would say, in white Saudi dialect, no tashkeel, noun forms (for example "صفحة الدفع", "تأكيد الطلب").
- platforms: the platforms given in the request.
- sections: every section the page usually has, in order from top to bottom, 4 to 10 of them.
  - role: one of these stitch roles, nothing else: ${PART_ROLES.join(", ")}. Mobile top bars are "status-header", mobile tab bars are "tabbar", web navigation is "nav", bottom sheets are "sheet". Use "other" only when nothing fits.
  - element: the closest UiElement.
  - label: a short plain label for this page, like "Order total" or "Plan cards".
  - required: true only when almost every product ships it on this page.
  - bands: for each platform where the section is visible on the first screen (no scrolling), its vertical position as fractions of that one screen, y0 top and y1 bottom, 0 to 1, y0 below y1. Leave a platform out when the section starts below the first screen there. Bands of one platform go down the screen in section order and may touch but should not overlap much, except a side column on wide screens (an order summary or filters beside the main column), whose band may overlap the main column's bands. Fixed bars sit at the edges: a mobile tab bar is about 0.9 to 1, a status header about 0 to 0.1.
- baseline: two or three plain sentences on what almost every product ships here: the layout most apps share.
- mustKeep: 3 to 6 short patterns users rely on, like "clear total" or "one primary action". Never more than 6.
- wildSpots: 2 to 4 elements on this page where a wild idea pays off without hurting the task, each with a one sentence why. Only elements this page really has.
- mobbinTerms: 3 to 6 screen or flow names a designer would search in a UI gallery like Mobbin ("checkout", "order summary", "payment method").
- queryNouns: 3 to 8 short nouns that name this page or its key parts in an image search ("checkout page", "order summary", "payment sheet").

Pages the tool already treats as wild spots, by platform (the why says what makes them a good place for an idea):
${WILD_SPOTS}

The record type:

${typeText("Platform", "UiElement", "PageAnatomy")}

Reply with one PageAnatomy object.`;

const PAGES: Input[] = (JSON.parse(readFileSync(join(ROOT, "data", "pages.json"), "utf8")) as { pages: Input[] }).pages;

export default defineJob<Input, PageAnatomy>({
  id: "j1-anatomy",
  kind: "anatomy",
  model: OPUS,
  // ATLAS_DIRECT=1 runs a small prompt test without waiting for a batch (full price).
  mode: process.env.ATLAS_DIRECT ? "direct" : "batch",
  schema: PageAnatomySchema,
  system: SYSTEM,
  maxTokens: 12000,
  expectedOutputTokens: 4500,

  loadInputs: () => PAGES,
  // Owner review items fixed in refinement round 1 (data/r1-text-fixes.json).
  finalize: (records) => applyTextFixes("anatomy", records),
  requestId: (input) => `j1-${input.id}`,
  buildPrompt: (input) =>
    `Write the PageAnatomy for the page "${input.name}". Its id is "${input.id}". Platforms: ${input.platforms.join(", ")}.`,

  prepare: (raw, input) => {
    if (!raw || typeof raw !== "object") return raw;
    const r = raw as Record<string, unknown>;
    // The id and platforms come from the owner's list; bands for other platforms are dropped.
    const sections = Array.isArray(r.sections)
      ? (r.sections as Array<Record<string, unknown>>).map((s) => {
          const bands = s && typeof s.bands === "object" && s.bands ? (s.bands as Record<string, unknown>) : {};
          return { ...s, bands: Object.fromEntries(Object.entries(bands).filter(([p]) => (input.platforms as string[]).includes(p))) };
        })
      : r.sections;
    return { ...r, id: input.id, platforms: input.platforms, sections };
  },
  check: (rec) => {
    const out: string[] = [];
    for (const p of rec.platforms) {
      if (!rec.sections.some((s) => s.bands[p])) out.push(`no section has a band on ${p}`);
    }
    if (rec.sections.length < 3) out.push("fewer than 3 sections");
    if (rec.wildSpots.length === 0) out.push("no wild spots");
    // Wild spots may name page states that are not sections (loading, empty-state, toast, success):
    // the first full run rejected 89 good records on a stricter rule, so that rule is gone.
    return out;
  },
  renderReview: (rec) => {
    const rows = rec.sections
      .map((s) => `<tr><td>${escapeHtml(s.role)}</td><td>${escapeHtml(s.element)}</td><td>${escapeHtml(s.label)}</td><td>${s.required ? "yes" : ""}</td><td>${escapeHtml(Object.entries(s.bands).map(([p, b]) => `${p} ${b!.y0}-${b!.y1}`).join("; "))}</td></tr>`)
      .join("");
    return `<h3>${escapeHtml(rec.id)} <small>${escapeHtml(rec.platforms.join(", "))}</small></h3>
<p>${escapeHtml(rec.names.en.join(" / "))} | <span dir="rtl" lang="ar">${escapeHtml(rec.names.ar.join(" / "))}</span></p>
<table><tr><th>role</th><th>element</th><th>label</th><th>req</th><th>bands</th></tr>${rows}</table>
<p><b>Baseline:</b> ${escapeHtml(rec.baseline)}</p>
<p><b>Must keep:</b> ${escapeHtml(rec.mustKeep.join("; "))}</p>
<ul>${rec.wildSpots.map((w) => `<li><b>${escapeHtml(w.element)}</b>: ${escapeHtml(w.why)}</li>`).join("")}</ul>
<p><b>Mobbin:</b> ${escapeHtml(rec.mobbinTerms.join(", "))}<br><b>Query nouns:</b> ${escapeHtml(rec.queryNouns.join(", "))}</p>`;
  },
});
