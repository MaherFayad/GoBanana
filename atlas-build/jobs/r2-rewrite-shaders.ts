/**
 * R2 round 2: rewrites of the J13 shaders the taste pass (r2-taste) marked "rewrite" (cheap or
 * literal). Opus, batch, the J13 shader prompt plus the review. Every rewrite goes through the same
 * render check as J13 (lib/render-stunning.ts checkShaders), with one repair request; a rewrite
 * that fails twice is dropped, and the overlay then leaves the old shader out too.
 *
 * Output kind "shaders-rewrites": whole ShaderRecipe records with the old id, laid over the J13
 * shaders in the server layout (lib/overlays.ts). Frame strips go to review/r2-rewrite-shaders/.
 *
 *   npx tsx run.ts r2-rewrite-shaders --dry
 */
import { join } from "node:path";
import { OPUS, PATHS } from "../config.ts";
import { checkTies, prepareTies, repairText, inputContext } from "../lib/j13.ts";
import { defineJob } from "../lib/job.ts";
import { rewriteInputs, rewritePrompt, type RewriteInput } from "../lib/r2-rewrite.ts";
import { checkShaders } from "../lib/render-stunning.ts";
import { escapeHtml } from "../lib/review.ts";
import { ShaderRecipeSchema, type ShaderRecipe } from "../schema.ts";
import { SYSTEM } from "./j13-shaders.ts";

const RENDER_DIR = join(PATHS.review, "r2-rewrite-shaders");
type Input = RewriteInput<ShaderRecipe>;

export default defineJob<Input, ShaderRecipe>({
  id: "r2-rewrite-shaders",
  kind: "shaders-rewrites",
  model: OPUS,
  mode: "batch",
  schema: ShaderRecipeSchema,
  system: SYSTEM,
  maxTokens: 32000,
  expectedOutputTokens: 9000,
  effort: "high",

  loadInputs: (ctx) => rewriteInputs<ShaderRecipe>("shaders", ctx, "r2-rewrite-shaders", (id) => `rws-${id}`.slice(0, 64)),
  requestId: (input) => `rws-${input.rec.id}`.slice(0, 64),
  buildPrompt: (input) => rewritePrompt("ShaderRecipe", input, "texture"),
  prepare: (raw, input) => {
    const r = prepareTies(raw && typeof raw === "object" ? { ...(raw as object), id: input.rec.id } : raw, input.j13);
    return r;
  },
  check: (rec) => checkTies(rec),
  verify: async (records, ctx) => {
    const res = await checkShaders(records, RENDER_DIR);
    for (const r of res) if (!r.ok) ctx.log(`  shader ${r.id}: ${r.problems.join("; ")}`);
    return new Map(res.filter((r) => !r.ok).map((r) => [r.id, r.problems]));
  },
  repairPrompt: (record, problems, input) => repairText("ShaderRecipe", record, problems, inputContext((input as Input | undefined)?.j13, "texture")),
  renderReview: (rec) => `<h3>${escapeHtml(rec.name)} <small>${escapeHtml(rec.id)}, ${escapeHtml((rec.styles ?? []).join(", "))}</small></h3>
<p>${escapeHtml(rec.idea)}</p>
<p>New: <img alt="${escapeHtml(rec.id)} new frames" style="max-width:100%" src="r2-rewrite-shaders/${escapeHtml(rec.id)}.png"></p>
<p>Old: <img alt="${escapeHtml(rec.id)} old frames" style="max-width:100%" src="j13-shaders/${escapeHtml(rec.id)}.png"></p>
<details><summary>GLSL (${rec.frag.length} characters)</summary><pre>${escapeHtml(rec.frag)}</pre></details>`,
});
