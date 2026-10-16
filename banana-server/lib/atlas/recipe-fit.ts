/**
 * When a J7 query recipe may replace a Phase 0 lane (Gate 2 fix). Shared by the bend (the baseline
 * recipe it records) and the search plan (the lanes it rewords). Pure.
 */

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
const holds = (q: string, nouns: readonly string[]) => nouns.some((n) => n.trim() && norm(q).includes(norm(n)));
const content = (s: string) => norm(s).trim().split(/\s+/).filter((w) => w.length >= 3);

/**
 * Precision of the Phase 0 lanes on the Banana Bench (bench/runs/2026-10-15b, good or great in the top
 * 8 UI): a recipe takes a lane over only when its own judged precision is at least this. The Phase 0
 * bridge lane kept nothing, so any concept recipe beats it.
 */
export const PHASE0_PRECISION = { fidelity: 0.76, component: 0.59, bridge: 0 } as const;

/** Words of a page name or id that say which page it is, never what product it is for. */
const PAGE_WORDS = new Set(["page", "screen", "app", "website", "web", "dashboard", "home", "landing", "listing", "flow", "state", "view"]);

/**
 * True when a UI recipe names what the brief is about: a word of the product noun or the topic that
 * is not a page word. J7 recipes are worded per page and platform ("dark minimal landing page website
 * ui"), so on a coffee shop brief they drop the coffee shop; then the Phase 0 lane, which keeps the
 * topic, stays (Gate 2 diagnosis: page-only recipes kept 0 of 6 on coffee, 0 of 3 on Qatar services
 * and on Ramadan offers). With no topic beyond the page, a recipe that names the page passes.
 */
export function recipeHoldsTopic(o: { productNoun?: string | null; topic?: string; pageId?: string }): (query: string) => boolean {
  const pageWords = new Set([...PAGE_WORDS, ...content(o.pageId?.replace(/-/g, " ") ?? "")]);
  const topicWords = content(`${o.productNoun ?? ""} ${o.topic ?? ""}`).filter((w) => !pageWords.has(w));
  if (topicWords.length === 0) {
    const nouns = [o.productNoun ?? "", o.topic ?? "", o.pageId?.replace(/-/g, " ") ?? ""].filter(Boolean);
    return (q) => holds(q, nouns);
  }
  return (q) => content(q).some((w) => topicWords.includes(w));
}
