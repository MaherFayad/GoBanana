import { describe, expect, it } from "vitest";
import { computeMetrics, formatMetrics, type BenchRun, type BenchReference } from "../bench/score.mjs";

const ref = (id: string, zone: "ui" | "art" = "ui"): BenchReference => ({
  id,
  zone,
  imageUrl: `https://cdn.dribbble.com/${id}.png`,
  sourceUrl: `https://dribbble.com/shots/${id}`,
});

const run: BenchRun = {
  run: "test",
  briefs: [
    {
      id: "a",
      brief: "eSIM plan picker",
      directions: [
        {
          id: "d1",
          title: "One",
          coherence: [],
          search: { credits: 8, queries: [], uiQueries: ["plan picker app ui", "x ui"], references: [ref("r1"), ref("r2"), ref("r3", "art")] },
        },
        {
          id: "d2",
          title: "Two",
          coherence: ["mechanic and pattern differ"],
          search: { credits: 6, queries: [], uiQueries: ["plan picker app ui", "y ui"], references: [ref("r4")] },
        },
      ],
    },
    {
      id: "b",
      brief: "coffee shop landing page",
      directions: [{ id: "d3", title: "Three", coherence: [], search: null }],
    },
  ],
};

describe("bench score", () => {
  it("computes the section 8 metrics from ratings", () => {
    const m = computeMetrics(run, {
      directions: {
        "a/d1": { relevance: 5, coherence: 4, wow: 3 },
        "a/d2": { relevance: 2, coherence: 2, wow: 5 },
        "b/d3": { relevance: 4, coherence: 3, wow: 4 },
      },
      references: { "a/d1/r1": "great", "a/d1/r2": "bad", "a/d1/r3": "good", "a/d2/r4": "good" },
    });
    expect(m.briefRelevance).toMatchObject({ onBrief: 2, rated: 3, percent: 66.7 });
    expect(m.specCoherence).toMatchObject({ failures: 1, checked: 3, ownerMedian: 3 });
    // "plan picker app ui" is sent by both directions of brief a.
    expect(m.queryOverlap).toMatchObject({ sharedQueries: 1, briefsWithOverlap: 1, searchedBriefs: 1 });
    // Art references are not part of precision: r1 great, r2 bad, r4 good.
    expect(m.referencePrecision).toMatchObject({ goodOrGreat: 2, rated: 3, percent: 66.7 });
    expect(m.wow.median).toBe(4);
    expect(m.cost).toMatchObject({ creditsPerBoard: 14, boards: 1, creditsPerSearch: 7, totalCredits: 14 });
    expect(formatMetrics(m)).toContain("| Query overlap | 1 shared UI queries");
  });

  it("reports n/a without ratings or without checkCoherence", () => {
    const bare: BenchRun = { run: "dry", dry: true, briefs: [{ id: "a", brief: "x", directions: [{ id: "d", title: "D", coherence: null, search: null }] }] };
    const m = computeMetrics(bare);
    expect(m.briefRelevance.percent).toBeNull();
    expect(m.specCoherence.failures).toBeNull();
    expect(m.queryOverlap.sharedQueries).toBeNull();
    expect(m.cost.creditsPerBoard).toBeNull();
    expect(formatMetrics(m)).toContain("checkCoherence not in the engine yet");
  });
});
