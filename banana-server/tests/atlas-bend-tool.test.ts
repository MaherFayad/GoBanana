import { beforeAll, describe, expect, it } from "vitest";
import { createAtlasLoader, type AtlasManifest } from "@/lib/atlas/loader";
import { loaderSource } from "@/lib/atlas/source";
import { bendEngineMode, createBendBriefTool, type BendEngineDeps } from "@/lib/mcp/tools/bend_brief";
import type { BendResult } from "@/lib/bend";
import { buildFixtureAtlas, countingFetcher, type ShardFiles } from "./fixtures/atlas-shards";
import { ALICE, makeDeps, seedCanvas } from "./tools-fixtures";

let manifest: AtlasManifest;
let files: ShardFiles;
beforeAll(async () => {
  ({ manifest, files } = await buildFixtureAtlas());
});

const atlasEngine = (mode = "atlas"): BendEngineDeps => ({
  mode: () => mode,
  source: () => loaderSource(createAtlasLoader({ manifest, fetchShard: countingFetcher(files).fetchShard, budget: 200 })),
});
const ESIM = { brief: "eSIM plan picker for a GCC travel app", wildness: 3, platform: "mobile" };

describe("bend_brief engine flag (P1-I2)", () => {
  it("BEND_ENGINE defaults to lists", () => {
    expect(bendEngineMode(undefined)).toBe("lists");
    expect(bendEngineMode("")).toBe("lists");
    expect(bendEngineMode("nope")).toBe("lists");
    expect(bendEngineMode(" Atlas ")).toBe("atlas");
  });

  it("lists mode never reads the Atlas", async () => {
    const { repos } = makeDeps();
    let reads = 0;
    const engine: BendEngineDeps = { mode: () => "lists", source: () => (reads++, null) };
    const res = await createBendBriefTool(() => ({ repos }), engine)(ESIM, ALICE);
    expect((res.structuredContent as unknown as BendResult).atlas).toBeUndefined();
    expect(reads).toBe(0);
  });

  it("atlas mode bends from the Atlas and saves the Atlas ids with each direction", async () => {
    const { repos } = makeDeps();
    const { id } = await seedCanvas(repos, ALICE);
    const res = await createBendBriefTool(() => ({ repos }), atlasEngine())({ ...ESIM, canvasId: id }, ALICE);
    const out = res.structuredContent as unknown as BendResult;
    expect(out.atlas?.pageId).toBe("plan-picker");
    const saved = await repos.directions.listForCanvas(id);
    expect(saved.length).toBe(out.directions.length);
    for (const row of saved) {
      const d = out.directions.find((x) => x.id === row.bendId)!;
      expect(row.detail?.atlas).toMatchObject({ cardIds: d.cardIds, recipeIds: d.recipeIds, pageId: "plan-picker", domainId: "telecom-travel", productNoun: "eSIM" });
    }
  });

  it("atlas mode falls back to the word lists with no Atlas or an unknown brief", async () => {
    const { repos } = makeDeps();
    const lists = await createBendBriefTool(() => ({ repos }))(ESIM, ALICE);
    const none: BendEngineDeps = { mode: () => "atlas", source: () => null };
    const fallback = await createBendBriefTool(() => ({ repos }), none)(ESIM, ALICE);
    expect(fallback.structuredContent).toEqual(lists.structuredContent);
    const unknown = await createBendBriefTool(() => ({ repos }), atlasEngine())({ brief: "banking onboarding", wildness: 2 }, ALICE);
    expect((unknown.structuredContent as unknown as BendResult).atlas).toBeUndefined();
    expect((unknown.structuredContent as unknown as BendResult).directions.length).toBeGreaterThan(0);
  });
});
