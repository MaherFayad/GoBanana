/**
 * R2 round 3: mechanics quality. A Sonnet critic reads every J5 mechanic of one element (after
 * j5-dedupe) and rewrites the ones that are vague (a developer could not build them from the how),
 * low buildability (2 or less, or rated dishonestly), a theme instead of a mechanic, or that break
 * the element's job. Sonnet, batch, text only, one request per element.
 *
 * Output kind "mechanics-rewrites": whole Mechanic records with the old id, laid over the J5
 * mechanics in the server layout (lib/overlays.ts). The critic's flags are on the review page.
 *
 *   npx tsx run.ts r2-mechanics-fix --dry
 */
import { SONNET, PATHS } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { PROMPT_RULES, typeText } from "../lib/prompt.ts";
import { escapeHtml } from "../lib/review.ts";
import { readKind } from "../lib/shards.ts";
import { extractJson } from "../lib/validate.ts";
import { MechanicSchema, UI_ELEMENTS, type Mechanic, type PageAnatomy, type UiElement } from "../schema.ts";

/** Most rewrites one element's reply may carry. */
export const MAX_REWRITES = 10;
/** Words that often mark a vague how ("animated", "dynamic"): a hint to the critic, not a rule. */
const VAGUE = /\b(animated|dynamic|themed|stylish|creative|engaging|interactive|modern|unique|fun)\b/i;

type Input = { element: UiElement; mechanics: Mechanic[]; pages: string[] };
const flags = new Map<string, string>();

const SYSTEM = `You are a strict front-end lead reviewing UI mechanics for GoBanana, a tool that bends one app or web page into a wild but buildable design direction. A mechanic is how one working UI element behaves or is built in an unexpected way while it still does its job. A direction later skins it with an ingredient (a weaving, a departure board, a risograph zine), so the mechanic names a structure or behavior, not a theme.

Good: element "progress", name "Split flap step counter", how "Each step is a flap card that flips down to show the next step name when the user advances, with the current step number fixed at the left."
Bad: "A sadu themed progress bar" (a theme, not a mechanic) or "Animated progress" (too vague to build).

Flag a mechanic only when it has one of these faults:
- vague: a developer could not build it from the how alone: it does not say the structure, the states and what moves or changes, or it leans on words like animated, dynamic or engaging instead.
- low buildability: rated 2 or less, or rated higher than honest (the rating scale: 5 = plain CSS and HTML in an afternoon, 4 = a day with a small script, 3 = a few days or canvas/SVG work, 2 = heavy custom work, 1 = research project).
- a theme or a picture instead of a structure or behavior.
- it breaks the element's job: an unreadable total, a CTA with no single clear action, an error that hides what went wrong, a control a keyboard or screen reader cannot use.
Most mechanics are fine: a typical list of 40 has 0 to 6 faults. Do not flag for taste alone.

For each flagged mechanic write a rewrite: the same id and element, the same core idea made concrete and buildable (structure, states, what moves, sizes or timing where they matter), an honest buildability that should land at 3 to 5, rtl and a11y as one concrete sentence each (a11y names the WCAG 2.2 success criterion), and 2 to 6 pages from the request's list. Name: 4 words or fewer. Leave styles out.

${PROMPT_RULES}

The record type:

${typeText("UiElement", "Mechanic")}

Reply with JSON only, inside one \`\`\`json fenced block: {"flags": [{"id": "...", "fault": "vague" | "low buildability" | "theme" | "breaks the job", "why": "one short line"}], "rewrites": [Mechanic, ...]}, one rewrite per flag, at most ${MAX_REWRITES}. Empty lists when nothing needs work.`;

function inputs(): Input[] {
  const anatomy = readKind<PageAnatomy>(PATHS.out, "anatomy");
  const all = readKind<Mechanic>(PATHS.out, "mechanics");
  return UI_ELEMENTS.map((element) => {
    const pages = [...new Set(anatomy.filter((a) => a.sections.some((s) => s.element === element)).map((a) => a.id))].sort();
    return { element, pages: pages.length ? pages : anatomy.map((a) => a.id).sort(), mechanics: all.filter((m) => m.element === element).sort((a, b) => a.id.localeCompare(b.id)) };
  }).filter((i) => i.mechanics.length > 0);
}

const line = (m: Mechanic) => {
  const hint = [m.buildability <= 2 ? "low buildability" : "", VAGUE.test(m.how) ? "vague words" : ""].filter(Boolean).join(", ");
  return `- ${m.id} | ${m.name} | build ${m.buildability}${hint ? ` | hint: ${hint}` : ""}\n  how: ${m.how}\n  rtl: ${m.rtl}\n  a11y: ${m.a11y}\n  pages: ${m.pages.join(", ")}`;
};

export default defineJob<Input, Mechanic>({
  id: "r2-mechanics-fix",
  kind: "mechanics-rewrites",
  model: SONNET,
  mode: "batch",
  schema: MechanicSchema,
  system: SYSTEM,
  maxTokens: 16000,
  expectedOutputTokens: 5000,
  effort: "medium",

  loadInputs: inputs,
  requestId: (input) => `r2m-${input.element}`,
  buildPrompt: (input) => `Element: ${input.element}\nPage ids for pages: ${input.pages.join(", ")}\n\nMechanics:\n${input.mechanics.map(line).join("\n")}`,

  parse: (text, input) => {
    const v = extractJson(text) as { flags?: Array<{ id?: string; fault?: string; why?: string }>; rewrites?: unknown[] };
    for (const f of v.flags ?? []) if (typeof f.id === "string") flags.set(f.id, `${f.fault ?? "flag"}: ${f.why ?? ""}`);
    const known = new Set(input.mechanics.map((m) => m.id));
    return (v.rewrites ?? []).filter((r) => r && typeof r === "object" && known.has(String((r as { id?: unknown }).id))).slice(0, MAX_REWRITES);
  },
  prepare: (raw, input) => {
    if (!raw || typeof raw !== "object") return raw;
    const r = raw as Record<string, unknown>;
    const ok = new Set(input.pages);
    const pages = Array.isArray(r.pages) ? (r.pages as unknown[]).filter((p) => typeof p === "string" && ok.has(p)) : r.pages;
    const { styles: _s, ...rest } = r;
    return { ...rest, element: input.element, pages };
  },
  check: (rec) => [...(rec.pages.length === 0 ? ["no known page ids"] : []), ...(rec.buildability < 3 ? ["a rewrite must be buildable (3 or more)"] : [])],
  finalize: (records, ctx) => {
    const seen = new Set<string>();
    const out = records.filter((r) => !seen.has(r.id) && seen.add(r.id));
    ctx.log(`  flagged ${flags.size}, rewritten ${out.length}`);
    return out.sort((a, b) => a.id.localeCompare(b.id));
  },
  shardOf: (rec) => rec.element,
  renderReview: (rec) => `<p><b>${escapeHtml(rec.element)} / ${escapeHtml(rec.name)}</b> <small>${escapeHtml(rec.id)}, build ${rec.buildability}</small><br><i>Flag:</i> ${escapeHtml(flags.get(rec.id) ?? "")}<br>${escapeHtml(rec.how)}<br><i>RTL:</i> ${escapeHtml(rec.rtl)}<br><i>A11y:</i> ${escapeHtml(rec.a11y)}</p>`,
});
