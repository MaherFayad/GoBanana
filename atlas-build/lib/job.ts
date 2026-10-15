/**
 * The job interface. One file in jobs/ default-exports one AtlasJob; `npx tsx run.ts <id>` runs it.
 *
 * Pipeline per run:
 *   loadInputs -> (limit/offset) -> buildPrompt per input -> estimate + spend guard
 *   -> Message Batches (or direct calls) with `system` as a cached prefix
 *   -> per reply: parse -> prepare (per raw record) -> zod schema -> writing rules -> check
 *   -> finalize (all valid records) -> shards + manifest, review page, rejects file.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { ModelId } from "../config.ts";
import { shipPairs, type PaletteEntry } from "./contrast.ts";
import { checkTypeSpec, loadFonts, type FontIndex } from "./fonts.ts";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export type UserContent = string | Anthropic.ContentBlockParam[];

export type JobContext = {
  /** True on --dry: no API calls will be made. Jobs may skip slow fetches (thumbnails) and use placeholderImage(). */
  dry: boolean;
  /** Google Fonts index (data/google-fonts.json), loaded on first use. */
  fonts: () => FontIndex;
  log: (line: string) => void;
};

export interface AtlasJob<Input, Rec> {
  /** "j3-cards". The part before the first hyphen is the budget key in config.ts BUDGETS. */
  id: string;
  /** Output folder: out/v1/<kind>/. Use a SCHEMAS key from schema.ts where one fits. */
  kind: string;
  model: ModelId;
  /** "batch" (50% off, async, use for every job the plan marks batch) or "direct" (iterative jobs). */
  mode: "batch" | "direct";
  /** Parses one record. Use a schema from schema.ts. */
  schema: z.ZodType<Rec>;
  /** Shared prefix: rules (PROMPT_RULES), types (typeText), taxonomy. Sent with cache_control. Keep it stable. */
  system: string;
  /** max_tokens per request. Thinking tokens count against it. */
  maxTokens: number;
  /** Expected output tokens per request (thinking included), for the spend estimate. */
  expectedOutputTokens: number;
  /** output_config.effort. Opus 5.5 and Haiku 5.5 default to medium, Sonnet 5.5 to high. */
  effort?: Effort;

  /** The work items; each becomes one request. */
  loadInputs(ctx: JobContext): Input[] | Promise<Input[]>;
  /** Unique, stable request id: [a-zA-Z0-9_-], 1 to 64 characters. */
  requestId(input: Input, index: number): string;
  /** The user message for one input: text, or blocks with images (lib/thumbs.ts fetchThumbBlock). */
  buildPrompt(input: Input, ctx: JobContext): UserContent | Promise<UserContent>;

  /** Raw records from a reply's text. Default: the JSON (fenced or bare) as an array, {records: []} or one object. */
  parse?(text: string, input: Input): unknown[];
  /** Fills computed fields before the schema runs (shipPairs, ids, the input's keys). Return the raw record. */
  prepare?(raw: unknown, input: Input, ctx: JobContext): unknown;
  /** Rules beyond the schema on one parsed record. Return problems; any problem rejects the record. */
  check?(record: Rec, ctx: JobContext): string[];
  /** Cross-record work on all valid records (dedupe, merge, sort) before shards are written. */
  finalize?(records: Rec[], ctx: JobContext): Rec[] | Promise<Rec[]>;
  /** Shard name for a record (lowercase-hyphen). Default: one shard "all", split by size. */
  shardOf?(record: Rec): string;
  /** HTML for one record on the review page. Default: JSON with color chips. Escape all text. */
  renderReview?(record: Rec): string;
}

/** Identity helper for type inference in job files: `export default defineJob({...})`. */
export function defineJob<Input, Rec>(job: AtlasJob<Input, Rec>): AtlasJob<Input, Rec> {
  return job;
}

export const CUSTOM_ID = /^[a-zA-Z0-9_-]{1,64}$/;

/** A 1x1 PNG stand-in for thumbnails in dry runs; the estimate counts it as a full image. */
export function placeholderImage(): Anthropic.ImageBlockParam {
  return {
    type: "image",
    source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=" },
  };
}

// ---------------------------------------------------------------------------------------------
// Helpers for common prepare/check steps.

/** prepare step for records with a palette: sets shipPairs from lib/contrast.ts (the model's are dropped). */
export function withShipPairs(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as { palette?: unknown };
  if (!Array.isArray(r.palette)) return raw;
  try {
    return { ...r, shipPairs: shipPairs(r.palette as PaletteEntry[]) };
  } catch {
    return raw; // a bad hex: the schema rejects the record with a clear message
  }
}

/** check step for IngredientCard["type"]: every family must be a Google Fonts family (Arabic slots need the subset). */
export function checkCardFonts(record: { type: { latin: { display: string; body: string }; arabic: { display: string; body: string } } }, ctx: JobContext): string[] {
  return checkTypeSpec(record.type, ctx.fonts());
}

/** check step for LensPack typePairs. */
export function checkLensFonts(record: { typePairs: Array<{ latin: { display: string; body: string }; arabic: { display: string; body: string } }> }, ctx: JobContext): string[] {
  return record.typePairs.flatMap((t, i) => checkTypeSpec(t, ctx.fonts(), `typePairs[${i}]`));
}

export function defaultContext(log: (line: string) => void = console.log, dry = false): JobContext {
  return { dry, fonts: () => loadFonts(), log };
}
