/**
 * W3 shard layout contract: job output (out/v1/<job kind>/, size-based) becomes the layout the
 * server's loader reads, and the real loader code reads it back through an injected fetcher.
 */
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAtlasLoader, recipeId, type AtlasManifest } from "../../banana-server/lib/atlas/loader.ts";
import { loaderSource } from "../../banana-server/lib/atlas/source.ts";
import { CARDS, CC0, DOMAINS, FIT, LINES, MECHANICS, PAGES, RECIPES } from "../../banana-server/tests/fixtures/atlas.ts";
import { readJobRecords, serverLayout, serverUploadCommands, writeServerLayout } from "../lib/layout.ts";
import { writeKind } from "../lib/shards.ts";

/** Writes the fixture records the way the jobs do (job kinds, size-based shards). */
function writeJobOutput(maxBytes: number): string {
  const out = mkdtempSync(join(tmpdir(), "atlas-jobs-"));
  writeKind(out, "anatomy", PAGES, undefined, maxBytes);
  writeKind(out, "domains", DOMAINS, undefined, maxBytes);
  writeKind(out, "cards", CARDS, (c) => c.kind, maxBytes);
  writeKind(out, "card-elements", LINES, undefined, maxBytes);
  writeKind(out, "fit", FIT, undefined, maxBytes);
  writeKind(out, "mechanics", MECHANICS, undefined, maxBytes);
  writeKind(out, "recipes", RECIPES, undefined, maxBytes);
  writeKind(out, "cc0", CC0, undefined, maxBytes);
  writeKind(out, "example", [{ id: "x" }], undefined, maxBytes);
  return out;
}

function roundTrip(maxBytes: number) {
  const jobs = writeJobOutput(maxBytes);
  const layout = serverLayout(readJobRecords(jobs), { maxBytes });
  const serverDir = mkdtempSync(join(tmpdir(), "atlas-server-"));
  const manifestFile = writeServerLayout(serverDir, layout);
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8")) as AtlasManifest;
  const reads: string[] = [];
  const loader = createAtlasLoader({
    manifest,
    budget: 1000,
    fetchShard: async (path) => {
      reads.push(path);
      const m = /^atlas\/v1\/(.+)$/.exec(path);
      const file = m ? join(serverDir, m[1]!) : "";
      return file && existsSync(file) ? readFileSync(file, "utf8") : null;
    },
  });
  return { layout, manifest, loader, source: loaderSource(loader), reads, serverDir };
}

describe("server layout from job output", () => {
  it("maps job kinds to the loader's kinds and skips the rest", () => {
    const { layout, manifest } = roundTrip(100 * 1024);
    expect(layout.skipped).toEqual(["example"]);
    expect([...new Set(manifest.shards.map((s) => s.kind))].sort()).toEqual(["cards", "cc0", "domains", "fit", "lines", "mechanics", "pages", "recipes"]);
    expect(manifest.version).toBe("v1");
    expect(manifest.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.shards.filter((s) => s.kind === "fit").map((s) => s.shard).sort()).toEqual([...new Set(FIT.map((f) => f.domainId))].sort());
    for (const s of manifest.shards) expect(Object.keys(s).sort()).toEqual(["bytes", "kind", "sha256", "shard"]);
  });

  for (const maxBytes of [100 * 1024, 3000]) {
    it(`the real loader reads every record back (shards up to ${maxBytes} bytes)`, async () => {
      const { source, manifest } = roundTrip(maxBytes);
      for (const s of manifest.shards) expect(s.bytes).toBeLessThanOrEqual(maxBytes);
      if (maxBytes < 10_000) expect(manifest.shards.filter((s) => s.kind === "cards").length).toBeGreaterThan(1);
      expect((await source.pages())!.map((p) => p.id).sort()).toEqual(PAGES.map((p) => p.id).sort());
      expect((await source.domains())!.length).toBe(DOMAINS.length);
      const cards = (await source.cards(CARDS.map((c) => c.id)))!;
      expect([...cards.keys()].sort()).toEqual(CARDS.map((c) => c.id).sort());
      expect((await source.lines(CARDS.map((c) => c.id)))!.length).toBe(LINES.length);
      const domainId = FIT[0]!.domainId;
      expect((await source.fit(domainId))!.length).toBe(FIT.filter((f) => f.domainId === domainId).length);
      const el = MECHANICS[0]!.element;
      expect((await source.mechanics(el))!.length).toBe(MECHANICS.filter((m) => m.element === el).length);
      const got = (await source.recipes(RECIPES.map((r) => r.key)))!;
      expect(got.map((r) => recipeId(r)).sort()).toEqual(RECIPES.map((r) => recipeId(r)).sort());
      const regions = [...new Set(CC0.map((c) => c.region || "global"))];
      expect((await source.cc0(regions))!.length).toBe(CC0.length);
    });
  }

  it("a card lookup reads one bucket only", async () => {
    const { source, reads } = roundTrip(3000);
    await source.cards([CARDS[0]!.id]);
    expect(reads.filter((p) => p.includes("/cards/"))).toHaveLength(1);
  });

  it("refuses a named shard over the limit", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ ...FIT[0]!, cardId: `card-${i}`, reason: "x".repeat(50) }));
    expect(() => serverLayout(new Map([["fit", many]]), { maxBytes: 3000 })).toThrow(/over 3000/);
  });

  it("prints upload commands with the manifest last", () => {
    const { layout, serverDir } = roundTrip(100 * 1024);
    const cmds = serverUploadCommands(layout, serverDir, (p) => p, "banana-atlas", "atlas/v1");
    expect(cmds.at(-1)).toContain("banana-atlas/atlas/v1/manifest.json");
    expect(cmds[0]).toMatch(/^npx wrangler r2 object put banana-atlas\/atlas\/v1\/\w+\/[\w-]+\.json /);
    expect(cmds).toHaveLength(layout.files.size + 1);
  });

  it("an empty job output gives an empty manifest (no Atlas on the server)", () => {
    expect(serverLayout(new Map()).manifest).toEqual({ version: "v1", hash: "", shards: [] });
  });
});
