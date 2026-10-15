/** P2-03 content ops helpers: validation, merge by record key. */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CARDS, FIT } from "../../banana-server/tests/fixtures/atlas.ts";
import { readJobRecords } from "../lib/layout.ts";
import { writeKind } from "../lib/shards.ts";
import { mergeRecords, recordKey, validateOps } from "../ops.ts";

describe("ops validate", () => {
  it("accepts a good card and computes its ship pairs", () => {
    const { ok, rejects } = validateOps("cards", [{ ...CARDS[0]!, shipPairs: [] }]);
    expect(rejects).toEqual([]);
    expect((ok[0] as { shipPairs: unknown[] }).shipPairs.length).toBeGreaterThan(0);
  });

  it("rejects an em dash, an unknown font and a bad shape", () => {
    const { ok, rejects } = validateOps("cards", [
      { ...CARDS[0]!, idea: "A thing — with a dash." },
      { ...CARDS[1]!, type: { ...CARDS[1]!.type, latin: { display: "Not A Real Font Family", body: "Inter" } } },
      { id: "x" },
    ]);
    expect(ok).toHaveLength(0);
    expect(rejects).toHaveLength(3);
  });
});

describe("ops merge", () => {
  it("keys records per kind and lets a new record replace the old one", () => {
    expect(recordKey("fit", FIT[0] as never)).toBe(`${FIT[0]!.cardId}|${FIT[0]!.domainId}`);
    const old = { ...CARDS[0]!, idea: "Old idea." };
    const merged = mergeRecords("cards", [old, CARDS[1]!], [CARDS[0]!]);
    expect(merged).toHaveLength(2);
    expect(merged).toContainEqual(CARDS[0]);
  });

  it("merges into a job output folder that the layout reads back", () => {
    const out = mkdtempSync(join(tmpdir(), "atlas-ops-"));
    writeKind(out, "cards", CARDS.slice(0, 3));
    writeKind(out, "cards", mergeRecords("cards", readJobRecords(out).get("cards") ?? [], CARDS.slice(2, 5)));
    expect(readJobRecords(out).get("cards")).toHaveLength(5);
  });
});
