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
import { artWords, type LaneTexts } from "@/lib/sources/plan";
import { SOURCE_SITES, type LaneName, type Reference, type SourceSite } from "@/lib/sources/types";
import { referenceId } from "@/lib/sources/web-search";
import { ELEMENT_TO_MECHANIC } from "./bend";
import { atlasTermKey } from "@/lib/learning/arms";
import { chooseRecipe, idWeight, type AtlasLearning } from "./learning";
import { recipeId } from "./loader";
import { fillRecipes, MAX_RECIPE_WORDS, PHASE0_PRECISION, recipeHoldsTopic } from "./recipe-fit";
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

const CC0_STOP = new Set(["the", "and", "with", "for", "art", "close", "pattern", "texture", "poster", "graphic", "print", "design", "vintage"]);

/**
 * Local search over CC0 index items: items whose title, culture or motif share a word with the art
 * words, most shared words first, only when their image host is allowed (`allowImage`: the image
 * host allowlist; museum hosts join it when the owner confirms, J9).
 */
export function searchCc0(items: readonly CC0Item[], artText: readonly string[], allowImage: (url: string) => boolean, limit = MAX_CC0_RESULTS): Reference[] {
  const want = new Set(artText.join(" ").toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((w) => w.length >= 3 && !CC0_STOP.has(w)) ?? []);
  if (want.size === 0) return [];
  return items
    .map((item) => ({ item, score: [...itemWords(item)].filter((w) => want.has(w)).length }))
    .filter((x) => x.score > 0 && allowImage(x.item.imageUrl) && /^https:\/\//.test(x.item.pageUrl))
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
  base: LaneTexts,
  atlas: AtlasIds,
  source: AtlasSource,
  opts: { mechanic?: string; market: Market | null; allowImage: (url: string) => boolean; withArt: boolean; learning?: AtlasLearning | null },
): Promise<AtlasPlan | null> {
  const cardId = atlas.cardIds[0];
  if (!cardId) return null;
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
  const beats = (lane: keyof typeof PHASE0_PRECISION) => (r: QueryRecipe) => uiOk(r) && r.precision >= PHASE0_PRECISION[lane];
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
  const component = best(ofLane("component"), chosen, beats("component"), learning, seed("component"));
  if (component) {
    lanes.component = [component.query, ...(base.component ?? []).filter((q) => q !== component.query)].slice(0, 2);
    record("component", component, true);
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
