import { describe, expect, it } from "vitest";
import { mergeCliches } from "../jobs/r10-cliche2.ts";
import { overlaysFrom, WIDE_CLICHE } from "../lib/overlays.ts";

describe("R11 second cliche pass merges into R10's marks", () => {
  const base = [
    { domainId: "telecom", look: "ring or arc gauges for data left", cardIds: ["saturn-rings"] },
    { domainId: "food", look: "bold brand-color header with white rounded cards", cardIds: ["flat-a"] },
  ];
  const mine = [
    { domainId: "telecom", look: "Ring or arc gauges for data left", cardIds: ["gauge-dials"] },
    { domainId: "telecom", look: "flat vector illustration", cardIds: ["flat-a"] },
  ];

  it("joins card ids of a look R10 already had and appends new looks", () => {
    const out = mergeCliches(base, mine);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ domainId: "telecom", look: "ring or arc gauges for data left", cardIds: ["gauge-dials", "saturn-rings"] });
    expect(out[2]).toEqual(mine[1]);
    // R10's other domains stay as they were.
    expect(out[1]).toEqual(base[1]);
  });

  it("gives the same result when run again over its own output", () => {
    const once = mergeCliches(base, mine);
    expect(mergeCliches(once, mine)).toEqual(once);
  });

  it("marks a card in a third of the domains or more in every domain", () => {
    const recs = ["a", "b", "c", "d", "e", "f"].map((d, i) => ({ domainId: d, look: "x", cardIds: i < 2 ? ["flat", "rare"].slice(0, 2 - i) : ["other"] }));
    const ov = overlaysFrom(new Map([["domain-cliches", recs]]));
    // flat: 2 of 6 domains (a third) -> everywhere; rare: 1 of 6 -> its own domain only.
    expect(ov.cliches.get("f")?.get("flat")).toBe(WIDE_CLICHE);
    expect(ov.cliches.get("a")?.get("flat")).toBe("x");
    expect(ov.cliches.get("f")?.has("rare")).toBe(false);
  });

  it("marks the card in that domain only", () => {
    const ov = overlaysFrom(new Map([["domain-cliches", mergeCliches(base, mine)]]));
    expect(ov.cliches.get("telecom")?.get("flat-a")).toBe("flat vector illustration");
    expect(ov.cliches.get("food")?.get("gauge-dials")).toBeUndefined();
  });
});
