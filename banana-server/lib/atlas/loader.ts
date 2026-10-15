/**
 * Banana Atlas loader (P1-I1, owner decision D6). The Atlas is curated JSON built offline in
 * `atlas-build/` and uploaded to the R2 bucket `banana-atlas` (binding `ATLAS`). The server only
 * reads it: no AI, no images, words and scores only.
 *
 * Shard layout (atlas-build writes it, this file reads it). Every shard is a JSON array, under
 * 100 KB, at `atlas/<version>/<kind>/<shard>.json`, listed in manifest.json with its sha256:
 *
 *   pages/<n>            PageAnatomy[]      every shard is read (brief parsing needs all names)
 *   domains/<n>          DomainEntry[]      every shard is read
 *   fit/<domainId>       FitScore[]         one shard per domain
 *   cards/<bucket>       IngredientCard[]   bucket = bucketOf(card.id, shard count)
 *   lines/<bucket>       CardElementLine[]  bucket = bucketOf(line.cardId, shard count)
 *   mechanics/<element>  Mechanic[]         one shard per UiElement
 *   lenses/<n>           LensPack[]
 *   recipes/<bucket>     QueryRecipe[]      bucket = bucketOf(recipeKeyString(recipe.key), shard count)
 *   cc0/<region>         CC0Item[]          one shard per region slug ("gulf", "mena", "global", ...)
 *   slop/<n>             SlopRule[]
 *   shaders/<n>          ShaderRecipe[]     J13 stunning layer, size split, read whole
 *   motion/<n>           MotionRecipe[]     J13 stunning layer, size split, read whole
 *
 * Buckets are named "00", "01", ... and a kind's shard count is the number of its manifest
 * entries, so the server finds the shard of any id without an index.
 *
 * Caching: parsed shards stay in an in-isolate LRU (about 2 MB of shard text), and verified shard
 * text goes to `caches.default` keyed by the manifest hash, so a new upload never serves stale
 * shards. A shard whose sha256 does not match the manifest is dropped and never cached. Pure:
 * the fetcher and the cache are injected, so tests need no Workers bindings.
 *
 * An empty manifest (no shards) means no Atlas: every caller falls back to the current engine.
 */
import { cyrb53 } from "@/lib/bend/prng";
import type { QueryRecipe } from "./types";

export const ATLAS_KINDS = ["pages", "domains", "fit", "cards", "lines", "mechanics", "lenses", "recipes", "cc0", "slop", "shaders", "motion"] as const;
export type AtlasKind = (typeof ATLAS_KINDS)[number];

export interface ManifestShard {
  kind: AtlasKind;
  /** Shard name: a bucket ("00"), an id ("travel", "progress") or a region ("gulf"). */
  shard: string;
  /** Hex sha256 of the shard file's exact bytes. */
  sha256: string;
  bytes: number;
}

export interface AtlasManifest {
  /** Layout version, the path segment after `atlas/` ("v1"). */
  version: string;
  /** Hash of the whole upload (atlas-build computes it): the cache key prefix. Empty for no Atlas. */
  hash: string;
  shards: ManifestShard[];
}

/** Reads one shard's text by its R2 key, or null when it is missing. */
export type ShardFetcher = (path: string) => Promise<string | null>;

/** The part of the Workers Cache API the loader uses (`caches.default`). */
export interface CacheLike {
  match(request: string): Promise<Response | undefined>;
  put(request: string, response: Response): Promise<void>;
}

/** Bytes of shard text the in-isolate LRU keeps. */
export const LRU_MAX_BYTES = 2 * 1024 * 1024;
/** Subrequests one tool call may spend on Atlas shards by default (Workers Free allows 50 in all). */
export const DEFAULT_SHARD_BUDGET = 24;
/** What a shard costs in subrequests: an LRU hit nothing, a cache hit one, a miss three (match, R2 get, put). */
export const COST = { lru: 0, cache: 1, miss: 3 } as const;

/** True when the manifest lists any shard: without one there is no Atlas. */
export function atlasReady(manifest: AtlasManifest | null | undefined): manifest is AtlasManifest {
  return Boolean(manifest && manifest.hash && manifest.shards.length > 0);
}

/** R2 key of a shard. */
export function shardPath(version: string, kind: AtlasKind, shard: string): string {
  return `atlas/${version}/${kind}/${shard}.json`;
}

/** The bucket shard name ("00" to "99") an id falls in when a kind has `count` shards. */
export function bucketOf(id: string, count: number): string {
  const n = Math.max(1, count);
  return String(cyrb53(id) % n).padStart(2, "0");
}

/** The stable key string of a recipe's key, the id recipes are bucketed and looked up by. */
export function recipeKeyString(key: QueryRecipe["key"]): string {
  return [key.lane, key.page ?? "-", key.platform ?? "-", key.element ?? "-", key.cardId ?? "-"].join("|");
}

/** A short stable id for one recipe (its key and wording), as stored on references ("rc-..."). */
export function recipeId(recipe: Pick<QueryRecipe, "key" | "query">): string {
  return `rc-${cyrb53(`${recipeKeyString(recipe.key)}|${recipe.query.toLowerCase()}`).toString(36)}`;
}

/** Hex sha256 of a string's UTF-8 bytes (Web Crypto: Workers and Node). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Least recently used map of parsed shards, sized by their text length. */
export class ShardLru {
  private readonly map = new Map<string, { value: unknown; bytes: number }>();
  private size = 0;

  constructor(readonly maxBytes: number = LRU_MAX_BYTES) {}

  get(key: string): unknown {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: unknown, bytes: number): void {
    if (bytes > this.maxBytes) return;
    const old = this.map.get(key);
    if (old) {
      this.size -= old.bytes;
      this.map.delete(key);
    }
    this.map.set(key, { value, bytes });
    this.size += bytes;
    for (const [k, v] of this.map) {
      if (this.size <= this.maxBytes) break;
      this.map.delete(k);
      this.size -= v.bytes;
    }
  }

  get bytes(): number {
    return this.size;
  }

  clear(): void {
    this.map.clear();
    this.size = 0;
  }
}

export interface AtlasLoader {
  readonly manifest: AtlasManifest;
  /** One shard's records, or null when it is not listed, missing, fails its hash or the budget is spent. */
  shard<T>(kind: AtlasKind, shard: string): Promise<T[] | null>;
  /** Every shard of a kind, joined. Null when any listed shard could not be read. */
  all<T>(kind: AtlasKind): Promise<T[] | null>;
  /** The bucket shard that holds `id` (cards, lines, recipes). */
  bucket<T>(kind: AtlasKind, id: string): Promise<T[] | null>;
  /** Shard names listed for a kind. */
  names(kind: AtlasKind): string[];
  /** Subrequests this loader spent so far. */
  spent(): number;
}

export interface LoaderOptions {
  manifest: AtlasManifest;
  fetchShard: ShardFetcher;
  /** `caches.default` in Workers; null or absent in tests and dev. */
  cache?: CacheLike | null;
  /** Shared across calls in one isolate; a fresh one per loader when absent. */
  lru?: ShardLru;
  /** Most subrequests this loader may spend (one tool call). Default DEFAULT_SHARD_BUDGET. */
  budget?: number;
}

/** A loader for one tool call: pure, everything it touches is injected. */
export function createAtlasLoader(opts: LoaderOptions): AtlasLoader {
  const { manifest, fetchShard } = opts;
  const lru = opts.lru ?? new ShardLru();
  const budget = opts.budget ?? DEFAULT_SHARD_BUDGET;
  let spent = 0;
  const entries = new Map(manifest.shards.map((s) => [`${s.kind}/${s.shard}`, s]));
  const names = (kind: AtlasKind) => manifest.shards.filter((s) => s.kind === kind).map((s) => s.shard);

  const verifyParse = async <T>(text: string, entry: ManifestShard): Promise<T[] | null> => {
    if ((await sha256Hex(text)) !== entry.sha256.toLowerCase()) {
      console.error(`[atlas] bad hash for ${entry.kind}/${entry.shard}`);
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(text);
      return Array.isArray(parsed) ? (parsed as T[]) : null;
    } catch {
      console.error(`[atlas] bad JSON in ${entry.kind}/${entry.shard}`);
      return null;
    }
  };

  const shard = async <T>(kind: AtlasKind, name: string): Promise<T[] | null> => {
    if (!atlasReady(manifest)) return null;
    const entry = entries.get(`${kind}/${name}`);
    if (!entry) return null;
    const path = shardPath(manifest.version, kind, name);
    const lruKey = `${manifest.hash}/${path}`;
    const hit = lru.get(lruKey);
    if (hit !== undefined) return hit as T[];
    const cacheKey = `https://atlas.cache/${lruKey}`;
    if (opts.cache) {
      if (spent + COST.cache > budget) return null;
      spent += COST.cache;
      try {
        const res = await opts.cache.match(cacheKey);
        if (res) {
          const text = await res.text();
          const rows = await verifyParse<T>(text, entry);
          if (rows) {
            lru.set(lruKey, rows, text.length);
            return rows;
          }
        }
      } catch {
        console.error("[atlas] cache read failed");
      }
    }
    const missCost = opts.cache ? COST.miss - COST.cache : 1;
    if (spent + missCost > budget) return null;
    spent += missCost;
    let text: string | null;
    try {
      text = await fetchShard(path);
    } catch {
      console.error(`[atlas] could not read ${path}`);
      return null;
    }
    if (text === null) return null;
    const rows = await verifyParse<T>(text, entry);
    if (!rows) return null;
    lru.set(lruKey, rows, text.length);
    if (opts.cache) {
      try {
        await opts.cache.put(cacheKey, new Response(text, { headers: { "cache-control": "public, max-age=604800", "content-type": "application/json" } }));
      } catch {
        console.error("[atlas] cache write failed");
      }
    }
    return rows;
  };

  return {
    manifest,
    shard,
    names,
    async all<T>(kind: AtlasKind) {
      const list = names(kind);
      const out: T[] = [];
      for (const n of list) {
        const rows = await shard<T>(kind, n);
        if (!rows) return null;
        out.push(...rows);
      }
      return out;
    },
    async bucket<T>(kind: AtlasKind, id: string) {
      const count = names(kind).length;
      if (count === 0) return null;
      return shard<T>(kind, bucketOf(id, count));
    },
    spent: () => spent,
  };
}
