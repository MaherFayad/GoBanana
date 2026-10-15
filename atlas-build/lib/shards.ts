/**
 * Shards and manifest (plan 6.1). Records of one kind go to out/v1/<kind>/<shard>.json as a plain
 * JSON array, each file under 100 KB. out/v1/manifest.json lists every shard with its byte size,
 * record count and sha256, so the server's loader (P1-I1) can check a shard and cache by hash.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SHARD_MAX_BYTES } from "../config.ts";

export type ManifestEntry = { kind: string; shard: string; path: string; bytes: number; count: number; sha256: string };
export type Manifest = { version: "v1"; shards: ManifestEntry[] };

const SHARD_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function sha256(text: string | Uint8Array): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Serialized shard text: compact JSON with a final newline. */
export function shardText(records: readonly unknown[]): string {
  return JSON.stringify(records) + "\n";
}

/**
 * Splits records into chunks whose shard text stays at or under `maxBytes`, keeping order.
 * Throws when one record alone is too big.
 */
export function chunkBySize<T>(records: readonly T[], maxBytes = SHARD_MAX_BYTES): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let size = 3; // "[]\n"
  for (const r of records) {
    const bytes = Buffer.byteLength(JSON.stringify(r));
    if (bytes + 3 > maxBytes) throw new Error(`one record is ${bytes} bytes, over the ${maxBytes} byte shard limit`);
    const add = bytes + (current.length > 0 ? 1 : 0);
    if (current.length > 0 && size + add > maxBytes) {
      chunks.push(current);
      current = [];
      size = 3;
    }
    size += current.length > 0 ? bytes + 1 : bytes;
    current.push(r);
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Groups records by `shardOf` (default: one group "all"), then splits each group by size. A group
 * that needs more than one file gets names "<group>-1", "<group>-2" and so on.
 */
export function planShards<T>(records: readonly T[], shardOf: (r: T) => string = () => "all", maxBytes = SHARD_MAX_BYTES): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const r of records) {
    const g = shardOf(r);
    if (!SHARD_NAME.test(g)) throw new Error(`shard name "${g}" must be lowercase words joined by hyphens`);
    const list = groups.get(g) ?? [];
    list.push(r);
    groups.set(g, list);
  }
  const out = new Map<string, T[]>();
  for (const [g, list] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const chunks = chunkBySize(list, maxBytes);
    if (chunks.length === 1) out.set(g, chunks[0]!);
    else chunks.forEach((c, i) => out.set(`${g}-${i + 1}`, c));
  }
  return out;
}

export function readManifest(path: string): Manifest {
  if (!existsSync(path)) return { version: "v1", shards: [] };
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

/**
 * Writes one kind's shards under outDir/<kind>/ (removing that kind's old shards first) and
 * replaces the kind's entries in outDir/manifest.json. Other kinds stay as they are.
 */
export function writeKind<T>(outDir: string, kind: string, records: readonly T[], shardOf?: (r: T) => string, maxBytes = SHARD_MAX_BYTES): ManifestEntry[] {
  if (!SHARD_NAME.test(kind)) throw new Error(`kind "${kind}" must be lowercase words joined by hyphens`);
  const plan = planShards(records, shardOf, maxBytes);
  const dir = join(outDir, kind);
  if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith(".json")) rmSync(join(dir, f));
  mkdirSync(dir, { recursive: true });

  const entries: ManifestEntry[] = [];
  for (const [shard, list] of plan) {
    const text = shardText(list);
    const bytes = Buffer.byteLength(text);
    if (bytes > maxBytes) throw new Error(`shard ${kind}/${shard} is ${bytes} bytes, over ${maxBytes}`);
    writeFileSync(join(dir, `${shard}.json`), text);
    entries.push({ kind, shard, path: `${kind}/${shard}.json`, bytes, count: list.length, sha256: sha256(text) });
  }

  const manifestPath = join(outDir, "manifest.json");
  const manifest = readManifest(manifestPath);
  manifest.shards = [...manifest.shards.filter((e) => e.kind !== kind), ...entries].sort((a, b) => a.path.localeCompare(b.path));
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return entries;
}

/** Re-hashes every shard on disk against the manifest. Returns problems, empty when all match. */
export function verifyManifest(outDir: string): string[] {
  const manifest = readManifest(join(outDir, "manifest.json"));
  const problems: string[] = [];
  for (const e of manifest.shards) {
    const p = join(outDir, e.path);
    if (!existsSync(p)) {
      problems.push(`${e.path}: missing`);
      continue;
    }
    const buf = readFileSync(p);
    if (sha256(buf) !== e.sha256) problems.push(`${e.path}: sha256 does not match`);
    if (buf.byteLength > SHARD_MAX_BYTES) problems.push(`${e.path}: over ${SHARD_MAX_BYTES} bytes`);
  }
  return problems;
}
