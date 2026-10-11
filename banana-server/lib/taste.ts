/**
 * Taste: a few style words that describe the look a user wants ("glassmorphism", "big typography").
 * The server never looks at images (hard rule 1), so taste only ever arrives as words, usually
 * from the user's own agent describing their boards. Stored on the canvas state as `taste`.
 * Dependency free: the canvas UI bundle imports this through canvas/state.ts. The tool input
 * schema lives in lib/mcp/tools/canvas-shared.ts so zod stays out of that bundle.
 */

export const MAX_TASTE_TERMS = 5;
export const MAX_TASTE_TERM_LENGTH = 40;
/** Words kept per style term (a search query uses at most 3 of them, without filler words). */
export const MAX_TASTE_TERM_WORDS = 4;

/**
 * Used when neither the call nor the canvas gives a taste. Verified live (round 5): these show
 * their style on Dribbble and Pinterest. Avoid "soft 3d" (busy 3D illustration apps), "aurora
 * gradient" (logos), claymorphism, isometric and playful. Other verified words: liquid glass,
 * monochrome, luxury, neumorphism, swiss style, bento grid, editorial, grainy, skeuomorphic.
 */
export const DEFAULT_TASTE: readonly string[] = ["minimal", "glassmorphism", "big typography", "dark mode"];

/**
 * Clean style terms: plain letters, digits, spaces and hyphens, lowercase, at most 4 words each,
 * no repeats, at most 5. Anything else is dropped. Returns [] when nothing usable is left.
 */
export function cleanTaste(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const term = v
      .slice(0, MAX_TASTE_TERM_LENGTH * 2)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, MAX_TASTE_TERM_WORDS)
      .join(" ");
    if (!term || term.length > MAX_TASTE_TERM_LENGTH || out.includes(term)) continue;
    out.push(term);
    if (out.length >= MAX_TASTE_TERMS) break;
  }
  return out;
}

/** True for a plain JSON object (what `canvases.state` holds). */
export function isStateObject(state: unknown): state is Record<string, unknown> {
  return typeof state === "object" && state !== null && !Array.isArray(state);
}

/** True when `state` sets `taste` itself, even to an empty list (which clears it). */
export function stateHasTaste(state: unknown): boolean {
  return isStateObject(state) && Object.hasOwn(state, "taste");
}
