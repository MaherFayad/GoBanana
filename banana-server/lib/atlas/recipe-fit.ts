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

/**
 * The topic slot of a J7 page recipe (Gate 2 round 2): recipes are judged on the page alone ("pricing
 * page website ui") and stored as templates ("{topic} pricing page website ui"); the bend and the
 * search plan fill the slot with the brief's product noun, so a recipe names the topic and can pass
 * recipeHoldsTopic. No new Serper run: the judged precision is the page wording's.
 */
export const TOPIC_SLOT = "{topic}";

/** Most words a filled UI recipe may have (a two word topic on a seven word wording). */
export const MAX_RECIPE_WORDS = 9;

/**
 * A page recipe's wording as a template: the slot goes right before the first page phrase it holds
 * (longest first), else in front. A wording that already has the slot is returned as it is.
 */
export function topicTemplate(query: string, pagePhrases: readonly string[]): string {
  const q = query.trim().replace(/\s+/g, " ");
  if (q.includes(TOPIC_SLOT)) return q;
  const lower = ` ${q.toLowerCase()} `;
  for (const phrase of [...pagePhrases].map((p) => p.trim().toLowerCase()).filter(Boolean).sort((a, b) => b.length - a.length)) {
    const at = lower.indexOf(` ${phrase} `);
    if (at >= 0) return `${q.slice(0, at)} ${TOPIC_SLOT} ${q.slice(at)}`.replace(/\s+/g, " ").trim();
  }
  return `${TOPIC_SLOT} ${q}`;
}

/**
 * The wording with the slot filled by the topic. Topic words the wording already holds are left out
 * ("flight" on "{topic} flight checkout app ui"), so nothing is said twice. No slot: unchanged.
 */
export function fillTopic(query: string, topic: string | null | undefined): string {
  if (!query.includes(TOPIC_SLOT)) return query;
  const have = new Set(norm(query.replace(TOPIC_SLOT, " ")).trim().split(/\s+/));
  const t = (topic ?? "")
    .split(/\s+/)
    .filter((w) => w && !have.has(norm(w).trim()))
    .join(" ");
  return query.replace(TOPIC_SLOT, t).replace(/\s+/g, " ").trim();
}

/** Recipes with their topic slot filled (the same topic gives the same wording, so the same recipe id). */
export function fillRecipes<T extends { query: string }>(recipes: readonly T[], topic: string | null | undefined): T[] {
  return recipes.map((r) => (r.query.includes(TOPIC_SLOT) ? { ...r, query: fillTopic(r.query, topic) } : r));
}
