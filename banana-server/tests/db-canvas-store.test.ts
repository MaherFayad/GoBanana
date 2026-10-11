/** lib/canvas/store.ts: save validation, takedown filter on load, placement and snapshots. */
import { describe, expect, it } from "vitest";
import {
  addToTray,
  appendNodes,
  arrangeState,
  findForbiddenUrl,
  loadCanvas,
  MAX_STATE_BYTES,
  MAX_TRAY,
  mutateCanvas,
  toSnapshot,
  validateSaveBody,
} from "@/lib/canvas/store";
import { compileTakedowns } from "@/lib/takedown";
import { ALICE, BOB, imageNode, makeDeps, ref, sectionNode, seedCanvas, state } from "./tools-fixtures";

const noTakedowns = async () => compileTakedowns([]);

describe("validateSaveBody", () => {
  const body = (nodes: unknown[], extra: Record<string, unknown> = {}) => ({ state: { version: 1, nodes, tray: [], ...extra } });

  it("accepts the canvas UI shape", () => {
    const res = validateSaveBody(body([imageNode("a", 1), sectionNode("s")]), 100);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state.nodes.map((n) => n.id)).toEqual(["s", "a"]);
  });

  it("refuses data: and blob: URLs anywhere, never stores image bytes", () => {
    const dataNode = imageNode("a", 1);
    (dataNode.data as { imageUrl: string }).imageUrl = "data:image/png;base64,iVBORw0KGgo=";
    expect(validateSaveBody(body([dataNode]), 100)).toMatchObject({ ok: false, status: 400 });
    const blobTray = body([], { tray: [{ id: "r", imageUrl: "blob:https://x/1", sourceUrl: "https://x" }] });
    expect(validateSaveBody(blobTray, 100)).toMatchObject({ ok: false, status: 400 });
    const nested = imageNode("b", 2);
    (nested.data as Record<string, unknown>).extra = { deep: ["  DATA:text/plain,hi"] };
    expect(findForbiddenUrl(body([nested]).state)).toContain("extra.deep[0]");
  });

  it("caps the size and rejects bad shapes", () => {
    expect(validateSaveBody(body([]), MAX_STATE_BYTES + 1)).toMatchObject({ ok: false, status: 413 });
    expect(validateSaveBody({ nodes: [] }, 10)).toMatchObject({ ok: false, status: 400 });
    expect(validateSaveBody(body([{ id: "x", type: "video", x: 0, y: 0, data: {} }]), 10)).toMatchObject({ ok: false });
  });

  it("drops references that lose their source link (hard rule 3)", () => {
    const n = imageNode("a", 1);
    (n.data as { sourceUrl: string }).sourceUrl = "javascript:alert(1)";
    const res = validateSaveBody(body([n]), 10);
    expect(res.ok && res.state.nodes).toEqual([]);
  });

  it("reads an optional base version", () => {
    const res = validateSaveBody({ ...body([]), baseUpdatedAt: "2026-10-15T10:00:00.000Z" }, 10);
    expect(res.ok && res.baseUpdatedAt?.toISOString()).toBe("2026-10-15T10:00:00.000Z");
  });
});

describe("loadCanvas", () => {
  it("hides taken down items and tray results, and only for the owner", async () => {
    const { repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state([imageNode("a", 1), imageNode("b", 2)], [{ ...ref(3) }]));
    const matcher = async () => compileTakedowns(["https://www.pinterest.com/pin/2/", "https://www.pinterest.com/pin/3/"]);
    const loaded = await loadCanvas(repos, ALICE, c.id, matcher);
    expect(loaded?.state.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(loaded?.state.tray).toEqual([]);
    expect(loaded?.removed).toBe(2);
    expect(await loadCanvas(repos, BOB, c.id, matcher)).toBeNull();
  });

  it("fails closed when the takedown list cannot load", async () => {
    const { repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state([imageNode("a", 1)]));
    await expect(loadCanvas(repos, ALICE, c.id, async () => Promise.reject(new Error("db down")))).rejects.toThrow();
  });
});

describe("mutateCanvas", () => {
  it("retries once when another save lands in between", async () => {
    const { repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE);
    let calls = 0;
    const out = await mutateCanvas(repos, ALICE, c.id, noTakedowns, async (s) => {
      calls += 1;
      if (calls === 1) await repos.canvases.saveState(ALICE, c.id, state([imageNode("other", 9)]));
      return { state: { ...s, nodes: [...s.nodes, imageNode(`mine${calls}`, 1)] }, value: calls };
    });
    expect(out.ok && out.value).toBe(2);
    const saved = (await repos.canvases.getOwned(ALICE, c.id))!.state as { nodes: { id: string }[] };
    expect(saved.nodes.map((n) => n.id)).toEqual(["other", "mine2"]);
  });
});

describe("appendNodes", () => {
  it("puts items below the section's contents and grows the frame", () => {
    const s = state([
      sectionNode("s", { x: 100, y: 50, h: 300 }),
      imageNode("a", 1, { parentId: "s", x: 16, y: 48, w: 280, h: 210 }),
    ]);
    const { state: next, placed } = appendNodes(
      s,
      [{ type: "note", data: { text: "hi", color: "yellow" } }],
      () => "s",
      (p) => `${p}_1`,
    );
    expect(placed[0]).toMatchObject({ id: "note_1", x: 116, y: 50 + 48 + 210 + 16, sectionId: "s" });
    const section = next.nodes.find((n) => n.id === "s")!;
    expect(section.h).toBe(48 + 210 + 16 + 140 + 16);
    expect(next.nodes.find((n) => n.id === "note_1")?.parentId).toBe("s");
  });

  it("puts loose items below everything and sections to the right", () => {
    const s = state([sectionNode("s", { x: 0, y: 0, w: 616, h: 420 })]);
    const { placed } = appendNodes(
      s,
      [
        { type: "note", data: { text: "a", color: "yellow" } },
        { type: "section", data: { title: "New" } },
      ],
      () => null,
      (p) => p,
    );
    expect(placed.find((p) => p.type === "note")).toMatchObject({ x: 0, y: 420 + 48 });
    expect(placed.find((p) => p.type === "section")).toMatchObject({ x: 616 + 48, y: 0 });
  });

  it("wraps rows of four", () => {
    const nodes = Array.from({ length: 5 }, () => ({ type: "note" as const, data: { text: "n", color: "yellow" } }));
    let i = 0;
    const { placed } = appendNodes(state(), nodes, () => null, (p) => `${p}${i++}`);
    expect(placed.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [236, 0],
      [472, 0],
      [708, 0],
      [0, 156],
    ]);
  });
});

describe("arrangeState", () => {
  it("arranges a section's contents and refuses unknown sections", () => {
    const s = state([
      sectionNode("s", { x: 0, y: 0 }),
      imageNode("a", 1, { parentId: "s", x: 300, y: 300 }),
      imageNode("b", 2, { parentId: "s", x: 10, y: 400 }),
    ]);
    expect(arrangeState(s, "grid", "nope")).toEqual({ error: "no_section" });
    const res = arrangeState(s, "grid", "s");
    if ("error" in res) throw new Error("expected a result");
    const a = res.items.find((r) => r.id === "a")!;
    const b = res.items.find((r) => r.id === "b")!;
    expect(a.y).toBe(b.y);
    expect(a.x).not.toBe(b.x);
  });
});

describe("toSnapshot and the tray", () => {
  it("maps stored nodes to absolute items and direction ids to bend ids", async () => {
    const { repos } = makeDeps();
    const s = state([
      sectionNode("s", { x: 100, y: 100, directionId: "bd-1" }),
      imageNode("a", 1, { parentId: "s", x: 16, y: 48 }),
    ]);
    const c = await seedCanvas(repos, ALICE, s);
    const snap = toSnapshot({
      canvas: c,
      state: s,
      directions: [{ id: "uuid", bendId: "bd-1", canvasId: c.id, move: "era", title: "T", searchQuery: "q" }],
      palettes: [{ id: "p", canvasId: c.id, colors: [{ hex: "#112233", oklch: "x", role: "primary" }], contrast: [] }],
      webUrl: "https://x/c/1",
    });
    expect(snap.sections).toEqual([{ id: "s", title: "Section", directionId: "bd-1", x: 100, y: 100, w: 616, h: 420 }]);
    expect(snap.items[0]).toMatchObject({ id: "a", x: 116, y: 148, sectionId: "s", sourceUrl: ref(1).sourceUrl });
    expect(snap.directions[0]!.id).toBe("bd-1");
    expect(snap.palettes[0]!.colors[0]!.hex).toBe("#112233");
    expect(snap.wildness).toBe(3);
  });

  it("adds results to the tray newest first without duplicates, capped", () => {
    let s = addToTray(state(), [ref(1), ref(2)], "bd-1");
    s = addToTray(s, [ref(2), ref(3)]);
    expect(s.tray.map((r) => r.id)).toEqual([ref(2).id, ref(3).id, ref(1).id]);
    expect(s.tray[2]!.directionId).toBe("bd-1");
    const many = Array.from({ length: MAX_TRAY + 5 }, (_, i) => ref(100 + i));
    expect(addToTray(s, many).tray).toHaveLength(MAX_TRAY);
  });
});
