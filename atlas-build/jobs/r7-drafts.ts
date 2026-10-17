/**
 * Refinement R7: draft quality. Opus rates what an agent holds after bend_brief and frankenstein_page
 * for one direction (banana-server/scripts/r7-drafts.ts writes the samples: the spec plus the
 * Frankenstein page's text, before and after the R7 "Bend it" lines), on one question: could a
 * designer take this and expand it into something original? Each draft is rated on its own (the
 * model never sees the other version). Budget key r7.
 *
 *   npx tsx run.ts r7-drafts --dry
 *   npx tsx run.ts r7-drafts --missing, then --from-raw
 *
 * Writes banana-server/bench/runs/r7-drafts/ratings.json and review/r7-drafts.md.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { JUDGE, PATHS } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { BENCH } from "./j10-judge.ts";

const DIR = join(BENCH, "runs", "r7-drafts");
type Sample = { briefId: string; directionId: string; title: string; before: string; after: string };
type Input = { sample: Sample; version: "before" | "after"; text: string };

export const R7DraftSchema = z.object({
  briefId: z.string(),
  directionId: z.string(),
  version: z.enum(["before", "after"]),
  expand: z.number().int().min(1).max(5),
  original: z.number().int().min(1).max(5),
  weakest: z.enum(["idea", "spec", "parts", "where the idea goes", "sources", "nothing"]),
  reason: z.string().max(600),
});
export type R7Draft = z.infer<typeof R7DraftSchema>;

const SYSTEM = `You are a senior product designer reviewing a starting draft that a design tool handed to an AI agent for one page. The draft is a direction (an idea with a spec) and a Frankenstein page: a stack of parts cut from real shipped screens, each with its source.

Answer one question: could a designer take this draft and expand it into something original (not a copy of the parts, not a generic page)?

Scores from 1 to 5:
- expand: 5 means a designer knows exactly what to build first and where the idea changes the page; 3 means the pieces are there but the designer must work out how they connect; 1 means it is a pile of references with no way forward.
- original: 5 means following the draft leads to a page nobody has shipped; 1 means it leads back to the parts it was cut from.
- weakest: the one part that most holds the draft back: "idea", "spec", "parts", "where the idea goes", "sources" or "nothing".

Answer with JSON only: {"expand": n, "original": n, "weakest": "...", "reason": "one plain sentence, no em dashes"}`;

const samples = (): Sample[] => (JSON.parse(readFileSync(join(DIR, "samples.json"), "utf8")) as { samples: Sample[] }).samples;
const h = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 8);

export default defineJob<Input, R7Draft>({
  id: "r7-drafts",
  kind: "work-r7-drafts",
  model: JUDGE,
  mode: "batch",
  schema: R7DraftSchema,
  system: SYSTEM,
  maxTokens: 2000,
  expectedOutputTokens: 300,
  effort: "medium",
  loadInputs: (ctx) => {
    const out: Input[] = samples().flatMap((sample) => [
      { sample, version: "before" as const, text: sample.before },
      { sample, version: "after" as const, text: sample.after },
    ]);
    ctx.log(`R7 drafts: ${out.length} requests.`);
    return out;
  },
  requestId: (input) => `r7dr-${input.version}-${input.sample.briefId.slice(0, 20)}-${input.sample.directionId}-${h(input.text)}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64),
  buildPrompt: (input) => [{ type: "text", text: `${input.text}\n\nRate this draft.` }],
  parse(text, input) {
    const m = /\{[\s\S]*\}/.exec(text);
    const j = JSON.parse(m ? m[0] : text) as Partial<R7Draft>;
    return [{ briefId: input.sample.briefId, directionId: input.sample.directionId, version: input.version, expand: j.expand!, original: j.original!, weakest: j.weakest!, reason: String(j.reason ?? "").slice(0, 600) }];
  },
  finalize(records, ctx) {
    if (ctx.dry) return records;
    writeFileSync(join(DIR, "ratings.json"), JSON.stringify(records, null, 1) + "\n");
    const lines = ["# R7 drafts", ""];
    for (const v of ["before", "after"] as const) {
      const rs = records.filter((r) => r.version === v);
      const mean = (f: (r: R7Draft) => number) => (rs.reduce((s, r) => s + f(r), 0) / Math.max(1, rs.length)).toFixed(2);
      const weak = Object.entries(rs.reduce<Record<string, number>>((m, r) => ({ ...m, [r.weakest]: (m[r.weakest] ?? 0) + 1 }), {}))
        .map(([k, n]) => `${k} ${n}`)
        .join(", ");
      lines.push(`${v}: ${rs.length} drafts, expand mean ${mean((r) => r.expand)} (4 or more: ${rs.filter((r) => r.expand >= 4).length}), original mean ${mean((r) => r.original)}; weakest: ${weak}`);
    }
    lines.push("", "| Brief | Direction | Version | Expand | Original | Weakest | Reason |", "| --- | --- | --- | --- | --- | --- | --- |");
    for (const r of records) lines.push(`| ${r.briefId} | ${r.directionId} | ${r.version} | ${r.expand} | ${r.original} | ${r.weakest} | ${r.reason.replace(/\|/g, "/")} |`);
    mkdirSync(PATHS.review, { recursive: true });
    writeFileSync(join(PATHS.review, "r7-drafts.md"), lines.join("\n") + "\n");
    ctx.log(lines.slice(0, 4).join("\n"));
    return records;
  },
  shardOf: (r) => r.version,
});
