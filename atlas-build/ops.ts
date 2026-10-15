/**
 * Content ops for the owner (P2-03, .claude/skills/gobanana-atlas-ops). No API calls: the records
 * are written in the owner's own Claude Code session; this script only checks, merges and lays
 * them out.
 *
 *   npx tsx ops.ts validate <kind> <file.json>     zod schema, writing rules, fonts, shipPairs; rejects to rejects/ops-<kind>.jsonl
 *   npx tsx ops.ts merge <kind> <file.json> [--out dir]   validate, then add to <out>/<kind>/ (same id replaces); default out/v1
 *   npx tsx ops.ts layout <jobOutDir> <serverOutDir>      the server layout (lib/layout.ts) of a job output folder
 *
 * <kind> is a SCHEMAS key from schema.ts: anatomy, domains, cards, fit, card-elements, mechanics,
 * lenses, recipes, cc0, slop.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { recipeId } from "../banana-server/lib/atlas/loader.ts";
import { PATHS } from "./config.ts";
import { checkCardFonts, checkLensFonts, defaultContext, withShipPairs } from "./lib/job.ts";
import { readJobRecords, serverLayout, writeServerLayout } from "./lib/layout.ts";
import { writeKind } from "./lib/shards.ts";
import { toRecords, validateRecords, writeRejects } from "./lib/validate.ts";
import { SCHEMAS, type AtlasKind } from "./schema.ts";

/** The identity of a record per kind: a new record with the same identity replaces the old one. */
export function recordKey(kind: AtlasKind, r: Record<string, unknown>): string {
  switch (kind) {
    case "fit":
      return `${r.cardId}|${r.domainId}`;
    case "card-elements":
      return `${r.cardId}|${r.element}`;
    case "recipes":
      return recipeId(r as never);
    case "slop":
      return `${r.feature}|${r.value}`;
    case "cc0":
    default:
      return String(r.id ?? JSON.stringify(r));
  }
}

/** Schema, writing rules and the kind's own checks (fonts, computed shipPairs). */
export function validateOps(kind: AtlasKind, raw: readonly unknown[]) {
  const ctx = defaultContext(() => {});
  const prepared = kind === "cards" || kind === "lenses" ? raw.map((r) => (kind === "cards" ? withShipPairs(r) : r)) : raw;
  const check = (rec: unknown): string[] => {
    if (kind === "cards") {
      const c = rec as Parameters<typeof checkCardFonts>[0] & { shipPairs: unknown[] };
      return [...checkCardFonts(c, ctx), ...(c.shipPairs.length === 0 ? ["no palette pair passes 4.5:1, so nothing can ship"] : [])];
    }
    if (kind === "lenses") return checkLensFonts(rec as Parameters<typeof checkLensFonts>[0], ctx);
    return [];
  };
  return validateRecords(`ops-${kind}`, "ops", prepared, SCHEMAS[kind] as never, check);
}

/** Existing records of a kind plus the new ones; a new record replaces one with the same key. */
export function mergeRecords(kind: AtlasKind, existing: readonly unknown[], incoming: readonly unknown[]): unknown[] {
  const byKey = new Map<string, unknown>();
  for (const r of [...existing, ...incoming]) byKey.set(recordKey(kind, r as Record<string, unknown>), r);
  return [...byKey.values()];
}

function main(argv: readonly string[]): number {
  const [cmd, a, b] = argv;
  if (cmd === "layout" && a && b) {
    const layout = serverLayout(readJobRecords(a));
    writeServerLayout(b, layout);
    console.log(`Wrote ${layout.manifest.shards.length} shards (manifest ${layout.manifest.hash.slice(0, 12)}) to ${b}.${layout.skipped.length ? ` Skipped: ${layout.skipped.join(", ")}.` : ""}`);
    return 0;
  }
  if ((cmd !== "validate" && cmd !== "merge") || !a || !b || !(a in SCHEMAS)) {
    console.error("Usage: npx tsx ops.ts validate|merge <kind> <file.json> [--out dir] | layout <jobOutDir> <serverOutDir>");
    return 2;
  }
  const kind = a as AtlasKind;
  const raw = toRecords(JSON.parse(readFileSync(b, "utf8")));
  const { ok, rejects } = validateOps(kind, raw);
  const rejectsFile = writeRejects(PATHS.rejects, `ops-${kind}`, rejects, true);
  console.log(`${ok.length} valid, ${rejects.length} rejected${rejects.length ? ` (see ${rejectsFile})` : ""}.`);
  for (const r of rejects.slice(0, 10)) console.log(`- ${JSON.stringify((r.record as { id?: unknown })?.id ?? "")}: ${r.reason.join("; ")}`);
  if (cmd === "validate") return rejects.length > 0 ? 1 : 0;
  if (rejects.length > 0) {
    console.error("Nothing merged: fix the rejects first.");
    return 1;
  }
  const outIdx = argv.indexOf("--out");
  const out = outIdx > 0 ? argv[outIdx + 1]! : PATHS.out;
  const existing = readJobRecords(out).get(kind) ?? [];
  const merged = mergeRecords(kind, existing, ok);
  writeKind(out, kind, merged);
  console.log(`${kind}: ${existing.length} before, ${merged.length} after, in ${join(out, kind)}.`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exit(main(process.argv.slice(2)));
