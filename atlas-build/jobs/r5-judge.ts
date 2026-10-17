/**
 * Refinement R5: the trusted judge on a searched Bench run, with reference thumbnails.
 *
 * Directions: the R3 v2 judge exactly as its g2l score stage (SYSTEM_R3, the same 12 gold examples
 * per vote, votes a and b, 4 UI and 2 art thumbnails per direction through `directionBlocks`; an
 * unsearched direction is rated on its spec). Where the votes split on the on-brief call, the R3
 * second pass decides (r5-judge-adj). References: J10's unchanged reference prompt (r5-judge-refs), top
 * 8 UI results per searched direction. Craftwork, Best Designs on X and x.com items never reach the
 * model (`modelInputOk`).
 *
 *   R5_RUN=2026-10-17r5a npx tsx run.ts r5-judge --dry
 *   R5_RUN=2026-10-17r5a npx tsx run.ts r5-judge --missing            # votes a and b
 *   R5_RUN=2026-10-17r5a npx tsx run.ts r5-judge-adj --missing
 *   R5_RUN=2026-10-17r5a npx tsx run.ts r5-judge-refs --missing
 *   R5_RUN=... npx tsx run.ts r5-judge --from-raw                     # writes the ratings again
 *
 * Request ids carry a short hash of what the model sees (the spec text and the shown references), so
 * a direction or a reference set that did not change between two runs reuses its saved reply, and a
 * changed one is judged again. Writes bench/runs/<run>/ratings-judge-r5.json (score.mjs --ratings)
 * and review/r5-judge-<run>.md. Budget key r5.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { JUDGE, PATHS } from "../config.ts";
import { defineJob, type AtlasJob } from "../lib/job.ts";
import { modelInputOk } from "../lib/thumbs.ts";
import { BENCH, briefText, directionText, GOLD_FILE, parseDirection, parseReferences, readRun, SYSTEM, thumb, TOP_UI, type GoldFile, type RunBrief, type RunDirection, type RunRef } from "./j10-judge.ts";
import { directionBlocks, drawShots, shotsBlock, SYSTEM_R3 } from "./r3-judge.ts";

export const RUN = process.env.R5_RUN ?? "2026-10-17r5a";
export type Pass = "votes" | "adj" | "refs";
const RUN_DIR = () => join(BENCH, "runs", RUN);
/** The R3 score stage's example seeds (voteSeed(0, 0, vote) in r3-judge.ts). */
const SHOT_SEED = { a: 1, b: 2 } as const;
const DIR_UI = 4;
const DIR_ART = 2;

const Score = z.number().int().min(1).max(5);
export const R5RecordSchema = z.object({
  run: z.string(),
  pass: z.enum(["votes", "adj", "refs"]),
  vote: z.enum(["a", "b", "adj", "ref"]),
  briefId: z.string(),
  directionId: z.string(),
  refId: z.string().optional(),
  title: z.string(),
  relevance: Score.optional(),
  coherence: Score.optional(),
  wow: Score.optional(),
  verdict: z.enum(["great", "good", "bad"]).optional(),
  reason: z.string().max(600),
});
export type R5Record = z.infer<typeof R5RecordSchema>;

type Input = { pass: Pass; vote: "a" | "b" | "adj" | "ref"; brief: RunBrief; direction: RunDirection; shots: GoldFile["directions"]; refs?: RunRef[]; a?: R5Record; b?: R5Record };

const onBrief = (n: number) => n >= 4;
const key = (r: { briefId: string; directionId: string }) => `${r.briefId}/${r.directionId}`;
const h = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 8);
const readJson = <T>(file: string): T | null => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null);

/** What the direction judge sees: the brief, the spec and the shown thumbnails (as directionBlocks picks them). */
export function shownRefs(d: RunDirection): RunRef[] {
  const refs = d.search?.references ?? [];
  return [...refs.filter((r) => r.zone === "ui" && modelInputOk(r)).slice(0, DIR_UI), ...refs.filter((r) => r.zone === "art" && modelInputOk(r)).slice(0, DIR_ART)];
}
export const topUi = (d: RunDirection): RunRef[] => (d.search?.references ?? []).filter((r) => r.zone === "ui" && modelInputOk(r)).slice(0, TOP_UI);
export const dirHash = (b: RunBrief, d: RunDirection) => h(`${briefText(b)}\n${directionText(d)}\n${shownRefs(d).map((r) => r.imageUrl ?? r.thumbUrl ?? r.id).join("\n")}`);
const refsHash = (b: RunBrief, d: RunDirection, refs: RunRef[]) => h(`${briefText(b)}\n${directionText(d)}\n${refs.map((r) => `${r.lane}|${r.imageUrl ?? r.thumbUrl ?? r.id}`).join("\n")}`);

/** Final relevance per direction: the votes' call when they agree (vote a's score), else the second pass. */
export function finalScores(votes: readonly R5Record[], adj: readonly R5Record[]) {
  const b = new Map(votes.filter((r) => r.vote === "b").map((r) => [key(r), r]));
  const j = new Map(adj.map((r) => [key(r), r]));
  return votes
    .filter((r) => r.vote === "a")
    .map((a) => {
      const rb = b.get(key(a));
      if (!rb || onBrief(a.relevance!) === onBrief(rb.relevance!)) return { a, b: rb, relevance: a.relevance as number | null, adjudicated: false };
      const x = j.get(key(a));
      return { a, b: rb, relevance: x ? (x.relevance as number) : null, adjudicated: true };
    });
}

function recordsOf(file: string): R5Record[] {
  return readJson<R5Record[]>(join(RUN_DIR(), file)) ?? [];
}

/** Writes ratings-judge-r5.json and the review page from whatever passes are saved. */
export function writeOutputs(log: (s: string) => void): void {
  const run = readRun(RUN);
  const votes = recordsOf("judge-r5-votes.json");
  const adj = recordsOf("judge-r5-adj.json");
  const refs = recordsOf("judge-r5-refs.json");
  const fin = finalScores(votes, adj);
  const directions: Record<string, unknown> = {};
  for (const f of fin) if (f.relevance !== null) directions[key(f.a)] = { briefId: f.a.briefId, directionId: f.a.directionId, relevance: f.relevance, coherence: f.a.coherence, wow: f.a.wow, note: f.a.reason };
  const references: Record<string, string> = {};
  for (const r of refs) if (r.refId && r.verdict) references[`${key(r)}/${r.refId}`] = r.verdict;
  writeFileSync(
    join(RUN_DIR(), "ratings-judge-r5.json"),
    JSON.stringify({ directions, references, run: RUN, exportedAt: new Date().toISOString(), ratedBy: "R3 judge with thumbnails (directions) and J10 reference prompt (references), atlas-build/jobs/r5-judge.ts" }, null, 1) + "\n",
  );
  const decided = fin.filter((f) => f.relevance !== null);
  const on = decided.filter((f) => onBrief(f.relevance!)).length;
  const good = Object.values(references).filter((v) => v !== "bad").length;
  const lines = [
    `# R5 judge, run ${RUN}`,
    "",
    `On brief (R3 judge with thumbnails, final): **${on} of ${decided.length}**${decided.length ? ` (${((on / decided.length) * 100).toFixed(1)}%)` : ""}, ${fin.filter((f) => f.adjudicated).length} split votes${fin.length > decided.length ? `, ${fin.length - decided.length} not yet decided` : ""}.`,
    `Reference precision (J10 prompt, top 8 UI): ${good} of ${Object.keys(references).length}.`,
    "",
    "| Brief | Direction | Searched | Relevance (a, b, final) | Reason (vote a) |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const f of fin) {
    const d = run.briefs.find((x) => x.id === f.a.briefId)?.directions.find((x) => x.id === f.a.directionId);
    lines.push(`| ${f.a.briefId} | ${f.a.title} | ${d?.search ? "yes" : "no"} | ${f.a.relevance}, ${f.b?.relevance ?? "?"}, ${f.relevance ?? "?"} | ${f.a.reason.replace(/\|/g, "/")} |`);
  }
  mkdirSync(PATHS.review, { recursive: true });
  writeFileSync(join(PATHS.review, `r5-judge-${RUN}.md`), lines.join("\n") + "\n");
  log(lines.slice(0, 4).join("\n"));
}

let goldCache: GoldFile | null = null;
const gold = () => (goldCache ??= JSON.parse(readFileSync(GOLD_FILE, "utf8")) as GoldFile);

/**
 * `prefix` is the job id prefix and so the budget key (R7 reuses the R5 judge under its own budget);
 * `art` also sends every art reference of a direction to the reference pass (J10's prompt judges art
 * on the direction's idea), for the R7 source probe.
 */
export function makeJob(pass: Pass, prefix: "r5" | "r7" = "r5", opts: { art?: boolean } = {}): AtlasJob<Input, R5Record> {
  const outFile = pass === "votes" ? "judge-r5-votes.json" : pass === "adj" ? "judge-r5-adj.json" : "judge-r5-refs.json";
  return defineJob<Input, R5Record>({
    id: pass === "votes" ? `${prefix}-judge` : `${prefix}-judge-${pass}`,
    kind: `work-judge-${prefix}-${pass}`,
    model: JUDGE,
    mode: "batch",
    schema: R5RecordSchema,
    system: pass === "refs" ? SYSTEM : SYSTEM_R3,
    maxTokens: pass === "adj" ? 4000 : 3000,
    expectedOutputTokens: pass === "adj" ? 1200 : pass === "refs" ? 900 : 600,
    imageTokens: 250,
    effort: "medium",

    loadInputs: (ctx) => {
      const run = readRun(RUN);
      const g = gold();
      const out: Input[] = [];
      if (pass === "votes") {
        for (const vote of ["a", "b"] as const) {
          const shots = drawShots(g.directions, SHOT_SEED[vote]);
          for (const brief of run.briefs) for (const direction of brief.directions) out.push({ pass, vote, brief, direction, shots });
        }
      } else if (pass === "refs") {
        for (const brief of run.briefs)
          for (const direction of brief.directions) {
            const refs = opts.art ? [...topUi(direction), ...(direction.search?.references ?? []).filter((r) => r.zone === "art" && modelInputOk(r))] : topUi(direction);
            if (refs.length) out.push({ pass, vote: "ref", brief, direction, shots: [], refs });
          }
      } else {
        const votes = recordsOf("judge-r5-votes.json");
        if (!votes.length) throw new Error(`no votes for ${RUN}: run r5-judge first`);
        const byB = new Map(votes.filter((r) => r.vote === "b").map((r) => [key(r), r]));
        const shots = [...drawShots(g.directions, SHOT_SEED.a), ...drawShots(g.directions, SHOT_SEED.b)].filter((s, i, all) => all.indexOf(s) === i);
        for (const a of votes.filter((r) => r.vote === "a")) {
          const b = byB.get(key(a));
          if (!b || onBrief(a.relevance!) === onBrief(b.relevance!)) continue;
          const brief = run.briefs.find((x) => x.id === a.briefId)!;
          const direction = brief.directions.find((x) => x.id === a.directionId)!;
          out.push({ pass, vote: "adj", brief, direction, shots, a, b });
        }
      }
      ctx.log(`R5 ${RUN} ${pass}: ${out.length} requests.`);
      return out;
    },
    requestId: (input) => {
      const hash = input.refs ? refsHash(input.brief, input.direction, input.refs) : dirHash(input.brief, input.direction);
      return `${prefix}${input.vote}-${input.brief.id.slice(0, 20)}-${input.direction.id}-${hash}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
    },
    async buildPrompt(input, ctx) {
      if (input.pass === "refs") {
        const blocks: Anthropic.ContentBlockParam[] = [{ type: "text", text: `${briefText(input.brief)}\n${directionText(input.direction)}` }];
        blocks.push({ type: "text", text: `Judge these ${input.refs!.length} references for this direction, in order.` });
        for (const [i, r] of input.refs!.entries()) {
          blocks.push({ type: "text", text: `Reference ${i + 1}: ${r.zone} zone, ${r.lane ?? "?"} lane.` });
          blocks.push(await thumb(r, ctx));
        }
        return blocks;
      }
      const blocks: Anthropic.ContentBlockParam[] = [{ type: "text", text: shotsBlock(input.shots), cache_control: { type: "ephemeral" } }];
      blocks.push(...(await directionBlocks(input.brief, input.direction, ctx)));
      if (input.pass === "votes") {
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
      const base = { run: RUN, pass: input.pass, vote: input.vote, briefId: input.brief.id, directionId: input.direction.id, title: input.direction.title };
      if (input.pass === "refs") return parseReferences(text, input.refs!.length).map((v, i) => ({ ...base, refId: input.refs![i]!.id, verdict: v.verdict, reason: v.reason }));
      const d = parseDirection(text);
      return [input.pass === "adj" ? { ...base, relevance: d.relevance, reason: d.reason } : { ...base, relevance: d.relevance, coherence: d.coherence, wow: d.wow, reason: d.reason }];
    },
    finalize(records, ctx) {
      if (ctx.dry) return records;
      // --missing hands finalize only the new replies; --from-raw hands every saved reply. Keep this run's.
      const mine = records.filter((r) => r.run === RUN);
      const run = readRun(RUN);
      const wanted = new Set(run.briefs.flatMap((b) => b.directions.map((d) => `${b.id}/${d.id}`)));
      const old = recordsOf(outFile).filter((r) => !mine.some((m) => m.vote === r.vote && key(m) === key(r) && m.refId === r.refId));
      const merged = [...old, ...mine].filter((r) => wanted.has(key(r)));
      writeFileSync(join(RUN_DIR(), outFile), JSON.stringify(merged, null, 1) + "\n");
      writeOutputs(ctx.log);
      return records;
    },
    shardOf: (r) => `${r.run}-${r.pass}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  });
}

export default makeJob("votes");
