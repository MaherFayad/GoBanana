/**
 * VAL-08: the J12 job kind `type-pairs` is a server kind. It lays out as one named shard per type
 * voice (type-pairs/<voice>.json), and the server's real loader reads the pairs back.
 */
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAtlasLoader, type AtlasManifest } from "../../banana-server/lib/atlas/loader.ts";
import { loaderSource } from "../../banana-server/lib/atlas/source.ts";
import { TYPE_PAIRS } from "../../banana-server/tests/fixtures/type-pairs.ts";
import { JOB_KINDS, readJobRecords, serverLayout, writeServerLayout } from "../lib/layout.ts";
import { writeKind } from "../lib/shards.ts";

function roundTrip(maxBytes = 100 * 1024) {
  const jobs = mkdtempSync(join(tmpdir(), "atlas-tp-jobs-"));
  writeKind(jobs, "type-pairs", TYPE_PAIRS, undefined, maxBytes);
  const layout = serverLayout(readJobRecords(jobs), { maxBytes });
  const serverDir = mkdtempSync(join(tmpdir(), "atlas-tp-server-"));
  const manifest = JSON.parse(readFileSync(writeServerLayout(serverDir, layout), "utf8")) as AtlasManifest;
  const loader = createAtlasLoader({
    manifest,
    budget: 100,
    fetchShard: async (path) => {
      const m = /^atlas\/v1\/(.+)$/.exec(path);
      const file = m ? join(serverDir, m[1]!) : "";
      return file && existsSync(file) ? readFileSync(file, "utf8") : null;
    },
  });
  return { layout, manifest, source: loaderSource(loader) };
}

describe("type-pairs in the server layout", () => {
  it("is mapped, not skipped", () => {
    expect(JOB_KINDS["type-pairs"]).toMatchObject({ kind: "type-pairs", by: "name" });
    const { layout } = roundTrip();
    expect(layout.skipped).toEqual([]);
  });

  it("writes one shard per voice, named by the voice", () => {
    const { manifest } = roundTrip();
    expect(manifest.shards.filter((s) => s.kind === "type-pairs").map((s) => s.shard).sort()).toEqual(["grotesk", "slab"]);
  });

  it("the server's loader reads the pairs of a voice back, a missing voice is empty", async () => {
    const { source } = roundTrip();
    expect((await source.typePairs("grotesk"))!.map((p) => p.id).sort()).toEqual(TYPE_PAIRS.filter((p) => p.voice === "grotesk").map((p) => p.id).sort());
    expect((await source.typePairs("slab"))!.length).toBe(2);
    expect(await source.typePairs("mono")).toEqual([]);
  });

  it("refuses a voice shard over the size limit, since the loader reads it whole", () => {
    expect(() => roundTrip(500)).toThrow();
  });
});
