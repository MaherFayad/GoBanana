/**
 * Frankenstein pages in the canvas UI (stitch-ui): crop math, keyboard reorder, view filters by
 * theme, parts grouping and the client parts library. Pure modules only.
 */
import { describe, expect, it } from "vitest";
import { STITCH_MODES, toStitchMode, type Part, type StitchData } from "@/lib/stitch/types";
import { cssColorToHex, duotoneTables, harmonizeFromPalette, hexContrast, hexToRgb } from "@/lib/stitch/harmonize";
import { cleanStitchData } from "@/lib/stitch/parse";
import { cropAspect, cropStyles, displaySrc, dragCrop, fromPercentField, slotFilter, toPercent } from "@/canvas/stitch/crop";
import {
  appendPart,
  groupByRole,
  guessPlatform,
  joinRow,
  moveSlot,
  partUsage,
  removeSlot,
  roleLabel,
  stackParts,
  swapCandidates,
  swapPart,
  swapSlots,
} from "@/canvas/stitch/edit";
import { deserializeState, serializeState } from "@/canvas/state";
import type { CanvasFlowNode } from "@/canvas/types";

const part = (id: string, role: Part["role"], extra: Partial<Part> = {}): Part => ({
  id,
  role,
  imageUrl: `https://img.example.com/${id}.png`,
  sourceUrl: `https://dribbble.com/shots/${id}`,
  sourceSite: "dribbble.com",
  crop: { x: 0, y: 0, w: 1, h: 0.1 },
  ...extra,
});

const page = (): StitchData => ({
  title: "Test",
  platform: "website",
  mode: "collage",
  rows: [
    { id: "r1", slots: [{ id: "a", role: "nav", partId: "p1" }] },
    { id: "r2", slots: [{ id: "b", role: "sidebar", partId: "p2" }, { id: "c", role: "content", partId: "p3" }], widths: [1, 3] },
    { id: "r3", slots: [{ id: "d", role: "footer", partId: "p4" }] },
  ],
});

const order = (d: StitchData | null) => d?.rows.map((r) => r.slots.map((s) => s.id).join("")).join("|");

describe("crop math", () => {
  it("aspect is (crop.w * imgW) / (crop.h * imgH)", () => {
    expect(cropAspect({ x: 0, y: 0, w: 1, h: 0.1 }, 1440 / 3000)).toBeCloseTo((1 * 1440) / (0.1 * 3000));
    expect(cropAspect({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, 2)).toBeCloseTo(2);
  });

  it("scales the image by 1 / crop.w and moves it by -x and -y of its own size", () => {
    const s = cropStyles({ x: 0.25, y: 0.1, w: 0.5, h: 0.2 }, 1);
    expect(s.img.width).toBe("200%");
    expect(s.img.transform).toBe("translate(-25%, -10%)");
    expect(Number(s.box.aspectRatio)).toBeCloseTo(2.5);
  });

  it("full image crop is the image as is", () => {
    const s = cropStyles({ x: 0, y: 0, w: 1, h: 1 }, 16 / 9);
    expect(s.img.width).toBe("100%");
    expect(Number(s.box.aspectRatio)).toBeCloseTo(16 / 9, 3);
  });

  it("covers a box a row stretches: the fit box keeps the crop's aspect and grows to the taller side", () => {
    const s = cropStyles({ x: 0, y: 0, w: 1, h: 0.25 }, 1);
    expect(s.fit.aspectRatio).toBe(s.box.aspectRatio);
    expect(s.fit.width).toBe("max(100cqw, calc(100cqh * 4))");
  });

  it("shows the CDN's large size, not a giant original, with the same aspect", () => {
    expect(displaySrc("https://cdn.dribbble.com/userupload/1/file/original-a.png")).toBe("https://cdn.dribbble.com/userupload/1/file/original-a.png?resize=1600x");
    expect(displaySrc("https://cdn.dribbble.com/userupload/1/file/a.jpg?vertical=center")).toBe("https://cdn.dribbble.com/userupload/1/file/a.jpg?vertical=center&resize=1600x");
    expect(displaySrc("https://cdn.dribbble.com/a.png?resize=400x300")).toBe("https://cdn.dribbble.com/a.png?resize=400x300");
    expect(displaySrc("https://i.pinimg.com/originals/ab/cd/x.jpg")).toBe("https://i.pinimg.com/1200x/ab/cd/x.jpg");
    expect(displaySrc("https://i.pinimg.com/736x/ab/cd/x.jpg")).toBe("https://i.pinimg.com/736x/ab/cd/x.jpg");
    expect(displaySrc("https://cdn.lapa.ninja/a.webp")).toBe("https://cdn.lapa.ninja/a.webp");
  });

  it("clamps crops that leave the image", () => {
    const s = cropStyles({ x: 0.9, y: 0, w: 0.5, h: 1 }, 1);
    // w is cut to 0.1 so the crop stays inside.
    expect(s.img.width).toBe("1000%");
  });

  it("dragging moves inside the image and handles stop at the opposite edge", () => {
    const start = { x: 0.1, y: 0.1, w: 0.5, h: 0.2 };
    expect(dragCrop(start, "move", 0.9, 0)).toEqual({ x: 0.5, y: 0.1, w: 0.5, h: 0.2 });
    const se = dragCrop(start, "se", 0.1, 0.1);
    expect(se.w).toBeCloseTo(0.6);
    expect(se.h).toBeCloseTo(0.3);
    const w = dragCrop(start, "w", 0.9, 0);
    expect(w.x + w.w).toBeCloseTo(0.6);
    expect(w.w).toBeCloseTo(0.02);
  });

  it("number fields use percents", () => {
    expect(toPercent({ x: 0.125, y: 0, w: 0.5, h: 0.333 })).toEqual({ x: 12.5, y: 0, w: 50, h: 33.3 });
    expect(fromPercentField({ x: 0, y: 0, w: 1, h: 0.1 }, "y", 50)).toEqual({ x: 0, y: 0.5, w: 1, h: 0.1 });
    expect(fromPercentField({ x: 0, y: 0, w: 1, h: 0.1 }, "y", Number.NaN)).toEqual({ x: 0, y: 0, w: 1, h: 0.1 });
  });
});

describe("view filters", () => {
  it("collage leaves parts as they are", () => {
    expect(slotFilter("collage", "f")).toBeUndefined();
  });
  it("wireframe is grey and soft", () => {
    expect(slotFilter("wireframe")).toContain("grayscale(1)");
  });
  it("harmonize points every part at the page's SVG duotone filter, never inverts", () => {
    expect(slotFilter("harmonize", "bn-harmonize-p1")).toBe("url(#bn-harmonize-p1)");
    expect(slotFilter("harmonize")).toBe("grayscale(1)");
    for (const m of STITCH_MODES) expect(slotFilter(m, "x") ?? "").not.toContain("invert");
  });
});

describe("harmonize colors", () => {
  it("takes the darkest and lightest palette colors as ink and surface", () => {
    expect(harmonizeFromPalette([{ hex: "#C8553D" }, { hex: "#1a1a2e" }, { hex: "#f4f1de" }, { hex: "#81B29A" }])).toEqual({
      ink: "#1a1a2e",
      surface: "#f4f1de",
    });
  });
  it("pushes a low contrast pair apart (same hues) until it reaches 4.5:1", () => {
    const h = harmonizeFromPalette([{ hex: "#f6efe3" }, { hex: "#d62828" }])!;
    expect(hexContrast(h.ink, h.surface)).toBeGreaterThanOrEqual(4.5);
    const [r, g, b] = hexToRgb(h.ink)!;
    expect(r).toBeGreaterThan(g + b); // still a red
    expect(hexContrast(...Object.values(harmonizeFromPalette([{ hex: "#777777" }, { hex: "#888888" }])!) as [string, string])).toBeGreaterThanOrEqual(4.5);
  });
  it("falls back (undefined) for a palette without two distinct colors, or junk", () => {
    expect(harmonizeFromPalette([{ hex: "#777777" }])).toBeUndefined();
    expect(harmonizeFromPalette([{ hex: "#777777" }, { hex: "#777" }])).toBeUndefined();
    expect(harmonizeFromPalette([{ hex: "nope" }, { hex: "#fff" }])).toBeUndefined();
    expect(harmonizeFromPalette(undefined)).toBeUndefined();
  });
  it("builds feFuncR/G/B tables that map 0 to ink and 1 to surface", () => {
    expect(duotoneTables({ ink: "#000000", surface: "#ffffff" })).toEqual({ r: "0 1", g: "0 1", b: "0 1" });
    expect(duotoneTables({ ink: "#ff0000", surface: "#0000ff" })).toEqual({ r: "1 0", g: "0 0", b: "0 1" });
    expect(duotoneTables({ ink: "nope", surface: "#fff" })).toBeNull();
  });
  it("matches the WCAG contrast numbers", () => {
    expect(hexContrast("#000", "#fff")).toBeCloseTo(21, 5);
    expect(hexContrast("#777", "#777")).toBe(1);
  });
  it("reads computed token colors in hex or rgb form", () => {
    expect(cssColorToHex(" #EDEDED")).toBe("#ededed");
    expect(cssColorToHex("rgb(27, 27, 27)")).toBe("#1b1b1b");
    expect(cssColorToHex("oklch(0.5 0.1 30)")).toBeNull();
  });
  it("keeps even as a one-release alias of harmonize, in tools and saved pages", () => {
    expect(toStitchMode("even")).toBe("harmonize");
    expect(toStitchMode("harmonize")).toBe("harmonize");
    expect(toStitchMode("sepia")).toBeUndefined();
    expect(cleanStitchData({ mode: "even", rows: [] }).mode).toBe("harmonize");
    expect(cleanStitchData({ harmonize: { ink: "#1A1A2E", surface: "#f4f1de" } }).harmonize).toEqual({ ink: "#1a1a2e", surface: "#f4f1de" });
    expect(cleanStitchData({ harmonize: { ink: "red", surface: "#f4f1de" } }).harmonize).toBeUndefined();
  });
});

describe("keyboard reorder", () => {
  it("Alt+Left and Alt+Right swap neighbors and keep widths with their slots", () => {
    const r = moveSlot(page(), "b", "right");
    expect(order(r.data)).toBe("a|cb|d");
    expect(r.data?.rows[1]?.widths).toEqual([3, 1]);
    expect(r.focus).toBe("b");
    expect(moveSlot(page(), "b", "left").data).toBeNull();
    expect(moveSlot(page(), "b", "left").message).toBe("Already first in the row");
  });

  it("Alt+Up on a slot alone in its row swaps the rows", () => {
    const r = moveSlot(page(), "d", "up");
    expect(order(r.data)).toBe("a|d|bc");
    expect(moveSlot(page(), "a", "up").data).toBeNull();
  });

  it("Alt+Down on a slot that shares a row gives it a row of its own", () => {
    const r = moveSlot(page(), "b", "down");
    expect(order(r.data)).toBe("a|c|b|d");
    // One slot left: widths dropped to the default.
    expect(r.data?.rows[1]?.widths).toBeUndefined();
    expect(r.message).toContain("own row");
  });

  it("join row puts a slot at the end of the next row, up to 3", () => {
    expect(order(joinRow(page(), "a", "down").data)).toBe("bca|d");
    const full = joinRow(page(), "a", "down").data!;
    expect(joinRow(full, "d", "up").data).toBeNull();
  });

  it("pointer reorder swaps two slots", () => {
    expect(order(swapSlots(page(), "a", "c").data)).toBe("c|ba|d");
  });

  it("remove focuses the next slot in reading order", () => {
    const r = removeSlot(page(), "a");
    expect(order(r.data)).toBe("bc|d");
    expect(r.focus).toBe("b");
    expect(removeSlot(page(), "d").focus).toBe("c");
  });

  it("swapping a part drops the slot's own crop and takes the part's role", () => {
    const d = page();
    d.rows[0]!.slots[0]!.crop = { x: 0, y: 0, w: 1, h: 0.05 };
    const r = swapPart(d, "a", part("p9", "hero"));
    expect(r.data?.rows[0]?.slots[0]).toEqual({ id: "a", role: "hero", partId: "p9" });
  });

  it("a part dropped on the page becomes a new row", () => {
    const r = appendPart(page(), part("p9", "cta"));
    expect(r.data?.rows).toHaveLength(4);
    expect(r.data?.rows[3]?.slots[0]?.partId).toBe("p9");
    // Ids are numbered per page, as the server makes them.
    const numbered: StitchData = { ...page(), rows: [{ id: "rw-2", slots: [{ id: "sl-5", role: "nav", partId: "p1" }] }] };
    const n = appendPart(numbered, part("p9", "cta")).data!;
    expect(n.rows[1]).toEqual({ id: "rw-3", slots: [{ id: "sl-6", role: "cta", partId: "p9" }] });
  });
});

describe("parts library", () => {
  const lib = [part("p1", "nav"), part("p2", "hero"), part("p3", "nav"), part("p4", "footer"), part("p5", "hero")];

  it("groups by role in role order", () => {
    expect(groupByRole(lib).map((g) => [g.role, g.parts.map((p) => p.id)])).toEqual([
      ["nav", ["p1", "p3"]],
      ["hero", ["p2", "p5"]],
      ["footer", ["p4"]],
    ]);
  });

  it("swap candidates list the same role first and leave out the current part", () => {
    expect(swapCandidates(lib, "hero", "p2").map((p) => p.id)).toEqual(["p5", "p1", "p3", "p4"]);
  });

  it("counts how many pages use a part", () => {
    const u = partUsage([page(), page()]);
    expect(u.get("p1")).toBe(2);
    expect(u.get("p9")).toBeUndefined();
  });

  it("Frankenstein it stacks the picked parts one per row, in pick order", () => {
    const d = stackParts([lib[3]!, lib[0]!]);
    expect(d.rows.map((r) => r.slots[0]?.partId)).toEqual(["p4", "p1"]);
    expect(d.mode).toBe("collage");
    expect(d.title).toBe("Frankenstein page");
    expect(guessPlatform([part("x", "tabbar")])).toBe("mobile");
    expect(guessPlatform([part("x", "table")])).toBe("webapp");
    expect(roleLabel("status-header")).toBe("Status header");
  });

  it("a page and its parts survive the save and load the canvas UI uses", () => {
    const lib = [part("p1", "nav"), part("p2", "sidebar"), part("p3", "content"), part("p4", "footer")];
    const node = { id: "st1", type: "stitch", position: { x: 0, y: 0 }, width: 720, height: 600, data: page() } as CanvasFlowNode;
    const saved = serializeState([node], { x: 0, y: 0, zoom: 1 }, [], lib);
    expect(saved.parts?.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4"]);
    const back = deserializeState(JSON.parse(JSON.stringify(saved)));
    expect(back.parts).toHaveLength(4);
    const st = back.nodes.find((n) => n.id === "st1");
    expect(st?.type).toBe("stitch");
    expect(st && st.type === "stitch" ? order(st.data) : null).toBe("a|bc|d");
    // Removing the last part is saved too (an empty list, not a missing key).
    expect(serializeState([], { x: 0, y: 0, zoom: 1 }, [], []).parts).toEqual([]);
  });
});
