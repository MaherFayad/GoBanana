/**
 * Refinement R3, round 1, pass 2: a second Opus pass only where the two r3-judge votes disagree on
 * the on-brief call (one says 4 or 5, the other 1 to 3). It sees the same examples as vote a, both
 * votes' scores and reasons, and decides. Then the report: held-out relevance agreement per seed
 * for the final judge (votes agree, else the second pass), and the g2l rescore.
 *
 *   npx tsx run.ts r3-judge-adj --dry
 *   npx tsx run.ts r3-judge-adj
 *
 * Reads out/v1/work-judge-r3/*.json (from `npx tsx run.ts r3-judge`). Writes out/v1/work-judge-r3-adj/,
 * review/r3-judge-report.md and banana-server/bench/runs/2026-10-17g2l/ratings-judge-r3.json
 * (directions from this judge, references copied from the J10 ratings-judge.json, whose prompt
 * did not change).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { JUDGE, PATHS } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { BENCH, GOLD_FILE, parseDirection, readRun, type GoldFile } from "./j10-judge.ts";
import { directionBlocks, keyOf, VERSION, near, R3RecordSchema, r3Inputs, relevanceRow, SCORE_RUN, SEEDS, shotsBlock, Stage, SYSTEM_R3, type Input as Pass1Input, type R3Record } from "./r3-judge.ts";

const Score = z.number().int().min(1).max(5);
export const AdjRecordSchema = z.object({
  stage: Stage,
  seed: z.number().int(),
  run: z.string(),
  briefId: z.string(),
  directionId: z.string(),
  relevance: Score,
  reason: z.string().max(600),
});
export type AdjRecord = z.infer<typeof AdjRecordSchema>;

/** shots: vote a's examples (v1), or the union of both votes' examples (v2), so the second pass sees more of the gold rater. */
type Input = { pass1: Pass1Input; shots: Pass1Input["shots"]; a: R3Record; b: R3Record };

const onBrief = (n: number) => n >= 4;

export function readPass1(dir = join(PATHS.out, "work-judge-r3")): R3Record[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => (JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown[]).map((r) => R3RecordSchema.parse(r)));
}

/** Pairs vote a and vote b per item; returns the pairs whose on-brief calls differ. */
export function disagreements(records: readonly R3Record[]): Array<{ a: R3Record; b: R3Record }> {
  const a = new Map(records.filter((r) => r.vote === "a").map((r) => [keyOf(r), r]));
  const out: Array<{ a: R3Record; b: R3Record }> = [];
  for (const rb of records.filter((r) => r.vote === "b")) {
    const ra = a.get(keyOf(rb));
    if (ra && onBrief(ra.relevance) !== onBrief(rb.relevance)) out.push({ a: ra, b: rb });
  }
  return out;
}

/** The final relevance per item: the votes' call when they agree (vote a's score), else the second pass. */
export function finalRelevance(records: readonly R3Record[], adj: readonly AdjRecord[]): Map<string, { a: R3Record; relevance: number; adjudicated: boolean }> {
  const adjBy = new Map(adj.map((r) => [keyOf(r), r]));
  const b = new Map(records.filter((r) => r.vote === "b").map((r) => [keyOf(r), r]));
  const out = new Map<string, { a: R3Record; relevance: number; adjudicated: boolean }>();
  for (const ra of records.filter((r) => r.vote === "a" && r.stage !== "rubric")) {
    const rb = b.get(keyOf(ra));
    const k = keyOf(ra);
    if (rb && onBrief(ra.relevance) !== onBrief(rb.relevance)) {
      const j = adjBy.get(k);
      if (j) out.set(k, { a: ra, relevance: j.relevance, adjudicated: true });
    } else out.set(k, { a: ra, relevance: ra.relevance, adjudicated: false });
  }
  return out;
}

export function finalReport(records: readonly R3Record[], adj: readonly AdjRecord[]): string {
  const fin = finalRelevance(records, adj);
  const lines = [
    "# R3 judge calibration (held-out gold only)",
    "",
    "Relevance agreement = same on-brief call (4 or 5 against 1 to 3) as the gold. Every fewshot item is judged by prompts whose examples come from the other two folds.",
    "",
    "| Variant | Relevance agreement | Gold on brief hit | Gold off brief hit | Second passes |",
    "| --- | --- | --- | --- | --- |",
  ];
  const row = (label: string, pairs: Array<{ judge: number; gold: number }>, extra = "") => {
    const r = relevanceRow(label, pairs);
    lines.push(`| ${label} | ${(r.share * 100).toFixed(1)}% (${r.agree} of ${r.n}) | ${r.tpr} | ${r.tnr} | ${extra} |`);
  };
  const cal = records.filter((r) => r.gold);
  row("rubric only, one vote", cal.filter((r) => r.stage === "rubric").map((r) => ({ judge: r.relevance, gold: r.gold!.relevance })));
  for (const seed of SEEDS) {
    for (const vote of ["a", "b"] as const) row(`fewshot seed ${seed}, vote ${vote} alone`, cal.filter((r) => r.stage === "fewshot" && r.seed === seed && r.vote === vote).map((r) => ({ judge: r.relevance, gold: r.gold!.relevance })));
    const f = [...fin.values()].filter((x) => x.a.stage === "fewshot" && x.a.seed === seed);
    row(`**fewshot seed ${seed}, final**`, f.map((x) => ({ judge: x.relevance, gold: x.a.gold!.relevance })), String(f.filter((x) => x.adjudicated).length));
  }
  const coh = cal.filter((r) => r.stage === "fewshot" && r.vote === "a");
  lines.push("", `Coherence within 1 (fewshot, vote a, all seeds): ${coh.filter((r) => near(r.coherence, r.gold!.coherence)).length} of ${coh.length}. Wow within 1: ${coh.filter((r) => near(r.wow, r.gold!.wow)).length} of ${coh.length}.`, "");
  const score = [...fin.values()].filter((x) => x.a.stage === "score");
  if (score.length) {
    lines.push(`## Run ${SCORE_RUN}`, "", `On brief (final): ${score.filter((x) => onBrief(x.relevance)).length} of ${score.length} (${score.filter((x) => x.adjudicated).length} second passes).`, "");
    const agentFile = join(BENCH, "runs", SCORE_RUN, "ratings.json");
    if (existsSync(agentFile)) {
      const agent = JSON.parse(readFileSync(agentFile, "utf8")) as { directions: Record<string, { relevance?: number }> };
      const pairs = score.flatMap((x) => {
        const g = agent.directions[`${x.a.briefId}/${x.a.directionId}`]?.relevance;
        return g === undefined ? [] : [{ judge: x.relevance, gold: g }];
      });
      const r = relevanceRow("agent", pairs);
      lines.push(`Against the agent's g2l ratings (not gold, a second check): ${(r.share * 100).toFixed(1)}% (${r.agree} of ${r.n}); agent on brief hit ${r.tpr}, agent off brief hit ${r.tnr}.`, "");
    }
  }
  return lines.join("\n");
}

/** g2l ratings in the ratings.json shape: directions from the R3 judge, references from J10's ratings-judge.json. */
export function scoreRatings(records: readonly R3Record[], adj: readonly AdjRecord[]) {
  const fin = [...finalRelevance(records, adj).values()].filter((x) => x.a.stage === "score");
  const j10File = join(BENCH, "runs", SCORE_RUN, "ratings-judge.json");
  const j10 = existsSync(j10File) ? (JSON.parse(readFileSync(j10File, "utf8")) as { references?: Record<string, string> }) : {};
  const directions: Record<string, unknown> = {};
  for (const x of fin) directions[`${x.a.briefId}/${x.a.directionId}`] = { briefId: x.a.briefId, directionId: x.a.directionId, relevance: x.relevance, coherence: x.a.coherence, wow: x.a.wow, note: x.a.reason };
  return {
    directions,
    references: j10.references ?? {},
    run: SCORE_RUN,
    exportedAt: new Date().toISOString(),
    ratedBy: "R3 judge (atlas-build/jobs/r3-judge.ts and r3-judge-adj.ts) for directions; J10 judge for references. Calibrated against agent-made gold.",
  };
}

let pass1Cache: R3Record[] | null = null;
const pass1 = () => (pass1Cache ??= readPass1());

export default defineJob<Input, AdjRecord>({
  id: "r3-judge-adj",
  kind: "work-judge-r3-adj",
  model: JUDGE,
  mode: "batch",
  schema: AdjRecordSchema,
  system: SYSTEM_R3,
  maxTokens: 4000,
  expectedOutputTokens: 1200,
  imageTokens: 250,
  // v1 used "high"; its second passes leaned on the rubric over the examples, so v2 uses medium.
  effort: VERSION === 1 ? "high" : "medium",

  loadInputs: (ctx) => {
    const records = pass1();
    if (records.length === 0) throw new Error("no pass 1 records: run `npx tsx run.ts r3-judge` first");
    const gold = JSON.parse(readFileSync(GOLD_FILE, "utf8")) as GoldFile;
    const all = r3Inputs(gold, SCORE_RUN, ["fewshot", "score"]);
    const byVote = (v: "a" | "b") => new Map(all.filter((i) => i.vote === v).map((i) => [keyOf({ ...i, briefId: i.brief.id, directionId: i.direction.id }), i]));
    const inputs = byVote("a");
    const inputsB = byVote("b");
    const pairs = disagreements(records);
    ctx.log(`Pass 1: ${records.length} records; ${pairs.length} items where the two votes disagree on the on-brief call.`);
    return pairs.flatMap((p) => {
      const pass1Input = inputs.get(keyOf(p.a));
      if (!pass1Input) return [];
      const shotsB = inputsB.get(keyOf(p.a))?.shots ?? [];
      const shots = VERSION === 1 ? pass1Input.shots : [...pass1Input.shots, ...shotsB.filter((s) => !pass1Input.shots.includes(s))];
      return [{ pass1: pass1Input, shots, a: p.a, b: p.b }];
    });
  },
  requestId: (input) => `r3a${VERSION === 1 ? "" : VERSION}-${input.a.stage}-s${input.a.seed}-${input.a.briefId}-${input.a.directionId}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64),
  async buildPrompt(input, ctx) {
    const blocks: Anthropic.ContentBlockParam[] = [];
    if (input.shots.length) blocks.push({ type: "text", text: shotsBlock(input.shots), cache_control: { type: "ephemeral" } });
    blocks.push(...(await directionBlocks(input.pass1.brief, input.pass1.direction, ctx)));
    blocks.push({
      type: "text",
      text: [
        "Two judges rated this direction and disagree on whether it is on brief:",
        `Judge A: relevance ${input.a.relevance}. ${input.a.reason}`,
        `Judge B: relevance ${input.b.relevance}. ${input.b.reason}`,
        "Decide the relevance yourself. Run the three relevance checks (page, world, idea) carefully, weigh both reasons, and remember that clashes and vague wording are coherence problems, not relevance.",
        'Answer with JSON only: {"page": "pass" | "fail", "world": "pass" | "soft" | "fail", "idea": "pass" | "soft", "relevance": n, "reason": "one plain line"}',
      ].join("\n"),
    });
    return blocks;
  },
  parse(text, input) {
    const d = parseDirection(text);
    return [{ stage: input.a.stage, seed: input.a.seed, run: input.a.run, briefId: input.a.briefId, directionId: input.a.directionId, relevance: d.relevance, reason: d.reason }];
  },
  finalize(adj, ctx) {
    const records = pass1();
    const report = finalReport(records, adj);
    mkdirSync(PATHS.review, { recursive: true });
    const file = join(PATHS.review, "r3-judge-report.md");
    writeFileSync(file, report + "\n");
    ctx.log(report);
    ctx.log(`Report: ${file}`);
    if (records.some((r) => r.stage === "score")) {
      readRun(SCORE_RUN);
      const out = join(BENCH, "runs", SCORE_RUN, "ratings-judge-r3.json");
      writeFileSync(out, JSON.stringify(scoreRatings(records, adj), null, 1) + "\n");
      ctx.log(`R3 judge ratings: ${out}`);
    }
    return adj;
  },
  shardOf: (r) => r.stage,
});
