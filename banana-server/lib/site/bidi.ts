/**
 * Bidi isolation for Arabic copy with Latin terms in it (JSON, FigJam, Tailwind, Claude, MCP,
 * URLs, file names, the product name). Inside an RTL paragraph a Latin word next to sentence
 * punctuation can pull the punctuation to the wrong side ("بصيغة JSON." showing ".JSON" at the
 * start of a line). Wrapping each Latin run in <bdi> (unicode-bidi: isolate) keeps the run in
 * one piece and leaves the punctuation at the logical end of the sentence.
 *
 * A Latin run starts with a Latin letter, "~" or "/", may hold inner dots, slashes and the like
 * (DESIGN.md, ~/.cursor/mcp.json, Ctrl+C) and several words ("Claude Code", "Merchant of
 * Record"), and never takes trailing punctuation, so the period stays outside the isolate.
 * Pure: the React wrapper is app/(site)/_components/Bidi.tsx.
 */

export type BidiPart = { text: string; latin: boolean };

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFC]/;

// A Latin word: inner punctuation only when a letter or digit follows it, so a sentence's
// closing period or comma stays outside. The first word may start with a path ("~/.cursor").
const BODY = String.raw`[A-Za-z0-9_]*(?:[.+/:@#&'_-]+[A-Za-z0-9_]+)*`;
const FIRST = String.raw`[~/.]*[A-Za-z]${BODY}`;
const NEXT = String.raw`[~/]*[A-Za-z0-9]${BODY}`;
const RUN = new RegExp(`${FIRST}(?:[ ]+${NEXT})*`, "g");

/** True when the text has Arabic letters (only then does isolation matter). */
export function hasArabic(text: string): boolean {
  return ARABIC.test(text);
}

/** Splits text into plain parts and Latin runs. Text without Arabic comes back as one part. */
export function splitLatinRuns(text: string): BidiPart[] {
  if (!hasArabic(text)) return [{ text, latin: false }];
  const parts: BidiPart[] = [];
  let last = 0;
  for (const m of text.matchAll(RUN)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start), latin: false });
    parts.push({ text: m[0], latin: true });
    last = start + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), latin: false });
  return parts;
}
