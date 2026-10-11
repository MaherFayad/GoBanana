/**
 * Sticky note layout: label parsing, the server-side height estimate and the compact decision.
 * Pure and React free, so the canvas UI, lib/canvas/store.ts (notes added by MCP tools) and
 * Vitest all use the same numbers.
 *
 * Notes never scroll. A note fits its text (auto height) unless the user gave it a height
 * (`manualHeight`, set by a resize drag, the + and - keys or the "Compact" menu item). A
 * manual height shorter than the text shows the compact presentation: smaller type, a fade
 * and "+N lines", with the full text in a popover on hover, focus or selection.
 *
 * All sizes are board pixels (they scale with the canvas zoom), so they are fixed px values,
 * not the viewport-fluid type tokens. canvas/canvas.css `.bn-note*` uses the same values.
 */

/** Type size and line height of note text. */
export const NOTE_FONT_PX = 14;
export const NOTE_LINE_HEIGHT = 1.45;
export const NOTE_LINE_PX = NOTE_FONT_PX * NOTE_LINE_HEIGHT;
/** Padding of the note body: top (below the paper band), bottom and each side. */
export const NOTE_PAD_TOP = 16;
export const NOTE_PAD_BOTTOM = 14;
export const NOTE_PAD_INLINE = 16;
/** A label chip ("WILD") above its paragraph: chip height plus the gap below it. */
export const NOTE_LABEL_BLOCK = 22;
/** Space between two segments: margin, a 1px rule, padding. */
export const NOTE_SEGMENT_GAP = 21;
/** Average advance of Inter at 14px over mixed prose, spaces included. */
export const NOTE_CHAR_PX = 7.1;
/** Word wrapping leaves part of each line empty. */
const WRAP_FILL = 0.92;

/** Compact presentation: smaller type for the clamped preview. */
export const NOTE_COMPACT_LINE_PX = 12 * 1.4;
/** Height the "Compact" menu item gives a note (about four compact lines). */
export const NOTE_COMPACT_HEIGHT = 112;
/** Smallest note: one line of text with room around it. Mirrors MIN_SIZE.note in types.ts. */
export const NOTE_MIN_HEIGHT = 64;
/** Height changes at or under this are noise (sub-pixel layout, rounding). */
export const NOTE_HEIGHT_TOLERANCE = 1;

// ---------------------------------------------------------------------------------- labels

/** Labels GoBanana writes, split anywhere in a line. Others split only at a line or sentence start. */
export const KNOWN_LABELS: ReadonlySet<string> = new Set(["WILD", "SALVAGE"]);

export interface NoteSegment {
  /** "WILD", "SALVAGE" or another 3 to 12 letter caps label; null for plain text. */
  label: string | null;
  text: string;
}

const LABEL = /\b([A-Z]{3,12}):(?=\s|$)/g;

/** Index where each label starts in `line`, kept only where it should start a new segment. */
function splitPoints(line: string): { index: number; label: string; end: number }[] {
  const out: { index: number; label: string; end: number }[] = [];
  for (const m of line.matchAll(LABEL)) {
    const index = m.index ?? 0;
    const label = m[1] ?? "";
    const before = line.slice(0, index);
    const lineStart = before.trim() === "";
    const afterSentence = /[.!?]["')\]]?\s+$/.test(before);
    const known = KNOWN_LABELS.has(label) && /\s$/.test(before);
    if (lineStart || afterSentence || known) out.push({ index, label, end: index + m[0].length });
  }
  return out;
}

/**
 * Split note text into labeled segments for display. "WILD: a. SALVAGE: b." gives two
 * segments; text before the first label is a segment with no label; text with no labels is
 * one plain segment holding the text unchanged. The stored text is never changed.
 */
export function parseNoteSegments(text: string): NoteSegment[] {
  const segments: NoteSegment[] = [];
  let current: NoteSegment = { label: null, text: "" };
  let found = false;
  for (const [i, line] of text.split("\n").entries()) {
    const points = splitPoints(line);
    let cursor = 0;
    let piece = "";
    const flush = () => {
      current.text += piece;
      piece = "";
    };
    if (i > 0) current.text += "\n";
    for (const p of points) {
      piece = line.slice(cursor, p.index);
      flush();
      segments.push(current);
      current = { label: p.label, text: "" };
      cursor = p.end;
      found = true;
    }
    piece = line.slice(cursor);
    flush();
  }
  segments.push(current);
  if (!found) return [{ label: null, text }];
  return segments
    .map((s) => ({ label: s.label, text: s.text.replace(/^\s+|\s+$/g, "") }))
    .filter((s) => s.label !== null || s.text !== "");
}

// ---------------------------------------------------------------------------------- estimate

/** Wrapped line count of one paragraph at `innerWidth` px (each newline starts a line). */
export function estimateLines(text: string, innerWidth: number): number {
  const perLine = Math.max(8, Math.floor((innerWidth / NOTE_CHAR_PX) * WRAP_FILL));
  return text.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / perLine)), 0);
}

/**
 * Height a note needs for `text` at width `w`, without a browser: characters per line times
 * the line height, plus padding, label chips and segment rules. Used by the server when MCP
 * tools add or arrange notes, so the board looks right before a client measures it.
 */
export function estimateNoteHeight(text: string, w: number): number {
  const inner = Math.max(40, w - NOTE_PAD_INLINE * 2);
  const segments = parseNoteSegments(text.trim() ? text : " ");
  let h = NOTE_PAD_TOP + NOTE_PAD_BOTTOM;
  segments.forEach((s, i) => {
    if (i > 0) h += NOTE_SEGMENT_GAP;
    if (s.label) h += NOTE_LABEL_BLOCK;
    if (s.text || !s.label) h += estimateLines(s.text, inner) * NOTE_LINE_PX;
  });
  return Math.max(NOTE_MIN_HEIGHT, Math.ceil(h));
}

// ---------------------------------------------------------------------------------- sizing

export interface NoteSizingInput {
  /** The user set this height (resize, + and -, "Compact"). */
  manualHeight: boolean;
  /** Current node height. */
  height: number;
  /** Measured height of the full text at the normal type size (padding included). */
  natural: number;
  minHeight?: number;
}

export interface NoteSizing {
  /** Height the node should have. */
  height: number;
  /** Show the compact presentation (clamped, fade, "+N lines", popover). */
  compact: boolean;
}

/**
 * The compact decision. Auto notes fit their text. A manual height stays as set; when the
 * text needs more room than that, the note shows the compact presentation instead of
 * scrolling. Never returns a height under the minimum.
 */
export function noteSizing({ manualHeight, height, natural, minHeight = NOTE_MIN_HEIGHT }: NoteSizingInput): NoteSizing {
  const fit = Math.max(minHeight, Math.ceil(natural));
  if (!manualHeight) return { height: fit, compact: false };
  const h = Math.max(minHeight, height);
  return { height: h, compact: natural > h + NOTE_HEIGHT_TOLERANCE };
}

/** True when a measured height differs from the current one by more than the tolerance. */
export function heightChanged(current: number, next: number): boolean {
  return Math.abs(current - next) > NOTE_HEIGHT_TOLERANCE;
}

/**
 * After a pointer resize: a height the user changed becomes manual; a width-only resize
 * keeps the note's mode (an auto note refits to the new width).
 */
export function manualAfterResize(startHeight: number, endHeight: number, manualBefore: boolean): boolean {
  return heightChanged(startHeight, endHeight) ? true : manualBefore;
}

/** Lines of compact text hidden below the fold, for the "+N lines" hint. */
export function hiddenLines(scrollHeight: number, clientHeight: number): number {
  const over = scrollHeight - clientHeight;
  return over > NOTE_HEIGHT_TOLERANCE ? Math.max(1, Math.ceil(over / NOTE_COMPACT_LINE_PX)) : 0;
}
