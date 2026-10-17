/**
 * Refinement R3, round 3: gold growth proposals. Opus (the R3 v2 judge prompt, high effort)
 * proposes ratings for the g2l Bench run's directions and top 8 UI references that are not in the
 * gold set yet. Proposals go to banana-server/bench/gold-candidates/ for the owner to review; they
 * are marked unconfirmed and never read as gold (J10 reads bench/gold/ratings-gold.json only).
 *
 *   npx tsx run.ts r3-gold --dry
 *   npx tsx run.ts r3-gold
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { JUDGE } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { modelInputOk } from "../lib/thumbs.ts";
import { BENCH, briefText, directionText, GOLD_FILE, parseDirection, parseReferences, readRun, thumb, TOP_UI, type GoldFile, type RunBrief, type RunDirection, type RunRef } from "./j10-judge.ts";
import { directionBlocks, drawShots, SCORE_RUN, shotsBlock, SYSTEM_R3 } from "./r3-judge.ts";

export const CANDIDATES_DIR = join(BENCH, "gold-candidates");
const Score = z.number().int().min(1).max(5);

export const CandidateSchema = z.object({
  kind: z.enum(["direction", "reference"]),
  run: z.string(),
  briefId: z.string(),
  directionId: z.string(),
  title: z.string(),
  refId: z.string().optional(),
  imageUrl: z.string().optional(),
  sourceUrl: z.string().optional(),
  relevance: Score.optional(),
  coherence: Score.optional(),
  wow: Score.optional(),
  verdict: z.enum(["great", "good", "bad"]).optional(),
  reason: z.string().max(600),
});
export type Candidate = z.infer<typeof CandidateSchema>;

type Input = { kind: "direction"; brief: RunBrief; direction: RunDirection } | { kind: "references"; brief: RunBrief; direction: RunDirection; refs: RunRef[] };

/** g2l items not in the gold: every direction, and each searched direction's top 8 UI references the gold does not hold (by ref id or image). */
export function goldGrowthInputs(gold: GoldFile, run = readRun(SCORE_RUN)): Input[] {
  const goldDirs = new Set(gold.directions.map((g) => `${g.run}/${g.briefId}/${g.directionId}`));
  const goldRefs = new Set(gold.references.flatMap((g) => [g.refId, (g as { imageUrl?: string }).imageUrl ?? ""]).filter(Boolean));
  const out: Input[] = [];
  for (const brief of run.briefs) {
    for (const direction of brief.directions) {
      if (!goldDirs.has(`${run.run}/${brief.id}/${direction.id}`)) out.push({ kind: "direction", brief, direction });
      const refs = (direction.search?.references ?? []).filter((r) => r.zone === "ui" && modelInputOk(r)).slice(0, TOP_UI).filter((r) => !goldRefs.has(r.id) && !goldRefs.has(r.imageUrl ?? ""));
      if (refs.length) out.push({ kind: "references", brief, direction, refs });
    }
  }
  return out;
}

let goldCache: GoldFile | null = null;
const goldFile = () => (goldCache ??= JSON.parse(readFileSync(GOLD_FILE, "utf8")) as GoldFile);

export function reviewMarkdown(recs: readonly Candidate[]): string {
  const dirs = recs.filter((r) => r.kind === "direction");
  const refs = recs.filter((r) => r.kind === "reference");
  const lines = [
    `# Gold candidates from ${SCORE_RUN} (unconfirmed)`,
    "",
    "Proposed by Opus 5.5 (the R3 v2 judge prompt with 12 gold examples, high effort, atlas-build/jobs/r3-gold.ts). These are NOT gold: nothing reads this folder. To confirm, check each row, fix the score or verdict where you disagree, and move the rows you accept into bench/gold/ratings-gold.json.",
    "",
    `## Directions (${dirs.length})`,
    "",
    "| Brief | Direction | Relevance | Coherence | Wow | Reason |",
    "| --- | --- | --- | --- | --- | --- |",
    ...dirs.map((d) => `| ${d.briefId} | ${d.title} | ${d.relevance} | ${d.coherence} | ${d.wow} | ${d.reason.replace(/\|/g, "/")} |`),
    "",
    `## References (${refs.length}): great ${refs.filter((r) => r.verdict === "great").length}, good ${refs.filter((r) => r.verdict === "good").length}, bad ${refs.filter((r) => r.verdict === "bad").length}`,
    "",
    "| Brief | Direction | Image | Verdict | Reason |",
    "| --- | --- | --- | --- | --- |",
    ...refs.map((r) => `| ${r.briefId} | ${r.title} | [image](${r.imageUrl}) ([source](${r.sourceUrl})) | ${r.verdict} | ${r.reason.replace(/\|/g, "/")} |`),
    "",
  ];
  return lines.join("\n");
}

export default defineJob<Input, Candidate>({
  id: "r3-gold",
  kind: "work-gold-r3",
  model: JUDGE,
  mode: "batch",
  schema: CandidateSchema,
  system: SYSTEM_R3,
  maxTokens: 6000,
  expectedOutputTokens: 1500,
  imageTokens: 250,
  effort: "high",

  loadInputs: (ctx) => {
    const inputs = goldGrowthInputs(goldFile());
    ctx.log(`Gold candidates from ${SCORE_RUN}: ${inputs.filter((i) => i.kind === "direction").length} directions, ${inputs.flatMap((i) => (i.kind === "references" ? i.refs : [])).length} references in ${inputs.length} requests.`);
    return inputs;
  },
  requestId: (input) => `r3g-${input.kind === "direction" ? "d" : "r"}-${input.brief.id}-${input.direction.id}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64),
  async buildPrompt(input, ctx) {
    if (input.kind === "direction") {
      return [
        { type: "text", text: shotsBlock(drawShots(goldFile().directions, 4242, 12)), cache_control: { type: "ephemeral" } },
        ...(await directionBlocks(input.brief, input.direction, ctx)),
        { type: "text", text: "Rate this direction. Run the three relevance checks first, then score. This rating is a proposal for the gold set, so be careful and specific in the reason." },
      ];
    }
    const blocks: Anthropic.ContentBlockParam[] = [{ type: "text", text: `${briefText(input.brief)}\n${directionText(input.direction)}` }];
    blocks.push({ type: "text", text: `Judge these ${input.refs.length} references for this direction, in order. These verdicts are proposals for the gold set, so give a specific reason for each.` });
    for (const [i, r] of input.refs.entries()) {
      blocks.push({ type: "text", text: `Reference ${i + 1}: ${r.zone} zone, ${r.lane ?? "?"} lane.` });
      blocks.push(await thumb(r, ctx));
    }
    return blocks;
  },
  parse(text, input) {
    const base = { run: SCORE_RUN, briefId: input.brief.id, directionId: input.direction.id, title: input.direction.title };
    if (input.kind === "direction") return [{ ...base, kind: "direction", ...parseDirection(text) }];
    return parseReferences(text, input.refs.length).map((v, i) => {
      const r = input.refs[i]!;
      return { ...base, kind: "reference", refId: r.id, imageUrl: r.imageUrl, sourceUrl: r.sourceUrl, verdict: v.verdict, reason: v.reason };
    });
  },
  finalize(records, ctx) {
    mkdirSync(CANDIDATES_DIR, { recursive: true });
    const json = {
      version: 1,
      kind: "ratings-gold-candidates",
      confirmed: false,
      run: SCORE_RUN,
      madeBy: `Opus 5.5 (R3 v2 judge prompt, high effort), ${new Date().toISOString().slice(0, 10)}. Unconfirmed proposals for the owner; not gold.`,
      directions: records.filter((r) => r.kind === "direction").map((r) => ({ ...r, confirmed: false })),
      references: records.filter((r) => r.kind === "reference").map((r) => ({ ...r, confirmed: false })),
    };
    writeFileSync(join(CANDIDATES_DIR, `${SCORE_RUN}.json`), JSON.stringify(json, null, 1) + "\n");
    writeFileSync(join(CANDIDATES_DIR, `${SCORE_RUN}.md`), reviewMarkdown(records));
    ctx.log(`Candidates: ${join(CANDIDATES_DIR, `${SCORE_RUN}.json`)} and .md (${json.directions.length} directions, ${json.references.length} references, unconfirmed).`);
    return records;
  },
  shardOf: (r) => r.kind,
});
