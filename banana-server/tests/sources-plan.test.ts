import { describe, expect, it, vi } from "vitest";
import {
  bridgeHead,
  DEFAULT_IMAGE_HOSTS,
  forceUi,
  hasUiLanes,
  NOTES,
  PLAIN_MAX_REQUESTS,
  plainQueryPlan,
  plainRetryQuery,
  SERPER_MAX_REQUESTS,
  buildSourceQuery,
  createWebSearchAdapter,
  itemKey,
  laneQuotas,
  mergeLanes,
  parseAllowlist,
  planRequests,
  titleHasWord,
  UI_NEG,
  type FetchLike,
  type LaneTexts,
  type Reference,
} from "@/lib/sources";

const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);

const LANES: LaneTexts = {
  idea: "crushed velvet",
  taste: "minimal checkout ui",
  fidelity: "saudi fintech app ui",
  fidelityCore: "fintech app ui",
  hero: "glassmorphism fintech app single screen",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** A Serper page whose items sit on the site the query asks for. */
function pageFor(q: string, n = 10, tag = "") {
  const site = /site:(\S+)/.exec(q)![1]!;
  const slug = `${q.split(" site:")[0]}${tag}`.replace(/\W+/g, "-");
  return {
    images: Array.from({ length: n }, (_, i) => {
      if (site.startsWith("dribbble")) {
        return { title: `App UI shot ${i}`, link: `https://dribbble.com/shots/${100 + i}${slug.length}${i}-${slug}`, imageUrl: `https://cdn.dribbble.com/u/${slug}-${i}.png?resize=400x300` };
      }
      if (site.startsWith("behance")) {
        return { title: `Website UI project ${i}`, link: `https://www.behance.net/gallery/${200 + i}${slug.length}/${slug}`, imageUrl: `https://mir-s3-cdn-cf.behance.net/p/${slug}-${i}.jpg`, imageWidth: 1400, imageHeight: 1000 };
      }
      return { title: `App UI pin ${i}`, link: `https://www.pinterest.com/pin/${300 + i}${slug.length}${i}/`, imageUrl: `https://i.pinimg.com/736x/${slug}-${i}.jpg`, imageWidth: 736, imageHeight: 1000 };
    }),
  };
}

const bodyOf = (init?: RequestInit) => JSON.parse(String(init?.body)) as { q: string; num: number; page?: number };

/** Every lane: two fidelity pages, taste, two components, hero and bridge (7 requests). */
const FULL: LaneTexts = {
  ...LANES,
  idea: "vending machine",
  component: ["fintech balance ui", "fintech quick actions ui"],
  bridge: "vending machine ui design",
};

describe("search plan", () => {
  it("sends each lane to its sources, path-scoped, UI lanes with negatives, never the raw idea", () => {
    const plan = planRequests(LANES);
    expect(plan.map((r) => buildSourceQuery(r.query, r.site))).toEqual([
      `saudi fintech app ui ${UI_NEG} site:dribbble.com/shots`,
      `minimal checkout ui ${UI_NEG} site:dribbble.com/shots`,
      `saudi fintech app ui ${UI_NEG} site:pinterest.com/pin`,
      "glassmorphism fintech app single screen site:dribbble.com/shots",
    ]);
    expect(UI_NEG).toBe("-template -kit -free -wireframe");
    expect(plan.filter((r) => r.lane === "fidelity").every((r) => r.fallback === `fintech app ui ${UI_NEG}`)).toBe(true);
    expect(plan.length).toBeLessThanOrEqual(SERPER_MAX_REQUESTS);
    for (const r of plan) expect(buildSourceQuery(r.query, r.site)).not.toMatch(/\bOR\b/);
    expect(plan.some((r) => r.query.includes("crushed velvet") || r.site === "behance")).toBe(false);
  });

  it("plans a direction in priority order: fidelity, bridge, taste, component, fidelity on Pinterest, component, hero (8th request spare)", () => {
    const plan = planRequests(FULL);
    expect(plan.map((r) => `${r.lane}:${r.site}`)).toEqual([
      "fidelity:dribbble",
      "bridge:dribbble",
      "taste:dribbble",
      "component:dribbble",
      "fidelity:pinterest",
      "component:dribbble",
      "hero:dribbble",
    ]);
    expect(plan.length).toBeLessThan(SERPER_MAX_REQUESTS);
    expect(plan[3]).toEqual({ lane: "component", query: `fintech balance ui ${UI_NEG}`, site: "dribbble" });
    expect(plan[5]!.query).toBe(`fintech quick actions ui ${UI_NEG}`);
    expect(plan[1]).toEqual({
      lane: "bridge",
      query: `vending machine ui design ${UI_NEG}`,
      site: "dribbble",
      fallback: `vending machine app ui ${UI_NEG}`,
      titleWord: "machine",
    });
    expect(buildSourceQuery(plan[1]!.query, plan[1]!.site)).toBe(`vending machine ui design ${UI_NEG} site:dribbble.com/shots`);
    // Both zones: the bridge survives the cut, so each direction gets UI of its own idea
    // (field report, 2026-10-12: placed last, it was cut and every direction got the same shots).
    const both = planRequests({ ...FULL, art: ["vending machine"] });
    // V4.3: one art request per art query (its ladder's first rung), so UI keeps one more place.
    expect(both.map((r) => r.lane)).toEqual(["fidelity", "art:system", "bridge", "taste", "component", "fidelity", "component"]);
    // At most 2 component lanes.
    expect(planRequests({ ...FULL, component: ["a ui", "b ui", "c ui"] }).filter((r) => r.lane === "component")).toHaveLength(2);
    // No head word, no bridge request.
    expect(planRequests({ ...LANES, bridge: "3d ui design", idea: "3d" }).some((r) => r.lane === "bridge")).toBe(false);
    // A picked source list moves it like any lane.
    expect(planRequests(FULL, ["pinterest"]).find((r) => r.lane === "bridge")?.site).toBe("pinterest");
  });

  it("finds the ingredient's head word", () => {
    expect(bridgeHead("vending machine")).toBe("machine");
    expect(bridgeHead("Sadu weaving")).toBe("weaving");
    expect(bridgeHead("oversized numerals")).toBe("numerals");
    expect(bridgeHead("Art Nouveau 1900")).toBe("nouveau");
    expect(bridgeHead("map of the")).toBe("map");
    // A common word is skipped when the idea has a more telling one ("windows" kept Windows 11 shots).
    expect(bridgeHead("rawashin windows")).toBe("rawashin");
    expect(bridgeHead("letterpress texture")).toBe("letterpress");
    expect(bridgeHead("giant plus sign poster")).toBe("plus");
    expect(bridgeHead("windows")).toBe("windows");
    expect(bridgeHead("3d ui")).toBeNull();
    expect(bridgeHead("")).toBeNull();
    expect(bridgeHead(undefined)).toBeNull();
  });

  it("matches the head word in titles on word boundaries, any case, singular or plural", () => {
    expect(titleHasWord("Vending Machine UI by Ana on Dribbble", "machine")).toBe(true);
    expect(titleHasWord("Smart vending machines kiosk", "machine")).toBe(true);
    expect(titleHasWord("MACHINE checkout", "machine")).toBe(true);
    expect(titleHasWord("Machinery dashboard", "machine")).toBe(false);
    expect(titleHasWord("Time-machine travel app", "machine")).toBe(true);
    expect(titleHasWord("Big numeral clock", "numerals")).toBe(true);
    expect(titleHasWord("Glasses store app", "glass")).toBe(true);
    expect(titleHasWord("Frosted glass card", "glasses")).toBe(true);
    expect(titleHasWord("Hourglass timer", "glass")).toBe(false);
    expect(titleHasWord("Travel app UI", "weaving")).toBe(false);
    expect(titleHasWord(undefined, "machine")).toBe(false);
  });

  it("keeps only Arabic lane titles that name the subject", () => {
    const plan = planRequests({ ...LANES, locale: "arabic flight app ui", localeWord: "flight" });
    expect(plan.find((r) => r.lane === "locale")).toMatchObject({ site: "pinterest", titleWord: "flight" });
  });

  it("puts the Arabic locale query in place of the Pinterest fidelity page", () => {
    const plan = planRequests({ ...LANES, locale: "arabic app ui" });
    expect(plan.map((r) => `${r.lane}:${r.site}`)).toEqual(["fidelity:dribbble", "taste:dribbble", "locale:pinterest", "hero:dribbble"]);
    expect(plan[2]!.query).toBe(`arabic app ui ${UI_NEG}`);
  });

  it("keeps every lane on the sources the caller picked; the idea alone plans nothing", () => {
    const plan = planRequests(LANES, ["pinterest"]);
    expect(plan.map((r) => `${r.lane}:${r.site}`)).toEqual(["fidelity:pinterest", "taste:pinterest", "hero:pinterest"]);
    expect(planRequests({ idea: "crushed velvet" })).toEqual([]);
    expect(hasUiLanes({ idea: "crushed velvet" })).toBe(false);
    expect(hasUiLanes(LANES)).toBe(true);
  });

  it("splits the results evenly over the lanes", () => {
    expect(Object.fromEntries(laneQuotas(12, ["fidelity", "taste", "component", "hero", "bridge"]))).toEqual({
      fidelity: 3,
      taste: 3,
      component: 2,
      hero: 2,
      bridge: 2,
    });
    expect([...laneQuotas(8, ["taste"]).values()]).toEqual([8]);
    expect([...laneQuotas(8, ["taste", "fidelity"]).values()]).toEqual([4, 4]);
    expect(laneQuotas(8, []).size).toBe(0);
  });

  it("merges lanes round robin by quota, fills from leftovers, never repeats a key", () => {
    const ref = (id: string): Reference => ({ id, thumbUrl: `https://t/${id}`, imageUrl: `https://i/${id}`, sourceUrl: `https://s/${id}`, sourceSite: "x" });
    const lists = new Map([
      ["hero", ["a1", "a2", "a3", "a4"].map(ref)],
      ["taste", ["b1", "a1", "b2"].map(ref)],
      ["fidelity", [] as Reference[]],
    ] as const);
    const quotas = new Map([
      ["hero", 2],
      ["taste", 2],
      ["fidelity", 2],
    ] as const);
    const out = mergeLanes(lists, quotas, 6, (r) => [r.id]);
    expect(out.map((r) => r.id)).toEqual(["a1", "b1", "a2", "b2", "a3", "a4"]);
  });

  it("gives an empty lane's places to the other lanes, in lane order", () => {
    const ref = (id: string): Reference => ({ id, thumbUrl: `https://t/${id}`, imageUrl: `https://i/${id}`, sourceUrl: `https://s/${id}`, sourceSite: "x" });
    const lists = new Map([
      ["fidelity", ["f1", "f2", "f3", "f4", "f5"].map(ref)],
      ["bridge", [] as Reference[]],
      ["taste", ["t1", "t2"].map(ref)],
      ["component", ["c1", "c2", "c3"].map(ref)],
    ] as const);
    const quotas = laneQuotas(8, [...lists.keys()]);
    expect(Object.fromEntries(quotas)).toEqual({ fidelity: 2, bridge: 2, taste: 2, component: 2 });
    const out = mergeLanes(lists, quotas, 8, (r) => [r.id]);
    expect(out.map((r) => r.id)).toEqual(["f1", "t1", "c1", "f2", "t2", "c2", "f3", "c3"]);
  });
});

describe("runPlan", () => {
  it("runs one page per request, at most 4 in flight and 8 in all, and interleaves lanes", async () => {
    let inFlight = 0;
    let peak = 0;
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return jsonResponse(pageFor(bodyOf(init).q));
    });
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const plan = planRequests(LANES);
    const result = await adapter.runPlan(plan, { count: 12, userId: "u" });
    expect(result.ok).toBe(true);
    expect(peak).toBeLessThanOrEqual(4);
    expect(fetchMock).toHaveBeenCalledTimes(plan.length); // every request had 10 good results: no fallback
    expect(result.requests).toBe(plan.length);
    expect(fetchMock.mock.calls.every(([, init]) => bodyOf(init).num === 10 && bodyOf(init).page === undefined)).toBe(true);
    expect(result.references).toHaveLength(12);
    // Lanes round robin in plan order, an even share each (fidelity's two pages interleaved).
    expect(result.references.map((r) => r.lane)).toEqual(Array.from({ length: 4 }, () => ["fidelity", "taste", "hero"]).flat());
    expect(new Set(result.references.filter((r) => r.lane === "fidelity").map((r) => r.sourceSite))).toEqual(
      new Set(["pinterest.com", "dribbble.com"]),
    );
    // Dribbble originals: ?resize stripped.
    expect(result.references.filter((r) => r.sourceSite === "dribbble.com").every((r) => !r.imageUrl.includes("resize"))).toBe(true);
  });

  it("retries a thin fidelity answer once with the core noun, within 8 requests", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const q = bodyOf(init).q;
      // The compound domain is niche: 2 good results. Everything else fills.
      return jsonResponse(pageFor(q, q.startsWith("saudi fintech") ? 2 : 10));
    });
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const result = await adapter.runPlan(planRequests(LANES), { count: 24, userId: "u" });
    const queries = fetchMock.mock.calls.map(([, init]) => bodyOf(init).q);
    expect(queries).toHaveLength(6);
    expect(queries.slice(4)).toEqual([
      `fintech app ui ${UI_NEG} site:dribbble.com/shots`,
      `fintech app ui ${UI_NEG} site:pinterest.com/pin`,
    ]);
    expect(result.requests).toBe(6);
    expect(result.report?.filter((r) => r.retried)).toHaveLength(2);
  });

  it("dedupes across lanes by shot, pin and gallery id", async () => {
    const same = {
      images: [
        { title: "A app ui", link: "https://dribbble.com/shots/42-a", imageUrl: "https://cdn.dribbble.com/u/a.png" },
        { title: "B app ui", link: "https://es.pinterest.com/pin/77/", imageUrl: "https://i.pinimg.com/736x/b.jpg", imageWidth: 736, imageHeight: 900 },
      ],
    };
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const q = bodyOf(init).q;
      if (q.includes("dribbble")) return jsonResponse({ images: [{ title: "A again app ui", link: "https://dribbble.com/shots/42-a-v2", imageUrl: "https://cdn.dribbble.com/u/a2.png" }] });
      if (q.includes("pinterest")) return jsonResponse({ images: [same.images[1], { title: "B again app ui", link: "https://www.pinterest.com/pin/77/", imageUrl: "https://i.pinimg.com/736x/b2.jpg", imageWidth: 736, imageHeight: 900 }] });
      return jsonResponse({ images: [] });
    });
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const result = await adapter.runPlan(planRequests({ idea: "x", fidelity: "y app ui", taste: "z card ui" }), { count: 12, userId: "u" });
    expect(result.references.map((r) => r.sourceUrl).sort()).toEqual(["https://dribbble.com/shots/42-a-v2", "https://es.pinterest.com/pin/77/"]);
  });

  it("skips references already on the canvas, matched by shot or pin id", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => jsonResponse(pageFor(bodyOf(init).q)));
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const first = await adapter.runPlan(planRequests(LANES), { count: 8, userId: "u" });
    const kept = first.references.slice(0, 4).map((r) => r.sourceUrl);
    // The same item under another slug or country subdomain still counts as kept.
    const exclude = kept.map((u) => u.replace("https://www.pinterest.com/", "https://es.pinterest.com/"));
    const again = await adapter.runPlan(planRequests(LANES), { count: 8, userId: "u", exclude });
    expect(again.references.length).toBe(8);
    const keys = new Set(kept);
    expect(again.references.some((r) => keys.has(r.sourceUrl))).toBe(false);
  });

  it("keeps what it has when later requests hit the rate limit, and fails only when nothing answered", async () => {
    let n = 0;
    const partly = vi.fn<FetchLike>(async (_url, init) => (n++ === 0 ? jsonResponse(pageFor(bodyOf(init).q)) : jsonResponse({ message: "You are allowed to submit up to 5 requests per second" }, 429)));
    const ok = await createWebSearchAdapter({ apiKey: "k", fetch: partly, allowlist }).runPlan(planRequests(LANES), { count: 8, userId: "u" });
    expect(ok.ok).toBe(true);
    expect(ok.references.length).toBeGreaterThan(0);

    const limited = vi.fn<FetchLike>(async () => jsonResponse({ message: "slow down" }, 429));
    const failed = await createWebSearchAdapter({ apiKey: "k", fetch: limited, allowlist }).runPlan(planRequests(LANES), { count: 8, userId: "u" });
    expect(failed).toMatchObject({ ok: false, references: [], note: NOTES.rateLimited });
    // A failed request is never retried.
    expect(limited).toHaveBeenCalledTimes(planRequests(LANES).length);
  });

  it("tags each result with its lane and the words that found it", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => jsonResponse(pageFor(bodyOf(init).q)));
    const result = await createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist }).runPlan(planRequests(LANES), { count: 12, userId: "u" });
    expect(result.references.every((r) => r.lane && r.query && !r.query.includes("site:") && !r.query.includes("-template"))).toBe(true);
    expect(result.references.find((r) => r.lane === "fidelity")?.query).toBe("saudi fintech app ui");
    expect(result.references.some((r) => (r.lane as string) === "inspiration" || r.query === "crushed velvet")).toBe(false);
  });

  it("never returns a blocked item key", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => jsonResponse(pageFor(bodyOf(init).q)));
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const first = await adapter.runPlan(planRequests(LANES), { count: 12, userId: "u" });
    const blocked = first.references.slice(0, 5).map((r) => itemKey(r.sourceUrl));
    const again = await adapter.runPlan(planRequests(LANES), { count: 12, userId: "u", excludeKeys: blocked });
    expect(again.references.some((r) => blocked.includes(itemKey(r.sourceUrl)))).toBe(false);
    expect(again.references).toHaveLength(12);
  });

  it("nudges a liked creator up inside its lane, never past the lane quotas", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const page = pageFor(bodyOf(init).q);
      // The fifth shot of the taste request (past the lane's quota of 4) is by a creator the user liked.
      if (bodyOf(init).q.startsWith("minimal checkout")) page.images[4]!.title = "App UI shot 4 by Jane Doe on Dribbble";
      return jsonResponse(page);
    });
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const plain = await adapter.runPlan(planRequests(LANES), { count: 12, userId: "u" });
    const liked = await adapter.runPlan(planRequests(LANES), { count: 12, userId: "u", preferCreators: ["jane doe"] });
    expect(plain.references.some((r) => r.title?.includes("Jane Doe"))).toBe(false);
    expect(liked.references.some((r) => r.title?.includes("Jane Doe"))).toBe(true);
    const lanesOf = (refs: Reference[]) => refs.map((r) => r.lane).sort();
    expect(lanesOf(liked.references)).toEqual(lanesOf(plain.references));
  });

  it("fetches page 2 when page 1 is mostly on the canvas or blocked, before the core noun fallback", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const { q, page } = bodyOf(init);
      return jsonResponse(pageFor(q, 10, page === 2 ? "-p2" : ""));
    });
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const plan = planRequests(LANES);
    const taste = plan.find((r) => r.lane === "taste")!;
    const tasteQ = buildSourceQuery(taste.query, taste.site);
    // 8 of the 10 taste shots are already on the canvas.
    const exclude = pageFor(tasteQ).images.slice(0, 8).map((i) => i.link);
    const result = await adapter.runPlan(plan, { count: 24, userId: "u", exclude });
    const bodies = fetchMock.mock.calls.map(([, init]) => bodyOf(init));
    expect(bodies).toHaveLength(plan.length + 1);
    expect(bodies.at(-1)).toEqual({ q: tasteQ, num: 10, page: 2 });
    expect(result.requests).toBe(plan.length + 1);
    expect(result.report?.find((r) => r.lane === "taste")).toMatchObject({ page2: true, good: 12 });
    expect(result.references.some((r) => r.sourceUrl.includes("-p2"))).toBe(true);
  });

  it("keeps page 2 and fallbacks within 8 requests, page 2 first", async () => {
    const plan = planRequests(FULL);
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const { q, page } = bodyOf(init);
      // The Pinterest fidelity request is thin (a fallback case); everything else is full.
      const thin = q.startsWith("saudi fintech") && q.includes("pinterest");
      return jsonResponse(pageFor(q, thin ? 2 : 10, page === 2 ? "-p2" : ""));
    });
    // Every result of the taste, component and hero pages is already on the canvas: 4 exhausted requests.
    const exclude = plan
      .filter((r) => r.lane !== "fidelity" && r.lane !== "bridge")
      .flatMap((r) => pageFor(buildSourceQuery(r.query, r.site)).images.map((i) => i.link));
    let inFlight = 0;
    let peak = 0;
    const counted = vi.fn<FetchLike>(async (url, init) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
      return fetchMock(url, init);
    });
    const result = await createWebSearchAdapter({ apiKey: "k", fetch: counted, allowlist }).runPlan(plan, { count: 12, userId: "u", exclude });
    const bodies = counted.mock.calls.map(([, init]) => bodyOf(init));
    expect(bodies).toHaveLength(8);
    expect(result.requests).toBe(8);
    expect(peak).toBeLessThanOrEqual(4);
    // Only 1 request was left: it went to page 2, the thin fidelity answer got no fallback.
    expect(bodies[7]!.page).toBe(2);
    expect(result.report?.filter((r) => r.page2)).toHaveLength(1);
    expect(result.report?.some((r) => r.retried)).toBe(false);
  });

  it("does not fetch page 2 for a thin answer or a short page", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => jsonResponse(pageFor(bodyOf(init).q, 3)));
    const result = await createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist }).runPlan(planRequests({ idea: "x", fidelity: "y app ui" }), {
      count: 12,
      userId: "u",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.report?.some((r) => r.page2)).toBe(false);
  });
});

describe("runPlan with the bridge lane and the UI gate", () => {
  const BRIDGE: LaneTexts = { ...LANES, idea: "vending machine", bridge: "vending machine ui design" };
  /** Bridge page: Dribbble shots with the given titles. */
  const bridgePage = (q: string, titles: string[]) => ({
    images: titles.map((title, i) => ({
      title,
      link: `https://dribbble.com/shots/9${i}${q.length}-bridge`,
      imageUrl: `https://cdn.dribbble.com/u/bridge-${q.length}-${i}.png`,
    })),
  });

  it("keeps only bridge results whose title names the idea and a UI", async () => {
    const titles = [
      "Vending Machine UI by Ana on Dribbble",
      "Smart vending machines kiosk",
      "Machinery dashboard",
      "Travel app",
      "Coffee machine order screen",
      "Ticket kiosk",
      "Snack MACHINE checkout",
      "Grocery app",
      "Machines of loving grace",
      "Arcade cabinet",
    ];
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const q = bodyOf(init).q;
      return jsonResponse(q.startsWith("vending machine ui design") ? bridgePage(q, titles) : pageFor(q));
    });
    const result = await createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist }).runPlan(planRequests(BRIDGE), { count: 24, userId: "u" });
    // 3 good bridge results is a thin answer: one retry as "vending machine app ui" (5 planned + 1).
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls.map(([, init]) => bodyOf(init).q)).toContain(`vending machine app ui ${UI_NEG} site:dribbble.com/shots`);
    const bridge = result.references.filter((r) => r.lane === "bridge");
    // "Smart vending machines kiosk" and "Machines of loving grace" name the idea but no UI.
    expect(bridge.map((r) => r.title).sort()).toEqual(["Coffee machine order screen", "Snack MACHINE checkout", "Vending Machine UI by Ana on Dribbble"].sort());
    expect(result.report?.find((r) => r.lane === "bridge")).toMatchObject({ good: 3, site: "dribbble" });
    expect(result.dropped).toBeGreaterThanOrEqual(7);
  });

  it("an idea with no UI titles (sadu) leaves the bridge lane empty and its places go to the other UI lanes", async () => {
    const lanes: LaneTexts = { ...LANES, idea: "Sadu weaving", bridge: "Sadu weaving ui design" };
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const q = bodyOf(init).q;
      return jsonResponse(q.startsWith("Sadu weaving ui design") ? bridgePage(q, Array.from({ length: 10 }, (_, i) => `Travel app UI ${i}`)) : pageFor(q));
    });
    const result = await createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist }).runPlan(planRequests(lanes), { count: 12, userId: "u" });
    // No page 2 for an empty bridge, one retry with its app ui form: 6 requests.
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(result.report?.find((r) => r.lane === "bridge")).toMatchObject({ good: 0, retried: `Sadu weaving app ui ${UI_NEG}` });
    expect(result.references).toHaveLength(12);
    expect(result.references.some((r) => r.lane === "bridge")).toBe(false);
  });

  it("keeps bridge, page 2 and the fallback within 8 requests, page 2 first", async () => {
    const plan = planRequests(FULL);
    expect(plan).toHaveLength(7);
    const tasteQ = buildSourceQuery(plan[2]!.query, plan[2]!.site);
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const { q, page } = bodyOf(init);
      // Both fidelity requests are thin (fallback cases); the taste page is mostly on the canvas (page 2 case).
      if (q.startsWith("saudi fintech")) return jsonResponse(pageFor(q, 2));
      if (q.startsWith("vending machine ui design")) return jsonResponse(bridgePage(q, ["Vending machine app"]));
      return jsonResponse(pageFor(q, 10, page === 2 ? "-p2" : ""));
    });
    const exclude = pageFor(tasteQ).images.slice(0, 8).map((i) => i.link);
    const result = await createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist }).runPlan(plan, { count: 24, userId: "u", exclude });
    const bodies = fetchMock.mock.calls.map(([, init]) => bodyOf(init));
    expect(bodies).toHaveLength(SERPER_MAX_REQUESTS);
    expect(result.requests).toBe(8);
    expect(bodies.at(-1)).toEqual({ q: tasteQ, num: 10, page: 2 });
    expect(result.report?.some((r) => r.retried)).toBe(false);
    expect(result.references.some((r) => r.lane === "bridge")).toBe(true);
  });

  it("spends the one request left on the first thin fidelity fallback", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const q = bodyOf(init).q;
      return jsonResponse(q.startsWith("saudi fintech") ? pageFor(q, 2) : pageFor(q));
    });
    const result = await createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist }).runPlan(planRequests(FULL), { count: 24, userId: "u" });
    const queries = fetchMock.mock.calls.map(([, init]) => bodyOf(init).q);
    expect(queries).toHaveLength(8);
    expect(queries.at(-1)).toBe(`fintech app ui ${UI_NEG} site:dribbble.com/shots`);
    expect(result.report?.filter((r) => r.retried)).toHaveLength(1);
  });

  it("drops results whose title names no UI, from every lane, and counts them", async () => {
    const titles = ["Uzbek suzani jacket", "Gas station sign", "", "Delta airline logo", "Flight Booking App UI by X on Dribbble", "Banking Dashboard"];
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const q = bodyOf(init).q;
      const site = /site:(\S+)/.exec(q)![1]!;
      return jsonResponse({
        images: titles.map((title, i) =>
          site.startsWith("dribbble")
            ? { title, link: `https://dribbble.com/shots/5${i}${q.length}-x`, imageUrl: `https://cdn.dribbble.com/u/g-${q.length}-${i}.png` }
            : { title, link: `https://www.pinterest.com/pin/6${i}${q.length}/`, imageUrl: `https://i.pinimg.com/736x/g-${q.length}-${i}.jpg`, imageWidth: 736, imageHeight: 1000 },
        ),
      });
    });
    const result = await createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist }).runPlan(planRequests(FULL), { count: 24, userId: "u" });
    expect(result.references.length).toBeGreaterThan(0);
    expect(result.references.every((r) => r.title === "Flight Booking App UI by X on Dribbble" || r.title === "Banking Dashboard")).toBe(true);
    // 4 of 6 dropped on each of the 7 requests (plus the bridge's 2 without "machine").
    expect(result.dropped).toBeGreaterThanOrEqual(4 * 7);
  });
});

describe("plain query path", () => {
  it("searches a query that names a UI as is, on the picked sources", () => {
    expect(plainQueryPlan("banking app home", ["pinterest", "dribbble"])).toEqual([
      { query: "banking app home", site: "pinterest" },
      { query: "banking app home", site: "dribbble" },
    ]);
    expect(plainQueryPlan("checkout site:etsy.com", ["dribbble"])).toEqual([{ query: "checkout", site: "dribbble" }]);
    expect(plainQueryPlan("dashboard", ["pinterest", "dribbble", "behance", "awwwards", "pinterest"] as never)).toHaveLength(PLAIN_MAX_REQUESTS);
  });

  it("forces any other query into UI forms on Dribbble and Pinterest", () => {
    expect(plainQueryPlan("teletext 1980s", ["pinterest", "dribbble"])).toEqual([
      { query: `teletext 1980s app ui ${UI_NEG}`, site: "dribbble" },
      { query: `teletext 1980s ui design ${UI_NEG}`, site: "dribbble" },
      { query: `teletext 1980s app ui ${UI_NEG}`, site: "pinterest" },
    ]);
    // Only Pinterest picked: the Dribbble requests move there, repeats dropped.
    expect(plainQueryPlan("vaporwave", ["pinterest"])).toEqual([
      { query: `vaporwave app ui ${UI_NEG}`, site: "pinterest" },
      { query: `vaporwave ui design ${UI_NEG}`, site: "pinterest" },
    ]);
  });

  it("retries with numbers and years stripped and the last 2 words", () => {
    expect(plainRetryQuery("teletext 1980s")).toBe(`teletext ui design ${UI_NEG}`);
    expect(plainRetryQuery("city pop 1985")).toBe(`city pop ui design ${UI_NEG}`);
    // Style words survive the cut (live test 2026-10-12: "brutalist landing page AI startup" lost "brutalist").
    expect(plainRetryQuery("a big 70's retro diner menu")).toBe(`retro diner menu ui design ${UI_NEG}`);
    expect(plainRetryQuery("brutalist landing page AI startup")).toBe(`brutalist ai startup ui design ${UI_NEG}`);
    expect(plainRetryQuery("make it cool")).toBeNull();
    expect(plainRetryQuery("1985")).toBeNull();
    // Already sent in that form: no retry.
    expect(plainRetryQuery("glassmorphism", [`glassmorphism ui design ${UI_NEG}`])).toBeNull();
  });

  it("forces lane words into UI only when they name none", () => {
    expect(forceUi("vending machine")).toBe("vending machine app ui");
    expect(forceUi("flight checkout")).toBe("flight checkout");
    expect(forceUi("banking dashboard site:x.com")).toBe("banking dashboard");
  });

  it("runs at most 4 requests: 3 UI forms, then one short retry, and says so when nothing is UI", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const q = bodyOf(init).q;
      return jsonResponse({
        images: [
          { title: "Teletext 1980s", link: `https://www.pinterest.com/pin/1${q.length}/`, imageUrl: `https://i.pinimg.com/736x/t${q.length}.jpg`, imageWidth: 736, imageHeight: 900 },
          { title: "", link: `https://dribbble.com/shots/2${q.length}-t`, imageUrl: `https://cdn.dribbble.com/u/t${q.length}.png` },
        ],
      });
    });
    const result = await createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist }).run({ query: "teletext 1980s", count: 12, userId: "u" });
    const queries = fetchMock.mock.calls.map(([, init]) => bodyOf(init).q);
    expect(queries).toEqual([
      `teletext 1980s app ui ${UI_NEG} site:dribbble.com/shots`,
      `teletext 1980s ui design ${UI_NEG} site:dribbble.com/shots`,
      `teletext 1980s app ui ${UI_NEG} site:pinterest.com/pin`,
      `teletext ui design ${UI_NEG} site:dribbble.com/shots`,
    ]);
    expect(result.requests).toBe(4);
    expect(result.queries).toEqual(queries);
    expect(result).toMatchObject({ ok: true, references: [], note: NOTES.noResults });
    expect(NOTES.noResults).toBe("No UI references found for that. Try naming the screen or product, for example 'banking app home'.");
    expect(result.dropped).toBeGreaterThan(0);
  });

  it("keeps only UI titles on a query that names a UI, with page 2 inside the 4 requests", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const { q, page } = bodyOf(init);
      const p = pageFor(q, 10, page === 2 ? "-p2" : "");
      p.images[0]!.title = "Movie poster";
      return jsonResponse(p);
    });
    const result = await createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist }).run({ query: "banking app home", count: 24, userId: "u" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.references.every((r) => r.title !== "Movie poster")).toBe(true);
    expect(result.references).toHaveLength(24);
  });
});

describe("run with a blocklist", () => {
  it("drops blocked items from a plain query search", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => jsonResponse(pageFor(bodyOf(init).q)));
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const first = await adapter.run({ query: "poster", count: 8, userId: "u" });
    const blocked = [itemKey(first.references[0]!.sourceUrl)];
    const again = await adapter.run({ query: "poster", count: 8, userId: "u", excludeKeys: blocked });
    expect(again.references).toHaveLength(8);
    expect(again.references.some((r) => itemKey(r.sourceUrl) === blocked[0])).toBe(false);
  });
});

