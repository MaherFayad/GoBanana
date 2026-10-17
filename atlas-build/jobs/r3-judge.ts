/**
 * Refinement R3, round 1: J10 judge calibration on brief relevance (pass 1 of 2).
 *
 * J10's relevance agreement with the 30 gold directions swung between 69% and 80% around the 75%
 * trust line. This job tries two changes and measures them on held-out gold only:
 *
 * - "rubric": a clearer rubric for what on brief means (page, world, idea), no examples. One vote.
 * - "fewshot": the rubric plus 8 gold examples (text only, with the gold scores and reason). The gold
 *   directions are split into 3 stratified folds per seed; a direction is judged only by prompts
 *   whose examples come from the other two folds, so every scored item is held out. Seeds 1 to 3
 *   reshuffle the folds. Two votes per item (a and b) draw different examples; where they disagree
 *   on the on-brief call, the second Opus pass (r3-judge-adj.ts) decides.
 * - "score": the same judge on bench run 2026-10-17g2l (examples from the whole gold set, two votes).
 *
 *   npx tsx run.ts r3-judge --dry
 *   npx tsx run.ts r3-judge --limit 4     # trial
 *   npx tsx run.ts r3-judge
 *   npx tsx run.ts r3-judge-adj           # pass 2 on the disagreements, then the report
 *
 * Output: out/v1/work-judge-r3/*.json (the upload skips work- kinds) and review/r3-judge-report.md.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { JUDGE, PATHS } from "../config.ts";
import { defineJob, type JobContext } from "../lib/job.ts";
import { modelInputOk } from "../lib/thumbs.ts";
import { briefText, directionText, GOLD_FILE, parseDirection, readRun, SYSTEM, thumb, type GoldDirection, type GoldFile, type RunBrief, type RunDirection } from "./j10-judge.ts";

/** The run the score stage rates (R3_SCORE_RUN overrides, for rescoring later runs with this judge). */
export const SCORE_RUN = process.env.R3_SCORE_RUN ?? "2026-10-17g2l";
export const SEEDS = [1, 2, 3] as const;
export const FOLDS = 3;
/** Version: 1 is the first rubric (it named gold items as examples, so its held-out numbers are optimistic); 2 is the default. */
export const VERSION = process.env.R3_JUDGE_V === "1" ? 1 : 2;
export const SHOTS = VERSION === 1 ? 8 : 12;
const DIR_UI = 4;
const DIR_ART = 2;

const OLD_RELEVANCE =
  "- relevance: does the idea fit this brief's page, product and market? 4 or 5 means on brief. A mechanic the page does not have (a progress bar on a page with no steps, a total on a page with no total) or a tradition from another region on a market brief caps relevance at 3.";

/** Version 1 of the relevance rubric. Its examples were taken from gold items (leakage): kept only to replay v1. */
export const RELEVANCE_RUBRIC_V1 = `- relevance: is this idea for THIS brief's page, product and audience? Check three things:
  1. Page: the mechanic acts on something this page really has and does (plan cards on a picker, steps on a checkout or onboarding, a total on a checkout, the one prompt of an empty state, the offers of an offers page). A mechanic on a part the page does not have (a progress bar with no steps, a total with no total, an empty state on a listing) caps relevance at 2.
  2. World: the look's world (material, era, craft, culture) connects to the product, its audience or its market, or is neutral and serves the page's job (giant type on pricing, restraint on banking). On a market brief (gcc), a tradition from another region (Egyptian, Japanese, Swedish) caps relevance at 3; on a global brief any world may fit if it suits the product and audience. A world with no tie at all to the product (dried leaves on fitness, a boxing poster on Ramadan offers, neon cyberpunk for kids reading) caps at 2.
  3. Idea: the direction changes how the page works or reads. A bare rule ("giant buttons", "no rounded corners", "giant chevrons") or a texture that only decorates dividers, borders or one button is 3 at most, unless the rule is exactly the restraint this brief and the taste bar call for.
  Scores: 5 passes all three with a world specific to this brief; 4 passes all three; 3 fails one check softly (decoration, a region miss, a thin idea); 2 fails the page or world check outright; 1 has nothing to do with the brief.
  Judge relevance on these checks only. Mood words that do not show, ingredients that clash and a vague signature lower coherence or wow, not relevance.`;

/** Version 2: the same three checks, examples that are not in the gold set, wildness, and clashes that break the idea. */
export const RELEVANCE_RUBRIC_V2 = `- relevance: is this idea for THIS brief's page, product and audience? Check three things:
  1. Page: the mechanic acts on something this page really has and does (plan cards on a picker, steps on a checkout or onboarding, a total on a checkout, the one prompt of an empty state, the offers of an offers page). A mechanic on a part the page does not have (a step tracker on a page with no steps, a running total on a page with no total) caps relevance at 3.
  2. World: the look's world (material, era, craft, culture) connects to the product, its audience or its market, or is neutral and serves the page's job (big type on a page about one number, restraint on a page about trust). On a market brief (gcc), a tradition from another region (Mexican papel picado, Norse runestones) caps relevance at 3. On a global brief the world may come from anywhere: at wildness 4 or 5 a far world is on brief when it gives the page a clear, warm or striking voice its audience would enjoy; at wildness 1 or 2 it should feel native to the product. A world that works against the product (funeral black for a kids app, a hospital look for a food app) caps at 2.
  3. Idea: the direction changes how the page works or reads. A bare rule ("only serif type", "everything in caps") or a texture that only decorates dividers, borders or one small control is 3 at most, unless the rule is exactly the restraint this brief and the taste bar call for.
  Scores: 5 passes all three with a world specific to this brief; 4 passes all three; 3 fails one check softly (decoration, a region miss, a thin idea); 2 fails the page or world check outright; 1 has nothing to do with the brief.
  One off note (a mood word that does not show, a vague signature) lowers coherence, not relevance. But when the look, the mood and the twist pull in two directions so the page would not read as one idea for this product, relevance is 3 at most.`;

export const RELEVANCE_RUBRIC = VERSION === 1 ? RELEVANCE_RUBRIC_V1 : RELEVANCE_RUBRIC_V2;

export const SYSTEM_R3 = (() => {
  if (!SYSTEM.includes(OLD_RELEVANCE)) throw new Error("j10-judge SYSTEM changed: update r3-judge's relevance line");
  return SYSTEM.replace(OLD_RELEVANCE, RELEVANCE_RUBRIC).replace(
    '- for a direction: {"relevance": n, "coherence": n, "wow": n, "reason": "one plain line"}',
    '- for a direction: {"page": "pass" | "fail", "world": "pass" | "soft" | "fail", "idea": "pass" | "soft", "relevance": n, "coherence": n, "wow": n, "reason": "one plain line"}',
  );
})();

export const Stage = z.enum(["rubric", "fewshot", "score"]);
export type StageT = z.infer<typeof Stage>;
const Score = z.number().int().min(1).max(5);
export const R3RecordSchema = z.object({
  stage: Stage,
  seed: z.number().int(),
  vote: z.enum(["a", "b"]),
  run: z.string(),
  briefId: z.string(),
  directionId: z.string(),
  relevance: Score,
  coherence: Score,
  wow: Score,
  reason: z.string().max(600),
  gold: z.object({ relevance: Score, coherence: Score, wow: Score }).optional(),
});
export type R3Record = z.infer<typeof R3RecordSchema>;

export type Input = { stage: StageT; seed: number; vote: "a" | "b"; fold: number; run: string; brief: RunBrief; direction: RunDirection; gold?: GoldDirection; shots: GoldDirection[] };

// ---------------------------------------------------------------------------------------------
// Folds and examples (pure, seeded)

/** mulberry32: a small seeded generator, so folds and draws repeat exactly. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(xs: readonly T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const onBrief = (n: number) => n >= 4;

/** Stratified folds: on-brief items spread first, then the rest, round robin over a seeded shuffle. Returns fold per gold index. */
export function folds(gold: readonly GoldDirection[], seed: number, k = FOLDS): number[] {
  const rand = rng(seed * 7919);
  const idx = shuffle(gold.map((_, i) => i), rand);
  const order = [...idx.filter((i) => onBrief(gold[i]!.relevance)), ...idx.filter((i) => !onBrief(gold[i]!.relevance))];
  const out = new Array<number>(gold.length).fill(0);
  order.forEach((i, n) => (out[i] = n % k));
  return out;
}

/** Examples from a pool: every on-brief item (at most half the shots), then a seeded draw of the rest, in a seeded order. */
export function drawShots(pool: readonly GoldDirection[], seed: number, n = SHOTS): GoldDirection[] {
  const rand = rng(seed);
  const pos = shuffle(pool.filter((g) => onBrief(g.relevance)), rand).slice(0, Math.floor(n / 2));
  const neg = shuffle(pool.filter((g) => !onBrief(g.relevance)), rand).slice(0, n - pos.length);
  return shuffle([...pos, ...neg], rand);
}

const voteSeed = (seed: number, fold: number, vote: "a" | "b") => seed * 1000 + fold * 10 + (vote === "a" ? 1 : 2);

/** Every request: rubric (one vote, no examples), fewshot (3 seeds x 2 votes, held-out folds) and score (g2l, 2 votes). */
export function r3Inputs(gold: GoldFile, scoreRun: string | null, stages: readonly StageT[] = ["rubric", "fewshot", "score"]): Input[] {
  const out: Input[] = [];
  const found = gold.directions.map((g) => {
    const run = readRun(g.run);
    const brief = run.briefs.find((b) => b.id === g.briefId);
    const direction = brief?.directions.find((d) => d.id === g.directionId);
    return brief && direction ? { g, brief, direction } : null;
  });
  if (stages.includes("rubric")) {
    for (const f of found) if (f) out.push({ stage: "rubric", seed: 0, vote: "a", fold: 0, run: f.g.run, brief: f.brief, direction: f.direction, gold: f.g, shots: [] });
  }
  if (stages.includes("fewshot")) {
    for (const seed of SEEDS) {
      const fold = folds(gold.directions, seed);
      for (const vote of ["a", "b"] as const) {
        const shotsByFold = Array.from({ length: FOLDS }, (_, k) => drawShots(gold.directions.filter((_, i) => fold[i] !== k), voteSeed(seed, k, vote)));
        found.forEach((f, i) => {
          if (f) out.push({ stage: "fewshot", seed, vote, fold: fold[i]!, run: f.g.run, brief: f.brief, direction: f.direction, gold: f.g, shots: shotsByFold[fold[i]!]! });
        });
      }
    }
  }
  if (stages.includes("score") && scoreRun) {
    const run = readRun(scoreRun);
    for (const vote of ["a", "b"] as const) {
      const shots = drawShots(gold.directions, voteSeed(0, 0, vote));
      for (const brief of run.briefs) for (const direction of brief.directions) out.push({ stage: "score", seed: 0, vote, fold: 0, run: run.run, brief, direction, shots });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Prompt

let goldCache: GoldFile | null = null;
const goldFile = () => (goldCache ??= JSON.parse(readFileSync(GOLD_FILE, "utf8")) as GoldFile);

function shotText(g: GoldDirection & { reason?: string; title?: string }): string {
  const run = readRun(g.run);
  const brief = run.briefs.find((b) => b.id === g.briefId)!;
  const d = brief.directions.find((x) => x.id === g.directionId)!;
  return `${briefText(brief)}\n${directionText(d)}\nGold rating: relevance ${g.relevance}, coherence ${g.coherence}, wow ${g.wow}. Why: ${g.reason ?? ""}`;
}

export function shotsBlock(shots: readonly GoldDirection[]): string {
  return [
    "Worked examples from the Bench's gold rater (text only; their images are not shown). Match this rater's line between 3 and 4 on relevance.",
    ...shots.map((s, i) => `Example ${i + 1}:\n${shotText(s)}`),
    "End of examples. Now the direction to rate.",
  ].join("\n\n");
}

/** The direction under judgement: brief, spec and its first references (as J10 shows them). */
export async function directionBlocks(brief: RunBrief, direction: RunDirection, ctx: JobContext): Promise<Anthropic.ContentBlockParam[]> {
  const blocks: Anthropic.ContentBlockParam[] = [{ type: "text", text: `${briefText(brief)}\n${directionText(direction)}` }];
  const refs = direction.search?.references ?? [];
  const shown = [...refs.filter((r) => r.zone === "ui" && modelInputOk(r)).slice(0, DIR_UI), ...refs.filter((r) => r.zone === "art" && modelInputOk(r)).slice(0, DIR_ART)];
  if (shown.length === 0) blocks.push({ type: "text", text: "This direction was not searched: rate it on the idea alone." });
  else {
    blocks.push({ type: "text", text: `Its first ${shown.length} references, for context:` });
    for (const r of shown) blocks.push(await thumb(r, ctx));
  }
  return blocks;
}

export const keyOf = (r: { stage: string; seed: number; run: string; briefId: string; directionId: string }) => `${r.stage}/${r.seed}/${r.run}/${r.briefId}/${r.directionId}`;

// ---------------------------------------------------------------------------------------------
// Agreement

export type Row = { label: string; agree: number; n: number; share: number; tpr: string; tnr: string };

/** Relevance agreement (same on-brief call), with the hit rate on gold on-brief and gold off-brief items. */
export function relevanceRow(label: string, pairs: ReadonlyArray<{ judge: number; gold: number }>): Row {
  const agree = pairs.filter((p) => onBrief(p.judge) === onBrief(p.gold)).length;
  const pos = pairs.filter((p) => onBrief(p.gold));
  const neg = pairs.filter((p) => !onBrief(p.gold));
  return {
    label,
    agree,
    n: pairs.length,
    share: pairs.length ? Math.round((agree / pairs.length) * 1000) / 1000 : 0,
    tpr: `${pos.filter((p) => onBrief(p.judge)).length} of ${pos.length}`,
    tnr: `${neg.filter((p) => !onBrief(p.judge)).length} of ${neg.length}`,
  };
}

export const near = (a: number, b: number) => Math.abs(a - b) <= 1;

export function pass1Report(records: readonly R3Record[]): string {
  const lines = ["# R3 judge, pass 1", "", "| Variant | Relevance agreement | Gold on brief hit | Gold off brief hit | Coherence within 1 | Wow within 1 |", "| --- | --- | --- | --- | --- | --- |"];
  const groups = new Map<string, R3Record[]>();
  for (const r of records.filter((x) => x.gold)) groups.set(`${r.stage} seed ${r.seed} vote ${r.vote}`, [...(groups.get(`${r.stage} seed ${r.seed} vote ${r.vote}`) ?? []), r]);
  for (const [label, rs] of [...groups].sort()) {
    const row = relevanceRow(label, rs.map((r) => ({ judge: r.relevance, gold: r.gold!.relevance })));
    const coh = rs.filter((r) => near(r.coherence, r.gold!.coherence)).length;
    const wow = rs.filter((r) => near(r.wow, r.gold!.wow)).length;
    lines.push(`| ${label} | ${(row.share * 100).toFixed(1)}% (${row.agree} of ${row.n}) | ${row.tpr} | ${row.tnr} | ${coh} of ${rs.length} | ${wow} of ${rs.length} |`);
  }
  const score = records.filter((r) => r.stage === "score");
  for (const vote of ["a", "b"] as const) {
    const rs = score.filter((r) => r.vote === vote);
    if (rs.length) lines.push("", `Score run, vote ${vote}: ${rs.filter((r) => onBrief(r.relevance)).length} of ${rs.length} on brief.`);
  }
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------------------------

export default defineJob<Input, R3Record>({
  id: "r3-judge",
  kind: "work-judge-r3",
  model: JUDGE,
  mode: "batch",
  schema: R3RecordSchema,
  system: SYSTEM_R3,
  maxTokens: 3000,
  expectedOutputTokens: 600,
  imageTokens: 250,
  effort: "medium",

  loadInputs: (ctx) => {
    if (!existsSync(GOLD_FILE)) throw new Error(`no gold ratings at ${GOLD_FILE}`);
    const stages = (process.env.R3_STAGES?.split(",").map((s) => Stage.parse(s.trim())) ?? Stage.options) as StageT[];
    const inputs = r3Inputs(goldFile(), SCORE_RUN, stages);
    ctx.log(`R3 judge pass 1: ${inputs.length} requests (${stages.join(", ")}).`);
    return inputs;
  },
  requestId: (input) => {
    const i = input.stage === "score" ? `${input.brief.id}-${input.direction.id}` : String(goldFile().directions.indexOf(input.gold!));
    return `r3j${VERSION === 1 ? "" : VERSION}-${input.stage}-s${input.seed}-${input.vote}-${i}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
  },
  async buildPrompt(input, ctx) {
    const blocks: Anthropic.ContentBlockParam[] = [];
    // The examples block is shared by every item in a fold (same seed and vote): cache it after the system prefix.
    if (input.shots.length) blocks.push({ type: "text", text: shotsBlock(input.shots), cache_control: { type: "ephemeral" } });
    blocks.push(...(await directionBlocks(input.brief, input.direction, ctx)));
    blocks.push({ type: "text", text: "Rate this direction. Run the three relevance checks first, then score." });
    return blocks;
  },
  parse(text, input) {
    const d = parseDirection(text);
    const g = input.gold;
    return [
      {
        stage: input.stage,
        seed: input.seed,
        vote: input.vote,
        run: input.run,
        briefId: input.brief.id,
        directionId: input.direction.id,
        ...d,
        ...(g ? { gold: { relevance: g.relevance, coherence: g.coherence, wow: g.wow } } : {}),
      },
    ];
  },
  finalize(records, ctx) {
    const report = pass1Report(records);
    mkdirSync(PATHS.review, { recursive: true });
    const file = join(PATHS.review, "r3-judge-pass1.md");
    writeFileSync(file, report);
    ctx.log(report);
    ctx.log(`Report: ${file}`);
    return records;
  },
  shardOf: (r) => `${r.stage}-s${r.seed}-${r.vote}`,
});
