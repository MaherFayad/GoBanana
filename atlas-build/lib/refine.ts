/**
 * Shared parts of the refinement rounds (budget keys r1 to r3, config.ts "Refine" block).
 *
 * A refine job reads an earlier job's output, changes or adds some records, and writes the whole
 * kind back (like j5-dedupe does for mechanics). Records merge by key, so running a refine job
 * again (or rebuilding it with --from-raw) gives the same result. Rebuild order after the J jobs:
 *
 *   npx tsx run.ts j3-cards --from-raw
 *   npx tsx run.ts r1-audit --from-raw        (card-audit: the critic's flags, build only)
 *   npx tsx run.ts r1-rewrite --from-raw      (cards: flagged cards rewritten, same ids and families)
 *   npx tsx run.ts r1-gulf-cards --from-raw   (cards: new Gulf and Arabic cards added)
 *   npx tsx run.ts j4-fit --from-raw, j4-elements --from-raw, j4b-page-fit --from-raw
 *   npx tsx run.ts r1-gulf-fit --from-raw     (fit: the new cards on every domain)
 *   npx tsx run.ts r1-lines --from-raw        (card-elements: lines for new and rewritten cards)
 *   npx tsx run.ts r1-gulf-page-fit --from-raw  (page-fit: the new cards on their domains' pages)
 *   npx tsx run.ts r1-weak-page-fit --from-raw  (page-fit: Qatar services and flight checkout rejudged)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../config.ts";
import type { IngredientCard } from "../schema.ts";

/** base with every record of `mine` put in place of the base record with the same key (new keys appended). */
export function mergeByKey<T>(base: readonly T[], mine: readonly T[], key: (r: T) => string): T[] {
  const byKey = new Map(mine.map((r) => [key(r), r]));
  const out = base.map((r) => byKey.get(key(r)) ?? r);
  const seen = new Set(base.map(key));
  for (const r of mine) if (!seen.has(key(r))) out.push(r);
  return out;
}

/** The card fields a critic or a fit judge reads (no shipPairs: the script computes them). */
export function cardForPrompt(c: IngredientCard): Omit<IngredientCard, "shipPairs"> {
  const { shipPairs: _drop, ...rest } = c;
  return rest;
}

/** The 755 J3 card ids (data/r1-j3-card-ids.json, written once before round 1), the set the card audit covers. */
export function j3CardIds(): Set<string> {
  return new Set(JSON.parse(readFileSync(join(ROOT, "data", "r1-j3-card-ids.json"), "utf8")) as string[]);
}

/** One reviewed text fix: in record `id` of `kind`, the string at `path` ("wildSpots.1.why") has `from` replaced by `to`. */
export type TextFix = { kind: string; id: string; path: string; from: string; to: string; why: string };

/**
 * Applies data/r1-text-fixes.json (owner review items fixed by hand in round 1) to a kind's records.
 * A fix whose text is no longer there throws, so a rerun of the job can never drop a fix silently.
 */
export function applyTextFixes<T extends { id: string }>(kind: string, records: T[], fixes: readonly TextFix[] = readTextFixes()): T[] {
  for (const f of fixes.filter((x) => x.kind === kind)) {
    const rec = records.find((r) => r.id === f.id);
    if (!rec) throw new Error(`text fix: no ${kind} record "${f.id}"`);
    const keys = f.path.split(".");
    let parent = rec as unknown as Record<string, unknown>;
    for (const k of keys.slice(0, -1)) parent = parent[k] as Record<string, unknown>;
    const last = keys[keys.length - 1]!;
    const value = parent?.[last];
    if (typeof value !== "string" || !value.includes(f.from)) throw new Error(`text fix: ${kind}/${f.id} ${f.path} no longer holds "${f.from.slice(0, 40)}"`);
    parent[last] = value.replace(f.from, f.to);
  }
  return records;
}

function readTextFixes(): TextFix[] {
  return JSON.parse(readFileSync(join(ROOT, "data", "r1-text-fixes.json"), "utf8")) as TextFix[];
}
