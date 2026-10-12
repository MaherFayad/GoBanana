/**
 * Validation for stitch state: the parts library (`CanvasState.parts`) and stitch node data.
 * Pure, no imports beyond the contract, so canvas/state.ts (UI bundle) and the tools share it.
 * Invalid entries are dropped, numbers are clamped, caps are enforced.
 */
import {
  clampCrop,
  isPartRole,
  MAX_PARTS,
  MAX_SLOTS_PER_ROW,
  MAX_STITCH_ROWS,
  STITCH_MODES,
  type Crop,
  type Part,
  type PartTheme,
  type StitchData,
  type StitchMode,
  type StitchPlatform,
  type StitchRow,
  type StitchSlot,
} from "./types";

export const MAX_PART_NOTE = 280;
export const MAX_STITCH_TITLE = 120;
export const MAX_STITCH_NOTE = 280;
export const STITCH_PLATFORMS: readonly StitchPlatform[] = ["mobile", "tablet", "website", "webapp"];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

function positive(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

function compact<T extends object>(obj: T): T {
  for (const key of Object.keys(obj) as (keyof T)[]) if (obj[key] === undefined) delete obj[key];
  return obj;
}

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
export function isStitchId(v: unknown): v is string {
  return typeof v === "string" && ID_RE.test(v);
}

export function isStitchPlatform(v: unknown): v is StitchPlatform {
  return typeof v === "string" && (STITCH_PLATFORMS as readonly string[]).includes(v);
}

export function isStitchMode(v: unknown): v is StitchMode {
  return typeof v === "string" && (STITCH_MODES as readonly string[]).includes(v);
}

function isTheme(v: unknown): v is PartTheme {
  return v === "light" || v === "dark" || v === "unknown";
}

/** A crop from unknown JSON, clamped; undefined when any field is not a number. */
export function parseCrop(v: unknown): Crop | undefined {
  if (!isObject(v)) return undefined;
  const { x, y, w, h } = v;
  if (![x, y, w, h].every((n) => typeof n === "number" && Number.isFinite(n))) return undefined;
  return clampCrop({ x: x as number, y: y as number, w: w as number, h: h as number });
}

/**
 * One part from unknown JSON. `cleanUrl` is the same URL check the canvas uses for tray and image
 * items (canvas/state.ts safeUrl), so a part can never carry a data: or blob: URL.
 */
export function parsePart(v: unknown, cleanUrl: (u: unknown) => string | undefined, siteOf: (url: string) => string): Part | null {
  if (!isObject(v)) return null;
  const id = isStitchId(v.id) ? v.id : undefined;
  const imageUrl = cleanUrl(v.imageUrl);
  const sourceUrl = cleanUrl(v.sourceUrl);
  const crop = parseCrop(v.crop);
  if (!id || !imageUrl || !sourceUrl || !isPartRole(v.role) || !crop) return null;
  return compact<Part>({
    id,
    role: v.role,
    imageUrl,
    thumbUrl: cleanUrl(v.thumbUrl),
    sourceUrl,
    sourceSite: str(v.sourceSite, 200) ?? siteOf(sourceUrl),
    title: str(v.title, 300),
    crop,
    imageWidth: positive(v.imageWidth),
    imageHeight: positive(v.imageHeight),
    theme: isTheme(v.theme) ? v.theme : undefined,
    note: str(v.note, MAX_PART_NOTE),
    fromItemId: str(v.fromItemId, 120),
    fromReferenceId: str(v.fromReferenceId, 120),
    guessedCrop: v.guessedCrop === true ? true : undefined,
  });
}

/** The parts library: invalid and duplicate ids dropped, capped at MAX_PARTS (first kept). */
export function parseParts(raw: unknown, cleanUrl: (u: unknown) => string | undefined, siteOf: (url: string) => string): Part[] {
  const out: Part[] = [];
  const seen = new Set<string>();
  for (const v of Array.isArray(raw) ? raw : []) {
    const p = parsePart(v, cleanUrl, siteOf);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length >= MAX_PARTS) break;
  }
  return out;
}

function parseSlot(v: unknown): StitchSlot | null {
  if (!isObject(v) || !isStitchId(v.id) || !isStitchId(v.partId)) return null;
  const role = isPartRole(v.role) ? v.role : "other";
  return compact<StitchSlot>({ id: v.id, role, partId: v.partId, crop: parseCrop(v.crop), note: str(v.note, MAX_PART_NOTE) });
}

function parseWidths(v: unknown, n: number): number[] | undefined {
  if (!Array.isArray(v) || v.length !== n || n < 2) return undefined;
  if (!v.every((x) => typeof x === "number" && Number.isFinite(x) && x > 0)) return undefined;
  return (v as number[]).map((x) => Math.min(12, Math.max(0.1, x)));
}

/** Rows from unknown JSON: slot and row caps, unique ids, widths kept only when they match the slots. */
export function parseRows(raw: unknown): StitchRow[] {
  const rows: StitchRow[] = [];
  const rowIds = new Set<string>();
  const slotIds = new Set<string>();
  for (const v of Array.isArray(raw) ? raw : []) {
    if (!isObject(v) || !isStitchId(v.id) || rowIds.has(v.id)) continue;
    const slots: StitchSlot[] = [];
    for (const s of Array.isArray(v.slots) ? v.slots : []) {
      const slot = parseSlot(s);
      if (!slot || slotIds.has(slot.id)) continue;
      slotIds.add(slot.id);
      slots.push(slot);
      if (slots.length >= MAX_SLOTS_PER_ROW) break;
    }
    if (slots.length === 0) continue;
    rowIds.add(v.id);
    rows.push(compact<StitchRow>({ id: v.id, slots, widths: parseWidths(v.widths, slots.length) }));
    if (rows.length >= MAX_STITCH_ROWS) break;
  }
  return rows;
}

/** Stitch node data from unknown JSON. Never null: a stitch with no valid rows is an empty frame. */
export function cleanStitchData(raw: unknown): StitchData {
  const d = isObject(raw) ? raw : {};
  const variant = typeof d.variant === "number" && Number.isInteger(d.variant) && d.variant > 0 && d.variant < 1000 ? d.variant : undefined;
  return compact<StitchData>({
    title: str(d.title, MAX_STITCH_TITLE) ?? "Frankenstein page",
    platform: isStitchPlatform(d.platform) ? d.platform : "website",
    mode: isStitchMode(d.mode) ? d.mode : "collage",
    rows: parseRows(d.rows),
    variantOf: str(d.variantOf, 120),
    variant,
    directionId: str(d.directionId, 80),
    note: str(d.note, MAX_STITCH_NOTE),
  });
}

/** Drop slots whose part is not in the library, then rows left empty. Widths reset when a row shrinks. */
export function pruneStitch(data: StitchData, partIds: ReadonlySet<string>): StitchData {
  let changed = false;
  const rows: StitchRow[] = [];
  for (const row of data.rows) {
    const slots = row.slots.filter((s) => partIds.has(s.partId));
    if (slots.length === row.slots.length) {
      rows.push(row);
      continue;
    }
    changed = true;
    if (slots.length > 0) rows.push({ id: row.id, slots });
  }
  return changed ? { ...data, rows } : data;
}
