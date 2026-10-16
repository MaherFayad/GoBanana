/**
 * P1-J13 stunning layer, shaders (VAL-14): about 150 ShaderRecipe records, each a GLSL ES 1.00
 * fragment shader tied to J3 card families and J6 lenses, with a reduced-motion fallback.
 * Opus, batch: 3 shaders for each of the 16 lenses, 5 for each card family group (about 23).
 *
 * Every shader is render-checked in headless Chrome WebGL (lib/render-stunning.ts): it must
 * compile, draw something that is not blank, flat or one color, change over time, follow the
 * color uniforms, not flash, and draw its reduced-motion frame. A failing shader gets one repair
 * request carrying the problems; if it fails again it is dropped (rejects/j13-shaders.jsonl).
 * Frame strips go to review/j13-shaders/.
 *
 *   npx tsx run.ts j13-shaders --dry
 */
import { join } from "node:path";
import { OPUS, PATHS } from "../config.ts";
import { CULTURE_RULES, cardLines, checkTies, inputContext, j13Inputs, lensFacts, prepareTies, repairText, uniqueIds, type J13Input } from "../lib/j13.ts";
import { defineJob } from "../lib/job.ts";
import { PROMPT_RULES, typeText } from "../lib/prompt.ts";
import { checkShaders } from "../lib/render-stunning.ts";
import { escapeHtml } from "../lib/review.ts";
import { ShaderRecipeSchema, UI_ELEMENTS, type ShaderRecipe } from "../schema.ts";

export const PER_GROUP = 5;
export const PER_LENS = 3;
const RENDER_DIR = join(PATHS.review, "j13-shaders");

export const SYSTEM = `You write GLSL fragment shaders for GoBanana, a tool that bends one app or web page into a wild but buildable design direction. Each shader is a "stunning layer" a developer drops into a shipped product screen: a hero band, a loading or success moment, an empty state, a paywall plan card. It carries the idea of an ingredient card (a material, era, object, tradition, scale or rule) or a cultural lens, in motion.

${PROMPT_RULES}

The taste bar (the owner's own boards of shipped product UI):
- Shipped-grade craft, not demo-scene art. It must sit behind or beside real UI and make the screen feel made, not busy.
- Dark first, restrained color: a surface that fills most of the frame, one accent used sparingly as a focal point, luminous glow or gradient only as a single focus.
- Texture as a second voice: grain, halftone, dot grids, fine lines, woven or stacked bands. Never a loud full-frame wash behind text.
- Fails the bar: rainbow plasma, neon overload, kaleidoscopes, tunnels, lava lamps, screensaver looks, generic purple and blue gradient blobs, busy noise everywhere.
- Motion is slow and calm: large forms move with periods of 6 to 20 seconds, fine detail may drift faster. It must stay readable as a background. Never flash or strobe.
- Leave calm space for text and controls: keep the strongest detail toward one side, an edge or the center of a focal area, and keep the luminance range moderate where text would sit.

The shader contract (the render check enforces it):
- GLSL ES 1.00 for WebGL 1 (it also runs in WebGL 2). Start with exactly these lines and add no other uniforms:
  precision highp float;
  uniform vec2 u_resolution;   // canvas size in pixels
  uniform float u_time;        // seconds since start
  uniform vec3 u_c0;           // surface, fills most of the frame
  uniform vec3 u_c1;           // ink
  uniform vec3 u_c2;           // accent
  uniform vec3 u_c3;           // support
- void main() writes gl_FragColor = vec4(color, 1.0). No discard.
- Every color comes from u_c0 to u_c3: mix them, scale their brightness, add a little of one to another. Never write a new hue as a constant (vec3(1.0, 0.4, 0.1) is not allowed; vec3(0.0) for black or a brightness factor is fine). The check renders two different palettes and fails a shader whose output does not change with them.
- Use u_time so the image visibly changes within 9 seconds, and use u_resolution for aspect-correct coordinates, for example vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y. It must look right in a 390 by 844 portrait phone and a 1440 by 900 desktop.
- Not allowed in GLSL ES 1.00: #version, #extension, in/out, textures and samplers, fwidth and dFdx (no derivatives in WebGL 1), round(), trunc(), integer % and bit operators, uint, dynamic array indexing, recursion. Float literals need a decimal point (1.0, not 1). Loops need constant bounds of 96 or fewer.
- Write your own helpers: hash, value noise, fbm with at most 5 octaves, voronoi over a 3 by 3 neighbourhood, signed distance shapes. Antialias edges with smoothstep over about 1.5 pixels (1.5 / u_resolution.y). No ray marching.
- Keep it light: it must draw a 1024 by 1024 frame in a few milliseconds on a desktop GPU, so it can run full screen on a phone.
- Grain, if any, stays under 0.05 in brightness.
- Under 4,000 characters. In the JSON, frag is one string with \\n for new lines.

How to fill each field:
- id: lowercase words joined by hyphens, under 40 characters, naming the look ("receipt-thermal-scan", "sadu-band-drift"). Unique.
- name: 4 words at most. idea: one plain sentence on what it looks like and how it moves.
- use: 1 to 4 of these UI elements where it belongs: ${UI_ELEMENTS.join(", ")}.
- colors: the four default colors as #rrggbb for u_c0 (surface), u_c1 (ink), u_c2 (accent), u_c3 (support), taken from the palette of the card or lens it serves. The developer swaps in the product's palette later, so the shader must look good with other palettes too.
- reduced: the prefers-reduced-motion fallback. kind "static" draws one frame at "at" seconds and stops; kind "fade" draws that frame and fades it in over "ms" (200 to 600). Pick "at" where the composition looks finished, never a blank start. note: one short line on what the user sees.
- cardIds: the ids of the given cards it fits (one or more). lensIds: the lens ids it follows, or an empty array. Use only ids given in the request.
- culturalNotes: required when it follows a lens or a tradition card: name the tradition and its people exactly, and say what grammar the shader borrows. Leave it out otherwise.
- Leave out families: the script computes them.

${CULTURE_RULES}

The record type:

${typeText("UiElement", "ShaderRecipe")}

Reply with a JSON array of ShaderRecipe objects, or with one object when asked to fix one.`;

function buildPrompt(input: J13Input): string {
  const techniques = "domain-warped fbm, layered sine bands, voronoi cells, halftone dot screen, dot or line grid, grain over a soft gradient, caustics, smooth-min blobs, flow lines, moire of two line sets, truchet tiles, polar rings, scanlines, a single soft glow, sheared stripes, woven over-under bands, stacked strata, ripple rings, signed distance shapes on a grid, aurora curtains, ink bleed";
  if (input.mode === "lens") {
    return `Write ${input.count} shaders that follow this cultural lens. Each one turns a different part of its shape grammar or rhythm into motion (bands, repeats, proportions, color ratios, how it is made), and each uses a different technique. Abstract the grammar; never draw letters, objects, buildings or symbols.

${lensFacts(input.lens)}
${input.cards.length ? `\nCards from the same tradition you may tie with cardIds:\n${cardLines(input.cards, "texture")}` : ""}

Techniques to choose from (or your own): ${techniques}.`;
  }
  return `Write ${input.count} shaders for these ${input.kind} cards (families: ${input.families.join(", ")}). Each shader serves one or more of the cards: it carries the card's texture, material or idea into motion, with the card's palette as the default colors. Spread them over the families and over different cards, and give each one a different technique.

Cards:
${cardLines(input.cards, "texture")}

Techniques to choose from (or your own): ${techniques}.`;
}

export default defineJob<J13Input, ShaderRecipe>({
  id: "j13-shaders",
  kind: "shaders",
  model: OPUS,
  mode: "batch",
  schema: ShaderRecipeSchema,
  system: SYSTEM,
  // The trial used 20K to 25K thinking tokens for 3 to 5 shaders; 32K cut one reply off.
  maxTokens: 64000,
  expectedOutputTokens: 30000,
  effort: "high",

  loadInputs: () => j13Inputs(PER_GROUP, PER_LENS),
  requestId: (input) => `j13s-${input.key}`,
  buildPrompt,

  prepare: (raw, input) => prepareTies(raw, input),
  check: (rec) => checkTies(rec),
  finalize: (records) => uniqueIds(records, (r) => r.frag.replace(/\s+/g, "")),
  verify: async (records, ctx) => {
    const res = await checkShaders(records, RENDER_DIR);
    for (const r of res) if (!r.ok) ctx.log(`  shader ${r.id}: ${r.problems.join("; ")}`);
    return new Map(res.filter((r) => !r.ok).map((r) => [r.id, r.problems]));
  },
  repairPrompt: (record, problems, input) => repairText("ShaderRecipe", record, problems, inputContext(input as J13Input | undefined, "texture")),

  renderReview: (rec) => `<h3>${escapeHtml(rec.name)} <small>${escapeHtml(rec.id)}</small></h3>
<p>${escapeHtml(rec.idea)}</p>
<p><img alt="${escapeHtml(rec.id)} frames" style="max-width:100%" src="j13-shaders/${escapeHtml(rec.id)}.png"></p>
<p>${rec.colors.map((h, i) => `<span style="display:inline-block;width:40px;height:22px;background:${escapeHtml(h)};border:1px solid #888" title="u_c${i} ${escapeHtml(h)}"></span>`).join(" ")}
<b>Use:</b> ${escapeHtml(rec.use.join(", "))} <b>Reduced:</b> ${escapeHtml(`${rec.reduced.kind} at ${rec.reduced.at}s${rec.reduced.ms ? `, ${rec.reduced.ms} ms` : ""}: ${rec.reduced.note}`)}</p>
<p><b>Cards:</b> ${escapeHtml(rec.cardIds.join(", ") || "none")} <b>Families:</b> ${escapeHtml(rec.families.join(", ") || "none")} <b>Lenses:</b> ${escapeHtml(rec.lensIds.join(", ") || "none")}</p>
${rec.culturalNotes ? `<p><b>Culture:</b> ${escapeHtml(rec.culturalNotes)}</p>` : ""}
<details><summary>GLSL (${rec.frag.length} characters)</summary><pre>${escapeHtml(rec.frag)}</pre></details>`,
});
