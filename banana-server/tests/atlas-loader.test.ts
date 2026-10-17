import { describe, expect, it } from "vitest";
import manifestJson from "@/lib/atlas/manifest.json";
import {
  atlasReady,
  bucketOf,
  COST,
  createAtlasLoader,
  recipeId,
  sha256Hex,
  shardPath,
  ShardLru,
  type AtlasManifest,
} from "@/lib/atlas/loader";
import type { IngredientCard } from "@/lib/atlas/types";
import { CARDS } from "./fixtures/atlas";
import { buildFixtureAtlas, countingFetcher, FIXTURE_BUCKETS, memoryCache } from "./fixtures/atlas-shards";

describe("Atlas loader (P1-I1)", () => {
  it("ships the uploaded Atlas manifest (2026-10-17 deploy): a hash and every shard with its sha256", () => {
    const m = manifestJson as AtlasManifest;
    expect(atlasReady(m)).toBe(true);
    expect(m.version).toBe("v1");
    for (const s of m.shards) expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set(m.shards.map((s) => s.kind))).toEqual(new Set(["cards", "cc0", "domains", "fit", "lenses", "lines", "mechanics", "motion", "page-fit", "pages", "recipes", "shaders", "type-pairs"]));
  });

  it("an empty manifest loads nothing and never fetches", async () => {
    const f = countingFetcher(new Map());
    const loader = createAtlasLoader({ manifest: { version: "v1", hash: "", shards: [] }, fetchShard: f.fetchShard });
    expect(await loader.all("pages")).toEqual([]);
    expect(await loader.shard("cards", "00")).toBeNull();
    expect(await loader.bucket("cards", "luggage-tag")).toBeNull();
    expect(f.total()).toBe(0);
  });

  it("a miss reads R2 once, then the LRU serves it with no fetch (a hit)", async () => {
    const { manifest, files } = await buildFixtureAtlas();
    const f = countingFetcher(files);
    const lru = new ShardLru();
    const loader = createAtlasLoader({ manifest, fetchShard: f.fetchShard, lru });
    const first = await loader.shard<IngredientCard>("cards", "00");
    expect(first?.length).toBeGreaterThan(0);
    expect(f.total()).toBe(1);
    const again = await loader.shard<IngredientCard>("cards", "00");
    expect(again).toBe(first);
    expect(f.total()).toBe(1);
    // A second loader in the same isolate shares the LRU: no fetch, no cost.
    const next = createAtlasLoader({ manifest, fetchShard: f.fetchShard, lru });
    expect(await next.shard("cards", "00")).toBe(first);
    expect(next.spent()).toBe(0);
    expect(f.total()).toBe(1);
  });

  it("caches.default serves a new isolate by the manifest hash, and a new hash misses", async () => {
    const { manifest, files } = await buildFixtureAtlas();
    const cache = memoryCache();
    const f = countingFetcher(files);
    const a = createAtlasLoader({ manifest, fetchShard: f.fetchShard, cache });
    await a.shard("pages", "00");
    expect(a.spent()).toBe(COST.miss);
    expect(cache.puts).toBe(1);
    expect([...cache.store.keys()][0]).toContain(manifest.hash);
    // New isolate (fresh LRU): the cache answers, R2 is not read again.
    const b = createAtlasLoader({ manifest, fetchShard: f.fetchShard, cache });
    expect((await b.shard("pages", "00"))?.length).toBeGreaterThan(0);
    expect(b.spent()).toBe(COST.cache);
    expect(f.total()).toBe(1);
    // A new upload (new hash) never reads the old cached text.
    const c = createAtlasLoader({ manifest: { ...manifest, hash: "new" }, fetchShard: f.fetchShard, cache });
    await c.shard("pages", "00");
    expect(f.total()).toBe(2);
  });

  it("a bad hash is dropped and never cached", async () => {
    const { manifest, files } = await buildFixtureAtlas();
    // Change one word in the shard that holds the luggage tag card.
    const shard = bucketOf("luggage-tag", FIXTURE_BUCKETS.cards);
    const p = shardPath("v1", "cards", shard);
    const tampered = new Map(files);
    tampered.set(p, files.get(p)!.replace("Luggage tag", "Luggage tug"));
    expect(tampered.get(p)).not.toBe(files.get(p));
    const cache = memoryCache();
    const lru = new ShardLru();
    const loader = createAtlasLoader({ manifest, fetchShard: countingFetcher(tampered).fetchShard, cache, lru });
    expect(await loader.shard("cards", shard)).toBeNull();
    expect(cache.puts).toBe(0);
    expect(lru.bytes).toBe(0);
    // A missing shard is a null too.
    expect(await loader.shard("cards", "99")).toBeNull();
  });

  it("finds a card's bucket without an index", async () => {
    const { manifest, files } = await buildFixtureAtlas();
    const loader = createAtlasLoader({ manifest, fetchShard: countingFetcher(files).fetchShard });
    for (const c of CARDS) {
      const rows = await loader.bucket<IngredientCard>("cards", c.id);
      expect(rows?.some((r) => r.id === c.id)).toBe(true);
    }
  });

  it("stops at its subrequest budget and returns null", async () => {
    const { manifest, files } = await buildFixtureAtlas();
    const loader = createAtlasLoader({ manifest, fetchShard: countingFetcher(files).fetchShard, cache: memoryCache(), budget: COST.miss });
    expect(await loader.shard("pages", "00")).not.toBeNull();
    expect(await loader.shard("domains", "00")).toBeNull();
    expect(loader.spent()).toBeLessThanOrEqual(COST.miss);
  });

  it("the LRU keeps about 2 MB and drops the oldest", () => {
    const lru = new ShardLru(100);
    lru.set("a", 1, 60);
    lru.set("b", 2, 30);
    lru.get("a");
    lru.set("c", 3, 30);
    expect(lru.get("b")).toBeUndefined();
    expect(lru.get("a")).toBe(1);
    expect(lru.get("c")).toBe(3);
    expect(new ShardLru().maxBytes).toBe(2 * 1024 * 1024);
  });

  it("recipe ids are stable and short", () => {
    const r = { key: { lane: "art" as const, cardId: "luggage-tag" }, query: "Luggage tag" };
    expect(recipeId(r)).toBe(recipeId({ ...r, query: "luggage tag" }));
    expect(recipeId(r)).toMatch(/^rc-[0-9a-z]+$/);
  });

  it("a cold load of one 100 KB shard parses well inside 10 ms of CPU", async () => {
    // About 100 KB of cards: the shard size cap in atlas-build.
    const rows: IngredientCard[] = [];
    let i = 0;
    while (JSON.stringify(rows).length < 98_000) rows.push({ ...CARDS[i % CARDS.length]!, id: `card-${i++}` });
    const text = JSON.stringify(rows);
    const manifest: AtlasManifest = { version: "v1", hash: "h", shards: [{ kind: "cards", shard: "00", sha256: await sha256Hex(text), bytes: text.length }] };
    const files = new Map([[shardPath("v1", "cards", "00"), text]]);
    // Warm the JIT once on another loader, as a running isolate would be.
    await createAtlasLoader({ manifest, fetchShard: async (p) => files.get(p) ?? null }).shard("cards", "00");
    const times: number[] = [];
    for (let run = 0; run < 9; run++) {
      const loader = createAtlasLoader({ manifest, fetchShard: async (p) => files.get(p) ?? null });
      const t0 = performance.now();
      const parsed = await loader.shard<IngredientCard>("cards", "00");
      times.push(performance.now() - t0);
      expect(parsed?.length).toBe(rows.length);
    }
    times.sort((a, b) => a - b);
    // Wall time on a shared test machine; the fastest run is the closest to the CPU cost.
    const best = times[0]!;
    console.log(`[atlas] cold load of a ${text.length} byte shard (hash check and parse): best ${best.toFixed(2)} ms, median ${times[4]!.toFixed(2)} ms`);
    expect(best).toBeLessThan(10);
  });
});
