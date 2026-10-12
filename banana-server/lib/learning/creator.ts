/**
 * Creator affinity (pure). Search results carry a title only (hard rule 1: the server never looks
 * at images), and Dribbble titles name the creator: "Fintech App by Gleb Kuznetsov on Dribbble",
 * "Banking app by Jane Doe for Studio on Dribbble". Pinterest reposts of Dribbble shots keep that
 * title. Behance titles name the creator only sometimes ("Identity by Name on Behance").
 *
 * When a user has rated at least CREATOR_MIN_GREAT results by the same creator great, that
 * creator's results move up a few places inside each lane. Lane quotas still apply after that,
 * so a creator never takes over a search.
 */
import type { Reference } from "../sources/types";

/** Great ratings by one creator before their results are nudged up. */
export const CREATOR_MIN_GREAT = 2;
/** Places a preferred creator's result moves up within its lane. */
export const CREATOR_NUDGE = 5;

const DRIBBBLE = /^.*\bby\s+(.+?)(?:\s+for\s+.+?)?\s+on\s+dribbble\b/i;
const BEHANCE = /^.*\bby\s+(.+?)(?:\s+for\s+.+?)?\s*(?:\s+on|::|\|)\s*behance\b/i;

/** Lowercase, letters, digits and inner spaces only ("Gleb Kuznetsov✈" gives "gleb kuznetsov"). */
export function normalizeCreator(name: string): string | null {
  const out = name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.'-]+|[.'-]+$/g, "")
    .trim();
  if (!out || out.length > 60 || out.split(" ").length > 5) return null;
  return out;
}

/** The creator named in a result title, normalized, or null. */
export function parseCreator(title: string | null | undefined): string | null {
  if (!title) return null;
  const m = DRIBBBLE.exec(title) ?? BEHANCE.exec(title);
  return m?.[1] ? normalizeCreator(m[1]) : null;
}

export type CreatorRating = { itemKey: string; verdict: "great" | "bad"; creator: string | null };

/**
 * Creators the user likes: at least `min` distinct items by them whose latest rating is great.
 * `rows` are newest first, so the first rating of an item is its latest.
 */
export function preferredCreators(rows: readonly CreatorRating[], min = CREATOR_MIN_GREAT): string[] {
  const latest = new Map<string, CreatorRating>();
  for (const r of rows) if (!latest.has(r.itemKey)) latest.set(r.itemKey, r);
  const counts = new Map<string, number>();
  for (const r of latest.values()) {
    if (r.verdict !== "great" || !r.creator) continue;
    counts.set(r.creator, (counts.get(r.creator) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n >= min).map(([c]) => c).sort();
}

/**
 * Stable nudge: a preferred creator's result moves up `by` places, everything else keeps its order.
 * Returns the same array when there is nothing to prefer.
 */
export function nudgeByCreator<T extends Pick<Reference, "title">>(refs: readonly T[], preferred: readonly string[], by = CREATOR_NUDGE): T[] {
  if (preferred.length === 0 || refs.length < 2) return [...refs];
  const set = new Set(preferred);
  return refs
    .map((ref, i) => {
      const creator = parseCreator(ref.title);
      return { ref, i, rank: creator && set.has(creator) ? i - by - 0.5 : i };
    })
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((x) => x.ref);
}

const STUDIO_DRIBBBLE = /\bby\s+.+?\s+for\s+(.+?)\s+on\s+dribbble\b/i;
const STUDIO_BEHANCE = /\bby\s+.+?\s+for\s+(.+?)\s*(?:\s+on|::|\|)\s*behance\b/i;

/**
 * Creator and studio keys of a result title, for the studio cap (at most 2 results per creator
 * or studio per search): "Finance App by Jane Doe for Orbix Studio on Dribbble" gives
 * ["jane doe", "orbix studio"] (one namespace, so a studio counts the same whether a title names
 * it as the creator or after "for"). No creator named, no keys.
 */
export function creatorKeys(title: string | null | undefined): string[] {
  if (!title) return [];
  const keys: string[] = [];
  const creator = parseCreator(title);
  if (creator) keys.push(creator);
  const m = STUDIO_DRIBBBLE.exec(title) ?? STUDIO_BEHANCE.exec(title);
  const studio = m?.[1] ? normalizeCreator(m[1]) : null;
  if (studio && studio !== creator) keys.push(studio);
  return keys;
}
