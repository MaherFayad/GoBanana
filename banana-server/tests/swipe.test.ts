/** VAL-09 swipe file: save from cut_parts and rate_references, search with get_canvas library. */
import { describe, expect, it } from "vitest";
import { createCutPartsTool } from "@/lib/mcp/tools/cut_parts";
import { createGetCanvasTool } from "@/lib/mcp/tools/get_canvas";
import { createRateReferencesTool } from "@/lib/mcp/tools/rate_references";
import { MAX_SWIPE_ITEMS, swipeItemKey } from "@/lib/swipe";
import { memorySwipeRepo } from "@/lib/swipe/repo";
import { ALICE, BOB, imageNode, makeDeps, ref, seedCanvas, state, text } from "./tools-fixtures";

function setup(takedowns: string[] = []) {
  const { deps, repos } = makeDeps({ takedowns });
  const swipe = memorySwipeRepo();
  return { deps: { ...deps, swipe: () => swipe }, repos, swipe };
}

describe("swipe file", () => {
  it("cut_parts save: true keeps parts with role, crop and source link, once", async () => {
    const { deps, repos, swipe } = setup();
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_1", 1)]));
    const cut = createCutPartsTool(deps);
    const args = { canvasId: c.id, save: true, cuts: [{ itemId: "img_1", role: "nav", crop: { x: 0, y: 0, w: 1, h: 0.1 }, cardId: "card-7" }] };
    const res = await cut(args, ALICE);
    expect(text(res)).toContain("Swipe file: saved 1 part.");
    expect(res.structuredContent).toMatchObject({ swipeSaved: 1 });
    expect(swipe.rows[0]).toMatchObject({ kind: "part", role: "nav", cardId: "card-7", sourceUrl: ref(1).sourceUrl, crop: { x: 0, y: 0, w: 1, h: 0.1 } });
    // Same crop on another board is not saved twice.
    const c2 = await seedCanvas(repos, ALICE, state([imageNode("img_1", 1)]));
    const again = await cut({ ...args, canvasId: c2.id }, ALICE);
    expect(text(again)).toContain("saved 0 parts, 1 already there");
    expect(swipe.rows).toHaveLength(1);
  });

  it("cut_parts without save keeps nothing", async () => {
    const { deps, repos, swipe } = setup();
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_1", 1)]));
    await createCutPartsTool(deps)({ canvasId: c.id, cuts: [{ itemId: "img_1", role: "nav" }] }, ALICE);
    expect(swipe.rows).toHaveLength(0);
  });

  it("rate_references save: true keeps only the great ones, and never a taken down link", async () => {
    const { deps, repos, swipe } = setup(["pinterest.com/pin/3"]);
    const c = await seedCanvas(repos, ALICE, state());
    await repos.references.insertMany(c.id, [ref(1), ref(2), ref(3)]);
    const res = await createRateReferencesTool(deps)(
      {
        canvasId: c.id,
        save: true,
        ratings: [
          { referenceId: ref(1).id, verdict: "great" },
          { referenceId: ref(2).id, verdict: "bad" },
          { referenceId: ref(3).id, verdict: "great" },
        ],
      },
      ALICE,
    );
    expect(text(res)).toContain("Swipe file: saved 1 great reference.");
    expect(swipe.rows.map((r) => r.sourceUrl)).toEqual([ref(1).sourceUrl]);
  });

  it("get_canvas library searches by role, card and words, newest first, for the owner only", async () => {
    const { deps, swipe } = setup();
    const base = { sourceSite: "pinterest.com", imageUrl: "https://i.pinimg.com/a.png" };
    await swipe.addMany(ALICE, [
      { kind: "part", role: "nav", cardId: "c1", ...base, sourceUrl: "https://www.pinterest.com/pin/1/", title: "Split nav", crop: { x: 0, y: 0, w: 1, h: 0.1 } },
      { kind: "part", role: "hero", ...base, sourceUrl: "https://www.pinterest.com/pin/2/", title: "Big hero", crop: { x: 0, y: 0.1, w: 1, h: 0.3 } },
      { kind: "reference", ...base, sourceUrl: "https://www.pinterest.com/pin/3/", title: "Great pricing page" },
    ]);
    await swipe.addMany(BOB, [{ kind: "reference", ...base, sourceUrl: "https://www.pinterest.com/pin/9/", title: "Bob secret" }]);
    const get = createGetCanvasTool(deps);
    const all = await get({ library: {} }, ALICE);
    expect(text(all)).toContain("Swipe file: 3 of 3 items");
    expect(text(all)).not.toContain("Bob secret");
    expect(text(all).indexOf("Great pricing page")).toBeLessThan(text(all).indexOf("Split nav"));
    expect(text(await get({ library: { role: "nav" } }, ALICE))).toContain("Split nav");
    expect(text(await get({ library: { role: "nav" } }, ALICE))).not.toContain("Big hero");
    expect(text(await get({ library: { cardId: "c1" } }, ALICE))).toContain("card c1");
    expect(text(await get({ library: { query: "PRICING" } }, ALICE))).toContain("Great pricing page");
    expect(text(await get({ library: { query: "zzz" } }, ALICE))).toContain("Nothing in the swipe file matches that.");
    // Source links are always shown.
    expect(text(all)).toContain("https://www.pinterest.com/pin/1/");
  });

  it("hides items whose source was taken down", async () => {
    const { deps, swipe } = setup(["pinterest.com/pin/1"]);
    await swipe.addMany(ALICE, [{ kind: "reference", sourceSite: "pinterest.com", imageUrl: "https://i.pinimg.com/a.png", sourceUrl: "https://www.pinterest.com/pin/1/", title: "Gone" }]);
    expect(text(await createGetCanvasTool(deps)({ library: {} }, ALICE))).not.toContain("Gone");
  });

  it("stores links only and caps the library", async () => {
    const swipe = memorySwipeRepo();
    const bad = await swipe.addMany(ALICE, [
      { kind: "reference", sourceSite: "x", imageUrl: "data:image/png;base64,AAAA", sourceUrl: "https://example.com/a" },
      { kind: "part", role: "banner", sourceSite: "x", imageUrl: "https://example.com/a.png", sourceUrl: "https://example.com/a" },
    ]);
    expect(bad.added).toBe(0);
    expect(swipe.rows).toHaveLength(0);
    const many = Array.from({ length: MAX_SWIPE_ITEMS + 5 }, (_, i) => ({
      kind: "reference" as const,
      sourceSite: "x",
      imageUrl: `https://example.com/${i}.png`,
      sourceUrl: `https://example.com/p/${i}`,
    }));
    const res = await swipe.addMany(ALICE, many);
    expect(res).toMatchObject({ added: MAX_SWIPE_ITEMS, full: true });
  });

  it("dedupes by kind, link and crop", () => {
    const a = swipeItemKey({ kind: "part", role: "nav", sourceUrl: "https://www.pinterest.com/pin/1/", crop: { x: 0, y: 0, w: 1, h: 0.1 } });
    const b = swipeItemKey({ kind: "part", role: "nav", sourceUrl: "https://www.pinterest.com/pin/1/", crop: { x: 0, y: 0, w: 1, h: 0.1004 } });
    const c = swipeItemKey({ kind: "part", role: "hero", sourceUrl: "https://www.pinterest.com/pin/1/", crop: { x: 0, y: 0, w: 1, h: 0.1 } });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
