/**
 * Refinement R10: the slop check. Opus reads one direction's spec (the text the R3 judge reads, plus
 * the motion line) and answers one question: is this what apps in this domain already look like?
 * 1 (nothing like what the domain ships) to 5 (exactly what the domain ships). Two votes per
 * direction, the mean is the score; 4 or more is slop. No gold set: read it only as before and
 * after on the same briefs.
 *
 * Runs on a bench run the R10 judge already bent (jobs/r10-judge.ts, same V_SET and V_TAG). Request
 * ids hash the text the model reads, so an unchanged direction keeps its votes.
 *
 *   V_SET=weak|bench V_TAG=0 npx tsx run.ts r10-slop --missing   (then --from-raw)
 *
 * Writes bench/runs/r10-v<w|b><tag>/slop.json and review/r10-slop-<w|b><tag>.md.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { JUDGE, PATHS } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { extractJson } from "../lib/validate.ts";
import { BENCH, briefText, directionText, readRun, type RunBrief, type RunDirection } from "./j10-judge.ts";
import { RUN, SET, TAG } from "./r10-judge.ts";

type Input = { vote: "a" | "b"; brief: RunBrief; direction: RunDirection };

export const SlopRecordSchema = z.object({
  tag: z.string(),
  vote: z.enum(["a", "b"]),
  briefId: z.string(),
  directionId: z.string(),
  title: z.string(),
  slop: z.number().int().min(1).max(5),
  look: z.string(),
  reason: z.string(),
});
export type SlopRecord = z.infer<typeof SlopRecordSchema>;

const SYSTEM = `You are a senior product designer who has looked at thousands of shipped apps and sites, domain by domain (App Store screens, Mobbin flows, Dribbble shots). GoBanana proposes a design direction for one page of a product; its job is to give the user something they would not have built anyway.

Read the brief and the direction's spec, then answer one question: is this what apps in this domain already look like?

1 = nothing like what apps of this domain ship: a look this domain has not seen.
2 = mostly fresh; one familiar move in a supporting role.
3 = half and half: the main idea is fresh but the page would still read as a typical app of the domain, or the main idea is a familiar domain move dressed in a new skin.
4 = mostly what the domain already ships (its usual charts, metaphors, illustration style, reward system or era look) with small changes.
5 = exactly what apps of this domain already look like.

Judge the domain's look, not quality or fit: a fresh idea can be weak, a familiar one can be well made. A screen-native move counts as familiar when this domain's apps use it (ring gauges in telecom, flat illustration in food delivery, badges and streaks in fitness and learning apps, marble and gold in luxury property). The same move can be fresh in another domain.

Answer with JSON only: {"slop": n, "look": "the shipped look of this domain it matches, or none", "reason": "one plain line"}`;

const hash = (s: string) => createHash("sha256").update(s).digest("base64url").slice(0, 12);
const motionOf = (d: RunDirection) => (typeof d.spec?.motion === "string" ? `motion: ${d.spec.motion}` : "");
const textOf = (brief: RunBrief, d: RunDirection) => [briefText(brief), directionText(d), motionOf(d)].filter(Boolean).join("\n");
const key = (r: { briefId: string; directionId: string }) => `${r.briefId}/${r.directionId}`;
const RUN_DIR = join(BENCH, "runs", RUN);

export default defineJob<Input, SlopRecord>({
  id: "r10-slop",
  kind: "work-r10-slop",
  model: JUDGE,
  mode: "batch",
  schema: SlopRecordSchema,
  system: SYSTEM,
  maxTokens: 2000,
  expectedOutputTokens: 400,
  effort: "medium",

  loadInputs: (ctx) => {
    const run = readRun(RUN);
    const out: Input[] = [];
    for (const vote of ["a", "b"] as const) for (const brief of run.briefs) for (const direction of brief.directions) out.push({ vote, brief, direction });
    ctx.log(`Slop check ${RUN}: ${out.length} votes over ${out.length / 2} directions.`);
    return out;
  },
  requestId: (input) => `r10s-${input.vote}-${input.brief.id}-${hash(textOf(input.brief, input.direction))}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64),
  buildPrompt: (input) => `${textOf(input.brief, input.direction)}\n\n${input.vote === "a" ? "Rate this direction." : "Rate this direction: is it what this domain's apps already look like?"}`,
  parse(text, input) {
    const v = extractJson(text) as { slop?: unknown; look?: unknown; reason?: unknown };
    return [{ tag: `${SET[0]}${TAG}`, vote: input.vote, briefId: input.brief.id, directionId: input.direction.id, title: input.direction.title, slop: Number(v.slop), look: String(v.look ?? "none").replace(/—/g, ","), reason: String(v.reason ?? "").replace(/—/g, ",") }];
  },
  finalize(records, ctx) {
    if (ctx.dry) return records;
    const run = readRun(RUN);
    const ids = new Set(run.briefs.flatMap((b) => b.directions.map((d) => `${b.id}/${d.id}`)));
    const mine = records.filter((r) => ids.has(key(r)));
    const by = new Map<string, SlopRecord[]>();
    for (const r of mine) by.set(key(r), [...(by.get(key(r)) ?? []), r]);
    const out: Record<string, { briefId: string; directionId: string; title: string; slop: number; votes: number[]; look: string; reason: string }> = {};
    for (const [k, rs] of by) {
      const a = rs.find((r) => r.vote === "a") ?? rs[0]!;
      out[k] = { briefId: a.briefId, directionId: a.directionId, title: a.title, slop: rs.reduce((s, r) => s + r.slop, 0) / rs.length, votes: rs.map((r) => r.slop), look: a.look, reason: a.reason };
    }
    mkdirSync(RUN_DIR, { recursive: true });
    writeFileSync(join(RUN_DIR, "slop.json"), JSON.stringify(out, null, 1) + "\n");
    const rows = Object.values(out);
    const mean = rows.reduce((s, r) => s + r.slop, 0) / Math.max(1, rows.length);
    const lines = [
      `# R10 slop check, ${SET} ${TAG}`,
      "",
      `Mean ${mean.toFixed(2)} over ${rows.length} directions; slop (4 or more) ${rows.filter((r) => r.slop >= 4).length}; 3 or more ${rows.filter((r) => r.slop >= 3).length}.`,
      "",
      "| Brief | Direction | Slop (votes) | Look | Reason (vote a) |",
      "| --- | --- | --- | --- | --- |",
      ...rows.map((r) => `| ${r.briefId} | ${r.title} | ${r.slop} (${r.votes.join(", ")}) | ${r.look} | ${r.reason} |`),
    ];
    mkdirSync(PATHS.review, { recursive: true });
    writeFileSync(join(PATHS.review, `r10-slop-${SET[0]}${TAG}.md`), lines.join("\n") + "\n");
    ctx.log(lines.slice(0, 3).join("\n"));
    return records;
  },
  shardOf: (r) => r.tag,
});
