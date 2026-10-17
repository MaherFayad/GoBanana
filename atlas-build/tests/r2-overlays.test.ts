import { describe, expect, it } from "vitest";
import { bucketOf, StyleTagSchema } from "../jobs/r2-styles.ts";
import { verdictOf } from "../jobs/r2-taste.ts";
import { serverLayout } from "../lib/layout.ts";
import { applyOverlays, overlaysFrom, recipeStyles } from "../lib/overlays.ts";
import { MechanicSchema } from "../schema.ts";

const kinds = (m: Record<string, unknown[]>) => new Map(Object.entries(m));

describe("R2 overlays", () => {
  it("sets style tags by id, keeps a record's own styles, and passes other kinds through", () => {
    const ov = overlaysFrom(kinds({ "style-tags": [{ id: "a", kind: "cards", styles: ["editorial-serif", "brutalist-raw"] }, { id: "b", kind: "cards", styles: [] }] }));
    const { records, counts } = applyOverlays("cards", [{ id: "a" }, { id: "b" }, { id: "c", styles: ["hero-numeral"] }], ov);
    // brutalist-raw was merged into retro-pixel-halftone (owner 2026-10-16).
    expect(records).toEqual([{ id: "a", styles: ["editorial-serif", "retro-pixel-halftone"] }, { id: "b" }, { id: "c", styles: ["hero-numeral"] }]);
    expect(counts).toEqual({ tagged: 1, rewritten: 0, dropped: 0 });
    expect(applyOverlays("lenses", [{ id: "a" }], ov).records).toEqual([{ id: "a" }]);
  });

  it("drops records judged drop, replaces rewrites, and drops a rewrite verdict with no rewrite", () => {
    const ov = overlaysFrom(
      kinds({
        "taste-verdicts": [
          { id: "gear", kind: "shaders", verdict: "drop" },
          { id: "wash", kind: "shaders", verdict: "rewrite" },
          { id: "band", kind: "shaders", verdict: "rewrite" },
          { id: "ok", kind: "shaders", verdict: "keep" },
        ],
        "shaders-rewrites": [{ id: "band", frag: "new", styles: ["dark-luminous"] }],
        "style-tags": [{ id: "ok", kind: "shaders", styles: ["glass-frosted"] }, { id: "band", kind: "shaders", styles: ["vivid-gradient"] }],
      }),
    );
    const { records, counts } = applyOverlays("shaders", [{ id: "gear" }, { id: "wash" }, { id: "band", frag: "old" }, { id: "ok" }], ov);
    expect(records).toEqual([{ id: "band", frag: "new", styles: ["dark-luminous"] }, { id: "ok", styles: ["glass-frosted"] }]);
    expect(counts).toEqual({ tagged: 1, rewritten: 1, dropped: 2 });
  });

  it("a rewrite the second look turns down leaves the record out", () => {
    const ov = overlaysFrom(
      kinds({
        "taste-verdicts": [{ id: "a", kind: "motion", verdict: "rewrite" }, { id: "b", kind: "motion", verdict: "rewrite" }, { id: "d", kind: "motion", verdict: "keep" }],
        "motion-rewrites": [{ id: "a", v: 2 }, { id: "b", v: 2 }, { id: "d", v: 2 }],
        "rewrite-verdicts": [{ id: "a", kind: "motion", verdict: "keep" }, { id: "b", kind: "motion", verdict: "rewrite" }, { id: "d", kind: "motion", verdict: "drop" }],
      }),
    );
    const { records, counts } = applyOverlays("motion", [{ id: "a", v: 1 }, { id: "b", v: 1 }, { id: "c", v: 1 }, { id: "d", v: 1 }], ov);
    // d was kept at 3 and its lift failed: the old record stays.
    expect(records).toEqual([{ id: "a", v: 2 }, { id: "c", v: 1 }, { id: "d", v: 1 }]);
    expect(counts).toEqual({ tagged: 0, rewritten: 1, dropped: 1 });
  });

  it("the server layout carries the overlays and skips the overlay kinds", () => {
    const layout = serverLayout(
      kinds({
        cards: [{ id: "sadu", kind: "tradition" }],
        "style-tags": [{ id: "sadu", kind: "cards", styles: ["gulf-arabic-first"] }],
        recipes: [{ key: { lane: "art", cardId: "sadu" }, query: "sadu weaving", source: "x", precision: 1, judged: 8, at: "2026-10-17" }],
      }),
    );
    expect(layout.skipped).toEqual(["style-tags"]);
    const text = [...layout.files.values()].join("\n");
    expect(text).toContain('"styles":["gulf-arabic-first"]');
    expect(layout.overlays).toEqual({ cards: { tagged: 1, rewritten: 0, dropped: 0 }, recipes: { tagged: 1, rewritten: 0, dropped: 0 } });
  });

  it("gives recipes their card's styles, their showcase style's, or their query words'", () => {
    const cards = new Map([["sadu", ["gulf-arabic-first"]]]);
    expect(recipeStyles({ key: { lane: "art", cardId: "sadu" }, query: "sadu weaving" }, cards)).toEqual(["gulf-arabic-first"]);
    expect(recipeStyles({ key: { lane: "baseline", style: "webgl" }, query: "x" }, cards)).toEqual(["webgl-3d-scene"]);
    expect(recipeStyles({ key: { lane: "deck" }, query: "big numbers pitch deck slide" }, cards)).toEqual(["hero-numeral"]);
    expect(recipeStyles({ key: { lane: "component" }, query: "checkout stepper app ui" }, cards)).toBeUndefined();
  });

  it("schemas take optional styles: known ids, at most two, no repeats", () => {
    const mech = { id: "progress-a", element: "progress", name: "Split flap", how: "Flaps flip.", buildability: 4, rtl: "Mirror.", a11y: "2.3.3 reduce.", pages: ["checkout"] };
    expect(MechanicSchema.safeParse(mech).success).toBe(true);
    expect(MechanicSchema.safeParse({ ...mech, styles: ["hero-numeral"] }).success).toBe(true);
    expect(MechanicSchema.safeParse({ ...mech, styles: ["hero-numeral", "hero-numeral"] }).success).toBe(false);
    expect(MechanicSchema.safeParse({ ...mech, styles: ["neon"] }).success).toBe(false);
    expect(MechanicSchema.safeParse({ ...mech, styles: ["hero-numeral", "glass-frosted", "dark-luminous"] }).success).toBe(false);
    expect(StyleTagSchema.safeParse({ id: "x", kind: "mechanics", styles: [] }).success).toBe(true);
  });

  it("the taste verdict rewrites literal records, keeps 3 and up, and follows the judge under 3", () => {
    expect(verdictOf({ advice: "keep", score: 4, literal: true })).toBe("rewrite");
    expect(verdictOf({ advice: "drop", score: 2, literal: true })).toBe("drop");
    expect(verdictOf({ advice: "rewrite", score: 3, literal: false })).toBe("keep");
    expect(verdictOf({ advice: "keep", score: 2, literal: false })).toBe("rewrite");
    expect(verdictOf({ advice: "drop", score: 1, literal: false })).toBe("drop");
  });

  it("buckets records by id, not by order", () => {
    expect(bucketOf("sadu-weaving", 20)).toBe(bucketOf("sadu-weaving", 20));
    const counts = new Array(4).fill(0);
    for (let i = 0; i < 400; i++) counts[bucketOf(`card-${i}`, 4)]++;
    for (const c of counts) expect(c).toBeGreaterThan(60);
  });
});
