/**
 * Typed reads over the Atlas shards for the bend engine and the search plan. Every method returns
 * null when its shards could not be read (missing, bad hash, budget spent): the caller then falls
 * back to the current engine or the Phase 0 lanes.
 */
import { bucketOf, recipeKeyString, type AtlasLoader } from "./loader";
import type { CardElementLine, CC0Item, DomainEntry, FitScore, IngredientCard, Mechanic, PageAnatomy, QueryRecipe, SlopRule, UiElement } from "./types";

export interface AtlasSource {
  pages(): Promise<PageAnatomy[] | null>;
  domains(): Promise<DomainEntry[] | null>;
  fit(domainId: string): Promise<FitScore[] | null>;
  /** Cards by id (unknown ids are left out). */
  cards(ids: readonly string[]): Promise<Map<string, IngredientCard> | null>;
  /** Element lines of these cards. */
  lines(cardIds: readonly string[]): Promise<CardElementLine[] | null>;
  mechanics(element: UiElement): Promise<Mechanic[] | null>;
  /** Recipes whose key matches one of `keys` exactly. */
  recipes(keys: readonly QueryRecipe["key"][]): Promise<QueryRecipe[] | null>;
  /** CC0 index items of these regions (shards that do not exist are skipped). */
  cc0(regions: readonly string[]): Promise<CC0Item[] | null>;
  /** Slop rules (J8); an empty list when the Atlas has none. */
  slop(): Promise<SlopRule[] | null>;
}

/** Load each bucket an id list touches, once, and keep the rows `keep` accepts. */
async function fromBuckets<T>(loader: AtlasLoader, kind: "cards" | "lines" | "recipes", ids: readonly string[], keep: (row: T) => boolean): Promise<T[] | null> {
  const count = loader.names(kind).length;
  if (count === 0) return null;
  const shards = [...new Set(ids.map((id) => bucketOf(id, count)))].sort();
  const out: T[] = [];
  for (const s of shards) {
    const rows = await loader.shard<T>(kind, s);
    if (!rows) return null;
    for (const r of rows) if (keep(r)) out.push(r);
  }
  return out;
}

export function loaderSource(loader: AtlasLoader): AtlasSource {
  return {
    pages: () => loader.all<PageAnatomy>("pages"),
    domains: () => loader.all<DomainEntry>("domains"),
    fit: (domainId) => loader.shard<FitScore>("fit", domainId),
    async cards(ids) {
      const want = new Set(ids);
      const rows = await fromBuckets<IngredientCard>(loader, "cards", ids, (c) => want.has(c.id));
      return rows ? new Map(rows.map((c) => [c.id, c])) : null;
    },
    lines(cardIds) {
      const want = new Set(cardIds);
      return fromBuckets<CardElementLine>(loader, "lines", cardIds, (l) => want.has(l.cardId));
    },
    async mechanics(element) {
      if (!loader.names("mechanics").includes(element)) return [];
      return loader.shard<Mechanic>("mechanics", element);
    },
    recipes(keys) {
      const want = new Set(keys.map(recipeKeyString));
      return fromBuckets<QueryRecipe>(loader, "recipes", [...want], (r) => want.has(recipeKeyString(r.key)));
    },
    async slop() {
      if (loader.names("slop").length === 0) return [];
      return loader.all<SlopRule>("slop");
    },
    async cc0(regions) {
      const names = new Set(loader.names("cc0"));
      const out: CC0Item[] = [];
      for (const region of regions) {
        if (!names.has(region)) continue;
        const rows = await loader.shard<CC0Item>("cc0", region);
        if (!rows) return null;
        out.push(...rows);
      }
      return out;
    },
  };
}
