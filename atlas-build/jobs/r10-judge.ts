/**
 * Refinement R10: the R3 spec-only judge (on brief and wow) on the R10 bend, a copy of
 * jobs/r9-judge-merged.ts with the r10 budget key. The request ids keep the verify round's "r9m"
 * formula (the vote, the brief and a hash of the text the judge reads), and raw/r10-judge.jsonl was
 * started as a copy of raw/r9-merged.jsonl, so a direction R10 leaves unchanged reuses its verify
 * round votes word for word (no cost, no judge noise) and only changed directions get new votes.
 *
 *   V_SET=weak|bench V_TAG=0 npx tsx run.ts r10-judge --missing   (then --from-raw)
 *   V_SET=weak|bench V_TAG=0 V_PASS=adj npx tsx run.ts r10-judge --missing   (then --from-raw)
 *
 * Writes bench/runs/r10-v<w|b><tag>/ and review/r10-judge-<w|b><tag>.md.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { JUDGE, PATHS, ROOT } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { BENCH, GOLD_FILE, parseDirection, readRun, type GoldFile, type RunBrief, type RunDirection } from "./j10-judge.ts";
import { directionBlocks, drawShots, shotsBlock, SYSTEM_R3 } from "./r3-judge.ts";
import { R4RecordSchema, finalScores, type R4Record } from "./r4-judge-dirs.ts";
import { report, textHash } from "./r6-judge-dirs.ts";

export const SET: "weak" | "bench" = process.env.V_SET === "bench" ? "bench" : "weak";
export const TAG = (process.env.V_TAG ?? "0").replace(/[^a-zA-Z0-9]/g, "");
export const PASS: "votes" | "adj" = process.env.V_PASS === "adj" ? "adj" : "votes";
export const RUN = `r10-v${SET === "weak" ? "w" : "b"}${TAG}`;
const RUN_DIR = join(BENCH, "runs", RUN);
const ATLAS_DIR = join(ROOT, "out", "server", "v1");
const BRIEFS_FILE = join(BENCH, SET === "weak" ? "r6-weak-briefs.json" : "briefs.json");

type Input = { vote: "a" | "b" | "adj"; brief: RunBrief; direction: RunDirection; shots: GoldFile["directions"]; a?: R4Record; b?: R4Record };

const onBrief = (n: number) => n >= 4;
const key = (r: { briefId: string; directionId: string }) => `${r.briefId}/${r.directionId}`;
const SHOT_SEED = { a: 1, b: 2 } as const;

function ensureRun(log: (s: string) => void): void {
  if (existsSync(join(RUN_DIR, "run.json"))) return;
  if (!existsSync(join(ATLAS_DIR, "manifest.json"))) throw new Error(`no local Atlas at ${ATLAS_DIR}: rebuild with --from-raw and ops.ts layout`);
  log(`Bending ${SET} briefs into ${RUN_DIR} (dry, local Atlas).`);
  const server = join(ROOT, "..", "banana-server");
  const res = spawnSync(`node scripts/bench-run.mjs --briefs ${JSON.stringify(BRIEFS_FILE)} --dry --atlas ${JSON.stringify(ATLAS_DIR)} --date ${RUN}`, { cwd: server, shell: true, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`bench-run failed: ${res.stderr || res.stdout}`);
}

const readJson = <T>(file: string): T | null => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null);

let goldCache: GoldFile | null = null;
const gold = () => (goldCache ??= JSON.parse(readFileSync(GOLD_FILE, "utf8")) as GoldFile);

export default defineJob<Input, R4Record>({
  id: "r10-judge",
  kind: PASS === "adj" ? "work-judge-r10-adj" : "work-judge-r10",
  model: JUDGE,
  mode: "batch",
  schema: R4RecordSchema,
  system: SYSTEM_R3,
  maxTokens: PASS === "adj" ? 4000 : 3000,
  expectedOutputTokens: PASS === "adj" ? 1200 : 600,
  imageTokens: 250,
  effort: "medium",

  loadInputs: (ctx) => {
    ensureRun(ctx.log);
    const run = readRun(RUN);
    const g = gold();
    if (PASS === "votes") {
      const out: Input[] = [];
      for (const vote of ["a", "b"] as const) {
        const shots = drawShots(g.directions, SHOT_SEED[vote]);
        for (const brief of run.briefs) for (const direction of brief.directions) out.push({ vote, brief, direction, shots });
      }
      ctx.log(`R10 ${RUN}: ${out.length} votes over ${out.length / 2} directions.`);
      return out;
    }
    const votes = readJson<R4Record[]>(join(RUN_DIR, "judge-votes.json"));
    if (!votes) throw new Error(`no votes for ${RUN}: run without V_PASS=adj first`);
    const byB = new Map(votes.filter((r) => r.vote === "b").map((r) => [key(r), r]));
    const out: Input[] = [];
    for (const a of votes.filter((r) => r.vote === "a")) {
      const b = byB.get(key(a));
      if (!b || onBrief(a.relevance) === onBrief(b.relevance)) continue;
      const brief = run.briefs.find((x) => x.id === a.briefId)!;
      const direction = brief.directions.find((x) => x.id === a.directionId)!;
      const shots = [...drawShots(g.directions, SHOT_SEED.a), ...drawShots(g.directions, SHOT_SEED.b)].filter((s, i, all) => all.indexOf(s) === i);
      out.push({ vote: "adj", brief, direction, shots, a, b });
    }
    ctx.log(`R10 ${RUN}: ${out.length} split votes for the second pass.`);
    return out;
  },
  // The vote's own text (and, for a second pass, both votes' scores) decide the id, never the tag or set.
  requestId: (input) => `r9m-${input.vote}-${input.brief.id}-${textHash(input.brief, input.direction)}${input.vote === "adj" ? `-${input.a!.relevance}${input.b!.relevance}` : ""}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64),
  async buildPrompt(input, ctx) {
    const blocks: Anthropic.ContentBlockParam[] = [{ type: "text", text: shotsBlock(input.shots), cache_control: { type: "ephemeral" } }];
    blocks.push(...(await directionBlocks(input.brief, input.direction, ctx)));
    if (input.vote !== "adj") {
      blocks.push({ type: "text", text: "Rate this direction. Run the three relevance checks first, then score." });
      return blocks;
    }
    blocks.push({
      type: "text",
      text: [
        "Two judges rated this direction and disagree on whether it is on brief:",
        `Judge A: relevance ${input.a!.relevance}. ${input.a!.reason}`,
        `Judge B: relevance ${input.b!.relevance}. ${input.b!.reason}`,
        "Decide the relevance yourself. Run the three relevance checks (page, world, idea) carefully, weigh both reasons, and remember that clashes and vague wording are coherence problems, not relevance.",
        'Answer with JSON only: {"page": "pass" | "fail", "world": "pass" | "soft" | "fail", "idea": "pass" | "soft", "relevance": n, "reason": "one plain line"}',
      ].join("\n"),
    });
    return blocks;
  },
  parse(text, input) {
    const d = parseDirection(text);
    const base = { tag: `${SET[0]}${TAG}`, pass: PASS, vote: input.vote, briefId: input.brief.id, directionId: input.direction.id, title: input.direction.title, relevance: d.relevance, reason: d.reason };
    return [input.vote === "adj" ? base : { ...base, coherence: d.coherence, wow: d.wow }];
  },
  finalize(records, ctx) {
    mkdirSync(RUN_DIR, { recursive: true });
    if (ctx.dry) return records;
    // --from-raw rebuilds every saved reply of the job: keep this run's directions only.
    const run = readRun(RUN);
    const ids = new Set(run.briefs.flatMap((b) => b.directions.map((d) => `${b.id}/${d.id}`)));
    const mine = records.filter((r) => ids.has(key(r)));
    writeFileSync(join(RUN_DIR, PASS === "adj" ? "judge-adj.json" : "judge-votes.json"), JSON.stringify(mine, null, 1) + "\n");
    const votes = PASS === "adj" ? (readJson<R4Record[]>(join(RUN_DIR, "judge-votes.json")) ?? []) : [...mine];
    const adj = PASS === "adj" ? [...mine] : (readJson<R4Record[]>(join(RUN_DIR, "judge-adj.json")) ?? []);
    const text = report(`${SET} ${TAG}`, run, votes, adj).replace("# R6 weak domain directions", "# R10 directions");
    mkdirSync(PATHS.review, { recursive: true });
    writeFileSync(join(PATHS.review, `r10-judge-${SET[0]}${TAG}.md`), text);
    const directions: Record<string, unknown> = {};
    for (const f of finalScores(votes, adj)) if (f.relevance !== null) directions[key(f.a)] = { briefId: f.a.briefId, directionId: f.a.directionId, relevance: f.relevance, coherence: f.a.coherence, wow: f.a.wow, note: f.a.reason };
    writeFileSync(join(RUN_DIR, "ratings-judge.json"), JSON.stringify({ directions, references: {}, run: RUN, exportedAt: new Date().toISOString(), ratedBy: "R3 judge (r3-judge.ts prompt) via atlas-build/jobs/r10-judge.ts, specs only" }, null, 1) + "\n");
    ctx.log(text);
    return records;
  },
  shardOf: (r) => `${r.tag}-${r.pass}`,
});
