/**
 * Refinement R9: draft quality after the spec checks. The R7 draft judge (the same system prompt and
 * question, Opus) rates what an agent holds after bend_brief and frankenstein_page for one direction:
 * banana-server/scripts/r9-drafts.ts writes the samples, the 20 R7 drafts (before is R7's rated text,
 * unchanged) and 10 weak-domain drafts, before and after lib/atlas/spec-coherence.ts. Each draft is
 * rated on its own, twice (votes a and b, separate requests), and the model never sees the other
 * version. Request ids carry a hash of the text, so an unchanged text keeps its replies. Budget key r9.
 *
 *   npx tsx run.ts r9-drafts --dry
 *   npx tsx run.ts r9-drafts --missing, then --from-raw
 *
 * Writes banana-server/bench/runs/r9-drafts/ratings.json and review/r9-drafts.md.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { JUDGE, PATHS } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { BENCH } from "./j10-judge.ts";

const DIR = join(BENCH, "runs", "r9-drafts");
type Group = "r7" | "weak";
type Sample = { group: Group; briefId: string; directionId: string; title: string; before: string; after: string };
type Input = { sample: Sample; version: "before" | "after"; vote: "a" | "b"; text: string };

export const R9DraftSchema = z.object({
  group: z.enum(["r7", "weak"]),
  briefId: z.string(),
  directionId: z.string(),
  version: z.enum(["before", "after"]),
  vote: z.enum(["a", "b"]),
  hash: z.string(),
  expand: z.number().int().min(1).max(5),
  original: z.number().int().min(1).max(5),
  weakest: z.enum(["idea", "spec", "parts", "where the idea goes", "sources", "nothing"]),
  reason: z.string().max(600),
});
export type R9Draft = z.infer<typeof R9DraftSchema>;

/** The R7 draft judge's system prompt, word for word (jobs/r7-drafts.ts), so the numbers compare. */
const SYSTEM = `You are a senior product designer reviewing a starting draft that a design tool handed to an AI agent for one page. The draft is a direction (an idea with a spec) and a Frankenstein page: a stack of parts cut from real shipped screens, each with its source.

Answer one question: could a designer take this draft and expand it into something original (not a copy of the parts, not a generic page)?

Scores from 1 to 5:
- expand: 5 means a designer knows exactly what to build first and where the idea changes the page; 3 means the pieces are there but the designer must work out how they connect; 1 means it is a pile of references with no way forward.
- original: 5 means following the draft leads to a page nobody has shipped; 1 means it leads back to the parts it was cut from.
- weakest: the one part that most holds the draft back: "idea", "spec", "parts", "where the idea goes", "sources" or "nothing".

Answer with JSON only: {"expand": n, "original": n, "weakest": "...", "reason": "one plain sentence, no em dashes"}`;

const samples = (): Sample[] => (JSON.parse(readFileSync(join(DIR, "samples.json"), "utf8")) as { samples: Sample[] }).samples;
const h = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 8);

/** Mean of a list, two decimals. */
const mean = (xs: readonly number[]) => (xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)).toFixed(2);

export function report(records: readonly R9Draft[]): string[] {
  const lines = ["# R9 drafts", "", "Expand and original are the mean of votes a and b per draft; 4 or more counts drafts whose two-vote mean is 4 or more.", ""];
  lines.push("| Group | Version | Drafts | Expand mean | Expand 4+ | Original mean | Weakest (votes) |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const g of ["r7", "weak", "all"] as const) {
    for (const v of ["before", "after"] as const) {
      const rs = records.filter((r) => r.version === v && (g === "all" || r.group === g));
      const per = new Map<string, R9Draft[]>();
      for (const r of rs) per.set(`${r.briefId}/${r.directionId}`, [...(per.get(`${r.briefId}/${r.directionId}`) ?? []), r]);
      const draftExpand = [...per.values()].map((xs) => xs.reduce((s, x) => s + x.expand, 0) / xs.length);
      const weak = Object.entries(rs.reduce<Record<string, number>>((m, r) => ({ ...m, [r.weakest]: (m[r.weakest] ?? 0) + 1 }), {}))
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k} ${n}`)
        .join(", ");
      lines.push(`| ${g} | ${v} | ${per.size} | ${mean(rs.map((r) => r.expand))} | ${draftExpand.filter((x) => x >= 4).length} | ${mean(rs.map((r) => r.original))} | ${weak} |`);
    }
  }
  lines.push("", "| Group | Brief | Direction | Version | Vote | Expand | Original | Weakest | Reason |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of records) lines.push(`| ${r.group} | ${r.briefId} | ${r.directionId} | ${r.version} | ${r.vote} | ${r.expand} | ${r.original} | ${r.weakest} | ${r.reason.replace(/\|/g, "/")} |`);
  return lines;
}

export default defineJob<Input, R9Draft>({
  id: "r9-drafts",
  kind: "work-r9-drafts",
  model: JUDGE,
  mode: "batch",
  schema: R9DraftSchema,
  system: SYSTEM,
  maxTokens: 2000,
  expectedOutputTokens: 300,
  effort: "medium",
  loadInputs: (ctx) => {
    const out: Input[] = samples().flatMap((sample) =>
      (["a", "b"] as const).flatMap((vote) => [
        { sample, version: "before" as const, vote, text: sample.before },
        { sample, version: "after" as const, vote, text: sample.after },
      ]),
    );
    ctx.log(`R9 drafts: ${out.length} requests.`);
    return out;
  },
  requestId: (input) => `r9dr-${input.vote}-${input.sample.briefId.slice(0, 20)}-${input.sample.directionId}-${h(input.text)}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64),
  buildPrompt: (input) => [{ type: "text", text: `${input.text}\n\nRate this draft.` }],
  parse(text, input) {
    const m = /\{[\s\S]*\}/.exec(text);
    const j = JSON.parse(m ? m[0] : text) as Partial<R9Draft>;
    return [
      {
        group: input.sample.group,
        briefId: input.sample.briefId,
        directionId: input.sample.directionId,
        version: input.version,
        vote: input.vote,
        hash: h(input.text),
        expand: j.expand!,
        original: j.original!,
        weakest: j.weakest!,
        reason: String(j.reason ?? "").slice(0, 600),
      },
    ];
  },
  finalize(records, ctx) {
    if (ctx.dry) return records;
    writeFileSync(join(DIR, "ratings.json"), JSON.stringify(records, null, 1) + "\n");
    const lines = report(records);
    mkdirSync(PATHS.review, { recursive: true });
    writeFileSync(join(PATHS.review, "r9-drafts.md"), lines.join("\n") + "\n");
    ctx.log(lines.slice(4, 12).join("\n"));
    return records;
  },
  shardOf: (r) => `${r.group}-${r.version}`,
});
