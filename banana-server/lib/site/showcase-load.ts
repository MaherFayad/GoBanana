/**
 * The landing page's showcase, filtered through the takedown list (hard rule 5).
 *
 * - One takedown read serves the page, and the compiled list is kept in memory for
 *   SHOWCASE_TAKEDOWN_TTL_MS, so the landing page costs at most one cached read per isolate per
 *   minute. A new takedown entry hides its item within that minute (DECISIONS.md, 2026-10-11).
 *   Search and canvas loads keep reading the list on every call (lib/db/takedowns.ts).
 * - Fail closed: when the list cannot load, this returns null and the page shows GoBanana's own
 *   generative tiles instead of anyone's work. A failed read is not cached.
 * - No Serper calls: the showcase is a fixed list (lib/site/showcase.ts).
 */
import { filterTakedowns, type TakedownMatcher } from "@/lib/takedown";
import { SHOWCASE, type ShowcaseItem } from "./showcase";

export const SHOWCASE_TAKEDOWN_TTL_MS = 60_000;

type Cache = { at: number; matcher: TakedownMatcher };
let cache: Cache | null = null;

export type ShowcaseLoadDeps = {
  loadMatcher: () => Promise<TakedownMatcher>;
  now?: () => number;
  items?: readonly ShowcaseItem[];
};

/** The visible showcase, or null when the takedown list is unavailable (fail closed). */
export async function loadShowcase(deps: ShowcaseLoadDeps): Promise<ShowcaseItem[] | null> {
  const now = (deps.now ?? Date.now)();
  let matcher = cache && now - cache.at < SHOWCASE_TAKEDOWN_TTL_MS ? cache.matcher : null;
  if (!matcher) {
    try {
      matcher = await deps.loadMatcher();
    } catch {
      return null;
    }
    cache = { at: now, matcher };
  }
  return filterTakedowns(deps.items ?? SHOWCASE, matcher);
}

/** Tests only: forget the cached list. */
export function resetShowcaseCache(): void {
  cache = null;
}
