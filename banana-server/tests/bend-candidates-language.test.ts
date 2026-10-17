/**
 * V4.1: the agent writes grounded candidates, the server's dice pick which lead (Impeccable: one
 * model ranks its own ideas the same way every time), and every direction declares a visual
 * language on 7 axes, spread so no two directions share one look.
 */
import { describe, expect, it } from "vitest";
import { axesApart, bendBrief, formatDirections, isOperatePage, parseBendInput, type BendInput, type Candidate } from "@/lib/bend";
import { LANGUAGE_AXES, LANGUAGE_VALUES, parseLanguage } from "@/lib/direction-detail";
import { parseDirectionDetail } from "@/lib/db/detail";
import { cleanDetail } from "@/lib/export/model";
import { createBendBriefTool, directionDetail } from "@/lib/mcp/tools/bend_brief";
import { ALICE, makeDeps, seedCanvas } from "./tools-fixtures";

/** 8 candidates over 6 families, from a Saudi traveller's world. */
const CANDIDATES: Candidate[] = [
  { name: "Riyadh metro map", why: "Riyadh commuters read it every day", looks: "Colored lines on white with round station dots", family: "signage" },
  { name: "Gate sign", why: "Every traveller hunts for it", looks: "Yellow condensed letters on black", family: "signage" },
  { name: "Sadu tent band", why: "Bedouin weaving every Saudi family knows", looks: "Red and black woven bands with white triangles", family: "textile" },
  { name: "Majlis cushions", why: "Where guests are welcomed", looks: "Low cushions in deep red with gold trim", family: "interior" },
  { name: "Boarding pass stub", why: "Proof the trip is real", looks: "Perforated paper with mono codes", family: "print" },
  { name: "Passport stamp", why: "Each trip leaves one", looks: "Inked round stamps that overlap", family: "print" },
  { name: "Arabic coffee pour", why: "Served to every guest on arrival", looks: "Brass dallah and small handleless cups", family: "ritual" },
  { name: "Dates on a tray", why: "The first thing offered to a guest", looks: "Glossy brown dates on a round brass tray", family: "food" },
];

/** The same 8 over only 4 families (2 each). */
const FOUR_FAMILIES: Candidate[] = CANDIDATES.map((c) => ({
  ...c,
  family: c.family === "interior" ? "textile" : c.family === "food" ? "ritual" : c.family,
}));

/** The same 8 over 3 families (3, 3 and 2). */
const THREE_FAMILIES: Candidate[] = CANDIDATES.map((c, i) => ({ ...c, family: ["signage", "textile", "print"][i % 3]! }));

const PROBES: readonly BendInput[] = [
  { brief: "AI agent dashboard where teams supervise autonomous support agents", platform: "webapp", pages: ["agent activity view"], wildness: 3, count: 8 },
  { brief: "AI writing assistant chat app onboarding", platform: "mobile", pages: ["onboarding"], wildness: 3, count: 8 },
  { brief: "Launch page for an AI coding agent startup", platform: "website", pages: ["launch page"], wildness: 3, count: 8 },
  { brief: "Flight checkout for a Saudi travel app", platform: "mobile", pages: ["checkout"], wildness: 3, count: 8 },
];

const CHECKOUT: BendInput = PROBES[3]!;
const EM = String.fromCharCode(0x2014);
const words = (s: string) => s.split(/\s+/).filter(Boolean);

describe("candidates input", () => {
  it("accepts 5 to 10 candidates and leaves them out when absent", () => {
    const ok = parseBendInput({ ...CHECKOUT, candidates: CANDIDATES.slice(0, 5) });
    expect(ok.ok && ok.input.candidates).toHaveLength(5);
    const none = parseBendInput(CHECKOUT);
    expect(none.ok && "candidates" in none.input).toBe(false);
  });

  it("answers too few or too many candidates with a plain message", () => {
    for (const candidates of [CANDIDATES.slice(0, 4), [...CANDIDATES, ...CANDIDATES.slice(0, 3)], []]) {
      const res = parseBendInput({ ...CHECKOUT, candidates });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toContain("candidates must be 5 to 10 ideas");
        expect(res.message).not.toMatch(/[{}[\]]/);
        expect(res.message).not.toContain(EM);
      }
    }
  });

  it("names the item and field that is too long or missing", () => {
    const long = CANDIDATES.map((c, i) => (i === 2 ? { ...c, looks: "x".repeat(161) } : c));
    const res = parseBendInput({ ...CHECKOUT, candidates: long });
    expect(res).toEqual({ ok: false, message: "candidates item 3: looks must be 1 to 160 characters." });
    const name = CANDIDATES.map((c, i) => (i === 0 ? { ...c, name: "n".repeat(61) } : c));
    expect(parseBendInput({ ...CHECKOUT, candidates: name })).toEqual({ ok: false, message: "candidates item 1: name must be 1 to 60 characters." });
    const family = CANDIDATES.map((c, i) => (i === 4 ? { ...c, family: "f".repeat(41) } : c));
    expect(parseBendInput({ ...CHECKOUT, candidates: family })).toEqual({ ok: false, message: "candidates item 5: family must be 1 to 40 characters." });
    const missing = CANDIDATES.map((c, i) => (i === 1 ? { name: c.name, looks: c.looks, family: c.family } : c));
    expect(parseBendInput({ ...CHECKOUT, candidates: missing })).toEqual({ ok: false, message: "candidates item 2: why must be 1 to 160 characters." });
  });

  it("is a bend_brief tool input with a short description", async () => {
    const { repos } = makeDeps();
    const res = await createBendBriefTool(() => ({ repos }))({ ...CHECKOUT, candidates: CANDIDATES.slice(0, 2) }, undefined);
    expect(res.isError).toBe(true);
  });
});

describe("candidate-led bends", () => {
  const result = bendBrief({ ...CHECKOUT, candidates: CANDIDATES });

  it("leads 6 directions with candidates and adds 2 challengers at count 8", () => {
    expect(result.directions).toHaveLength(8);
    expect(result.directions.filter((d) => d.source === "candidate")).toHaveLength(6);
    expect(result.directions.filter((d) => d.source === "challenger")).toHaveLength(2);
  });

  it("spreads leads across families first and never lets one family lead 3", () => {
    const familyOf = (set: Candidate[], name: string | undefined) => set.find((c) => c.name === name)!.family;
    const counts = (set: Candidate[], r: ReturnType<typeof bendBrief>) => {
      const m = new Map<string, number>();
      for (const d of r.directions.filter((x) => x.source === "candidate")) {
        const f = familyOf(set, d.ingredients.object);
        m.set(f, (m.get(f) ?? 0) + 1);
      }
      return m;
    };
    // 6 families: one each, no second needed.
    expect([...counts(CANDIDATES, result).values()].every((n) => n === 1)).toBe(true);
    // 8 candidates over 4 families: 6 lead (every family once, then two seconds), 2 challengers.
    const four = bendBrief({ ...CHECKOUT, candidates: FOUR_FAMILIES });
    expect(four.directions.filter((d) => d.source === "candidate")).toHaveLength(6);
    expect(four.directions.filter((d) => d.source === "challenger")).toHaveLength(2);
    const fourCounts = counts(FOUR_FAMILIES, four);
    expect(fourCounts.size).toBe(4);
    expect(Math.max(...fourCounts.values())).toBeLessThanOrEqual(2);
    // The first 4 candidate-led directions cover 4 different families.
    const firstFour = four.directions.slice(0, 4).map((d) => familyOf(FOUR_FAMILIES, d.ingredients.object));
    expect(new Set(firstFour).size).toBe(4);
    expect(four.diversity.pairsBelow4).toEqual([]);
    // 3 families: still at least 5 lead, none 3 times.
    const three = bendBrief({ ...CHECKOUT, candidates: THREE_FAMILIES });
    expect(three.directions.filter((d) => d.source === "candidate").length).toBeGreaterThanOrEqual(5);
    expect(Math.max(...counts(THREE_FAMILIES, three).values())).toBeLessThanOrEqual(2);
    expect(three.directions).toHaveLength(8);
    expect(three.diversity.pairsBelow4).toEqual([]);
    // One family only: at most 2 lead, the rest are challengers.
    const one = bendBrief({ ...CHECKOUT, candidates: CANDIDATES.map((c) => ({ ...c, family: "print" })) });
    expect(one.directions.filter((d) => d.source === "candidate")).toHaveLength(2);
    expect(one.directions).toHaveLength(8);
  });

  it("uses the candidate as the lead ingredient, why and looks", () => {
    for (const d of result.directions.filter((x) => x.source === "candidate")) {
      const c = CANDIDATES.find((x) => x.name === d.ingredients.object)!;
      expect(c).toBeDefined();
      expect(d.moves[0]).toBe("transplant");
      expect(d.title.toLowerCase()).toContain(c.name.toLowerCase().split(" ")[0]!);
      expect(d.searchQuery.toLowerCase()).toContain(c.name.toLowerCase());
      expect(d.artQueries[0]!.toLowerCase()).toContain(c.name.toLowerCase());
      expect(d.spec.whyItFits).toBe(`${c.why}.`);
      expect(d.spec.imagery).toBe(`${c.looks}.`);
    }
  });

  it("keeps ids stable for the same call and moves them when candidates change", () => {
    const again = bendBrief({ ...CHECKOUT, candidates: CANDIDATES });
    expect(again.directions.map((d) => d.id)).toEqual(result.directions.map((d) => d.id));
    expect(again).toEqual(result);
    const changed = bendBrief({ ...CHECKOUT, candidates: CANDIDATES.map((c, i) => (i === 0 ? { ...c, name: "Hejaz railway timetable" } : c)) });
    expect(changed.directions.map((d) => d.id)).not.toEqual(result.directions.map((d) => d.id));
    const plain = bendBrief(CHECKOUT);
    const plainIds = new Set(plain.directions.map((d) => d.id));
    expect(result.directions.some((d) => plainIds.has(d.id))).toBe(false);
  });

  it("keeps at least one challenger from count 3 and fills slots with challengers when families run out", () => {
    for (const count of [3, 4, 5, 6, 7]) {
      const r = bendBrief({ ...CHECKOUT, count, candidates: CANDIDATES });
      expect(r.directions).toHaveLength(count);
      expect(r.directions.filter((d) => d.source === "challenger").length).toBeGreaterThanOrEqual(1);
    }
    const two = bendBrief({ ...CHECKOUT, count: 2, candidates: CANDIDATES });
    expect(two.directions.map((d) => d.source)).toEqual(["candidate", "candidate"]);
  });

  it("applies the transaction must-keeps to candidates too: no total or main button reskin", () => {
    for (const d of result.directions) expect(["total", "cta"]).not.toContain(d.mechanic.element);
  });

  it("shows source and language in the text output", () => {
    const text = formatDirections(result);
    for (const d of result.directions) expect(text).toContain(`Source: ${d.source}. Language: type ${d.language.typeVoice}, color ${d.language.colorStrategy}`);
    expect(text).toContain("Diversity: every pair differs on at least");
    expect(text).not.toContain(EM);
  });
});

describe("language", () => {
  const bends = PROBES.flatMap((p) => [bendBrief(p), bendBrief({ ...p, candidates: CANDIDATES })]);

  it("marks list-only bends with source lists", () => {
    for (const p of PROBES) for (const d of bendBrief(p).directions) expect(d.source).toBe("lists");
  });

  it("gives every direction a valid language with typeVoice equal to the spec", () => {
    for (const b of bends) {
      for (const d of b.directions) {
        for (const axis of LANGUAGE_AXES) expect(LANGUAGE_VALUES[axis] as readonly string[]).toContain(d.language[axis]);
        expect(d.language.typeVoice).toBe(d.spec.typeVoice);
        expect(parseLanguage(d.language)).toEqual(d.language);
      }
    }
  });

  it("keeps every pair at least 4 axes apart, with no shared type voice and color strategy, for the probe briefs", () => {
    for (const p of PROBES) {
      for (const w of [1, 2, 3, 4, 5] as const) {
        for (const candidates of [undefined, CANDIDATES]) {
          const r = bendBrief({ ...p, wildness: w, ...(candidates ? { candidates } : {}) });
          const label = `${p.brief} w${w} ${candidates ? "candidates" : "lists"}`;
          expect(r.diversity.minAxesApart, label).toBeGreaterThanOrEqual(4);
          expect(r.diversity.pairsBelow4, label).toEqual([]);
          const ds = r.directions;
          for (let i = 0; i < ds.length; i++) {
            for (let j = i + 1; j < ds.length; j++) {
              const a = ds[i]!.language;
              const b = ds[j]!.language;
              expect(axesApart(a, b), label).toBeGreaterThanOrEqual(4);
              expect(a.typeVoice === b.typeVoice && a.colorStrategy === b.colorStrategy, label).toBe(false);
            }
          }
        }
      }
    }
  });

  it("reports pairs below 4 honestly", () => {
    const r = bendBrief({ ...CHECKOUT, count: 1 });
    expect(r.diversity).toEqual({ minAxesApart: 7, pairsBelow4: [] });
  });

  it("holds operate pages to calm motion and working compositions", () => {
    expect(isOperatePage(PROBES[0]!.brief, PROBES[0]!.pages!)).toBe(true);
    expect(isOperatePage(CHECKOUT.brief, CHECKOUT.pages!)).toBe(true);
    expect(isOperatePage(PROBES[1]!.brief, PROBES[1]!.pages!)).toBe(false);
    expect(isOperatePage(PROBES[2]!.brief, PROBES[2]!.pages!)).toBe(false);
    for (const p of [PROBES[0]!, CHECKOUT]) {
      for (const r of [bendBrief(p), bendBrief({ ...p, candidates: CANDIDATES })]) {
        for (const d of r.directions) {
          expect(["still", "snap", "glide"]).toContain(d.language.motion);
          expect(["grid", "list-first", "card-first"]).toContain(d.language.composition);
        }
      }
    }
  });

  it("keeps spec lines short, plain and in step with the language", () => {
    for (const b of bends) {
      for (const d of b.directions) {
        const s = d.spec;
        // Typography can run longer on Arabic briefs (the Arabic face note), as before V4.1.
        for (const line of [s.color, s.motion, s.texture, s.density, s.iconography]) {
          expect(words(line).length, line).toBeLessThanOrEqual(30);
          expect(line).toMatch(/^[A-Z0-9]/);
          expect(line).not.toContain(EM);
        }
        expect(s.motion).toMatch(/reduced motion/);
        if (d.language.motion === "still") expect(s.motion).toMatch(/no decorative motion|nothing moves|no motion|still/i);
        if (d.ingredients.material) expect(s.texture).toContain("text sits on solid panels, never on the texture");
      }
    }
  });

  it("only appends languages when count grows (list bends)", () => {
    const six = bendBrief({ ...CHECKOUT, count: 6 });
    const eight = bendBrief({ ...CHECKOUT, count: 8 });
    expect(eight.directions.slice(0, 6).map((d) => [d.id, d.language])).toEqual(six.directions.map((d) => [d.id, d.language]));
  });
});

describe("saving language and source", () => {
  it("keeps language and source in the saved detail and reads old rows without them", async () => {
    const r = bendBrief({ ...CHECKOUT, candidates: CANDIDATES });
    const d = r.directions[0]!;
    const detail = directionDetail(d, r.wildness, r.brief);
    expect(detail.language).toEqual(d.language);
    expect(detail.source).toBe("candidate");
    expect(parseDirectionDetail(JSON.parse(JSON.stringify(detail)))?.language).toEqual(d.language);
    expect(parseDirectionDetail(detail)?.source).toBe("candidate");
    expect(cleanDetail(detail)?.language).toEqual(d.language);
    expect(detail.mechanic).toEqual(d.mechanic);
    expect(parseDirectionDetail(JSON.parse(JSON.stringify(detail)))?.mechanic).toEqual(d.mechanic);
    expect(parseDirectionDetail({ ...detail, mechanic: { element: "header" } })).not.toHaveProperty("mechanic");
    const old = parseDirectionDetail({ platform: "mobile", twist: "x" });
    expect(old).toEqual({ platform: "mobile", twist: "x" });
    expect(old?.language).toBeUndefined();
    expect(old?.source).toBeUndefined();
    expect(parseDirectionDetail({ ...detail, language: { ...d.language, motion: "wobbly" }, source: "robot" })).not.toHaveProperty("language");

    const { repos } = makeDeps();
    const { id } = await seedCanvas(repos, ALICE);
    const res = await createBendBriefTool(() => ({ repos }))({ ...CHECKOUT, candidates: CANDIDATES, canvasId: id }, ALICE);
    expect(res.isError).toBeFalsy();
    const saved = await repos.directions.listForCanvas(id);
    expect(saved).toHaveLength(8);
    for (const row of saved) {
      expect(row.detail?.language).toBeDefined();
      expect(["candidate", "challenger"]).toContain(row.detail?.source);
      expect(row.detail?.mechanic?.element).toBeTruthy();
      expect(row.detail?.mechanic?.how).toBeTruthy();
    }
  });
});
