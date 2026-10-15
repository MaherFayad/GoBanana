/**
 * Validation (plan 6.1): every record is parsed with its zod schema, then the shared writing
 * rules and the job's own checks run. Invalid records go to rejects/<job>.jsonl and are never
 * shipped.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { z } from "zod";

export type Reject = { job: string; request: string; reason: string[]; record: unknown };

/**
 * The JSON value in a model reply: a ```json fenced block when there is one, else the text from
 * the first [ or { to the matching last ] or }. Throws when nothing parses.
 */
export function extractJson(text: string): unknown {
  const fence = /```(?:json)?\s*\n([\s\S]*?)\n```/.exec(text);
  if (fence?.[1]) return JSON.parse(fence[1]);
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to the bracket scan
  }
  const starts = [trimmed.indexOf("["), trimmed.indexOf("{")].filter((i) => i >= 0);
  if (starts.length === 0) throw new Error("no JSON in the reply");
  const start = Math.min(...starts);
  const close = trimmed[start] === "[" ? "]" : "}";
  const end = trimmed.lastIndexOf(close);
  if (end <= start) throw new Error("no JSON in the reply");
  return JSON.parse(trimmed.slice(start, end + 1));
}

/** A reply's records: a JSON array, an object with a "records" array, or one object. */
export function toRecords(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray((value as { records?: unknown }).records)) return (value as { records: unknown[] }).records;
  return [value];
}

const EM_DASH = /\u2014/;
const TASHKEEL = /[\u064B-\u065F\u0670]/;

/** Writing rules for every string in a record: no em dashes, Arabic without tashkeel. */
export function writingProblems(value: unknown, path = ""): string[] {
  if (typeof value === "string") {
    const out: string[] = [];
    if (EM_DASH.test(value)) out.push(`${path || "value"}: has an em dash`);
    if (TASHKEEL.test(value)) out.push(`${path || "value"}: Arabic has tashkeel`);
    return out;
  }
  if (Array.isArray(value)) return value.flatMap((v, i) => writingProblems(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => writingProblems(v, path ? `${path}.${k}` : k));
  }
  return [];
}

export type Checked<T> = { ok: T[]; rejects: Reject[] };

/**
 * Parses each raw record with the schema, then the writing rules, then `check` (the job's own
 * rules on the parsed record; return problems, empty when fine). Order is kept.
 */
export function validateRecords<T>(
  job: string,
  request: string,
  raw: readonly unknown[],
  schema: z.ZodType<T>,
  check?: (record: T) => string[],
): Checked<T> {
  const ok: T[] = [];
  const rejects: Reject[] = [];
  for (const record of raw) {
    const parsed = schema.safeParse(record);
    if (!parsed.success) {
      rejects.push({ job, request, record, reason: parsed.error.issues.map((i) => `${i.path.join(".") || "record"}: ${i.message}`) });
      continue;
    }
    const problems = [...writingProblems(parsed.data), ...(check ? check(parsed.data) : [])];
    if (problems.length > 0) {
      rejects.push({ job, request, record, reason: problems });
      continue;
    }
    ok.push(parsed.data);
  }
  return { ok, rejects };
}

/** Writes rejects/<job>.jsonl. `fresh` truncates first (a new run); otherwise it appends. */
export function writeRejects(dir: string, job: string, rejects: readonly Reject[], fresh = false): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${job}.jsonl`);
  if (fresh) writeFileSync(path, "");
  if (rejects.length > 0) appendFileSync(path, rejects.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return path;
}
