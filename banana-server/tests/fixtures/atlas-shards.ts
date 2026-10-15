/**
 * Builds Atlas shards and a manifest from the fixture records, the way atlas-build lays them out
 * (lib/atlas/loader.ts), plus a fetcher and a cache that count their calls.
 */
import { bucketOf, recipeKeyString, sha256Hex, shardPath, type AtlasKind, type AtlasManifest, type CacheLike, type ManifestShard } from "@/lib/atlas/loader";
import { MOTION, SHADERS } from "./stunning";
import { TYPE_PAIRS } from "./type-pairs";
import { CARDS, CC0, DOMAINS, FIT, LINES, MECHANICS, PAGES, RECIPES } from "./atlas";

export type ShardFiles = Map<string, string>;

/** Buckets per kind for the fixture: small numbers so several shards exist. */
export const FIXTURE_BUCKETS = { cards: 3, lines: 2, recipes: 2 } as const;

function group<T>(rows: readonly T[], keyOf: (r: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = keyOf(r);
    out.set(k, [...(out.get(k) ?? []), r]);
  }
  return out;
}

function buckets<T>(rows: readonly T[], count: number, idOf: (r: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (let i = 0; i < count; i++) out.set(String(i).padStart(2, "0"), []);
  for (const r of rows) out.get(bucketOf(idOf(r), count))!.push(r);
  return out;
}

/** Every fixture shard by kind and name. */
export function fixtureShardRows(stunning = false, typePairs = false): Map<AtlasKind, Map<string, unknown[]>> {
  const rows = new Map<AtlasKind, Map<string, unknown[]>>([
    ["pages", new Map([["00", PAGES]])],
    ["domains", new Map([["00", DOMAINS]])],
    ["fit", group(FIT, (f) => f.domainId)],
    ["cards", buckets(CARDS, FIXTURE_BUCKETS.cards, (c) => c.id)],
    ["lines", buckets(LINES, FIXTURE_BUCKETS.lines, (l) => l.cardId)],
    ["mechanics", group(MECHANICS, (m) => m.element)],
    ["recipes", buckets(RECIPES, FIXTURE_BUCKETS.recipes, (r) => recipeKeyString(r.key))],
    ["cc0", group(CC0, (c) => c.region ?? "global")],
  ]);
  // The J13 stunning layer is read whole and split by size ("00", "01", ...): one shard each here.
  if (stunning) {
    rows.set("shaders", new Map([["00", SHADERS]]));
    rows.set("motion", new Map([["00", MOTION]]));
  }
  // The J12 type atlas: one named shard per type voice.
  if (typePairs) rows.set("type-pairs", group(TYPE_PAIRS, (p) => p.voice));
  return rows;
}

/** Shard files (R2 keys to text) and their manifest. */
export async function buildFixtureAtlas(version = "v1", stunning = false, typePairs = false): Promise<{ manifest: AtlasManifest; files: ShardFiles }> {
  const files: ShardFiles = new Map();
  const shards: ManifestShard[] = [];
  for (const [kind, byName] of fixtureShardRows(stunning, typePairs)) {
    for (const [shard, rows] of byName) {
      const text = JSON.stringify(rows);
      files.set(shardPath(version, kind, shard), text);
      shards.push({ kind, shard, sha256: await sha256Hex(text), bytes: text.length });
    }
  }
  const hash = await sha256Hex(shards.map((s) => s.sha256).join(""));
  return { manifest: { version, hash, shards }, files };
}

/** A fetcher over shard files that counts reads per path. */
export function countingFetcher(files: ShardFiles) {
  const reads = new Map<string, number>();
  const fetchShard = async (path: string) => {
    reads.set(path, (reads.get(path) ?? 0) + 1);
    return files.get(path) ?? null;
  };
  return { fetchShard, reads, total: () => [...reads.values()].reduce((a, b) => a + b, 0) };
}

/** An in-memory stand-in for caches.default. */
export function memoryCache(): CacheLike & { store: Map<string, string>; matches: number; puts: number } {
  const store = new Map<string, string>();
  const cache = {
    store,
    matches: 0,
    puts: 0,
    async match(key: string) {
      cache.matches++;
      const text = store.get(key);
      return text === undefined ? undefined : new Response(text);
    },
    async put(key: string, res: Response) {
      cache.puts++;
      store.set(key, await res.text());
    },
  };
  return cache;
}
