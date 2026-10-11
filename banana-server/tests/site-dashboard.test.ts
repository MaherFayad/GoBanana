/**
 * Canvases dashboard data (lib/site/dashboard.ts) and the owned-canvas list it reads
 * (CanvasRepo.listOwned, lib/db/summary.ts), on the in-memory repos: no network, no database.
 */
import { describe, expect, it } from "vitest";
import { createMemoryRepos } from "@/lib/db/memory";
import { cleanPreviews, clampListLimit, LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX, referencesFromState } from "@/lib/db/summary";
import {
  collageFor,
  collageSites,
  DASHBOARD_LIMIT,
  demoCards,
  loadDashboard,
  longDate,
  relativeTime,
  safeImageSrc,
  siteOf,
  toCard,
} from "@/lib/site/dashboard";
import { compileTakedowns } from "@/lib/takedown";
import { ALICE, BOB } from "./tools-fixtures";

const image = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `img${n}`,
  type: "image",
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  data: {
    imageUrl: `https://i.pinimg.com/736x/r${n}.jpg`,
    thumbUrl: `https://i.pinimg.com/236x/r${n}.jpg`,
    sourceUrl: `https://www.pinterest.com/pin/${n}/`,
    ...extra,
  },
});

const stateWith = (...nodes: unknown[]) => ({ version: 1, nodes, tray: [] });

describe("canvas list helpers (lib/db/summary.ts)", () => {
  it("clamps the list limit to 1..max and falls back to the default", () => {
    expect(clampListLimit()).toBe(LIST_LIMIT_DEFAULT);
    expect(clampListLimit(Number.NaN)).toBe(LIST_LIMIT_DEFAULT);
    expect(clampListLimit(0)).toBe(1);
    expect(clampListLimit(-5)).toBe(1);
    expect(clampListLimit(7.9)).toBe(7);
    expect(clampListLimit(10_000)).toBe(LIST_LIMIT_MAX);
  });

  it("keeps previews that carry an image and a source, from an array or JSON text", () => {
    const good = { thumbUrl: "https://a.test/t.jpg", imageUrl: "https://a.test/i.jpg", sourceUrl: "https://a.test/p" };
    expect(cleanPreviews([good, { imageUrl: "x" }, null, 3, { ...good, thumbUrl: "" }])).toEqual([good, { ...good, thumbUrl: null }]);
    expect(cleanPreviews(JSON.stringify([good]))).toEqual([good]);
    expect(cleanPreviews("not json")).toEqual([]);
    expect(cleanPreviews(Array.from({ length: 20 }, () => good), 3)).toHaveLength(3);
  });

  it("counts image and upload nodes and reads their previews in board order", () => {
    const note = { id: "n", type: "note", data: { text: "hi" } };
    const upload = { id: "u", type: "upload", data: { imageUrl: "/api/uploads/u1", sourceUrl: "/api/uploads/u1" } };
    const r = referencesFromState(stateWith(image(1), note, upload, image(2)));
    expect(r.count).toBe(3);
    expect(r.previews.map((p) => p.imageUrl)).toEqual(["https://i.pinimg.com/736x/r1.jpg", "/api/uploads/u1", "https://i.pinimg.com/736x/r2.jpg"]);
    expect(referencesFromState(null)).toEqual({ count: 0, previews: [] });
    expect(referencesFromState({ nodes: "x" })).toEqual({ count: 0, previews: [] });
  });
});

describe("memory CanvasRepo.listOwned", () => {
  it("lists only the owner's canvases, newest first, with counts and previews, up to the limit", async () => {
    const repos = createMemoryRepos();
    const a = await repos.canvases.create({ userId: ALICE, title: "First", state: stateWith(image(1)) });
    await repos.canvases.create({ userId: BOB, title: "Not Alice's", state: stateWith() });
    const b = await repos.canvases.create({ userId: ALICE, title: "Second", brief: "Calm checkout", state: stateWith(image(2), image(3)) });
    await repos.directions.upsertMany(b.id, [{ bendId: "b1", move: "material", title: "Woven", searchQuery: "sadu" }]);
    // A save bumps updatedAt, so the first canvas becomes the newest.
    await repos.canvases.saveState(ALICE, a.id, stateWith(image(1), image(4)));

    const list = await repos.canvases.listOwned(ALICE);
    expect(list.map((c) => c.title)).toEqual(["First", "Second"]);
    expect(list[0]).toMatchObject({ referenceCount: 2, directionCount: 0, brief: null, shareToken: null });
    expect(list[1]).toMatchObject({ referenceCount: 2, directionCount: 1, brief: "Calm checkout" });
    expect(list[1]!.previews[0]!.thumbUrl).toBe("https://i.pinimg.com/236x/r2.jpg");
    expect(await repos.canvases.listOwned(ALICE, { limit: 1 })).toHaveLength(1);
    expect(await repos.canvases.listOwned("someone-else")).toEqual([]);
  });
});

describe("dashboard cards (lib/site/dashboard.ts)", () => {
  it("lets only https URLs and same-site paths reach an <img src>", () => {
    expect(safeImageSrc("https://i.pinimg.com/a.jpg")).toBe("https://i.pinimg.com/a.jpg");
    expect(safeImageSrc("/api/uploads/x")).toBe("/api/uploads/x");
    expect(safeImageSrc("//evil.test/a.jpg")).toBeNull();
    expect(safeImageSrc("http://plain.test/a.jpg")).toBeNull();
    expect(safeImageSrc("javascript:alert(1)")).toBeNull();
    expect(safeImageSrc(null)).toBeNull();
  });

  it("builds a collage of at most four, thumbnails first, without blocked references", () => {
    const previews = [1, 2, 3, 4, 5].map((n) => ({
      thumbUrl: n === 2 ? null : `https://i.pinimg.com/236x/r${n}.jpg`,
      imageUrl: `https://i.pinimg.com/736x/r${n}.jpg`,
      sourceUrl: `https://www.pinterest.com/pin/${n}/`,
    }));
    const matcher = compileTakedowns(["https://www.pinterest.com/pin/3/"]);
    const collage = collageFor({ previews }, matcher);
    expect(collage.map((c) => c.src)).toEqual([
      "https://i.pinimg.com/236x/r1.jpg",
      "https://i.pinimg.com/736x/r2.jpg",
      "https://i.pinimg.com/236x/r4.jpg",
      "https://i.pinimg.com/236x/r5.jpg",
    ]);
  });

  it("shows no collage at all when the takedown list could not load (fails closed)", () => {
    const previews = [{ thumbUrl: "https://i.pinimg.com/236x/r1.jpg", imageUrl: "https://i.pinimg.com/736x/r1.jpg", sourceUrl: "https://www.pinterest.com/pin/1/" }];
    expect(collageFor({ previews }, null)).toEqual([]);
  });

  it("maps a summary to a card", () => {
    const card = toCard(
      {
        id: "c1",
        title: "T",
        brief: null,
        shareToken: "tok",
        updatedAt: new Date("2026-10-11T08:00:00Z"),
        referenceCount: 2,
        directionCount: 1,
        previews: [],
      },
      compileTakedowns([]),
    );
    expect(card).toEqual({ id: "c1", title: "T", brief: null, updatedAt: "2026-10-11T08:00:00.000Z", referenceCount: 2, directionCount: 1, shared: true, collage: [] });
  });

  it("loads the user's canvases and checks the takedown list on every load", async () => {
    const repos = createMemoryRepos({ takedowns: ["pinterest.com/pin/2"] });
    await repos.canvases.create({ userId: ALICE, title: "Board", state: stateWith(image(1), image(2)) });
    const load = await loadDashboard(ALICE, { repos: () => repos });
    expect(load.ok).toBe(true);
    if (!load.ok) return;
    expect(load.cards).toHaveLength(1);
    expect(load.cards[0]!.collage.map((c) => c.sourceUrl)).toEqual(["https://www.pinterest.com/pin/1/"]);
  });

  it("asks for at most DASHBOARD_LIMIT canvases by default", async () => {
    const seen: (number | undefined)[] = [];
    const repos = {
      canvases: { listOwned: async (_u: string, o?: { limit?: number }) => (seen.push(o?.limit), []) },
      takedowns: { list: async () => [] },
    } as never;
    await loadDashboard(ALICE, { repos: () => repos });
    await loadDashboard(ALICE, { repos: () => repos, limit: 5 });
    expect(seen).toEqual([DASHBOARD_LIMIT, 5]);
  });

  it("reports a failed list as not ok, and hides collages when only the takedown list fails", async () => {
    const failing = { canvases: { listOwned: async () => Promise.reject(new Error("db")) }, takedowns: { list: async () => [] } } as never;
    expect(await loadDashboard(ALICE, { repos: () => failing })).toEqual({ ok: false });

    const repos = createMemoryRepos();
    await repos.canvases.create({ userId: ALICE, title: "Board", state: stateWith(image(1)) });
    const noTakedowns = { canvases: repos.canvases, takedowns: { list: async () => Promise.reject(new Error("db")) } } as never;
    const load = await loadDashboard(ALICE, { repos: () => noTakedowns });
    expect(load.ok && load.cards[0]!.collage).toEqual([]);
  });

  it("names source sites without www and drops non-web URLs", () => {
    expect(siteOf("https://www.pinterest.com/pin/1/")).toBe("pinterest.com");
    expect(siteOf("https://dribbble.com/shots/1")).toBe("dribbble.com");
    expect(siteOf("/api/uploads/x")).toBeNull();
    expect(siteOf("ftp://x.test/a")).toBeNull();
    const card = demoCards()[0]!;
    expect(collageSites(card)).toEqual(["pinterest.com"]);
  });

  it("formats times relative to now in English and Arabic, with Western digits", () => {
    const now = new Date("2026-10-11T12:00:00Z");
    expect(relativeTime("2026-10-11T10:00:00Z", now, "en")).toBe("2 hours ago");
    expect(relativeTime("2026-10-10T11:00:00Z", now, "en")).toBe("yesterday");
    expect(relativeTime("2026-10-11T11:59:40Z", now, "en")).toBe("now");
    expect(relativeTime("2026-10-11T10:00:00Z", now, "ar")).toMatch(/ساعتين/);
    expect(relativeTime("2026-10-08T12:00:00Z", now, "ar")).toMatch(/3/);
    expect(relativeTime("not a date", now, "en")).toBe("");
    expect(longDate("2026-10-11T23:30:00Z", "en")).toBe("11 October 2026");
    expect(longDate("2026-10-11T00:00:00Z", "ar")).toMatch(/2026/);
  });

  it("demo cards (E2E bypass only) cover shared, unshared and empty canvases", () => {
    const cards = demoCards();
    expect(cards.some((c) => c.shared)).toBe(true);
    expect(cards.some((c) => c.collage.length === 0 && c.brief === null)).toBe(true);
    for (const c of cards) for (const img of c.collage) expect(safeImageSrc(img.src)).toBe(img.src);
  });
});
