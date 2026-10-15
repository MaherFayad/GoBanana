/**
 * The live Atlas loader: R2 binding `ATLAS` (bucket `banana-atlas`), `caches.default` and one
 * LRU per isolate. Returns null when there is no Atlas (empty manifest) or no binding, so callers
 * fall back to the current engine.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import manifestJson from "./manifest.json";
import { atlasReady, createAtlasLoader, DEFAULT_SHARD_BUDGET, ShardLru, type AtlasLoader, type AtlasManifest, type CacheLike } from "./loader";

type R2Text = { get(key: string): Promise<{ text(): Promise<string> } | null> };

const manifest = manifestJson as AtlasManifest;
const isolateLru = new ShardLru();

/** The bundled manifest (lib/atlas/manifest.json, copied from atlas-build at upload). */
export function liveManifest(): AtlasManifest {
  return manifest;
}

function atlasBucket(): R2Text | null {
  try {
    return (getCloudflareContext().env as { ATLAS?: R2Text }).ATLAS ?? null;
  } catch {
    return null;
  }
}

function defaultCache(): CacheLike | null {
  const c = (globalThis as { caches?: { default?: CacheLike } }).caches;
  return c?.default ?? null;
}

/** A loader for one tool call, or null when there is no Atlas to read. */
export function liveAtlasLoader(budget: number = DEFAULT_SHARD_BUDGET): AtlasLoader | null {
  if (!atlasReady(manifest)) return null;
  const bucket = atlasBucket();
  if (!bucket) return null;
  return createAtlasLoader({
    manifest,
    budget,
    lru: isolateLru,
    cache: defaultCache(),
    fetchShard: async (path) => {
      const obj = await bucket.get(path);
      return obj ? obj.text() : null;
    },
  });
}
