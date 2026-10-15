/**
 * P1-J10 Banana Bench judge (docs/next-step-plan.md 6.3 and section 8). One job, two parts:
 *
 * 1. Calibration: the judge rates the 100 gold items in banana-server/bench/gold/ratings-gold.json
 *    (directions: relevance, coherence, wow; references: great, good, bad). Agreement with the gold
 *    is measured per metric, and the judge is trusted only on metrics where it agrees 75% or more
 *    of the time (plan 6.3). The gold is agent-made at the owner's request (banana-server/DECISIONS.md,
 *    2026-10-16), so this calibrates to an agent's taste guided by docs/taste-bar.md.
 * 2. Scoring: the judge rates every direction and its top 8 UI references in the Atlas-engine
 *    Bench runs (bench/runs/<date>/run.json with engine.atlas set, from
 *    `node scripts/bench-run.mjs --atlas <dir>`), newest 4 by default or J10_RUNS=a,b,c,d.
 *
 *   npx tsx run.ts j10-judge --dry      # every prompt (placeholder images), the estimate, the budget check
 *   npx tsx run.ts j10-judge            # needs Atlas-engine Bench runs; refuses without them
 *
 * Output: out/v1/judge/<calibration|run>.json (one record per rating; the upload skips this
 * kind), review/j10-judge-report.md (agreement per metric, trusted metrics, scores per run) and,
 * for each scored run, banana-server/bench/runs/<date>/ratings-judge.json in the ratings.json
 * shape, so `node bench/score.mjs bench/runs/<date> --ratings bench/runs/<date>/ratings-judge.json`
 * scores it. Thumbnails are fetched into memory at the small size (lib/thumbs.ts) and never written.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { JUDGE, PATHS, ROOT } from "../config.ts";
import { defineJob, placeholderImage, type JobContext } from "../lib/job.ts";
import { fetchThumbBlock } from "../lib/thumbs.ts";
import { extractJson } from "../lib/validate.ts";

export const BENCH = join(ROOT, "..", "banana-server", "bench");
export const GOLD_FILE = join(BENCH, "gold", "ratings-gold.json");
/** Plan 6.3: the judge is trusted on a metric only at this agreement or more. */
export const TRUST = 0.75;
/** Scored runs (plan 6.3: 4 scored runs). */
export const MAX_RUNS = 4;
/** Top UI references judged per direction (as the Bench precision metric). */
export const TOP_UI = 8;
/** Thumbnails shown with a direction: UI and art. */
const DIR_UI = 4;
const DIR_ART = 2;

const Verdict = z.enum(["great", "good", "bad"]);
export type VerdictT = z.infer<typeof Verdict>;
const Score = z.number().int().min(1).max(5);

export const JudgeRecordSchema = z.object({
  mode: z.enum(["calibrate", "score"]),
  run: z.string(),
  kind: z.enum(["direction", "reference"]),
  briefId: z.string(),
  directionId: z.string(),
  refId: z.string().optional(),
  relevance: Score.optional(),
  coherence: Score.optional(),
  wow: Score.optional(),
  verdict: Verdict.optional(),
  reason: z.string().max(400),
  gold: z.object({ relevance: Score.optional(), coherence: Score.optional(), wow: Score.optional(), verdict: Verdict.optional() }).optional(),
});
export type JudgeRecord = z.infer<typeof JudgeRecordSchema>;

// ---------------------------------------------------------------------------------------------
// Bench data

type RunRef = { id: string; zone: "ui" | "art"; lane?: string; query?: string; title?: string; imageUrl?: string; thumbUrl?: string; sourceUrl?: string };
type RunDirection = {
  id: string;
  title: string;
  twist?: string;
  move?: string;
  mechanic?: { element?: string; how?: string };
  ingredients?: Record<string, string>;
  spec?: Record<string, unknown>;
  search?: { references?: RunRef[] };
};
type RunBrief = { id: string; brief: string; platform: string; wildness: number; market?: string; mustKeep?: string[]; directions: RunDirection[] };
export type BenchRun = { run: string; engine?: { atlas?: unknown }; briefs: RunBrief[] };

type GoldDirection = { run: string; briefId: string; directionId: string; relevance: number; coherence: number; wow: number };
type GoldReference = { run: string; briefId: string; directionId: string; refId: string; verdict: VerdictT };
type GoldFile = { directions: GoldDirection[]; references: GoldReference[] };

export type Input =
  | { kind: "direction"; mode: "calibrate" | "score"; run: string; brief: RunBrief; direction: RunDirection; gold?: GoldDirection }
  | { kind: "references"; mode: "calibrate" | "score"; run: string; brief: RunBrief; direction: RunDirection; refs: RunRef[]; gold?: GoldReference[] };

const runCache = new Map<string, BenchRun>();
export function readRun(run: string, bench = BENCH): BenchRun {
  const hit = runCache.get(run);
  if (hit) return hit;
  const r = JSON.parse(readFileSync(join(bench, "runs", run, "run.json"), "utf8")) as BenchRun;
  runCache.set(run, r);
  return r;
}

/** Atlas-engine runs (engine.atlas set), newest first, at most MAX_RUNS; J10_RUNS overrides. */
export function atlasRuns(bench = BENCH, env = process.env.J10_RUNS): string[] {
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean);
  const dir = join(bench, "runs");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, "run.json")))
    .filter((d) => !!readRun(d, bench).engine?.atlas)
    .sort()
    .reverse()
    .slice(0, MAX_RUNS);
}

function findDirection(run: BenchRun, briefId: string, directionId: string): { brief: RunBrief; direction: RunDirection } | null {
  const brief = run.briefs.find((b) => b.id === briefId);
  const direction = brief?.directions.find((d) => d.id === directionId);
  return brief && direction ? { brief, direction } : null;
}

/** Calibration inputs: one per gold direction, one per gold direction group of references. */
export function calibrationInputs(gold: GoldFile, bench = BENCH): Input[] {
  const out: Input[] = [];
  for (const g of gold.directions) {
    const found = findDirection(readRun(g.run, bench), g.briefId, g.directionId);
    if (found) out.push({ kind: "direction", mode: "calibrate", run: g.run, ...found, gold: g });
  }
  const groups = new Map<string, GoldReference[]>();
  for (const g of gold.references) {
    const k = `${g.run}/${g.briefId}/${g.directionId}`;
    groups.set(k, [...(groups.get(k) ?? []), g]);
  }
  for (const list of groups.values()) {
    const first = list[0]!;
    const found = findDirection(readRun(first.run, bench), first.briefId, first.directionId);
    if (!found) continue;
    const refs = list.map((g) => found.direction.search?.references?.find((r) => r.id === g.refId)).filter((r): r is RunRef => !!r);
    if (refs.length > 0) out.push({ kind: "references", mode: "calibrate", run: first.run, ...found, refs, gold: list.filter((g) => refs.some((r) => r.id === g.refId)) });
  }
  return out;
}

/** Scoring inputs for one run: every direction, and its top 8 UI references when it was searched. */
export function scoringInputs(run: BenchRun): Input[] {
  const out: Input[] = [];
  for (const brief of run.briefs) {
    for (const direction of brief.directions) {
      out.push({ kind: "direction", mode: "score", run: run.run, brief, direction });
      const ui = (direction.search?.references ?? []).filter((r) => r.zone === "ui").slice(0, TOP_UI);
      if (ui.length > 0) out.push({ kind: "references", mode: "score", run: run.run, brief, direction, refs: ui });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Prompt

function tasteBar(): string {
  const file = join(ROOT, "..", "docs", "taste-bar.md");
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

export const SYSTEM = `You are the Banana Bench judge for GoBanana, a tool that bends one app or web page into wild but buildable design directions and finds design references for each.

You rate one of two things.

A direction (an idea for one page), three scores from 1 to 5:
- relevance: does the idea fit this brief's page, product and market? 4 or 5 means on brief. A mechanic the page does not have (a progress bar on a page with no steps, a total on a page with no total) or a tradition from another region on a market brief caps relevance at 3.
- coherence: do the ingredients, the twist, the mechanic and the page belong together? Two looks that pull apart, or a twist unrelated to the title, score 2 or less.
- wow: would a designer stop scrolling for it? A rule with no idea ("only one accent color", "no rounded corners") scores 1 or 2; a fresh, specific, buildable idea scores 4 or 5.

References (images found for a direction), one verdict each:
- great: could sit on the owner's boards described in the taste bar below, and is on the brief's page (UI) or on the direction's idea (art).
- good: on page or on idea, but generic.
- bad: off page, off idea, a UI kit or component sheet, clip art, a stock illustration, or below the bar.
- Several tilted concept phones in a row cap at good, however polished. Judge from the image, never from the title.

Answer with JSON only, no other text:
- for a direction: {"relevance": n, "coherence": n, "wow": n, "reason": "one plain line"}
- for references: {"verdicts": [{"verdict": "great" | "good" | "bad", "reason": "one plain line"}, ...]}, one per image, in the order shown.
Reasons are one plain sentence, no em dashes.

The taste bar:

${tasteBar()}`;

function briefText(brief: RunBrief): string {
  return `Brief: ${brief.brief} (${brief.platform}, wildness ${brief.wildness} of 5${brief.market ? `, market ${brief.market}` : ""}${brief.mustKeep?.length ? `, must keep: ${brief.mustKeep.join(", ")}` : ""}).`;
}

export function directionText(d: RunDirection): string {
  const spec = d.spec ?? {};
  const pick = (k: string) => (typeof spec[k] === "string" ? `${k}: ${spec[k] as string}` : null);
  return [
    `Direction: ${d.title}${d.twist ? `, twist: ${d.twist}` : ""}${d.move ? ` (move: ${d.move})` : ""}.`,
    d.mechanic ? `Mechanic on ${d.mechanic.element ?? "?"}: ${d.mechanic.how ?? ""}` : null,
    d.ingredients ? `Ingredients: ${Object.entries(d.ingredients).map(([k, v]) => `${k} ${v}`).join("; ")}.` : null,
    ...["layout", "color", "typography", "texture", "signature", "whyItFits"].map(pick),
  ]
    .filter(Boolean)
    .join("\n");
}

async function thumb(r: RunRef, ctx: JobContext): Promise<Anthropic.ContentBlockParam> {
  if (ctx.dry) return placeholderImage();
  const t = await fetchThumbBlock({ imageUrl: r.imageUrl ?? null, thumbUrl: r.thumbUrl ?? null });
  return t.ok ? t.block : { type: "text", text: "(this image did not load: judge it bad)" };
}

// ---------------------------------------------------------------------------------------------
// Replies and agreement

export function parseDirection(text: string): { relevance: number; coherence: number; wow: number; reason: string } {
  const j = extractJson(text) as Record<string, unknown>;
  return { relevance: Number(j.relevance), coherence: Number(j.coherence), wow: Number(j.wow), reason: String(j.reason ?? "") };
}

export function parseReferences(text: string, count: number): Array<{ verdict: string; reason: string }> {
  const j = extractJson(text) as { verdicts?: unknown } | unknown[];
  const list = Array.isArray(j) ? j : (j as { verdicts?: unknown }).verdicts;
  if (!Array.isArray(list)) throw new Error("no verdicts array");
  if (list.length !== count) throw new Error(`${list.length} verdicts for ${count} images`);
  return list.map((v) => (typeof v === "string" ? { verdict: v.toLowerCase(), reason: "" } : { verdict: String((v as { verdict?: unknown }).verdict ?? "").toLowerCase(), reason: String((v as { reason?: unknown }).reason ?? "") }));
}

export type Agreement = { metric: string; rule: string; agree: number; n: number; share: number | null; trusted: boolean };

/** Agreement with the gold per metric, from the calibration records. */
export function agreement(records: readonly JudgeRecord[]): Agreement[] {
  const cal = records.filter((r) => r.mode === "calibrate" && r.gold);
  const dirs = cal.filter((r) => r.kind === "direction");
  const refs = cal.filter((r) => r.kind === "reference");
  const row = (metric: string, rule: string, pairs: boolean[]): Agreement => {
    const agree = pairs.filter(Boolean).length;
    const share = pairs.length ? Math.round((agree / pairs.length) * 1000) / 1000 : null;
    return { metric, rule, agree, n: pairs.length, share, trusted: share !== null && share >= TRUST };
  };
  const onBrief = (n?: number) => (n ?? 0) >= 4;
  const near = (a?: number, b?: number) => a !== undefined && b !== undefined && Math.abs(a - b) <= 1;
  const usable = (v?: string) => v === "great" || v === "good";
  return [
    row("Brief relevance", "same on brief call (4 or 5 vs 1 to 3)", dirs.map((r) => onBrief(r.relevance) === onBrief(r.gold!.relevance))),
    row("Spec coherence", "within 1 point", dirs.map((r) => near(r.coherence, r.gold!.coherence))),
    row("Wow", "within 1 point", dirs.map((r) => near(r.wow, r.gold!.wow))),
    row("Reference precision", "same good-or-great vs bad call", refs.map((r) => usable(r.verdict) === usable(r.gold!.verdict))),
    row("Great share", "same great vs not great call", refs.map((r) => (r.verdict === "great") === (r.gold!.verdict === "great"))),
    row("Reference verdict", "exact verdict", refs.map((r) => r.verdict === r.gold!.verdict)),
  ];
}

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const pct = (a: number, n: number) => (n ? `${Math.round((a / n) * 1000) / 10}% (${a} of ${n})` : "n/a");

/** One scored run as ratings.json (bench/score.mjs reads it with --ratings). */
export function ratingsJson(run: string, records: readonly JudgeRecord[]) {
  const recs = records.filter((r) => r.mode === "score" && r.run === run);
  const directions: Record<string, { briefId: string; directionId: string; relevance?: number; coherence?: number; wow?: number; note: string }> = {};
  const references: Record<string, string> = {};
  for (const r of recs) {
    const key = `${r.briefId}/${r.directionId}`;
    if (r.kind === "direction") directions[key] = { briefId: r.briefId, directionId: r.directionId, relevance: r.relevance, coherence: r.coherence, wow: r.wow, note: r.reason };
    else if (r.refId && r.verdict) references[`${key}/${r.refId}`] = r.verdict;
  }
  return { directions, references, run, exportedAt: new Date().toISOString(), ratedBy: "J10 judge (atlas-build/jobs/j10-judge.ts), calibrated against agent-made gold" };
}

/** The report: agreement per metric, then each scored run on the trusted metrics. */
export function judgeReport(records: readonly JudgeRecord[]): string {
  const ag = agreement(records);
  const trusted = new Set(ag.filter((a) => a.trusted).map((a) => a.metric));
  const lines = [
    "# J10 judge calibration",
    "",
    "Gold: banana-server/bench/gold/ratings-gold.json (agent-made at the owner's request; see banana-server/DECISIONS.md 2026-10-16).",
    "",
    "| Metric | Agreement rule | Agreement | Trusted (75% or more) |",
    "| --- | --- | --- | --- |",
    ...ag.map((a) => `| ${a.metric} | ${a.rule} | ${a.share === null ? "n/a" : pct(a.agree, a.n)} | ${a.trusted ? "yes" : "no"} |`),
    "",
  ];
  const runs = [...new Set(records.filter((r) => r.mode === "score").map((r) => r.run))].sort();
  for (const run of runs) {
    const recs = records.filter((r) => r.mode === "score" && r.run === run);
    const dirs = recs.filter((r) => r.kind === "direction");
    const refs = recs.filter((r) => r.kind === "reference");
    const show = (metric: string, value: string) => `| ${metric} | ${value} | ${trusted.has(metric) ? "yes" : "no: owner rates this one"} |`;
    lines.push(
      `## Run ${run}`,
      "",
      "| Metric | Judge | Trusted |",
      "| --- | --- | --- |",
      show("Brief relevance", pct(dirs.filter((r) => (r.relevance ?? 0) >= 4).length, dirs.length)),
      show("Spec coherence", `median ${median(dirs.map((r) => r.coherence ?? 0)) ?? "n/a"}`),
      show("Wow", `median ${median(dirs.map((r) => r.wow ?? 0)) ?? "n/a"}`),
      show("Reference precision", pct(refs.filter((r) => r.verdict !== "bad").length, refs.length)),
      show("Great share", pct(refs.filter((r) => r.verdict === "great").length, refs.length)),
      "",
    );
  }
  if (runs.length === 0) lines.push("No runs scored: J10 needs Atlas-engine Bench runs (`node scripts/bench-run.mjs --atlas <dir>`).", "");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------------------------

export default defineJob<Input, JudgeRecord>({
  id: "j10-judge",
  kind: "judge",
  model: JUDGE,
  mode: "batch",
  schema: JudgeRecordSchema,
  system: SYSTEM,
  maxTokens: 3000,
  expectedOutputTokens: 900,
  effort: "medium",

  loadInputs: (ctx) => {
    if (!existsSync(GOLD_FILE)) throw new Error(`no gold ratings at ${GOLD_FILE}`);
    const gold = JSON.parse(readFileSync(GOLD_FILE, "utf8")) as GoldFile;
    const cal = calibrationInputs(gold);
    ctx.log(`Calibration: ${gold.directions.length} gold directions and ${gold.references.length} gold references in ${cal.length} requests.`);
    const runs = atlasRuns();
    if (runs.length === 0) {
      const msg = "No Atlas-engine Bench runs (bench/runs/<date>/run.json with engine.atlas). Make them with `node scripts/bench-run.mjs --atlas <dir>` once the Atlas shards exist.";
      if (!ctx.dry) throw new Error(`${msg} J10 scores those runs, so it does not run without them.`);
      ctx.log(`${msg} Dry run: calibration prompts only.`);
      return cal;
    }
    const scored = runs.flatMap((r) => scoringInputs(readRun(r)));
    ctx.log(`Scoring ${runs.length} Atlas-engine runs (${runs.join(", ")}) in ${scored.length} requests.`);
    return [...cal, ...scored];
  },
  requestId: (input, i) => `j10-${input.mode === "calibrate" ? "cal" : "run"}-${input.kind === "direction" ? "d" : "r"}-${i}`,
  async buildPrompt(input, ctx) {
    const blocks: Anthropic.ContentBlockParam[] = [{ type: "text", text: `${briefText(input.brief)}\n${directionText(input.direction)}` }];
    if (input.kind === "direction") {
      const refs = input.direction.search?.references ?? [];
      const shown = [...refs.filter((r) => r.zone === "ui").slice(0, DIR_UI), ...refs.filter((r) => r.zone === "art").slice(0, DIR_ART)];
      if (shown.length === 0) blocks.push({ type: "text", text: "This direction was not searched: rate it on the idea alone." });
      else {
        blocks.push({ type: "text", text: `Its first ${shown.length} references, for context:` });
        for (const r of shown) blocks.push(await thumb(r, ctx));
      }
      blocks.push({ type: "text", text: "Rate this direction." });
      return blocks;
    }
    blocks.push({ type: "text", text: `Judge these ${input.refs.length} references for this direction, in order.` });
    for (const [i, r] of input.refs.entries()) {
      blocks.push({ type: "text", text: `Reference ${i + 1}: ${r.zone} zone, ${r.lane ?? "?"} lane.` });
      blocks.push(await thumb(r, ctx));
    }
    return blocks;
  },
  parse(text, input) {
    const base = { mode: input.mode, run: input.run, briefId: input.brief.id, directionId: input.direction.id };
    if (input.kind === "direction") {
      const d = parseDirection(text);
      const g = input.gold;
      return [{ ...base, kind: "direction", ...d, ...(g ? { gold: { relevance: g.relevance, coherence: g.coherence, wow: g.wow } } : {}) }];
    }
    return parseReferences(text, input.refs.length).map((v, i) => {
      const ref = input.refs[i]!;
      const g = input.gold?.find((x) => x.refId === ref.id);
      return { ...base, kind: "reference", refId: ref.id, verdict: v.verdict, reason: v.reason, ...(g ? { gold: { verdict: g.verdict } } : {}) };
    });
  },
  finalize(records, ctx) {
    const report = judgeReport(records);
    mkdirSync(PATHS.review, { recursive: true });
    const file = join(PATHS.review, "j10-judge-report.md");
    writeFileSync(file, report);
    ctx.log(report);
    ctx.log(`Report: ${file}`);
    for (const run of new Set(records.filter((r) => r.mode === "score").map((r) => r.run))) {
      const out = join(BENCH, "runs", run, "ratings-judge.json");
      writeFileSync(out, JSON.stringify(ratingsJson(run, records), null, 1) + "\n");
      ctx.log(`Judge ratings: ${out}`);
    }
    return records;
  },
  shardOf: (r) => (r.mode === "calibrate" ? "calibration" : r.run.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
});
