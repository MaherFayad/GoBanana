/**
 * rate_directions over in-memory repos: drop takes a direction off the canvas (row, section,
 * the items in it, its tray results), keep changes nothing on the canvas, another user's canvas
 * is refused, and every rating is one search_feedback row.
 */
import { describe, expect, it } from "vitest";
import { createBendBriefTool } from "@/lib/mcp/tools/bend_brief";
import { createRateDirectionsTool, inputSchema, removeDirections, TOOL_DESCRIPTION } from "@/lib/mcp/tools/rate_directions";
import type { CanvasState } from "@/canvas/types";
import { ALICE, BOB, imageNode, makeDeps, ref, sectionNode, seedCanvas, state, text } from "./tools-fixtures";

type Bent = { directions: { id: string; searchQuery: string; move: string }[] };

async function setup() {
  const { deps, repos } = makeDeps();
  const canvas = await seedCanvas(repos, ALICE);
  const bend = createBendBriefTool(() => ({ repos }));
  const bent = (await bend({ brief: "flight checkout screen", wildness: 4, count: 4, canvasId: canvas.id }, ALICE)).structuredContent as Bent;
  const [a, b, c] = bent.directions;
  // A section per direction with references inside, a loose note, and tray results tagged by direction.
  const s: CanvasState = state(
    [
      sectionNode("sec_a", { title: "A", directionId: a!.id }),
      imageNode("img_a1", 1, { parentId: "sec_a" }),
      imageNode("img_a2", 2, { parentId: "sec_a" }),
      sectionNode("sec_b", { title: "B", directionId: b!.id, x: 700 }),
      imageNode("img_b1", 3, { parentId: "sec_b" }),
      imageNode("loose", 4, { x: 0, y: 900 }),
    ],
    [
      { ...ref(10), directionId: a!.id },
      { ...ref(11), directionId: a!.id },
      { ...ref(12), directionId: b!.id },
      ref(13),
    ],
  );
  await repos.canvases.saveState(ALICE, canvas.id, s);
  return { deps, repos, canvasId: canvas.id, a: a!, b: b!, c: c!, rate: createRateDirectionsTool(deps) };
}

const stateOf = async (s: Awaited<ReturnType<typeof setup>>) => (await s.repos.canvases.getOwned(ALICE, s.canvasId))!.state as CanvasState;

describe("rate_directions tool", () => {
  it("has plain copy and validates input with plain messages", async () => {
    expect(TOOL_DESCRIPTION).not.toMatch(/[—–]/);
    expect(TOOL_DESCRIPTION).toContain("drop");
    expect(inputSchema.safeParse({ canvasId: "c", ratings: [] }).success).toBe(false);
    expect(inputSchema.safeParse({ canvasId: "c", ratings: Array.from({ length: 21 }, () => ({ directionId: "d", verdict: "keep" })) }).success).toBe(false);
    const s = await setup();
    const bad = await s.rate({ canvasId: s.canvasId, ratings: [{ directionId: s.a.id, verdict: "meh" }] }, ALICE);
    expect(bad.isError).toBe(true);
    expect(text(bad)).toContain("verdict of keep or drop");
    const reason = await s.rate({ canvasId: s.canvasId, ratings: [{ directionId: s.a.id, verdict: "drop", reasons: ["ugly"] }] }, ALICE);
    expect(text(reason)).toContain("no_ui_path");
    expect((await s.rate({ ratings: [{ directionId: s.a.id, verdict: "drop" }] }, ALICE)).isError).toBe(true);
    expect((await s.rate({ canvasId: s.canvasId, ratings: [{ directionId: s.a.id, verdict: "drop" }] }, undefined)).isError).toBe(true);
  });

  it("keep records the verdict on the direction; unrated ones stay without a verdict", async () => {
    const s = await setup();
    const res = await s.rate({ canvasId: s.canvasId, ratings: [{ directionId: s.a.id, verdict: "keep" }] }, ALICE);
    expect(res.isError).toBeFalsy();
    const list = await s.repos.directions.listForCanvas(s.canvasId);
    expect(list.find((d) => d.bendId === s.a.id)!.detail?.verdict).toBe("keep");
    expect(list.find((d) => d.bendId === s.b.id)!.detail?.verdict).toBeUndefined();
  });

  it("drop removes the direction, its section, the items in it and its tray results", async () => {
    const s = await setup();
    const res = await s.rate(
      { canvasId: s.canvasId, ratings: [{ directionId: s.a.id, verdict: "drop", reasons: ["no_ui_path", "no_usable_refs"] }] },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({
      rated: 1,
      kept: [],
      dropped: [s.a.id],
      removedSections: 1,
      removedItems: 2,
      removedFromTray: 2,
      notFound: [],
    });
    expect(text(res)).toContain("removed 1 section, 2 items and 2 tray results");
    const after = await stateOf(s);
    expect(after.nodes.map((n) => n.id)).toEqual(["sec_b", "img_b1", "loose"]);
    expect(after.tray.map((t) => t.id)).toEqual([ref(12).id, ref(13).id]);
    const rows = await s.repos.directions.listForCanvas(s.canvasId);
    expect(rows.map((d) => d.bendId)).not.toContain(s.a.id);
    expect(rows).toHaveLength(3);
    expect(await s.repos.directions.findForUser(ALICE, s.a.id)).toBeNull();
  });

  it("keep is a no-op on the canvas", async () => {
    const s = await setup();
    const before = await s.repos.canvases.getOwned(ALICE, s.canvasId);
    const res = await s.rate({ canvasId: s.canvasId, ratings: [{ directionId: s.b.id, verdict: "keep", reasons: ["great_refs"] }] }, ALICE);
    expect(res.structuredContent).toMatchObject({ rated: 1, kept: [s.b.id], dropped: [], removedSections: 0, removedItems: 0, removedFromTray: 0 });
    const after = await s.repos.canvases.getOwned(ALICE, s.canvasId);
    expect(after!.updatedAt).toEqual(before!.updatedAt);
    expect(after!.state).toEqual(before!.state);
    expect(await s.repos.directions.listForCanvas(s.canvasId)).toHaveLength(4);
  });

  it("drops a direction that has nothing on the canvas without saving the canvas", async () => {
    const s = await setup();
    const before = await s.repos.canvases.getOwned(ALICE, s.canvasId);
    const res = await s.rate({ canvasId: s.canvasId, ratings: [{ directionId: s.c.id, verdict: "drop", reasons: ["duplicate_idea"] }] }, ALICE);
    expect(res.structuredContent).toMatchObject({ dropped: [s.c.id], removedSections: 0, removedItems: 0, removedFromTray: 0 });
    expect((await s.repos.canvases.getOwned(ALICE, s.canvasId))!.updatedAt).toEqual(before!.updatedAt);
    expect(await s.repos.directions.listForCanvas(s.canvasId)).toHaveLength(3);
  });

  it("records one feedback row per rating, keep as great and drop as bad", async () => {
    const s = await setup();
    await s.rate(
      {
        canvasId: s.canvasId,
        ratings: [
          { directionId: s.a.id, verdict: "drop", reasons: ["no_ui_path"] },
          { directionId: s.b.id, verdict: "keep", reasons: ["strong_salvage"] },
          { directionId: "bd-nothere", verdict: "drop" },
        ],
      },
      ALICE,
    );
    const rows = s.repos.data.feedback;
    expect(rows).toHaveLength(2);
    const ingredient = s.a.searchQuery.toLowerCase();
    expect(rows[0]).toMatchObject({
      userId: ALICE,
      itemKey: s.a.id,
      sourceSite: "bend",
      lane: "direction",
      query: ingredient,
      termKey: `direction|${ingredient}`,
      arm: s.a.move,
      verdict: "bad",
      reasons: ["no_ui_path"],
      creator: null,
    });
    expect(rows[1]).toMatchObject({ itemKey: s.b.id, verdict: "great", reasons: ["strong_salvage"], arm: s.b.move });
    // Grouped stats see them, and they never mix with lane arm stats.
    const stats = await s.repos.feedback.directionStats(ALICE, 3);
    expect(stats.find((r) => r.termKey === `direction|${ingredient}`)).toMatchObject({ users: 1, bad: 1, ownBad: 1 });
    expect(await s.repos.feedback.armStats(ALICE, ["inspiration|" + ingredient])).toEqual([]);
  });

  it("lists ids that are not directions of this canvas", async () => {
    const s = await setup();
    const res = await s.rate({ canvasId: s.canvasId, ratings: [{ directionId: "bd-nothere", verdict: "drop" }] }, ALICE);
    expect(res.structuredContent).toMatchObject({ rated: 0, notFound: ["bd-nothere"] });
    expect(text(res)).toContain("not on this canvas");
    expect(s.repos.data.feedback).toHaveLength(0);
  });

  it("refuses another user's canvas and changes nothing", async () => {
    const s = await setup();
    const before = await s.repos.canvases.getOwned(ALICE, s.canvasId);
    const res = await s.rate({ canvasId: s.canvasId, ratings: [{ directionId: s.a.id, verdict: "drop" }] }, BOB);
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("canvas was not found");
    expect((await s.repos.canvases.getOwned(ALICE, s.canvasId))!.state).toEqual(before!.state);
    expect(await s.repos.directions.listForCanvas(s.canvasId)).toHaveLength(4);
    expect(s.repos.data.feedback).toHaveLength(0);
    // Bob's own canvas does not hold Alice's directions either.
    const bobs = await seedCanvas(s.repos, BOB);
    const other = await s.rate({ canvasId: bobs.id, ratings: [{ directionId: s.a.id, verdict: "drop" }] }, BOB);
    expect(other.structuredContent).toMatchObject({ rated: 0, notFound: [s.a.id] });
    expect(await s.repos.directions.listForCanvas(s.canvasId)).toHaveLength(4);
  });

  it("matches sections and tray results tagged with the row id too, and nested nodes", () => {
    const s = state(
      [
        sectionNode("sec_x", { directionId: "row-uuid" }),
        sectionNode("sec_inner", { parentId: "sec_x" } as never),
        imageNode("deep", 1, { parentId: "sec_inner" }),
        imageNode("keep", 2),
      ],
      [{ ...ref(1), directionId: "row-uuid" }, ref(2)],
    );
    const out = removeDirections(s, new Set(["row-uuid", "bd-1"]));
    expect(out.state.nodes.map((n) => n.id)).toEqual(["keep"]);
    expect(out).toMatchObject({ sections: 1, items: 2, tray: 1 });
  });
});
