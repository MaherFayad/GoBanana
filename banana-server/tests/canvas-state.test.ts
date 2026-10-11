import { describe, expect, it } from "vitest";
import {
  deserializeState,
  emptyState,
  filterBlocked,
  parseState,
  safeUrl,
  serializeState,
  stateToItems,
} from "@/canvas/state";
import { referenceNode, noteNode, sectionNode, swatchNode, typeSampleNode } from "@/canvas/factory";
import type { CanvasFlowNode, CanvasState, TrayReference } from "@/canvas/types";
import { compileTakedowns } from "@/lib/takedown";

const ref: TrayReference = {
  id: "r1",
  thumbUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:abc",
  imageUrl: "https://i.pinimg.com/736x/aa/bb/cc.jpg",
  sourceUrl: "https://www.pinterest.com/pin/123/",
  sourceSite: "pinterest.com",
  title: "Frosted vinyl sleeve",
  width: 736,
  height: 1104,
};

function sample(): CanvasFlowNode[] {
  const sec = sectionNode({ x: 400, y: 300 }, "Glass", "sec1");
  const img = referenceNode(ref, { x: 140, y: 105 }, "img1");
  const child = { ...noteNode({ x: 0, y: 0 }, "inside", "note1"), parentId: "sec1", position: { x: 16, y: 48 } };
  return [
    sec,
    { ...img, zIndex: 3 },
    child,
    swatchNode({ x: 900, y: 0 }, "#FF6600", { role: "primary", tag: "ship" }, "sw1"),
    typeSampleNode({ x: 900, y: 400 }, "space-grotesk-inter", "ts1"),
  ];
}

describe("canvas state serialization", () => {
  it("round-trips nodes, viewport and tray", () => {
    const nodes = sample();
    const viewport = { x: -120.4, y: 33, zoom: 0.75 };
    const saved = serializeState(nodes, viewport, [ref]);
    const json = JSON.parse(JSON.stringify(saved)) as unknown;
    const back = deserializeState(json);

    expect(back.removed).toBe(0);
    expect(back.viewport).toEqual({ x: -120.4, y: 33, zoom: 0.75 });
    expect(back.tray).toEqual([ref]);
    expect(back.nodes.map((n) => n.id)).toEqual(["sec1", "img1", "note1", "sw1", "ts1"]);
    // Serializing again gives the same JSON (stable for change detection).
    expect(serializeState(back.nodes, back.viewport, back.tray)).toEqual(saved);
  });

  it("keeps parent links, z order and relative child positions", () => {
    const saved = serializeState(sample(), { x: 0, y: 0, zoom: 1 });
    const note = saved.nodes.find((n) => n.id === "note1");
    expect(note).toMatchObject({ parentId: "sec1", x: 16, y: 48 });
    expect(saved.nodes.find((n) => n.id === "img1")?.z).toBe(3);
  });

  it("stores the swatch hex in lower case and keeps its tag", () => {
    const saved = serializeState(sample(), { x: 0, y: 0, zoom: 1 });
    const sw = saved.nodes.find((n) => n.id === "sw1");
    expect(sw?.data).toMatchObject({ hex: "#ff6600", role: "primary", tag: "ship" });
  });

  it("puts sections before their children even when stored out of order", () => {
    const raw = {
      nodes: [
        { id: "a", type: "note", x: 1, y: 2, w: 100, h: 80, parentId: "s", data: { text: "x" } },
        { id: "s", type: "section", x: 0, y: 0, w: 600, h: 400, data: { title: "S" } },
      ],
    };
    expect(deserializeState(raw).nodes.map((n) => n.id)).toEqual(["s", "a"]);
  });

  it("drops malformed nodes, duplicate ids and dangling parents", () => {
    const raw = {
      viewport: { x: "nope", zoom: -2 },
      nodes: [
        null,
        { id: "x", type: "rocket", data: {} },
        { id: "img", type: "image", x: 0, y: 0, data: { imageUrl: "https://a.example/i.jpg" } }, // no sourceUrl
        { id: "sw", type: "swatch", data: { hex: "not a color" } },
        { id: "n1", type: "note", x: 5, y: 5, parentId: "ghost", data: { text: "hi" } },
        { id: "n1", type: "note", x: 9, y: 9, data: { text: "dupe" } },
      ],
    };
    const state = parseState(raw);
    expect(state.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0]).toMatchObject({ id: "n1", x: 5, y: 5, data: { text: "hi" } });
    expect(state.nodes[0]?.parentId).toBeUndefined();
  });

  it("hides children of collapsed sections on load", () => {
    const raw = {
      nodes: [
        { id: "s", type: "section", x: 0, y: 0, w: 600, h: 48, data: { title: "S", collapsed: true, expandedHeight: 400 } },
        { id: "a", type: "note", x: 16, y: 48, w: 100, h: 80, parentId: "s", data: { text: "x" } },
      ],
    };
    const { nodes } = deserializeState(raw);
    expect(nodes.find((n) => n.id === "a")?.hidden).toBe(true);
  });

  it("starts empty for null or garbage", () => {
    expect(parseState(null)).toEqual(emptyState());
    expect(parseState("[]")).toEqual(emptyState());
  });
});

describe("no image bytes in saved state (hard rule 2)", () => {
  it("refuses data:, blob: and javascript: URLs", () => {
    expect(safeUrl("data:image/png;base64,iVBORw0KGgo=")).toBeUndefined();
    expect(safeUrl("blob:https://x.example/123")).toBeUndefined();
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("//evil.example/a.png")).toBeUndefined();
    expect(safeUrl("/api/uploads/u1/abc.png")).toBe("/api/uploads/u1/abc.png");
    expect(safeUrl("https://i.pinimg.com/a.jpg")).toBe("https://i.pinimg.com/a.jpg");
  });

  it("drops references whose image is inline data and never serializes bytes", () => {
    const bad = referenceNode({ ...ref, imageUrl: "data:image/png;base64,AAAA", thumbUrl: "" }, { x: 0, y: 0 }, "bad");
    const thumbOnly = referenceNode({ ...ref, thumbUrl: "data:image/jpeg;base64,BBBB" }, { x: 0, y: 0 }, "ok");
    const saved = serializeState([bad, thumbOnly], { x: 0, y: 0, zoom: 1 }, [
      { ...ref, id: "t2", imageUrl: "data:image/png;base64,CCCC" },
    ]);
    const text = JSON.stringify(saved);
    expect(text).not.toMatch(/data:|base64/);
    expect(saved.nodes.map((n) => n.id)).toEqual(["ok"]);
    expect(saved.tray).toEqual([]);
  });

  it("strips unknown fields from node data", () => {
    const node = referenceNode(ref, { x: 0, y: 0 }, "img");
    const polluted = { ...node, data: { ...node.data, pixels: [1, 2, 3], blob: "AAAA" } } as CanvasFlowNode;
    const saved = serializeState([polluted], { x: 0, y: 0, zoom: 1 });
    expect(Object.keys(saved.nodes[0]?.data ?? {})).not.toContain("pixels");
    expect(Object.keys(saved.nodes[0]?.data ?? {})).not.toContain("blob");
  });
});

describe("takedown filter on load (hard rule 5)", () => {
  const state: CanvasState = serializeState(sample(), { x: 0, y: 0, zoom: 1 }, [
    ref,
    { ...ref, id: "r2", sourceUrl: "https://dribbble.com/shots/1", imageUrl: "https://cdn.dribbble.com/x.png", thumbUrl: "https://cdn.dribbble.com/x_t.png" },
  ]);

  it("hides items and tray results whose source, image or thumb is blocked", () => {
    const matcher = compileTakedowns(["pinterest.com/pin/123", "cdn.dribbble.com"]);
    const out = deserializeState(state, { isBlocked: matcher.isBlocked });
    expect(out.nodes.map((n) => n.id)).not.toContain("img1");
    expect(out.tray).toEqual([]);
    expect(out.removed).toBe(3);
  });

  it("blocks by image host too", () => {
    const { state: filtered, removed } = filterBlocked(state, (u) => new URL(u).hostname === "i.pinimg.com");
    expect(removed).toBe(2);
    expect(filtered.nodes.some((n) => n.type === "image")).toBe(false);
  });

  it("keeps everything when nothing is blocked", () => {
    const out = deserializeState(state, { isBlocked: () => false });
    expect(out.removed).toBe(0);
    expect(out.nodes).toHaveLength(5);
  });
});

describe("stateToItems (bridge to lib/canvas/types)", () => {
  it("returns absolute coordinates and section ids", () => {
    const state = serializeState(sample(), { x: 0, y: 0, zoom: 1 });
    const items = stateToItems(state);
    const sec = items.find((i) => i.id === "sec1");
    const note = items.find((i) => i.id === "note1");
    expect(sec).toMatchObject({ type: "section", title: "Glass" });
    expect(note).toMatchObject({ type: "note", sectionId: "sec1", x: (sec?.x ?? 0) + 16, y: (sec?.y ?? 0) + 48 });
    const img = items.find((i) => i.id === "img1");
    expect(img).toMatchObject({ type: "image", sourceUrl: ref.sourceUrl, sourceSite: "pinterest.com", sectionId: null });
  });
});
