/**
 * P1-J13 stunning layer, motion (VAL-14): about 120 MotionRecipe records, each WAAPI keyframes
 * plus easing and timing, tied to J3 card families (their motion verbs) and J6 lenses, with a
 * reduced-motion fallback. The script computes each recipe's CSS from its keyframes
 * (lib/motion-css.ts), so the WAAPI and CSS versions never drift.
 * Opus, batch: 2 recipes for each of the 16 lenses, 4 for each card family group (about 23).
 *
 * Every recipe is run in headless Chrome (lib/render-stunning.ts): WAAPI must play and visibly
 * move a demo element, the CSS must play the same values, and with prefers-reduced-motion on the
 * CSS must stand still (static) or change only opacity (fade). A failing recipe gets one repair
 * request carrying the problems; if it fails again it is dropped (rejects/j13-motion.jsonl).
 * Frame strips go to review/j13-motion/.
 *
 *   npx tsx run.ts j13-motion --dry
 */
import { join } from "node:path";
import { OPUS, PATHS } from "../config.ts";
import { CULTURE_RULES, cardLines, checkTies, inputContext, j13Inputs, lensFacts, prepareTies, repairText, uniqueIds, type J13Input } from "../lib/j13.ts";
import { defineJob } from "../lib/job.ts";
import { motionCss, motionStaticProblems } from "../lib/motion-css.ts";
import { PROMPT_RULES, typeText } from "../lib/prompt.ts";
import { checkMotions } from "../lib/render-stunning.ts";
import { escapeHtml } from "../lib/review.ts";
import { MotionRecipeSchema, UI_ELEMENTS, type MotionRecipe } from "../schema.ts";

export const PER_GROUP = 4;
export const PER_LENS = 2;
const RENDER_DIR = join(PATHS.review, "j13-motion");

const SYSTEM = `You write UI motion recipes for GoBanana, a tool that bends one app or web page into a wild but buildable design direction. Each recipe is one motion a developer adds to a shipped product screen: how a card enters, how list rows arrive, how a total changes, how a success moment lands, how a loading state breathes. It carries the motion verb of an ingredient card (a material, era, object, tradition, scale or rule) or of a cultural lens, built so it plays the same in every browser.

${PROMPT_RULES}

The taste bar (the owner's own boards of shipped product UI):
- Shipped-grade craft: purposeful, quick and physical. Motion explains what changed; it never performs for its own sake.
- Custom curves, not the default "ease" everywhere: cubic-bezier() tuned to the verb, or linear() for springs and settles. Bounce and wobble only when the card's verb asks for it.
- Fails the bar: spinning logos, endless bouncing, confetti cliches, long slow reveals that block the user, everything flying in from every side.

How the motion is built (the run check enforces it):
- keyframes is a WAAPI keyframe array: element.animate(keyframes, timing). Each keyframe may set only offset, easing, transform, opacity, clipPath and filter. Use px, %, deg and turn units and plain CSS functions: translate, translateX/Y, scale, rotate, skew, perspective with rotateX/Y for flips; inset(), polygon() and circle() for clip-path reveals and wipes; blur (12px at most), brightness, saturate for filter.
- The first and last keyframes must both set every property the recipe animates. Clip-path keyframes use the same function with the same number of points throughout, so they interpolate.
- It must really move: animate transform, clipPath or filter. Opacity alone is not a motion (it is the reduced fallback).
- easing on a keyframe is the curve to the next keyframe. timing.easing applies to the whole run, usually "linear" when the keyframes carry their own easing.
- Durations: enter 240 to 700 ms, exit 160 to 400 ms, hover and press 120 to 300 ms, change 200 to 600 ms, all under 1600 ms. A loop (trigger "loop" or iterations "infinite") is calm and lasts 1600 to 12000 ms, with direction "alternate" when it should breathe.
- fill: "both" for enter, "forwards" for exit, "none" for loops, "both" for hover, press and change.
- target "self" moves one element (stagger 0). target "children" moves every child of a list, grid or row, each delayed by stagger (30 to 90 ms) times its index.
- origin is the transform-origin, for example "50% 100%" or "0% 50%".
- Never flash: no opacity swing over 0.5 more than three times a second.
- The check plays it on a 180 by 110 card (self) or five list rows (children) and fails it when nothing visibly moves.

How to fill each field:
- id: lowercase words joined by hyphens, under 40 characters, naming the motion ("receipt-line-feed", "sadu-band-weave-in"). Unique.
- name: 4 words at most. verb: the card's or lens's motion verb it builds, 3 words at most. idea: one plain sentence on what moves and why it fits.
- use: 1 to 4 of these UI elements where it plays: ${UI_ELEMENTS.join(", ")}.
- trigger: enter, exit, loop, hover, press or change (a value or state updates).
- reduced: the prefers-reduced-motion fallback. kind "static": no movement, the end state shows at once (right for most hover, press, change and decorative loops). kind "fade": opacity only, over ms (150 to 300), for an entrance the user must notice. note: one short line on what the user sees.
- cardIds: the ids of the given cards whose motion it builds (one or more). lensIds: the lens ids it follows, or an empty array. Use only ids given in the request.
- culturalNotes: required when it follows a lens or a tradition card: name the tradition and its people exactly, and say what rhythm or making process the motion borrows. Leave it out otherwise.
- Leave out css and families: the script computes them.

${CULTURE_RULES}

The record type:

${typeText("UiElement", "MotionKeyframe", "MotionRecipe")}

Reply with a JSON array of MotionRecipe objects, or with one object when asked to fix one.`;

function buildPrompt(input: J13Input): string {
  if (input.mode === "lens") {
    return `Write ${input.count} motion recipes that follow this cultural lens and its motion verb. Each one turns a different part of its rhythm or making process into UI motion (how bands are woven, stacked, stamped or set), for a different trigger and UI element.

${lensFacts(input.lens)}
${input.cards.length ? `\nCards from the same tradition you may tie with cardIds:\n${cardLines(input.cards, "motion")}` : ""}`;
  }
  return `Write ${input.count} motion recipes for these ${input.kind} cards (families: ${input.families.join(", ")}). Each recipe builds the motion verb of one or more cards, with timing close to the card's ms. Spread them over the families, different cards, triggers and UI elements.

Cards:
${cardLines(input.cards, "motion")}`;
}

export default defineJob<J13Input, MotionRecipe>({
  id: "j13-motion",
  kind: "motion",
  model: OPUS,
  mode: "batch",
  schema: MotionRecipeSchema,
  system: SYSTEM,
  maxTokens: 24000,
  expectedOutputTokens: 9000,
  effort: "high",

  loadInputs: () => j13Inputs(PER_GROUP, PER_LENS),
  requestId: (input) => `j13m-${input.key}`,
  buildPrompt,

  prepare: (raw, input) => {
    const r = prepareTies(raw, input);
    if (!r || typeof r !== "object") return r;
    const o = r as Record<string, unknown>;
    try {
      o.css = motionCss(o as unknown as MotionRecipe);
    } catch {
      o.css = "";
    }
    return o;
  },
  check: (rec) => checkTies(rec),
  finalize: (records) => {
    const out = uniqueIds(records, (r) => JSON.stringify([r.keyframes, r.timing, r.target]));
    for (const r of out) r.css = motionCss(r); // ids may have changed
    return out;
  },
  verify: async (records, ctx) => {
    const fails = new Map<string, string[]>();
    const runnable: MotionRecipe[] = [];
    for (const r of records) {
      const p = motionStaticProblems(r);
      if (p.length) fails.set(r.id, p);
      else runnable.push(r);
    }
    const res = await checkMotions(runnable, RENDER_DIR);
    for (const r of res) if (!r.ok) fails.set(r.id, r.problems);
    for (const [id, p] of fails) ctx.log(`  motion ${id}: ${p.join("; ")}`);
    return fails;
  },
  repairPrompt: (record, problems, input) => repairText("MotionRecipe", record, problems, inputContext(input as J13Input | undefined, "motion")),

  renderReview: (rec) => `<h3>${escapeHtml(rec.name)} <small>${escapeHtml(rec.id)}, ${escapeHtml(rec.verb)}, ${escapeHtml(rec.trigger)}</small></h3>
<p>${escapeHtml(rec.idea)}</p>
<p><img alt="${escapeHtml(rec.id)} frames" style="max-width:100%" src="j13-motion/${escapeHtml(rec.id)}.png"></p>
<p><b>Use:</b> ${escapeHtml(rec.use.join(", "))} <b>Timing:</b> ${escapeHtml(`${rec.timing.duration} ms ${rec.timing.easing}, ${rec.timing.iterations}, ${rec.target}${rec.stagger ? ` stagger ${rec.stagger} ms` : ""}`)} <b>Reduced:</b> ${escapeHtml(`${rec.reduced.kind}${rec.reduced.ms ? ` ${rec.reduced.ms} ms` : ""}: ${rec.reduced.note}`)}</p>
<p><b>Cards:</b> ${escapeHtml(rec.cardIds.join(", ") || "none")} <b>Families:</b> ${escapeHtml(rec.families.join(", ") || "none")} <b>Lenses:</b> ${escapeHtml(rec.lensIds.join(", ") || "none")}</p>
${rec.culturalNotes ? `<p><b>Culture:</b> ${escapeHtml(rec.culturalNotes)}</p>` : ""}
<details><summary>CSS</summary><pre>${escapeHtml(rec.css)}</pre></details>`,
});
