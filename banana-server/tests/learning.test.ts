/**
 * Search learning (lib/learning), pure: term keys, creator affinity, rewrite arms, the seeded
 * arm picker with its k-anonymity threshold and GLOBAL_LEARNING switch, and bad-rating hints.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/lib/bend/prng";
import {
  agentArm,
  builtInArms,
  globalLearningOn,
  INSPIRATION_DEFAULT,
  K_ANON,
  pickArm,
  planLane,
  planWithArms,
  sampleBeta,
  usableCounts,
  type ArmStat,
} from "@/lib/learning/arms";
import { nudgeByCreator, parseCreator, preferredCreators } from "@/lib/learning/creator";
import { badHint } from "@/lib/learning/hints";
import { queryWords, termKey } from "@/lib/learning/terms";
import { buildSourceQuery, UI_NEG, type LaneTexts } from "@/lib/sources";

const LANES: LaneTexts = {
  inspiration: "oversized film frames",
  taste: "big typography saudi fintech card ui design",
  fidelity: "saudi fintech app ui",
  fidelityCore: "fintech app ui",
  hero: "minimal fintech app single screen",
};
const VARIANTS = { tasteApp: "big typography saudi fintech app card ui", tasteCore: "big typography fintech card ui design" };

const stat = (arm: string, over: Partial<ArmStat> = {}, tk = "inspiration|oversized film frames"): ArmStat => ({
  termKey: tk,
  arm,
  great: 0,
  bad: 0,
  users: 0,
  ownGreat: 0,
  ownBad: 0,
  ...over,
});

describe("term keys", () => {
  it("normalizes lane words: lowercase, no negatives, no site operators, no quotes or OR", () => {
    expect(termKey("inspiration", "  Oversized   Film Frames ")).toBe("inspiration|oversized film frames");
    expect(termKey("fidelity", `Saudi Fintech app ui ${UI_NEG} site:dribbble.com/shots`)).toBe("fidelity|saudi fintech app ui");
    expect(queryWords('"film strip" OR (macro) -stock site:pinterest.com/pin')).toBe("film strip macro");
    expect(termKey("taste", "x")).not.toBe(termKey("hero", "x"));
  });
});

describe("creator affinity", () => {
  it("parses creators from Dribbble and Behance titles", () => {
    expect(parseCreator("Fintech App by Gleb Kuznetsov✈ on Dribbble")).toBe("gleb kuznetsov");
    expect(parseCreator("Banking app by Jane Doe for Milkinside on Dribbble")).toBe("jane doe");
    expect(parseCreator("Inspired by nature: weather app by Ana Li on Dribbble")).toBe("ana li");
    expect(parseCreator("Brand identity by Studio Nord on Behance")).toBe("studio nord");
    expect(parseCreator("Coffee packaging by Mo Saleh :: Behance")).toBe("mo saleh");
    expect(parseCreator("Coffee packaging :: Behance")).toBeNull();
    expect(parseCreator("Pin by someone")).toBeNull();
    expect(parseCreator(undefined)).toBeNull();
  });

  it("prefers a creator after 2 great items, by their latest rating", () => {
    const rows = [
      { itemKey: "dribbble:3", verdict: "great" as const, creator: "ana li" },
      { itemKey: "dribbble:1", verdict: "great" as const, creator: "jane doe" },
      { itemKey: "dribbble:2", verdict: "great" as const, creator: "jane doe" },
      // Older rating of the same item: the newer verdict wins.
      { itemKey: "dribbble:3", verdict: "bad" as const, creator: "ana li" },
      { itemKey: "dribbble:4", verdict: "great" as const, creator: "ana li" },
      { itemKey: "dribbble:5", verdict: "great" as const, creator: "solo" },
    ];
    expect(preferredCreators(rows)).toEqual(["ana li", "jane doe"]);
    // The same item rated great twice is still one item.
    expect(preferredCreators([rows[1]!, rows[1]!])).toEqual([]);
    // Bad latest rating cancels the earlier great.
    expect(preferredCreators([{ ...rows[1]!, verdict: "bad" }, rows[1]!, rows[2]!])).toEqual([]);
  });

  it("nudges a preferred creator up a few places, stable for everything else", () => {
    const refs = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, title: i === 7 ? "Card by Jane Doe on Dribbble" : `Shot ${i}` }));
    expect(nudgeByCreator(refs, ["jane doe"]).map((r) => r.id)).toEqual(["r0", "r1", "r7", "r2", "r3", "r4", "r5", "r6", "r8", "r9"]);
    expect(nudgeByCreator(refs, []).map((r) => r.id)).toEqual(refs.map((r) => r.id));
    expect(nudgeByCreator(refs, ["nobody"]).map((r) => r.id)).toEqual(refs.map((r) => r.id));
  });
});

describe("rewrite arms", () => {
  it("lists built-in arms per lane, default first", () => {
    expect(builtInArms("inspiration", LANES)).toEqual([
      INSPIRATION_DEFAULT,
      "raw@behance",
      "graphic design@pinterest+behance",
      "poster@pinterest+behance",
    ]);
    expect(builtInArms("fidelity", LANES)).toEqual(["default", "core"]);
    expect(builtInArms("fidelity", { ...LANES, fidelityCore: undefined })).toEqual(["default"]);
    expect(builtInArms("taste", LANES, VARIANTS)).toEqual(["default", "app", "core"]);
    expect(builtInArms("taste", LANES)).toEqual(["default"]);
    expect(builtInArms("hero", LANES)).toEqual(["default"]);
    expect(agentArm("35mm Film strip -stock site:pinterest.com macro")).toBe("agent:35mm film strip macro");
  });

  it("applies arms to the plan", () => {
    const show = (arms: Parameters<typeof planWithArms>[1]) =>
      planWithArms(LANES, arms, undefined, VARIANTS).map((r) => `${r.lane}:${r.site}:${r.page ?? 1}:${r.query}${r.fallback ? ` > ${r.fallback}` : ""}`);
    // Default arms: the base plan.
    expect(show({})).toEqual([
      "inspiration:pinterest:1:oversized film frames",
      `fidelity:dribbble:1:saudi fintech app ui ${UI_NEG} > fintech app ui ${UI_NEG}`,
      `taste:dribbble:1:big typography saudi fintech card ui design ${UI_NEG}`,
      "inspiration:behance:1:oversized film frames",
      "hero:dribbble:1:minimal fintech app single screen",
      `fidelity:pinterest:1:saudi fintech app ui ${UI_NEG} > fintech app ui ${UI_NEG}`,
    ]);
    const b = show({ inspiration: "raw@behance", fidelity: "core", taste: "app" });
    expect(b[0]).toBe("inspiration:behance:1:oversized film frames");
    expect(b[3]).toBe("inspiration:behance:2:oversized film frames");
    expect(b[1]).toBe(`fidelity:dribbble:1:fintech app ui ${UI_NEG}`);
    expect(b[2]).toBe(`taste:dribbble:1:big typography saudi fintech app card ui ${UI_NEG}`);
    expect(show({ inspiration: "poster@pinterest+behance" })[0]).toBe("inspiration:pinterest:1:oversized film frames poster");
    expect(show({ inspiration: "graphic design@pinterest+behance" })[3]).toBe("inspiration:behance:1:oversized film frames graphic design");
    expect(show({ taste: "core" })[2]).toBe(`taste:dribbble:1:big typography fintech card ui design ${UI_NEG}`);
    expect(show({ inspiration: "agent:35mm film strip macro", hero: "agent:one floating phone" })).toEqual(
      expect.arrayContaining(["inspiration:pinterest:1:35mm film strip macro", "hero:dribbble:1:one floating phone"]),
    );
    // Unknown arms fall back to the default wording.
    expect(show({ taste: "nonsense" })[2]).toBe(`taste:dribbble:1:big typography saudi fintech card ui design ${UI_NEG}`);
  });

  it("plans one lane with the agent's words", () => {
    expect(planLane("inspiration", "35mm film strip macro").map((r) => buildSourceQuery(r.query, r.site))).toEqual([
      "35mm film strip macro site:pinterest.com/pin",
      "35mm film strip macro site:behance.net/gallery",
    ]);
    expect(planLane("taste", "editorial checkout ui").map((r) => buildSourceQuery(r.query, r.site))).toEqual([
      `editorial checkout ui ${UI_NEG} site:dribbble.com/shots`,
    ]);
    expect(planLane("fidelity", "fintech wallet app ui").map((r) => r.site)).toEqual(["dribbble", "pinterest"]);
    expect(planLane("fidelity", "x", ["dribbble"]).map((r) => r.site)).toEqual(["dribbble"]);
  });
});

describe("arm picker", () => {
  const candidates = builtInArms("inspiration", LANES);
  const TK = "inspiration|oversized film frames";
  const pick = (stats: ArmStat[], seed = "u1|2026-10-15", global = true) => pickArm({ termKey: TK, candidates, stats, global, seed });

  it("uses the default for a term with no data", () => {
    expect(pick([])).toEqual({ arm: INSPIRATION_DEFAULT, learned: false });
    expect(pick([stat("poster@pinterest+behance", { great: 9, users: 9 }, "inspiration|something else")])).toEqual({
      arm: INSPIRATION_DEFAULT,
      learned: false,
    });
  });

  it("is deterministic for a seed", () => {
    const stats = [stat("agent:35mm film strip macro", { great: 3, bad: 1, users: 4 }), stat(INSPIRATION_DEFAULT, { great: 2, bad: 2, users: 4 })];
    for (const seed of ["a", "b", "c", "u1|2026-10-15"]) expect(pick(stats, seed)).toEqual(pick(stats, seed));
    const picks = new Set(Array.from({ length: 40 }, (_, i) => pick(stats, `s${i}`).arm));
    expect(picks.size).toBeGreaterThan(1); // it explores
  });

  it("lets an arm reach other users only after K_ANON distinct users rated it", () => {
    expect(K_ANON).toBe(3);
    const strong = (users: number) => [stat("agent:35mm film strip macro", { great: users, users }), stat(INSPIRATION_DEFAULT, { bad: users, users })];
    // Two users: nobody else sees it, whatever the seed.
    for (let i = 0; i < 50; i++) expect(pick(strong(2), `s${i}`).arm).toBe(INSPIRATION_DEFAULT);
    // Twenty users: it now wins for others almost always.
    const wins = Array.from({ length: 100 }, (_, i) => pick(strong(20), `s${i}`).arm).filter((a) => a === "agent:35mm film strip macro").length;
    expect(wins).toBeGreaterThan(80);
    expect(usableCounts(stat("x", { great: 2, users: 2 }), { global: true })).toBeNull();
    expect(usableCounts(stat("x", { great: 3, users: 3 }), { global: true })).toEqual({ great: 3, bad: 0 });
  });

  it("applies a rater's own ratings to them below the threshold", () => {
    const own = [stat("agent:35mm film strip macro", { great: 1, users: 1, ownGreat: 12 }), stat(INSPIRATION_DEFAULT, { bad: 1, users: 1, ownBad: 8 })];
    const wins = Array.from({ length: 100 }, (_, i) => pick(own, `s${i}`)).filter((p) => p.arm === "agent:35mm film strip macro" && p.learned).length;
    expect(wins).toBeGreaterThan(80);
  });

  it("with GLOBAL_LEARNING off, only the user's own ratings count", () => {
    const crowd = [stat("agent:35mm film strip macro", { great: 50, users: 50 }), stat(INSPIRATION_DEFAULT, { bad: 50, users: 50 })];
    for (let i = 0; i < 30; i++) expect(pick(crowd, `s${i}`, false).arm).toBe(INSPIRATION_DEFAULT);
    const mine = crowd.map((s) => ({ ...s, ownGreat: s.great > 0 ? 10 : 0, ownBad: s.bad > 0 ? 10 : 0 }));
    expect(Array.from({ length: 50 }, (_, i) => pick(mine, `s${i}`, false).arm).filter((a) => a !== INSPIRATION_DEFAULT).length).toBeGreaterThan(40);
    expect(globalLearningOn(undefined)).toBe(true);
    expect(globalLearningOn("on")).toBe(true);
    expect(globalLearningOn(" OFF ")).toBe(false);
  });

  it("ignores stats for arms the lane does not have", () => {
    const fidelity = pickArm({
      termKey: "fidelity|flight app ui",
      candidates: ["default"],
      stats: [stat("core", { great: 40, users: 40 }, "fidelity|flight app ui")],
      global: true,
      seed: "s",
    });
    expect(fidelity).toEqual({ arm: "default", learned: false });
  });

  it("samples Beta with the right mean", () => {
    const rng = mulberry32(7);
    const n = 4000;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += sampleBeta(6, 2, rng);
    expect(sum / n).toBeGreaterThan(0.72);
    expect(sum / n).toBeLessThan(0.78);
  });
});

describe("hints for bad ratings", () => {
  it("tells the agent how to re-search the lane", () => {
    expect(badHint("inspiration", ["off_topic"])).toContain('lane "inspiration"');
    expect(badHint("inspiration", ["off_topic"])).toContain("describe the visual, not the object");
    expect(badHint("inspiration", ["stock_or_shop"])).toContain("poster");
    expect(badHint("taste", ["not_ui"])).toContain("ui design");
    expect(badHint("hero", ["cluttered"])).toContain("single screen");
    expect(badHint("fidelity", ["duplicate"])).toContain("blocked");
    expect(badHint(null, [])).toContain("will not come back");
    for (const h of [badHint("taste", []), badHint("fidelity", ["low_craft"]), badHint("locale", ["wrong_style"])]) {
      expect(h).not.toMatch(/[\u2014\u2013]/);
    }
  });
});
