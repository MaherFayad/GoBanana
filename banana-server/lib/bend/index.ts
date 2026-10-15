import { BendInputError, parseBendInput } from "./input";
import { lensCulture, lensCultureLines } from "../culture/lens";
import { getLens, legacyPart, lensEntries, LISTS, STOP_WORDS } from "./lists";
import { MOVE_DEFS } from "./moves";
import { cyrb53, mulberry32, shuffle, stableId, type Rng } from "./prng";
import { cleanTaste } from "@/lib/taste";
import { allowedOn, PLATFORM_PROFILES, resolvePlatform, type Platform } from "@/lib/platform";
import { weightedOrder } from "@/lib/learning/directions";
import { directionTermKey } from "@/lib/learning/terms";
import { briefComponents, ideaMechanicQuery, inspirationQuery, laneTexts, MAX_FOCUSED_QUERY_WORDS, queryKey } from "./queries";
import { artQueries, buildSpec, fixCase } from "./spec";
import { CLASH_FROM_WILDNESS, detectDomain, MAX_WEIRD, moodClashes, moodFits, noClash, type Domain } from "./tone";
import wildSpotsJson from "./wild-spots.json";
import { extractSubject } from "./subject";
import {
  LEGACY_TEMPLATE_SIZES,
  PAIR_TEMPLATES,
  PROMPT_CLAUSES,
  PROMPT_OPENING,
  canRender,
  render,
  ROLE,
  SINGLE_TEMPLATES,
  TWIST_TEMPLATES,
  type TemplateVars,
} from "./templates";
import {
  MOVES,
  type BendInput,
  type BendResult,
  type Direction,
  type Ingredients,
  type ListEntry,
  type MoveId,
  type WildSpot,
  type Wildness,
} from "./types";
import { WILDNESS } from "./wildness";
import { familyOf } from "./families";
import { briefMarket, LATIN_ONLY_CONSTRAINTS, MARKET_TRADITIONS, needsArabic, WIDER_REGION_FROM_WILDNESS, type Market } from "./market";
import { brokenMustKeep, pickMechanic, protectedElements, type MechanicElement } from "./mechanic";
import { checkCoherence, MAX_COHERENCE_TRIES } from "./coherence";
import { applyBrand, brandLine } from "./brand";

export { parseBendInput, bendInputSchema, BendInputError, MAX_COUNT, DEFAULT_COUNT } from "./input";
export { LENSES, LENS_IDS, LISTS } from "./lists";
export { WILDNESS } from "./wildness";
export { MOVES } from "./types";
export {
  MAX_FOCUSED_QUERY_WORDS,
  MAX_LANE_WORDS,
  briefComponents,
  bridgeQuery,
  componentAppText,
  componentQueries,
  fidelityCoreQuery,
  fidelityQuery,
  barTasteQuery,
  lightTwinQuery,
  ideaMechanicQuery,
  mechanicQuery,
  queryKey,
  ELEMENT_NOUN,
  inspirationFromQuery,
  inspirationQuery,
  isArabicBrief,
  isUiBrief,
  laneTexts,
  localeQuery,
  pickStyle,
  tasteQuery,
  tasteVariants,
  directionTasteVariants,
} from "./queries";
export type { BendInput, BendResult, Direction, MoveId, Wildness, WildSpot } from "./types";
export { detectPlatform, PLATFORM_PROFILES } from "@/lib/platform";
export { fixCase, VERIFIED_STYLE_WORDS } from "./spec";
export { detectDomain } from "./tone";
export { MECHANIC_ELEMENTS, pickMechanic, protectedElements, brokenMustKeep } from "./mechanic";
export type { Mechanic, MechanicElement } from "./mechanic";
export { checkCoherence, MAX_COHERENCE_TRIES } from "./coherence";
export { applyBrand, brandLine, readBrand, BRAND_STRETCHES } from "./brand";
export type { BrandInput, BrandRead, BrandStretch } from "./brand";

/** How many wild spots a result suggests. */
export const WILD_SPOTS_SHOWN = 5;

const WILD_SPOTS: Readonly<Record<Platform, readonly WildSpot[]>> = wildSpotsJson;

/** The top places where one wild page pays off on a platform. */
export function wildSpotsFor(platform: Platform): WildSpot[] {
  return WILD_SPOTS[platform].slice(0, WILD_SPOTS_SHOWN).map((s) => ({ ...s }));
}

/** Hard cap on any search query length, in words (focused queries are capped lower, at MAX_FOCUSED_QUERY_WORDS). */
export const MAX_QUERY_WORDS = 9;
/** Hard cap on title length, in words: a title names the idea, never the brief. */
export const MAX_TITLE_WORDS = 4;
/** Hard cap on twist length, in words (not counting the "Twist:" label). */
export const MAX_TWIST_WORDS = 8;
/** Directions at this wildness and up always carry a twist. */
export const TWIST_FROM_WILDNESS = 3;
/** Bump when lists or rules change in a way that should reshuffle every brief. */
const ENGINE_VERSION = "bend-v1";

/** Every direction is generated up to this many, then sliced to count, so ids stay stable across counts. */
const GENERATED = 8;

function stem(word: string): string {
  const w = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w;
}

function contentStems(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s-]+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .map(stem)
    .filter(Boolean);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Words a clipped title never ends on ("One typeface only, no" becomes "One typeface only"). */
const TITLE_TAIL_STOP = new Set(["a", "an", "the", "and", "or", "of", "for", "to", "with", "in", "on", "at", "by", "no", "per", "one", "every", "all", "only"]);

/** A title cut to MAX_TITLE_WORDS: the part before the first comma, then trailing filler words dropped. */
export function clipTitle(text: string): string {
  const head = (text.split(",")[0] ?? text).trim();
  const ws = head.split(/\s+/).filter(Boolean).slice(0, MAX_TITLE_WORDS);
  while (ws.length > 1 && TITLE_TAIL_STOP.has(ws.at(-1)!.toLowerCase())) ws.pop();
  return ws.join(" ").replace(/[,:;.\s]+$/, "");
}

/** Lenses that fit a brief's market, best first (suggested when no lens is set). */
const LENS_HINTS: readonly [RegExp, readonly string[]][] = [
  [/\b(uae|emirati|emirates|dubai|abu dhabi|sharjah)\b/i, ["talli", "sadu", "mashrabiya"]],
  [/\b(abha|asir|aseer)\b/i, ["qatt-asiri", "najdi", "sadu"]],
  [/\b(jeddah|hejaz|hijaz|makkah|mecca|madinah|medina)\b/i, ["mashrabiya", "qatt-asiri", "kufic"]],
  [/\b(saudi|ksa|riyadh|diriyah|najd|dammam)\b/i, ["najdi", "qatt-asiri", "sadu"]],
  [/\b(kuwait|kuwaiti|bedouin)\b/i, ["sadu", "talli", "kufic"]],
];
const GCC_LENSES = ["sadu", "talli", "qatt-asiri"] as const;

/**
 * Up to 3 lens ids to suggest for a brief that names a Gulf or Arab market or Arabic, when no lens
 * is set: the city or country's own crafts first, else Sadu, talli and Al Qatt Al Asiri. [] otherwise.
 */
export function suggestLenses(brief: string): string[] {
  const hit = LENS_HINTS.find(([re]) => re.test(brief));
  if (hit) return [...hit[1]];
  return needsArabic(brief) ? [...GCC_LENSES] : [];
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k <= 0) return [[]];
  if (k > items.length) return [];
  const out: T[][] = [];
  const walk = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push(acc.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i] as T);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

/**
 * Draws list entries without repeats, and avoids entries that share a word with anything already used.
 * Works on entry keys (the label as first published), so rewording an entry never changes a pick.
 */
class EntryPicker {
  private readonly usedKeys = new Set<string>();
  private readonly usedStems = new Set<string>();
  private readonly usedFamilies = new Set<string>();
  private readonly pools = new Map<string, ListEntry[]>();

  constructor(
    private readonly rng: Rng,
    subjectWords: readonly string[],
    /** Reorders a pool right after its shuffle (ingredient weights). Spends no random draws. */
    private readonly order?: (poolKey: string, shuffled: ListEntry[]) => ListEntry[],
    /** Builds a pool's draw order on first use. Default: one seeded shuffle of the whole list. */
    private readonly build: (poolKey: string, entries: readonly ListEntry[], rng: Rng) => ListEntry[] = (_k, e, r) => shuffle(e, r),
    /**
     * Family of an entry (lib/bend/families.ts): with overlap checks on, a family already used is
     * skipped like a shared word, so one bend never holds two takes on the same core metaphor.
     */
    private readonly familyOf?: (poolKey: string, key: string) => string | undefined,
  ) {
    for (const w of subjectWords) this.usedStems.add(stem(w));
  }

  /** Mark an entry as used without drawing it. */
  exclude(entry: ListEntry): void {
    this.usedKeys.add(entry.key.toLowerCase());
    for (const s of contentStems(entry.key)) this.usedStems.add(s);
  }

  /**
   * Next entry of a pool. `allow` filters entries for the platform, wildness and tone; when it
   * passes everything the pick is exactly what it was before filters existed. When nothing passes,
   * the filter is dropped rather than failing.
   */
  pick(
    poolKey: string,
    entries: readonly ListEntry[],
    checkOverlap: boolean,
    allow?: (e: ListEntry) => boolean,
    /** A rule that never relaxes (the brief's region): when its unused entries run out, one is reused. */
    must?: (e: ListEntry) => boolean,
  ): ListEntry {
    let pool = this.pools.get(poolKey);
    if (!pool) {
      pool = this.build(poolKey, entries, this.rng);
      if (this.order) pool = this.order(poolKey, pool);
      this.pools.set(poolKey, pool);
    }
    const unused = pool.filter((e) => !this.usedKeys.has(e.key.toLowerCase()));
    const kept = must ? unused.filter(must) : unused;
    const allowed = allow ? kept.filter(allow) : kept;
    const reuse = must && kept.length === 0 ? pool.filter(must) : [];
    const fresh = allowed.length > 0 ? allowed : kept.length > 0 ? kept : reuse.length > 0 ? reuse : unused;
    const stemsClear = (e: ListEntry) => contentStems(e.key).every((s) => !this.usedStems.has(s));
    const family = (e: ListEntry) => this.familyOf?.(poolKey, e.key);
    const familyClear = (e: ListEntry) => {
      const f = family(e);
      return !f || !this.usedFamilies.has(f);
    };
    // A family clash only moves the pick when another entry is clear of both; otherwise the old pick stands.
    const clear = checkOverlap ? (fresh.find((e) => stemsClear(e) && familyClear(e)) ?? fresh.find(stemsClear)) : undefined;
    const chosen = clear ?? fresh[0] ?? pool[0];
    if (!chosen) throw new Error(`Empty word list: ${poolKey}`);
    this.exclude(chosen);
    const f = family(chosen);
    if (f) this.usedFamilies.add(f);
    return chosen;
  }
}

/** Rotates through a shuffled order of each template list so one call rarely repeats a template. */
class TemplatePicker {
  private readonly orders = new Map<string, number[]>();
  private readonly cursors = new Map<string, number>();

  constructor(private readonly rng: Rng) {}

  next(key: string, size: number): number {
    let order = this.orders.get(key);
    if (!order) {
      order = shuffle(
        Array.from({ length: size }, (_, i) => i),
        this.rng,
      );
      this.orders.set(key, order);
    }
    const cursor = this.cursors.get(key) ?? 0;
    this.cursors.set(key, cursor + 1);
    return order[cursor % order.length] ?? 0;
  }
}

function seedKey(input: BendInput): string {
  const brief = input.brief.trim().toLowerCase().replace(/\s+/g, " ");
  const moves = input.moves ? [...new Set(input.moves)].sort() : null;
  return JSON.stringify([ENGINE_VERSION, brief, input.wildness, moves, input.lens ?? null]);
}

/** Moves per direction for each slot, before capping by how many moves are allowed. */
function moveCounts(wildness: Wildness, rng: Rng): number[] {
  const [min, max] = WILDNESS[wildness].moves;
  if (min === max) return Array.from({ length: GENERATED }, () => min);
  const first = rng() < 0.5 ? min : max;
  return Array.from({ length: GENERATED }, (_, i) => (i % 2 === 0 ? first : first === min ? max : min));
}

/**
 * bend-v1 shuffled each title template list once, on first use, with the main stream. Spend the
 * same draws so moves and entries (and so direction ids) stay exactly as they were.
 */
function spendLegacyTemplateDraws(moves: readonly MoveId[], seen: Set<string>, rng: Rng): void {
  moves.forEach((m, j) => {
    const key = j === 0 ? `p:${m}` : `m:${m}`;
    if (seen.has(key)) return;
    seen.add(key);
    const size = j === 0 ? LEGACY_TEMPLATE_SIZES.primary[m] : LEGACY_TEMPLATE_SIZES.modifier[m];
    for (let n = size - 1; n > 0; n--) rng();
  });
}

/** Headline strength: lens when a lens preset is set, then transplant, material and era, then lens, scale, constraint. */
function strength(move: MoveId, lensSet: boolean): number {
  if (move === "lens") return lensSet ? 0 : 2;
  if (move === "scale") return 3;
  if (move === "constraint") return 4;
  return 1;
}

/**
 * Split a direction's moves into the headline (one or two moves) and the twist move.
 * Three moves: the two strongest lead and the third is the twist. Two moves: a scale or constraint
 * move becomes the twist, otherwise both lead and the twist comes from a garnish.
 */
export function splitMoves(moves: readonly MoveId[], lensSet: boolean): { headline: MoveId[]; twist: MoveId | null } {
  if (moves.length <= 1) return { headline: [...moves], twist: null };
  const ranked = moves
    .map((m, i) => ({ m, i }))
    .sort((a, b) => strength(a.m, lensSet) - strength(b.m, lensSet) || a.i - b.i)
    .map((x) => x.m);
  if (moves.length === 2 && strength(ranked[1]!, lensSet) < 3) {
    return { headline: moves.slice(), twist: null };
  }
  const lead = ranked.slice(0, moves.length >= 3 ? 2 : 1);
  return { headline: moves.filter((m) => lead.includes(m)), twist: ranked[lead.length] ?? null };
}

/** Pair template key in canonical move order ("transplant+material"). */
function pairKey(a: MoveId, b: MoveId): string {
  return MOVES.indexOf(a) < MOVES.indexOf(b) ? `${a}+${b}` : `${b}+${a}`;
}

/** Options that never come from the tool input. */
export interface BendOptions {
  /**
   * Weight per ingredient term key (`direction|{ingredient}`, lib/learning/directions.ts), from
   * rate_directions feedback. Missing keys weigh 1. Empty or absent: today's picks exactly.
   */
  ingredientWeights?: ReadonlyMap<string, number>;
}

/** The move whose list a pool key names ("materials", "lens:sadu"), or null for moods. */
function poolMove(poolKey: string): MoveId | null {
  if (poolKey.startsWith("lens:")) return "lens";
  return MOVES.find((m) => MOVE_DEFS[m].list === poolKey) ?? null;
}

/** Pool reorder from ingredient weights, or undefined when there are none. */
function ingredientOrder(weights: ReadonlyMap<string, number> | undefined) {
  if (!weights || weights.size === 0) return undefined;
  return (poolKey: string, shuffled: ListEntry[]): ListEntry[] => {
    const move = poolMove(poolKey);
    if (!move) return shuffled;
    return weightedOrder(shuffled, (e) => weights.get(directionTermKey(inspirationQuery(move, e.query))) ?? 1);
  };
}

interface Plan {
  moves: MoveId[];
  picked: ListEntry[];
  mood: ListEntry;
  /** True when the mood clashes with the subject on purpose (wildness 4 and 5). */
  clash: boolean;
}

/** List names whose entries are filtered by platform, wildness and tone. */
const FILTERED_LISTS = new Set(["objects", "materials", "eras", "constraints", "elements", "traditions"]);

/** Components that only name the surface: the platform's own component reads better. */
const SURFACE_COMPONENTS = new Set(["dashboard", "saas dashboard", "analytics dashboard", "landing page", "card", "widget"]);

/** The UI component a direction's signature lands on: the brief's first, else the platform's. */
export function signatureComponent(brief: string, platform: Platform): string {
  const named = briefComponents(brief).find((c) => !SURFACE_COMPONENTS.has(c));
  return named ?? PLATFORM_PROFILES[platform].defaultComponent;
}

/** What the brief says about its market and script (lib/bend/market.ts). */
interface Locale {
  market: Market | null;
  arabic: boolean;
}

/**
 * Entry filter for a list: platform gates, weirdness by wildness, no tone clash below wildness 4,
 * traditions from the brief's market when it names one, and no Latin-only type rules when the
 * design needs Arabic.
 */
function entryFilter(list: string, platform: Platform, wildness: Wildness, domain: Domain | null, locale: Locale) {
  if (!FILTERED_LISTS.has(list)) return undefined;
  // Briefs with no platform keep their bend-v1 picks (and ids) at wildness 3: no weirdness cap there.
  const maxWeird = platform === "any" && wildness === 3 ? 3 : MAX_WEIRD[wildness];
  const region = regionFilter(list, wildness, locale);
  const latinOnly = list === "constraints" && locale.arabic;
  return (e: ListEntry) =>
    allowedOn(platform, list, e.key, e.hints.notOn) &&
    e.hints.weird <= maxWeird &&
    (wildness >= CLASH_FROM_WILDNESS || noClash(e, domain)) &&
    (!region || region(e)) &&
    (!latinOnly || !LATIN_ONLY_CONSTRAINTS.has(e.key));
}

/**
 * The region rule for traditions, which never relaxes (P0-07): a Gulf brief draws Gulf crafts only
 * at wildness 1 to 3 and may add the wider region from WIDER_REGION_FROM_WILDNESS; a wider
 * region brief draws the region. Undefined for other lists and briefs with no market.
 */
function regionFilter(list: string, wildness: Wildness, locale: Locale): ((e: ListEntry) => boolean) | undefined {
  if (list !== "traditions" || !locale.market) return undefined;
  const set = locale.market === "gulf" && wildness < WIDER_REGION_FROM_WILDNESS ? MARKET_TRADITIONS.gulf : MARKET_TRADITIONS.mena;
  return (e) => set.has(e.key);
}

/** Clean page names: trimmed, single spaces, at most 3, no repeats. */
export function cleanPages(pages: readonly string[] | undefined): string[] {
  const out: string[] = [];
  for (const p of pages ?? []) {
    const t = p.trim().replace(/\s+/g, " ");
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, 3);
}

/** "a, b and c". */
export function joinList(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * Turn a plain brief into wild design directions. Rule-based and deterministic:
 * the same brief, wildness, moves and lens always give the same directions, and
 * a larger count only appends directions. With `options.ingredientWeights` (rate_directions
 * feedback) ingredients agents keep dropping come up less often; the same weights give the same
 * directions.
 * Throws BendInputError with a plain message on invalid input; tools should call
 * parseBendInput first.
 */
export function bendBrief(raw: BendInput, options: BendOptions = {}): BendResult {
  const parsed = parseBendInput(raw);
  if (!parsed.ok) throw new BendInputError(parsed.message);
  const input = parsed.input;
  // Style words for the taste lane: the user's own only. Never part of the seed, so they never move an id.
  const taste = cleanTaste(raw.taste);
  const wildness = input.wildness;
  const platform = resolvePlatform(input.brief, input.platform);
  const profile = PLATFORM_PROFILES[platform];
  const pages = cleanPages(input.pages);
  const domain = detectDomain(input.brief);
  const wildSpots = pages.length > 0 ? [] : wildSpotsFor(platform);
  const rule = WILDNESS[wildness];
  const lens = input.lens ? getLens(input.lens) : undefined;

  const key = seedKey(input);
  const rng = mulberry32(cyrb53(key));
  const subject = extractSubject(input.brief, wildness);
  // Briefs with no platform draw each list's bend-v1 entries first (in their old shuffled order,
  // on the main stream), then the newer ones (own stream), so their ids stay as they were.
  // Briefs with a platform shuffle the whole list.
  const buildPool = (poolKey: string, list: readonly ListEntry[], r: Rng): ListEntry[] => {
    if (platform !== "any" || poolKey.startsWith("lens:")) return shuffle(list, r);
    const legacy = legacyPart(poolKey, list);
    const extra = list.slice(legacy.length);
    return [...shuffle(legacy, r), ...shuffle(extra, mulberry32(cyrb53(`${key}|more|${poolKey}`)))];
  };
  // Briefs with a platform also skip a second object of the same family (lib/bend/families.ts);
  // briefs with none keep their bend-v1 picks and ids.
  const entries = new EntryPicker(rng, subject.words, ingredientOrder(options.ingredientWeights), buildPool, platform === "any" ? undefined : familyOf);
  const locale: Locale = { market: briefMarket(input.brief), arabic: needsArabic(input.brief) };

  // Allowed moves, in canonical order. A lens preset forces the lens move into every direction.
  const allowed: MoveId[] = MOVES.filter((m) => !input.moves || input.moves.includes(m));
  if (lens && !allowed.includes("lens")) allowed.push("lens");
  const forced: MoveId | null = lens ? "lens" : null;
  const free = allowed.filter((m) => m !== forced);

  const moveRank = new Map(shuffle(MOVES, rng).map((m, i) => [m, i]));
  const usage = new Map<MoveId, number>();
  const primaryUsage = new Map<MoveId, number>();
  const comboCache = new Map<number, MoveId[][]>();
  const usedCombos = new Set<string>();

  const combosFor = (k: number): MoveId[][] => {
    let combos = comboCache.get(k);
    if (!combos) {
      if (forced) {
        const restSize = Math.min(k - 1, free.length);
        combos = combinations(free, restSize).map((c) => [...c, forced]);
      } else {
        combos = combinations(free, Math.min(k, free.length));
      }
      combos = shuffle(combos, rng);
      comboCache.set(k, combos);
    }
    return combos;
  };

  const pickCombo = (k: number): MoveId[] => {
    const combos = combosFor(k);
    let open = combos.filter((c) => !usedCombos.has(c.join("+")));
    if (open.length === 0) {
      for (const c of combos) usedCombos.delete(c.join("+"));
      open = combos;
    }
    let best = open[0] ?? [];
    let bestScore = Infinity;
    for (const c of open) {
      const score = c.reduce((n, m) => n + (usage.get(m) ?? 0), 0);
      if (score < bestScore) {
        best = c;
        bestScore = score;
      }
    }
    usedCombos.add(best.join("+"));
    for (const m of best) usage.set(m, (usage.get(m) ?? 0) + 1);
    return best;
  };

  /** Primary move first, constraint always last (it reads best as a closing rule). */
  const orderCombo = (combo: MoveId[]): MoveId[] => {
    const leaders = combo.length > 1 ? combo.filter((m) => m !== "constraint") : combo;
    const rank = (m: MoveId) => (primaryUsage.get(m) ?? 0) * 10 + (moveRank.get(m) ?? 0);
    const primary = leaders.slice().sort((a, b) => rank(a) - rank(b))[0] ?? combo[0]!;
    primaryUsage.set(primary, (primaryUsage.get(primary) ?? 0) + 1);
    const rest = combo
      .filter((m) => m !== primary)
      .sort((a, b) => {
        if (a === "constraint") return 1;
        if (b === "constraint") return -1;
        return (moveRank.get(a) ?? 0) - (moveRank.get(b) ?? 0);
      });
    return [primary, ...rest];
  };

  const lensList: ListEntry[] = lens ? lensEntries(lens) : [];
  const counts = moveCounts(wildness, rng);

  // Pass 1, on the main stream: moves and list entries. Ids come from this pass only.
  const plans: Plan[] = [];
  const legacySeen = new Set<string>();
  for (let i = 0; i < GENERATED; i++) {
    const moves = orderCombo(pickCombo(counts[i] ?? 1));
    const picked: ListEntry[] = moves.map((m) => {
      if (m === "lens" && lens) return entries.pick(`lens:${lens.id}`, lensList, false);
      const def = MOVE_DEFS[m];
      return entries.pick(def.list, LISTS[def.list], true, entryFilter(def.list, platform, wildness, domain, locale), regionFilter(def.list, wildness, locale));
    });
    // bend-v1 drew the mood here. Briefs with no platform still make that draw (a shadow pick, not
    // shown) so later picks and ids do not move; the shown mood is matched to the subject below.
    if (platform === "any") entries.pick("moods", legacyPart("moods", LISTS.moods), true);
    spendLegacyTemplateDraws(moves, legacySeen, rng);
    plans.push({ moves, picked, mood: LISTS.moods[0]!, clash: false });
  }

  // Moods, on their own stream: matched to the subject's tone. At wildness 4 and 5 the third
  // direction clashes on purpose. Moods are not part of ids.
  const moodPicker = new EntryPicker(mulberry32(cyrb53(`${key}|mood`)), subject.words);
  for (const p of plans) for (const e of p.picked) moodPicker.exclude(e);
  plans.forEach((p, i) => {
    const clashSlot = wildness >= CLASH_FROM_WILDNESS && domain !== null && i === 2;
    p.mood = moodPicker.pick("moods", LISTS.moods, true, (e) => (clashSlot ? moodClashes(e, domain) : moodFits(e, domain)));
    p.clash = moodClashes(p.mood, domain);
  });

  // Pass 2, on its own stream: headline, twist, query and prompt. Changing words here never moves an id.
  const style = mulberry32(cyrb53(`${key}|style`));
  const garnish = new EntryPicker(style, subject.words);
  for (const p of plans) for (const e of [...p.picked, p.mood]) garnish.exclude(e);
  const templates = new TemplatePicker(style);
  const garnishUse = new Map<MoveId, number>();
  const titles = new Set<string>();
  const directions: Direction[] = [];
  // Must-keeps (the agent's, plus a clear total and one primary action for a brief that pays):
  // a direction whose ingredients break one is dropped; a mechanic never reskins a protected total
  // or main button. Never part of the seed, so ids never move.
  const protect = protectedElements(input.brief, input.mustKeep ?? []);
  const mechanicUse = new Map<MechanicElement, number>();
  /** Query keys (queryKey) earlier directions already search: no two directions share one. */
  const usedQueries = new Set<string>();
  const sigComponent = signatureComponent(input.brief, platform);

  /** First template in rotation that fits the word cap and is not taken, or null. */
  const fit = (rotationKey: string, list: readonly string[], vars: TemplateVars, maxWords: number, taken?: Set<string>): string | null => {
    for (let n = 0; n < list.length; n++) {
      const template = list[templates.next(rotationKey, list.length)]!;
      if (!canRender(template, vars)) continue;
      const text = render(template, vars);
      if (wordCount(text) <= maxWords && !taken?.has(text.toLowerCase())) return text;
    }
    return null;
  };
  /** First title template, in list order (the plainest first), that fits the cap and is not taken, or null. */
  const fitTitle = (list: readonly string[], vars: TemplateVars): string | null => {
    for (const template of list) {
      if (!canRender(template, vars)) continue;
      const text = render(template, vars);
      if (wordCount(text) <= MAX_TITLE_WORDS && !titles.has(text.toLowerCase())) return text;
    }
    return null;
  };
  /** Shortest rendering of a list; the last resort, so output never goes missing. */
  const shortest = (list: readonly string[], vars: TemplateVars): string =>
    list.filter((t) => canRender(t, vars)).map((t) => render(t, vars)).sort((x, y) => wordCount(x) - wordCount(y) || x.localeCompare(y))[0] ?? "";

  plans.forEach((plan, i) => {
    const { moves, picked, mood, clash } = plan;
    const ingredients: Ingredients = { mood: mood.label };
    const vars: TemplateVars = { subj: subject.title, head: subject.head, m: mood.label };
    moves.forEach((m, j) => {
      const entry = picked[j];
      if (!entry) return;
      ingredients[MOVE_DEFS[m].slot] = entry.label;
      vars[ROLE[m]] = entry.label;
      if (entry.leads) vars[`${ROLE[m]}lead`] = entry.label;
    });

    const split = splitMoves(moves, Boolean(lens));
    let headline = split.headline;
    let twistSource: MoveId | "mood" | null = split.twist;

    // Title: the headline pair, at most 10 words, never repeated in one call. When no pair template
    // fits, the strongest move leads alone and the other one becomes the twist if there is none yet.
    let title: string | null = null;
    const [h1, h2] = headline;
    if (h1 && h2) {
      title = fitTitle(PAIR_TEMPLATES[pairKey(h1, h2)] ?? [], vars);
      if (!title) {
        const lensSet = Boolean(lens);
        const [lead, other] = strength(h2, lensSet) < strength(h1, lensSet) ? [h2, h1] : [h1, h2];
        headline = [lead];
        twistSource ??= other;
      }
    }
    if (!title) {
      const lead = headline[0] ?? moves[0]!;
      title = fitTitle(SINGLE_TEMPLATES[lead], vars);
      // Nothing fits in 4 words: the idea itself, clipped; then another ingredient; then the mood.
      const clipped = [lead, ...moves.filter((m) => m !== lead)]
        .map((m) => clipTitle(shortest(SINGLE_TEMPLATES[m], vars)))
        .concat(clipTitle(`${mood.label} ${clipTitle(shortest(SINGLE_TEMPLATES[lead], vars))}`));
      title ??= clipped.find((t) => t && !titles.has(t.toLowerCase())) ?? clipped[0]!;
    }
    titles.add(title.toLowerCase());

    // Twist: the leftover move, else a constraint or scale garnish the moves filter allows, else the mood.
    let twistEntry: ListEntry | null = twistSource ? (picked[moves.indexOf(twistSource)] ?? null) : null;
    let garnishMove: MoveId | null = null;
    if (!twistSource && wildness >= TWIST_FROM_WILDNESS) {
      const options = (["constraint", "scale"] as const).filter((m) => allowed.includes(m) && !moves.includes(m));
      const ranked = shuffle(options, style).sort((x, y) => (garnishUse.get(x) ?? 0) - (garnishUse.get(y) ?? 0));
      garnishMove = ranked[0] ?? null;
      if (garnishMove) {
        garnishUse.set(garnishMove, (garnishUse.get(garnishMove) ?? 0) + 1);
        const def = MOVE_DEFS[garnishMove];
        twistEntry = garnish.pick(def.list, LISTS[def.list], true, entryFilter(def.list, platform, wildness, domain, locale));
        ingredients[def.slot] = twistEntry.label;
        vars[ROLE[garnishMove]] = twistEntry.label;
        twistSource = garnishMove;
      } else {
        twistSource = "mood";
      }
    }
    const twistList = twistSource ? TWIST_TEMPLATES[twistSource] : [];
    const twist = twistSource
      ? (fit(`t:${twistSource}`, twistList, vars, MAX_TWIST_WORDS) ?? shortest(twistList, vars))
      : "";

    const promptMoves = garnishMove ? [...moves, garnishMove] : moves;
    const scope =
      pages.length > 0
        ? `Use it only on the ${joinList(pages)}, one or two pages, not the whole product.`
        : `Use it on one or two pages, such as the ${wildSpots[0]?.page ?? "first screen"}, not the whole product.`;
    const prompt = fixCase(
      [
        render(PROMPT_OPENING, { ...vars, subj: subject.full }),
        ...promptMoves.map((m) => render(PROMPT_CLAUSES[m], vars)),
        `Mood: ${mood.label}.`,
        platform === "any" ? "Built for any screen." : `Built for a ${profile.label}.`,
        scope,
        rule.hint,
      ].join(" "),
    );

    // The direction's idea: the lead headline ingredient, raw. It is never searched raw (search is
    // UI only); it feeds the bridge lane and the notes.
    const lead = headline[0] ?? moves[0]!;
    const searchQuery = inspirationQuery(lead, picked[moves.indexOf(lead)]!.query);
    const id = stableId(`${key}|${i}|${moves.join("+")}|${picked.map((e) => e.key).join("|")}`);
    if (brokenMustKeep(ingredients, protect)) return;
    const leadEntry = picked[moves.indexOf(lead)]!;
    const byMove: Partial<Record<MoveId, ListEntry>> = {};
    moves.forEach((m, j) => {
      if (picked[j]) byMove[m] = picked[j];
    });
    if (garnishMove && twistEntry) byMove[garnishMove] = twistEntry;
    // One spec engine (P0-08): the mechanic first, then the spec written on it. While the result
    // fails checkCoherence (with the directions before it), the mechanic moves to the next part,
    // at most MAX_COHERENCE_TRIES draws. Ingredients never change, so ids never move.
    const draw = (attempt: number) => {
      const mech = pickMechanic({
        lead,
        entry: leadEntry,
        others: promptMoves.filter((m) => m !== lead).map((m) => ({ move: m, entry: (m === garnishMove ? twistEntry : picked[moves.indexOf(m)])! })).filter((o) => o.entry),
        protect,
        used: mechanicUse,
        attempt,
      });
      const sp = buildSpec({
        profile,
        moves: promptMoves,
        entries: byMove,
        lead,
        mood,
        clash,
        domain,
        subject: subject.title,
        component: sigComponent,
        arabic: locale.arabic,
        mechanic: mech.element,
        page: pages[0] ?? subject.title,
      });
      return { mechanic: mech, spec: sp };
    };
    let drawn = draw(0);
    for (let attempt = 1; attempt < MAX_COHERENCE_TRIES; attempt++) {
      if (checkCoherence({ id, moves, ingredients, searchQuery, ...drawn }, directions).length === 0) break;
      drawn = draw(attempt);
    }
    const { mechanic, spec } = drawn;
    mechanicUse.set(mechanic.element, (mechanicUse.get(mechanic.element) ?? 0) + 1);
    const searchQueries = takeQueries(
      phase0Queries({ brief: input.brief, idea: searchQuery, taste, id, platform, styleWords: spec.styleWords, pages, element: mechanic.element, rule: lead === "constraint" }),
      usedQueries,
    );

    directions.push({
      id,
      move: moves.join(" + "),
      moves,
      title: fixCase(title),
      twist: fixCase(twist),
      searchQuery,
      searchQueries,
      prompt,
      ingredients,
      platform,
      pages: [...pages],
      spec,
      artQueries: artQueries(promptMoves, byMove, lead, mood),
      mechanic,
    });
  });

  return applyBrand(
    {
      brief: input.brief,
      subject: fixCase(subject.title),
      wildness,
      wildnessLabel: rule.label,
      lens: lens ? { id: lens.id, name: lens.name, arabicFont: lens.arabicFont, culture: lensCulture(lens) } : null,
      suggestedLenses: lens ? [] : suggestLenses(input.brief),
      platform,
      pages,
      wildSpots,
      directions: directions.slice(0, input.count),
    },
    input.brand,
  );
}

/**
 * A direction's Phase 0 query candidates (P0-05), best first, plus the brief's page lanes
 * (fidelity) that run once per canvas as the baseline and so never become a direction query:
 * the mechanic lane, the idea on its part (not for a rule), the bridge, taste, the brief's other
 * component lane and locale.
 */
export function phase0Queries(input: {
  brief: string;
  idea: string;
  taste: readonly string[];
  id: string;
  platform: Platform;
  styleWords: readonly string[];
  pages: readonly string[];
  element: string;
  /** True when a constraint (a rule) leads: no "idea on its part" query. */
  rule: boolean;
}): { own: (string | null | undefined)[]; shared: Set<string> } {
  const lanes = laneTexts(input.brief, input.idea, input.taste, input.id, {
    platform: input.platform,
    styleWords: input.styleWords,
    pages: input.pages,
    mechanic: input.element,
  });
  const own = [
    lanes.component?.[0],
    input.rule ? null : ideaMechanicQuery(input.idea, input.element),
    lanes.bridge ?? `${input.idea} interface`,
    lanes.taste,
    ...(lanes.component ?? []).slice(1),
    lanes.locale,
  ];
  const shared = new Set([lanes.fidelity, lanes.fidelityCore].filter(Boolean).map((q) => queryKey(q!)));
  return { own, shared };
}

/**
 * P0-05: a direction's queries are its own. Candidates over the word cap, the brief's page lanes
 * (`shared`) and a query an earlier direction of this bend already has (`used`, any word order)
 * are dropped; the kept ones are added to `used`.
 */
export function takeQueries(c: { own: readonly (string | null | undefined)[]; shared: ReadonlySet<string> }, used: Set<string>): string[] {
  const out: string[] = [];
  for (const q of c.own) {
    if (!q || wordCount(q) > MAX_FOCUSED_QUERY_WORDS) continue;
    const k = queryKey(q);
    if (c.shared.has(k) || used.has(k)) continue;
    used.add(k);
    out.push(q);
  }
  return out;
}

/** Strip a spec line's closing period so lines can be joined compactly. */
const bare = (line: string) => line.replace(/\.$/, "");

/**
 * Compact text listing of a bend result for the agent: platform, pages and wild spots, then one
 * entry per direction: "1. Title (Twist: ...) [move + move] query: ...", the id and prompt, the
 * visual spec and the art queries.
 */
export function formatDirections(result: BendResult): string {
  const lensNote = result.lens ? `, lens: ${result.lens.name.en}` : "";
  const lensLine = result.lens
    ? `Lens ${result.lens.name.en} (${result.lens.name.ar}). Arabic display font: ${result.lens.arabicFont.family} (${result.lens.arabicFont.url}).`
    : result.suggestedLenses.length > 0
      ? `This brief names an Arab or Gulf market and no lens is set. Try bend_brief again with lens ${result.suggestedLenses.map((l) => `"${l}"`).join(", ")} to pull a real local craft into every direction.`
      : "";
  const profile = PLATFORM_PROFILES[result.platform];
  const lines = [
    `${result.directions.length} directions for "${result.brief}" (wildness ${result.wildness}, ${result.wildnessLabel}${lensNote}):`,
    `Platform: ${result.platform} (${profile.label}). Each direction is for one wild page or two, not the product's main design.`,
  ];
  if (lensLine) lines.push(lensLine);
  if (result.lens) lines.push(...lensCultureLines(result.lens.culture));
  const brand = brandLine(result.brand);
  if (brand) lines.push(brand);
  if (result.pages.length > 0) lines.push(`Pages: ${result.pages.join(", ")}.`);
  else if (result.wildSpots.length > 0) {
    lines.push("Pages: none given. Where weirdness pays off (wildSpots):");
    for (const s of result.wildSpots) lines.push(`- ${s.page}: ${s.why}`);
  }
  lines.push("");
  result.directions.forEach((d, i) => {
    const twist = d.twist ? ` (Twist: ${d.twist})` : "";
    const sp = d.spec;
    lines.push(`${i + 1}. ${d.title}${twist} [${d.move}] query: ${d.searchQuery}`);
    lines.push(`   id: ${d.id}. Prompt: ${d.prompt}`);
    lines.push(`   Mechanic: build this direction around ${d.mechanic.element} = ${bare(d.mechanic.how)}. Search for UI that has this element.`);
    lines.push(
      `   Spec: type ${sp.typeVoice}: ${bare(sp.typography)} | color: ${bare(sp.color)} | layout: ${bare(sp.layout)} | imagery: ${bare(sp.imagery)} | motion: ${bare(sp.motion)} | texture: ${bare(sp.texture)} | icons: ${bare(sp.iconography)} | density: ${bare(sp.density)}`,
    );
    lines.push(
      `   Signature: ${bare(sp.signature)}. Pattern: ${bare(sp.pattern)}. Steal: ${sp.steal.map(bare).join("; ")}. Avoid: ${sp.avoid.map(bare).join("; ")}. Style words: ${sp.styleWords.join(", ")}. Why: ${bare(sp.whyItFits)}.`,
    );
    lines.push(`   Art queries: ${d.artQueries.join("; ")}`);
  });
  lines.push(
    "",
    "Build each direction around its mechanic: that element is where the wild idea works as a real part of the page; keep everything else familiar. When you search, look for UI that has this element (for example 'flight checkout progress bar app ui').",
    "Next: call search_references with a direction id (after saving to a canvas) or a direction's query to pull UI references and art direction images (the art queries). Pick the directions that excite the user, or bend again at a different wildness.",
  );
  return lines.join("\n");
}
