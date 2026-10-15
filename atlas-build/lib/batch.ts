/**
 * Message Batches runner (plan 6.1) with the shared system prefix cached, plus a direct path for
 * iterative jobs. Batch ids are saved to state/<job>.json as soon as they exist, so a crash or a
 * pause resumes the same batches instead of paying twice. Request bodies (which may hold base64
 * thumbnails) are never written to disk; only ids and replies are.
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ModelId } from "../config.ts";
import type { Effort, UserContent } from "./job.ts";

export type Params = Anthropic.MessageCreateParamsNonStreaming;
export type BatchRequest = { custom_id: string; params: Params };

/** One reply, as stored in raw/<job>.jsonl. */
export type Reply = {
  id: string;
  status: "succeeded" | "errored" | "canceled" | "expired";
  model?: string;
  stop_reason?: string | null;
  text?: string;
  usage?: Anthropic.Usage;
  error?: string;
};

/** Request params: the system prefix as one cached text block, then the user turn. */
export function buildParams(opts: { model: ModelId; system: string; content: UserContent; maxTokens: number; effort?: Effort }): Params {
  const params: Params = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.content }],
  };
  if (opts.effort) params.output_config = { effort: opts.effort };
  return params;
}

/** Batches stay well under the API limits (100,000 requests, 256 MB). */
export const MAX_BATCH_REQUESTS = 10_000;
export const MAX_BATCH_BYTES = 180 * 1024 * 1024;

export function splitBatches(requests: readonly BatchRequest[], maxRequests = MAX_BATCH_REQUESTS, maxBytes = MAX_BATCH_BYTES): BatchRequest[][] {
  const out: BatchRequest[][] = [];
  let cur: BatchRequest[] = [];
  let bytes = 0;
  for (const r of requests) {
    const b = Buffer.byteLength(JSON.stringify(r));
    if (cur.length > 0 && (cur.length >= maxRequests || bytes + b > maxBytes)) {
      out.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(r);
    bytes += b;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

export type BatchState = { job: string; created: string; batches: Array<{ id: string; requests: number }> };

export function readState(path: string): BatchState | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as BatchState) : null;
}

function writeState(path: string, state: BatchState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

export function clearState(path: string): void {
  if (existsSync(path)) rmSync(path);
}

function replyFromMessage(id: string, m: Anthropic.Message): Reply {
  const text = m.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { id, status: "succeeded", model: m.model, stop_reason: m.stop_reason, text, usage: m.usage };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Submits the requests as one or more batches (or resumes the batches in `statePath`), waits for
 * them to end, and returns every reply keyed by custom_id. `onReply` runs once per reply as it is
 * read (the runner logs costs there).
 */
export async function runBatches(
  client: Anthropic,
  job: string,
  requests: readonly BatchRequest[],
  statePath: string,
  opts: { pollMs?: number; log?: (line: string) => void; onReply?: (r: Reply) => void } = {},
): Promise<Map<string, Reply>> {
  const log = opts.log ?? console.log;
  let state = readState(statePath);
  if (state) {
    log(`Resuming ${state.batches.length} batch(es) from ${statePath}; not submitting again.`);
  } else {
    state = { job, created: new Date().toISOString(), batches: [] };
    for (const chunk of splitBatches(requests)) {
      const b = await client.messages.batches.create({ requests: chunk });
      state.batches.push({ id: b.id, requests: chunk.length });
      writeState(statePath, state); // saved before anything else can fail
      log(`Submitted batch ${b.id} with ${chunk.length} request(s).`);
    }
  }

  const replies = new Map<string, Reply>();
  for (const { id } of state.batches) {
    for (;;) {
      const b = await client.messages.batches.retrieve(id);
      if (b.processing_status === "ended") break;
      const c = b.request_counts;
      log(`Batch ${id}: ${b.processing_status}, ${c.processing} processing, ${c.succeeded} done, ${c.errored} errored.`);
      await sleep(opts.pollMs ?? 30_000);
    }
    for await (const r of await client.messages.batches.results(id)) {
      let reply: Reply;
      if (r.result.type === "succeeded") reply = replyFromMessage(r.custom_id, r.result.message);
      else if (r.result.type === "errored") reply = { id: r.custom_id, status: "errored", error: JSON.stringify(r.result.error) };
      else reply = { id: r.custom_id, status: r.result.type };
      replies.set(r.custom_id, reply);
      opts.onReply?.(reply);
    }
  }
  return replies;
}

/** Direct (non-batch) calls, a few at a time, streamed so long outputs do not time out. */
export async function runDirect(
  client: Anthropic,
  requests: readonly BatchRequest[],
  opts: { concurrency?: number; log?: (line: string) => void; onReply?: (r: Reply) => void } = {},
): Promise<Map<string, Reply>> {
  const replies = new Map<string, Reply>();
  let next = 0;
  const worker = async () => {
    while (next < requests.length) {
      const req = requests[next++]!;
      let reply: Reply;
      try {
        const m = await client.messages.stream(req.params).finalMessage();
        reply = replyFromMessage(req.custom_id, m);
      } catch (e) {
        reply = { id: req.custom_id, status: "errored", error: e instanceof Error ? e.message : String(e) };
      }
      replies.set(req.custom_id, reply);
      opts.onReply?.(reply);
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 4, requests.length) }, worker));
  return replies;
}
