/**
 * VAL-08: the Arabic-first pack. Sample copy in white Saudi dialect, RTL notes per part and an
 * Arabic type pair from the J12 type atlas (`type-pairs` kind, one shard per voice), in the
 * direction detail, DIRECTION.md and BUILD-PROMPT.md.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { ATLAS_KINDS, createAtlasLoader, shardPath, type AtlasManifest } from "@/lib/atlas/loader";
import { loaderSource, type AtlasSource } from "@/lib/atlas/source";
import { loadTypePairs } from "@/lib/atlas/wiring";
import { arabicSummaryLine, buildArabicPack, COPY_KINDS, copyKindOf, GENERIC_COPY, PAIR_CHOICES, pickTypePair, RTL_BY_ELEMENT, rtlNotes, sampleCopy, voicePair } from "@/lib/arabic";
import { parseArabicPack, parseDirectionDetail } from "@/lib/db/detail";
import { TYPE_VOICES } from "@/lib/direction-detail";
import { createExportKitTool, TOOL_DESCRIPTION } from "@/lib/mcp/tools/export_kit";
import { directionDetail } from "@/lib/mcp/tools/bend_brief";
import { bendBrief } from "@/lib/bend";
import { allowedExportFormats } from "@/lib/quota";
import { buildFixtureAtlas, countingFetcher, type ShardFiles } from "./fixtures/atlas-shards";
import { TYPE_PAIRS } from "./fixtures/type-pairs";
import { ALICE, makeDeps, seedCanvas, text } from "./tools-fixtures";

let manifest: AtlasManifest;
let files: ShardFiles;
beforeAll(async () => {
  ({ manifest, files } = await buildFixtureAtlas("v1", false, true));
});
const source = (f: ShardFiles = files, m: AtlasManifest = manifest): AtlasSource => loaderSource(createAtlasLoader({ manifest: m, fetchShard: countingFetcher(f).fetchShard, budget: 200 }));

// Tashkeel (harakat), tatweel and the Quranic marks.
const TASHKEEL = /[ً-ٰٟـۖ-ۭ]/;

describe("phrase bank", () => {
  const all = [GENERIC_COPY, ...COPY_KINDS];

  it("is white Saudi Arabic without tashkeel, em dashes or Latin letters", () => {
    for (const k of all) {
      for (const b of [...k.headline, k.action, k.support]) {
        expect(b.ar.trim(), k.id).toBe(b.ar);
        expect(b.ar.length).toBeGreaterThan(2);
        expect(b.ar).toMatch(/[؀-ۿ]/);
        expect(b.ar).not.toMatch(TASHKEEL);
        expect(b.ar).not.toMatch(/[A-Za-z]/);
        expect(b.ar + b.en).not.toMatch(/[–—]/);
        expect(b.en.length).toBeGreaterThan(2);
      }
    }
  });

  it("keeps the strings short enough for a button, a title and a line", () => {
    for (const k of all) {
      expect(k.action.ar.length, k.id).toBeLessThanOrEqual(24);
      for (const h of k.headline) expect(h.ar.length, k.id).toBeLessThanOrEqual(40);
      expect(k.support.ar.length, k.id).toBeLessThanOrEqual(100);
    }
  });

  it("has unique kind ids and a note for every part it names", () => {
    expect(new Set(all.map((k) => k.id)).size).toBe(all.length);
    for (const k of all) for (const p of k.parts) expect(RTL_BY_ELEMENT[p], `${k.id}:${p}`).toBeDefined();
  });

  it("is gender neutral at least for the actions: no command forms", () => {
    // Commands like "ادفع" or "احجز" assume a male reader; the bank uses nouns and "we" forms.
    for (const k of all) expect(k.action.ar).not.toMatch(/^(ادفع|احجز|اشترك|ابدأ|جرب|اختار|اكتشف)/);
  });
});

describe("page kind", () => {
  it("the page id wins over the pages and the brief", () => {
    expect(copyKindOf({ pageId: "flight-checkout", pages: ["pricing page"], brief: "onboarding" }).id).toBe("checkout");
    expect(copyKindOf({ pageId: "order-confirmation" }).id).toBe("success");
    expect(copyKindOf({ pageId: "plan-picker" }).id).toBe("pricing");
    expect(copyKindOf({ pageId: "empty-state" }).id).toBe("problem");
    expect(copyKindOf({ pageId: "hotel-detail" }).id).toBe("booking");
  });

  it("reads the saved pages, then the brief, on whole words only", () => {
    expect(copyKindOf({ pages: ["pricing page"] }).id).toBe("pricing");
    expect(copyKindOf({ brief: "Redesign the checkout for a travel app" }).id).toBe("checkout");
    // "redesign" contains "sign" but is not an onboarding word.
    expect(copyKindOf({ brief: "Redesign something" }).id).toBe("generic");
    expect(copyKindOf({ brief: "" }).id).toBe("generic");
    expect(copyKindOf({}).id).toBe("generic");
  });

  it("every kind is reachable from one of its own words", () => {
    for (const k of COPY_KINDS) {
      const word = k.words[0]!;
      expect(copyKindOf({ pageId: word }).id, k.id).toBe(k.id);
    }
  });
});

describe("sample copy", () => {
  it("is deterministic per seed and uses both headlines across seeds", () => {
    const kind = COPY_KINDS[0]!;
    expect(sampleCopy(kind, "d1")).toEqual(sampleCopy(kind, "d1"));
    const heads = new Set(Array.from({ length: 20 }, (_, i) => sampleCopy(kind, `d${i}`).headline.ar));
    expect(heads.size).toBe(2);
  });
});

describe("RTL notes", () => {
  it("say what flips and what must not for the parts that matter", () => {
    expect(RTL_BY_ELEMENT.progress!.flips).toMatch(/right to left/);
    expect(RTL_BY_ELEMENT.progress!.keeps).toMatch(/scrubber/);
    expect(RTL_BY_ELEMENT["bottom-nav"]!.flips).toMatch(/right to left/);
    expect(RTL_BY_ELEMENT.chart!.keeps).toMatch(/Time axes/);
    expect(RTL_BY_ELEMENT.total!.keeps).toMatch(/Digits/);
    expect(RTL_BY_ELEMENT.hero!.keeps).toMatch(/logos/);
    for (const r of Object.values(RTL_BY_ELEMENT)) {
      expect(r.flips + r.keeps).not.toMatch(/[–—]/);
      expect(r.flips.length).toBeGreaterThan(10);
      expect(r.keeps.length).toBeGreaterThan(10);
    }
  });

  it("lists parts in order without repeats, skips unknown names and caps the list", () => {
    expect(rtlNotes(["progress", "nope", "progress", "cta"]).map((n) => n.part)).toEqual(["Progress", "Main action"]);
    expect(rtlNotes(Object.keys(RTL_BY_ELEMENT))).toHaveLength(6);
    expect(rtlNotes(Object.keys(RTL_BY_ELEMENT), 3)).toHaveLength(3);
    expect(rtlNotes([])).toEqual([]);
  });
});

describe("type pair", () => {
  it("takes one of the best pairs of the voice, by seed, and is deterministic", () => {
    const best = TYPE_PAIRS.filter((p) => p.voice === "grotesk");
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const p = pickTypePair(TYPE_PAIRS, "grotesk", `d${i}`);
      expect(p.source).toBe("atlas");
      expect(best.map((b) => b.id)).toContain(p.id);
      expect(pickTypePair(TYPE_PAIRS, "grotesk", `d${i}`)).toEqual(p);
      seen.add(p.id!);
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(seen.size).toBeLessThanOrEqual(PAIR_CHOICES);
  });

  it("only ranks pairs of the same voice", () => {
    for (let i = 0; i < 10; i++) expect(["bitter-source-sans-3-kufam-noto-naskh-arabic", "zilla-slab-roboto-noto-kufi-arabic-cairo"]).toContain(pickTypePair(TYPE_PAIRS, "slab", `s${i}`).id);
  });

  it("falls back to the voice's own fonts when the Atlas has no pair", () => {
    for (const none of [null, undefined, []]) {
      const p = pickTypePair(none, "mono", "x");
      expect(p).toEqual(voicePair("mono"));
      expect(p.source).toBe("voice");
      expect(p.id).toBeUndefined();
    }
    // Pairs of other voices do not count.
    expect(pickTypePair(TYPE_PAIRS, "condensed", "x").source).toBe("voice");
    for (const v of TYPE_VOICES) expect(voicePair(v).arabic.body.length).toBeGreaterThan(2);
  });

  it("skips records with missing font names", () => {
    const broken = [{ ...TYPE_PAIRS[0]!, arabic: { display: "", body: "Cairo" } }];
    expect(pickTypePair(broken, "grotesk", "x").source).toBe("voice");
  });
});

describe("type-pairs Atlas kind", () => {
  it("is a loader kind", () => {
    expect(ATLAS_KINDS).toContain("type-pairs");
  });

  it("a hit returns the pairs of the voice", async () => {
    const src = source();
    const got = await src.typePairs("grotesk");
    expect(got?.map((p) => p.id).sort()).toEqual(TYPE_PAIRS.filter((p) => p.voice === "grotesk").map((p) => p.id).sort());
    expect((await src.typePairs("slab"))?.length).toBe(2);
  });

  it("a miss is an empty list, and an Atlas without the kind gives the same", async () => {
    expect(await source().typePairs("condensed")).toEqual([]);
    const plain = await buildFixtureAtlas();
    expect(await source(plain.files, plain.manifest).typePairs("grotesk")).toEqual([]);
    expect(await source(new Map(), { version: "v1", hash: "", shards: [] }).typePairs("grotesk")).toEqual([]);
  });

  it("a shard that is listed but missing is null", async () => {
    const lost = new Map(files);
    lost.delete(shardPath("v1", "type-pairs", "grotesk"));
    expect(await source(lost).typePairs("grotesk")).toBeNull();
  });

  it("a bad hash is dropped", async () => {
    const p = shardPath("v1", "type-pairs", "grotesk");
    const tampered = new Map(files);
    tampered.set(p, files.get(p)!.replace("Archivo", "Archivx"));
    expect(tampered.get(p)).not.toBe(files.get(p));
    expect(await source(tampered).typePairs("grotesk")).toBeNull();
  });

  it("loadTypePairs reads the shard of each voice once and fails open", async () => {
    const fetcher = countingFetcher(files);
    const src = loaderSource(createAtlasLoader({ manifest, fetchShard: fetcher.fetchShard, budget: 200 }));
    const dirs = [
      { detail: { spec: { typeVoice: "grotesk" } } },
      { detail: { spec: { typeVoice: "grotesk" } } },
      { detail: { spec: { typeVoice: "slab" } } },
      { detail: null },
    ] as never;
    const got = await loadTypePairs(src, dirs);
    expect(got?.length).toBe(5);
    expect(fetcher.total()).toBe(2);
    expect(await loadTypePairs(null, dirs)).toBeNull();
    expect(await loadTypePairs({ ...src, typePairs: async () => Promise.reject(new Error("x")) }, dirs)).toBeNull();
    expect(await loadTypePairs({ ...src, typePairs: async () => null }, dirs)).toBeNull();
    expect(await loadTypePairs({ ...src, typePairs: async () => [] }, dirs)).toBeNull();
  });
});

describe("pack", () => {
  it("builds copy, RTL notes and a type pair for a direction, deterministically", () => {
    const detail = { spec: { typeVoice: "slab" }, pages: ["checkout"], mechanic: { element: "progress", how: "weave" } } as never;
    const a = buildArabicPack({ seed: "bd-1", detail, pairs: TYPE_PAIRS });
    expect(a).toEqual(buildArabicPack({ seed: "bd-1", detail, pairs: TYPE_PAIRS }));
    expect(a.page).toBe("checkout");
    expect(a.copy.action.ar).toBe("إتمام الدفع");
    // The mechanic's part comes first.
    expect(a.rtl[0]!.part).toBe("Progress");
    expect(a.type.source).toBe("atlas");
    expect(a.type.voice).toBe("slab");
    expect(arabicSummaryLine(a)).toContain(a.copy.headline.ar);
  });

  it("works with no detail, no brief and no pairs", () => {
    const a = buildArabicPack({ seed: "x" });
    expect(a.page).toBe("generic");
    expect(a.type).toEqual(voicePair("grotesk"));
    expect(a.rtl.length).toBeGreaterThan(0);
  });

  it("is saved with the direction only when asked, and survives the detail parser", () => {
    const d = bendBrief({ brief: "checkout page for a coffee app", wildness: 3, platform: "mobile" }).directions[0]!;
    expect(directionDetail(d, 3, "checkout page")).not.toHaveProperty("arabic");
    const saved = directionDetail(d, 3, "checkout page", undefined, { pairs: TYPE_PAIRS });
    expect(saved.arabic?.page).toBe("checkout");
    const round = parseDirectionDetail(JSON.parse(JSON.stringify(saved)));
    expect(round?.arabic).toEqual(saved.arabic);
  });

  it("the detail parser drops a broken pack and caps long text", () => {
    const pack = buildArabicPack({ seed: "x", pairs: TYPE_PAIRS });
    expect(parseArabicPack(pack)).toEqual(pack);
    expect(parseArabicPack({ ...pack, copy: { ...pack.copy, action: { ar: "", en: "x" } } })).toBeUndefined();
    expect(parseArabicPack({ ...pack, type: { ...pack.type, voice: "comic" } })).toBeUndefined();
    expect(parseArabicPack({ ...pack, rtl: "no" })).toBeUndefined();
    expect(parseArabicPack("no")).toBeUndefined();
    const long = parseArabicPack({ ...pack, rtl: Array.from({ length: 20 }, () => ({ part: "P", flips: "f".repeat(900), keeps: "k" })) });
    expect(long?.rtl).toHaveLength(8);
    expect(long?.rtl[0]!.flips.length).toBe(300);
  });
});

describe("export_kit: the pack in DIRECTION.md and BUILD-PROMPT.md", () => {
  const detail = { platform: "mobile", verdict: "keep", pages: ["checkout"], spec: { typeVoice: "grotesk", typography: "Grotesk, tight", signature: "A stamped ticket" } };

  async function build(formats: string[], plan: "free" | "pro_monthly", src: AtlasSource | null, voiceDetail: object = detail) {
    const { deps, repos } = makeDeps({ plans: { [ALICE]: plan } });
    const canvas = await seedCanvas(repos, ALICE);
    await repos.directions.upsertMany(canvas.id, [{ bendId: "bd-1", move: "lens", title: "Stamped", searchQuery: "ticket", detail: voiceDetail }]);
    const res = await createExportKitTool({ ...deps, atlasSource: () => src })({ canvasId: canvas.id, formats: formats as never }, ALICE);
    return text(res);
  }

  it("writes the copy, the Atlas type pair and the RTL notes into DIRECTION.md for a free user", async () => {
    const out = await build(["direction_md"], "free", source());
    expect(out).toContain("### Arabic-first pack");
    expect(out).toMatch(/Headline: (طلبك جاهز للدفع|آخر خطوة وطلبك عندك)/);
    expect(out).toContain("Main action: إتمام الدفع (Complete payment)");
    expect(out).toContain("المبلغ الإجمالي واضح قبل الدفع");
    expect(out).toContain("Arabic type pair (J12 type atlas,");
    expect(out).toMatch(/Archivo|Space Grotesk|Schibsted Grotesk/);
    expect(out).toContain("Flips:");
    expect(out).toContain("Keeps:");
    expect(out).toContain("RTL rules for every part");
    expect(out).not.toContain("—");
  });

  it("falls back to the voice's fonts when the Atlas has no pair, no Atlas or a broken one", async () => {
    for (const src of [null, source(new Map(), { version: "v1", hash: "", shards: [] }), { ...source(), typePairs: async () => Promise.reject(new Error("x")) } as AtlasSource]) {
      const out = await build(["direction_md"], "free", src);
      expect(out).toContain("the type atlas had no pair for it");
      expect(out).toContain("Readex Pro");
      expect(out).toContain("Headline:");
    }
    // A voice the fixture atlas has no pairs for.
    const out = await build(["direction_md"], "free", source(), { ...detail, spec: { ...detail.spec, typeVoice: "condensed" } });
    expect(out).toContain("the condensed voice's own fonts");
  });

  it("writes a compact pack into BUILD-PROMPT.md", async () => {
    const out = await build(["build_prompt"], "free", source());
    expect(out).toContain("### Arabic-first pack");
    expect(out).toContain("Supporting line:");
    expect(out).toContain("Replace the copy with the product's own words");
  });

  it("rides in formats the free plan already has, so plan gating is unchanged", async () => {
    expect(allowedExportFormats("free")).toEqual(expect.arrayContaining(["direction_md", "build_prompt"]));
    // A format that is Pro only stays blocked for a free user, and carries no pack.
    const blocked = await build(["review"], "free", source());
    expect(blocked).not.toContain("Arabic-first pack");
    const design = await build(["design_md"], "free", source());
    expect(design).not.toContain("Arabic-first pack");
  });

  it("reads type pairs only when DIRECTION.md or BUILD-PROMPT.md is exported", async () => {
    let reads = 0;
    const spy = { ...source(), typePairs: async (v: string) => (reads++, source().typePairs(v)) } as AtlasSource;
    await build(["design_md"], "pro_monthly", spy);
    expect(reads).toBe(0);
    await build(["direction_md", "build_prompt"], "pro_monthly", spy);
    expect(reads).toBe(1);
  });

  it("keeps the tool description under 400 characters", () => {
    expect(TOOL_DESCRIPTION.length).toBeLessThan(400);
  });
});
