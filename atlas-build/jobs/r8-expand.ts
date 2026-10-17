/**
 * Refinement R8, optional check: would a designer take this draft further? Opus reads one direction
 * spec (the same text the R3 judge reads) and rates, 1 to 5, whether a designer could take it and
 * expand it into something original. Text only, no gold examples (a new question, not calibrated):
 * read it only as a before and after on the same runs.
 *
 *   R8_RUNS=r6-3,r8-w1 npx tsx run.ts r8-expand --dry
 *
 * Writes review/r8-expand.md with each run's mean and the share rated 4 or more. Budget key r8.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { cyrb53 } from "../../banana-server/lib/bend/prng.ts";
import { OPUS, PATHS } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { PROMPT_RULES } from "../lib/prompt.ts";
import { extractJson } from "../lib/validate.ts";
import { briefText, directionText, readRun, type RunBrief, type RunDirection } from "./j10-judge.ts";

const RUNS = (process.env.R8_RUNS ?? "r6-3").split(",").map((s) => s.trim()).filter(Boolean);

const Rec = z.object({ run: z.string(), briefId: z.string(), directionId: z.string(), title: z.string(), expand: z.number().int().min(1).max(5), reason: z.string() });
type R = z.infer<typeof Rec>;
type Input = { run: string; brief: RunBrief; direction: RunDirection };

const SYSTEM = `You are a senior product designer. A tool hands you a draft design direction for one app or web page: a wild idea, how it acts on the page's parts, and a visual spec. You decide whether it is a draft you would take and expand into something original, or one you would set aside.

Rate expand from 1 to 5:
5 = I would start on this today: the idea is surprising and specific, it acts on the parts where the page's work happens, and it leaves me room to push it further (more screens, more states, a motion idea) without losing the task.
4 = a strong start: original and usable, with one thin or vague spot I would have to invent.
3 = workable but expected, or original but thin: it restyles the page more than it rethinks it.
2 = little to build on: decoration on one corner of the page, or an idea that fights the task.
1 = nothing to take: generic, or it breaks the page.
Judge the draft, not its wording. Wild is good when the task still works.

${PROMPT_RULES}

Answer with JSON only: {"expand": n, "reason": "one plain line"}`;

export default defineJob<Input, R>({
  id: "r8-expand",
  kind: "work-r8-expand",
  model: OPUS,
  mode: "batch",
  schema: Rec,
  system: SYSTEM,
  maxTokens: 2000,
  expectedOutputTokens: 300,
  effort: "low",
  loadInputs: () => RUNS.flatMap((run) => readRun(run).briefs.flatMap((brief) => brief.directions.map((direction) => ({ run, brief, direction })))),
  // The text decides the id, so the same direction in two runs shares one reply.
  requestId: (i) => `r8x-${i.brief.id}-${cyrb53(`${briefText(i.brief)}\n${directionText(i.direction)}`).toString(36)}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64),
  buildPrompt: (i) => `${briefText(i.brief)}\n\n${directionText(i.direction)}\n\nWould you take this draft and expand it into something original? Rate it.`,
  parse: (text, i) => {
    const j = extractJson(text) as { expand?: unknown; reason?: unknown };
    return [{ run: i.run, briefId: i.brief.id, directionId: i.direction.id, title: i.direction.title, expand: Number(j.expand), reason: String(j.reason ?? "") }];
  },
  finalize: (records, ctx) => {
    if (ctx.dry) return records;
    const lines = ["# R8 expand check (Opus, specs only)", "", "| Run | Directions | Mean expand | 4 or more |", "| --- | --- | --- | --- |"];
    for (const run of RUNS) {
      const xs = records.filter((r) => r.run === run);
      if (!xs.length) continue;
      lines.push(`| ${run} | ${xs.length} | ${(xs.reduce((a, r) => a + r.expand, 0) / xs.length).toFixed(2)} | ${xs.filter((r) => r.expand >= 4).length} |`);
    }
    lines.push("", "| Run | Brief | Direction | Expand | Reason |", "| --- | --- | --- | --- | --- |");
    for (const r of records) lines.push(`| ${r.run} | ${r.briefId} | ${r.title} | ${r.expand} | ${r.reason.replace(/\|/g, "/")} |`);
    mkdirSync(PATHS.review, { recursive: true });
    writeFileSync(join(PATHS.review, "r8-expand.md"), lines.join("\n") + "\n");
    ctx.log(lines.slice(0, 4 + RUNS.length).join("\n"));
    return records;
  },
  shardOf: (r) => r.run,
});
