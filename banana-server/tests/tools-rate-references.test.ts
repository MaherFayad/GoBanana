/**
 * rate_references and the learning it feeds, end to end over in-memory repos: bend_brief saves
 * directions, search_references (real adapter, mocked Serper) fills the tray with lane details,
 * ratings block bad items and remove them from the tray, a lane-only re-search records an arm,
 * and later searches use what was learned.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBendBriefTool } from "@/lib/mcp/tools/bend_brief";
import { createRateReferencesTool, inputSchema, TOOL_DESCRIPTION } from "@/lib/mcp/tools/rate_references";
import { createDbDeps, createSearchReferencesTool } from "@/lib/mcp/tools/search_references";
import { DEFAULT_IMAGE_HOSTS, createWebSearchAdapter, itemKey, parseAllowlist, type FetchLike } from "@/lib/sources";
import type { CanvasState } from "@/canvas/types";
import { ALICE, APP, BOB, makeDeps, NOW, seedCanvas, text } from "./tools-fixtures";

const CAROL = "44444444-4444-4444-8444-444444444444";
const DAVE = "55555555-5555-4555-8555-555555555555";
const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);

const bodyOf = (init?: RequestInit) => JSON.parse(String(init?.body)) as { q: string; num: number; page?: number };

/** A full Serper page of item pages on the site the query asks for; titles name a creator. */
function serperPage(q: string, page = 1) {
  const site = /site:(\S+)/.exec(q)![1]!;
  const slug = `${q.split(" site:")[0]}-p${page}`.replace(/\W+/g, "-");
  const h = [...slug].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 1_000_000, 7);
  return {
    images: Array.from({ length: 10 }, (_, i) => {
      const id = `${h}${i}`;
      const title = `Shot ${i} by Maker ${i % 3} on Dribbble`;
      if (site.startsWith("dribbble")) return { title, link: `https://dribbble.com/shots/${id}-${slug}`, imageUrl: `https://cdn.dribbble.com/u/${slug}-${i}.png` };
      if (site.startsWith("behance")) {
        return { title: `Project ${i}`, link: `https://www.behance.net/gallery/${id}/${slug}`, imageUrl: `https://mir-s3-cdn-cf.behance.net/p/${slug}-${i}.jpg`, imageWidth: 1400, imageHeight: 1000 };
      }
      return { title, link: `https://www.pinterest.com/pin/${id}/`, imageUrl: `https://i.pinimg.com/736x/${slug}-${i}.jpg`, imageWidth: 736, imageHeight: 1000 };
    }),
  };
}

function setup(env: { global?: boolean } = {}) {
  const { deps, repos } = makeDeps();
  // Arm picks are seeded by user and day; tests move the day to see several picks.
  const clock = { now: NOW };
  const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
    const { q, page } = bodyOf(init);
    return new Response(JSON.stringify(serperPage(q, page ?? 1)), { status: 200 });
  });
  const searchDeps = {
    ...createDbDeps(repos, () => APP),
    adapter: createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist }),
    now: () => clock.now,
    ...(env.global === false ? { globalLearning: () => false } : {}),
  };
  return {
    repos,
    clock,
    fetchMock,
    search: createSearchReferencesTool(searchDeps),
    rate: createRateReferencesTool(deps),
    bend: createBendBriefTool(() => ({ repos })),
  };
}

type Ref = { id: string; lane?: string; sourceUrl: string; title?: string; query?: string };
type SearchOut = { references: Ref[]; arms?: Record<string, string>; learned?: boolean; queries: string[]; lane?: string };

async function boardWithDirection(s: ReturnType<typeof setup>, userId: string) {
  const c = await seedCanvas(s.repos, userId);
  const bent = await s.bend({ brief: "flight checkout screen", wildness: 3, canvasId: c.id }, userId);
  const dir = (bent.structuredContent as { directions: { id: string; searchQuery: string }[] }).directions[0]!;
  return { canvasId: c.id, directionId: dir.id, ingredient: dir.searchQuery };
}

const trayOf = async (s: ReturnType<typeof setup>, userId: string, canvasId: string) =>
  ((await s.repos.canvases.getOwned(userId, canvasId))!.state as CanvasState).tray;

afterEach(() => vi.unstubAllEnvs());

describe("rate_references tool", () => {
  it("has plain copy and validates input with plain messages", async () => {
    expect(TOOL_DESCRIPTION).not.toMatch(/[\u2014\u2013]/);
    expect(TOOL_DESCRIPTION).toContain("Free");
    expect(inputSchema.safeParse({ ratings: [] }).success).toBe(false);
    expect(inputSchema.safeParse({ ratings: Array.from({ length: 51 }, () => ({ referenceId: "ref_1", verdict: "bad" })) }).success).toBe(false);
    const { rate } = setup();
    expect(text(await rate({ ratings: [{ referenceId: "ref_1", verdict: "meh" }] }, ALICE))).toContain("verdict of great or bad");
    expect(text(await rate({ ratings: [{ referenceId: "ref_1", verdict: "bad", reasons: ["ugly"] }] }, ALICE))).toContain("Reasons:");
    expect((await rate({ ratings: [{ referenceId: "ref_1", verdict: "bad" }] }, undefined)).isError).toBe(true);
  });

  it("bad removes from the tray and blocks the item; great stays; one feedback row each, free", async () => {
    const s = setup();
    const b = await boardWithDirection(s, ALICE);
    const res = await s.search({ directionId: b.directionId, canvasId: b.canvasId }, ALICE);
    const refs = (res.structuredContent as SearchOut).references;
    // Ids and lanes are in the text so the agent can rate.
    expect(text(res)).toContain(`[${refs[0]!.id}, ${refs[0]!.lane}]`);
    expect(text(res)).toContain("rate_references");
    const [bad1, bad2, good] = [refs[0]!, refs[1]!, refs[2]!];
    const usageBefore = await s.repos.usage.get(ALICE, "2026-10");

    const rated = await s.rate(
      {
        canvasId: b.canvasId,
        ratings: [
          { referenceId: bad1.id, verdict: "bad", reasons: ["off_topic"] },
          { referenceId: bad2.id, verdict: "bad", reasons: ["stock_or_shop", "stock_or_shop"] },
          { referenceId: good.id, verdict: "great", reasons: ["great_craft"] },
        ],
      },
      ALICE,
    );
    expect(rated.isError).toBeFalsy();
    const out = rated.structuredContent as { rated: number; great: number; bad: number; blocked: number; removedFromTray: number; hints: { referenceId: string; lane: string; hint: string }[] };
    expect(out).toMatchObject({ rated: 3, great: 1, bad: 2, blocked: 2, removedFromTray: 2 });
    expect(out.hints.map((h) => h.referenceId)).toEqual([bad1.id, bad2.id]);
    expect(out.hints[0]!.lane).toBe(bad1.lane);
    expect(out.hints[0]!.hint).toContain(`lane "${bad1.lane}"`);
    expect(text(rated)).toContain("will not come back");

    const tray = await trayOf(s, ALICE, b.canvasId);
    expect(tray.some((t) => t.id === bad1.id || t.id === bad2.id)).toBe(false);
    expect(tray.some((t) => t.id === good.id)).toBe(true);
    expect(await s.repos.blocklist.list(ALICE)).toEqual([itemKey(bad1.sourceUrl), itemKey(bad2.sourceUrl)]);

    // One row per rating with how the result was found; reasons deduped.
    expect(s.repos.data.feedback).toHaveLength(3);
    const row = s.repos.data.feedback.find((f) => f.itemKey === itemKey(bad2.sourceUrl))!;
    expect(row).toMatchObject({ userId: ALICE, verdict: "bad", reasons: ["stock_or_shop"], lane: bad2.lane, query: bad2.query });
    expect(row.termKey).toMatch(new RegExp(`^${bad2.lane}\\|`));
    expect(row.arm).toBe(bad2.lane === "inspiration" ? "raw@pinterest+behance" : "default");
    expect(s.repos.data.feedback.find((f) => f.verdict === "great")!.creator).toMatch(/^maker \d$/);
    // Free: no search counted.
    expect(await s.repos.usage.get(ALICE, "2026-10")).toEqual(usageBefore);
  });

  it("refuses another user's references and canvas", async () => {
    const s = setup();
    const b = await boardWithDirection(s, ALICE);
    const refs = ((await s.search({ directionId: b.directionId, canvasId: b.canvasId }, ALICE)).structuredContent as SearchOut).references;
    // Bob names Alice's canvas: not found.
    const viaCanvas = await s.rate({ canvasId: b.canvasId, ratings: [{ referenceId: refs[0]!.id, verdict: "bad" }] }, BOB);
    expect(viaCanvas.isError).toBe(true);
    expect(text(viaCanvas)).toContain("canvas was not found");
    // Bob without a canvas: the id is not on his canvases.
    const bare = await s.rate({ ratings: [{ referenceId: refs[0]!.id, verdict: "bad" }] }, BOB);
    expect(bare.structuredContent).toMatchObject({ rated: 0, notFound: [refs[0]!.id] });
    expect(s.repos.data.feedback).toHaveLength(0);
    expect(await s.repos.blocklist.list(BOB)).toEqual([]);
    expect((await trayOf(s, ALICE, b.canvasId)).some((t) => t.id === refs[0]!.id)).toBe(true);
  });

  it("finds the user's own references without a canvasId and blocks them in every later search", async () => {
    const s = setup();
    const b = await boardWithDirection(s, ALICE);
    const first = ((await s.search({ directionId: b.directionId, canvasId: b.canvasId }, ALICE)).structuredContent as SearchOut).references;
    // The "ui" mix lists UI lanes first: block two of them and the two inspiration results.
    const blocked = [...first.filter((r) => r.lane !== "inspiration").slice(0, 2), ...first.filter((r) => r.lane === "inspiration").slice(0, 2)];
    expect(blocked).toHaveLength(4);
    const res = await s.rate({ ratings: blocked.map((r) => ({ referenceId: r.id, verdict: "bad" as const })) }, ALICE);
    expect(res.structuredContent).toMatchObject({ rated: 4, bad: 4, blocked: 4, removedFromTray: 0 });
    const keys = new Set(blocked.map((r) => itemKey(r.sourceUrl)));

    // A new canvas (no canvas exclusion), the same direction ingredient, and a plain query search.
    const c2 = await seedCanvas(s.repos, ALICE, undefined, "Second");
    const bent = await s.bend({ brief: "flight checkout screen", wildness: 3, canvasId: c2.id }, ALICE);
    const dir2 = (bent.structuredContent as { directions: { id: string }[] }).directions[0]!;
    const again = ((await s.search({ directionId: dir2.id, canvasId: c2.id }, ALICE)).structuredContent as SearchOut).references;
    expect(again.length).toBeGreaterThan(0);
    expect(again.some((r) => keys.has(itemKey(r.sourceUrl)))).toBe(false);
    const plain = ((await s.search({ query: b.ingredient }, ALICE)).structuredContent as SearchOut).references;
    expect(plain.some((r) => keys.has(itemKey(r.sourceUrl)))).toBe(false);
    // Bob still sees them.
    const bobs = ((await s.search({ query: b.ingredient }, BOB)).structuredContent as SearchOut).references;
    expect(bobs.some((r) => keys.has(itemKey(r.sourceUrl)))).toBe(true);
  });
});

describe("lane-only re-search and learned arms", () => {
  it("re-searches one lane with the agent's words and records them as an arm of the lane's term", async () => {
    const s = setup();
    const b = await boardWithDirection(s, ALICE);
    await s.search({ directionId: b.directionId, canvasId: b.canvasId }, ALICE);
    const calls = s.fetchMock.mock.calls.length;

    const res = await s.search(
      { directionId: b.directionId, canvasId: b.canvasId, lane: "inspiration", query: "35mm Film Strip macro site:pinterest.com" },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    const out = res.structuredContent as SearchOut & { query: string };
    expect(out.lane).toBe("inspiration");
    expect(out.query).toBe("35mm film strip macro");
    expect(out.arms).toEqual({ inspiration: "agent:35mm film strip macro" });
    expect(out.learned).toBe(false);
    expect(out.queries).toEqual(["35mm film strip macro site:pinterest.com/pin", "35mm film strip macro site:behance.net/gallery"]);
    expect(s.fetchMock.mock.calls.length - calls).toBe(2);
    expect(out.references.every((r) => r.lane === "inspiration")).toBe(true);
    expect(text(res)).toContain('the inspiration lane "35mm film strip macro"');

    // Saved with the direction's term key and the agent arm.
    const rows = [...s.repos.data.references.values()].filter((r) => r.arm?.startsWith("agent:"));
    expect(rows.length).toBe(out.references.length);
    expect(rows.every((r) => r.termKey === `inspiration|${b.ingredient.toLowerCase()}` && r.query === "35mm film strip macro")).toBe(true);
    // It is a search: counted.
    expect((await s.repos.usage.get(ALICE, "2026-10")).searches).toBe(2);
  });

  it("checks the lane input", async () => {
    const s = setup();
    const b = await boardWithDirection(s, ALICE);
    expect(text(await s.search({ directionId: b.directionId, lane: "taste" }, ALICE))).toContain("pass directionId, lane and query");
    expect(text(await s.search({ query: "x", lane: "taste" }, ALICE))).toContain("pass directionId, lane and query");
    expect(text(await s.search({ directionId: b.directionId, lane: "taste", query: "site:dribbble.com" }, ALICE))).toContain("Pass a few words");
    expect(text(await s.search({ directionId: b.directionId, lane: "locale", query: "arabic ui" }, ALICE))).toContain("has no locale lane");
    expect(text(await s.search({ directionId: b.directionId, lane: "sideways", query: "x" } as unknown as Parameters<typeof s.search>[0], ALICE))).toContain("lane as one of");
  });

  it("uses a rated arm for its rater, not for others below 3 raters, and for everyone at 3", async () => {
    const s = setup();
    const raters = [ALICE, BOB, CAROL];
    const boards = new Map<string, Awaited<ReturnType<typeof boardWithDirection>>>();
    const rateLane = async (userId: string) => {
      const b = await boardWithDirection(s, userId);
      boards.set(userId, b);
      const res = await s.search({ directionId: b.directionId, canvasId: b.canvasId, lane: "inspiration", query: "35mm film strip macro", count: 12 }, userId);
      const refs = (res.structuredContent as SearchOut).references;
      await s.rate({ canvasId: b.canvasId, ratings: refs.map((r) => ({ referenceId: r.id, verdict: "great" as const })) }, userId);
    };
    const armFor = async (userId: string) => {
      const b = boards.get(userId) ?? (await boardWithDirection(s, userId));
      boards.set(userId, b);
      return (await s.search({ directionId: b.directionId, canvasId: b.canvasId }, userId)).structuredContent as SearchOut;
    };
    /** Dave's inspiration arm on each of 10 days. */
    const daveOverDays = async () => {
      const arms: string[] = [];
      for (let d = 0; d < 10; d++) {
        s.clock.now = new Date(NOW.getTime() + d * 86_400_000);
        arms.push((await armFor(DAVE)).arms!.inspiration!);
      }
      s.clock.now = NOW;
      return arms;
    };

    await rateLane(ALICE);
    const alice = await armFor(ALICE);
    expect(alice.arms!.inspiration).toBe("agent:35mm film strip macro");
    expect(alice.learned).toBe(true);
    expect(alice.queries[0]).toBe("35mm film strip macro site:pinterest.com/pin");
    // Dave has rated nothing: one or two raters are not enough, on any day.
    expect(await armFor(DAVE)).toMatchObject({ learned: false, arms: { inspiration: "raw@pinterest+behance" } });
    await rateLane(BOB);
    expect(new Set(await daveOverDays())).toEqual(new Set(["raw@pinterest+behance"]));

    // Three raters (one vote each): the arm now competes for Dave too.
    await rateLane(CAROL);
    const days = await daveOverDays();
    expect(days.filter((a) => a === "agent:35mm film strip macro").length).toBeGreaterThan(2);
    expect(raters).toHaveLength(3);
  });

  it("with GLOBAL_LEARNING off, other users' ratings never steer a search", async () => {
    const s = setup({ global: false });
    for (const userId of [ALICE, BOB, CAROL]) {
      const b = await boardWithDirection(s, userId);
      const refs = ((await s.search({ directionId: b.directionId, canvasId: b.canvasId, lane: "inspiration", query: "35mm film strip macro" }, userId)).structuredContent as SearchOut).references;
      await s.rate({ canvasId: b.canvasId, ratings: refs.map((r) => ({ referenceId: r.id, verdict: "great" as const })) }, userId);
    }
    const d = await boardWithDirection(s, DAVE);
    const dave = (await s.search({ directionId: d.directionId, canvasId: d.canvasId }, DAVE)).structuredContent as SearchOut;
    expect(dave).toMatchObject({ learned: false, arms: { inspiration: "raw@pinterest+behance" } });
  });

  it("reads GLOBAL_LEARNING from the environment", async () => {
    vi.stubEnv("GLOBAL_LEARNING", "off");
    const { repos } = makeDeps();
    expect(createDbDeps(repos, () => APP).globalLearning!()).toBe(false);
    vi.stubEnv("GLOBAL_LEARNING", "on");
    expect(createDbDeps(repos, () => APP).globalLearning!()).toBe(true);
  });

  it("nudges creators the user rated great", async () => {
    const s = setup();
    const b = await boardWithDirection(s, ALICE);
    const refs = ((await s.search({ directionId: b.directionId, canvasId: b.canvasId, count: 24 }, ALICE)).structuredContent as SearchOut).references;
    const byMaker = refs.filter((r) => r.title?.includes("Maker 2"));
    expect(byMaker.length).toBeGreaterThanOrEqual(2);
    await s.rate({ ratings: byMaker.slice(0, 2).map((r) => ({ referenceId: r.id, verdict: "great" as const })) }, ALICE);
    const learning = await createDbDeps(s.repos, () => APP).getUserLearning!(ALICE);
    expect(learning.creatorRatings.filter((r) => r.creator === "maker 2")).toHaveLength(2);

    // The next search on a fresh board moves Maker 2 up within each lane.
    const fresh = await boardWithDirection(s, ALICE);
    const plain = ((await s.search({ query: b.ingredient }, BOB)).structuredContent as SearchOut).references;
    const liked = ((await s.search({ query: b.ingredient }, ALICE)).structuredContent as SearchOut).references;
    const firstMaker2 = (list: Ref[]) => list.findIndex((r) => r.title?.includes("Maker 2"));
    expect(firstMaker2(liked)).toBeLessThan(firstMaker2(plain));
    void fresh;
  });
});
