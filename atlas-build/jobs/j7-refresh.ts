/**
 * P2-04 quarterly recipe refresh. Rejudges the query recipes (J7, out/v1/recipes) that are older
 * than 90 days, or whose precision in user feedback is falling, with the same judge and the same
 * taste bar as J7: one Serper image search per recipe, the top 8 thumbnails fetched into memory
 * (never to disk), one verdict per image. Run it only when API credit is there; otherwise skip it,
 * the old recipes stay valid.
 *
 *   npx tsx run.ts j7-refresh --dry          # which recipes, the estimate and the budget check; no Serper, no API
 *   npx tsx run.ts j7-refresh --limit 20     # a real run on the first 20 (20 Serper credits)
 *
 * Falling precision needs data/recipe-feedback.json (optional), which the owner exports from the
 * database; no agent connects to it. One row per recipe, from search_feedback rows with term key
 * `recipe|<id>` (P1-I6), split at 30 days ago:
 *
 *   select substr(term_key, 8) as "recipeId",
 *     json_build_object('great', count(*) filter (where verdict = 'great' and created_at >= now() - interval '30 days'),
 *                       'bad',   count(*) filter (where verdict = 'bad'   and created_at >= now() - interval '30 days')) as recent,
 *     json_build_object('great', count(*) filter (where verdict = 'great' and created_at <  now() - interval '30 days'),
 *                       'bad',   count(*) filter (where verdict = 'bad'   and created_at <  now() - interval '30 days')) as before
 *   from search_feedback where lane = 'atlas' and term_key like 'recipe|%' group by term_key;
 *
 * Output: the whole recipes kind, with every rejudged recipe replaced (new precision, judged and
 * date) and the others unchanged. A rejudged recipe under 0.5 is dropped when its key keeps another
 * wording at 0.5 or more (J7's rule); a key left with none keeps its best wording and is logged for
 * the owner.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { recipeId, recipeKeyString } from "../../banana-server/lib/atlas/loader.ts";
import { SOURCE_REGISTRY } from "../../banana-server/lib/sources/registry.ts";
import { JUDGE, PATHS, ROOT } from "../config.ts";
import { defineJob, placeholderImage, type JobContext } from "../lib/job.ts";
import { readJobRecords } from "../lib/layout.ts";
import { fetchThumbBlock } from "../lib/thumbs.ts";
import { extractJson } from "../lib/validate.ts";
import { QueryRecipeSchema, type QueryRecipe } from "../schema.ts";

/** Recipes older than this are rejudged. */
export const MAX_AGE_DAYS = 90;
/** Top results judged per recipe (as J7). */
export const TOP = 8;
/** J7 keeps wordings at or above this precision. */
export const KEEP_PRECISION = 0.5;
/** Feedback counts as falling when recent precision is this far under the earlier one. */
export const FALL = 0.15;
/** Fewest recent ratings before feedback can call a recipe falling. */
export const MIN_RECENT = 5;
/** Most recipes one refresh run rejudges (the J7 budget is shared). */
export const MAX_REFRESH = 600;

export type Counts = { great: number; bad: number };
export type RecipeFeedback = { recipeId: string; recent: Counts; before?: Counts };
export type Target = { recipe: QueryRecipe; id: string; reasons: Array<"age" | "falling"> };

const share = (c: Counts) => (c.great + c.bad > 0 ? c.great / (c.great + c.bad) : null);
const days = (from: string, to: Date) => (to.getTime() - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

/** True when the recipe's recent feedback precision is falling (against earlier feedback, else its judged precision). */
export function isFalling(recipe: QueryRecipe, fb: RecipeFeedback | undefined): boolean {
  if (!fb || fb.recent.great + fb.recent.bad < MIN_RECENT) return false;
  const recent = share(fb.recent)!;
  const before = fb.before && fb.before.great + fb.before.bad >= MIN_RECENT ? share(fb.before)! : recipe.precision;
  return recent < before - FALL;
}

/** Pure: the recipes to rejudge, oldest first, at most `max`. */
export function refreshTargets(recipes: readonly QueryRecipe[], feedback: readonly RecipeFeedback[], today: Date, max = MAX_REFRESH): Target[] {
  const fb = new Map(feedback.map((f) => [f.recipeId, f]));
  const out: Target[] = [];
  for (const recipe of recipes) {
    const id = recipeId(recipe);
    const reasons: Target["reasons"] = [];
    if (days(recipe.at, today) > MAX_AGE_DAYS) reasons.push("age");
    if (isFalling(recipe, fb.get(id))) reasons.push("falling");
    if (reasons.length > 0) out.push({ recipe, id, reasons });
  }
  return out.sort((a, b) => a.recipe.at.localeCompare(b.recipe.at) || a.id.localeCompare(b.id)).slice(0, max);
}

/** The Serper image query for a recipe: its words, scoped to its source's `site:` path. */
export function serperQuery(recipe: Pick<QueryRecipe, "query" | "source">): string {
  const entry = (SOURCE_REGISTRY as readonly { id: string; scope: string }[]).find((s) => s.id === recipe.source);
  return entry ? `${recipe.query} site:${entry.scope}` : recipe.query;
}

/** Verdicts from the judge's reply, one per image in order. */
export function parseVerdicts(text: string): Array<"great" | "good" | "bad"> {
  const json = extractJson(text) as { verdicts?: unknown } | unknown[];
  const list = Array.isArray(json) ? json : (json as { verdicts?: unknown }).verdicts;
  if (!Array.isArray(list)) throw new Error("no verdicts array");
  return list.map((v) => {
    const s = String(v).toLowerCase();
    if (s !== "great" && s !== "good" && s !== "bad") throw new Error(`bad verdict "${s}"`);
    return s;
  });
}

/** The rejudged recipe: precision = good or great over judged, today's date. */
export function rejudged(recipe: QueryRecipe, verdicts: readonly string[], today: string): QueryRecipe {
  const judged = verdicts.length;
  const good = verdicts.filter((v) => v === "great" || v === "good").length;
  return { ...recipe, precision: judged > 0 ? Math.round((good / judged) * 1000) / 1000 : 0, judged, at: today };
}

/**
 * Pure: all recipes with the rejudged ones in place. A rejudged recipe under KEEP_PRECISION is
 * dropped when its key keeps another wording at KEEP_PRECISION or more; keys left with none are
 * returned in `weak` (they keep their best wording).
 */
export function mergeRefreshed(existing: readonly QueryRecipe[], fresh: readonly QueryRecipe[]): { recipes: QueryRecipe[]; dropped: string[]; weak: string[] } {
  const byId = new Map(existing.map((r) => [recipeId(r), r]));
  const freshIds = new Set<string>();
  for (const r of fresh) {
    byId.set(recipeId(r), r);
    freshIds.add(recipeId(r));
  }
  const byKey = new Map<string, QueryRecipe[]>();
  for (const r of byId.values()) {
    const k = recipeKeyString(r.key);
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  const recipes: QueryRecipe[] = [];
  const dropped: string[] = [];
  const weak: string[] = [];
  for (const [k, list] of byKey) {
    const strong = list.some((r) => r.precision >= KEEP_PRECISION);
    if (!strong) weak.push(k);
    for (const r of list) {
      if (strong && freshIds.has(recipeId(r)) && r.precision < KEEP_PRECISION) dropped.push(recipeId(r));
      else recipes.push(r);
    }
  }
  return { recipes, dropped, weak };
}

function loadFeedback(): RecipeFeedback[] {
  const file = join(ROOT, "data", "recipe-feedback.json");
  if (!existsSync(file)) return [];
  const rows = JSON.parse(readFileSync(file, "utf8")) as unknown;
  return Array.isArray(rows) ? (rows as RecipeFeedback[]).filter((r) => r && typeof r.recipeId === "string" && r.recent) : [];
}

const currentRecipes = () => (readJobRecords(PATHS.out).get("recipes") ?? []) as QueryRecipe[];
const today = () => new Date().toISOString().slice(0, 10);

type SerperImage = { imageUrl?: string; thumbnailUrl?: string; link?: string; title?: string };

/** One Serper image search (1 credit). Only URLs come back; nothing is stored. */
async function serperImages(q: string): Promise<SerperImage[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error("SERPER_API_KEY is not set (atlas-build/.env)");
  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: { "X-API-KEY": key, "content-type": "application/json" },
    body: JSON.stringify({ q, num: 20 }),
  });
  if (!res.ok) throw new Error(`Serper answered ${res.status}`);
  return (((await res.json()) as { images?: SerperImage[] }).images ?? []).slice(0, TOP * 2);
}

function tasteBar(): string {
  const file = join(ROOT, "..", "docs", "taste-bar.md");
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

const SYSTEM = `You judge image search results for GoBanana's query recipes: a recipe is a search wording that should find design references at the owner's taste bar for one page, element or ingredient.

For each image, in order, give one verdict:
- great: reaches the taste bar below and fits the recipe's key (lane, page, platform, element, card).
- good: fits the key and is usable, below the bar.
- bad: off the key (wrong page, a UI kit, a stock illustration, an unrelated app) or far below the bar.

Answer with JSON only: {"verdicts": ["great" | "good" | "bad", ...]}, exactly one verdict per image, in the order shown. No other text.

The taste bar:

${tasteBar()}`;

type Input = Target;

export default defineJob<Input, QueryRecipe>({
  id: "j7-refresh",
  kind: "recipes",
  model: JUDGE,
  mode: "batch",
  schema: QueryRecipeSchema,
  system: SYSTEM,
  maxTokens: 400,
  expectedOutputTokens: 120,
  effort: "low",

  loadInputs: (ctx: JobContext) => {
    const targets = refreshTargets(currentRecipes(), loadFeedback(), new Date());
    ctx.log(`Recipes to rejudge: ${targets.length} (${targets.filter((t) => t.reasons.includes("age")).length} older than ${MAX_AGE_DAYS} days, ${targets.filter((t) => t.reasons.includes("falling")).length} with falling feedback).`);
    return targets;
  },
  requestId: (input) => `refresh-${input.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`.slice(0, 64),
  async buildPrompt(input, ctx) {
    const { recipe } = input;
    const head: Anthropic.TextBlockParam = {
      type: "text",
      text: `Recipe key ${JSON.stringify(recipe.key)}, wording "${recipe.query}", source ${recipe.source}. Judged ${recipe.judged} results on ${recipe.at} at precision ${recipe.precision}. The top results follow.`,
    };
    if (ctx.dry) return [head, ...Array.from({ length: TOP }, () => placeholderImage())];
    const blocks: Anthropic.ContentBlockParam[] = [head];
    for (const r of await serperImages(serperQuery(recipe))) {
      if (blocks.length > TOP) break;
      const t = await fetchThumbBlock({ imageUrl: r.imageUrl ?? null, thumbUrl: r.thumbnailUrl ?? null });
      if (t.ok) blocks.push(t.block);
    }
    if (blocks.length === 1) blocks.push({ type: "text", text: "No result could be shown. Answer with an empty verdicts list." });
    return blocks;
  },
  parse: (text, input) => [rejudged(input.recipe, parseVerdicts(text), today())],
  finalize(records, ctx) {
    const { recipes, dropped, weak } = mergeRefreshed(currentRecipes(), records);
    ctx.log(`Rejudged ${records.length}; dropped ${dropped.length} under ${KEEP_PRECISION} with a stronger wording on the same key.`);
    if (weak.length > 0) ctx.log(`Keys with no wording at ${KEEP_PRECISION} or more (owner: reword or drop): ${weak.slice(0, 20).join(", ")}${weak.length > 20 ? " ..." : ""}`);
    return recipes;
  },
});
