/**
 * update_stitch operations. Pure and atomic: every op is checked against the stitch as the
 * earlier ops left it, and the first problem stops the whole list with a plain error.
 */
import { MAX_PART_NOTE, MAX_STITCH_NOTE, MAX_STITCH_TITLE } from "./parse";
import {
  clampCrop,
  MAX_SLOTS_PER_ROW,
  MAX_STITCH_ROWS,
  type Crop,
  type Part,
  type PartRole,
  type StitchData,
  type StitchMode,
  type StitchRow,
  type StitchSlot,
} from "./types";

export type StitchOp =
  | { op: "swap"; slotId: string; partId: string }
  /** Move a slot to `index` in row `rowId` (default: its own row). */
  | { op: "move"; slotId: string; rowId?: string; index: number }
  | { op: "moveRow"; rowId: string; index: number }
  | { op: "remove"; slotId?: string; rowId?: string }
  | {
      op: "insert";
      /** Row position (0 based) for the new row; or afterRowId. Default: the end. */
      index?: number;
      afterRowId?: string;
      slots: { partId: string; role?: PartRole; crop?: Crop; note?: string }[];
      widths?: number[];
    }
  | { op: "crop"; slotId: string; crop: Crop }
  | { op: "widths"; rowId: string; widths: number[] }
  | { op: "mode"; mode: StitchMode }
  /** Without slotId, the page's idea note. Empty text clears it. */
  | { op: "note"; slotId?: string; note: string }
  | { op: "title"; title: string };

export type OpsResult = { ok: true; stitch: StitchData } | { ok: false; error: string };

function cloneRows(rows: readonly StitchRow[]): StitchRow[] {
  return rows.map((r) => ({ ...r, slots: r.slots.map((s) => ({ ...s })), ...(r.widths ? { widths: [...r.widths] } : {}) }));
}

function findSlot(rows: StitchRow[], slotId: string): { row: StitchRow; index: number } | null {
  for (const row of rows) {
    const index = row.slots.findIndex((s) => s.id === slotId);
    if (index >= 0) return { row, index };
  }
  return null;
}

/** Next unused "<prefix>-<n>" id. */
function nextId(prefix: string, used: Set<string>): string {
  let n = used.size + 1;
  while (used.has(`${prefix}-${n}`)) n++;
  const id = `${prefix}-${n}`;
  used.add(id);
  return id;
}

function validWidths(widths: readonly number[], n: number): boolean {
  return widths.length === n && widths.every((w) => typeof w === "number" && Number.isFinite(w) && w > 0 && w <= 12);
}

function clampIndex(i: number, max: number): number {
  return Math.min(max, Math.max(0, Math.floor(Number.isFinite(i) ? i : max)));
}

export function applyOps(stitch: StitchData, ops: readonly StitchOp[], parts: readonly Part[]): OpsResult {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const s: StitchData = { ...stitch, rows: cloneRows(stitch.rows) };
  const rowIds = new Set(s.rows.map((r) => r.id));
  const slotIds = new Set(s.rows.flatMap((r) => r.slots.map((x) => x.id)));
  const dropEmpty = () => {
    s.rows = s.rows.filter((r) => r.slots.length > 0);
  };

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!;
    const fail = (why: string): OpsResult => ({ ok: false, error: `Op ${i + 1} (${op.op}): ${why} Nothing was changed.` });
    const slotMissing = (id: string) => fail(`slot ${id} is not in this page. Call get_canvas to see slot ids.`);
    switch (op.op) {
      case "swap": {
        const at = findSlot(s.rows, op.slotId);
        if (!at) return slotMissing(op.slotId);
        const part = byId.get(op.partId);
        if (!part) return fail(`part ${op.partId} is not in the parts library.`);
        const { crop: _crop, ...rest } = at.row.slots[at.index]!;
        at.row.slots[at.index] = { ...rest, partId: part.id, role: part.role };
        break;
      }
      case "move": {
        const at = findSlot(s.rows, op.slotId);
        if (!at) return slotMissing(op.slotId);
        const target = op.rowId ? s.rows.find((r) => r.id === op.rowId) : at.row;
        if (!target) return fail(`row ${op.rowId} is not in this page.`);
        if (target !== at.row && target.slots.length >= MAX_SLOTS_PER_ROW) return fail(`row ${target.id} already has ${MAX_SLOTS_PER_ROW} slots.`);
        const [slot] = at.row.slots.splice(at.index, 1);
        target.slots.splice(clampIndex(op.index, target.slots.length), 0, slot!);
        if (target !== at.row) {
          delete target.widths;
          delete at.row.widths;
        } else if (at.row.widths) {
          const [w] = at.row.widths.splice(at.index, 1);
          at.row.widths.splice(clampIndex(op.index, at.row.widths.length), 0, w!);
        }
        dropEmpty();
        break;
      }
      case "moveRow": {
        const from = s.rows.findIndex((r) => r.id === op.rowId);
        if (from < 0) return fail(`row ${op.rowId} is not in this page.`);
        const [row] = s.rows.splice(from, 1);
        s.rows.splice(clampIndex(op.index, s.rows.length), 0, row!);
        break;
      }
      case "remove": {
        if (op.slotId && op.rowId) return fail("pass slotId or rowId, not both.");
        if (op.slotId) {
          const at = findSlot(s.rows, op.slotId);
          if (!at) return slotMissing(op.slotId);
          at.row.slots.splice(at.index, 1);
          delete at.row.widths;
          dropEmpty();
        } else if (op.rowId) {
          const before = s.rows.length;
          s.rows = s.rows.filter((r) => r.id !== op.rowId);
          if (s.rows.length === before) return fail(`row ${op.rowId} is not in this page.`);
        } else return fail("pass a slotId or a rowId.");
        break;
      }
      case "insert": {
        if (s.rows.length >= MAX_STITCH_ROWS) return fail(`a page has at most ${MAX_STITCH_ROWS} rows.`);
        if (op.slots.length < 1 || op.slots.length > MAX_SLOTS_PER_ROW) return fail(`a row has 1 to ${MAX_SLOTS_PER_ROW} slots.`);
        const newSlots: StitchSlot[] = [];
        for (const x of op.slots) {
          const part = byId.get(x.partId);
          if (!part) return fail(`part ${x.partId} is not in the parts library.`);
          const note = x.note?.trim().slice(0, MAX_PART_NOTE);
          newSlots.push({
            id: nextId("sl", slotIds),
            role: x.role ?? part.role,
            partId: part.id,
            ...(x.crop ? { crop: clampCrop(x.crop) } : {}),
            ...(note ? { note } : {}),
          });
        }
        if (op.widths && !validWidths(op.widths, newSlots.length)) return fail("widths must be one positive number (up to 12) per slot.");
        if (op.afterRowId && op.index !== undefined) return fail("pass index or afterRowId, not both.");
        let at = op.index !== undefined ? clampIndex(op.index, s.rows.length) : s.rows.length;
        if (op.afterRowId) {
          const idx = s.rows.findIndex((r) => r.id === op.afterRowId);
          if (idx < 0) return fail(`row ${op.afterRowId} is not in this page.`);
          at = idx + 1;
        }
        const row: StitchRow = { id: nextId("rw", rowIds), slots: newSlots };
        if (op.widths && newSlots.length > 1) row.widths = [...op.widths];
        s.rows.splice(at, 0, row);
        break;
      }
      case "crop": {
        const at = findSlot(s.rows, op.slotId);
        if (!at) return slotMissing(op.slotId);
        const c = op.crop;
        if (![c?.x, c?.y, c?.w, c?.h].every((n) => typeof n === "number" && Number.isFinite(n))) return fail("crop needs x, y, w and h as fractions from 0 to 1.");
        at.row.slots[at.index] = { ...at.row.slots[at.index]!, crop: clampCrop(c) };
        break;
      }
      case "widths": {
        const row = s.rows.find((r) => r.id === op.rowId);
        if (!row) return fail(`row ${op.rowId} is not in this page.`);
        if (!validWidths(op.widths, row.slots.length)) return fail(`widths must be ${row.slots.length} positive numbers (up to 12), one per slot.`);
        if (row.slots.length > 1) row.widths = [...op.widths];
        break;
      }
      case "mode":
        s.mode = op.mode;
        break;
      case "note": {
        const text = op.note.trim();
        if (op.slotId) {
          const at = findSlot(s.rows, op.slotId);
          if (!at) return slotMissing(op.slotId);
          const { note: _note, ...rest } = at.row.slots[at.index]!;
          at.row.slots[at.index] = text ? { ...rest, note: text.slice(0, MAX_PART_NOTE) } : rest;
        } else if (text) s.note = text.slice(0, MAX_STITCH_NOTE);
        else delete s.note;
        break;
      }
      case "title": {
        const text = op.title.trim();
        if (!text) return fail("title cannot be empty.");
        s.title = text.slice(0, MAX_STITCH_TITLE);
        break;
      }
      default:
        return { ok: false, error: `Op ${i + 1}: unknown op. Nothing was changed.` };
    }
  }
  return { ok: true, stitch: s };
}
