/**
 * R2 round 2, second look: the same taste judge as r2-taste (Opus, batch, vision, same cached
 * prompt) on the rewrites from r2-rewrite-shaders and r2-rewrite-motion, from their own frame
 * strips (review/r2-rewrite-shaders/, review/r2-rewrite-motion/). A rewrite that still fails the
 * bar (verdictOf: literal, or under 3) is not given a third try: the overlay leaves the record out.
 *
 * Output kind "rewrite-verdicts" (lib/overlays.ts).
 *
 *   npx tsx run.ts r2-taste-rewrites --dry
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { JUDGE, PATHS } from "../config.ts";
import { defineJob, placeholderImage, type JobContext } from "../lib/job.ts";
import { answered } from "../lib/r2-rewrite.ts";
import { escapeHtml } from "../lib/review.ts";
import { readKind } from "../lib/shards.ts";
import { extractJson } from "../lib/validate.ts";
import type { MotionRecipe, ShaderRecipe } from "../schema.ts";
import { describe, SYSTEM, TasteVerdictSchema, verdictOf, type FullVerdict, type Input } from "./r2-taste.ts";

const dirOf = (kind: Input["kind"]) => (kind === "shaders" ? "r2-rewrite-shaders" : "r2-rewrite-motion");

const reqId = (input: Input) => `t2${input.kind === "shaders" ? "s" : "m"}-${input.rec.id}`.slice(0, 64);

/** Every rewrite; on a real run only the ones with no saved verdict yet (the runner keeps the earlier replies). */
function inputs(ctx: JobContext): Input[] {
  const skip = !ctx.dry && ctx.run && !ctx.run.fromRaw ? answered("r2-taste-rewrites") : new Set<string>();
  const out: Input[] = [];
  for (const kind of ["shaders", "motion"] as const) {
    let recs: (ShaderRecipe | MotionRecipe)[] = [];
    try {
      recs = readKind<ShaderRecipe | MotionRecipe>(PATHS.out, `${kind}-rewrites`);
    } catch {
      continue;
    }
    for (const rec of recs.sort((a, b) => a.id.localeCompare(b.id))) {
      const input: Input = { kind, rec, styles: rec.styles ?? [] };
      if (!skip.has(reqId(input))) out.push(input);
    }
  }
  return out;
}

export default defineJob<Input, FullVerdict>({
  id: "r2-taste-rewrites",
  kind: "rewrite-verdicts",
  model: JUDGE,
  mode: "batch",
  schema: TasteVerdictSchema,
  system: SYSTEM,
  maxTokens: 6000,
  expectedOutputTokens: 1200,
  effort: "medium",
  imageTokens: 400,

  loadInputs: inputs,
  requestId: reqId,
  buildPrompt: (input, ctx) => {
    let image: Anthropic.ImageBlockParam;
    if (ctx.dry) image = placeholderImage();
    else {
      const file = join(PATHS.review, dirOf(input.kind), `${input.rec.id}.png`);
      if (!existsSync(file)) throw new Error(`no frame strip at ${file}: rebuild ${dirOf(input.kind)} with --from-raw first`);
      image = { type: "image", source: { type: "base64", media_type: "image/png", data: readFileSync(file).toString("base64") } };
    }
    return [image, { type: "text", text: `${describe(input)}\n\nJudge this record.` }];
  },
  parse: (text) => [extractJson(text)],
  prepare: (raw, input) => {
    if (!raw || typeof raw !== "object") return raw;
    const r = raw as { verdict?: unknown; score?: unknown; literal?: unknown };
    const advice = r.verdict;
    const applied = typeof r.score === "number" && typeof r.literal === "boolean" && (advice === "keep" || advice === "rewrite" || advice === "drop") ? verdictOf({ advice, score: r.score, literal: r.literal }) : advice;
    return { ...r, id: input.rec.id, kind: input.kind, advice, verdict: applied };
  },
  finalize: (records, ctx) => {
    for (const kind of ["shaders", "motion"] as const) {
      const mine = records.filter((r) => r.kind === kind);
      ctx.log(`  ${kind} rewrites: ${mine.length} judged, pass ${mine.filter((r) => r.verdict === "keep").length}, literal ${mine.filter((r) => r.literal).length}, mean score ${(mine.reduce((s, r) => s + r.score, 0) / Math.max(1, mine.length)).toFixed(2)}`);
    }
    return records.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  },
  shardOf: (r) => r.kind,
  renderReview: (v) => `<h3>${escapeHtml(v.id)} <small>${escapeHtml(v.kind)}: ${escapeHtml(v.verdict)}, score ${v.score}, style ${v.styleFit}${v.literal ? ", literal" : ""}</small></h3>
<p><img alt="${escapeHtml(v.id)} frames" style="max-width:100%" src="${dirOf(v.kind)}/${escapeHtml(v.id)}.png"></p>
<ul>${v.problems.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`,
});
