import { describe, expect, it, vi } from "vitest";
import {
  bridgeHead,
  DEFAULT_IMAGE_HOSTS,
  inspirationQuota,
  laneOrder,
  NOTES,
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
  inspiration: "crushed velvet",
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
        return { title: `Shot ${i}`, link: `https://dribbble.com/shots/${100 + i}${slug.length}${i}-${slug}`, imageUrl: `https://cdn.dribbble.com/u/${slug}-${i}.png?resize=400x300` };
      }
      if (site.startsWith("behance")) {
        return { title: `Project ${i}`, link: `https://www.behance.net/gallery/${200 + i}${slug.length}/${slug}`, imageUrl: `https://mir-s3-cdn-cf.behance.net/p/${slug}-${i}.jpg`, imageWidth: 1400, imageHeight: 1000 };
      }
      return { title: `Pin ${i}`, link: `https://www.pinterest.com/pin/${300 + i}${slug.length}${i}/`, imageUrl: `https://i.pinimg.com/736x/${slug}-${i}.jpg`, imageWidth: 736, imageHeight: 1000 };
    }),
  };
}

const bodyOf = (init?: RequestInit) => JSON.parse(String(init?.body)) as { q: string; num: number; page?: number };

describe("search plan", () => {
  it("sends each lane to its sources, path-scoped, UI lanes with negatives", () => {
    const plan = planRequests(LANES);
    expect(plan.map((r) => buildSourceQuery(r.query, r.site))).toEqual([
      "crushed velvet site:pinterest.com/pin",
      `saudi fintech app ui ${UI_NEG} site:dribbble.com/shots`,
      `minimal checkout ui ${UI_NEG} site:dribbble.com/shots`,
      "crushed velvet site:behance.net/gallery",
      "glassmorphism fintech app single screen site:dribbble.com/shots",
      `saudi fintech app ui ${UI_NEG} site:pinterest.com/pin`,
    ]);
    expect(UI_NEG).toBe("-template -kit -free -wireframe");
    expect(plan.filter((r) => r.lane === "fidelity").every((r) => r.fallback === `fintech app ui ${UI_NEG}`)).toBe(true);
    expect(plan.length).toBeLessThanOrEqual(SERPER_MAX_REQUESTS);
    for (const r of plan) expect(buildSourceQuery(r.query, r.site)).not.toMatch(/\bOR\b/);
  });

  it("plans the bridge lane on Dribbble after fidelity and taste, before hero, with a title word", () => {
    const plan = planRequests({ ...LANES, bridge: "vending machine ui design", inspiration: "vending machine" });
    expect(plan.map((r) => `${r.lane}:${r.site}`)).toEqual([
      "inspiration:pinterest",
      "fidelity:dribbble",
      "taste:dribbble",
      "bridge:dribbble",
      "inspiration:behance",
      "hero:dribbble",
      "fidelity:pinterest",
    ]);
    expect(plan[3]).toEqual({ lane: "bridge", query: `vending machine ui design ${UI_NEG}`, site: "dribbble", titleWord: "machine" });
    expect(buildSourceQuery(plan[3]!.query, plan[3]!.site)).toBe(`vending machine ui design ${UI_NEG} site:dribbble.com/shots`);
    // No head word, no bridge request.
    expect(planRequests({ ...LANES, bridge: "3d ui design", inspiration: "3d" }).some((r) => r.lane === "bridge")).toBe(false);
    // A picked source list moves it like any UI lane.
    expect(planRequests({ ...LANES, bridge: "vending machine ui design", inspiration: "vending machine" }, ["pinterest"]).find((r) => r.lane === "bridge")?.site).toBe("pinterest");
  });

  it("finds the ingredient's head word", () => {
    expect(bridgeHead("vending machine")).toBe("machine");
    expect(bridgeHead("Sadu weaving")).toBe("weaving");
    expect(bridgeHead("oversized numerals")).toBe("numerals");
    expect(bridgeHead("Art Nouveau 1900")).toBe("nouveau");
    expect(bridgeHead("map of the")).toBe("map");
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

  it("puts the Arabic locale query in place of the Pinterest fidelity page", () => {
    const plan = planRequests({ ...LANES, locale: "arabic app ui" });
    expect(plan.map((r) => `${r.lane}:${r.site}`)).toEqual([
      "inspiration:pinterest",
      "fidelity:dribbble",
      "taste:dribbble",
      "inspiration:behance",
      "hero:dribbble",
      "locale:pinterest",
    ]);
    expect(plan.at(-1)!.query).toBe(`arabic app ui ${UI_NEG}`);
  });

  it("keeps UI lanes on the sources the caller picked; inspiration keeps Pinterest and Behance", () => {
    const plan = planRequests(LANES, ["pinterest"]);
    expect(plan.map((r) => `${r.lane}:${r.site}`)).toEqual([
      "inspiration:pinterest",
      "fidelity:pinterest",
      "taste:pinterest",
      "inspiration:behance",
      "hero:pinterest",
    ]);
    expect(planRequests({ inspiration: "crushed velvet" }).map((r) => r.site)).toEqual(["pinterest", "behance"]);
  });

  it("gives inspiration its mix share and splits the rest over the UI lanes", () => {
    // "ui" (the default): about 20%, at most 2 of 12 and 3 of 16, never 0.
    expect(Object.fromEntries(laneQuotas(12, ["fidelity", "taste", "bridge", "hero", "inspiration"]))).toEqual({
      fidelity: 3,
      taste: 3,
      bridge: 2,
      hero: 2,
      inspiration: 2,
    });
    expect(laneQuotas(16, ["fidelity", "taste", "inspiration"]).get("inspiration")).toBe(3);
    expect([4, 8, 12, 16, 24].map((n) => inspirationQuota(n, "ui"))).toEqual([1, 1, 2, 3, 4]);
    // "balanced" is the old 40%, "wild" 60%.
    expect([...laneQuotas(12, ["inspiration", "fidelity", "taste", "hero"], "balanced").values()]).toEqual([5, 3, 2, 2]);
    expect([...laneQuotas(8, ["inspiration", "fidelity", "taste"], "balanced").values()]).toEqual([3, 3, 2]);
    expect(Object.fromEntries(laneQuotas(12, ["inspiration", "fidelity", "taste", "hero"], "wild"))).toEqual({
      inspiration: 7,
      fidelity: 2,
      taste: 2,
      hero: 1,
    });
    expect([...laneQuotas(8, ["inspiration"]).values()]).toEqual([8]);
    expect([...laneQuotas(8, ["taste", "fidelity"]).values()]).toEqual([4, 4]);
  });

  it("orders lanes UI first for the ui mix, inspiration first otherwise", () => {
    const lanes = ["inspiration", "fidelity", "taste", "bridge", "hero"] as const;
    expect(laneOrder(lanes, "ui")).toEqual(["fidelity", "taste", "bridge", "hero", "inspiration"]);
    expect(laneOrder(lanes)).toEqual(laneOrder(lanes, "ui"));
    expect(laneOrder(["fidelity", "inspiration", "taste"], "balanced")).toEqual(["inspiration", "fidelity", "taste"]);
    expect(laneOrder(["fidelity", "taste"], "wild")).toEqual(["fidelity", "taste"]);
  });

  it("merges lanes round robin by quota, fills from leftovers, never repeats a key", () => {
    const ref = (id: string): Reference => ({ id, thumbUrl: `https://t/${id}`, imageUrl: `https://i/${id}`, sourceUrl: `https://s/${id}`, sourceSite: "x" });
    const lists = new Map([
      ["inspiration", ["a1", "a2", "a3", "a4"].map(ref)],
      ["taste", ["b1", "a1", "b2"].map(ref)],
      ["fidelity", [] as Reference[]],
    ] as const);
    const quotas = new Map([
      ["inspiration", 2],
      ["taste", 2],
      ["fidelity", 2],
    ] as const);
    const out = mergeLanes(lists, quotas, 6, (r) => [r.id]);
    expect(out.map((r) => r.id)).toEqual(["a1", "b1", "a2", "b2", "a3", "a4"]);
  });

  it("ui mix: UI results lead, leftovers go to UI lanes before inspiration", () => {
    const ref = (id: string): Reference => ({ id, thumbUrl: `https://t/${id}`, imageUrl: `https://i/${id}`, sourceUrl: `https://s/${id}`, sourceSite: "x" });
    const lists = new Map([
      ["fidelity", ["f1", "f2", "f3", "f4", "f5"].map(ref)],
      ["bridge", [] as Reference[]],
      ["taste", ["t1", "t2"].map(ref)],
      ["inspiration", ["i1", "i2", "i3", "i4"].map(ref)],
    ] as const);
    const quotas = laneQuotas(8, [...lists.keys()], "ui");
    expect(Object.fromEntries(quotas)).toEqual({ fidelity: 3, bridge: 2, taste: 2, inspiration: 1 });
    const out = mergeLanes(lists, quotas, 8, (r) => [r.id], { uiFirst: true });
    // The empty bridge lane's places go to fidelity, not to inspiration, and inspiration comes last.
    expect(out.map((r) => r.id)).toEqual(["f1", "t1", "f2", "t2", "f3", "f4", "f5", "i1"]);
    // Inspiration fills only when the UI lanes run dry.
    const short = mergeLanes(new Map([["taste", [ref("t1")]], ["inspiration", ["i1", "i2", "i3"].map(ref)]]), laneQuotas(4, ["taste", "inspiration"], "ui"), 4, (r) => [r.id], { uiFirst: true });
    expect(short.map((r) => r.id)).toEqual(["t1", "i1", "i2", "i3"]);
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
    // "ui" mix: the UI lanes first, round robin, then 2 of 12 from inspiration (Pinterest and Behance).
    expect(result.references.map((r) => r.lane)).toEqual([
      "fidelity",
      "taste",
      "hero",
      "fidelity",
      "taste",
      "hero",
      "fidelity",
      "taste",
      "hero",
      "fidelity",
      "inspiration",
      "inspiration",
    ]);
    expect(new Set(result.references.slice(-2).map((r) => r.sourceSite))).toEqual(new Set(["pinterest.com", "behance.net"]));
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
    expect(queries).toHaveLength(8);
    expect(queries.slice(6)).toEqual([
      `fintech app ui ${UI_NEG} site:dribbble.com/shots`,
      `fintech app ui ${UI_NEG} site:pinterest.com/pin`,
    ]);
    expect(result.requests).toBe(8);
    expect(result.report?.filter((r) => r.retried)).toHaveLength(2);
  });

  it("dedupes across lanes by shot, pin and gallery id", async () => {
    const same = {
      images: [
        { title: "A", link: "https://dribbble.com/shots/42-a", imageUrl: "https://cdn.dribbble.com/u/a.png" },
        { title: "B", link: "https://es.pinterest.com/pin/77/", imageUrl: "https://i.pinimg.com/736x/b.jpg", imageWidth: 736, imageHeight: 900 },
      ],
    };
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const q = bodyOf(init).q;
      if (q.includes("dribbble")) return jsonResponse({ images: [{ title: "A again", link: "https://dribbble.com/shots/42-a-v2", imageUrl: "https://cdn.dribbble.com/u/a2.png" }] });
      if (q.includes("pinterest")) return jsonResponse({ images: [same.images[1], { title: "B again", link: "https://www.pinterest.com/pin/77/", imageUrl: "https://i.pinimg.com/736x/b2.jpg", imageWidth: 736, imageHeight: 900 }] });
      return jsonResponse({ images: [] });
    });
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const result = await adapter.runPlan(planRequests({ inspiration: "x", fidelity: "y app ui", taste: "z card ui" }), { count: 12, userId: "u" });
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
    expect(result.references.find((r) => r.lane === "inspiration")?.query).toBe("crushed velvet");
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
      // The fifth shot of the taste request (past the lane's quota of 2) is by a creator the user liked.
      if (bodyOf(init).q.startsWith("minimal checkout")) page.images[4]!.title = "Shot 4 by Jane Doe on Dribbble";
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
    const tasteQ = buildSourceQuery(plan[2]!.query, plan[2]!.site);
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
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const { q, page } = bodyOf(init);
      // The Pinterest fidelity request is thin (a fallback case); everything else is full.
      const thin = q.startsWith("saudi fintech") && q.includes("pinterest");
      return jsonResponse(pageFor(q, thin ? 2 : 10, page === 2 ? "-p2" : ""));
    });
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const plan = planRequests(LANES);
    // Every result of the inspiration, taste and hero pages is already on the canvas: 4 exhausted requests.
    const exclude = plan
      .filter((r) => r.lane !== "fidelity")
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
    // Only 2 requests were left: both went to page 2, the thin fidelity answer got no fallback.
    expect(bodies.slice(6).every((b) => b.page === 2)).toBe(true);
    expect(result.report?.filter((r) => r.page2)).toHaveLength(2);
    expect(result.report?.some((r) => r.retried)).toBe(false);
    void adapter;
  });

  it("does not fetch page 2 for a thin answer or a short page", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => jsonResponse(pageFor(bodyOf(init).q, 3)));
    const result = await createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist }).runPlan(planRequests({ inspiration: "x" }), {
      count: 12,
      userId: "u",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.report?.some((r) => r.page2)).toBe(false);
  });
});

describe("runPlan with the bridge lane and mixes", () => {
  const BRIDGE: LaneTexts = { ...LANES, inspiration: "vending machine", bridge: "vending machine ui design" };
  /** Bridge page: Dribbble shots with the given titles. */
  const bridgePage = (q: string, titles: string[]) => ({
    images: titles.map((title, i) => ({
      title,
      link: `https://dribbble.com/shots/9${i}${q.length}-bridge`,
      imageUrl: `https://cdn.dribbble.com/u/bridge-${q.length}-${i}.png`,
    })),
  });

  it("keeps only bridge results whose title names the idea", async () => {
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
    expect(fetchMock).toHaveBeenCalledTimes(7);
    const bridge = result.references.filter((r) => r.lane === "bridge");
    expect(bridge.map((r) => r.title).sort()).toEqual(
      ["Coffee machine order screen", "Machines of loving grace", "Smart vending machines kiosk", "Snack MACHINE checkout", "Vending Machine UI by Ana on Dribbble"].sort(),
    );
    expect(result.report?.find((r) => r.lane === "bridge")).toMatchObject({ good: 5, site: "dribbble" });
    expect(result.dropped).toBeGreaterThanOrEqual(5);
  });

  it("an idea with no UI titles (sadu) leaves the bridge lane empty and its places go to the other UI lanes", async () => {
    const lanes: LaneTexts = { ...LANES, inspiration: "Sadu weaving", bridge: "Sadu weaving ui design" };
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      const q = bodyOf(init).q;
      return jsonResponse(q.startsWith("Sadu weaving ui design") ? bridgePage(q, Array.from({ length: 10 }, (_, i) => `Travel app UI ${i}`)) : pageFor(q));
    });
    const result = await createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist }).runPlan(planRequests(lanes), { count: 12, userId: "u" });
    // No page 2 and no fallback for an empty bridge: 7 requests.
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(result.report?.find((r) => r.lane === "bridge")).toMatchObject({ good: 0 });
    expect(result.references).toHaveLength(12);
    expect(result.references.some((r) => r.lane === "bridge")).toBe(false);
    expect(result.references.filter((r) => r.lane === "inspiration")).toHaveLength(2);
    expect(result.references.slice(0, 10).every((r) => r.lane !== "inspiration")).toBe(true);
  });

  it("keeps bridge, page 2 and the fallback within 8 requests, page 2 first", async () => {
    const plan = planRequests(BRIDGE);
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
    const result = await createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist }).runPlan(planRequests(BRIDGE), { count: 24, userId: "u" });
    const queries = fetchMock.mock.calls.map(([, init]) => bodyOf(init).q);
    expect(queries).toHaveLength(8);
    expect(queries.at(-1)).toBe(`fintech app ui ${UI_NEG} site:dribbble.com/shots`);
    expect(result.report?.filter((r) => r.retried)).toHaveLength(1);
  });

  it("orders and shares results by mix", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => jsonResponse(pageFor(bodyOf(init).q)));
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist });
    const count = (refs: Reference[]) => refs.filter((r) => r.lane === "inspiration").length;
    const ui = await adapter.runPlan(planRequests(LANES), { count: 16, userId: "u" });
    expect(count(ui.references)).toBe(3);
    expect(ui.references.slice(0, 13).every((r) => r.lane !== "inspiration")).toBe(true);
    const balanced = await adapter.runPlan(planRequests(LANES), { count: 12, userId: "u", mix: "balanced" });
    expect(count(balanced.references)).toBe(5);
    expect(balanced.references[0]!.lane).toBe("inspiration");
    const wild = await adapter.runPlan(planRequests(LANES), { count: 12, userId: "u", mix: "wild" });
    expect(count(wild.references)).toBe(7);
    expect(wild.references[0]!.lane).toBe("inspiration");
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

