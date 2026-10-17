/**
 * Search plan v2 (P1-I3): the lanes of a direction the Atlas engine made, worded by its tested
 * query recipes (J7) instead of guessed queries.
 *
 *   baseline   the page and platform recipe, in the fidelity lane (run once per canvas, P0-03)
 *   concept    the lead card and element recipe, in the bridge lane (no idea title filter)
 *   component  the element recipe, first in the component lanes
 *   art        the card's art recipes first, plus a local search over the CC0 index shards
 *
 * Each lane keeps its Phase 0 words (P0-17 taste lanes included) when no recipe fits, so a
 * missing recipe never loses a lane. Every reference a recipe found carries `recipeId` and
 * `cardId` (provenance, saved on the reference row). Learning (W2, lib/atlas/learning.ts): a lane
 * the bend did not choose a recipe for draws one with `pickRecipe` when ratings exist, and art
 * recipes are ordered by precision times their weight. Pure: the Atlas source, the learning and
 * the image host check are injected.
 */
import type { Market } from "@/lib/bend/market";
import type { DirectionDetail } from "@/lib/direction-detail";
import { queryWords } from "@/lib/learning/terms";
import { artRequests, artWords, type LaneTexts, type PlannedRequest } from "@/lib/sources/plan";
import { SOURCE_SITES, type LaneName, type Reference, type SourceSite } from "@/lib/sources/types";
import { referenceId } from "@/lib/sources/web-search";
import { ELEMENT_TO_MECHANIC } from "./bend";
import { atlasTermKey } from "@/lib/learning/arms";
import { chooseRecipe, idWeight, type AtlasLearning } from "./learning";
import { recipeId } from "./loader";
import { applySearchHints } from "./search-hints";
import { beatsPhase0, fillRecipes, MAX_RECIPE_WORDS, PHASE0_PRECISION, recipeHoldsTopic } from "./recipe-fit";
import type { AtlasSource } from "./source";
import type { CC0Item, QueryRecipe, UiElement } from "./types";

/** Subrequests a search may spend on Atlas shards (recipes and CC0): Serper, Neon and Atlas stay under 50. */
export const SEARCH_SHARD_BUDGET = 12;
/** Most CC0 index items one direction search adds to the art zone. */
export const MAX_CC0_RESULTS = 2;

export type AtlasIds = NonNullable<DirectionDetail["atlas"]>;

/** Where a search request's words came from: the recipe and the card. */
export type Provenance = { lane: LaneName; words: string; recipeId: string; cardId?: string };

export type AtlasPlan = {
  lanes: LaneTexts;
  provenance: Provenance[];
  /** Local CC0 index matches for the art zone (hotlinked museum images, never copied). */
  cc0: Reference[];
};

export { PHASE0_PRECISION, recipeHoldsTopic } from "./recipe-fit";

/** A component query worded for a whole surface: an element on "... dashboard ui" (R5 Bench: 2 of 23 kept). */
export function surfaceComponent(query: string): boolean {
  return /\bdashboards?\b/i.test(query);
}

/** Atlas elements that map to a direction's saved mechanic part ("header" is header or hero). */
export function elementsFor(mechanic: string | undefined): UiElement[] {
  if (!mechanic) return [];
  return (Object.entries(ELEMENT_TO_MECHANIC) as [UiElement, string][]).filter(([, m]) => m === mechanic).map(([el]) => el);
}

function keyFields(key: QueryRecipe["key"]): QueryRecipe["key"] {
  return {
    lane: key.lane,
    ...(key.page ? { page: key.page } : {}),
    ...(key.platform ? { platform: key.platform } : {}),
    ...(key.element ? { element: key.element } : {}),
    ...(key.cardId ? { cardId: key.cardId } : {}),
  };
}

/**
 * Best recipe: one the bend chose, else the best judged (precision, then judged), or a Thompson
 * draw among them when the learning has ratings for one (chooseRecipe).
 */
function best(list: readonly QueryRecipe[], chosen: ReadonlySet<string>, ok: (r: QueryRecipe) => boolean, learning: AtlasLearning | null | undefined, seed: string): QueryRecipe | null {
  const ranked = [...list]
    .filter(ok)
    .sort(
      (a, b) =>
        Number(chosen.has(recipeId(b))) - Number(chosen.has(recipeId(a))) ||
        b.precision - a.precision ||
        b.judged - a.judged ||
        a.query.localeCompare(b.query),
    );
  if (ranked[0] && chosen.has(recipeId(ranked[0]))) return ranked[0];
  return chooseRecipe(ranked, learning, seed);
}

const asSite = (source: string): SourceSite | undefined => (SOURCE_SITES as readonly string[]).includes(source) ? (source as SourceSite) : undefined;

/** Words of a CC0 item that say what it shows. */
function itemWords(item: CC0Item): Set<string> {
  const text = [item.title, item.culture ?? "", ...item.motif].join(" ").toLowerCase();
  return new Set((text.match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length >= 3));
}

const CC0_STOP = new Set(["the", "and", "with", "for", "from", "art", "close", "pattern", "texture", "poster", "graphic", "print", "design", "vintage", "style", "styles", "modern"]);
/**
 * Words too common in museum titles to match an item on their own ("Single Leaf Excised from a
 * Gospel Book" for "saz leaf tile", "Millefiori Glass Tile" for "karak tea glass": Gate 2 round 2).
 */
const CC0_WEAK = new Set(["leaf", "leaves", "glass", "paper", "number", "numbers", "sign", "head", "house", "field", "border", "fragment", "panel", "board", "color", "colour", "line", "lines", "star", "stars", "scene", "scenes", "figure", "figures", "book", "page", "piece", "card", "night", "city", "light", "lights", "water", "wood", "stone", "gold", "metal", "red", "blue", "green", "white", "black", "small", "large", "single", "double", "shadow", "drawing", "study", "view", "plate", "cover", "box"]);

/** Enough overlap to show an item: two shared words, or one telling word (5 letters or more, not weak) its title or motif names. */
function cc0Match(item: CC0Item, shared: readonly string[]): boolean {
  if (shared.length >= 2) return true;
  const w = shared[0];
  if (!w || w.length < 5 || CC0_WEAK.has(w)) return false;
  const named = new Set(`${item.title} ${item.motif.join(" ")}`.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  return named.has(w);
}

/**
 * Local search over CC0 index items: items whose title, culture or motif share two words with the art
 * words, or one telling word (cc0Match), most shared words first, only when their image host is allowed (`allowImage`: the image
 * host allowlist; museum hosts join it when the owner confirms, J9).
 */
export function searchCc0(items: readonly CC0Item[], artText: readonly string[], allowImage: (url: string) => boolean, limit = MAX_CC0_RESULTS): Reference[] {
  const want = new Set(artText.join(" ").toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((w) => w.length >= 3 && !CC0_STOP.has(w) && !/\d/.test(w)) ?? []);
  if (want.size === 0) return [];
  return items
    .map((item) => ({ item, shared: [...itemWords(item)].filter((w) => want.has(w)) }))
    .map((x) => ({ ...x, score: x.shared.length }))
    .filter((x) => cc0Match(x.item, x.shared) && allowImage(x.item.imageUrl) && /^https:\/\//.test(x.item.pageUrl))
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, limit)
    .map(({ item }) => ({
      id: referenceId(item.pageUrl, item.imageUrl),
      thumbUrl: item.imageUrl,
      imageUrl: item.imageUrl,
      sourceUrl: item.pageUrl,
      sourceSite: new URL(item.pageUrl).hostname.replace(/^www\./, ""),
      title: item.title,
      lane: "art" as const,
      query: "cc0 index",
      zone: "art" as const,
    }));
}

/**
 * The CC0 regions a brief reads, nearest first: a Gulf brief reads the Gulf, then the wider MENA
 * region (the J9 index tags few items as Gulf), then the untagged items; the source stops after
 * MAX_CC0_PARTS shards (lib/atlas/source.ts).
 */
export function cc0Regions(market: Market | null): string[] {
  if (market === "gulf") return ["gulf", "mena", "global"];
  if (market === "mena") return ["mena", "gulf", "global"];
  return ["global"];
}

/**
 * Lanes for a direction the Atlas engine made, or null when its recipes cannot be read (then the
 * Phase 0 lanes run unchanged). `base` is the direction's Phase 0 lanes (directionLanes).
 */
export async function atlasSearchPlan(
  phase0: LaneTexts,
  atlas: AtlasIds,
  source: AtlasSource,
  opts: { mechanic?: string; market: Market | null; allowImage: (url: string) => boolean; withArt: boolean; learning?: AtlasLearning | null },
): Promise<AtlasPlan | null> {
  const cardId = atlas.cardIds[0];
  if (!cardId) return null;
  // Round 3 search hints (lib/atlas/search-hints.ts): the topic the bend found and the title words to drop.
  const base = applySearchHints(phase0, { ...(atlas.searchTopic ? { searchTopic: atlas.searchTopic } : {}), ...(atlas.avoidWords?.length ? { avoidWords: atlas.avoidWords } : {}) });
  const page = atlas.pageId;
  const platform = base.platform && base.platform !== "any" ? base.platform : undefined;
  const elements = elementsFor(opts.mechanic);
  const keys: QueryRecipe["key"][] = [];
  if (page) keys.push({ lane: "baseline", page, ...(platform ? { platform } : {}) }, { lane: "baseline", page });
  for (const element of elements) {
    if (page) keys.push({ lane: "concept", page, ...(platform ? { platform } : {}), element, cardId });
    keys.push({ lane: "concept", element, cardId });
    if (page) keys.push({ lane: "component", page, ...(platform ? { platform } : {}), element }, { lane: "component", page, element });
    if (platform) keys.push({ lane: "component", platform, element });
  }
  keys.push({ lane: "concept", cardId }, { lane: "art", cardId });
  const unique = [...new Map(keys.map(keyFields).map((k) => [JSON.stringify(k), k])).values()];
  const read = await source.recipes(unique);
  if (!read) return null;
  // The same topic the bend filled the templates with, so the recipe ids it chose match.
  const recipes = fillRecipes(read, atlas.productNoun ?? base.topic);

  const chosen = new Set(atlas.recipeIds);
  const topicOk = recipeHoldsTopic({ productNoun: atlas.productNoun, topic: base.topic, pageId: page });
  const uiOk = (r: QueryRecipe) => topicOk(r.query) && r.query.split(/\s+/).length <= MAX_RECIPE_WORDS;
  // A recipe replaces a Phase 0 lane only when it was judged at least as precise as that lane.
  const beats = (lane: keyof typeof PHASE0_PRECISION) => (r: QueryRecipe) => uiOk(r) && beatsPhase0(r, lane);
  const ofLane = (lane: QueryRecipe["key"]["lane"]) => recipes.filter((r) => r.key.lane === lane);
  const lanes: LaneTexts = { ...base, recipeSites: { ...(base.recipeSites ?? {}) } };
  const provenance: Provenance[] = [];
  const record = (lane: LaneName, r: QueryRecipe, withCard: boolean) => {
    provenance.push({ lane, words: queryWords(r.query), recipeId: recipeId(r), ...(withCard ? { cardId: r.key.cardId ?? cardId } : {}) });
    const site = asSite(r.source);
    if (site && lane !== "art") lanes.recipeSites![lane] = site;
  };

  const learning = opts.learning ?? null;
  const seed = (lane: string) => `${cardId}|${page ?? "-"}|${lane}`;
  const baseline = best(ofLane("baseline"), chosen, beats("fidelity"), learning, seed("baseline"));
  if (baseline) {
    lanes.fidelity = baseline.query;
    record("fidelity", baseline, false);
  }
  const concept = best(ofLane("concept"), chosen, uiOk, learning, seed("concept"));
  if (concept) {
    lanes.bridge = concept.query;
    lanes.bridgeTitleFilter = false;
    record("bridge", concept, true);
  }
  // R5: with no concept recipe the bridge is the Phase 0 "{idea} ui design" lane, which kept 14 of 38
  // top 8 results on the Atlas-era Bench runs (g2g to r5a; 6 of 23 on later directions). Its places go
  // to the page lanes.
  if (!concept) delete lanes.bridge;
  const component = best(ofLane("component"), chosen, beats("component"), learning, seed("component"));
  if (component && !surfaceComponent(component.query)) {
    lanes.component = [component.query, ...(base.component ?? []).filter((q) => q !== component.query)].slice(0, 2);
    record("component", component, true);
  }
  // R5: a component lane worded for a whole surface ("government services progress bar dashboard ui")
  // brings back generic dashboards (2 of 23 kept on the Atlas-era runs), so it is not searched.
  if (lanes.component) {
    lanes.component = lanes.component.filter((q) => !surfaceComponent(q));
    if (lanes.component.length === 0) delete lanes.component;
  }
  const artScore = (r: QueryRecipe) => r.precision * idWeight(learning, atlasTermKey("recipe", recipeId(r)));
  const art = ofLane("art")
    .filter((r) => artWords(r.query))
    .sort((a, b) => Number(chosen.has(recipeId(b))) - Number(chosen.has(recipeId(a))) || artScore(b) - artScore(a))
    .slice(0, 2);
  if (art.length > 0) {
    const words = art.map((r) => artWords(r.query));
    lanes.art = [...words, ...(base.art ?? []).filter((q) => !words.includes(q))].slice(0, 3);
    for (const r of art) record("art", r, true);
  }
  if (Object.keys(lanes.recipeSites!).length === 0) delete lanes.recipeSites;

  // Local CC0 index search: shards for the brief's region and global, read only for art.
  let cc0: Reference[] = [];
  if (opts.withArt) {
    const items = await source.cc0(cc0Regions(opts.market));
    if (items) cc0 = searchCc0(items, [...(lanes.art ?? []), base.idea], opts.allowImage);
  }
  return { lanes, provenance, cc0 };
}

/**
 * Provenance for one search result: the recipe whose words found it, and the card. Results of a
 * direction's own lanes (not the shared baseline) carry the lead card even without a recipe; CC0
 * index results carry the card too.
 */
export function provenanceFor(ref: Pick<Reference, "lane" | "query">, plan: AtlasPlan, cardId: string | undefined): { recipeId?: string; cardId?: string } {
  const words = ref.query ? queryWords(ref.query) : "";
  const hit = plan.provenance.find((p) => p.lane === ref.lane && p.words === words);
  if (hit) return { recipeId: hit.recipeId, ...(hit.cardId ? { cardId: hit.cardId } : {}) };
  if (ref.lane && ref.lane !== "fidelity" && cardId) return { cardId };
  return {};
}

/** R7: most share of a direction search's UI requests that stay on Dribbble (Atlas directions). */
export const DRIBBBLE_MAX_SHARE = 0.4;
/** R7: and of its UI places, while other sources have UI results left (mergeLanes siteCap). */
export const DRIBBBLE_CAP = { domain: "dribbble.com", share: DRIBBBLE_MAX_SHARE } as const;
/** R7: the order UI requests leave Dribbble in, after deep pages; the concept recipe (judged on its source) last. */
const MOVE_ORDER: readonly LaneName[] = ["component", "hero", "fidelity", "taste", "bridge"];

/**
 * R7 source spread for an Atlas direction's plan (deterministic, never more requests). Over every
 * rated Bench run Dribbble held 76% of the top 8 UI results at 7% great, Pinterest 15% at 27% great
 * with about the same precision (agent ratings); Pinterest art kept 93% (33% great), Behance art 45%
 * (none great). Behance UI, Cosmos and Are.na returned almost nothing in the R7 probe. So:
 * - UI: at most DRIBBBLE_MAX_SHARE of the UI requests stay on Dribbble (at least one). The others
 *   move to Pinterest pins with the same words (a Dribbble page 2 becomes a Pinterest page 1): deep
 *   pages first, then component, hero, fidelity and taste, the concept lane last. A request Pinterest
 *   already has in the plan is left out instead. Galleries never move.
 * - Art: the art requests keep their places, filled Pinterest first (every art query on Pinterest,
 *   then Behance, then the art galleries), so a second art idea is searched before Behance.
 * Plans with a genre lane (deck, brand) or sources the caller picked are never passed here.
 */
export function spreadSources<T extends PlannedRequest>(plan: readonly T[], lanes: Pick<LaneTexts, "art" | "artGalleries">): T[] {
  const out = plan.map((r) => ({ ...r }));
  const key = (r: Pick<PlannedRequest, "query" | "site" | "page">) => `${r.site}|${r.page ?? 1}|${r.query}`;
  const uiCount = out.filter((r) => r.lane !== "art").length;
  const cap = Math.max(1, Math.floor(uiCount * DRIBBBLE_MAX_SHARE));
  const drib = out.filter((r) => r.lane !== "art" && r.site === "dribbble");
  const rank = (r: PlannedRequest) => ((r.page ?? 1) > 1 ? -1 : MOVE_ORDER.indexOf(r.lane));
  const movable = [...drib].sort((a, b) => rank(a) - rank(b) || out.indexOf(b) - out.indexOf(a));
  const drop = new Set<T>();
  let over = drib.length - cap;
  for (const r of movable) {
    if (over <= 0) break;
    over--;
    const target = key({ query: r.query, site: "pinterest" });
    if (out.some((o) => o !== r && !drop.has(o) && key(o) === target)) {
      drop.add(r);
      continue;
    }
    r.site = "pinterest";
    delete r.page;
  }
  const kept = out.filter((r) => !drop.has(r));
  // Art: the same places, Pinterest first.
  const artAt = kept.flatMap((r, i) => (r.lane === "art" ? [i] : []));
  if (artAt.length > 0) {
    const all = artRequests(lanes.art, lanes.artGalleries ?? []);
    const order = [...all.filter((r) => r.site === "pinterest"), ...all.filter((r) => r.site === "behance"), ...all.filter((r) => r.site !== "pinterest" && r.site !== "behance")];
    artAt.forEach((at, i) => {
      if (order[i]) kept[at] = order[i] as T;
    });
  }
  return kept;
}
