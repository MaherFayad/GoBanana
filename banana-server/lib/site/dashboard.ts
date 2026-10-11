/**
 * Data for the canvases dashboard (`/[locale]/canvases`): the signed-in user's canvases as
 * cards, with a 2 by 2 collage of their references.
 *
 * - URLs only: the collage is plain `<img src>` to the reference's own thumbnail host, never
 *   proxied, downloaded or stored (hard rule 2). Each card still opens the canvas, where every
 *   reference shows its source link.
 * - The takedown list is checked on every load (hard rule 5). If it cannot load, no collage is
 *   shown at all (fail closed); titles and counts still are.
 */
import type { CanvasSummary, Repos } from "@/lib/db/types";
import { compileTakedowns, type TakedownMatcher } from "@/lib/takedown";

/** Cards per page. The dashboard shows the most recently updated ones. */
export const DASHBOARD_LIMIT = 60;
export const COLLAGE_SIZE = 4;

export type CollageImage = { src: string; sourceUrl: string };

export type DashboardCard = {
  id: string;
  title: string;
  brief: string | null;
  /** ISO time of the last save. */
  updatedAt: string;
  referenceCount: number;
  directionCount: number;
  /** A view link is on. */
  shared: boolean;
  collage: CollageImage[];
};

export type DashboardLoad = { ok: true; cards: DashboardCard[] } | { ok: false };

/** Only absolute https URLs or same-site paths (uploads) reach an `<img src>`. */
export function safeImageSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Up to four collage images: blocked references dropped, the thumbnail preferred over the full image. */
export function collageFor(summary: Pick<CanvasSummary, "previews">, matcher: TakedownMatcher | null): CollageImage[] {
  if (!matcher) return [];
  const out: CollageImage[] = [];
  for (const ref of summary.previews) {
    if (matcher.isReferenceBlocked(ref)) continue;
    const src = safeImageSrc(ref.thumbUrl) ?? safeImageSrc(ref.imageUrl);
    if (!src) continue;
    out.push({ src, sourceUrl: ref.sourceUrl });
    if (out.length >= COLLAGE_SIZE) break;
  }
  return out;
}

export function toCard(summary: CanvasSummary, matcher: TakedownMatcher | null): DashboardCard {
  return {
    id: summary.id,
    title: summary.title,
    brief: summary.brief,
    updatedAt: summary.updatedAt.toISOString(),
    referenceCount: summary.referenceCount,
    directionCount: summary.directionCount,
    shared: Boolean(summary.shareToken),
    collage: collageFor(summary, matcher),
  };
}

export type DashboardDeps = {
  repos(): Pick<Repos, "canvases" | "takedowns">;
  limit?: number;
};

export async function loadDashboard(userId: string, deps: DashboardDeps): Promise<DashboardLoad> {
  let repos: Pick<Repos, "canvases" | "takedowns">;
  let summaries: CanvasSummary[];
  try {
    repos = deps.repos();
    summaries = await repos.canvases.listOwned(userId, { limit: deps.limit ?? DASHBOARD_LIMIT });
  } catch {
    console.error("[dashboard] canvases could not load");
    return { ok: false };
  }
  let matcher: TakedownMatcher | null = null;
  if (summaries.some((s) => s.previews.length > 0)) {
    try {
      matcher = compileTakedowns(await repos.takedowns.list());
    } catch {
      console.error("[dashboard] takedown list could not load; collages hidden");
    }
  }
  return { ok: true, cards: summaries.map((s) => toCard(s, matcher)) };
}

/**
 * Cards for the test-only sign-in bypass (E2E_AUTH_BYPASS, never on in production), so the
 * dashboard renders in Playwright without a database. Image hosts are mocked by the tests.
 */
export function demoCards(now = new Date("2026-10-11T09:00:00Z")): DashboardCard[] {
  const at = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
  const img = (n: number): CollageImage => ({
    src: `https://i.pinimg.com/236x/r${n}.jpg`,
    sourceUrl: `https://www.pinterest.com/pin/${n}/`,
  });
  return [
    { id: "e2e-seed", title: "Cold checkout", brief: "A flight checkout that feels calm at 3am", updatedAt: at(2), referenceCount: 14, directionCount: 3, shared: true, collage: [img(1), img(2), img(3), img(4)] },
    { id: "e2e-sadu", title: "Souq loyalty card", brief: "Loyalty card for a date shop, Sadu lens", updatedAt: at(26), referenceCount: 9, directionCount: 4, shared: false, collage: [img(5), img(6), img(1)] },
    { id: "e2e-swiss", title: "Transit dashboard", brief: "Metro ops dashboard, Swiss grid, night shift", updatedAt: at(74), referenceCount: 22, directionCount: 5, shared: false, collage: [img(2), img(4), img(6), img(3)] },
    { id: "e2e-empty", title: "Untitled canvas", brief: null, updatedAt: at(240), referenceCount: 0, directionCount: 0, shared: false, collage: [] },
  ];
}
