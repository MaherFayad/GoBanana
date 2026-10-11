/** Sticky notes: label parsing, the height estimate, the compact decision and the saved data. */
import { describe, expect, it } from "vitest";
import { growSectionToFit } from "@/canvas/geometry";
import { arrangeNodes } from "@/canvas/layout-adapter";
import {
  estimateLines,
  estimateNoteHeight,
  heightChanged,
  hiddenLines,
  manualAfterResize,
  NOTE_COMPACT_LINE_PX,
  NOTE_LINE_PX,
  NOTE_MIN_HEIGHT,
  noteSizing,
  parseNoteSegments,
} from "@/canvas/note-layout";
import { cleanData, deserializeState, flowNodeToStored, parseState, stateToItems } from "@/canvas/state";
import { MIN_SIZE, type CanvasFlowNode, type NoteFlowNode, type SectionFlowNode } from "@/canvas/types";
import { validateSaveBody } from "@/lib/canvas/store";

const SEED =
  "WILD: The whole checkout is one tall seed packet. The order summary is printed on the back like planting instructions. " +
  "SALVAGE: A flippable 'ticket card'.";

describe("parseNoteSegments", () => {
  it("keeps plain text as one unlabeled segment, unchanged", () => {
    expect(parseNoteSegments("Make it feel cold\n\n  second line")).toEqual([{ label: null, text: "Make it feel cold\n\n  second line" }]);
  });

  it("splits WILD and SALVAGE on the same line", () => {
    expect(parseNoteSegments(SEED)).toEqual([
      {
        label: "WILD",
        text: "The whole checkout is one tall seed packet. The order summary is printed on the back like planting instructions.",
      },
      { label: "SALVAGE", text: "A flippable 'ticket card'." },
    ]);
  });

  it("splits labels at the start of lines and keeps line breaks inside a segment", () => {
    expect(parseNoteSegments("Intro line\nWILD: one\ntwo\nNOTE: three")).toEqual([
      { label: null, text: "Intro line" },
      { label: "WILD", text: "one\ntwo" },
      { label: "NOTE", text: "three" },
    ]);
  });

  it("splits an unknown caps label only at a line or sentence start", () => {
    expect(parseNoteSegments("Use HTTPS: always")).toEqual([{ label: null, text: "Use HTTPS: always" }]);
    expect(parseNoteSegments("Ship it. RISK: none")).toEqual([
      { label: null, text: "Ship it." },
      { label: "RISK", text: "none" },
    ]);
  });

  it("ignores short, long and lowercase labels and URLs", () => {
    for (const t of ["OK: fine", "ABCDEFGHIJKLM: too long", "Wild: lower", "see https://x.test/a"]) {
      expect(parseNoteSegments(t)).toEqual([{ label: null, text: t }]);
    }
  });

  it("keeps a label with no text after it", () => {
    expect(parseNoteSegments("WILD:")).toEqual([{ label: "WILD", text: "" }]);
  });
});

describe("estimateNoteHeight", () => {
  it("never goes under the minimum", () => {
    expect(estimateNoteHeight("", 220)).toBe(NOTE_MIN_HEIGHT);
    expect(estimateNoteHeight("hi", 220)).toBe(NOTE_MIN_HEIGHT);
    expect(NOTE_MIN_HEIGHT).toBe(MIN_SIZE.note.h);
  });

  it("grows with text length and shrinks with width", () => {
    const long = "word ".repeat(80);
    expect(estimateNoteHeight(long, 220)).toBeGreaterThan(estimateNoteHeight(long, 400));
    expect(estimateNoteHeight(long + long, 280)).toBeGreaterThan(estimateNoteHeight(long, 280));
  });

  it("counts lines from characters per line, and each newline", () => {
    expect(estimateLines("a\nb\nc", 200)).toBe(3);
    expect(estimateLines("x".repeat(100), 200)).toBe(Math.ceil(100 / Math.floor((200 / 7.1) * 0.92)));
  });

  it("adds room for label chips and segment rules", () => {
    const plain = SEED.replace(/WILD: |SALVAGE: /g, "");
    expect(estimateNoteHeight(SEED, 280)).toBeGreaterThan(estimateNoteHeight(plain, 280));
  });

  it("is taller than the old 178px for the seed packet note at 280px (it used to scroll)", () => {
    expect(estimateNoteHeight(SEED + " " + SEED, 280)).toBeGreaterThan(178);
  });
});

describe("noteSizing (the compact decision)", () => {
  it("auto notes fit their text and are never compact", () => {
    expect(noteSizing({ manualHeight: false, height: 178, natural: 260 })).toEqual({ height: 260, compact: false });
    expect(noteSizing({ manualHeight: false, height: 178, natural: 40 })).toEqual({ height: NOTE_MIN_HEIGHT, compact: false });
    expect(noteSizing({ manualHeight: false, height: 100, natural: 99.4 })).toEqual({ height: 100, compact: false });
  });

  it("a manual height shorter than the text is compact, not clipped or scrolled", () => {
    expect(noteSizing({ manualHeight: true, height: 96, natural: 260 })).toEqual({ height: 96, compact: true });
  });

  it("a manual height with room to spare stays as set", () => {
    expect(noteSizing({ manualHeight: true, height: 300, natural: 120 })).toEqual({ height: 300, compact: false });
    // Within the 1px tolerance: not compact.
    expect(noteSizing({ manualHeight: true, height: 120, natural: 121 })).toEqual({ height: 120, compact: false });
  });

  it("never returns less than the minimum", () => {
    expect(noteSizing({ manualHeight: true, height: 10, natural: 200 }).height).toBe(NOTE_MIN_HEIGHT);
  });

  it("a height change counts only past the tolerance (no update loops)", () => {
    expect(heightChanged(100, 101)).toBe(false);
    expect(heightChanged(100, 101.5)).toBe(true);
  });

  it("a resize that changed the height makes it manual; width only keeps the mode", () => {
    expect(manualAfterResize(140, 96, false)).toBe(true);
    expect(manualAfterResize(140, 140.5, false)).toBe(false);
    expect(manualAfterResize(140, 140, true)).toBe(true);
  });

  it("counts hidden compact lines for the +N lines hint", () => {
    expect(hiddenLines(100, 100)).toBe(0);
    expect(hiddenLines(100 + NOTE_COMPACT_LINE_PX * 2.2, 100)).toBe(3);
    expect(NOTE_LINE_PX).toBeCloseTo(20.3);
  });
});

describe("note data: manualHeight round trip", () => {
  const stored = {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      { id: "n1", type: "note", x: 0, y: 0, w: 220, h: 96, data: { text: "Long text", color: "pink", manualHeight: true } },
      // Saved before this change: no manualHeight, and the old fixed 178px height.
      { id: "n2", type: "note", x: 0, y: 200, w: 280, h: 178, data: { text: "Old note", color: "yellow" } },
    ],
    tray: [],
  };

  it("parseState keeps manualHeight: true and drops anything else", () => {
    const s = parseState(stored);
    expect(s.nodes[0]?.data).toEqual({ text: "Long text", color: "pink", manualHeight: true });
    expect(s.nodes[1]?.data).toEqual({ text: "Old note", color: "yellow" });
    expect(cleanData("note", { text: "x", manualHeight: "yes" })).toEqual({ text: "x", color: null });
    expect(cleanData("note", { text: "x", manualHeight: false })).toEqual({ text: "x", color: null });
  });

  it("validateSaveBody accepts the field and old notes without it", () => {
    const body = { state: stored };
    const res = validateSaveBody(body, JSON.stringify(body).length);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.nodes.map((n) => n.data)).toEqual([
      { text: "Long text", color: "pink", manualHeight: true },
      { text: "Old note", color: "yellow" },
    ]);
  });

  it("survives load and save through React Flow nodes", () => {
    const { nodes } = deserializeState(stored);
    const back = nodes.map((n) => flowNodeToStored(n));
    expect(back[0]).toMatchObject({ h: 96, data: { manualHeight: true } });
    expect(back[1]?.data).not.toHaveProperty("manualHeight");
  });

  it("stays out of exports and get_canvas (a UI detail)", () => {
    const items = stateToItems(parseState(stored));
    expect(items[0]).not.toHaveProperty("manualHeight");
    expect(items[0]).toMatchObject({ type: "note", text: "Long text", color: "pink" });
  });
});

const section = (over: Partial<SectionFlowNode> = {}): SectionFlowNode => ({
  id: "s",
  type: "section",
  position: { x: 0, y: 0 },
  width: 400,
  height: 200,
  data: { title: "S" },
  ...over,
});
const note = (over: Partial<NoteFlowNode> = {}, data: Partial<NoteFlowNode["data"]> = {}): NoteFlowNode => ({
  id: "n",
  type: "note",
  position: { x: 16, y: 48 },
  width: 220,
  height: 100,
  parentId: "s",
  data: { text: "hello", color: "yellow", ...data },
  ...over,
});

describe("growSectionToFit", () => {
  it("grows the section when a note inside it gets taller", () => {
    const out = growSectionToFit([section(), note({ height: 300 })], "n");
    expect(out.find((n) => n.id === "s")?.height).toBe(48 + 300 + 16);
  });

  it("never shrinks and returns the same list when it fits", () => {
    const nodes: CanvasFlowNode[] = [section(), note()];
    expect(growSectionToFit(nodes, "n")).toBe(nodes);
  });

  it("grows the restore height of a collapsed section", () => {
    const out = growSectionToFit([section({ height: 48, data: { title: "S", collapsed: true, expandedHeight: 200 } }), note({ height: 300 })], "n");
    const s = out.find((n) => n.id === "s") as SectionFlowNode;
    expect(s.height).toBe(48);
    expect(s.data.expandedHeight).toBe(48 + 300 + 16);
  });
});

describe("arrange keeps notes as tall as their text", () => {
  it("masonry uses the text height, not the old aspect ratio", () => {
    const long = "A long note. ".repeat(30);
    const out = arrangeNodes([note({ parentId: undefined, width: 220, height: 140 }, { text: long })], "masonry");
    expect(out[0]?.width).toBe(280);
    expect(out[0]?.height).toBe(estimateNoteHeight(long, 280));
  });

  it("grid cells do not stretch a short note", () => {
    const out = arrangeNodes([note({ parentId: undefined }, { text: "short" })], "grid");
    expect(out[0]?.height).toBe(NOTE_MIN_HEIGHT);
  });

  it("a manual note keeps the layout's height", () => {
    const out = arrangeNodes([note({ parentId: undefined, width: 220, height: 110 }, { text: "x", manualHeight: true })], "masonry");
    expect(out[0]?.height).toBe(Math.round(280 / (220 / 110)));
  });
});
