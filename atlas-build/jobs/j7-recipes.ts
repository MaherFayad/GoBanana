/**
 * P1-J7 query recipes (the search fix). About 4,000 QueryRecipe records:
 *
 *   - 6 wordings for each J1 page and platform pair (lane "baseline"), worded from the page's id and
 *     names with the winners of docs/search-quality-experiment.md round 13;
 *   - 3 art wordings for each J3 card (lane "art"), the card's own artQueries.
 *
 * Each wording is tested: one Serper image search (1 credit, scoped to the recipe's source) and the
 * top 8 item-page thumbnails fetched into memory (never to disk), then one judge call with vision
 * gives a verdict per image against docs/taste-bar.md and the exemplar notes in
 * data/j7-taste-notes.md (written from banana-server/bench/taste/picks.json by `npx tsx j7-taste.ts`).
 * Only wordings and scores are stored, never results or images.
 *
 * Precision = share judged good or great (the QueryRecipe meaning). Per key the best 2 wordings
 * with precision of 0.5 or more are kept; keys with none are dropped and logged for the owner.
 *
 *   npx tsx run.ts j7-recipes --dry                       # inputs, estimate, budget check; nothing spent
 *   npx tsx run.ts j7-recipes --limit 5                   # a real trial (5 Serper credits)
 *   npx tsx run.ts j7-recipes --offset 0 --limit 300      # a chunk; then --offset 300, and so on
 *   npx tsx run.ts j7-recipes --from-raw                  # rebuild the whole output from saved replies
 *
 * Inputs are ordered by value, so a chunked run spends credits where they matter first: bench pages
 * (pages.json "from: bench"), then the other pages, then the art wordings. A real run refuses to
 * start when its slice would take the Serper account under SERPER_FLOOR (2,500 by default, SERPER_FLOOR overrides; the product's own
 * runtime credits), and logs every search to serper.csv next to costs.csv. Build the final output
 * with --from-raw after the last chunk (a chunk's own output only covers that chunk).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { recipeId, recipeKeyString } from "../../banana-server/lib/atlas/loader.ts";
import { topicTemplate } from "../../banana-server/lib/atlas/recipe-fit.ts";
import { GENRES, GENRE_LANE, GENRE_NEG, GENRE_PROFILES, type Genre } from "../../banana-server/lib/sources/genre.ts";
import { isItemPage } from "../../banana-server/lib/sources/item-page.ts";
import { SOURCE_REGISTRY } from "../../banana-server/lib/sources/registry.ts";
import { SHOWCASE_STYLES } from "../../banana-server/lib/sources/showcase.ts";
import { JUDGE, PATHS, ROOT } from "../config.ts";
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob, placeholderImage, type JobContext } from "../lib/job.ts";
import { SERPER_FLOOR, creditRoom, logCredits, serperBalance, serperImageSearch } from "../lib/serper.ts";
import { fetchThumbBlock } from "../lib/thumbs.ts";
import { QueryRecipeSchema, type IngredientCard, type PageAnatomy, type Platform, type QueryRecipe } from "../schema.ts";
import { KEEP_PRECISION, TOP, parseVerdicts, rejudged } from "./j7-refresh.ts";

/** Wordings per page and platform pair, and per card. */
export const PAGE_WORDINGS = 6;
export const ART_WORDINGS = 3;
/** Kept per key. */
export const KEEP_PER_KEY = 2;
/** A recipe judged on fewer results than this says too little about its wording. */
export const MIN_JUDGED = 4;
/** The server caps a recipe's words (lib/atlas/search.ts uiOk). */
export const MAX_WORDS = 7;

/** Copied from banana-server/lib/sources/plan.ts (that file needs the "@/" alias): the server's negatives. */
export const UI_NEG = "-template -kit -free -wireframe";
export const ART_NEG = "-etsy -amazon -aliexpress -sale -buy";
const CORE_SOURCES = new Set(["pinterest", "dribbble", "behance"]);

export type Wording = { query: string; source: string };

export type PageInput = { kind: "page"; key: QueryRecipe["key"]; wording: Wording; context: string; priority: number };
export type ArtInput = { kind: "art"; key: QueryRecipe["key"]; wording: Wording; context: string; priority: number };
/** A genre lane wording (banana-server lib/sources/genre.ts): key lane "deck" or "brand", page = the kind's slug. */
export type GenreInput = { kind: "genre"; key: QueryRecipe["key"]; wording: Wording; context: string; priority: number };
export type Input = PageInput | ArtInput | GenreInput;

/** Wordings per genre kind. */
export const GENRE_WORDINGS = 4;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The wordings of one genre kind, best first, at most GENRE_WORDINGS: the kind's own wordings as the
 * server words them with no subject (core sites with the genre's default style, galleries plain),
 * then the genre's lead gallery with the kind's keyword, then the first core wording without the
 * style word. No negatives here: searchQueryFor adds GENRE_NEG on core sites.
 */
export function genreKindWordings(genre: Genre, keyword: string, count = GENRE_WORDINGS): Wording[] {
  const p = GENRE_PROFILES[genre];
  const kind = p.kinds.find((k) => k.keyword === keyword);
  if (!kind) return [];
  const fill = (t: string, style: string) => t.replace("{style}", style).replace("{s}", "").replace(/\s+/g, " ").trim();
  const core = (site: string) => CORE_SOURCES.has(site);
  const out: Wording[] = [];
  const seen = new Set<string>();
  const push = (source: string, query: string) => {
    const k = `${source}|${query.toLowerCase()}`;
    if (!query || seen.has(k) || words(query).length > MAX_WORDS || out.length >= count) return;
    seen.add(k);
    out.push({ source, query });
  };
  for (const w of kind.wordings) push(w.site, fill(w.text, core(w.site) ? (p.defaultStyle ?? "") : "") || keyword);
  if (p.galleries[0]) push(p.galleries[0], keyword);
  const firstCore = kind.wordings.find((w) => core(w.site));
  if (firstCore) push(firstCore.site, fill(firstCore.text, ""));
  return out;
}

/** Every genre lane input, kinds in profile order, appended after the page and art inputs (priority 4). */
export function genreInputs(): GenreInput[] {
  const out: GenreInput[] = [];
  for (const genre of GENRES) {
    const p = GENRE_PROFILES[genre];
    for (const kind of p.kinds) {
      const key: QueryRecipe["key"] = { lane: GENRE_LANE[genre], page: slug(kind.keyword) };
      for (const wording of genreKindWordings(genre, kind.keyword)) {
        out.push({ kind: "genre", key, wording, priority: 4, context: `${p.label}: the "${kind.keyword}" kind (a ${GENRE_LANE[genre]} lane, not a screen)` });
      }
    }
  }
  return out;
}

type PageLike = Pick<PageAnatomy, "id" | "names" | "queryNouns" | "platforms">;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const norm = (s: string) => ` ${s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;

/**
 * The page phrases a wording is built from. p0 is the page id as words, which the server needs in
 * the query (lib/atlas/search.ts `holds`). p1 is a longer synonym that contains p0 ("onboarding
 * screen"), else p0 again.
 */
export function pagePhrases(page: PageLike): { p0: string; p1: string } {
  const p0 = page.id.replace(/-/g, " ");
  const alt = [...page.queryNouns, ...page.names.en].find((n) => norm(n).includes(norm(p0)) && norm(n) !== norm(p0));
  return { p0, p1: alt ? alt.toLowerCase().trim() : p0 };
}

/**
 * Candidate wordings per platform, best first. They follow round 13 of the search experiment:
 * Pinterest "{page} ui ios app" and "dark ..." win on mobile, Dribbble "dark mode minimal ..." on
 * web apps, gallery sites on websites. Never "2025", "product design", "saas" or "single screen".
 */
export function candidateWordings(platform: Platform, p0: string, p1: string): Wording[] {
  const w = (source: string, query: string): Wording => ({ source, query });
  switch (platform) {
    case "mobile":
      return [
        w("pinterest", `dark ${p0} ui ios app`),
        w("pinterest", `${p0} ui ios app`),
        w("dribbble", `dark mode minimal ${p0} app ui`),
        w("pinterest", `dark ${p1} ui ios app`),
        w("dribbble", `${p0} app ui`),
        w("pinterest", `${p1} app design`),
        w("dribbble", `minimal ${p1} app ui`),
        w("pinterest", `${p0} app design`),
        w("behance", `${p0} app ui`),
        w("pinterest", `dark mode ${p0} app ui`),
      ];
    case "tablet":
      return [
        w("pinterest", `dark ${p0} ui ipad app`),
        w("pinterest", `${p0} ui ipad app`),
        w("dribbble", `dark mode minimal ${p0} ipad app ui`),
        w("pinterest", `dark ${p1} ui ipad app`),
        w("dribbble", `${p0} ipad app ui`),
        w("pinterest", `${p1} ipad app design`),
        w("dribbble", `minimal ${p1} ipad app ui`),
        w("behance", `${p0} ipad app ui`),
        w("pinterest", `${p0} tablet app design`),
      ];
    case "webapp":
      return [
        w("dribbble", `dark mode minimal ${p0} ui`),
        w("dribbble", `dark ${p0} web app ui`),
        w("dribbble", `${p0} ui`),
        w("pinterest", `dark mode ${p0} ui`),
        w("dribbble", `dark mode minimal ${p1} ui`),
        w("dribbble", `minimal ${p0} web app ui`),
        w("pinterest", `${p0} web app ui`),
        w("behance", `${p0} web app ui`),
        w("dribbble", `${p1} web app ui`),
      ];
    case "website":
      return [
        w("awwwards", p0),
        w("siteinspire", p0),
        w("lapa", p0),
        w("dribbble", `dark minimal ${p0} website ui`),
        w("pinterest", `${p0} website design`),
        w("dribbble", `${p0} website ui`),
        w("awwwards", p1),
        w("behance", `${p0} website design`),
        w("lapa", p1),
      ];
  }
}

/** The 6 wordings of one page and platform pair: candidates in order, no repeats, at most 7 words. */
export function pageWordings(page: PageLike, platform: Platform, count = PAGE_WORDINGS): Wording[] {
  const { p0, p1 } = pagePhrases(page);
  const seen = new Set<string>();
  const out: Wording[] = [];
  for (const c of candidateWordings(platform, p0, p1)) {
    const k = `${c.source}|${c.query.toLowerCase()}`;
    if (seen.has(k) || words(c.query).length > MAX_WORDS) continue;
    seen.add(k);
    out.push(c);
    if (out.length === count) break;
  }
  return out;
}

/** The art sources: Pinterest, Behance, Pinterest (the server's art lane searches those two). */
const ART_SOURCES = ["pinterest", "behance", "pinterest"] as const;

/** The 3 art wordings of a card: its own artQueries, in order, no repeats. */
export function artWordings(card: Pick<IngredientCard, "artQueries">, count = ART_WORDINGS): Wording[] {
  const seen = new Set<string>();
  const out: Wording[] = [];
  for (const q of card.artQueries) {
    const query = q.trim().replace(/\s+/g, " ");
    if (!query || seen.has(query.toLowerCase()) || words(query).length > 8) continue;
    seen.add(query.toLowerCase());
    out.push({ query, source: ART_SOURCES[out.length % ART_SOURCES.length]! });
    if (out.length === count) break;
  }
  return out;
}

/**
 * Web showcase styles J7 judges per website page (2026-10-16, owner request: "too fun", 3D and
 * motion-led award sites). Their keys carry `style`, so they never compete with a page's plain
 * baseline wordings and the server does not read them until a lane asks for a style.
 */
export const SHOWCASE_RECIPE_STYLES = ["playful", "3d", "webgl", "animation"] as const;

/**
 * The wordings of one website page in one showcase style: Awwwards "{style} {page}" and "{style}
 * {page} website", and Dribbble "{style} {page} website ui". The style's page-free phrase
 * ("playful illustration", lib/sources/showcase.ts) is not judged here: its results are the same
 * for every page. Craftwork is never a J7 source: its license bars testing AI models on its previews.
 */
export function showcaseWordings(p0: string, styleId: string): Wording[] {
  const style = SHOWCASE_STYLES.find((s) => s.id === styleId);
  if (!style) return [];
  const out: Wording[] = [
    { source: "awwwards", query: `${style.id} ${p0}` },
    { source: "awwwards", query: `${style.id} ${p0} website` },
    { source: "dribbble", query: `${style.id} ${p0} website ui` },
  ];
  return out.filter((w) => words(w.query).length <= MAX_WORDS);
}

export type PageMeta = { id: string; from?: string };

/**
 * Pure: every input in value order. Bench pages first (pages.json "from: bench"), then the other
 * pages; within a page every platform, all wordings together so a key completes; then the art
 * wordings in card order.
 */
export function buildInputs(
  pages: readonly PageLike[],
  meta: readonly PageMeta[],
  cards: readonly Pick<IngredientCard, "id" | "name" | "texture" | "imagery" | "artQueries">[],
  genre: readonly GenreInput[] = [],
): Input[] {
  const from = new Map(meta.map((m) => [m.id, m.from ?? ""]));
  const rank = (id: string) => (from.get(id) === "bench" ? 0 : from.get(id) === "wild-spots" ? 1 : 2);
  const ordered = pages.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p.id) - rank(b.p.id) || a.i - b.i);
  const out: Input[] = [];
  for (const { p } of ordered) {
    for (const platform of p.platforms) {
      const key: QueryRecipe["key"] = { lane: "baseline", page: p.id, platform };
      for (const wording of pageWordings(p, platform)) {
        out.push({ kind: "page", key, wording, priority: rank(p.id), context: `the ${p.names.en[0] ?? p.id} page (${p.id}) on ${platform}` });
      }
    }
  }
  for (const c of cards) {
    const key: QueryRecipe["key"] = { lane: "art", cardId: c.id };
    for (const wording of artWordings(c)) {
      out.push({ kind: "art", key, wording, priority: 3, context: `the ingredient card "${c.name}" (texture: ${c.texture}; imagery: ${c.imagery})` });
    }
  }
  // Web showcase wordings go last, so chunked runs (--offset) keep their old positions.
  for (const { p } of ordered) {
    if (!p.platforms.includes("website")) continue;
    const { p0 } = pagePhrases(p);
    for (const style of SHOWCASE_RECIPE_STYLES) {
      const key: QueryRecipe["key"] = { lane: "baseline", page: p.id, platform: "website", style };
      for (const wording of showcaseWordings(p0, style)) {
        out.push({
          kind: "page",
          key,
          wording,
          priority: 4,
          context: `the ${p.names.en[0] ?? p.id} page (${p.id}) on website, in a ${style} web showcase style: award-level sites like Awwwards Sites of the Year, where the ${style} look is the point`,
        });
      }
    }
  }
  // Genre lanes last, so the offsets of a chunked run over pages and art stay as they were.
  out.push(...genre);
  return out;
}

const isGenreLane = (lane: QueryRecipe["key"]["lane"]) => lane === "deck" || lane === "brand";

/** The stable request id of one wording: [a-zA-Z0-9_-], under 64 characters. */
export function requestIdOf(input: Pick<Input, "key" | "wording">): string {
  const h = createHash("sha1").update(`${recipeKeyString(input.key)}|${input.wording.source}|${input.wording.query.toLowerCase()}`).digest("hex").slice(0, 20);
  return `${input.key.lane === "art" ? "ar" : isGenreLane(input.key.lane) ? "gn" : "pg"}-${h}`;
}

/** The Serper query for a wording: its words, the server's negatives on core and art searches, the source's site scope. */
export function searchQueryFor(input: Pick<Input, "key" | "wording">): string {
  const { query, source } = input.wording;
  const entry = (SOURCE_REGISTRY as readonly { id: string; scope: string }[]).find((s) => s.id === source);
  const neg = input.key.lane === "art" ? ART_NEG : !CORE_SOURCES.has(source) ? "" : isGenreLane(input.key.lane) ? GENRE_NEG : UI_NEG;
  return [query, neg, entry ? `site:${entry.scope}` : ""].filter(Boolean).join(" ");
}

/**
 * Gate 2 round 2: a kept page recipe becomes a template with a topic slot ("{topic} pricing page
 * website ui"), which the server fills with the brief's product noun (lib/atlas/recipe-fit.ts). Art
 * and genre recipes, and recipes with no page, are unchanged. The precision stays the page wording's.
 * Only full-text sources (Pinterest, Dribbble, Behance) get the slot: a gallery's own search finds
 * almost nothing for a topic phrase (run 2026-10-16g2g: "coffee shop landing page" on SiteInspire and
 * "analytics SaaS pricing page" on Awwwards kept 0 results), so a gallery recipe stays page-only and
 * the topic guard keeps the Phase 0 lane.
 */
export function withTopicSlot(recipe: QueryRecipe, pages: ReadonlyMap<string, PageLike>): QueryRecipe {
  const lane = recipe.key.lane;
  if (lane === "art" || isGenreLane(lane) || !recipe.key.page || !CORE_SOURCES.has(recipe.source)) return recipe;
  const page = pages.get(recipe.key.page);
  const { p0, p1 } = page ? pagePhrases(page) : { p0: recipe.key.page.replace(/-/g, " "), p1: recipe.key.page.replace(/-/g, " ") };
  return { ...recipe, query: topicTemplate(recipe.query, [p1, p0]) };
}

export type Ranked = { recipe: QueryRecipe; great: number };

/**
 * Pure: the best KEEP_PER_KEY wordings per key with precision of KEEP_PRECISION or more. Order inside
 * a key: precision, then great verdicts (the bar), then more judged, then the wording. Keys with no
 * wording at the line are returned in `weak`.
 */
export function selectBest(ranked: readonly Ranked[], keep = KEEP_PER_KEY): { recipes: QueryRecipe[]; weak: string[] } {
  const byKey = new Map<string, Ranked[]>();
  for (const r of ranked) {
    const k = recipeKeyString(r.recipe.key);
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  const recipes: QueryRecipe[] = [];
  const weak: string[] = [];
  for (const [k, list] of byKey) {
    const strong = list
      .filter((r) => r.recipe.precision >= KEEP_PRECISION)
      .sort((a, b) => b.recipe.precision - a.recipe.precision || b.great - a.great || b.recipe.judged - a.recipe.judged || a.recipe.query.localeCompare(b.recipe.query));
    if (strong.length === 0) weak.push(k);
    recipes.push(...strong.slice(0, keep).map((r) => r.recipe));
  }
  return { recipes, weak };
}

// ---------------------------------------------------------------------------------------------
// Judge prompt.

function readIf(file: string): string {
  return existsSync(file) ? readFileSync(file, "utf8").trim() : "";
}

const SYSTEM = `You judge image search results for GoBanana's query recipes. A recipe is a search wording that should find design references at the owner's taste bar for one page on one platform (a UI lane), or the raw look of one ingredient card (the art lane: a texture, material, object, print or poster to steal palette, shape or rhythm from).

You get the recipe, then the top results as numbered images, in rank order. Give one verdict per image:
- great: reaches the taste bar below AND fits the recipe (the right page on the right platform for a UI lane; the right subject for the art lane).
- good: fits the recipe and is usable, but below the bar.
- bad: does not fit (wrong page, wrong platform, a UI kit, a button or component sheet, a stock illustration, a listicle or promo graphic, a shop listing, an unrelated app or subject) or is far below the bar.

Answer with JSON only: {"verdicts": ["great" | "good" | "bad", ...]}, exactly one verdict per image, in the order shown. No other text.

The taste bar:

${readIf(join(ROOT, "..", "docs", "taste-bar.md"))}

What the owner's exemplar pins show (notes written from the picked exemplars, banana-server/bench/taste/):

${readIf(join(ROOT, "data", "j7-taste-notes.md")) || "(no exemplar notes yet: run `npx tsx j7-taste.ts`)"}

Genre lanes (a "deck" or "brand" recipe) are not screens: a deck recipe should find presentation slides (pitch decks, keynote slides, data slides, editorial report layouts) and a brand recipe identity work (logo systems, brand guidelines, posters, packaging, type-led work), judged by the "Presentation" and "Branding" sections of the taste bar above. For them a screen or app UI is bad, and so is a template sales sheet or a mockup pack.

${GENRES.map((g) => `What the owner's ${g} exemplars show:\n\n${readIf(join(ROOT, "data", `j7-taste-notes-${g}.md`)) || `(no ${g} notes yet: run \`npx tsx j7-taste.ts --genre ${g}\`)`}`).join("\n\n")}`;

// ---------------------------------------------------------------------------------------------
// Serper and thumbnails: in memory only, fetched a few wordings ahead of the request loop.

const LOOKAHEAD = 4;
const SEARCH_GAP_MS = 230; // Serper allows 5 searches a second
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Shown = { blocks: Anthropic.ContentBlockParam[]; shown: number };

let queue: Array<{ id: string; input: Input }> = [];
let lastIndex = -1;
let nextSearchAt = 0;
let creditsLeft: number | null = null;
const inflight = new Map<string, Promise<Shown>>();

async function searchAndFetch(id: string, input: Input, ctx: JobContext): Promise<Shown> {
  if (creditsLeft !== null && creditsLeft <= 0) throw new Error("Serper credit room used up (floor reached): stop and top up the account");
  const wait = Math.max(0, nextSearchAt - Date.now());
  nextSearchAt = Math.max(nextSearchAt, Date.now()) + SEARCH_GAP_MS;
  if (wait > 0) await sleep(wait);
  let images;
  try {
    images = await serperImageSearch(searchQueryFor(input));
  } catch (e) {
    ctx.log(`  search failed for ${id}: ${e instanceof Error ? e.message : String(e)}`);
    return { blocks: [], shown: 0 };
  }
  logCredits("j7-recipes", id, images.credits);
  if (creditsLeft !== null) creditsLeft -= images.credits;
  const site = input.wording.source;
  const cands = images.images.filter((r) => {
    try {
      return !r.link || isItemPage(new URL(r.link), site as never);
    } catch {
      return false;
    }
  });
  const fetched = await Promise.all(cands.slice(0, TOP + 2).map((r) => fetchThumbBlock({ imageUrl: r.imageUrl ?? null, thumbUrl: r.thumbnailUrl ?? null })));
  const blocks: Anthropic.ContentBlockParam[] = [];
  let n = 0;
  for (const t of fetched) {
    if (!t.ok || n >= TOP) continue;
    n++;
    blocks.push({ type: "text", text: `Image ${n}:` }, t.block);
  }
  return { blocks, shown: n };
}

function prefetch(id: string, input: Input, ctx: JobContext): Promise<Shown> {
  let p = inflight.get(id);
  if (!p) {
    p = searchAndFetch(id, input, ctx);
    inflight.set(id, p);
    p.catch(() => undefined); // surfaced when buildPrompt awaits it
  }
  return p;
}

function recipeHead(input: Input): string {
  const k = input.key;
  const lane = k.lane === "art" ? "art lane" : isGenreLane(k.lane) ? `genre lane (${k.lane}: ${k.lane === "deck" ? "presentation design" : "graphic and branding design"})` : k.style ? `UI lane (web showcase: a website page in the ${k.style} style)` : "UI lane (baseline: a page and platform)";
  return `Recipe: ${lane}. Judge for ${input.context}. Wording "${input.wording.query}", searched on ${input.wording.source}. The top results follow.`;
}

// ---------------------------------------------------------------------------------------------

const today = () => new Date().toISOString().slice(0, 10);
const great = new Map<string, number>();
let loadedKeys = new Set<string>();

function loadPages(): { pages: PageAnatomy[]; meta: PageMeta[] } {
  const pages = readKindRecords<PageAnatomy>("anatomy");
  const file = join(ROOT, "data", "pages.json");
  const meta = existsSync(file) ? ((JSON.parse(readFileSync(file, "utf8")) as { pages: PageMeta[] }).pages ?? []) : [];
  return { pages, meta };
}

export default defineJob<Input, QueryRecipe>({
  id: "j7-recipes",
  kind: "recipes",
  model: JUDGE,
  mode: "batch",
  schema: QueryRecipeSchema,
  system: SYSTEM,
  maxTokens: 400,
  expectedOutputTokens: 100,
  effort: "low",
  // Measured 2026-10-16 on 8 exemplar thumbnails per call: about 100 tokens per image. 200 keeps a margin.
  imageTokens: 200,

  async loadInputs(ctx) {
    const { pages, meta } = loadPages();
    const cards = readKindRecords<IngredientCard>("cards");
    const all = buildInputs(pages, meta, cards, genreInputs());
    loadedKeys = new Set(all.map((i) => recipeKeyString(i.key)));
    const by = (f: (i: Input) => boolean) => all.filter(f).length;
    ctx.log(`Inputs: ${all.length} wordings (${by((i) => i.kind === "page")} for ${new Set(all.filter((i) => i.kind === "page").map((i) => recipeKeyString(i.key))).size} page and platform pairs, ${by((i) => i.kind === "art")} art wordings for ${new Set(all.filter((i) => i.kind === "art").map((i) => i.key.cardId)).size} cards). Serper credits needed: ${all.length}.`);
    queue = all.map((input) => ({ id: requestIdOf(input), input }));

    const run = ctx.run;
    if (!ctx.dry && run && !run.fromRaw) {
      const end = run.limit === undefined ? all.length : Math.min(all.length, run.offset + run.limit);
      lastIndex = end - 1;
      const need = Math.max(0, end - run.offset);
      const balance = await serperBalance();
      const room = creditRoom(balance);
      ctx.log(`Serper: ${balance} credits on the account, floor ${SERPER_FLOOR}, room for ${room} searches; this run needs ${need}.`);
      if (need > room) {
        throw new Error(`Serper floor: ${need} searches would take the account from ${balance} to ${balance - need}, under the ${SERPER_FLOOR} the product keeps. Room for ${room}: lower --limit, or top up the account.`);
      }
      creditsLeft = room;
    }
    return all;
  },
  requestId: (input) => requestIdOf(input),

  async buildPrompt(input, ctx) {
    const head: Anthropic.TextBlockParam = { type: "text", text: recipeHead(input) };
    if (ctx.dry) return [head, ...Array.from({ length: TOP }, () => placeholderImage())];
    const id = requestIdOf(input);
    const at = queue.findIndex((q) => q.id === id);
    for (let i = at; i >= 0 && i <= Math.min(at + LOOKAHEAD, lastIndex); i++) prefetch(queue[i]!.id, queue[i]!.input, ctx);
    const shown = await prefetch(id, input, ctx);
    inflight.delete(id);
    if (shown.shown === 0) return [head, { type: "text", text: "No result could be shown. Answer with an empty verdicts list." }];
    return [head, ...shown.blocks];
  },

  parse(text, input) {
    const verdicts = parseVerdicts(text);
    const base: QueryRecipe = { key: input.key, query: input.wording.query, source: input.wording.source, precision: 0, judged: 0, at: today() };
    const rec = rejudged(base, verdicts, today());
    great.set(recipeId(rec), verdicts.filter((v) => v === "great").length);
    return [rec];
  },
  check(record) {
    const problems: string[] = [];
    if (record.judged < MIN_JUDGED) problems.push(`judged only ${record.judged} results (need ${MIN_JUDGED})`);
    if (words(record.query).length > MAX_WORDS && record.key.lane !== "art") problems.push(`query has more than ${MAX_WORDS} words`);
    return problems;
  },

  finalize(records, ctx) {
    const { recipes, weak } = selectBest(records.map((recipe) => ({ recipe, great: great.get(recipeId(recipe)) ?? 0 })));
    const unjudged = [...loadedKeys].filter((k) => !records.some((r) => recipeKeyString(r.key) === k));
    ctx.log(`Judged wordings: ${records.length}. Kept ${recipes.length} (best ${KEEP_PER_KEY} per key at ${KEEP_PRECISION} or more).`);
    ctx.log(`Keys dropped (no wording at ${KEEP_PRECISION} or more): ${weak.length}. Keys never judged in this output: ${unjudged.length}.`);
    mkdirSync(PATHS.review, { recursive: true });
    writeFileSync(join(PATHS.review, "j7-recipes-dropped.json"), JSON.stringify({ weak: weak.sort(), unjudged: unjudged.sort() }, null, 2) + "\n");
    if (weak.length > 0) ctx.log(`  owner: reword or drop these (full list in review/j7-recipes-dropped.json): ${weak.slice(0, 15).join(", ")}${weak.length > 15 ? " ..." : ""}`);
    const byId = new Map(loadPages().pages.map((p) => [p.id, p]));
    const out = recipes.map((r) => withTopicSlot(r, byId));
    ctx.log(`Topic slot: ${out.filter((r, i) => r.query !== recipes[i]!.query).length} page recipes are templates ("{topic} ...").`);
    return out;
  },
  shardOf: () => "all",
  renderReview: (r) =>
    `<p><b>${esc(r.query)}</b> on ${esc(r.source)}</p><p>${esc(recipeKeyString(r.key))} | precision ${r.precision} of ${r.judged} | ${esc(r.at)}</p>`,
});

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
