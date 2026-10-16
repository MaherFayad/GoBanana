/**
 * R2 round 2: rewrites of the J13 motion recipes the taste pass (r2-taste) marked "rewrite".
 * Opus, batch, the J13 motion prompt plus the review. The script computes the CSS from the
 * keyframes (lib/motion-css.ts), and every rewrite goes through the same run check as J13 (static
 * rules, then WAAPI and CSS in headless Chrome), with one repair request; a rewrite that fails twice
 * is dropped, and the overlay then leaves the old recipe out too.
 *
 * Output kind "motion-rewrites": whole MotionRecipe records with the old id, laid over the J13
 * motion in the server layout (lib/overlays.ts). Frame strips go to review/r2-rewrite-motion/.
 *
 *   npx tsx run.ts r2-rewrite-motion --dry
 */
import { join } from "node:path";
import { OPUS, PATHS } from "../config.ts";
import { checkTies, inputContext, prepareTies, repairText } from "../lib/j13.ts";
import { defineJob } from "../lib/job.ts";
import { motionCss, motionStaticProblems } from "../lib/motion-css.ts";
import { rewriteInputs, rewritePrompt, type RewriteInput } from "../lib/r2-rewrite.ts";
import { checkMotions } from "../lib/render-stunning.ts";
import { escapeHtml } from "../lib/review.ts";
import { MotionRecipeSchema, type MotionRecipe } from "../schema.ts";
import { SYSTEM } from "./j13-motion.ts";

const RENDER_DIR = join(PATHS.review, "r2-rewrite-motion");
type Input = RewriteInput<MotionRecipe>;

export default defineJob<Input, MotionRecipe>({
  id: "r2-rewrite-motion",
  kind: "motion-rewrites",
  model: OPUS,
  mode: "batch",
  schema: MotionRecipeSchema,
  system: SYSTEM,
  maxTokens: 16000,
  expectedOutputTokens: 5000,
  effort: "high",

  loadInputs: () => rewriteInputs<MotionRecipe>("motion"),
  requestId: (input) => `rwm-${input.rec.id}`.slice(0, 64),
  buildPrompt: (input) => rewritePrompt("MotionRecipe", input, "motion"),
  prepare: (raw, input) => {
    const r = prepareTies(raw && typeof raw === "object" ? { ...(raw as object), id: input.rec.id } : raw, input.j13);
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
  verify: async (records, ctx) => {
    const fails = new Map<string, string[]>();
    const runnable: MotionRecipe[] = [];
    for (const r of records) {
      const p = motionStaticProblems(r);
      if (p.length) fails.set(r.id, p);
      else runnable.push(r);
    }
    for (const r of await checkMotions(runnable, RENDER_DIR)) if (!r.ok) fails.set(r.id, r.problems);
    for (const [id, p] of fails) ctx.log(`  motion ${id}: ${p.join("; ")}`);
    return fails;
  },
  repairPrompt: (record, problems, input) => repairText("MotionRecipe", record, problems, inputContext((input as Input | undefined)?.j13, "motion")),
  renderReview: (rec) => `<h3>${escapeHtml(rec.name)} <small>${escapeHtml(rec.id)}, ${escapeHtml(rec.verb)}, ${escapeHtml(rec.trigger)}, ${escapeHtml((rec.styles ?? []).join(", "))}</small></h3>
<p>${escapeHtml(rec.idea)}</p>
<p>New: <img alt="${escapeHtml(rec.id)} new frames" style="max-width:100%" src="r2-rewrite-motion/${escapeHtml(rec.id)}.png"></p>
<p>Old: <img alt="${escapeHtml(rec.id)} old frames" style="max-width:100%" src="j13-motion/${escapeHtml(rec.id)}.png"></p>
<p><b>Timing:</b> ${escapeHtml(JSON.stringify(rec.timing))}</p>
<details><summary>Keyframes</summary><pre>${escapeHtml(JSON.stringify(rec.keyframes, null, 1))}</pre></details>`,
});
