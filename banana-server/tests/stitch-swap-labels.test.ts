/**
 * Field report, 2026-10-12: after a remix, a cart rows part still said "Track list fare breakdown"
 * (the note written for the old part). A slot's note follows its part on every swap path, unless
 * the user wrote it in the canvas.
 */
import { describe, expect, it } from "vitest";
import { setSlotNote, swapPart } from "@/canvas/stitch/edit";
import { remix } from "@/lib/stitch/fill";
import { applyOps } from "@/lib/stitch/ops";
import { parseRows } from "@/lib/stitch/parse";
import type { StitchData } from "@/lib/stitch/types";
import { part } from "./stitch-fixtures";

const parts = [
  part("pt-track", "list", 1, { note: "Sleeve: back cover track list as fare breakdown" }),
  part("pt-cart", "list", 2, { note: "Ink: cart rows, stamped add-ons land here" }),
  part("pt-pay", "cta", 3),
];

const page = (note: string, userNote = false): StitchData => ({
  title: "D Hybrid",
  platform: "mobile",
  mode: "wireframe",
  rows: [
    { id: "rw-1", slots: [{ id: "sl-5", role: "list", partId: "pt-track", note, crop: { x: 0, y: 0.5, w: 1, h: 0.2 }, ...(userNote ? { userNote: true as const } : {}) }] },
    { id: "rw-2", slots: [{ id: "sl-6", role: "cta", partId: "pt-pay" }] },
  ],
});

const slot = (d: StitchData) => d.rows[0]!.slots[0]!;

describe("a slot's note follows its part", () => {
  it("update_frankenstein swap drops the old part's note and crop", () => {
    const res = applyOps(page("Track list fare breakdown"), [{ op: "swap", slotId: "sl-5", partId: "pt-cart" }], parts);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(slot(res.stitch)).toEqual({ id: "sl-5", role: "list", partId: "pt-cart" });
  });

  it("remix_frankenstein drops it too", () => {
    const out = remix(page("Track list fare breakdown"), parts, { count: 1, seed: 1, lock: ["sl-6"] });
    const s = slot(out.stitches[0]!);
    expect(s.partId).toBe("pt-cart");
    expect(s.note).toBeUndefined();
    expect(s.crop).toBeUndefined();
  });

  it("the canvas swap drops it too", () => {
    const res = swapPart(page("Track list fare breakdown"), "sl-5", parts[1]!);
    expect(slot(res.data!)).toEqual({ id: "sl-5", role: "list", partId: "pt-cart" });
  });

  it("keeps a note the user wrote in the canvas, on every path", () => {
    const written = setSlotNote(page("old"), "sl-5", "My own label").data!;
    expect(slot(written)).toMatchObject({ note: "My own label", userNote: true });
    const ops = applyOps(written, [{ op: "swap", slotId: "sl-5", partId: "pt-cart" }], parts);
    expect(ops.ok && slot(ops.stitch)).toMatchObject({ partId: "pt-cart", note: "My own label", userNote: true });
    expect(slot(remix(written, parts, { count: 1, seed: 1, lock: ["sl-6"] }).stitches[0]!)).toMatchObject({ partId: "pt-cart", note: "My own label" });
    expect(slot(swapPart(written, "sl-5", parts[1]!).data!)).toMatchObject({ partId: "pt-cart", note: "My own label" });
  });

  it("an agent's note op is not the user's", () => {
    const res = applyOps(page("x", true), [{ op: "note", slotId: "sl-5", note: "Cart rows" }], parts);
    expect(res.ok && slot(res.stitch)).toEqual({ id: "sl-5", role: "list", partId: "pt-track", note: "Cart rows", crop: { x: 0, y: 0.5, w: 1, h: 0.2 } });
  });

  it("the saved state keeps the mark, only with a note", () => {
    const rows = parseRows([
      { id: "rw-1", slots: [{ id: "sl-1", role: "list", partId: "pt-a", note: "Mine", userNote: true }] },
      { id: "rw-2", slots: [{ id: "sl-2", role: "list", partId: "pt-b", userNote: true }] },
      { id: "rw-3", slots: [{ id: "sl-3", role: "list", partId: "pt-c", note: "Agent", userNote: "yes" }] },
    ]);
    expect(rows.map((r) => r.slots[0])).toEqual([
      { id: "sl-1", role: "list", partId: "pt-a", note: "Mine", userNote: true },
      { id: "sl-2", role: "list", partId: "pt-b" },
      { id: "sl-3", role: "list", partId: "pt-c", note: "Agent" },
    ]);
  });
});
