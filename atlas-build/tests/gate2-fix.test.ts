/**
 * Gate 2 fixes (banana-server/bench/GATE2-DIAGNOSIS.md): `j9-cc0 --from-raw` rebuilds from the saved
 * replies and the committed pool snapshot with no network, and a CC0 region over the shard limit is
 * split into parts the server reads.
 */
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAtlasLoader } from "../../banana-server/lib/atlas/loader.ts";
import { loaderSource } from "../../banana-server/lib/atlas/source.ts";
import { loadPool, POOL_SNAPSHOT, readPoolSnapshot, savePoolSnapshot, type PoolItem } from "../jobs/j9-cc0.ts";
import { serverLayout } from "../lib/layout.ts";
import type { JobContext } from "../lib/job.ts";

const item = (i: number, region?: string) => ({
  id: `met-${i}`,
  museum: "met" as const,
  title: `Tile ${i} with a long title to fill the shard`,
  imageUrl: `https://images.metmuseum.org/${i}.jpg`,
  pageUrl: `https://www.metmuseum.org/art/collection/search/${i}`,
  steal: ["border band", "two tone palette"],
  motif: ["tile"],
  ...(region ? { region } : {}),
  rights: { flag: "isPublicDomain", value: "true" },
});

const ctx = (fromRaw: boolean): JobContext => ({ dry: false, fonts: () => ({}) as never, log: () => {}, run: { offset: 0, fromRaw } });

afterEach(() => vi.unstubAllGlobals());

describe("j9-cc0 --from-raw needs no network", () => {
  it("the committed snapshot covers every judged sheet of the saved replies", () => {
    expect(existsSync(POOL_SNAPSHOT)).toBe(true);
    const pool = readPoolSnapshot()!;
    const raw = readFileSync(join(POOL_SNAPSHOT, "..", "..", "raw", "j9-cc0.jsonl"), "utf8").trim().split("\n");
    const maxSheet = Math.max(...raw.map((l) => Number((JSON.parse(l) as { id: string }).id.split("-")[1])));
    expect(pool.length).toBeGreaterThanOrEqual((maxSheet + 1) * 16);
    expect(pool.every((p) => p.imageUrl.startsWith("https://") && p.pageUrl.startsWith("https://"))).toBe(true);
  });

  it("reads the snapshot when the cache is missing and never fetches", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const dir = mkdtempSync(join(tmpdir(), "j9-"));
    const snapshot = join(dir, "pool.json.gz");
    savePoolSnapshot([item(1), item(2)] as unknown as PoolItem[], 1, snapshot);
    const pool = await loadPool(ctx(true), { cache: join(dir, "missing.json"), snapshot });
    expect(pool.map((p) => p.id)).toEqual(["met-1", "met-2"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("--from-raw with no pool at all is an error, not a harvest", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const dir = mkdtempSync(join(tmpdir(), "j9-"));
    await expect(loadPool(ctx(true), { cache: join(dir, "a.json"), snapshot: join(dir, "b.json.gz") })).rejects.toThrow(/never refetch/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("CC0 regions over the shard limit", () => {
  it("are split into <region>_NN parts that the server source reads back", async () => {
    const records = [...Array.from({ length: 40 }, (_, i) => item(i, "europe")), item(100, "gulf")];
    const layout = serverLayout(new Map([["cc0", records]]), { maxBytes: 4000 });
    const names = layout.manifest.shards.filter((s) => s.kind === "cc0").map((s) => s.shard);
    expect(names).toContain("gulf");
    expect(names.filter((n) => /^europe_\d\d$/.test(n)).length).toBeGreaterThan(1);
    expect(names).not.toContain("europe");
    const loader = createAtlasLoader({ manifest: layout.manifest, budget: 100, fetchShard: async (p) => layout.files.get(p.split("/").slice(2).join("/")) ?? null });
    const all = await loaderSource(loader).cc0(["europe"], 100);
    expect(all!.length).toBe(40);
  });

  it("other named kinds still refuse an oversized shard", () => {
    const fit = Array.from({ length: 200 }, (_, i) => ({ cardId: `c${i}`, domainId: "travel", score: 3, reason: "a reason long enough to pass the limit" }));
    expect(() => serverLayout(new Map([["fit", fit]]), { maxBytes: 2000 })).toThrow(/over 2000/);
  });
});
