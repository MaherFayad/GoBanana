/**
 * Refinement R7: judge bend directions offline, from their specs, with the trusted R3 judge (the
 * R4 job with the r7 budget). Bends the 10 Bench briefs with the local Atlas into
 * `banana-server/bench/runs/r7-<tag>/run.json` (dry, no Serper) unless it exists, then rates the 30
 * directions with SYSTEM_R3, the same 12 gold examples per vote and two votes a and b. Split votes go
 * to the R3 second pass (R7_PASS=adj). Request ids carry a hash of the brief and the spec the judge
 * reads, so a direction two bends share is judged once and keeps the same reply (no judge noise
 * between bends on unchanged directions). Budget key r7.
 *
 *   R7_TAG=0 npx tsx run.ts r7-judge-dirs --missing     # votes a and b, new directions only
 *   R7_TAG=0 npx tsx run.ts r7-judge-dirs --from-raw    # writes this tag's outputs from every saved reply
 *   R7_TAG=0 R7_PASS=adj npx tsx run.ts r7-judge-dirs --missing, then --from-raw
 *
 * Writes bench/runs/r7-<tag>/judge-votes.json, judge-adj.json and ratings-judge.json, and
 * review/r7-dirs-<tag>.md.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { JUDGE, PATHS, ROOT } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { BENCH, briefText, directionText, GOLD_FILE, parseDirection, readRun, type GoldFile, type RunBrief, type RunDirection } from "./j10-judge.ts";
import { directionBlocks, drawShots, shotsBlock, SYSTEM_R3 } from "./r3-judge.ts";

export const TAG = (process.env.R7_TAG ?? "0").replace(/[^a-zA-Z0-9]/g, "");
export const PASS: "votes" | "adj" = process.env.R7_PASS === "adj" ? "adj" : "votes";
export const RUN = `r7-${TAG}`;
const RUN_DIR = join(BENCH, "runs", RUN);
const ATLAS_DIR = join(ROOT, "out", "server", "v1");

const Score = z.number().int().min(1).max(5);
export const R7RecordSchema = z.object({
  tag: z.string(),
  pass: z.enum(["votes", "adj"]),
  vote: z.enum(["a", "b", "adj"]),
  briefId: z.string(),
  directionId: z.string(),
  title: z.string(),
  relevance: Score,
  coherence: Score.optional(),
  wow: Score.optional(),
  reason: z.string().max(600),
});
export type R7Record = z.infer<typeof R7RecordSchema>;

type Input = { vote: "a" | "b" | "adj"; brief: RunBrief; direction: RunDirection; shots: GoldFile["directions"]; a?: R7Record; b?: R7Record };

const onBrief = (n: number) => n >= 4;
/** Short hash of what the judge reads (the brief and the spec), so bends that share a direction share its reply. */
export const specHash = (b: RunBrief, d: RunDirection) => createHash("sha256").update(`${briefText(b)}
${directionText(d)}`).digest("hex").slice(0, 8);
const key = (r: { briefId: string; directionId: string }) => `${r.briefId}/${r.directionId}`;
/** The R3 score stage's example seeds (voteSeed(0, 0, vote) in r3-judge.ts): the same 12 examples per vote. */
const SHOT_SEED = { a: 1, b: 2 } as const;

/** Bends the Bench briefs into bench/runs/r7-<tag>/run.json unless that file exists. */
export function ensureRun(log: (s: string) => void): void {
  if (existsSync(join(RUN_DIR, "run.json"))) return;
  if (!existsSync(join(ATLAS_DIR, "manifest.json"))) throw new Error(`no local Atlas at ${ATLAS_DIR}: rebuild with --from-raw and ops.ts layout`);
  log(`Bending the Bench briefs into ${RUN_DIR} (dry, local Atlas).`);
  const server = join(ROOT, "..", "banana-server");
  const res = spawnSync(`node scripts/bench-run.mjs --dry --atlas ${JSON.stringify(ATLAS_DIR)} --date ${RUN}`, { cwd: server, shell: true, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`bench-run failed: ${res.stderr || res.stdout}`);
}

const readJson = <T>(file: string): T | null => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null);

/** Final relevance per direction: the votes' call when they agree (vote a's score), else the second pass. */
export function finalScores(votes: readonly R7Record[], adj: readonly R7Record[]): Array<{ a: R7Record; relevance: number; adjudicated: boolean } | { a: R7Record; relevance: null; adjudicated: true }> {
  const b = new Map(votes.filter((r) => r.vote === "b").map((r) => [key(r), r]));
  const j = new Map(adj.map((r) => [key(r), r]));
  return votes
    .filter((r) => r.vote === "a")
    .map((a) => {
      const rb = b.get(key(a));
      if (!rb || onBrief(a.relevance) === onBrief(rb.relevance)) return { a, relevance: a.relevance, adjudicated: false };
      const x = j.get(key(a));
      return x ? { a, relevance: x.relevance, adjudicated: true } : { a, relevance: null, adjudicated: true };
    });
}

export function report(tag: string, run: { briefs: RunBrief[] }, votes: readonly R7Record[], adj: readonly R7Record[]): string {
  const fin = finalScores(votes, adj);
  const decided = fin.filter((f) => f.relevance !== null);
  const on = decided.filter((f) => onBrief(f.relevance!)).length;
  const lines = [
    `# R7 directions, bend ${tag}`,
    "",
    `On brief (R3 judge, final): **${on} of ${decided.length}** (${decided.length ? ((on / decided.length) * 100).toFixed(1) : "0"}%), ${fin.filter((f) => f.adjudicated).length} second passes${fin.length > decided.length ? `, ${fin.length - decided.length} split votes not yet decided` : ""}.`,
    `Vote a alone: ${votes.filter((r) => r.vote === "a" && onBrief(r.relevance)).length} of ${votes.filter((r) => r.vote === "a").length}; vote b alone: ${votes.filter((r) => r.vote === "b" && onBrief(r.relevance)).length} of ${votes.filter((r) => r.vote === "b").length}.`,
    "",
    "| Brief | Direction | Element | Relevance (a, b, final) | Reason (vote a) |",
    "| --- | --- | --- | --- | --- |",
  ];
  const b = new Map(votes.filter((r) => r.vote === "b").map((r) => [key(r), r]));
  for (const f of fin) {
    const d = run.briefs.find((x) => x.id === f.a.briefId)?.directions.find((x) => x.id === f.a.directionId);
    lines.push(`| ${f.a.briefId} | ${f.a.title} | ${d?.mechanic?.element ?? "?"} | ${f.a.relevance}, ${b.get(key(f.a))?.relevance ?? "?"}, ${f.relevance ?? "?"} | ${f.a.reason.replace(/\|/g, "/")} |`);
  }
  return lines.join("\n") + "\n";
}

let goldCache: GoldFile | null = null;
const gold = () => (goldCache ??= JSON.parse(readFileSync(GOLD_FILE, "utf8")) as GoldFile);

export default defineJob<Input, R7Record>({
  id: "r7-dirs",
  kind: PASS === "adj" ? "work-judge-r7-adj" : "work-judge-r7",
  model: JUDGE,
  mode: "batch",
  schema: R7RecordSchema,
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
      ctx.log(`R7 ${RUN}: ${out.length} votes over ${out.length / 2} directions.`);
      return out;
    }
    const votes = readJson<R7Record[]>(join(RUN_DIR, "judge-votes.json"));
    if (!votes) throw new Error(`no votes for ${RUN}: run without R7_PASS=adj first`);
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
    ctx.log(`R7 ${RUN}: ${out.length} split votes for the second pass.`);
    return out;
  },
  requestId: (input) => `r7d-${input.vote}-${input.brief.id.slice(0, 20)}-${input.direction.id}-${specHash(input.brief, input.direction)}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64),
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
    const base = { tag: TAG, pass: PASS, vote: input.vote, briefId: input.brief.id, directionId: input.direction.id, title: input.direction.title, relevance: d.relevance, reason: d.reason };
    return [input.vote === "adj" ? base : { ...base, coherence: d.coherence, wow: d.wow }];
  },
  finalize(records, ctx) {
    mkdirSync(RUN_DIR, { recursive: true });
    if (ctx.dry) return records;
    writeFileSync(join(RUN_DIR, PASS === "adj" ? "judge-adj.json" : "judge-votes.json"), JSON.stringify(records, null, 1) + "\n");
    const votes = PASS === "adj" ? (readJson<R7Record[]>(join(RUN_DIR, "judge-votes.json")) ?? []) : [...records];
    const adj = PASS === "adj" ? [...records] : (readJson<R7Record[]>(join(RUN_DIR, "judge-adj.json")) ?? []);
    const run = readRun(RUN);
    const text = report(TAG, run, votes, adj);
    mkdirSync(PATHS.review, { recursive: true });
    writeFileSync(join(PATHS.review, `r7-dirs-${TAG}.md`), text);
    const directions: Record<string, unknown> = {};
    for (const f of finalScores(votes, adj)) if (f.relevance !== null) directions[key(f.a)] = { briefId: f.a.briefId, directionId: f.a.directionId, relevance: f.relevance, coherence: f.a.coherence, wow: f.a.wow, note: f.a.reason };
    writeFileSync(join(RUN_DIR, "ratings-judge.json"), JSON.stringify({ directions, references: {}, run: RUN, exportedAt: new Date().toISOString(), ratedBy: "R3 judge (r3-judge.ts prompt) via atlas-build/jobs/r7-judge-dirs.ts, specs only" }, null, 1) + "\n");
    ctx.log(text);
    return records;
  },
  shardOf: (r) => `${r.tag}-${r.pass}`,
});
