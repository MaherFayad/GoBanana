/**
 * Atlas reads the tools share (W2): the cards a board's directions came from (export_kit) and the
 * page anatomy a cut is guessed from (cut_parts). Every read fails open: no Atlas, an empty
 * manifest or a shard that cannot be read gives null, and the tool keeps its current behavior.
 */
import type { DirectionDetail } from "@/lib/direction-detail";
import { parsePage } from "./bend";
import type { AtlasSource } from "./source";
import type { IngredientCard, MotionRecipe, PageAnatomy, ShaderRecipe } from "./types";

/** Most card ids one export reads (lead and second card of up to 8 directions). */
export const MAX_EXPORT_CARDS = 16;

/** The lead and second card ids of these directions, in board order, without repeats. */
export function directionCardIds(directions: readonly { detail?: DirectionDetail | null }[]): string[] {
  const ids = directions.flatMap((d) => d.detail?.atlas?.cardIds.slice(0, 2) ?? []);
  return [...new Set(ids)].slice(0, MAX_EXPORT_CARDS);
}

/** The Atlas cards of these directions (lead and second), or null when none can be read. */
export async function loadDirectionCards(
  source: AtlasSource | null | undefined,
  directions: readonly { detail?: DirectionDetail | null }[],
): Promise<Map<string, IngredientCard> | null> {
  const ids = directionCardIds(directions);
  if (!source || ids.length === 0) return null;
  try {
    const cards = await source.cards(ids);
    return cards && cards.size > 0 ? cards : null;
  } catch {
    console.error("[atlas] could not read the direction cards");
    return null;
  }
}

/** Most shader and motion recipes one export reads (1 shader and 2 motion for each of up to 8 directions). */
export const MAX_EXPORT_SHADERS = 8;
export const MAX_EXPORT_MOTION = 16;

/** The J13 recipes these directions name (`detail.atlas.shaderIds`, `motionIds`), or null when there are none to read. */
export async function loadDirectionStunning(
  source: AtlasSource | null | undefined,
  directions: readonly { detail?: DirectionDetail | null }[],
): Promise<{ shaders: Map<string, ShaderRecipe>; motion: Map<string, MotionRecipe> } | null> {
  const shaderIds = new Set(directions.flatMap((d) => d.detail?.atlas?.shaderIds ?? []));
  const motionIds = new Set(directions.flatMap((d) => d.detail?.atlas?.motionIds ?? []));
  if (!source || shaderIds.size + motionIds.size === 0) return null;
  try {
    const [shaders, motion] = await Promise.all([shaderIds.size > 0 ? source.shaders() : [], motionIds.size > 0 ? source.motion() : []]);
    const out = {
      shaders: new Map((shaders ?? []).filter((r) => shaderIds.has(r.id)).slice(0, MAX_EXPORT_SHADERS).map((r) => [r.id, r] as const)),
      motion: new Map((motion ?? []).filter((r) => motionIds.has(r.id)).slice(0, MAX_EXPORT_MOTION).map((r) => [r.id, r] as const)),
    };
    return out.shaders.size + out.motion.size > 0 ? out : null;
  } catch {
    console.error("[atlas] could not read the stunning layer");
    return null;
  }
}

/** What a cut is guessed from: each direction's page anatomy, and the canvas brief's page. */
export type CutAnatomy = {
  /** Page anatomy by direction id (row id and bend id). */
  byDirection: Map<string, PageAnatomy>;
  /** The page the first Atlas direction or the canvas brief names, for images in no direction. */
  board: PageAnatomy | null;
};

/**
 * Page anatomies for a board: the saved `detail.atlas.pageId` of each direction, else the page the
 * brief names (parsePage). Null when there is no Atlas or no page is known.
 */
export async function loadCutAnatomy(
  source: AtlasSource | null | undefined,
  directions: readonly { id: string; bendId?: string | null; detail?: DirectionDetail | null }[],
  brief: string | null | undefined,
): Promise<CutAnatomy | null> {
  if (!source) return null;
  let pages: PageAnatomy[] | null;
  try {
    pages = await source.pages();
  } catch {
    console.error("[atlas] could not read the page anatomy");
    return null;
  }
  if (!pages || pages.length === 0) return null;
  const byId = new Map(pages.map((p) => [p.id, p]));
  const byDirection = new Map<string, PageAnatomy>();
  let first: PageAnatomy | null = null;
  for (const d of directions) {
    const page = d.detail?.atlas?.pageId ? byId.get(d.detail.atlas.pageId) : undefined;
    if (!page) continue;
    first ??= page;
    byDirection.set(d.id, page);
    if (d.bendId) byDirection.set(d.bendId, page);
  }
  const board = first ?? (brief ? parsePage(brief, pages) : null);
  return byDirection.size > 0 || board ? { byDirection, board } : null;
}

/** The anatomy for one image: its direction's page, else the board's page. */
export function anatomyFor(cut: CutAnatomy | null, directionId: string | null | undefined): PageAnatomy | null {
  if (!cut) return null;
  return (directionId ? cut.byDirection.get(directionId) : undefined) ?? cut.board;
}
