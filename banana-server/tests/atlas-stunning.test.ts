/**
 * VAL-14: the J13 stunning layer on the server. The loader knows the "shaders" and "motion" kinds,
 * the Atlas bend attaches up to 1 shader and 2 motion recipes (ids only) per direction, and
 * export_kit writes their GLSL and CSS, with the reduced-motion fallbacks, into BUILD-PROMPT.md.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { bendBriefAtlas, MAX_MOTION, MAX_SHADERS, pickStunning, stunningScore } from "@/lib/atlas/bend";
import { ATLAS_KINDS, createAtlasLoader, shardPath, type AtlasManifest } from "@/lib/atlas/loader";
import { loaderSource, type AtlasSource } from "@/lib/atlas/source";
import type { MotionRecipe, ShaderRecipe } from "@/lib/atlas/types";
import { loadDirectionStunning } from "@/lib/atlas/wiring";
import { parseDirectionAtlas } from "@/lib/db/detail";
import { createExportKitTool, TOOL_DESCRIPTION } from "@/lib/mcp/tools/export_kit";
import type { BendInput } from "@/lib/bend";
import { CARDS } from "./fixtures/atlas";
import { buildFixtureAtlas, countingFetcher, type ShardFiles } from "./fixtures/atlas-shards";
import { MOTION, SHADERS } from "./fixtures/stunning";
import { ALICE, makeDeps, seedCanvas, text } from "./tools-fixtures";

let manifest: AtlasManifest;
let files: ShardFiles;
beforeAll(async () => {
  ({ manifest, files } = await buildFixtureAtlas("v1", true));
});
const source = (f: ShardFiles = files): AtlasSource => loaderSource(createAtlasLoader({ manifest, fetchShard: countingFetcher(f).fetchShard, budget: 200 }));
const ESIM: BendInput = { brief: "eSIM plan picker for a GCC travel app", wildness: 3, platform: "mobile" };
const card = (id: string) => CARDS.find((c) => c.id === id)!;

describe("loader: shaders and motion kinds", () => {
  it("lists both kinds", () => {
    expect(ATLAS_KINDS).toContain("shaders");
    expect(ATLAS_KINDS).toContain("motion");
  });

  it("a hit returns the records of the shard", async () => {
    const loader = createAtlasLoader({ manifest, fetchShard: countingFetcher(files).fetchShard });
    expect(loader.names("shaders")).toEqual(["00"]);
    expect((await loader.shard<ShaderRecipe>("shaders", "00"))?.map((r) => r.id)).toEqual(SHADERS.map((r) => r.id));
    expect((await loader.all<MotionRecipe>("motion"))?.map((r) => r.id)).toEqual(MOTION.map((r) => r.id));
    expect((await source().shaders())?.length).toBe(SHADERS.length);
    expect((await source().motion())?.length).toBe(MOTION.length);
  });

  it("a miss is null, and an Atlas without the layer gives an empty list", async () => {
    const loader = createAtlasLoader({ manifest, fetchShard: countingFetcher(files).fetchShard });
    expect(await loader.shard("shaders", "99")).toBeNull();
    expect(await loader.shard("motion", "01")).toBeNull();
    const plain = await buildFixtureAtlas();
    const bare = loaderSource(createAtlasLoader({ manifest: plain.manifest, fetchShard: countingFetcher(plain.files).fetchShard }));
    expect(await bare.shaders()).toEqual([]);
    expect(await bare.motion()).toEqual([]);
  });

  it("a bad hash is dropped for both kinds", async () => {
    for (const kind of ["shaders", "motion"] as const) {
      const p = shardPath("v1", kind, "00");
      const tampered = new Map(files);
      tampered.set(p, files.get(p)!.replace(/"id":"([a-z-]+)"/, '"id":"x$1"'));
      expect(tampered.get(p)).not.toBe(files.get(p));
      const loader = createAtlasLoader({ manifest, fetchShard: countingFetcher(tampered).fetchShard });
      expect(await loader.shard(kind, "00")).toBeNull();
      expect(await loader.all(kind)).toBeNull();
    }
  });
});

describe("bend engine: up to 1 shader and 2 motion recipes, ids only", () => {
  it("scores by lens, cards, family and element, and never attaches a zero fit", () => {
    const weave = SHADERS.find((r) => r.id === "weave-drift")!;
    expect(stunningScore(weave, [card("sadu-weaving")], "sadu", "hero")).toBe(3 + 2 + 1 + 1);
    expect(stunningScore(weave, [card("luggage-tag")], undefined, "hero")).toBe(0);
    const picked = pickStunning(SHADERS, [card("luggage-tag")], undefined, "hero", 1, new Set(), "k");
    expect(picked).toEqual([]);
  });

  it("limits the picks, prefers unused recipes and different triggers", () => {
    const cards = [card("sadu-weaving"), card("departure-board")];
    const used = new Set<string>();
    const first = pickStunning(MOTION, cards, "sadu", "hero", 2, used, "k");
    expect(first.length).toBeLessThanOrEqual(2);
    expect(first.map((r) => r.id)).toEqual(["weave-in", "flip-in"]);
    expect(used.has("weave-in")).toBe(true);
    // A recipe another direction took ranks after an unused one that fits, but is still allowed when nothing else fits.
    const second = pickStunning(MOTION, [...cards, card("luggage-tag")], "sadu", "hero", 1, used, "k");
    expect(second[0]!.id).toBe("tag-swing");
    expect(pickStunning(MOTION, cards, "sadu", "hero", 1, used, "k")[0]!.id).toBe("weave-in");
  });

  it("attaches ids to directions, within the caps, deterministically", async () => {
    const run = async () => (await bendBriefAtlas({ ...ESIM, lens: "sadu" }, source()))!;
    const r = await run();
    const shaderIds = new Set(SHADERS.map((s) => s.id));
    const motionIds = new Set(MOTION.map((m) => m.id));
    expect(r.directions.some((d) => d.shaderIds?.includes("weave-drift"))).toBe(true);
    for (const d of r.directions) {
      expect(d.shaderIds?.length ?? 0).toBeLessThanOrEqual(MAX_SHADERS);
      expect(d.motionIds?.length ?? 0).toBeLessThanOrEqual(MAX_MOTION);
      for (const id of d.shaderIds ?? []) expect(shaderIds.has(id)).toBe(true);
      for (const id of d.motionIds ?? []) expect(motionIds.has(id)).toBe(true);
      // Ids only: no code in the direction.
      expect(JSON.stringify(d)).not.toContain("gl_FragColor");
      expect(JSON.stringify(d)).not.toContain("@keyframes");
    }
    expect((await run()).directions.map((d) => [d.shaderIds, d.motionIds])).toEqual(r.directions.map((d) => [d.shaderIds, d.motionIds]));
  });

  it("changes nothing without the layer", async () => {
    const plain = await buildFixtureAtlas();
    const bare = loaderSource(createAtlasLoader({ manifest: plain.manifest, fetchShard: countingFetcher(plain.files).fetchShard, budget: 200 }));
    const r = (await bendBriefAtlas(ESIM, bare))!;
    for (const d of r.directions) {
      expect(d.shaderIds).toBeUndefined();
      expect(d.motionIds).toBeUndefined();
    }
  });

  it("falls back quietly when the layer cannot be read", async () => {
    const r = (await bendBriefAtlas(ESIM, { ...source(), shaders: async () => Promise.reject(new Error("boom")) }))!;
    expect(r.directions.length).toBeGreaterThan(0);
    for (const d of r.directions) expect(d.shaderIds).toBeUndefined();
  });

  it("detail.atlas keeps the ids, capped", () => {
    expect(parseDirectionAtlas({ atlas: { cardIds: ["a"], recipeIds: [], shaderIds: ["s1", "s2"], motionIds: ["m1", "m2", "m3"] } })).toMatchObject({ shaderIds: ["s1"], motionIds: ["m1", "m2"] });
    expect(parseDirectionAtlas({ atlas: { cardIds: ["a"], recipeIds: [] } })).not.toHaveProperty("shaderIds");
  });
});

describe("export_kit: the stunning layer in BUILD-PROMPT.md", () => {
  const atlas = { cardIds: ["sadu-weaving"], recipeIds: [], shaderIds: ["weave-drift"], motionIds: ["weave-in", "stamp-press"] };

  async function build(formats: string[], plan: "free" | "pro_monthly", withLayer = true) {
    const { deps, repos } = makeDeps({ plans: { [ALICE]: plan } });
    const canvas = await seedCanvas(repos, ALICE);
    await repos.directions.upsertMany(canvas.id, [{ bendId: "bd-1", move: "lens", title: "Sadu", searchQuery: "sadu", detail: { platform: "mobile", verdict: "keep", atlas } }]);
    const calls = { shaders: 0, motion: 0 };
    const base = source();
    const spy: AtlasSource = {
      ...base,
      shaders: async () => (calls.shaders++, withLayer ? base.shaders() : []),
      motion: async () => (calls.motion++, withLayer ? base.motion() : []),
    };
    const res = await createExportKitTool({ ...deps, atlasSource: () => spy })({ canvasId: canvas.id, formats: formats as never }, ALICE);
    return { out: text(res), calls };
  }

  it("writes the GLSL and the CSS with their reduced-motion fallbacks", async () => {
    const { out, calls } = await build(["build_prompt"], "free");
    expect(out).toContain("### Stunning layer");
    expect(out).toContain("```glsl");
    expect(out).toContain("void main()");
    expect(out).toContain("Reduced motion: draw one frame at u_time = 2");
    expect(out).toContain("@keyframes gb-weave-in");
    expect(out).toContain("@media (prefers-reduced-motion: reduce)");
    expect(out).toContain("set `--i`");
    expect(out).toContain("Sadu is woven by Bedouin women");
    expect(out).not.toContain("—");
    expect(calls).toEqual({ shaders: 1, motion: 1 });
  });

  it("reads nothing when build_prompt is not exported or not on the plan", async () => {
    const design = await build(["design_md"], "pro_monthly");
    expect(design.out).not.toContain("Stunning layer");
    expect(design.calls).toEqual({ shaders: 0, motion: 0 });
    // review is Pro only: a Free user gets the upgrade message and no read.
    const blocked = await build(["review"], "free");
    expect(blocked.calls).toEqual({ shaders: 0, motion: 0 });
  });

  it("leaves the section out when the layer has no such ids", async () => {
    const { out } = await build(["build_prompt"], "pro_monthly", false);
    expect(out).not.toContain("Stunning layer");
    expect(out).toContain("Build prompt");
  });

  it("loadDirectionStunning keeps only the named ids and fails open", async () => {
    const got = await loadDirectionStunning(source(), [{ detail: { atlas } }]);
    expect([...got!.shaders.keys()]).toEqual(["weave-drift"]);
    expect([...got!.motion.keys()].sort()).toEqual(["stamp-press", "weave-in"]);
    expect(await loadDirectionStunning(source(), [{ detail: { atlas: { cardIds: ["a"], recipeIds: [] } } }])).toBeNull();
    expect(await loadDirectionStunning(null, [{ detail: { atlas } }])).toBeNull();
    expect(await loadDirectionStunning({ ...source(), shaders: async () => Promise.reject(new Error("x")) }, [{ detail: { atlas } }])).toBeNull();
  });

  it("keeps the tool description under 400 characters", () => {
    expect(TOOL_DESCRIPTION.length).toBeLessThan(400);
  });
});
