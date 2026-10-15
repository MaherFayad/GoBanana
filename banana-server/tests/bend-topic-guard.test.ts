import { describe, expect, it } from "vitest";
import { bendBrief, laneTexts, LISTS } from "@/lib/bend";
import { briefTopic, TOPIC_STOP } from "@/lib/bend/queries";
import { artQueries } from "@/lib/bend/spec";
import { artBareNoun, artRequests, artWords, planRequests } from "@/lib/sources/plan";
import { dropShare, laneDropLine, wastefulLanes } from "@/lib/sources/quality";

/** The live connector test brief (plan Appendix C, 2026-10-13). */
const APPENDIX_C = "eSIM plan picker for a GCC travel app: pick a destination data plan, compare GB and days, buy";

describe("P0-16 topic guard", () => {
  it("replays the Appendix C brief: every brief lane names eSIM or the data plan", () => {
    const r = bendBrief({ brief: APPENDIX_C, wildness: 3, count: 3, platform: "mobile", mustKeep: ["clear price", "one primary action"] });
    expect(r.directions).toHaveLength(3);
    for (const d of r.directions) {
      const lanes = laneTexts(APPENDIX_C, d.searchQuery, [], d.id, { platform: d.platform, styleWords: d.spec.styleWords, mechanic: d.mechanic.element });
      expect(lanes.topic).toBe("esim plan");
      const ui = planRequests({ ...lanes, art: d.artQueries }, undefined, { zone: "ui" });
      expect(ui.length).toBeGreaterThan(3);
      for (const req of ui) {
        // The bridge is the idea lane: its titles must name the idea, so it carries the idea, not the brief.
        if (req.lane === "bridge") continue;
        expect(req.query, `${req.lane} ${req.site}`).toMatch(/\besim\b|\bdata plan\b/);
      }
      // The direction's own queries that are about the page carry it too (the idea lanes carry the idea).
      expect(d.searchQueries[0]).toMatch(/^esim plan /);
    }
  });

  it("never makes a lane topic a single generic word", () => {
    const briefs = [
      APPENDIX_C,
      "plan picker",
      "date picker screen",
      "list screen for a todo app",
      "card form",
      "checkout form for a bakery",
      "flight checkout for a GCC OTA",
      "coffee shop landing page",
      "banking onboarding",
      "fitness app empty state",
      "logistics fleet management dashboard",
      "poster for a jazz festival",
      "VPN server picker app",
      "settings screen",
    ];
    for (const brief of briefs) {
      const topic = briefTopic(brief);
      const ws = topic.split(" ").filter(Boolean);
      if (ws.length === 1) expect(TOPIC_STOP.has(ws[0]!), `${brief}: ${topic}`).toBe(false);
      for (const w of ws) expect(TOPIC_STOP.has(w), `${brief}: ${topic}`).toBe(false);
      const lanes = laneTexts(brief, "x", [], "bd-1");
      expect(lanes.topic ?? "", brief).toBe(topic);
    }
    expect(briefTopic(APPENDIX_C)).toBe("esim plan");
    expect(briefTopic("flight checkout for a GCC OTA")).toBe("flight checkout");
    expect(briefTopic("eSIM data plan picker for travelers")).toBe("esim data plan");
    expect(briefTopic("eSIM data plan picker app for travelers")).toBe("esim plan");
    expect(briefTopic("logistics fleet management dashboard")).toBe("fleet management");
  });
});

describe("P0-16 concrete art queries", () => {
  it("uses the concrete noun with at most one medium word, never a stacked suffix", () => {
    for (const brief of [APPENDIX_C, "flight checkout screen", "coffee shop landing page"]) {
      for (const wildness of [1, 2, 3, 4, 5] as const) {
        for (const d of bendBrief({ brief, wildness, count: 8 }).directions) {
          for (const q of d.artQueries) {
            expect(q).not.toMatch(/close-up|graphic print/i);
            expect(q).not.toMatch(/^oversized /i);
          }
        }
      }
    }
    const ruler = LISTS.elements.find((e) => e.key === "ruler ticks")!;
    // Live 2026-10-15: "ruler ticks" got insect ticks, "measuring ruler" got 8 real rulers.
    expect(artQueries(["scale"], { scale: ruler }, "scale", LISTS.moods[0]!)).toEqual(["measuring ruler"]);
    const stripes = LISTS.elements.find((e) => e.key === "stripes")!;
    expect(artQueries(["scale"], { scale: stripes }, "scale", LISTS.moods[0]!)).toEqual(["stripes graphic"]);
  });

  it("cuts the stacked suffix older directions saved, and retries a thin answer with the bare noun", () => {
    expect(artWords("oversized ruler ticks graphic print close-up")).toBe("ruler ticks");
    expect(artWords("garment care label design close-up")).toBe("garment care label");
    expect(artWords("oversized type")).toBe("oversized type");
    expect(artBareNoun("limestone texture")).toBe("limestone");
    expect(artBareNoun("synthwave 1984 poster")).toBe("synthwave 1984");
    expect(artBareNoun("ruler ticks")).toBeNull();
    expect(artBareNoun("texture")).toBeNull();
    const [pin, be] = artRequests(["limestone texture"]);
    expect(pin!.fallback).toMatch(/^limestone -/);
    expect(be!.fallback).toMatch(/^limestone -/);
    expect(artRequests(["oversized ruler ticks graphic print close-up"])[0]!.query).toMatch(/^ruler ticks -/);
  });
});

describe("P0-16 lane waste log", () => {
  it("logs dropped over returned per request", () => {
    expect(dropShare({ dropped: 7, kept: 3 })).toBe(0.7);
    expect(dropShare({ dropped: 0, kept: 0 })).toBe(0);
    expect(laneDropLine({ lane: "taste", site: "dribbble", query: "minimal esim plan card ui design -template -kit", dropped: 9, kept: 1 })).toBe(
      "[lane-drops] taste dribbble 9/10 dropped: minimal esim plan card ui design",
    );
  });

  it("flags a lane that drops 70% or more twice in a row", () => {
    const row = (dropped: number, kept: number, query = "plan picker app ui") => ({ lane: "fidelity", site: "dribbble", query, dropped, kept });
    expect(wastefulLanes([row(8, 2), row(9, 1)])).toEqual(["fidelity dribbble plan picker app ui"]);
    expect(wastefulLanes([row(8, 2), row(1, 9), row(8, 2)])).toEqual([]);
    expect(wastefulLanes([row(8, 2), row(9, 1, "other words")])).toEqual([]);
  });
});
