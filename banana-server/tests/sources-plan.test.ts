import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_IMAGE_HOSTS,
  NOTES,
  SERPER_MAX_REQUESTS,
  buildSourceQuery,
  createWebSearchAdapter,
  laneQuotas,
  mergeLanes,
  parseAllowlist,
  planRequests,
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

  it("gives inspiration about 40% and splits the rest", () => {
    expect([...laneQuotas(12, ["inspiration", "fidelity", "taste", "hero"]).values()]).toEqual([5, 3, 2, 2]);
    expect([...laneQuotas(8, ["inspiration", "fidelity", "taste"]).values()]).toEqual([3, 3, 2]);
    expect([...laneQuotas(8, ["inspiration"]).values()]).toEqual([8]);
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
    // Inspiration first, then the UI lanes, round robin.
    expect(result.references[0]!.sourceSite).toBe("pinterest.com");
    expect(new Set(result.references.map((r) => r.sourceSite))).toEqual(new Set(["pinterest.com", "dribbble.com", "behance.net"]));
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
});
