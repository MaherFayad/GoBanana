/**
 * Words and term keys for search learning (pure). A term key names what a lane searched for,
 * independent of how it was worded: the lane plus the plain words of its default text,
 * lowercased, with negatives and site operators stripped ("taste|minimal flight checkout ui design").
 * Ratings of results found for that term are pooled per term key and arm (lib/learning/arms.ts).
 */
import type { LaneName } from "../sources/types";

/** Longest term key or arm id we store. Lane texts are at most 7 words, agent words at most 300 chars. */
export const MAX_KEY_LENGTH = 320;

/**
 * Plain query words: no `site:` operators, no negatives (`-template`), no OR or brackets or
 * quotes, single spaces, lowercase. "fintech app ui -template site:dribbble.com/shots" gives
 * "fintech app ui".
 */
export function queryWords(text: string): string {
  return text
    .replace(/-?\bsite:\S+/gi, " ")
    .replace(/\bOR\b/g, " ")
    .replace(/["“”()[\]{}]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !w.startsWith("-"))
    .join(" ")
    .toLowerCase()
    .slice(0, MAX_KEY_LENGTH)
    .trim();
}

/** Term key for a lane and its default text, for example `fidelity|flight app ui`. */
export function termKey(lane: LaneName, text: string): string {
  return `${lane}|${queryWords(text)}`;
}

/**
 * Term key for a bend direction's idea, for rate_directions feedback: `direction|{ingredient}`,
 * with the ingredient (the direction's lead search words) normalized like lane words.
 */
export function directionTermKey(ingredient: string): string {
  return `direction|${queryWords(ingredient)}`;
}
