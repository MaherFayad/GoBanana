/**
 * Field report, 2026-10-12 (flight checkout board): the three directions' first searches came back
 * with the same generic flight shots, and a bridge lane re-search ("islamic pattern app") returned
 * nothing. Causes: the bridge, the only UI lane that differs between directions, was planned last
 * and cut; the re-search filtered titles by the old idea's head word ("windows").
 */
import { describe, expect, it, vi } from "vitest";
import { createSearchReferencesTool, directionLanes, type Direction, type SearchReferencesDeps } from "@/lib/mcp/tools/search_references";
import { createMemoryUsageStore } from "@/lib/quota";
import {
  DEFAULT_IMAGE_HOSTS,
  createWebSearchAdapter,
  parseAllowlist,
  planRequests,
  type FetchLike,
  type Reference,
} from "@/lib/sources";
import type { WebSearchResult } from "@/lib/sources/web-search";

const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);
const BOARD = "Mobile flight checkout for a GCC travel OTA: fare summary, travellers, add-ons, payment, VAT-inclusive SAR total, pay CTA. EN + AR/RTL.";
const BEND = "flight checkout screen for a GCC travel OTA";

const direction = (bendId: string, idea: string, art: string[]): Direction => ({
  id: `row-${bendId}`,
  bendId,
  canvasId: "c1",
  searchQuery: idea,
  brief: BEND,
  canvasBrief: BOARD,
  detail: { platform: "mobile", brief: BEND, artQueries: art } as never,
});

const DIRECTIONS = [
  direction("bd-j5oms091", "letterpress texture", ["letterpress texture", "oversized plus signs poster"]),
  direction("bd-ch6a270s", "vinyl record sleeve", ["vinyl record sleeve"]),
  direction("bd-sb7q8wn0", "rawashin windows", ["rawashin windows"]),
];

describe("direction searches carry each direction's own idea", () => {
  it("plans the bridge third in a both-zones search (after fidelity and art), so the cut keeps it", () => {
    const uiQueries = DIRECTIONS.map((d) => {
      const plan = planRequests(directionLanes(d, ["color"]), undefined, { zone: "both" });
      const bridge = plan.findIndex((r) => r.lane === "bridge");
      expect(bridge).toBe(2);
      expect(plan[bridge]!.query.startsWith(d.searchQuery)).toBe(true);
      return plan.filter((r) => r.lane !== "art").map((r) => r.query);
    });
    // The three directions no longer send the same UI requests.
    expect(new Set(uiQueries.map((q) => q.join("|"))).size).toBe(3);
  });

  it("filters bridge titles by the telling word, not a common one", () => {
    const plan = planRequests(directionLanes(DIRECTIONS[2]!, []), undefined, { zone: "ui" });
    expect(plan.find((r) => r.lane === "bridge")).toMatchObject({ titleWord: "rawashin" });
  });

  it("keeps the board's Arabic and right to left market when the bend brief was cut to the screen", () => {
    const lanes = directionLanes(DIRECTIONS[0]!, []);
    expect(lanes.locale).toBe("arabic flight app ui");
    expect(directionLanes({ ...DIRECTIONS[0]!, canvasBrief: "Flight checkout, English only" }, []).locale).toBeUndefined();
  });
});

describe("bridge lane re-search", () => {
  const titles = [
    "Islamic App Login & Signup UI | Quran App Authentication UI by Imran Jakir on Dribbble",
    "Islamic App Design by Muhammad Arif on Dribbble",
    "Halaqa - Brand & App Design for a Masjid Community Platform by Orix Creative on Dribbble",
    "Windows 11 UI Concept by Open T N on Dribbble",
  ];
  const page = {
    images: titles.map((title, i) => ({
      title,
      link: `https://dribbble.com/shots/2694562${i}-shot`,
      imageUrl: `https://cdn.dribbble.com/userupload/${i}.png`,
    })),
  };

  function deps(fetch: FetchLike): SearchReferencesDeps {
    return {
      adapter: createWebSearchAdapter({ apiKey: "k", fetch, allowlist }),
      usage: createMemoryUsageStore(),
      getPlan: async () => "free",
      getDirection: async () => DIRECTIONS[2]!,
      addToTray: async () => true,
      upgradeUrl: () => "https://example.test/pricing",
      now: () => new Date("2026-10-12T15:04:00Z"),
    };
  }

  it("a short query returns results filtered by its own words", async () => {
    const fetch = vi.fn<FetchLike>(async () => new Response(JSON.stringify(page), { status: 200 }));
    const tool = createSearchReferencesTool(deps(fetch));
    const res = await tool({ directionId: "bd-sb7q8wn0", lane: "bridge", query: "islamic pattern app" }, "u1");
    const out = res.structuredContent as { references: Reference[] };
    expect(out.references.map((r) => r.title)).toEqual([titles[0], titles[1]]);
    expect(String(JSON.parse(String(fetch.mock.calls[0]![1]!.body)).q)).toBe(
      "islamic pattern app -template -kit -free -wireframe site:dribbble.com/shots",
    );
  });
});

describe("bridge steering line", () => {
  const ui = (id: string, lane: Reference["lane"]): Reference => ({
    id,
    thumbUrl: `https://cdn.dribbble.com/${id}.png`,
    imageUrl: `https://cdn.dribbble.com/${id}.png`,
    sourceUrl: `https://dribbble.com/shots/${id}`,
    sourceSite: "dribbble.com",
    title: "Flight app UI",
    ...(lane ? { lane } : {}),
  });

  function tool(result: WebSearchResult) {
    return createSearchReferencesTool({
      adapter: { run: vi.fn(async () => result), runPlan: vi.fn(async () => result) },
      usage: createMemoryUsageStore(),
      getPlan: async () => "free",
      getDirection: async () => DIRECTIONS[2]!,
      addToTray: async () => true,
      upgradeUrl: () => "https://example.test/pricing",
    });
  }

  it("tells the agent when no UI shot named the idea, with a re-search that works", async () => {
    const res = await tool({ references: [ui("1", "fidelity"), ui("2", "taste")], ok: true })({ directionId: "bd-sb7q8wn0" }, "u1");
    const text = res.content.map((c) => c.text).join("\n");
    expect(text).toContain("No UI shot named this direction's idea (rawashin windows)");
    expect(text).toContain('lane "bridge" and query "rawashin pattern app"');
  });

  it("says nothing when the bridge found UI", async () => {
    const res = await tool({ references: [ui("1", "fidelity"), ui("2", "bridge")], ok: true })({ directionId: "bd-sb7q8wn0" }, "u1");
    expect(res.content.map((c) => c.text).join("\n")).not.toContain("No UI shot named");
  });
});
