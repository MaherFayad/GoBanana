import { describe, expect, it } from "vitest";
import { CardWorldsSchema, CARD_WORLDS } from "../jobs/r10-worlds.ts";
import { DomainClicheSchema } from "../jobs/r10-cliche.ts";
import { serverLayout } from "../lib/layout.ts";
import { applyOverlays, OVERLAY_KINDS, overlaysFrom } from "../lib/overlays.ts";
import { FitScoreSchema } from "../schema.ts";

const kinds = (m: Record<string, unknown[]>) => new Map(Object.entries(m));

describe("R10 overlays", () => {
  const ov = overlaysFrom(
    kinds({
      "domain-cliches": [
        { domainId: "telecom", look: "ring or arc gauges for data left", cardIds: ["saturn-rings", "gauge-dials"] },
        { domainId: "telecom", look: "dark dashboards with glowing numbers", cardIds: ["gauge-dials"] },
      ],
      "card-worlds": [{ id: "wool-felt", worlds: ["textile and stitch", "games and play"] }],
    }),
  );

  it("marks a cliche on the fit of its own domain only, with the first look that lists it", () => {
    const { records, counts } = applyOverlays(
      "fit",
      [
        { cardId: "saturn-rings", domainId: "telecom", score: 2, reason: "r" },
        { cardId: "saturn-rings", domainId: "food-delivery", score: 2, reason: "r" },
        { cardId: "gauge-dials", domainId: "telecom", score: 3, reason: "r" },
      ],
      ov,
    );
    expect(records).toEqual([
      { cardId: "saturn-rings", domainId: "telecom", score: 2, reason: "r", cliche: "ring or arc gauges for data left" },
      { cardId: "saturn-rings", domainId: "food-delivery", score: 2, reason: "r" },
      { cardId: "gauge-dials", domainId: "telecom", score: 3, reason: "r", cliche: "ring or arc gauges for data left" },
    ]);
    expect(counts.tagged).toBe(2);
    expect(records.every((r) => FitScoreSchema.safeParse(r).success)).toBe(true);
  });

  it("drops a stale cliche when the overlay no longer lists the card", () => {
    const { records } = applyOverlays("fit", [{ cardId: "x", domainId: "telecom", score: 2, reason: "r", cliche: "old" }], ov);
    expect(records).toEqual([{ cardId: "x", domainId: "telecom", score: 2, reason: "r" }]);
  });

  it("sets worlds on cards without counting them as style tags", () => {
    const { records, counts } = applyOverlays("cards", [{ id: "wool-felt", styles: ["illustrative-handmade"] }, { id: "other" }], ov);
    expect(records).toEqual([{ id: "wool-felt", styles: ["illustrative-handmade"], worlds: ["textile and stitch", "games and play"] }, { id: "other" }]);
    expect(counts.tagged).toBe(0);
  });

  it("keeps both overlay kinds out of the server layout", () => {
    expect(OVERLAY_KINDS).toEqual(expect.arrayContaining(["domain-cliches", "card-worlds"]));
    const layout = serverLayout(kinds({ "domain-cliches": [{ domainId: "telecom", look: "x", cardIds: [] }], "card-worlds": [{ id: "a", worlds: ["wood and woodwork"] }] }));
    expect(layout.skipped).toEqual(expect.arrayContaining(["domain-cliches", "card-worlds"]));
  });

  it("validates the job records", () => {
    expect(CardWorldsSchema.safeParse({ id: "a", worlds: [CARD_WORLDS[0]] }).success).toBe(true);
    expect(CardWorldsSchema.safeParse({ id: "a", worlds: ["not a world"] }).success).toBe(false);
    expect(CardWorldsSchema.safeParse({ id: "a", worlds: [CARD_WORLDS[0], CARD_WORLDS[0]] }).success).toBe(false);
    expect(DomainClicheSchema.safeParse({ domainId: "telecom", look: "ring gauges", cardIds: [] }).success).toBe(true);
  });
});
