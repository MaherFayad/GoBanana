/**
 * Per-user taste profile (P2-02, VAL-03). Words and ids only, never images (hard rule 2).
 *
 * Bend uses it as a tie breaker, never to override brief fit:
 * - `applyTaste` reorders candidates that have the same fit score; a candidate with a higher fit
 *   always stays above one with a lower fit.
 * - `profileTasteWords` gives the style words as the last resort for the taste lane, below words
 *   the call or the canvas already carry.
 * Pure and dependency light, so Vitest covers it without a database.
 */
import { hexToOklchColor } from "../palette/color";
import { cleanTaste, MAX_TASTE_TERMS } from "../taste";

/** Most style words a profile keeps. */
export const MAX_PROFILE_WORDS = 12;
/** Most liked card ids and source links a profile keeps. */
export const MAX_PROFILE_IDS = 200;
export const MAX_PROFILE_URLS = 40;

export type UserTasteProfile = {
  likedCardIds: string[];
  styleWords: string[];
  /** Pin page links of a Pinterest import. Links only. */
  sourceUrls: string[];
  updatedAt: Date | null;
};

export const EMPTY_TASTE: UserTasteProfile = { likedCardIds: [], styleWords: [], sourceUrls: [], updatedAt: null };

/** What the profile can say about a candidate: its id and the words that describe it. */
export type TasteTarget = { likedCardIds?: readonly string[]; styleWords?: readonly string[] };

export type TasteCandidate = {
  /** Atlas card id, or any stable id. */
  id: string;
  /** The brief-fit score the caller computed (higher is better). Missing counts as 1. */
  fit?: number;
  /** Words that describe the candidate (its style tags, name). */
  words?: readonly string[];
};

/** Fit scores are compared to this many decimals; equal after rounding is a tie. */
const FIT_DECIMALS = 2;

function tasteScore(c: TasteCandidate, liked: ReadonlySet<string>, words: ReadonlySet<string>): number {
  let score = liked.has(c.id) ? 2 : 0;
  for (const w of c.words ?? []) if (words.has(w.toLowerCase())) score += 1;
  return score;
}

/**
 * Tie breaker. Returns the candidates ordered by fit (highest first); among candidates with the
 * same fit the ones the user likes come first (a liked card id counts 2, each shared style word
 * 1). Everything else keeps its input order, so with an empty profile the order is unchanged and
 * the fit never moves. The input array is not changed.
 */
export function applyTaste<T extends TasteCandidate>(candidates: readonly T[], taste: TasteTarget | null | undefined): T[] {
  const liked = new Set(taste?.likedCardIds ?? []);
  const words = new Set((taste?.styleWords ?? []).map((w) => w.toLowerCase()));
  const fitOf = (c: T) => Number((c.fit ?? 1).toFixed(FIT_DECIMALS));
  const silent = liked.size === 0 && words.size === 0;
  return candidates
    .map((c, i) => ({ c, i, fit: fitOf(c), taste: silent ? 0 : tasteScore(c, liked, words) }))
    .sort((a, b) => b.fit - a.fit || b.taste - a.taste || a.i - b.i)
    .map((x) => x.c);
}

/** Style words for the taste lane when the call and the canvas gave none: the profile's first words. */
export function profileTasteWords(profile: Pick<UserTasteProfile, "styleWords"> | null | undefined): string[] {
  return cleanTaste(profile?.styleWords ?? []).slice(0, MAX_TASTE_TERMS);
}

/** New words first, then the old ones, no repeats, at most MAX_PROFILE_WORDS. */
export function mergeStyleWords(incoming: readonly string[], existing: readonly string[]): string[] {
  const out: string[] = [];
  for (const w of [...cleanTaste(incoming), ...existing]) {
    if (!out.includes(w)) out.push(w);
    if (out.length >= MAX_PROFILE_WORDS) break;
  }
  return out;
}

/**
 * Style words for one palette (hex colors), from lightness, chroma and hue in OKLCH. Only words
 * that already work in a search (lib/taste.ts DEFAULT_TASTE and the verified list).
 */
export function paletteStyleWords(hexes: readonly string[]): string[] {
  const colors = hexes.flatMap((h) => {
    try {
      return [hexToOklchColor(h)];
    } catch {
      return [];
    }
  });
  if (colors.length === 0) return [];
  const mean = (f: (c: (typeof colors)[number]) => number) => colors.reduce((n, c) => n + f(c), 0) / colors.length;
  const l = mean((c) => c.l);
  const chroma = mean((c) => c.c);
  const out: string[] = [];
  if (l < 0.35) out.push("dark mode");
  if (chroma < 0.03) out.push("monochrome");
  else if (chroma < 0.08 && l > 0.8) out.push("pastel");
  else if (chroma < 0.08) out.push("muted");
  else if (chroma > 0.17) out.push("vibrant");
  const chromatic = colors.filter((c) => c.c >= 0.05);
  if (chromatic.length > 0) {
    const warm = chromatic.filter((c) => c.h < 100 || c.h >= 330).length;
    if (warm / chromatic.length >= 0.7) out.push("warm tones");
    else if (warm / chromatic.length <= 0.3) out.push("cool tones");
  }
  return out;
}

/** Words most of the user's images share: one palette per image, a word must show in at least 40% of them. */
export function styleWordsFromPalettes(palettes: readonly (readonly string[])[], max = MAX_TASTE_TERMS): string[] {
  const usable = palettes.filter((p) => p.length > 0);
  if (usable.length === 0) return [];
  const counts = new Map<string, number>();
  for (const p of usable) for (const w of new Set(paletteStyleWords(p))) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, n]) => n / usable.length >= 0.4)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([w]) => w);
}

/** Words that show in a design style search, for matching the text of pins and boards. */
export const STYLE_VOCABULARY: readonly string[] = [
  "minimal",
  "glassmorphism",
  "liquid glass",
  "big typography",
  "dark mode",
  "monochrome",
  "luxury",
  "neumorphism",
  "swiss style",
  "bento grid",
  "editorial",
  "grainy",
  "skeuomorphic",
  "brutalist",
  "retro",
  "pastel",
  "gradient",
  "playful",
  "vintage",
  "futuristic",
  "organic",
  "geometric",
  "colorful",
  "elegant",
];

/**
 * The words bend_brief uses for its taste lane: `taste` when the call or the canvas gave some,
 * else the user's profile words. The profile only fills the gap, so it never overrides what the
 * user or their agent asked for. Fails open: no user, no reader or any error gives `taste` as is.
 */
export async function withProfileFallback(
  read: ((userId: string) => Promise<Pick<UserTasteProfile, "styleWords">>) | undefined,
  userId: string | undefined,
  taste: string[],
): Promise<string[]> {
  if (taste.length > 0 || !userId || !read) return taste;
  try {
    return profileTasteWords(await read(userId));
  } catch {
    return taste;
  }
}

/** Vocabulary words found in the given texts, most frequent first (ties by vocabulary order). */
export function matchStyleVocabulary(texts: readonly string[], max = MAX_TASTE_TERMS): string[] {
  const hay = texts.join(" \n ").toLowerCase();
  const found = STYLE_VOCABULARY.map((w, i) => {
    let n = 0;
    for (let at = hay.indexOf(w); at !== -1; at = hay.indexOf(w, at + w.length)) n++;
    return { w, n, i };
  }).filter((x) => x.n > 0);
  return found
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, max)
    .map((x) => x.w);
}
