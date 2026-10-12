/**
 * Wild directions v2 search (2026-10-12): art zone, platform-aware UI lanes, curated gallery
 * registry, studio cap, recency, kit drop, no default taste. Pure; Serper is faked.
 */
import { describe, expect, it } from "vitest";
import { laneTexts } from "@/lib/bend/queries";
import { creatorKeys } from "@/lib/learning/creator";
import { directionLanes } from "@/lib/mcp/tools/search_references";
import {
  DEFAULT_IMAGE_HOSTS,
  SOURCE_SITES,
  artQuota,
  byZone,
  capByCreator,
  createWebSearchAdapter,
  galleryWords,
  isArtJunk,
  isItemPage,
  isKitTitle,
  isUiResult,
  mapSerperImagesWithStats,
  mergeLanes,
  parseAllowlist,
  plainQueryPlan,
  planRequests,
  rankReferences,
  recencyScore,
  zoneQuotas,
  type FetchLike,
  type LaneName,
  type Reference,
} from "@/lib/sources";
import { EMPTY_TAKEDOWNS } from "@/lib/takedown";
import { SOURCE_REGISTRY, pickGalleries, sourceEntry } from "@/lib/sources/registry";
import { DEFAULT_TASTE } from "@/lib/taste";

const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);
const IPHONE = "Personal finance app for iPhone: home screen with balance, spending insights and savings goals";

const ref = (id: string, over: Partial<Reference> = {}): Reference => ({
  id,
  thumbUrl: `https://cdn.dribbble.com/${id}.png`,
  imageUrl: `https://cdn.dribbble.com/${id}.png`,
  sourceUrl: `https://dribbble.com/shots/${id}`,
  sourceSite: "dribbble.com",
  ...over,
});

describe("UI lanes per platform", () => {
  it("mobile: app ui wording, drops web, dashboard and landing titles unless the brief says so", () => {
    const lanes = laneTexts(IPHONE, "Korean bojagi", [], "k", { platform: "mobile" });
    expect(lanes.fidelity).toBe("personal finance app ui");
    expect(lanes.avoid).toEqual(expect.arrayContaining(["web", "website", "dashboard", "landing", "desktop", "saas"]));
    expect(laneTexts("Mobile dashboard app for a gym", "x", [], "k", { platform: "mobile" }).avoid).not.toContain("dashboard");
    const plan = planRequests(lanes);
    expect(plan.filter((r) => r.lane !== "art").every((r) => r.avoidWords?.includes("web"))).toBe(true);
  });

  it("tablet uses ipad wording; webapp uses dashboard wording and drops mobile only titles", () => {
    expect(laneTexts("Recipe app for iPad", "x", [], "k").fidelity).toBe("recipe ipad app ui");
    const webapp = laneTexts("B2B analytics web app", "x", [], "k");
    expect(webapp.platform).toBe("webapp");
    expect(webapp.fidelity).toBe("analytics dashboard ui");
    expect(webapp.avoid).toEqual(expect.arrayContaining(["mobile", "ios", "android", "iphone"]));
  });

  it("website and web app briefs search curated galleries instead of the Pinterest fidelity page", () => {
    const site = laneTexts("AI note-taking landing page", "holographic foil", [], "k1");
    expect(site.platform).toBe("website");
    const plan = planRequests(site, undefined, { zone: "ui" });
    expect(plan[0]).toMatchObject({ lane: "fidelity", site: "dribbble" });
    expect(plan[1]!.lane).toBe("gallery");
    expect(sourceEntry(plan[1]!.site).platforms).toContain("website");
    expect(plan.some((r) => r.lane === "fidelity" && r.site === "pinterest")).toBe(false);
    const app = planRequests(laneTexts("B2B analytics web app", "x", [], "k"), undefined, { zone: "ui" });
    expect(["refero", "saasframe", "nicelydone"]).toContain(app[1]!.site);
  });

  it("filters titles by the platform words in runPlan", async () => {
    const fetch: FetchLike = async () =>
      new Response(
        JSON.stringify({
          images: [
            { title: "Finance web ui design", link: "https://dribbble.com/shots/20000001-a", imageUrl: "https://cdn.dribbble.com/a.png" },
            { title: "Finance app ui", link: "https://dribbble.com/shots/20000002-b", imageUrl: "https://cdn.dribbble.com/b.png" },
            { title: "SaaS Dashboard", link: "https://dribbble.com/shots/20000003-c", imageUrl: "https://cdn.dribbble.com/c.png" },
          ],
        }),
        { status: 200 },
      );
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch, allowlist });
    const res = await adapter.runPlan([{ lane: "fidelity", query: "finance app ui", site: "dribbble", avoidWords: ["web", "dashboard", "saas"] }], { count: 12, userId: "u" });
    expect(res.references.map((r) => r.title)).toEqual(["Finance app ui"]);
    expect(res.dropped).toBe(2);
  });
});

describe("no default taste for direction searches", () => {
  it("uses the user's taste, else the direction's style words, else no taste lane", () => {
    expect(laneTexts(IPHONE, "x", ["monochrome"], "k").taste).toBe("monochrome personal finance card ui design");
    expect(laneTexts(IPHONE, "x", [], "k", { styleWords: ["swiss style"] }).taste).toBe("swiss style personal finance card ui design");
    const none = laneTexts(IPHONE, "x", [], "k");
    expect(none.taste).toBeUndefined();
    expect(JSON.stringify(none)).not.toMatch(new RegExp(DEFAULT_TASTE.join("|")));
    expect(planRequests(none).some((r) => r.lane === "taste")).toBe(false);
  });

  it("a saved direction reads its platform, style words and art queries from its detail", () => {
    const lanes = directionLanes(
      {
        id: "d",
        searchQuery: "Korean bojagi",
        brief: "Personal finance home screen",
        detail: { platform: "mobile", artQueries: ["korean bojagi", "bojagi patchwork"], spec: { styleWords: ["bento grid"] } as never },
      },
      [],
    );
    expect(lanes.platform).toBe("mobile");
    expect(lanes.art).toEqual(["korean bojagi", "bojagi patchwork"]);
    expect(lanes.taste).toMatch(/^bento grid /);
    expect(lanes.galleries).toContain("bentogrids");
    // No detail: the idea itself is the art query.
    expect(directionLanes({ id: "d2", searchQuery: "synthwave 1984", brief: "Finance app" }, []).art).toEqual(["synthwave 1984"]);
  });
});

describe("art zone", () => {
  it("plans art queries raw on Pinterest pins and Behance galleries, about a third of the results", () => {
    const lanes = { ...laneTexts(IPHONE, "Korean bojagi", [], "k"), art: ["korean bojagi", "bojagi patchwork"] };
    const both = planRequests(lanes);
    expect(both.length).toBeLessThanOrEqual(7);
    expect(both.slice(0, 4).map((r) => r.lane)).toEqual(["fidelity", "art", "fidelity", "art"]);
    expect(both.filter((r) => r.lane === "art").map((r) => r.site)).toEqual(["pinterest", "behance"]);
    expect(both.find((r) => r.lane === "art")!.query).toBe("korean bojagi -etsy -amazon -aliexpress -sale -buy");
    const art = planRequests(lanes, undefined, { zone: "art" });
    expect(art.every((r) => r.lane === "art")).toBe(true);
    expect(art.map((r) => r.query.split(" -")[0])).toEqual(["korean bojagi", "korean bojagi", "bojagi patchwork", "bojagi patchwork"]);
    expect(planRequests(lanes, undefined, { zone: "ui" }).some((r) => r.lane === "art")).toBe(false);
    // No art site picked: no art requests.
    expect(planRequests(lanes, ["dribbble"]).some((r) => r.lane === "art")).toBe(false);
    expect([8, 12, 16, 24].map(artQuota)).toEqual([3, 4, 5, 8]);
  });

  it("the junk gate drops shops, prices, fashion, product listings, logo sheets and stock tag lists", () => {
    for (const title of [
      "Vintage Korean bojagi seed packets",
      "Uzbek suzani jacket, women's coat",
      "Sadu pattern car air freshener",
      "Handmade bojagi wrapping cloth $45.00",
      "Bojagi table runner - Etsy",
      "Persian rug 8x10 hand knotted",
      "Holographic Foils Collection & Sample Pack - 1 Foot Collection: 12 x 1",
      "Choose Your New Retro Kitchen! Visit NewRetro.Net",
      "80s,abstract,art,backdrop,background,banner,blue,blur,burst",
      "Minimal logo set for brands",
      "Stunning Holographic Foil Printing for Business Cards",
      "Synthwave stock photo",
      "Buy Persian rugs online",
      "Pillar Black Holographic Foil - Roll (12-inch x 15 ft.)",
    ]) {
      expect(isArtJunk(title, "korean bojagi"), title).toBe(true);
    }
    for (const title of ["Bojagi / 보자기", "Korean quilting aka Bojagi or Pojagi", "Persian Rug Collection :: Behance", "Neon Skyline 1984 – Retro City Glow", undefined]) {
      expect(isArtJunk(title, "persian rug"), String(title)).toBe(false);
    }
    // A product word the art query names is not junk ("rug" for a rug idea), but shop words always are.
    expect(isArtJunk("Antique Persian Heriz rug", "persian rug")).toBe(false);
    expect(isArtJunk("Antique pillow cover", "persian rug")).toBe(true);
  });

  it("art results skip the UI gate, pass the junk gate, and carry zone art; UI comes first", async () => {
    const fetch: FetchLike = async (_url, init) => {
      const q = JSON.parse(String(init?.body)).q as string;
      const images = q.includes("pinterest")
        ? [
            { title: "Bojagi / 보자기", link: "https://www.pinterest.com/pin/111/", imageUrl: "https://i.pinimg.com/736x/a.jpg", imageWidth: 736, imageHeight: 1000 },
            { title: "Bojagi seed packets", link: "https://www.pinterest.com/pin/112/", imageUrl: "https://i.pinimg.com/736x/b.jpg", imageWidth: 736, imageHeight: 1000 },
          ]
        : [{ title: "Finance app ui", link: "https://dribbble.com/shots/25000001-a", imageUrl: "https://cdn.dribbble.com/a.png" }];
      return new Response(JSON.stringify({ images }), { status: 200 });
    };
    const adapter = createWebSearchAdapter({ apiKey: "k", fetch, allowlist });
    const res = await adapter.runPlan(
      [
        { lane: "art", query: "korean bojagi -etsy", site: "pinterest", ideaWord: "bojagi" },
        { lane: "fidelity", query: "finance app ui", site: "dribbble" },
      ],
      { count: 12, userId: "u" },
    );
    expect(res.references.map((r) => [r.zone, r.lane, r.title])).toEqual([
      ["ui", "fidelity", "Finance app ui"],
      ["art", "art", "Bojagi / 보자기"],
    ]);
  });

  it("zone quotas keep art to its share and give an empty UI lane's places to UI first", () => {
    const quotas = zoneQuotas(12, ["fidelity", "taste", "art"]);
    expect(quotas.get("art")).toBe(4);
    expect((quotas.get("fidelity") ?? 0) + (quotas.get("taste") ?? 0)).toBe(8);
    const lists = new Map<LaneName, Reference[]>([
      ["fidelity", Array.from({ length: 12 }, (_, i) => ref(`f${i}`))],
      ["taste", []],
      ["art", Array.from({ length: 12 }, (_, i) => ref(`a${i}`, { zone: "art", lane: "art" }))],
    ]);
    const merged = mergeLanes(lists, quotas, 12, (r) => [r.id]);
    expect(merged.filter((r) => r.id.startsWith("a"))).toHaveLength(4);
    expect(byZone([ref("a", { zone: "art" }), ref("u")]).map((r) => r.id)).toEqual(["u", "a"]);
  });
});

describe("studio cap, recency and kits", () => {
  it("caps a creator or studio at 2 per search", () => {
    expect(creatorKeys("Finance App by Jane Doe for Orbix Studio on Dribbble")).toEqual(["jane doe", "orbix studio"]);
    expect(creatorKeys("Dashboard by Orbix Studio on Dribbble")).toEqual(["orbix studio"]);
    const titles = [
      "Fintech app by Orbix Studio on Dribbble",
      "Banking app by Ann for Orbix Studio on Dribbble",
      "Wallet app by Bob for Orbix Studio on Dribbble",
      "Crypto app by Nixtio on Dribbble",
      "Untitled shot",
    ];
    const refs = titles.map((title, i) => ref(`r${i}`, { title }));
    expect(capByCreator(refs).map((r) => r.id)).toEqual(["r0", "r1", "r3", "r4"]);
    const lists = new Map<LaneName, Reference[]>([["fidelity", refs]]);
    expect(mergeLanes(lists, new Map([["fidelity", 5]]), 5, (r) => [r.id], { groupsOf: (r) => creatorKeys(r.title) })).toHaveLength(4);
  });

  it("ranks newer work first: higher Dribbble and Behance ids, recent Awwwards years, no old title years", () => {
    const old = ref("old", { sourceUrl: "https://dribbble.com/shots/3000000-old", title: "Finance app ui" });
    const fresh = ref("new", { sourceUrl: "https://dribbble.com/shots/26000000-new", title: "Finance app ui" });
    expect(rankReferences([old, fresh], { year: 2026 }).map((r) => r.id)).toEqual(["new", "old"]);
    expect(recencyScore({ sourceUrl: "https://www.behance.net/gallery/40000000/x", imageUrl: "x", title: "" }, 2026)).toBeLessThan(0);
    expect(recencyScore({ sourceUrl: "https://www.behance.net/gallery/200000000/x", imageUrl: "x", title: "" }, 2026)).toBeGreaterThan(0);
    expect(recencyScore({ sourceUrl: "https://www.awwwards.com/sites/a", imageUrl: "https://assets.awwwards.com/awards/element/2025/02/a.jpg" }, 2026)).toBeGreaterThan(0);
    expect(recencyScore({ sourceUrl: "https://x.test/a", imageUrl: "x", title: "Banking dashboard 2016" }, 2026)).toBeLessThan(0);
  });

  it("drops kit and template titles", () => {
    for (const t of ["Fashion Editorial UI Kit for Adobe XD", "Dashboard Template", "Finance Figma kit", "Freebie: banking app", "Wireframe kit", "Free Fitness App Ui Kit"]) {
      expect(isKitTitle(t), t).toBe(true);
    }
    for (const t of ["Banking app ui", "Kitchen timer app", "Template-free checkout"]) expect(isKitTitle(t), t).toBe(t === "Template-free checkout");
    const mapped = mapSerperImagesWithStats(
      [
        { title: "Fashion Editorial UI Kit for Adobe XD", link: "https://www.behance.net/gallery/65000000/kit", imageUrl: "https://mir-s3-cdn-cf.behance.net/a.jpg", imageWidth: 1400, imageHeight: 1000 },
        { title: "Fashion app ui", link: "https://www.behance.net/gallery/190000000/app", imageUrl: "https://mir-s3-cdn-cf.behance.net/b.jpg", imageWidth: 1400, imageHeight: 1000 },
      ],
      { sources: ["behance"], allowlist, takedowns: EMPTY_TAKEDOWNS, count: 10 },
    );
    expect(mapped.references.map((r) => r.title)).toEqual(["Fashion app ui"]);
    expect(mapped.dropped).toBe(1);
  });
});

describe("source registry", () => {
  it("every source is one entry: enum, scope, item pages and image hosts derive from it", () => {
    expect(SOURCE_SITES).toEqual(SOURCE_REGISTRY.map((s) => s.id));
    for (const s of SOURCE_REGISTRY) {
      for (const host of s.imageHosts) {
        expect(DEFAULT_IMAGE_HOSTS).toContain(host);
        expect(host).not.toMatch(/^\*|^\./);
      }
      expect(s.measured.items).toBeLessThanOrEqual(s.measured.results);
      expect(s.measured.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("checks item pages per gallery and drops list pages", () => {
    const yes: [string, (typeof SOURCE_SITES)[number]][] = [
      ["https://www.lapa.ninja/post/voicenotes/", "lapa"],
      ["https://refero.design/pages/b524be54-d650-4d50-a032-62f02392d36d", "refero"],
      ["https://www.siteinspire.com/website/12863-defiant", "siteinspire"],
      ["https://supahero.io/hero/daisy-ai", "supahero"],
      ["https://bentogrids.com/shots/clt45x72z0002y6nxvxwfaaqx", "bentogrids"],
      ["https://fontsinuse.com/uses/24586/i-ny-catskills", "fontsinuse"],
      ["https://www.cssdesignawards.com/sites/osmo/48438/", "cssda"],
      ["https://www.awwwards.com/sites/fintech-w", "awwwards"],
    ];
    for (const [url, site] of yes) expect(isItemPage(new URL(url), site), url).toBe(true);
    const no: [string, (typeof SOURCE_SITES)[number]][] = [
      ["https://www.lapa.ninja/category/fashion/", "lapa"],
      ["https://www.siteinspire.com/websites/category/technology", "siteinspire"],
      ["https://refero.design/search", "refero"],
      ["https://bentogrids.com/", "bentogrids"],
      ["https://www.awwwards.com/sites/search", "awwwards"],
      ["https://evil.test/post/voicenotes/", "lapa"],
    ];
    for (const [url, site] of no) expect(isItemPage(new URL(url), site), url).toBe(false);
  });

  it("gallery items pass the UI gate by definition, except Figma, whose titles must name a UI", () => {
    expect(isUiResult("Voicenotes - Landing Page Design | Lapa Ninja", "https://www.lapa.ninja/post/voicenotes/")).toBe(true);
    expect(isUiResult("Defiant | Web Design Inspiration | Siteinspire", "https://www.siteinspire.com/website/12863-defiant")).toBe(true);
    expect(isUiResult("Fundrix - 3D Finance Illustration Icon Set | Figma", "https://www.figma.com/community/file/1452132616012397263/fundrix")).toBe(false);
    expect(isUiResult("Finance Graphics Visual Assets | Figma", "https://www.figma.com/community/file/1270312531909729525/finance-graphics")).toBe(false);
    expect(isUiResult("Fitness App Ui | Figma", "https://www.figma.com/community/file/1401461975821086578/fitness-app-ui")).toBe(true);
  });

  it("routes galleries by style words and platform, rotating per direction; art galleries by the art queries", () => {
    expect(pickGalleries({ platform: "mobile", styleWords: ["bento grid"], key: "a" }).ui[0]).toBe("bentogrids");
    expect(pickGalleries({ platform: "website", styleWords: ["dark mode"], key: "a" }).ui[0]).toBe("darkdesign");
    // Dark Design is a website gallery: a phone brief does not get it.
    expect(pickGalleries({ platform: "mobile", styleWords: ["dark mode"], key: "a" }).ui).not.toContain("darkdesign");
    const webapp = pickGalleries({ platform: "webapp", key: "a" }).ui;
    expect(webapp.every((s) => sourceEntry(s).platforms.includes("webapp" as never))).toBe(true);
    const firsts = new Set(["a", "b", "c", "d", "e", "f"].map((key) => pickGalleries({ platform: "website", key }).ui[0]));
    expect(firsts.size).toBeGreaterThan(1);
    expect(pickGalleries({ key: "a", styleWords: ["big typography"] }).art).toEqual([]);
    expect(pickGalleries({ key: "a", artText: ["swiss style concert poster"] }).art).toHaveLength(1);
    expect(galleryWords("lapa", "fintech app ui -template -kit")).toBe("fintech");
    expect(galleryWords("swissted", "anything")).toBe("poster");
  });

  it("spreads picked sources round robin, so awwwards plus behance searches both", () => {
    const plan = plainQueryPlan("brutalist landing page", ["awwwards", "behance"]);
    expect(new Set(plan.map((r) => r.site))).toEqual(new Set(["awwwards", "behance"]));
    expect(plan.find((r) => r.site === "awwwards")!.query).toBe("brutalist landing page");
    const forced = plainQueryPlan("teletext 1980s", ["awwwards", "behance"]);
    expect(new Set(forced.map((r) => r.site))).toEqual(new Set(["awwwards", "behance"]));
    expect(forced.find((r) => r.site === "awwwards")!.query).not.toMatch(/app ui|-template/);
  });
});

describe("21st.dev gallery", async () => {
  const { galleryWords } = await import("@/lib/sources/plan");
  const { isItemPage } = await import("@/lib/sources/item-page");
  it("adds its suffix so component pages come back, not list pages", () => {
    expect(galleryWords("21st" as never, "pricing ui design -template")).toBe("pricing community component");
  });
  it("keeps component pages and drops list pages", () => {
    expect(isItemPage(new URL("https://21st.dev/@yura/components/blackhole-hero-section"), "21st" as never)).toBe(true);
    expect(isItemPage(new URL("https://21st.dev/community/components/s/hero"), "21st" as never)).toBe(false);
  });
});
