/**
 * V4.3 art ladder: art references come from graphic systems before objects. Per ingredient the
 * art lane tries "{ingredient} identity system" (or signage system) on Behance, then graphic
 * design (or poster), pattern (or typography) and the raw words on Pinterest, falling through
 * only when a rung keeps fewer than 4 usable results, within the 8 request budget.
 */
import { describe, expect, it, vi } from "vitest";
import { bendBrief } from "@/lib/bend";
import { createSearchReferencesTool, directionLanes, type Direction, type SearchReferencesDeps } from "@/lib/mcp/tools/search_references";
import { createMemoryUsageStore } from "@/lib/quota";
import {
  DEFAULT_IMAGE_HOSTS,
  SERPER_MAX_IN_FLIGHT,
  SERPER_MAX_REQUESTS,
  artRequests,
  createWebSearchAdapter,
  isArtJunk,
  parseAllowlist,
  planRequests,
  type FetchLike,
  type LaneTexts,
  type Reference,
} from "@/lib/sources";
import { ART_RUNG_MIN, artIngredient, buildArtLadder, isLensQuery } from "@/lib/sources/art-ladder";
import { laneTexts } from "@/lib/bend/queries";

const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);
const BRIEF = "Flight checkout for a Saudi travel app";

/** The plain words of a Serper query: no negatives, no site operator. */
const wordsOf = (q: string) => q.replace(/\ssite:\S+$/, "").replace(/(^|\s)-\S+/g, "").trim();
const siteOf = (q: string) => (q.includes("site:behance.net") ? "behance" : q.includes("site:pinterest.com") ? "pinterest" : "dribbble");

let serial = 100_000_000;
/** Good item pages for one request: Behance galleries or Pinterest pins with design titles. */
function items(site: string, n: number, title: string) {
  return Array.from({ length: n }, () => {
    const id = serial++;
    return site === "behance"
      ? { title: `${title} ${id}`, link: `https://www.behance.net/gallery/${id}/work`, imageUrl: `https://mir-s3-cdn-cf.behance.net/project_modules/${id}.jpg`, imageWidth: 1400, imageHeight: 1000 }
      : site === "pinterest"
        ? { title: `${title} ${id}`, link: `https://www.pinterest.com/pin/${id}/`, imageUrl: `https://i.pinimg.com/736x/${id}.jpg`, imageWidth: 736, imageHeight: 1100 }
        : { title: `Flight checkout app UI ${id}`, link: `https://dribbble.com/shots/${id}-flight`, imageUrl: `https://cdn.dribbble.com/userupload/${id}/file/original.png`, imageWidth: 1600, imageHeight: 1200 };
  });
}

/**
 * Fake Serper: `good(words, site)` says how many good results a request returns; UI requests
 * always return 10. Records every query and the most requests in flight at once.
 */
function fakeSerper(good: (words: string, site: string) => number) {
  let inFlight = 0;
  let peak = 0;
  const sent: string[] = [];
  const fetch = vi.fn<FetchLike>(async (_url, init) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    inFlight--;
    const q = String(JSON.parse(String(init?.body)).q);
    sent.push(q);
    const site = siteOf(q);
    const words = wordsOf(q);
    const n = site === "dribbble" ? 10 : good(words, site);
    return new Response(JSON.stringify({ images: items(site, n, `${words} graphic work`) }), { status: 200 });
  });
  return { adapter: createWebSearchAdapter({ apiKey: "k", fetch, allowlist }), sent, peak: () => peak };
}

const artLanes = (art: string[]): LaneTexts => ({ idea: art[0] ?? "", art });

describe("ladder order and wording", () => {
  it("climbs from a system on Behance to the raw words on Pinterest", () => {
    expect(buildArtLadder("crushed velvet texture")).toEqual({
      ingredient: "crushed velvet",
      rungs: [
        { rung: "system", query: "crushed velvet identity system", site: "behance" },
        { rung: "graphic", query: "crushed velvet graphic design", site: "pinterest" },
        { rung: "pattern", query: "crushed velvet pattern", site: "pinterest" },
        { rung: "raw", query: "crushed velvet texture", site: "pinterest" },
      ],
    });
  });

  it("uses signage for places, transport, maps, boards and signs; identity otherwise", () => {
    const system = (q: string) => buildArtLadder(q).rungs[0]!.query;
    expect(system("airport departure board design close-up")).toBe("airport departure board signage system");
    expect(system("subway map")).toBe("subway map signage system");
    expect(system("highway sign")).toBe("highway sign signage system");
    expect(system("bus stop timetable")).toBe("bus stop timetable signage system");
    expect(system("barometer dial")).toBe("barometer dial identity system");
    expect(system("seersucker texture")).toBe("seersucker identity system");
    // A mark is identity work even for a place.
    expect(system("airline logo")).toBe("airline logo identity system");
  });

  it("uses typography for lettering, signage, print and type; pattern otherwise", () => {
    const pattern = (q: string) => buildArtLadder(q).rungs.find((r) => r.rung === "pattern")?.query;
    expect(pattern("neon shop sign")).toBe("neon shop sign typography");
    expect(pattern("letterpress texture")).toBe("letterpress typography");
    expect(pattern("risograph zine")).toBe("risograph zine typography");
    expect(pattern("luggage tag design close-up")).toBe("luggage tag typography");
    expect(pattern("crushed velvet texture")).toBe("crushed velvet pattern");
    expect(pattern("barometer dial")).toBe("barometer dial pattern");
  });

  it("uses poster for a popular art subject (an era from the bend lists), graphic design otherwise", () => {
    const graphic = (q: string) => buildArtLadder(q).rungs.find((r) => r.rung === "graphic")?.query;
    expect(graphic("Bauhaus 1923 poster")).toBe("Bauhaus poster");
    expect(graphic("brutalist architecture 1970s")).toBe("brutalist architecture 1970s poster");
    expect(graphic("barometer dial")).toBe("barometer dial graphic design");
    // "op art" is an era, but "shop art" is not.
    expect(graphic("shop art")).toBe("shop art graphic design");
    // Years only narrow a system; the raw rung keeps them.
    const bauhaus = buildArtLadder("Bauhaus 1923 poster");
    expect(bauhaus.rungs[0]!.query).toBe("Bauhaus identity system");
    expect(bauhaus.rungs.map((r) => r.rung)).toEqual(["system", "graphic", "pattern", "raw"]);
  });

  it("finds the ingredient under the bend's tails and drops repeated rungs", () => {
    expect(artIngredient("vending machine design close-up")).toBe("vending machine");
    expect(artIngredient("oversized numerals graphic print close-up")).toBe("numerals");
    expect(artIngredient("calm color palette")).toBe("calm");
    // "Y2K chrome poster" is both the graphic rung and the raw words: sent once.
    expect(buildArtLadder("Y2K chrome poster").rungs.map((r) => r.rung)).toEqual(["system", "graphic", "pattern"]);
  });
});

describe("lens directions keep their words", () => {
  it("a lens ingredient searches its own words on Behance, then raw on Pinterest, with the lens negatives", () => {
    expect(isLensQuery("Sadu weaving")).toBe(true);
    expect(isLensQuery("Emirati talli braiding")).toBe(true);
    expect(isLensQuery("korean bojagi pattern")).toBe(true);
    expect(isLensQuery("crushed velvet texture")).toBe(false);
    expect(buildArtLadder("Sadu weaving").rungs).toEqual([
      { rung: "system", query: "Sadu weaving", site: "behance" },
      { rung: "raw", query: "Sadu weaving", site: "pinterest" },
    ]);
    const [talli] = artRequests(["talli gold braid"]);
    expect(talli).toMatchObject({ lane: "art:system", site: "behance" });
    expect(talli!.query).toMatch(/^talli gold braid -tulle -assiut/);
    expect(talli!.next![0]!.query).toMatch(/^talli gold braid -tulle -assiut/);
  });

  it("bend gives every lens move its art query as the system rung", () => {
    const r = bendBrief({ brief: BRIEF, wildness: 3, platform: "mobile", pages: ["checkout"], lens: "sadu" });
    for (const d of r.directions) {
      const lensQuery = d.artQueries.find((q) => isLensQuery(q));
      expect(lensQuery, d.id).toBeDefined();
      const ladder = d.artLadder[d.artQueries.indexOf(lensQuery!)]!;
      expect(ladder.rungs[0]).toEqual({ rung: "system", query: lensQuery, site: "behance" });
    }
  });
});

describe("the direction carries its ladder", () => {
  it("artQueries stay strings; artLadder has one ladder per art query, and search plans the same first rungs", () => {
    const r = bendBrief({ brief: BRIEF, wildness: 3, platform: "mobile", pages: ["checkout"] });
    for (const d of r.directions) {
      expect(d.artQueries.every((q) => typeof q === "string")).toBe(true);
      expect(d.artLadder).toHaveLength(d.artQueries.length);
      // A saved direction rebuilds the same ladder from its art queries alone.
      expect(d.artLadder).toEqual(d.artQueries.map((q) => buildArtLadder(q)));
      const saved: Direction = { id: d.id, bendId: d.id, searchQuery: d.searchQuery, brief: BRIEF, detail: { platform: "mobile", artQueries: d.artQueries } as never };
      const first = planRequests(directionLanes(saved, []), undefined, { zone: "art" }).filter((q) => q.lane === "art:system");
      expect(first.map((q) => q.query.split(" -")[0])).toEqual(d.artLadder.map((l) => l.rungs[0]!.query));
      expect(first.map((q) => q.site)).toEqual(d.artLadder.map((l) => l.rungs[0]!.site));
    }
  });
});

describe("walking the ladder", () => {
  it("falls through only when a rung keeps fewer than 4 usable results", async () => {
    expect(ART_RUNG_MIN).toBe(4);
    // Velvet's system rung finds 4, barometer's finds 3: only barometer climbs.
    const f = fakeSerper((w) => (w === "crushed velvet identity system" ? 4 : w === "barometer dial identity system" ? 3 : 6));
    const res = await f.adapter.runPlan(planRequests(artLanes(["crushed velvet texture", "barometer dial"]), undefined, { zone: "art" }), { count: 12, userId: "u" });
    const words = f.sent.map(wordsOf);
    expect(words.slice(0, 2)).toEqual(["crushed velvet identity system", "barometer dial identity system"]);
    expect(words).toContain("barometer dial graphic design");
    expect(words.some((w) => w.startsWith("crushed velvet") && w !== "crushed velvet identity system")).toBe(false);
    // Barometer's graphic rung found 6: no pattern or raw rung for it.
    expect(words).not.toContain("barometer dial pattern");
    expect(words).not.toContain("barometer dial");
    expect(res.references.every((r) => r.zone === "art")).toBe(true);
  });

  it("walks every rung of a thin ingredient in order, and stops once the art quota is met", async () => {
    const f = fakeSerper((w) => (w === "barometer dial" ? 8 : 0));
    await f.adapter.runPlan(planRequests(artLanes(["barometer dial"]), undefined, { zone: "art" }), { count: 12, userId: "u" });
    expect(f.sent.map((q) => `${wordsOf(q)} @${siteOf(q)}`)).toEqual([
      "barometer dial identity system @behance",
      "barometer dial graphic design @pinterest",
      "barometer dial pattern @pinterest",
      "barometer dial @pinterest",
    ]);
    // Next to UI lanes the art quota is a third (4 of 12): one rung with 4 results is enough,
    // so a thin second ingredient does not climb.
    const g = fakeSerper((w) => (w === "crushed velvet identity system" ? 5 : 0));
    const lanes = { ...laneTexts("Flight checkout app for a travel brand", "crushed velvet", [], "k"), art: ["crushed velvet texture", "barometer dial"] };
    await g.adapter.runPlan(planRequests(lanes), { count: 12, userId: "u" });
    const art = g.sent.filter((q) => siteOf(q) !== "dribbble" && !/\b(app|ui)\b/.test(wordsOf(q))).map(wordsOf);
    expect(art).toEqual(["crushed velvet identity system", "barometer dial identity system"]);
  });

  it("never sends more than 8 requests or more than 4 at once, whatever falls through", async () => {
    for (const zone of ["art", "both"] as const) {
      const f = fakeSerper(() => 0);
      const lanes = { ...laneTexts("Flight checkout app for a Saudi travel brand", "crushed velvet", ["minimal"], "k"), art: ["crushed velvet texture", "barometer dial", "subway map"] };
      const res = await f.adapter.runPlan(planRequests(lanes, undefined, { zone }), { count: 12, userId: "u" });
      expect(f.sent.length, zone).toBeLessThanOrEqual(SERPER_MAX_REQUESTS);
      expect(res.requests).toBe(f.sent.length);
      expect(f.peak()).toBeLessThanOrEqual(SERPER_MAX_IN_FLIGHT);
    }
    // Art only: 3 first rungs, then later rungs up to the budget.
    const g = fakeSerper(() => 0);
    await g.adapter.runPlan(planRequests(artLanes(["crushed velvet texture", "barometer dial", "subway map"]), undefined, { zone: "art" }), { count: 12, userId: "u" });
    expect(g.sent).toHaveLength(SERPER_MAX_REQUESTS);
    expect(g.sent.slice(0, 3).map(wordsOf)).toEqual(["crushed velvet identity system", "barometer dial identity system", "subway map signage system"]);
  });

  it("names each art result's lane by its rung, best rung first", async () => {
    const f = fakeSerper((w) => (w.endsWith("identity system") ? 2 : w.endsWith("graphic design") ? 3 : 0));
    const res = await f.adapter.runPlan(planRequests(artLanes(["crushed velvet texture"]), undefined, { zone: "art" }), { count: 12, userId: "u" });
    const lanes = res.references.map((r) => r.lane);
    expect(new Set(lanes)).toEqual(new Set(["art:system", "art:graphic"]));
    expect(lanes.indexOf("art:system")).toBeLessThan(lanes.indexOf("art:graphic"));
    expect(res.references.every((r) => r.zone === "art")).toBe(true);
  });
});

describe("search_references art lane", () => {
  const DIRECTION: Direction = {
    id: "row-1",
    bendId: "bd-art1",
    canvasId: "c1",
    searchQuery: "barometer dial",
    brief: "Flight checkout app for a travel brand",
    detail: { platform: "mobile", artQueries: ["barometer dial"] } as never,
  };

  function deps(adapter: SearchReferencesDeps["adapter"], addToTray = vi.fn(async () => true)): SearchReferencesDeps {
    return {
      adapter,
      usage: createMemoryUsageStore(),
      getPlan: async () => "free",
      getDirection: async () => DIRECTION,
      addToTray,
      upgradeUrl: () => "https://example.test/pricing",
      now: () => new Date("2026-10-17T12:00:00Z"),
    };
  }

  it("shows the rung in each art result's lane and credits the art lane's term when saved", async () => {
    const f = fakeSerper((w) => (w === "barometer dial identity system" ? 1 : w === "barometer dial graphic design" ? 5 : 0));
    const addToTray = vi.fn(async () => true);
    const res = await createSearchReferencesTool(deps(f.adapter, addToTray))({ directionId: "bd-art1", canvasId: "c1", zone: "art" }, "u1");
    const out = res.structuredContent as { references: Reference[] };
    expect(out.references.map((r) => r.lane)).toEqual(expect.arrayContaining(["art:system", "art:graphic"]));
    expect(out.references.every((r) => r.zone === "art")).toBe(true);
    expect(res.content[0]!.text).toMatch(/, art:graphic\]/);
    const saved = (addToTray.mock.calls[0] as unknown as [string, string, { lane: string; termKey?: string }[]])[2];
    expect(saved.every((r) => r.lane.startsWith("art:") && r.termKey?.startsWith("art|"))).toBe(true);
  });

  it("a re-search with the agent's words stays raw, and its results are lane art:retry", async () => {
    const f = fakeSerper(() => 5);
    const res = await createSearchReferencesTool(deps(f.adapter))({ directionId: "bd-art1", lane: "art", query: "aneroid barometer face" }, "u1");
    expect(f.sent.map((q) => `${wordsOf(q)} @${siteOf(q)}`)).toEqual(["aneroid barometer face @pinterest", "aneroid barometer face @behance"]);
    const out = res.structuredContent as { references: Reference[]; lane: string };
    expect(out.lane).toBe("art");
    expect(out.references.length).toBeGreaterThan(0);
    expect(out.references.every((r) => r.lane === "art:retry" && r.zone === "art")).toBe(true);
  });
});

describe("listing titles", () => {
  it("drops obvious single product photos by their title words", () => {
    for (const title of [
      "Vintage brass barometer for sale",
      "Barometer dial listing",
      "Aneroid barometer, in stock now",
      "Buy seersucker fabric by the yard",
      "Barometer SKU 4471",
      "Seersucker shop",
      "Brass barometer price",
      "Barometer product photo",
    ]) {
      expect(isArtJunk(title, "barometer dial"), title).toBe(true);
    }
    expect(isArtJunk("Barometer dial identity system for a weather brand", "barometer dial identity system")).toBe(false);
    expect(isArtJunk("Seersucker pattern study", "seersucker pattern")).toBe(false);
  });
});
