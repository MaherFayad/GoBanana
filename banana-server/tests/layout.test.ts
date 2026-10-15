import { describe, expect, it } from "vitest";
import {
  COLUMN_WIDTH,
  GAP,
  LAYOUTS,
  SECTION_HEADER,
  ZONE_LABEL_SPACE,
  arrange,
  arrangeZoned,
  aspectOf,
  byDirection,
  grid,
  hasOverlap,
  hero,
  masonry,
  type LayoutItem,
  type Rect,
} from "@/lib/layout";

const ratios = [1, 0.75, 1.5, 0.5, 2, 1.33, 0.8, 1.1, 0.6, 1.77, 1, 0.9, 1.25];
function items(n: number, sections: string[] = []): LayoutItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `i${i}`,
    aspectRatio: ratios[i % ratios.length],
    sectionId: sections.length > 0 ? sections[i % sections.length] : undefined,
  }));
}
const byId = (rects: Rect[]) => Object.fromEntries(rects.map((r) => [r.id, r]));

describe("helpers", () => {
  it("reads aspect ratio from aspectRatio, then w/h, else 1", () => {
    expect(aspectOf({ id: "a", aspectRatio: 2, w: 1, h: 1 })).toBe(2);
    expect(aspectOf({ id: "a", w: 300, h: 150 })).toBe(2);
    expect(aspectOf({ id: "a", w: 300 })).toBe(1);
    expect(aspectOf({ id: "a", aspectRatio: -1 })).toBe(1);
    expect(aspectOf({ id: "a", aspectRatio: Number.NaN, w: 0, h: 10 })).toBe(1);
  });

  it("detects overlaps but not touching edges", () => {
    expect(hasOverlap([{ id: "a", x: 0, y: 0, w: 10, h: 10 }, { id: "b", x: 10, y: 0, w: 10, h: 10 }])).toBe(false);
    expect(hasOverlap([{ id: "a", x: 0, y: 0, w: 10, h: 10 }, { id: "b", x: 9, y: 9, w: 10, h: 10 }])).toBe(true);
  });
});

describe("every layout", () => {
  for (const layout of LAYOUTS) {
    it(`${layout}: places every item once, no overlaps, deterministic`, () => {
      const input = items(13, ["s1", "s2", "s3"]);
      const sections = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];
      const a = arrange(layout, input, { sections });
      const b = arrange(layout, input.map((x) => ({ ...x })), { sections });
      expect(b).toEqual(a);
      expect(a.items.map((r) => r.id).sort()).toEqual(input.map((x) => x.id).sort());
      expect(hasOverlap(a.items)).toBe(false);
      expect(hasOverlap(a.sections)).toBe(false);
      for (const r of a.items) {
        expect(Number.isInteger(r.x) && Number.isInteger(r.y) && r.w > 0 && r.h > 0).toBe(true);
      }
    });

    it(`${layout}: handles empty input`, () => {
      expect(arrange(layout, []).items).toEqual([]);
    });

    it(`${layout}: honors origin`, () => {
      const input = items(5, ["s1"]);
      const base = arrange(layout, input);
      const moved = arrange(layout, input, { origin: { x: 100, y: -40 } });
      moved.items.forEach((r, i) => {
        expect(r.x - base.items[i]!.x).toBe(100);
        expect(r.y - base.items[i]!.y).toBe(-40);
      });
    });
  }
});

describe("by_direction", () => {
  it("puts one 280 px column per section with 16 px gaps", () => {
    const sections = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const res = byDirection(items(9, ["a", "b", "c"]), { sections });
    expect(res.sections.map((s) => [s.id, s.x, s.w])).toEqual([
      ["a", 0, 280],
      ["b", 296, 280],
      ["c", 592, 280],
    ]);
    const frames = byId(res.sections);
    for (const it of items(9, ["a", "b", "c"])) {
      const r = byId(res.items)[it.id]!;
      const f = frames[it.sectionId!]!;
      expect(r.w).toBe(COLUMN_WIDTH);
      expect(r.x).toBe(f.x);
      // inside its frame, below the title
      expect(r.y).toBeGreaterThanOrEqual(f.y + SECTION_HEADER);
      expect(r.y + r.h).toBeLessThanOrEqual(f.y + f.h);
    }
  });

  it("stacks items with 16 px gaps and keeps aspect ratio", () => {
    const res = byDirection(
      [
        { id: "x", aspectRatio: 2, sectionId: "a" },
        { id: "y", w: 400, h: 800, sectionId: "a" },
      ],
      { sections: [{ id: "a" }] },
    );
    const [x, y] = res.items;
    expect(x).toEqual({ id: "x", x: 0, y: SECTION_HEADER, w: 280, h: 140 });
    expect(y).toEqual({ id: "y", x: 0, y: SECTION_HEADER + 140 + GAP, w: 280, h: 560 });
  });

  it("keeps empty sections and puts loose items in a last column without a frame", () => {
    const res = byDirection(
      [
        { id: "x", sectionId: "a" },
        { id: "y" },
        { id: "z", sectionId: "missing" },
      ],
      { sections: [{ id: "a" }, { id: "empty" }] },
    );
    expect(res.sections.map((s) => s.id)).toEqual(["a", "empty"]);
    expect(res.sections[1]!.h).toBeGreaterThan(0);
    const loose = res.items.filter((r) => r.id !== "x");
    expect(loose.every((r) => r.x === 2 * (COLUMN_WIDTH + GAP))).toBe(true);
  });

  it("uses item sectionIds in first-seen order when no section list is given", () => {
    const res = byDirection([{ id: "1", sectionId: "b" }, { id: "2", sectionId: "a" }]);
    expect(res.sections.map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("masonry", () => {
  it("uses 4 columns of 280 px with 16 px gaps", () => {
    const res = masonry(items(12));
    const xs = [...new Set(res.items.map((r) => r.x))].sort((a, b) => a - b);
    expect(xs).toEqual([0, 296, 592, 888]);
    expect(res.items.every((r) => r.w === COLUMN_WIDTH)).toBe(true);
  });

  it("preserves aspect ratios (within 1 px rounding)", () => {
    const input = items(12);
    const res = byId(masonry(input).items);
    for (const it of input) {
      const r = res[it.id]!;
      expect(Math.abs(r.h - r.w / aspectOf(it))).toBeLessThanOrEqual(0.5);
    }
  });

  it("drops each item into the shortest column with 16 px vertical gaps", () => {
    const res = masonry([
      { id: "a", aspectRatio: 0.5 },
      { id: "b", aspectRatio: 1 },
      { id: "c", aspectRatio: 1 },
      { id: "d", aspectRatio: 1 },
      { id: "e", aspectRatio: 1 },
    ]);
    const e = byId(res.items).e!;
    // a is 560 tall, b, c, d are 280 tall: e goes under b in column 2.
    expect(e).toEqual({ id: "e", x: 296, y: 280 + GAP, w: 280, h: 280 });
  });
});

describe("grid", () => {
  it("uses equal square cells in rows of 4", () => {
    const res = grid(items(6));
    expect(res.items.every((r) => r.w === COLUMN_WIDTH && r.h === COLUMN_WIDTH)).toBe(true);
    expect(res.items.map((r) => [r.x, r.y])).toEqual([
      [0, 0],
      [296, 0],
      [592, 0],
      [888, 0],
      [0, 296],
      [296, 296],
    ]);
  });

  it("accepts a custom column count and cell size", () => {
    const res = grid(items(4), { columns: 2, columnWidth: 100, gap: 10 });
    expect(res.items.map((r) => [r.x, r.y, r.w, r.h])).toEqual([
      [0, 0, 100, 100],
      [110, 0, 100, 100],
      [0, 110, 100, 100],
      [110, 110, 100, 100],
    ]);
  });
});

describe("hero", () => {
  it("makes the first item 2x a cell and puts the rest below it", () => {
    const res = hero(items(7));
    const [first, ...rest] = res.items;
    expect(first!.w).toBe(2 * COLUMN_WIDTH + GAP);
    expect(first!.h).toBe(2 * COLUMN_WIDTH + GAP);
    for (const r of rest) {
      expect(r.w).toBe(COLUMN_WIDTH);
      expect(r.y).toBeGreaterThanOrEqual(first!.y + first!.h + GAP);
    }
  });

  it("centers the hero over a wide row and the row under a narrow hero", () => {
    const wide = hero(items(5)).items;
    // 4 cells: 4*280 + 3*16 = 1168 wide; hero 576 wide, centered.
    expect(wide[0]!.x).toBe(Math.floor((1168 - 576) / 2));
    expect(wide.slice(1).map((r) => r.x)).toEqual([0, 296, 592, 888]);

    const narrow = hero(items(2)).items;
    expect(narrow[0]!.x).toBe(0);
    expect(narrow[1]!.x).toBe(Math.floor((576 - 280) / 2));
  });

  it("works with a single item", () => {
    expect(hero([{ id: "only" }]).items).toEqual([{ id: "only", x: 0, y: 0, w: 576, h: 576 }]);
  });
});

describe("spread", () => {
  /** One direction: 3 art (first is the lead), 2 notes, 6 UI, 2 swatches and a type sample. */
  function direction(): LayoutItem[] {
    return [
      { id: "ui1", aspectRatio: 0.5 },
      { id: "art1", zone: "art", aspectRatio: 1.5 },
      { id: "note1", kind: "note", aspectRatio: 280 / 120 },
      { id: "ui2", aspectRatio: 0.6 },
      { id: "art2", zone: "art", aspectRatio: 1 },
      { id: "ui3", aspectRatio: 1 },
      { id: "sw1", kind: "swatch", w: 220, h: 250 },
      { id: "ui4", aspectRatio: 0.75 },
      { id: "note2", kind: "note", aspectRatio: 280 / 90 },
      { id: "ui5", aspectRatio: 1.2 },
      { id: "art3", zone: "art", aspectRatio: 0.8 },
      { id: "ui6", aspectRatio: 0.5 },
      { id: "sw2", kind: "swatch", w: 220, h: 250 },
      { id: "type1", kind: "typeSample", w: 320, h: 170 },
    ];
  }

  it("puts the lead art at 2x on the left, notes beside it, a 3 by 2 UI grid on the right, swatches and type under", () => {
    const r = byId(arrange("spread", direction()).items);
    const top = ZONE_LABEL_SPACE;
    expect(r.art1).toEqual({ id: "art1", x: 0, y: top, w: 560, h: Math.round(560 / 1.5) });
    // Other art sits under the lead in two columns.
    expect(r.art2!.y).toBeGreaterThan(r.art1!.y + r.art1!.h);
    expect(r.art2!.x + r.art2!.w).toBeLessThanOrEqual(560);
    expect(r.art3!.x).toBeGreaterThan(r.art2!.x);
    // Notes: one column right of the lead, in order.
    expect(r.note1).toMatchObject({ x: 560 + GAP, y: top, w: COLUMN_WIDTH });
    expect(r.note2!.y).toBe(r.note1!.y + r.note1!.h + GAP);
    // UI: 3 columns at 280, two rows, in input order.
    const gridX = 560 + GAP + COLUMN_WIDTH + GAP;
    const cols = [0, 1, 2].map((c) => gridX + c * (COLUMN_WIDTH + GAP));
    expect(["ui1", "ui2", "ui3"].map((id) => r[id]!.x)).toEqual(cols);
    expect(["ui4", "ui5", "ui6"].map((id) => r[id]!.x)).toEqual(cols);
    for (const id of ["ui1", "ui2", "ui3", "ui4", "ui5", "ui6"]) expect(r[id]!.w).toBe(COLUMN_WIDTH);
    const row1Bottom = Math.max(...["ui1", "ui2", "ui3"].map((id) => r[id]!.y + r[id]!.h));
    expect(r.ui4!.y).toBe(row1Bottom + GAP);
    // Swatches and the type sample: one row under everything, at their own size.
    const blocks = ["art1", "art2", "art3", "note1", "note2", "ui1", "ui2", "ui3", "ui4", "ui5", "ui6"];
    const bottom = Math.max(...blocks.map((id) => r[id]!.y + r[id]!.h));
    for (const id of ["sw1", "sw2", "type1"]) expect(r[id]!.y).toBe(bottom + GAP);
    expect([r.sw1!.x, r.sw2!.x, r.type1!.x]).toEqual([0, 220 + GAP, 440 + 2 * GAP]);
    expect(r.type1).toMatchObject({ w: 320, h: 170 });
    expect(hasOverlap(Object.values(r))).toBe(false);
  });

  it("drops empty blocks: no art means no label strip and the notes start at the left", () => {
    const r = byId(arrange("spread", direction().filter((it) => it.zone !== "art")).items);
    expect(r.note1).toMatchObject({ x: 0, y: 0 });
    expect(r.ui1).toMatchObject({ x: COLUMN_WIDTH + GAP, y: 0 });
    const onlyUi = byId(arrange("spread", [{ id: "a" }, { id: "b" }]).items);
    expect([onlyUi.a!.x, onlyUi.b!.x]).toEqual([0, COLUMN_WIDTH + GAP]);
  });

  it("caps a very tall lead at 1.5 times its width", () => {
    const r = byId(arrange("spread", [{ id: "tall", zone: "art", aspectRatio: 0.2 }]).items);
    expect(r.tall).toMatchObject({ w: 560, h: 840 });
  });

  it("arrangeZoned uses the spread as is (art and UI side by side, not stacked)", () => {
    const a = arrangeZoned("spread", direction(), { origin: { x: 16, y: 48 } });
    const b = arrange("spread", direction(), { origin: { x: 16, y: 48 } });
    expect(a).toEqual(b);
  });
});
