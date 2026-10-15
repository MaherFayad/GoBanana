/**
 * Data for the swipe file page (`/[locale]/library`, VAL-09). URLs only: thumbnails are plain
 * `<img src>` to each item's own host, never proxied or stored (hard rule 2), and every item shows
 * its source link (hard rule 3). The takedown list is checked on every load and fails closed
 * (hard rule 5): if it cannot load, no items are shown.
 */
import { isPartRole } from "@/lib/stitch/types";
import { clampLimit, type SwipeItem, type SwipeRepo } from "@/lib/swipe";
import type { TakedownMatcher } from "@/lib/takedown";
import { safeImageSrc } from "./dashboard";

export type LibraryFilters = { role: string; q: string; card: string };

export type LibraryCard = {
  id: string;
  kind: SwipeItem["kind"];
  role: string | null;
  cardId: string | null;
  title: string | null;
  sourceSite: string;
  sourceUrl: string;
  /** Safe thumbnail address, or null (a blank tile). */
  src: string | null;
  crop: SwipeItem["crop"];
  note: string | null;
};

export type LibraryLoad = { ok: true; items: LibraryCard[]; total: number } | { ok: false };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

/** Filters from the page's query string: a known role, short words and a short card id. */
export function parseFilters(query: Record<string, string | string[] | undefined>): LibraryFilters {
  const role = one(query.role).trim().toLowerCase();
  return {
    role: isPartRole(role) ? role : "",
    q: one(query.q).trim().slice(0, 80),
    card: one(query.card).trim().slice(0, 60),
  };
}

export type LibraryDeps = {
  swipe(): SwipeRepo;
  loadMatcher(): Promise<TakedownMatcher>;
};

export async function loadLibrary(userId: string, f: LibraryFilters, deps: LibraryDeps): Promise<LibraryLoad> {
  try {
    const repo = deps.swipe();
    const matcher = await deps.loadMatcher();
    const [found, total] = await Promise.all([
      repo.search(userId, { ...(f.role ? { role: f.role } : {}), ...(f.q ? { query: f.q } : {}), ...(f.card ? { cardId: f.card } : {}), limit: clampLimit(50) }),
      repo.count(userId),
    ]);
    const items = found
      .filter((i) => !matcher.isReferenceBlocked(i))
      .map((i) => ({
        id: i.id,
        kind: i.kind,
        role: i.role,
        cardId: i.cardId,
        title: i.title,
        sourceSite: i.sourceSite,
        sourceUrl: i.sourceUrl,
        src: safeImageSrc(i.thumbUrl) ?? safeImageSrc(i.imageUrl),
        crop: i.crop,
        note: i.note,
      }));
    return { ok: true, items, total };
  } catch {
    console.error("[library] could not load");
    return { ok: false };
  }
}

/** Sample items for the test-only sign-in bypass (no database). */
export function demoLibrary(): LibraryLoad {
  return {
    ok: true,
    total: 2,
    items: [
      { id: "demo-1", kind: "part", role: "nav", cardId: null, title: "Split nav with a search pill", sourceSite: "pinterest.com", sourceUrl: "https://www.pinterest.com/pin/1/", src: null, crop: { x: 0, y: 0, w: 1, h: 0.12 }, note: null },
      { id: "demo-2", kind: "reference", role: null, cardId: null, title: "Pricing table on a ticket stub", sourceSite: "dribbble.com", sourceUrl: "https://dribbble.com/shots/2", src: null, crop: null, note: null },
    ],
  };
}
