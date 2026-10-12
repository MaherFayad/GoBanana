/** lib/stitch pure logic: default crops, parsing, recipe filling, remix, ops and frame size. */
import { describe, expect, it } from "vitest";
import { defaultCrop, isFullPageShot } from "@/lib/stitch/crop";
import { fillRecipe, remix, stitchKey } from "@/lib/stitch/fill";
import { applyOps, type StitchOp } from "@/lib/stitch/ops";
import { cleanStitchData, parseParts, pruneStitch } from "@/lib/stitch/parse";
import { stitchSize } from "@/lib/stitch/size";
import { MAX_PARTS, MAX_SLOTS_PER_ROW, MAX_STITCH_ROWS, type Part, type PartRole, type StitchData } from "@/lib/stitch/types";
import { safeUrl, siteFromUrl } from "@/canvas/state";
import { library, part } from "./stitch-fixtures";

const sources = (d: StitchData, parts: readonly Part[]) => {
  const by = new Map(parts.map((p) => [p.id, p]));
  return new Set(d.rows.flatMap((r) => r.slots.map((s) => by.get(s.partId)!.sourceUrl))).size;
};

describe("defaultCrop", () => {
  const screen = { imageWidth: 1440, imageHeight: 900 };
  const tall = { imageWidth: 1440, imageHeight: 6000 };
  it.each([
    ["nav", screen, { x: 0, y: 0, w: 1, h: 0.08 }],
    ["nav", tall, { x: 0, y: 0, w: 1, h: 0.04 }],
    ["hero", screen, { x: 0, y: 0.08, w: 1, h: 0.35 }],
    ["hero", tall, { x: 0, y: 0.04, w: 1, h: 0.15 }],
    ["footer", screen, { x: 0, y: 0.9, w: 1, h: 0.1 }],
    ["tabbar", { imageWidth: 390, imageHeight: 844 }, { x: 0, y: 0.9, w: 1, h: 0.1 }],
    ["status-header", screen, { x: 0, y: 0, w: 1, h: 0.14 }],
    ["sidebar", screen, { x: 0, y: 0, w: 0.18, h: 1 }],
    ["cards", screen, { x: 0, y: 0.4, w: 1, h: 0.3 }],
    ["cards", tall, { x: 0, y: 0.4, w: 1, h: 0.2 }],
  ] as const)("%s on %o", (role, ctx, crop) => {
    const got = defaultCrop(role, ctx);
    for (const k of ["x", "y", "w", "h"] as const) expect(got[k]).toBeCloseTo(crop[k], 5);
  });

  it("tells full page shots from single screens by platform", () => {
    expect(isFullPageShot({ imageWidth: 390, imageHeight: 844, platform: "mobile" })).toBe(false);
    expect(isFullPageShot({ imageWidth: 390, imageHeight: 4000, platform: "mobile" })).toBe(true);
    expect(isFullPageShot({ imageWidth: 1440, imageHeight: 2600, platform: "website" })).toBe(true);
    expect(isFullPageShot({ imageWidth: 390, imageHeight: 844 })).toBe(false);
    expect(isFullPageShot({})).toBe(false);
  });
});

describe("parse", () => {
  it("keeps valid parts, drops invalid ones and caps the library", () => {
    const raw = [
      part("pt-a", "nav", 1),
      { ...part("pt-b", "hero", 2), imageUrl: "data:image/png;base64,AAAA" },
      { ...part("pt-c", "hero", 3), sourceUrl: "javascript:alert(1)" },
      { ...part("pt-d", "bogus" as PartRole, 4) },
      { ...part("pt-e", "hero", 5), crop: { x: -1, y: 0.5, w: 9, h: "x" } },
      { ...part("pt-f", "cta", 6), crop: { x: -1, y: 0.95, w: 9, h: 0.5 } },
      part("pt-a", "footer", 7),
    ];
    const parts = parseParts(raw, safeUrl, siteFromUrl);
    expect(parts.map((p) => p.id)).toEqual(["pt-a", "pt-f"]);
    expect(parts[1]!.crop.y).toBe(0.95);
    expect(parts[1]!.crop.h).toBeCloseTo(0.05, 6);
    const many = Array.from({ length: MAX_PARTS + 5 }, (_, i) => part(`pt-${i}`, "cards", i));
    expect(parseParts(many, safeUrl, siteFromUrl)).toHaveLength(MAX_PARTS);
  });

  it("caps rows and slots, clamps crops and drops duplicate ids", () => {
    const slots = (r: number) => Array.from({ length: 5 }, (_, i) => ({ id: `sl-${r}-${i}`, role: "cards", partId: "pt-a", crop: { x: 0.5, y: 0.5, w: 2, h: 2 } }));
    const d = cleanStitchData({
      title: "  T  ",
      platform: "phone",
      mode: "weird",
      rows: [
        ...Array.from({ length: MAX_STITCH_ROWS + 3 }, (_, r) => ({ id: `rw-${r}`, slots: slots(r), widths: [1, 2, 3] })),
        { id: "rw-0", slots: [{ id: "sl-x", role: "nav", partId: "pt-a" }] },
      ],
    });
    expect(d.title).toBe("T");
    expect(d.platform).toBe("website");
    expect(d.mode).toBe("collage");
    expect(d.rows).toHaveLength(MAX_STITCH_ROWS);
    expect(d.rows[0]!.slots).toHaveLength(MAX_SLOTS_PER_ROW);
    expect(d.rows[0]!.widths).toEqual([1, 2, 3]);
    expect(d.rows[0]!.slots[0]!.crop).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
    expect(cleanStitchData(null).rows).toEqual([]);
  });

  it("prunes slots whose part is gone and rows left empty", () => {
    const d = cleanStitchData({
      rows: [
        { id: "rw-1", slots: [{ id: "sl-1", role: "nav", partId: "pt-a" }] },
        { id: "rw-2", slots: [{ id: "sl-2", role: "sidebar", partId: "pt-gone" }, { id: "sl-3", role: "table", partId: "pt-a" }], widths: [1, 4] },
        { id: "rw-3", slots: [{ id: "sl-4", role: "footer", partId: "pt-gone" }] },
      ],
    });
    const p = pruneStitch(d, new Set(["pt-a"]));
    expect(p.rows.map((r) => r.id)).toEqual(["rw-1", "rw-2"]);
    expect(p.rows[1]).toEqual({ id: "rw-2", slots: [{ id: "sl-3", role: "table", partId: "pt-a" }] });
  });
});

describe("fillRecipe", () => {
  const parts = library();
  const recipe: PartRole[] = ["nav", "hero", "cards", "footer"];

  it("is seeded and stable", () => {
    const a = fillRecipe(recipe, parts, { variants: 4, seed: "s1", platform: "website" });
    const b = fillRecipe(recipe, parts, { variants: 4, seed: "s1", platform: "website" });
    expect(a).toEqual(b);
    const c = fillRecipe(recipe, parts, { variants: 4, seed: "s2", platform: "website" });
    expect(c.stitches.map((s) => stitchKey(s.rows))).not.toEqual(a.stitches.map((s) => stitchKey(s.rows)));
  });

  it("makes distinct variants that each mix at least 3 sources", () => {
    const { stitches, notes } = fillRecipe(recipe, parts, { variants: 6, seed: 7, platform: "website", title: "Idea" });
    expect(notes).toEqual([]);
    expect(stitches).toHaveLength(6);
    expect(new Set(stitches.map((s) => stitchKey(s.rows))).size).toBe(6);
    for (const s of stitches) {
      expect(sources(s, parts)).toBeGreaterThanOrEqual(3);
      expect(s.rows.map((r) => r.slots[0]!.role)).toEqual(recipe);
      expect(s.rows.map((r) => r.id)).toEqual(["rw-1", "rw-2", "rw-3", "rw-4"]);
    }
    expect(stitches.map((s) => s.title)).toEqual(["Idea 1", "Idea 2", "Idea 3", "Idea 4", "Idea 5", "Idea 6"]);
  });

  it("falls back to a related role, skips a role with nothing, and says so", () => {
    const { stitches, notes } = fillRecipe(["status-header", "pricing", "chart"], parts, { variants: 1, seed: 1, platform: "mobile" });
    expect(stitches[0]!.rows.map((r) => r.slots[0]!.role)).toEqual(["status-header", "pricing"]);
    expect(notes.join(" ")).toContain("No status-header part in the library, so a nav part fills it.");
    expect(notes.join(" ")).toContain("No part for chart");
  });

  it("puts a sidebar in the same row as the main content", () => {
    const lib = [...parts, part("pt-side", "sidebar", 9), part("pt-table", "table", 8)];
    const { stitches } = fillRecipe(["nav", "sidebar", "table"], lib, { variants: 1, seed: 1, platform: "webapp" });
    expect(stitches[0]!.rows).toHaveLength(2);
    expect(stitches[0]!.rows[1]).toMatchObject({ widths: [1, 4], slots: [{ role: "sidebar" }, { role: "table" }] });
  });

  it("keeps locked roles and stops when combinations run out", () => {
    const { stitches, notes } = fillRecipe(["nav", "hero"], parts, { variants: 6, seed: 3, platform: "website", lock: { nav: "pt-nav2" } });
    expect(stitches.every((s) => s.rows[0]!.slots[0]!.partId === "pt-nav2")).toBe(true);
    expect(stitches).toHaveLength(3);
    expect(notes.join(" ")).toContain("Made 3 of 6 variants");
  });

  it("returns nothing for an empty library", () => {
    expect(fillRecipe(["nav"], [], { variants: 2, seed: 1, platform: "website" }).stitches).toEqual([]);
  });
});

describe("remix", () => {
  const parts = library();
  const base = fillRecipe(["nav", "hero", "cards", "footer"], parts, { variants: 1, seed: 11, platform: "website" }).stitches[0]!;

  it("makes new distinct variants, never the original", () => {
    const r = remix(base, parts, { count: 4, seed: 1 });
    expect(r.stitches).toHaveLength(4);
    const keys = r.stitches.map((s) => stitchKey(s.rows));
    expect(new Set(keys).size).toBe(4);
    expect(keys).not.toContain(stitchKey(base.rows));
    expect(remix(base, parts, { count: 4, seed: 1 })).toEqual(r);
    // Slot ids stay, so the same slot can be found in every variant.
    expect(r.stitches[0]!.rows.flatMap((x) => x.slots.map((s) => s.id))).toEqual(base.rows.flatMap((x) => x.slots.map((s) => s.id)));
  });

  it("keeps locked slots and roles", () => {
    const navSlot = base.rows[0]!.slots[0]!;
    const r = remix(base, parts, { count: 3, seed: 2, lock: [navSlot.id, "footer"] });
    for (const s of r.stitches) {
      expect(s.rows[0]!.slots[0]!.partId).toBe(navSlot.partId);
      expect(s.rows[3]!.slots[0]!.partId).toBe(base.rows[3]!.slots[0]!.partId);
    }
  });

  it("changes only the roles in vary", () => {
    const r = remix(base, parts, { count: 2, seed: 3, vary: ["hero"] });
    expect(r.stitches).toHaveLength(2);
    for (const s of r.stitches) {
      expect(s.rows[1]!.slots[0]!.partId).not.toBe(base.rows[1]!.slots[0]!.partId);
      for (const i of [0, 2, 3]) expect(s.rows[i]!.slots[0]!.partId).toBe(base.rows[i]!.slots[0]!.partId);
    }
  });

  it("says so when everything is locked", () => {
    const r = remix(base, parts, { count: 2, seed: 3, lock: ["nav", "hero", "cards", "footer"] });
    expect(r.stitches).toEqual([]);
    expect(r.notes[0]).toContain("Nothing to remix");
  });
});

describe("applyOps", () => {
  const parts = [...library(), part("pt-side", "sidebar", 5)];
  const base: StitchData = {
    title: "Page",
    platform: "website",
    mode: "collage",
    rows: [
      { id: "rw-1", slots: [{ id: "sl-1", role: "nav", partId: "pt-nav1" }] },
      { id: "rw-2", slots: [{ id: "sl-2", role: "hero", partId: "pt-hero1", crop: { x: 0, y: 0, w: 1, h: 0.5 } }] },
      { id: "rw-3", slots: [{ id: "sl-3", role: "cards", partId: "pt-cards1" }, { id: "sl-4", role: "cards", partId: "pt-cards2" }], widths: [2, 1] },
    ],
  };
  const run = (ops: StitchOp[]) => {
    const r = applyOps(base, ops, parts);
    if (!r.ok) throw new Error(r.error);
    return r.stitch;
  };

  it("swap sets the part and role and drops the crop override", () => {
    const s = run([{ op: "swap", slotId: "sl-2", partId: "pt-side" }]);
    expect(s.rows[1]!.slots[0]).toEqual({ id: "sl-2", role: "sidebar", partId: "pt-side" });
  });

  it("move takes a slot to another row and index", () => {
    const s = run([{ op: "move", slotId: "sl-4", rowId: "rw-1", index: 0 }]);
    expect(s.rows[0]!.slots.map((x) => x.id)).toEqual(["sl-4", "sl-1"]);
    expect(s.rows[2]!.widths).toBeUndefined();
    const same = run([{ op: "move", slotId: "sl-4", index: 0 }]);
    expect(same.rows[2]).toMatchObject({ slots: [{ id: "sl-4" }, { id: "sl-3" }], widths: [1, 2] });
    const emptied = run([{ op: "move", slotId: "sl-1", rowId: "rw-2", index: 9 }]);
    expect(emptied.rows.map((r) => r.id)).toEqual(["rw-2", "rw-3"]);
  });

  it("moveRow reorders rows", () => {
    expect(run([{ op: "moveRow", rowId: "rw-3", index: 0 }]).rows.map((r) => r.id)).toEqual(["rw-3", "rw-1", "rw-2"]);
  });

  it("remove takes out a slot or a row", () => {
    expect(run([{ op: "remove", slotId: "sl-3" }]).rows[2]).toEqual({ id: "rw-3", slots: [{ id: "sl-4", role: "cards", partId: "pt-cards2" }] });
    expect(run([{ op: "remove", rowId: "rw-1" }]).rows.map((r) => r.id)).toEqual(["rw-2", "rw-3"]);
  });

  it("insert adds a row at an index or after a row, with new ids", () => {
    const s = run([{ op: "insert", afterRowId: "rw-1", slots: [{ partId: "pt-side" }, { partId: "pt-cards3", note: "dense grid" }], widths: [1, 4] }]);
    expect(s.rows[1]).toEqual({
      id: "rw-4",
      slots: [
        { id: "sl-5", role: "sidebar", partId: "pt-side" },
        { id: "sl-6", role: "cards", partId: "pt-cards3", note: "dense grid" },
      ],
      widths: [1, 4],
    });
    expect(run([{ op: "insert", index: 0, slots: [{ partId: "pt-footer1" }] }]).rows[0]!.slots[0]!.partId).toBe("pt-footer1");
    expect(run([{ op: "insert", slots: [{ partId: "pt-footer1" }] }]).rows.at(-1)!.slots[0]!.role).toBe("footer");
  });

  it("crop, widths, mode, note and title", () => {
    const s = run([
      { op: "crop", slotId: "sl-1", crop: { x: 0.9, y: 0, w: 0.5, h: 0.1 } },
      { op: "widths", rowId: "rw-3", widths: [1, 1] },
      { op: "mode", mode: "wireframe" },
      { op: "note", slotId: "sl-1", note: "steal the pill nav" },
      { op: "note", note: "Editorial nav over a game store grid" },
      { op: "title", title: "New name" },
    ]);
    expect(s.rows[0]!.slots[0]).toMatchObject({ crop: { x: 0.9, y: 0, h: 0.1 }, note: "steal the pill nav" });
    expect(s.rows[0]!.slots[0]!.crop!.w).toBeCloseTo(0.1, 6);
    expect(s.rows[2]!.widths).toEqual([1, 1]);
    expect(s).toMatchObject({ mode: "wireframe", note: "Editorial nav over a game store grid", title: "New name" });
    expect(run([{ op: "note", note: "" }]).note).toBeUndefined();
  });

  it("is all or nothing with plain errors", () => {
    const bad = applyOps(base, [{ op: "title", title: "Changed" }, { op: "swap", slotId: "sl-9", partId: "pt-nav2" }], parts);
    expect(bad).toEqual({ ok: false, error: "Op 2 (swap): slot sl-9 is not in this page. Call get_canvas to see slot ids. Nothing was changed." });
    expect(base.title).toBe("Page");
    expect(applyOps(base, [{ op: "swap", slotId: "sl-1", partId: "pt-nope" }], parts).ok).toBe(false);
    expect(applyOps(base, [{ op: "move", slotId: "sl-1", rowId: "rw-3", index: 0 }, { op: "move", slotId: "sl-2", rowId: "rw-3", index: 0 }], parts)).toMatchObject({
      ok: false,
      error: expect.stringContaining("already has 3 slots"),
    });
    expect(applyOps(base, [{ op: "widths", rowId: "rw-3", widths: [1] }], parts).ok).toBe(false);
    expect(applyOps(base, [{ op: "remove" }], parts).ok).toBe(false);
    expect(applyOps(base, [{ op: "title", title: "  " }], parts).ok).toBe(false);
    const full: StitchData = { ...base, rows: Array.from({ length: MAX_STITCH_ROWS }, (_, i) => ({ id: `rw-${i}`, slots: [{ id: `sl-${i}`, role: "nav" as const, partId: "pt-nav1" }] })) };
    expect(applyOps(full, [{ op: "insert", slots: [{ partId: "pt-nav1" }] }], parts).ok).toBe(false);
  });
});

describe("stitchSize", () => {
  it("is the platform display width and sums row heights from crop aspects", () => {
    const parts = [part("pt-a", "nav", 1, { crop: { x: 0, y: 0, w: 1, h: 0.1 } }), part("pt-b", "hero", 2, { imageWidth: undefined, imageHeight: undefined })];
    const d: StitchData = {
      title: "x",
      platform: "website",
      mode: "collage",
      rows: [
        { id: "rw-1", slots: [{ id: "sl-1", role: "nav", partId: "pt-a" }] },
        { id: "rw-2", slots: [{ id: "sl-2", role: "hero", partId: "pt-b" }] },
      ],
    };
    // nav: 720 * (0.1 * 1200) / (1 * 1600) = 54; hero: unknown size, role ratio 0.5 -> 360; plus the 40 px title bar.
    expect(stitchSize(d, parts)).toEqual({ w: 720, h: 40 + 54 + 360 });
    expect(stitchSize({ ...d, platform: "mobile" }, parts).w).toBe(300);
    expect(stitchSize({ ...d, platform: "tablet", rows: [] }, parts)).toEqual({ w: 460, h: 200 });
  });
});
