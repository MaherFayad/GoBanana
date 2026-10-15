/**
 * P1-J6 Lens packs: 16 LensPack records from data/lens-list.json (Gulf first, then world), using
 * the meanings, UI mappings and care rules in banana-server/lib/bend/lenses.json where they exist.
 * Opus, direct (iterative: rerun one lens with --offset N --limit 1 after adding a note to
 * data/lens-notes.json, then `--from-raw` to rebuild all 16).
 *
 * Every motifSvg is render-checked in headless Chrome (lib/render-svg.ts) in finalize; a tile that
 * fails is dropped and logged to rejects/j6-lenses-render.jsonl. PNGs go to review/j6-renders/.
 *
 *   npx tsx run.ts j6-lenses --dry
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { OPUS, PATHS, ROOT } from "../config.ts";
import { checkLensFonts, defineJob } from "../lib/job.ts";
import { PROMPT_RULES, typeText } from "../lib/prompt.ts";
import { renderMotifs, MOTIF_VARS } from "../lib/render-svg.ts";
import { escapeHtml } from "../lib/review.ts";
import { TYPE_VOICES } from "../../banana-server/lib/direction-detail.ts";
import { LensPackSchema, SACRED_RULE, type LensPack } from "../schema.ts";

type ListItem = { id: string; name: string; region: string; lensesJson?: string; brief?: string };
type Input = ListItem & { source?: unknown; note?: string };

const LENSES = JSON.parse(readFileSync(resolve(ROOT, "..", "banana-server", "lib", "bend", "lenses.json"), "utf8")) as Array<Record<string, unknown> & { id: string }>;
const LIST = (JSON.parse(readFileSync(join(ROOT, "data", "lens-list.json"), "utf8")) as { lenses: ListItem[] }).lenses;
const NOTES_PATH = join(ROOT, "data", "lens-notes.json");
const NOTES: Record<string, string> = existsSync(NOTES_PATH) ? (JSON.parse(readFileSync(NOTES_PATH, "utf8")) as Record<string, string>) : {};

const SYSTEM = `You write lens packs for GoBanana, a tool that bends one app or web page into a wild but buildable design direction. A lens is a cultural or design tradition that a designer can apply to a page: its story, the people to credit, its shape grammar, rhythm, motion, palette, type and one motif tile. A lens borrows the way a good guest does: meaning before motif, grammar (rhythm, repeat, proportion, color ratio, how it is made) and never a copied artwork, and credit always.

${PROMPT_RULES}

Culture rules (never break):
- Name the tradition exactly: the people who make it, the region, the medium. If a fact is not in the request and you are not sure of it, leave it out. Never invent what a motif means.
- Never use sacred or Quranic text, names of God, the shahada, religious symbols, flags or national emblems as decoration, texture or pattern.
- Never use real script as random pattern, and never fake script. Calligraphic lenses show construction (grid, baseline, stroke) in the motif, never letters; real words are set later with the user.
- No cliches as shorthand for a region: no camels, dunes, palm trees, lanterns, oil, "Arabian Nights" lettering or generic arabesque. The same for every culture's tourist cliches.
- The Gulf is not the Levant, the Maghreb, Turkey or Iran. Keep the region exact.

How to fill each field:
- id, region: given in the request. Copy them.
- name: the English name. nameAr: the Arabic name, white Saudi dialect usage, no tashkeel.
- story: three to five plain sentences: what it is, who makes it, where, what it stands for, and why it suits a screen.
- credit: one or two sentences that name the tradition and its people (and the safeguarding body, if the request names one).
- shapeGrammar: 4 to 6 rules, each one short line a designer can follow ("bands of unequal width in a strict repeat").
- rhythm: one sentence on repeat, spacing and proportion.
- motionVerb: one or two words for how things move in this lens ("weave in", "stack up").
- palette: 5 or 6 colors taken from the real medium's color ratios: at least one "surface" (light background), one "ink" (dark text color, readable on the surface), one or two "accent" and "support". Names are plain and descriptive.
- typePairs: 2 type pairs. voice is one of: ${TYPE_VOICES.join(", ")}. latin and arabic each have a display and a body family from Google Fonts (arabic families must support Arabic). Prefer the Arabic family given in the request for one pair.
- motifSvg: one small static SVG tile (rules below).
- dos: 4 to 6 short lines. donts: 4 to 7 short lines, and one of them must be exactly "${SACRED_RULE}". Include the care rules from the request in your own words.

motifSvg rules:
- One <svg> element with xmlns="http://www.w3.org/2000/svg" and viewBox="0 0 120 120", no width or height. It must tile seamlessly when repeated in a grid: shapes that cross an edge continue on the opposite edge.
- Colors only through currentColor or CSS variables in style attributes, each with a fallback: style="fill:var(--motif-1, currentColor)". Variables you may use: ${Object.keys(MOTIF_VARS).join(", ")} (--motif-bg is the tile background; leave the background transparent when unsure). fill="currentColor" and stroke="currentColor" attributes are fine. No other color values anywhere.
- Allowed elements: svg, g, path, rect, circle, ellipse, line, polyline, polygon, defs, clipPath, use (only href="#id" inside the tile). No <text>, <style>, <image>, <script>, <foreignObject>, filters, gradients, event handlers or links outside the tile.
- Under 4,000 characters. Abstract the grammar; do not draw a picture of an object or a building.
- Use single quotes or escaped double quotes correctly so the JSON stays valid.

The record type:

${typeText("IngredientCard", "LensPack")}

Leave out shipPairs: a LensPack palette has none.
Reply with one LensPack object.`;

function lensFacts(item: ListItem): string {
  const src = item.lensesJson ? LENSES.find((l) => l.id === item.lensesJson) : undefined;
  const parts: string[] = [];
  if (src) {
    const { terms: _t, anchors: _a, exclude: _e, ...facts } = src;
    parts.push(`Facts and care rules from lenses.json ("${src.id}"):\n${JSON.stringify(facts, null, 1)}`);
  }
  if (item.brief) parts.push(`Brief: ${item.brief}`);
  return parts.join("\n\n");
}

const RENDER_DIR = join(PATHS.review, "j6-renders");

export default defineJob<Input, LensPack>({
  id: "j6-lenses",
  kind: "lenses",
  model: OPUS,
  mode: "direct",
  schema: LensPackSchema,
  system: SYSTEM,
  maxTokens: 16000,
  expectedOutputTokens: 7000,
  effort: "high",

  loadInputs: () => LIST.map((l) => ({ ...l, note: NOTES[l.id] })),
  requestId: (input) => `j6-${input.id}`,
  buildPrompt: (input) =>
    `Write the LensPack for "${input.name}". Its id is "${input.id}" and its region is "${input.region}".

${lensFacts(input)}${input.note ? `\n\nReviewer note on the last version, fix this: ${input.note}` : ""}`,

  prepare: (raw, input) => {
    if (!raw || typeof raw !== "object") return raw;
    const r: Record<string, unknown> = { ...(raw as Record<string, unknown>), id: input.id, region: input.region };
    delete r.shipPairs;
    return r;
  },
  check: (rec, ctx) => {
    const out = [...checkLensFonts(rec, ctx)];
    const svg = rec.motifSvg;
    if (svg.length > 4500) out.push(`motifSvg is ${svg.length} characters, over 4,500`);
    if (!/viewBox\s*=\s*["']0 0 120 120["']/.test(svg)) out.push('motifSvg needs viewBox="0 0 120 120"');
    const bad = /<(text|style|image|filter|linearGradient|radialGradient|pattern|mask|a)\b/i.exec(svg);
    if (bad) out.push(`motifSvg uses <${bad[1]}>`);
    // Hex is only allowed as a var() fallback: "var(--motif-1, #b91c1c)". "#id" in href or url() is not a color.
    const stray = [...svg.matchAll(/(#[0-9a-f]{3,8}\b|rgba?\(|hsla?\()/gi)].filter((m) => {
      const before = svg.slice(Math.max(0, m.index! - 24), m.index);
      return !/var\(--motif-[a-z0-9]+\s*,\s*$/i.test(before) && !/(href\s*=\s*["']|url\()$/i.test(before);
    });
    if (stray.length) out.push(`motifSvg has hard-coded colors outside var() fallbacks: ${stray.slice(0, 3).map((m) => m[0]).join(", ")}`);
    if (!/currentColor|var\(--motif/.test(svg)) out.push("motifSvg uses neither currentColor nor a --motif variable");
    if (!rec.palette.some((p) => p.role === "surface") || !rec.palette.some((p) => p.role === "ink")) out.push("palette needs a surface and an ink");
    return out;
  },
  finalize: async (records, ctx) => {
    if (records.length === 0) return records;
    const results = await renderMotifs(records.map((r) => ({ id: r.id, svg: r.motifSvg })), RENDER_DIR);
    const failed = results.filter((r) => !r.ok);
    for (const r of results) ctx.log(`  render ${r.id}: ${r.ok ? "ok" : r.problems.join("; ")}`);
    mkdirSync(PATHS.rejects, { recursive: true });
    writeFileSync(join(PATHS.rejects, "j6-lenses-render.jsonl"), failed.map((f) => JSON.stringify({ job: "j6-lenses", request: `j6-${f.id}`, reason: f.problems, record: f.id })).join("\n") + (failed.length ? "\n" : ""));
    const bad = new Set(failed.map((f) => f.id));
    return records.filter((r) => !bad.has(r.id));
  },
  renderReview: (rec) => `<h3>${escapeHtml(rec.name)} <span dir="rtl" lang="ar">${escapeHtml(rec.nameAr)}</span> <small>${escapeHtml(rec.id)}, ${escapeHtml(rec.region)}</small></h3>
<p>${escapeHtml(rec.story)}</p><p><b>Credit:</b> ${escapeHtml(rec.credit)}</p>
<p><b>Grammar:</b> ${escapeHtml(rec.shapeGrammar.join("; "))}<br><b>Rhythm:</b> ${escapeHtml(rec.rhythm)} <b>Motion:</b> ${escapeHtml(rec.motionVerb)}</p>
<p>${rec.palette.map((p) => `<span style="display:inline-block;width:56px;height:28px;background:${escapeHtml(p.hex)};border:1px solid #888" title="${escapeHtml(`${p.role} ${p.name} ${p.hex}`)}"></span>`).join(" ")}</p>
<p><b>Type:</b> ${escapeHtml(rec.typePairs.map((t) => `${t.voice}: ${t.latin.display} / ${t.latin.body}; ${t.arabic.display} / ${t.arabic.body}`).join(" | "))}</p>
<p><img alt="${escapeHtml(rec.id)} motif render" width="240" src="j6-renders/${escapeHtml(rec.id)}.png"></p>
<p><b>Do:</b> ${escapeHtml(rec.dos.join("; "))}<br><b>Don't:</b> ${escapeHtml(rec.donts.join("; "))}</p>`,
});
