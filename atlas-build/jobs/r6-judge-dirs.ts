/**
 * Refinement R6, task B: judge bend directions for the weak domains (telecom, food delivery, real
 * estate) offline, from their specs, with the trusted R3 judge, as R4 did for the Bench briefs
 * (jobs/r4-judge-dirs.ts: the same system prompt, the same 12 gold examples per vote, two votes, the
 * R3 second pass where they split).
 *
 * Bends banana-server/bench/r6-weak-briefs.json (15 briefs, 3 directions each) with the local
 * Atlas (`out/server/v1`, no Serper: `bench-run.mjs --briefs ... --dry --atlas`) into
 * bench/runs/r6-<tag>/run.json. Request ids hash the brief and direction text the judge reads, so a
 * direction that did not change between tags reuses its reply: run with --missing, then --from-raw.
 *
 *   R6_TAG=0 npx tsx run.ts r6-judge-dirs --dry
 *   R6_TAG=0 npx tsx run.ts r6-judge-dirs --missing && R6_TAG=0 npx tsx run.ts r6-judge-dirs --from-raw
 *   R6_TAG=0 R6_PASS=adj npx tsx run.ts r6-judge-dirs --missing   (then --from-raw)
 *
 * Writes bench/runs/r6-<tag>/judge-votes.json, judge-adj.json, ratings-judge.json and
 * review/r6-dirs-<tag>.md. Budget key r6 (job id `r6-dirs`).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { cyrb53 } from "../../banana-server/lib/bend/prng.ts";
import { JUDGE, PATHS, ROOT } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { BENCH, GOLD_FILE, briefText, directionText, parseDirection, readRun, type GoldFile, type RunBrief, type RunDirection } from "./j10-judge.ts";
import { directionBlocks, drawShots, shotsBlock, SYSTEM_R3 } from "./r3-judge.ts";
import { R4RecordSchema, finalScores, type R4Record } from "./r4-judge-dirs.ts";

export const TAG = (process.env.R6_TAG ?? "0").replace(/[^a-zA-Z0-9]/g, "");
export const PASS: "votes" | "adj" = process.env.R6_PASS === "adj" ? "adj" : "votes";
export const RUN = `r6-${TAG}`;
const RUN_DIR = join(BENCH, "runs", RUN);
const ATLAS_DIR = join(ROOT, "out", "server", "v1");
export const BRIEFS_FILE = join(BENCH, "r6-weak-briefs.json");
export const WEAK = { telecom: ["esim-plan-picker", "telecom-"], food: ["ramadan-food-delivery", "food-"], "real estate": ["dubai-real-estate", "villa-", "rental-", "apartment-", "property-"] } as const;

type Input = { vote: "a" | "b" | "adj"; brief: RunBrief; direction: RunDirection; shots: GoldFile["directions"]; a?: R4Record; b?: R4Record };

const onBrief = (n: number) => n >= 4;
const key = (r: { briefId: string; directionId: string }) => `${r.briefId}/${r.directionId}`;
const SHOT_SEED = { a: 1, b: 2 } as const;
/** What the judge reads of a direction, hashed: the same text reuses the same reply. */
export const textHash = (brief: RunBrief, d: RunDirection) => cyrb53(`${briefText(brief)}\n${directionText(d)}`).toString(36);

export function ensureRun(log: (s: string) => void): void {
  if (existsSync(join(RUN_DIR, "run.json"))) return;
  if (!existsSync(join(ATLAS_DIR, "manifest.json"))) throw new Error(`no local Atlas at ${ATLAS_DIR}: rebuild with --from-raw and ops.ts layout`);
  log(`Bending the R6 briefs into ${RUN_DIR} (dry, local Atlas).`);
  const server = join(ROOT, "..", "banana-server");
  const res = spawnSync(`node scripts/bench-run.mjs --briefs ${JSON.stringify(BRIEFS_FILE)} --dry --atlas ${JSON.stringify(ATLAS_DIR)} --date ${RUN}`, { cwd: server, shell: true, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`bench-run failed: ${res.stderr || res.stdout}`);
}

const readJson = <T>(file: string): T | null => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null);

const domainOf = (briefId: string) => (Object.entries(WEAK).find(([, ps]) => ps.some((p) => briefId.startsWith(p)))?.[0] ?? "other");

export function report(tag: string, run: { briefs: RunBrief[] }, votes: readonly R4Record[], adj: readonly R4Record[]): string {
  const fin = finalScores(votes, adj);
  const decided = fin.filter((f) => f.relevance !== null);
  const share = (xs: typeof decided) => `${xs.filter((f) => onBrief(f.relevance!)).length} of ${xs.length}`;
  const mean = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : "n/a");
  const lines = [`# R6 weak domain directions, bend ${tag}`, "", `On brief (R3 judge, final): **${share(decided)}**, ${fin.filter((f) => f.adjudicated).length} second passes${fin.length > decided.length ? `, ${fin.length - decided.length} split votes not yet decided` : ""}.`, "", "| Domain | On brief | Mean relevance | Mean coherence | Mean wow |", "| --- | --- | --- | --- | --- |"];
  for (const dom of [...Object.keys(WEAK), "other"]) {
    const xs = decided.filter((f) => domainOf(f.a.briefId) === dom);
    if (xs.length) lines.push(`| ${dom} | ${share(xs)} | ${mean(xs.map((f) => f.relevance!))} | ${mean(xs.map((f) => f.a.coherence ?? 0))} | ${mean(xs.map((f) => f.a.wow ?? 0))} |`);
  }
  lines.push("", "| Brief | Direction | Element | Relevance (a, b, final) | Coherence | Wow | Reason (vote a) |", "| --- | --- | --- | --- | --- | --- | --- |");
  const b = new Map(votes.filter((r) => r.vote === "b").map((r) => [key(r), r]));
  for (const f of fin) {
    const d = run.briefs.find((x) => x.id === f.a.briefId)?.directions.find((x) => x.id === f.a.directionId);
    lines.push(`| ${f.a.briefId} | ${f.a.title} | ${d?.mechanic?.element ?? "?"} | ${f.a.relevance}, ${b.get(key(f.a))?.relevance ?? "?"}, ${f.relevance ?? "?"} | ${f.a.coherence ?? "?"} | ${f.a.wow ?? "?"} | ${f.a.reason.replace(/\|/g, "/")} |`);
  }
  return lines.join("\n") + "\n";
}

let goldCache: GoldFile | null = null;
const gold = () => (goldCache ??= JSON.parse(readFileSync(GOLD_FILE, "utf8")) as GoldFile);

export default defineJob<Input, R4Record>({
  id: "r6-dirs",
  kind: PASS === "adj" ? "work-judge-r6-adj" : "work-judge-r6",
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
      ctx.log(`R6 ${RUN}: ${out.length} votes over ${out.length / 2} directions.`);
      return out;
    }
    const votes = readJson<R4Record[]>(join(RUN_DIR, "judge-votes.json"));
    if (!votes) throw new Error(`no votes for ${RUN}: run without R6_PASS=adj first`);
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
    ctx.log(`R6 ${RUN}: ${out.length} split votes for the second pass.`);
    return out;
  },
  // The vote's own text (and, for a second pass, both votes' scores) decide the id, never the tag.
  requestId: (input) => `r6d-${input.vote}-${input.brief.id}-${textHash(input.brief, input.direction)}${input.vote === "adj" ? `-${input.a!.relevance}${input.b!.relevance}` : ""}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64),
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
    const votes = PASS === "adj" ? (readJson<R4Record[]>(join(RUN_DIR, "judge-votes.json")) ?? []) : [...records];
    const adj = PASS === "adj" ? [...records] : (readJson<R4Record[]>(join(RUN_DIR, "judge-adj.json")) ?? []);
    const run = readRun(RUN);
    const text = report(TAG, run, votes, adj);
    mkdirSync(PATHS.review, { recursive: true });
    writeFileSync(join(PATHS.review, `r6-dirs-${TAG}.md`), text);
    const directions: Record<string, unknown> = {};
    for (const f of finalScores(votes, adj)) if (f.relevance !== null) directions[key(f.a)] = { briefId: f.a.briefId, directionId: f.a.directionId, relevance: f.relevance, coherence: f.a.coherence, wow: f.a.wow, note: f.a.reason };
    writeFileSync(join(RUN_DIR, "ratings-judge.json"), JSON.stringify({ directions, references: {}, run: RUN, exportedAt: new Date().toISOString(), ratedBy: "R3 judge (r3-judge.ts prompt) via atlas-build/jobs/r6-judge-dirs.ts, specs only" }, null, 1) + "\n");
    ctx.log(text);
    return records;
  },
  shardOf: (r) => `${r.tag}-${r.pass}`,
});
