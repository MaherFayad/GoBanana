import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractJson, toRecords, validateRecords, writeRejects, writingProblems } from "../lib/validate.ts";
import { FitScoreSchema, IngredientCardSchema, LensPackSchema, MechanicSchema, PageAnatomySchema, QueryRecipeSchema } from "../schema.ts";

const card = {
  id: "terrazzo",
  kind: "material",
  name: "Terrazzo",
  family: "stone",
  idea: "Chips of stone set in a smooth floor.",
  surprise: "Floors are rarely a screen texture.",
  palette: [
    { hex: "#F4EFE6", role: "surface", name: "cream" },
    { hex: "#1F1B16", role: "ink", name: "soot" },
  ],
  shipPairs: [["#1F1B16", "#F4EFE6"]],
  type: { voice: "grotesk", latin: { display: "Inter", body: "Inter" }, arabic: { display: "Cairo", body: "Cairo" } },
  texture: "speckled chips",
  imagery: "flat lay of floors",
  motion: { verb: "settle", ms: 240, reduced: "fade" },
  radius: "soft",
  density: "balanced",
  avoid: ["glossy gradients"],
  artQueries: ["terrazzo floor detail"],
};

describe("extractJson", () => {
  it("reads a fenced block, bare JSON, or JSON inside prose", () => {
    expect(extractJson('Here:\n```json\n[{"a":1}]\n```\nDone')).toEqual([{ a: 1 }]);
    expect(extractJson('{"a":2}')).toEqual({ a: 2 });
    expect(extractJson('Sure. {"a":3} hope it helps')).toEqual({ a: 3 });
    expect(() => extractJson("no json here")).toThrow();
  });

  it("toRecords accepts an array, {records}, or one object", () => {
    expect(toRecords([1, 2])).toEqual([1, 2]);
    expect(toRecords({ records: [3] })).toEqual([3]);
    expect(toRecords({ a: 1 })).toEqual([{ a: 1 }]);
  });
});

describe("validateRecords", () => {
  it("keeps valid records and rejects invalid ones with reasons", () => {
    const { ok, rejects } = validateRecords("j3", "req", [card, { ...card, radius: "huge" }, { ...card, palette: [{ hex: "red", role: "ink", name: "x" }] }], IngredientCardSchema);
    expect(ok).toHaveLength(1);
    expect(rejects).toHaveLength(2);
    expect(rejects[0]!.reason.join()).toMatch(/radius/);
    expect(rejects[1]!.reason.join()).toMatch(/hex/);
  });

  it("rejects em dashes and tashkeel anywhere", () => {
    expect(writingProblems({ a: ["fine", "bad \u2014 dash"] })).toEqual(["a[1]: has an em dash"]);
    expect(writingProblems({ ar: "\u0645\u064E\u0631\u062D\u0628\u0627" })[0]).toMatch(/tashkeel/);
    const { ok, rejects } = validateRecords("j3", "req", [{ ...card, idea: "A floor \u2014 of chips." }], IngredientCardSchema);
    expect(ok).toHaveLength(0);
    expect(rejects[0]!.reason[0]).toMatch(/idea: has an em dash/);
  });

  it("runs the job check after the schema", () => {
    const { ok, rejects } = validateRecords("j3", "req", [card], IngredientCardSchema, (c) => (c.type.latin.display === "Inter" ? ["no Inter"] : []));
    expect(ok).toHaveLength(0);
    expect(rejects[0]!.reason).toEqual(["no Inter"]);
  });

  it("writes rejects as JSON lines, truncating on a fresh run", () => {
    const dir = mkdtempSync(join(tmpdir(), "atlas-"));
    writeRejects(dir, "j1", [{ job: "j1", request: "a", reason: ["x"], record: 1 }]);
    writeRejects(dir, "j1", [{ job: "j1", request: "b", reason: ["y"], record: 2 }]);
    expect(readFileSync(join(dir, "j1.jsonl"), "utf8").trim().split("\n")).toHaveLength(2);
    writeRejects(dir, "j1", [], true);
    expect(readFileSync(join(dir, "j1.jsonl"), "utf8")).toBe("");
  });
});

describe("schema rules from the plan", () => {
  it("requires culturalNotes on traditions", () => {
    expect(IngredientCardSchema.safeParse({ ...card, kind: "tradition" }).success).toBe(false);
    expect(IngredientCardSchema.safeParse({ ...card, kind: "tradition", culturalNotes: "Credit the Bedouin weavers." }).success).toBe(true);
  });

  it("checks type voices, stitch roles, mustKeep and mechanic names", () => {
    expect(IngredientCardSchema.safeParse({ ...card, type: { ...card.type, voice: "fancy" } }).success).toBe(false);
    const anatomy = {
      id: "checkout",
      names: { en: ["checkout"], ar: ["\u0627\u0644\u062F\u0641\u0639"] },
      platforms: ["mobile"],
      sections: [{ role: "cta", element: "cta", label: "Pay", required: true, bands: { mobile: { y0: 0.85, y1: 1 } } }],
      baseline: "A summary and a pay button.",
      mustKeep: ["total"],
      wildSpots: [{ element: "total", why: "The moment of truth." }],
      mobbinTerms: ["checkout"],
      queryNouns: ["checkout"],
    };
    expect(PageAnatomySchema.safeParse(anatomy).success).toBe(true);
    expect(PageAnatomySchema.safeParse({ ...anatomy, sections: [{ ...anatomy.sections[0], role: "banner" }] }).success).toBe(false);
    expect(PageAnatomySchema.safeParse({ ...anatomy, mustKeep: ["a", "b", "c", "d", "e", "f", "g"] }).success).toBe(false);
    expect(PageAnatomySchema.safeParse({ ...anatomy, sections: [{ ...anatomy.sections[0], bands: { mobile: { y0: 0.9, y1: 0.2 } } }] }).success).toBe(false);
    const mech = { id: "ticket-total", element: "total", name: "Torn ticket total", how: "x", buildability: 4, rtl: "x", a11y: "x", pages: ["checkout"] };
    expect(MechanicSchema.safeParse(mech).success).toBe(true);
    expect(MechanicSchema.safeParse({ ...mech, name: "A very long mechanic name" }).success).toBe(false);
  });

  it("checks lens packs for the sacred text rule and a static motif", () => {
    const lens = {
      id: "sadu",
      name: "Sadu",
      nameAr: "\u0627\u0644\u0633\u062F\u0648",
      region: "gulf",
      story: "s",
      credit: "Bedouin women weavers",
      shapeGrammar: ["triangles"],
      rhythm: "r",
      motionVerb: "weave",
      palette: card.palette,
      typePairs: [card.type],
      motifSvg: '<svg viewBox="0 0 10 10"><path d="M0 0h10" fill="currentColor"/></svg>',
      dos: ["credit the weavers"],
      donts: ["No sacred or Quranic text as decoration."],
    };
    expect(LensPackSchema.safeParse(lens).success).toBe(true);
    expect(LensPackSchema.safeParse({ ...lens, donts: ["no neon"] }).success).toBe(false);
    expect(LensPackSchema.safeParse({ ...lens, motifSvg: '<svg><script>alert(1)</script></svg>' }).success).toBe(false);
    expect(LensPackSchema.safeParse({ ...lens, motifSvg: '<svg onload="x()"></svg>' }).success).toBe(false);
  });

  it("checks fit scores and recipe sources", () => {
    expect(FitScoreSchema.safeParse({ cardId: "a", domainId: "b", score: 4, reason: "r" }).success).toBe(false);
    const recipe = { key: { lane: "art", cardId: "terrazzo" }, query: "terrazzo floor", source: "pinterest", precision: 0.75, judged: 8, at: "2026-10-15" };
    expect(QueryRecipeSchema.safeParse(recipe).success).toBe(true);
    expect(QueryRecipeSchema.safeParse({ ...recipe, source: "made-up" }).success).toBe(false);
  });
});
