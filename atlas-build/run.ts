/**
 * Job runner CLI.
 *
 *   npx tsx run.ts <job> [--dry] [--limit N] [--offset N] [--from-raw] [--fresh] [--poll SECONDS]
 *
 * <job> is a file in jobs/ (with or without .ts), for example `example` or `j3-cards`.
 * --dry       build every prompt and print the estimate and the budget check; no API calls.
 * --limit N   only the first N inputs (after --offset).
 * --offset N  skip the first N inputs.
 * --from-raw  rebuild shards, review and rejects from raw/<job>.jsonl; no API calls.
 * --fresh     forget an unfinished batch in state/<job>.json and submit again (pays again).
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PATHS, ROOT, loadEnv } from "./config.ts";
import { buildParams, clearState, readState, runBatches, runDirect, type BatchRequest, type Reply } from "./lib/batch.ts";
import { checkBudget, estimateCost, logUsage, readLedger, usageCost, type RequestShape } from "./lib/guard.ts";
import { CUSTOM_ID, defaultContext, type AtlasJob, type JobContext } from "./lib/job.ts";
import { reviewHtml, sample, writeReview } from "./lib/review.ts";
import { writeKind } from "./lib/shards.ts";
import { extractJson, toRecords, validateRecords, writeRejects, type Reject } from "./lib/validate.ts";

type Args = { job: string; dry: boolean; fromRaw: boolean; fresh: boolean; limit?: number; offset: number; pollMs: number };

export function parseArgs(argv: readonly string[]): Args {
  const a: Args = { job: "", dry: false, fromRaw: false, fresh: false, offset: 0, pollMs: 30_000 };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i]!;
    const num = () => {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 0) throw new Error(`${v} needs a whole number`);
      return n;
    };
    if (v === "--dry") a.dry = true;
    else if (v === "--from-raw") a.fromRaw = true;
    else if (v === "--fresh") a.fresh = true;
    else if (v === "--limit") a.limit = num();
    else if (v === "--offset") a.offset = num();
    else if (v === "--poll") a.pollMs = num() * 1000;
    else if (v.startsWith("--")) throw new Error(`unknown flag ${v}`);
    else if (!a.job) a.job = v.replace(/\.ts$/, "");
    else throw new Error(`unexpected argument ${v}`);
  }
  if (!a.job) throw new Error("usage: npx tsx run.ts <job> [--dry] [--limit N] [--offset N] [--from-raw] [--fresh]");
  return a;
}

async function loadJob(name: string): Promise<AtlasJob<unknown, unknown>> {
  const file = join(ROOT, "jobs", `${name}.ts`);
  if (!existsSync(file)) throw new Error(`no job file jobs/${name}.ts`);
  const mod = (await import(pathToFileURL(file).href)) as { default?: AtlasJob<unknown, unknown> };
  if (!mod.default) throw new Error(`jobs/${name}.ts has no default export`);
  return mod.default;
}

function contentShape(content: Anthropic.MessageParam["content"]): { chars: number; images: number } {
  if (typeof content === "string") return { chars: content.length, images: 0 };
  let chars = 0;
  let images = 0;
  for (const b of content) {
    if (b.type === "text") chars += b.text.length;
    else if (b.type === "image") images++;
    else chars += JSON.stringify(b).length;
  }
  return { chars, images };
}

function readRaw(path: string): Map<string, Reply> {
  const m = new Map<string, Reply>();
  if (!existsSync(path)) throw new Error(`no raw replies at ${path}`);
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as Reply;
    m.set(r.id, r);
  }
  return m;
}

/** Replies to records: parse, prepare, validate, check, finalize; then shards, review, rejects. */
async function processReplies(job: AtlasJob<unknown, unknown>, inputs: Map<string, unknown>, replies: Map<string, Reply>, ctx: JobContext) {
  const valid: unknown[] = [];
  const rejects: Reject[] = [];
  for (const [id, input] of inputs) {
    const reply = replies.get(id);
    if (!reply) {
      rejects.push({ job: job.id, request: id, reason: ["no reply"], record: null });
      continue;
    }
    if (reply.status !== "succeeded") {
      rejects.push({ job: job.id, request: id, reason: [`request ${reply.status}${reply.error ? `: ${reply.error}` : ""}`], record: null });
      continue;
    }
    if (reply.stop_reason !== "end_turn") {
      rejects.push({ job: job.id, request: id, reason: [`stop_reason ${reply.stop_reason}`], record: reply.text ?? null });
      continue;
    }
    let raw: unknown[];
    try {
      raw = job.parse ? job.parse(reply.text ?? "", input) : toRecords(extractJson(reply.text ?? ""));
    } catch (e) {
      rejects.push({ job: job.id, request: id, reason: [`unparseable reply: ${e instanceof Error ? e.message : String(e)}`], record: reply.text ?? null });
      continue;
    }
    const prepared = job.prepare ? raw.map((r) => job.prepare!(r, input, ctx)) : raw;
    const checked = validateRecords(job.id, id, prepared, job.schema, job.check ? (r) => job.check!(r, ctx) : undefined);
    valid.push(...checked.ok);
    rejects.push(...checked.rejects);
  }
  const final = job.finalize ? await job.finalize(valid, ctx) : valid;

  const entries = writeKind(PATHS.out, job.kind, final, job.shardOf ? (r) => job.shardOf!(r) : undefined);
  const rejectsPath = writeRejects(PATHS.rejects, job.id, rejects, true);
  const review = writeReview(
    PATHS.review,
    job.id,
    reviewHtml({ job: job.id, kind: job.kind, total: final.length, rejects: rejects.length, sampled: sample(final, undefined, job.id), render: job.renderReview ? (r) => job.renderReview!(r) : undefined }),
  );
  ctx.log(`Valid records: ${final.length}. Rejected: ${rejects.length} (${rejectsPath}).`);
  for (const e of entries) ctx.log(`  ${e.path}: ${e.count} records, ${e.bytes} bytes, sha256 ${e.sha256.slice(0, 12)}`);
  ctx.log(`Review page: ${review}`);
}

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);
  const job = await loadJob(args.job);
  const ctx: JobContext = { ...defaultContext(console.log, args.dry), run: { limit: args.limit, offset: args.offset, fromRaw: args.fromRaw } };
  const rawPath = join(PATHS.raw, `${job.id}.jsonl`);
  const statePath = join(PATHS.state, `${job.id}.json`);

  let all = await job.loadInputs(ctx);
  all = all.slice(args.offset, args.limit === undefined ? undefined : args.offset + args.limit);
  const inputs = new Map<string, unknown>();
  all.forEach((input, i) => {
    const id = job.requestId(input, args.offset + i);
    if (!CUSTOM_ID.test(id)) throw new Error(`request id "${id}" must match ${CUSTOM_ID}`);
    if (inputs.has(id)) throw new Error(`request id "${id}" is not unique`);
    inputs.set(id, input);
  });
  ctx.log(`Job ${job.id}: ${inputs.size} request(s), ${job.model}, ${job.mode}.`);

  if (args.fromRaw) {
    await processReplies(job, inputs, readRaw(rawPath), ctx);
    return 0;
  }

  if (args.fresh) clearState(statePath);
  const resuming = job.mode === "batch" && readState(statePath) !== null;

  const requests: BatchRequest[] = [];
  const shapes: RequestShape[] = [];
  if (!resuming) {
    for (const [id, input] of inputs) {
      const content = await job.buildPrompt(input, ctx);
      const params = buildParams({ model: job.model, system: job.system, content, maxTokens: job.maxTokens, effort: job.effort });
      const s = contentShape(content);
      shapes.push({ systemChars: job.system.length, userChars: s.chars, images: s.images, outputTokens: job.expectedOutputTokens, imageTokens: job.imageTokens });
      requests.push({ custom_id: id, params });
    }
    const est = estimateCost(job.model, shapes, job.mode === "batch");
    const worst = estimateCost(job.model, shapes.map((s) => ({ ...s, outputTokens: job.maxTokens })), job.mode === "batch");
    ctx.log(`Estimate: ${est.inputTokens} input tokens, ${est.outputTokens} output tokens, $${est.usd.toFixed(4)} (every reply at max_tokens: $${worst.usd.toFixed(4)}).`);
    const guard = checkBudget(job.id, est.usd, readLedger(PATHS.costs));
    for (const l of guard.lines) ctx.log(`  ${l}`);
    if (!guard.ok) {
      ctx.log(`REFUSED: ${guard.reason}. Lower --limit, trim the prompt, or ask the owner to raise the budget in config.ts.`);
      return 2;
    }
    if (args.dry) {
      ctx.log("Dry run: nothing sent.");
      return 0;
    }
  } else if (args.dry) {
    ctx.log(`Dry run: an unfinished batch is in ${statePath}; a real run resumes it at no new cost.`);
    return 0;
  }

  loadEnv();
  const client = new Anthropic();
  mkdirSync(PATHS.raw, { recursive: true });
  const rawLines: string[] = [];
  let runUsd = 0;
  const onReply = (r: Reply) => {
    rawLines.push(JSON.stringify(r));
    if (r.usage) {
      const usd = usageCost(job.model, r.usage, job.mode === "batch");
      runUsd += usd;
      logUsage(PATHS.costs, {
        job: job.id,
        request: r.id,
        model: r.model ?? job.model,
        mode: job.mode,
        input_tokens: r.usage.input_tokens,
        cache_write_tokens: r.usage.cache_creation_input_tokens ?? 0,
        cache_read_tokens: r.usage.cache_read_input_tokens ?? 0,
        output_tokens: r.usage.output_tokens,
        usd,
      });
    }
  };
  const replies =
    job.mode === "batch"
      ? await runBatches(client, job.id, requests, statePath, { pollMs: args.pollMs, log: ctx.log, onReply })
      : await runDirect(client, requests, { log: ctx.log, onReply });
  // Keep earlier replies for requests this run did not send, so a partial rerun (--offset/--limit)
  // followed by --from-raw rebuilds the whole job.
  const sent = new Set(inputs.keys());
  const kept = existsSync(rawPath) ? [...readRaw(rawPath).values()].filter((r) => !sent.has(r.id)).map((r) => JSON.stringify(r)) : [];
  writeFileSync(rawPath, [...kept, ...rawLines].join("\n") + "\n");
  clearState(statePath);
  ctx.log(`Spent this run: $${runUsd.toFixed(4)} (logged to ${PATHS.costs}). Replies saved to ${rawPath}.`);

  await processReplies(job, inputs, replies, ctx);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    },
  );
}
