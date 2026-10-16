/**
 * The shard layout contract (W3). Jobs write out/v1/<job kind>/ with size-based shards
 * (lib/shards.ts). The server's loader (banana-server/lib/atlas/loader.ts) reads another layout:
 *
 *   pages/<nn>, domains/<nn>, lenses/<nn>, slop/<nn>   read whole (split by size, any names)
 *   fit/<domainId>, page-fit/<domainId>, mechanics/<UiElement>, cc0/<region>, type-pairs/<voice>  one named shard each
 *                                                    (a cc0 region over the limit: parts <region>_00, _01, ...)
 *   cards/<bucket>, lines/<bucket>, recipes/<bucket>     hash buckets: bucketOf(id, count)
 *
 * This file turns the job output into that layout and the loader's manifest format
 * ({ version, hash, shards: [{ kind, shard, sha256, bytes }] }). The bucket hash and the recipe
 * key come from the loader itself, so the two can never drift. Every shard stays under the size
 * limit; a named shard that cannot (one domain, element or region over 100 KB) is an error, since
 * the loader reads it as one file.
 *
 * Job kinds map to server kinds below; kinds the server does not read (example, bench, ...) are skipped and listed.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bucketOf, recipeKeyString } from "../../banana-server/lib/atlas/loader.ts";
import { SHARD_MAX_BYTES } from "../config.ts";
import { readManifest, sha256, shardText } from "./shards.ts";

/**
 * The kinds the server's loader reads (banana-server/lib/atlas/loader.ts ATLAS_KINDS), plus the
 * J13 stunning layer ("shaders", "motion": read whole, split by size), which the loader's
 * ATLAS_KINDS does not list yet.
 */
export type ServerKind = "pages" | "domains" | "fit" | "page-fit" | "cards" | "lines" | "mechanics" | "lenses" | "recipes" | "cc0" | "slop" | "shaders" | "motion" | "type-pairs";

export type ServerShard = { kind: ServerKind; shard: string; sha256: string; bytes: number };
export type ServerManifest = { version: string; hash: string; shards: ServerShard[] };

type Rule =
  | { kind: ServerKind; by: "size" }
  | { kind: ServerKind; by: "name"; nameOf: (r: never) => string; split?: boolean }
  | { kind: ServerKind; by: "bucket"; idOf: (r: never) => string };

/** Job kind (out/v1/<kind>/) to server kind and placement. */
export const JOB_KINDS: Readonly<Record<string, Rule>> = {
  anatomy: { kind: "pages", by: "size" },
  pages: { kind: "pages", by: "size" },
  domains: { kind: "domains", by: "size" },
  lenses: { kind: "lenses", by: "size" },
  slop: { kind: "slop", by: "size" },
  shaders: { kind: "shaders", by: "size" },
  motion: { kind: "motion", by: "size" },
  "type-pairs": { kind: "type-pairs", by: "name", nameOf: (r: { voice: string }) => r.voice },
  fit: { kind: "fit", by: "name", nameOf: (r: { domainId: string }) => r.domainId },
  "page-fit": { kind: "page-fit", by: "name", nameOf: (r: { domainId: string }) => r.domainId },
  mechanics: { kind: "mechanics", by: "name", nameOf: (r: { element: string }) => r.element },
  // A region over the size limit is split into parts "<region>_00", "<region>_01", ... (cc0Parts).
  cc0: { kind: "cc0", by: "name", nameOf: (r: { region?: string }) => r.region || "global", split: true },
  cards: { kind: "cards", by: "bucket", idOf: (r: { id: string }) => r.id },
  "card-elements": { kind: "lines", by: "bucket", idOf: (r: { cardId: string }) => r.cardId },
  lines: { kind: "lines", by: "bucket", idOf: (r: { cardId: string }) => r.cardId },
  recipes: { kind: "recipes", by: "bucket", idOf: (r: { key: Parameters<typeof recipeKeyString>[0] }) => recipeKeyString(r.key) },
};

const bytesOf = (records: readonly unknown[]) => Buffer.byteLength(shardText(records));

/** Size-split shards named "00", "01", ... (order kept). */
function bySize(records: readonly unknown[], maxBytes: number): Map<string, unknown[]> {
  const out = new Map<string, unknown[]>();
  let current: unknown[] = [];
  for (const r of records) {
    if (bytesOf([r]) > maxBytes) throw new Error(`one record is over the ${maxBytes} byte shard limit`);
    if (current.length > 0 && bytesOf([...current, r]) > maxBytes) {
      out.set(String(out.size).padStart(2, "0"), current);
      current = [];
    }
    current.push(r);
  }
  if (current.length > 0) out.set(String(out.size).padStart(2, "0"), current);
  return out;
}

/** The smallest bucket count (from the size estimate up) whose every bucket fits. */
export function bucketize(records: readonly unknown[], idOf: (r: never) => string, maxBytes: number): Map<string, unknown[]> {
  const total = bytesOf(records);
  for (let n = Math.max(1, Math.ceil(total / (maxBytes * 0.8))); n <= 999; n++) {
    const out = new Map<string, unknown[]>();
    for (let i = 0; i < n; i++) out.set(String(i).padStart(2, "0"), []);
    for (const r of records) out.get(bucketOf((idOf as (x: unknown) => string)(r), n))!.push(r);
    if ([...out.values()].every((rows) => bytesOf(rows) <= maxBytes)) return out;
  }
  throw new Error("could not fit the records in 999 buckets");
}

function byName(kind: string, records: readonly unknown[], nameOf: (r: never) => string, maxBytes: number, split = false): Map<string, unknown[]> {
  const out = new Map<string, unknown[]>();
  for (const r of records) {
    const name = String((nameOf as (x: unknown) => string)(r));
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name)) throw new Error(`${kind}: shard name "${name}" must be letters, digits, hyphens or underscores`);
    out.set(name, [...(out.get(name) ?? []), r]);
  }
  for (const [name, rows] of [...out]) {
    const b = bytesOf(rows);
    if (b > maxBytes && split) {
      out.delete(name);
      for (const [part, partRows] of bySize(rows, maxBytes)) out.set(`${name}_${part}`, partRows);
      continue;
    }
    if (b > maxBytes) throw new Error(`${kind}/${name} is ${b} bytes, over ${maxBytes}: the loader reads it as one shard, so trim it or change the layout`);
  }
  return out;
}

export type ServerLayout = {
  manifest: ServerManifest;
  /** Shard text by path relative to the version folder ("cards/00.json"). */
  files: Map<string, string>;
  /** Job kinds the server does not read. */
  skipped: string[];
};

/** Pure: records by job kind to the server layout. Kinds that map to one server kind are joined. */
export function serverLayout(recordsByJobKind: ReadonlyMap<string, readonly unknown[]>, opts: { version?: string; maxBytes?: number } = {}): ServerLayout {
  const maxBytes = opts.maxBytes ?? SHARD_MAX_BYTES;
  const joined = new Map<ServerKind, { rule: Rule; records: unknown[] }>();
  const skipped: string[] = [];
  for (const [jobKind, records] of [...recordsByJobKind].sort(([a], [b]) => a.localeCompare(b))) {
    const rule = JOB_KINDS[jobKind];
    if (!rule) {
      skipped.push(jobKind);
      continue;
    }
    const entry = joined.get(rule.kind) ?? { rule, records: [] };
    entry.records.push(...records);
    joined.set(rule.kind, entry);
  }
  const files = new Map<string, string>();
  const shards: ServerShard[] = [];
  for (const [kind, { rule, records }] of [...joined].sort(([a], [b]) => a.localeCompare(b))) {
    if (records.length === 0) continue;
    const plan =
      rule.by === "size" ? bySize(records, maxBytes) : rule.by === "name" ? byName(kind, records, rule.nameOf, maxBytes, rule.split) : bucketize(records, rule.idOf, maxBytes);
    for (const [shard, rows] of [...plan].sort(([a], [b]) => a.localeCompare(b))) {
      const text = shardText(rows);
      files.set(`${kind}/${shard}.json`, text);
      shards.push({ kind, shard, sha256: sha256(text), bytes: Buffer.byteLength(text) });
    }
  }
  const hash = shards.length > 0 ? sha256(shards.map((s) => `${s.kind}/${s.shard}:${s.sha256}`).join("\n")) : "";
  return { manifest: { version: opts.version ?? "v1", hash, shards }, files, skipped };
}

/** Records of every job kind in out/v1, read through the job manifest (verify it first). */
export function readJobRecords(jobOutDir: string): Map<string, unknown[]> {
  const manifest = readManifest(join(jobOutDir, "manifest.json"));
  const out = new Map<string, unknown[]>();
  for (const e of manifest.shards) {
    const rows = JSON.parse(readFileSync(join(jobOutDir, e.path), "utf8")) as unknown[];
    out.set(e.kind, [...(out.get(e.kind) ?? []), ...rows]);
  }
  return out;
}

/** Writes the layout to serverOutDir/<kind>/<shard>.json plus manifest.json (old shards removed). */
export function writeServerLayout(serverOutDir: string, layout: ServerLayout): string {
  if (existsSync(serverOutDir)) {
    for (const d of readdirSync(serverOutDir)) rmSync(join(serverOutDir, d), { recursive: true, force: true });
  }
  for (const [path, text] of layout.files) {
    const file = join(serverOutDir, path);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, text);
  }
  const manifestFile = join(serverOutDir, "manifest.json");
  mkdirSync(serverOutDir, { recursive: true });
  writeFileSync(manifestFile, JSON.stringify(layout.manifest, null, 2) + "\n");
  return manifestFile;
}

/** The wrangler commands (run from banana-server/) for the server layout, the manifest last. */
export function serverUploadCommands(layout: ServerLayout, serverOutDir: string, rel: (p: string) => string, bucket: string, prefix: string): string[] {
  const put = (key: string, file: string) => `npx wrangler r2 object put ${bucket}/${prefix}/${key} --file "${rel(file)}" --content-type application/json --remote`;
  return [...[...layout.files.keys()].map((p) => put(p, join(serverOutDir, p))), put("manifest.json", join(serverOutDir, "manifest.json"))];
}
