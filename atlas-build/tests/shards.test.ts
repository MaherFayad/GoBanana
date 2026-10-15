import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chunkBySize, planShards, readManifest, sha256, shardText, verifyManifest, writeKind } from "../lib/shards.ts";
import { shippable, uploadCommands } from "../upload.ts";

const rec = (i: number, pad = 100) => ({ id: `r${i}`, text: "x".repeat(pad) });

describe("chunkBySize", () => {
  it("keeps each chunk's shard text at or under the limit, in order", () => {
    const records = Array.from({ length: 50 }, (_, i) => rec(i));
    const chunks = chunkBySize(records, 1000);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(Buffer.byteLength(shardText(c))).toBeLessThanOrEqual(1000);
    expect(chunks.flat()).toEqual(records);
  });

  it("throws when one record alone is too big", () => {
    expect(() => chunkBySize([rec(1, 2000)], 1000)).toThrow(/over the 1000 byte/);
  });
});

describe("planShards", () => {
  it("groups by shard name and numbers groups that need several files", () => {
    const records = [...Array.from({ length: 20 }, (_, i) => ({ ...rec(i), g: "big" })), { ...rec(99), g: "small" }];
    const plan = planShards(records, (r) => r.g, 1000);
    const names = [...plan.keys()];
    expect(names).toContain("small");
    expect(names.filter((n) => n.startsWith("big-")).length).toBeGreaterThan(1);
    expect(() => planShards([rec(1)], () => "Bad Name")).toThrow();
  });
});

describe("upload plan", () => {
  it("skips example kinds, filters by kind, and puts the manifest last", () => {
    const out = mkdtempSync(join(tmpdir(), "atlas-"));
    writeKind(out, "example", [rec(1)]);
    writeKind(out, "cards", [rec(2)]);
    writeKind(out, "domains", [rec(3)]);
    const m = readManifest(join(out, "manifest.json"));
    expect(shippable(m).shards.map((s) => s.kind)).toEqual(["cards", "domains"]);
    expect(shippable(m, ["domains"]).shards.map((s) => s.kind)).toEqual(["domains"]);
    const cmds = uploadCommands(shippable(m), out, out, join(out, "manifest.ship.json"));
    expect(cmds[0]).toBe('npx wrangler r2 object put banana-atlas/atlas/v1/cards/all.json --file "cards/all.json" --content-type application/json --remote');
    expect(cmds.at(-1)).toMatch(/atlas\/v1\/manifest\.json --file "manifest\.ship\.json"/);
  });
});

describe("writeKind and the manifest", () => {
  it("writes shards under 100 KB and lists each with sha256, replacing only that kind", () => {
    const out = mkdtempSync(join(tmpdir(), "atlas-"));
    const many = Array.from({ length: 1500 }, (_, i) => rec(i, 200));
    const entries = writeKind(out, "cards", many);
    expect(entries.length).toBeGreaterThan(1);
    for (const e of entries) {
      const text = readFileSync(join(out, e.path), "utf8");
      expect(Buffer.byteLength(text)).toBeLessThan(100 * 1024);
      expect(sha256(text)).toBe(e.sha256);
      expect(JSON.parse(text)).toHaveLength(e.count);
    }
    writeKind(out, "domains", [rec(1)]);
    writeKind(out, "cards", [rec(2)]);
    const m = readManifest(join(out, "manifest.json"));
    expect(m.version).toBe("v1");
    expect(m.shards.map((s) => s.path)).toEqual(["cards/all.json", "domains/all.json"]);
    expect(readdirSync(join(out, "cards"))).toEqual(["all.json"]);
    expect(verifyManifest(out)).toEqual([]);
  });

  it("verifyManifest catches an edited shard", () => {
    const out = mkdtempSync(join(tmpdir(), "atlas-"));
    writeKind(out, "fit", [rec(1)]);
    writeFileSync(join(out, "fit", "all.json"), "[]\n");
    expect(verifyManifest(out)[0]).toMatch(/sha256/);
  });
});
