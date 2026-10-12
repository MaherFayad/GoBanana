/**
 * Edits on a Frankenstein page (StitchData) made in the canvas UI. Pure, so Vitest covers the
 * keyboard reorder. Each edit returns the new data, the slot to focus and a plain message for
 * the live region, or null when nothing changed (with the reason in `message`).
 */
import {
  MAX_PARTS,
  MAX_SLOTS_PER_ROW,
  MAX_STITCH_ROWS,
  PART_ROLES,
  slotWithPart,
  type Crop,
  type Part,
  type PartRole,
  type StitchData,
  type StitchPlatform,
  type StitchRow,
  type StitchSlot,
} from "@/lib/stitch/types";

export interface EditResult {
  data: StitchData | null;
  focus?: string;
  message: string;
}

export function shortId(prefix: string): string {
  const c = globalThis.crypto as Crypto | undefined;
  const raw = c?.randomUUID ? c.randomUUID().replace(/-/g, "").slice(0, 10) : Math.random().toString(36).slice(2, 12);
  return `${prefix}${raw}`;
}

export const newPartId = () => shortId("pt-");

/** Next row or slot id in a page: ids are numbered per page ("rw-3", "sl-7"), as the server makes them. */
export function nextId(data: Pick<StitchData, "rows">, prefix: "rw-" | "sl-"): string {
  let max = 0;
  for (const r of data.rows) {
    const ids = prefix === "rw-" ? [r.id] : r.slots.map((s) => s.id);
    for (const id of ids) {
      const m = id.startsWith(prefix) ? Number(id.slice(prefix.length)) : NaN;
      if (Number.isInteger(m) && m > max) max = m;
    }
  }
  return `${prefix}${max + 1}`;
}

/** "status-header" -> "Status header". */
export function roleLabel(role: PartRole): string {
  const s = role.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface SlotPos {
  row: number;
  col: number;
}

export function findSlot(data: StitchData, slotId: string): SlotPos | null {
  for (let row = 0; row < data.rows.length; row++) {
    const col = data.rows[row]!.slots.findIndex((s) => s.id === slotId);
    if (col >= 0) return { row, col };
  }
  return null;
}

/** Widths stay the same length as the slots; equal widths are dropped (the default). */
function fixWidths(row: StitchRow): StitchRow {
  const { widths, ...rest } = row;
  if (!widths || widths.length !== row.slots.length || widths.every((w) => w === widths[0])) return rest;
  return { ...rest, widths };
}

function withRows(data: StitchData, rows: StitchRow[]): StitchData {
  return { ...data, rows: rows.filter((r) => r.slots.length > 0).map(fixWidths) };
}

function cloneRows(data: StitchData): StitchRow[] {
  return data.rows.map((r) => ({ ...r, slots: [...r.slots], ...(r.widths ? { widths: [...r.widths] } : {}) }));
}

/** Take a slot out of its row, keeping the row's other widths. */
function takeOut(rows: StitchRow[], pos: SlotPos): { slot: StitchSlot; width: number } {
  const row = rows[pos.row]!;
  const [slot] = row.slots.splice(pos.col, 1);
  const width = row.widths ? (row.widths.splice(pos.col, 1)[0] ?? 1) : 1;
  return { slot: slot!, width };
}

export type MoveDirection = "up" | "down" | "left" | "right";

/**
 * Alt + arrows.
 * - Left and right swap the slot with its neighbor in the row.
 * - Up and down: a slot alone in its row swaps that row with the one above or below. A slot that
 *   shares its row moves out into a new row of its own, above or below.
 */
export function moveSlot(data: StitchData, slotId: string, dir: MoveDirection): EditResult {
  const pos = findSlot(data, slotId);
  if (!pos) return { data: null, message: "Part not found" };
  const rows = cloneRows(data);
  const row = rows[pos.row]!;
  if (dir === "left" || dir === "right") {
    const to = pos.col + (dir === "left" ? -1 : 1);
    if (to < 0 || to >= row.slots.length) {
      return { data: null, message: dir === "left" ? "Already first in the row" : "Already last in the row" };
    }
    [row.slots[pos.col], row.slots[to]] = [row.slots[to]!, row.slots[pos.col]!];
    if (row.widths) [row.widths[pos.col], row.widths[to]] = [row.widths[to]!, row.widths[pos.col]!];
    return { data: withRows(data, rows), focus: slotId, message: `Moved ${dir}, place ${to + 1} of ${row.slots.length} in row ${pos.row + 1}` };
  }
  const step = dir === "up" ? -1 : 1;
  if (row.slots.length === 1) {
    const to = pos.row + step;
    if (to < 0 || to >= rows.length) return { data: null, message: dir === "up" ? "Already the top row" : "Already the bottom row" };
    [rows[pos.row], rows[to]] = [rows[to]!, rows[pos.row]!];
    return { data: withRows(data, rows), focus: slotId, message: `Moved ${dir} to row ${to + 1} of ${rows.length}` };
  }
  if (rows.length >= MAX_STITCH_ROWS) return { data: null, message: `A page holds up to ${MAX_STITCH_ROWS} rows` };
  const { slot } = takeOut(rows, pos);
  const at = dir === "up" ? pos.row : pos.row + 1;
  rows.splice(at, 0, { id: nextId(data, "rw-"), slots: [slot] });
  return { data: withRows(data, rows), focus: slotId, message: `Moved ${dir} into its own row, row ${at + 1} of ${rows.length}` };
}

/** Put a slot at the end of the row above or below (menu "Join row above"). */
export function joinRow(data: StitchData, slotId: string, dir: "up" | "down"): EditResult {
  const pos = findSlot(data, slotId);
  if (!pos) return { data: null, message: "Part not found" };
  const target = pos.row + (dir === "up" ? -1 : 1);
  if (target < 0 || target >= data.rows.length) return { data: null, message: dir === "up" ? "No row above" : "No row below" };
  if (data.rows[target]!.slots.length >= MAX_SLOTS_PER_ROW) return { data: null, message: `A row holds up to ${MAX_SLOTS_PER_ROW} parts` };
  const rows = cloneRows(data);
  const { slot } = takeOut(rows, pos);
  const t = rows[target]!;
  t.slots.push(slot);
  if (t.widths) t.widths.push(1);
  const next = withRows(data, rows);
  const p = findSlot(next, slotId)!;
  return { data: next, focus: slotId, message: `Joined row ${p.row + 1}, place ${p.col + 1} of ${next.rows[p.row]!.slots.length}` };
}

/** Pointer reorder: drop slot `from` on slot `to` and they trade places. */
export function swapSlots(data: StitchData, fromId: string, toId: string): EditResult {
  if (fromId === toId) return { data: null, message: "Not moved" };
  const a = findSlot(data, fromId);
  const b = findSlot(data, toId);
  if (!a || !b) return { data: null, message: "Part not found" };
  const rows = cloneRows(data);
  const sa = rows[a.row]!.slots[a.col]!;
  rows[a.row]!.slots[a.col] = rows[b.row]!.slots[b.col]!;
  rows[b.row]!.slots[b.col] = sa;
  return { data: withRows(data, rows), focus: fromId, message: `Moved to row ${b.row + 1}, place ${b.col + 1}` };
}

export function removeSlot(data: StitchData, slotId: string): EditResult {
  const pos = findSlot(data, slotId);
  if (!pos) return { data: null, message: "Part not found" };
  const rows = cloneRows(data);
  takeOut(rows, pos);
  const next = withRows(data, rows);
  // Focus the next slot in reading order, else the previous one.
  const flat = next.rows.flatMap((r) => r.slots.map((s) => s.id));
  const before = data.rows.slice(0, pos.row).reduce((n, r) => n + r.slots.length, 0) + pos.col;
  const focus = flat[Math.min(before, flat.length - 1)];
  return { data: next, ...(focus ? { focus } : {}), message: "Part removed from the page" };
}

function patchSlot(data: StitchData, slotId: string, patch: (s: StitchSlot) => StitchSlot): StitchData | null {
  if (!findSlot(data, slotId)) return null;
  return { ...data, rows: data.rows.map((r) => ({ ...r, slots: r.slots.map((s) => (s.id === slotId ? patch(s) : s)) })) };
}

/**
 * Swap the part in a slot. The slot's own crop override goes (the new part has its own crop), and
 * so does a note the agent wrote for the old part; a note the user wrote stays.
 */
export function swapPart(data: StitchData, slotId: string, part: Part): EditResult {
  const next = patchSlot(data, slotId, (s) => slotWithPart(s, part.id, part.role));
  return next
    ? { data: next, focus: slotId, message: `Swapped in ${roleLabel(part.role)} from ${part.sourceSite}` }
    : { data: null, message: "Part not found" };
}

export function setSlotCrop(data: StitchData, slotId: string, crop: Crop, role?: PartRole): EditResult {
  const next = patchSlot(data, slotId, (s) => ({ ...s, crop, ...(role ? { role } : {}) }));
  return next ? { data: next, focus: slotId, message: "Crop saved" } : { data: null, message: "Part not found" };
}

export function setSlotNote(data: StitchData, slotId: string, note: string): EditResult {
  const t = note.trim().slice(0, 280);
  // Written here, in the canvas, by the user: marked so a later swap or remix keeps it.
  const next = patchSlot(data, slotId, ({ note: _n, userNote: _u, ...s }) => (t ? { ...s, note: t, userNote: true } : s));
  return next ? { data: next, focus: slotId, message: t ? "Note saved" : "Note cleared" } : { data: null, message: "Part not found" };
}

/** Library parts for "Swap with part...": the same role first, then the rest, current part left out. */
export function swapCandidates(parts: readonly Part[], role: PartRole, currentPartId: string): Part[] {
  const others = parts.filter((p) => p.id !== currentPartId);
  return [...others.filter((p) => p.role === role), ...others.filter((p) => p.role !== role)];
}

/** Parts grouped by role in PART_ROLES order; empty roles are left out. */
export function groupByRole(parts: readonly Part[]): { role: PartRole; parts: Part[] }[] {
  const by = new Map<PartRole, Part[]>();
  for (const p of parts) {
    const list = by.get(p.role);
    if (list) list.push(p);
    else by.set(p.role, [p]);
  }
  return PART_ROLES.filter((r) => by.has(r)).map((role) => ({ role, parts: by.get(role)! }));
}

/** A string of the part ids each page uses ("a,b|c"): a stable memo key while nodes move. */
export function usageKey(stitches: readonly StitchData[]): string {
  return stitches.map((d) => [...new Set(d.rows.flatMap((r) => r.slots.map((s) => s.partId)))].join(",")).join("|");
}

export function usageFromKey(key: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const page of key.split("|")) for (const id of page.split(",")) if (id) out.set(id, (out.get(id) ?? 0) + 1);
  return out;
}

/** How many Frankenstein pages use each part. */
export function partUsage(stitches: readonly StitchData[]): Map<string, number> {
  return usageFromKey(usageKey(stitches));
}

const MOBILE_ROLES = new Set<PartRole>(["status-header", "tabbar", "sheet"]);
const APP_ROLES = new Set<PartRole>(["sidebar", "toolbar", "table", "chart", "filters"]);

/** Platform for a page made from these parts: mobile roles win, then app roles, else website. */
export function guessPlatform(parts: readonly Part[]): StitchPlatform {
  if (parts.some((p) => MOBILE_ROLES.has(p.role))) return "mobile";
  if (parts.some((p) => APP_ROLES.has(p.role))) return "webapp";
  return "website";
}

/** "Frankenstein it": the selected parts stacked one per row, in the order they were picked. */
export function stackParts(parts: readonly Part[], title = "Frankenstein page"): StitchData {
  return {
    title,
    platform: guessPlatform(parts),
    mode: "collage",
    rows: parts.slice(0, MAX_STITCH_ROWS).map((p, i) => ({ id: `rw-${i + 1}`, slots: [{ id: `sl-${i + 1}`, role: p.role, partId: p.id }] })),
  };
}

/** Room left in the parts library. */
export function partsRoom(parts: readonly Part[]): number {
  return Math.max(0, MAX_PARTS - parts.length);
}

/** A part dropped on the page outside any slot: a new row at the bottom. */
export function appendPart(data: StitchData, part: Part): EditResult {
  if (data.rows.length >= MAX_STITCH_ROWS) return { data: null, message: `A page holds up to ${MAX_STITCH_ROWS} rows` };
  const slot: StitchSlot = { id: nextId(data, "sl-"), role: part.role, partId: part.id };
  return {
    data: { ...data, rows: [...data.rows, { id: nextId(data, "rw-"), slots: [slot] }] },
    focus: slot.id,
    message: `${roleLabel(part.role)} added as row ${data.rows.length + 1}`,
  };
}
