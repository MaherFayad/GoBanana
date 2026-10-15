/**
 * Bend engine v2 (P1-I2): directions from the Banana Atlas instead of word lists. Rule based and
 * deterministic, no AI: the same brief, wildness, moves and lens over the same Atlas give the same
 * directions. Behind BEND_ENGINE=atlas (default "lists" until Gate 2).
 *
 * Pipeline (docs/next-step-plan.md section 6.5):
 *   1. Parse the brief into a domain (J2), a page (J1) and a product noun.
 *   2. Candidate cards with a fit of 2 or more for the domain; fit 1 at wildness 4 and 5; the
 *      domain's clash families only at 5.
 *   3. Pick by diversity (MMR over family and kind), honoring moves, lens and Gulf-first.
 *   4. Clash check between the lead card and the card that adds texture or motion.
 *   5. The mechanic for the page's wild spot element (J5 plus the card's J4 lines).
 *   6. The spec from the lead card; a second card adds only texture or motion.
 *   7. Queries from recipes (J7), the Phase 0 lanes after them.
 *
 * The output keeps the lists engine's shape (skills keep working) plus cardIds, mechanicId and
 * recipeIds. It returns null whenever the Atlas cannot answer (a page or domain it does not know,
 * too few cards, a shard it could not read): the caller then runs the lists engine.
 */
import type { TypeVoice, VisualSpec } from "@/lib/direction-detail";
import { isTypeVoice } from "@/lib/direction-detail";
import { directionTermKey } from "@/lib/learning/terms";
import { PLATFORM_PROFILES, resolvePlatform, type Platform } from "@/lib/platform";
import { cleanTaste } from "@/lib/taste";
import { checkCoherence, MAX_COHERENCE_TRIES } from "@/lib/bend/coherence";
import { cleanPages, clipTitle, joinList, MAX_TITLE_WORDS, MAX_TWIST_WORDS, phase0Queries, suggestLenses, takeQueries, TWIST_FROM_WILDNESS, wildSpotsFor, type BendOptions } from "@/lib/bend/index";
import { BendInputError, parseBendInput } from "@/lib/bend/input";
import { applyBrand } from "@/lib/bend/brand";
import { getLens } from "@/lib/bend/lists";
import { briefMarket, needsArabic, WIDER_REGION_FROM_WILDNESS } from "@/lib/bend/market";
import { brokenMustKeep, protectedElements, type Mechanic as DirectionMechanic, type MechanicElement } from "@/lib/bend/mechanic";
import { cyrb53, stableId } from "@/lib/bend/prng";
import { fixCase, PART, UI_WORDS, VERIFIED_STYLE_WORDS } from "@/lib/bend/spec";
import { extractSubject } from "@/lib/bend/subject";
import type { BendInput, BendResult, Direction, Ingredients, MoveId } from "@/lib/bend/types";
import { WILDNESS } from "@/lib/bend/wildness";
import { recipeId } from "./loader";
import type { AtlasSource } from "./source";
import type { CardElementLine, DomainEntry, FitScore, IngredientCard, Mechanic, PageAnatomy, QueryRecipe, UiElement } from "./types";

const ENGINE_VERSION = "atlas-v1";
/** Directions generated before slicing to count, as the lists engine does. */
const GENERATED = 8;
/** Most candidate cards read per bend (the best fits first). */
export const MAX_CANDIDATES = 40;
/** MMR: how much a repeated family or kind costs against relevance. */
const LAMBDA = 1;
/** Relevance a Gulf tradition gains on a Gulf brief (Gulf-first, P0-07). */
const GULF_BONUS = 0.5;
/** A bend needs at least this many lead cards (or `count` when smaller), else lists. */
const MIN_LEADS = 3;
/** The fallback subrequest budget the tool gives a bend (lib/atlas/loader.ts COST). */
export const BEND_SHARD_BUDGET = 40;

/** Atlas elements the direction's mechanic field can carry (lib/bend/mechanic.ts elements). */
export const ELEMENT_TO_MECHANIC: Readonly<Partial<Record<UiElement, MechanicElement>>> = {
  progress: "progress",
  stepper: "progress",
  total: "total",
  "price-breakdown": "total",
  cta: "cta",
  "paywall-plan": "cta",
  divider: "divider",
  "nav-tabs": "section-nav",
  "section-nav": "section-nav",
  "bottom-nav": "section-nav",
  header: "header",
  hero: "header",
  "empty-state": "empty-state",
  success: "empty-state",
};
/** Elements tried after the page's wild spots, safest first. */
const FALLBACK_ELEMENTS: readonly UiElement[] = ["header", "divider", "progress", "section-nav", "empty-state", "hero", "total", "cta"];

/** The move a card kind plays (lib/bend/moves.ts). */
export const KIND_MOVE: Readonly<Record<IngredientCard["kind"], MoveId>> = {
  object: "transplant",
  element: "transplant",
  material: "material",
  era: "era",
  tradition: "lens",
  constraint: "constraint",
  scale: "scale",
};
const KIND_SLOT: Readonly<Record<IngredientCard["kind"], Exclude<keyof Ingredients, "mood">>> = {
  object: "object",
  element: "element",
  material: "material",
  era: "era",
  tradition: "tradition",
  constraint: "constraint",
  scale: "element",
};

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
const words = (s: string) => s.split(/\s+/).filter(Boolean);
const has = (hay: string, phrase: string) => phrase.trim() !== "" && norm(hay).includes(norm(phrase));

/** The page a brief (or the first page given) names: the longest matching name wins. */
export function parsePage(text: string, pages: readonly PageAnatomy[]): PageAnatomy | null {
  let best: { page: PageAnatomy; score: number } | null = null;
  for (const page of pages) {
    for (const name of [...page.names.en, page.id.replace(/-/g, " ")]) {
      if (!has(text, name)) continue;
      const score = words(name).length;
      if (!best || score > best.score) best = { page, score };
    }
    for (const name of page.names.ar) if (name && text.includes(name) && !best) best = { page, score: 1 };
  }
  return best?.page ?? null;
}

/** The domain a brief names: product nouns count double, then the longest name. */
export function parseDomain(text: string, domains: readonly DomainEntry[]): { domain: DomainEntry; productNoun: string | null } | null {
  let best: { domain: DomainEntry; productNoun: string | null; score: number } | null = null;
  for (const domain of domains) {
    let score = 0;
    let noun: string | null = null;
    for (const p of domain.productNouns) {
      if (has(text, p)) {
        score = Math.max(score, 2 + words(p).length);
        noun ??= p;
      }
    }
    for (const n of domain.names.en) if (has(text, n)) score = Math.max(score, words(n).length);
    for (const n of domain.names.ar) if (n && text.includes(n)) score = Math.max(score, 1);
    if (score > 0 && (!best || score > best.score)) best = { domain, productNoun: noun, score };
  }
  return best ? { domain: best.domain, productNoun: best.productNoun } : null;
}

/** The product noun as the brief writes it ("eSIM", not "esim"). */
function briefCasing(brief: string, noun: string): string {
  const at = brief.toLowerCase().indexOf(noun.toLowerCase());
  return at >= 0 ? brief.slice(at, at + noun.length) : noun;
}

/** True when the card's avoid list names the other card (its name or family). */
export function clashes(a: IngredientCard, b: IngredientCard): boolean {
  const hit = (x: IngredientCard, y: IngredientCard) => x.avoid.some((av) => has(av, y.name) || has(av, y.family));
  return hit(a, b) || hit(b, a);
}

/** Family and kind overlap between two cards, for MMR. */
function similarity(a: IngredientCard, b: IngredientCard): number {
  return (a.family === b.family ? 1 : 0) + (a.kind === b.kind ? 0.4 : 0);
}

/** A seeded number in [0, 1) per card, so ties break the same way for the same brief. */
const jitter = (key: string, id: string) => (cyrb53(`${key}|${id}`) % 1000) / 1000;

interface Pick {
  lead: IngredientCard;
  second: IngredientCard | null;
  /** What the second card adds. */
  adds: "texture" | "motion" | null;
}

/** The Atlas elements a direction's mechanic may land on, wild spots first. */
function elementOrder(page: PageAnatomy, protect: ReadonlySet<MechanicElement>): UiElement[] {
  const risky = (el: UiElement) => {
    const m = ELEMENT_TO_MECHANIC[el];
    return m !== undefined && (m === "total" || m === "cta") && protect.has(m);
  };
  const out: UiElement[] = [];
  for (const el of [...page.wildSpots.map((w) => w.element), ...FALLBACK_ELEMENTS]) {
    if (ELEMENT_TO_MECHANIC[el] && !risky(el) && !out.includes(el)) out.push(el);
  }
  return out;
}

/** A spec sentence: acronyms fixed, first letter up, one closing period. */
function sentence(text: string): string {
  const t = fixCase(text.trim()).replace(/[.\s]+$/, "");
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}.`;
}

const ICONS: Record<IngredientCard["radius"], string> = {
  none: "Square line icons with sharp corners, 2px stroke",
  small: "Line icons with small corner radius, 1.5px stroke",
  soft: "Soft rounded line icons, 1.5px stroke",
  round: "Round filled icons",
};

/** Relative luminance of a hex color, 0 dark to 1 light. */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1]!, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

/** 1 to 3 verified style words from the card (VERIFIED_STYLE_WORDS only). */
function cardStyleWords(card: IngredientCard, voice: TypeVoice): string[] {
  const out: string[] = [];
  const surface = card.palette.find((p) => p.role === "surface");
  if (surface && luminance(surface.hex) < 0.2) out.push("dark mode");
  if (/\bgrain|grainy|paper|print\b/i.test(card.texture)) out.push("grainy");
  if (voice === "serif-editorial" || voice === "serif-classic") out.push("editorial");
  if (voice === "mono" || voice === "condensed") out.push("big typography");
  if (card.density === "airy") out.push("minimal");
  if (card.palette.length <= 2) out.push("monochrome");
  const kept = [...new Set(out)].filter((w) => VERIFIED_STYLE_WORDS.includes(w)).slice(0, 3);
  return kept.length > 0 ? kept : ["minimal"];
}

interface SpecInput {
  pick: Pick;
  platform: Platform;
  arabic: boolean;
  element: MechanicElement;
  mechanic: Mechanic | null;
  how: string;
  pageLabel: string;
  why: string;
}

/** The visual spec from the lead card (P1-I2 step 6). */
export function cardSpec(input: SpecInput): VisualSpec {
  const { lead, second, adds } = input.pick;
  const profile = PLATFORM_PROFILES[input.platform];
  const voice: TypeVoice = isTypeVoice(lead.type.voice) ? lead.type.voice : "grotesk";
  const role = (r: IngredientCard["palette"][number]["role"]) => lead.palette.find((p) => p.role === r);
  const colors = (["surface", "ink", "accent", "support"] as const)
    .map((r) => role(r))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => `${p.role} ${p.hex.toUpperCase()}`);
  const pairs = lead.shipPairs.slice(0, 2).map(([fg, bg]) => `${fg.toUpperCase()} on ${bg.toUpperCase()}`);
  const motionCard = adds === "motion" && second ? second : lead;
  const textureCard = adds === "texture" && second ? second : lead;
  const part = PART[input.element];
  const grid = profile.gridShort ? ` on ${profile.gridShort}` : "";
  return {
    typography: sentence(
      `${lead.type.latin.display} for display at ${profile.display}, ${lead.type.latin.body} for body at ${profile.body}` +
        (input.arabic ? `; Arabic in ${lead.type.arabic.display} and ${lead.type.arabic.body} at the same sizes, right to left` : ""),
    ),
    typeVoice: voice,
    color: sentence(`Palette from ${lead.name}: ${colors.join(", ")}${pairs.length ? `; ship pairs ${pairs.join(", ")}` : ""}; text at 4.5 to 1 or more`),
    layout: sentence(`${lead.name} carries the ${part}, the ${input.pageLabel} keeps its usual order around it${grid}`),
    imagery: sentence(lead.imagery),
    motion: sentence(`${motionCard.motion.verb} in ${motionCard.motion.ms}ms${motionCard !== lead ? ` (from ${motionCard.name})` : ""}; with reduced motion on, ${motionCard.motion.reduced}`),
    texture: sentence(`${textureCard.texture}${textureCard !== lead ? ` (from ${textureCard.name})` : ""}; text sits on solid panels, never on the texture`),
    iconography: sentence(input.platform === "mobile" ? `${ICONS[lead.radius]}, 24pt in the tab bar` : ICONS[lead.radius]),
    density: sentence(`${lead.density.charAt(0).toUpperCase()}${lead.density.slice(1)}; ${profile.density.charAt(0).toLowerCase()}${profile.density.slice(1)}`),
    signature: sentence(input.how),
    pattern: sentence(`${lead.name} on the ${part}${input.mechanic ? `: ${input.mechanic.name}` : ""}`),
    steal: [
      `The palette of ${lead.name}: ${lead.palette.map((p) => p.name).join(", ")}`,
      `The surface: ${textureCard.texture}`,
      `The imagery: ${lead.imagery}`,
    ].map(sentence),
    avoid: [...lead.avoid.slice(0, 2), ...profile.avoid.slice(0, 1)].slice(0, 3).map(sentence),
    styleWords: cardStyleWords(lead, voice),
    whyItFits: sentence(input.why),
  };
}

/** True when a UI lane query holds the product noun or the page's noun phrase (P0-16). */
function holdsNoun(query: string, productNoun: string | null, page: PageAnatomy): boolean {
  const nouns = [...(productNoun ? [productNoun] : []), ...page.queryNouns, ...page.names.en];
  return nouns.some((n) => has(query, n));
}

/** Best recipe (precision, then judged) among the keys in order of specificity. */
function bestRecipe(byKey: ReadonlyMap<string, QueryRecipe[]>, keys: readonly QueryRecipe["key"][], ok: (r: QueryRecipe) => boolean, skip: ReadonlySet<string>): QueryRecipe | null {
  for (const key of keys) {
    const list = (byKey.get(JSON.stringify(normKey(key))) ?? [])
      .filter((r) => ok(r) && !skip.has(recipeId(r)))
      .sort((a, b) => b.precision - a.precision || b.judged - a.judged || a.query.localeCompare(b.query));
    if (list[0]) return list[0];
  }
  return null;
}

/** A recipe key with its fields in one order and no empty fields, for lookups. */
function normKey(key: QueryRecipe["key"]): QueryRecipe["key"] {
  return {
    lane: key.lane,
    ...(key.page ? { page: key.page } : {}),
    ...(key.platform ? { platform: key.platform } : {}),
    ...(key.element ? { element: key.element } : {}),
    ...(key.cardId ? { cardId: key.cardId } : {}),
  };
}

/** The Atlas platform for a server platform ("any" has none). */
const atlasPlatform = (p: Platform): QueryRecipe["key"]["platform"] => (p === "any" ? undefined : p);

/**
 * Directions from the Atlas, or null when it cannot answer (the caller runs the lists engine).
 * Throws BendInputError on invalid input, like bendBrief.
 */
export async function bendBriefAtlas(raw: BendInput, source: AtlasSource, options: BendOptions = {}): Promise<BendResult | null> {
  const parsed = parseBendInput(raw);
  if (!parsed.ok) throw new BendInputError(parsed.message);
  const input = parsed.input;
  const taste = cleanTaste(raw.taste);
  const wildness = input.wildness;
  const rule = WILDNESS[wildness];
  const platform = resolvePlatform(input.brief, input.platform);
  const profile = PLATFORM_PROFILES[platform];
  const pagesIn = cleanPages(input.pages);
  const subject = extractSubject(input.brief, wildness);
  const lens = input.lens ? getLens(input.lens) : undefined;
  const market = briefMarket(input.brief);
  const arabic = needsArabic(input.brief);
  const key = JSON.stringify([ENGINE_VERSION, input.brief.trim().toLowerCase().replace(/\s+/g, " "), wildness, input.moves ? [...new Set(input.moves)].sort() : null, input.lens ?? null]);

  // 1. Brief to page, domain and product noun.
  const [pages, domains] = [await source.pages(), await source.domains()];
  if (!pages || !domains) return null;
  const page = parsePage(pagesIn[0] ?? input.brief, pages) ?? (pagesIn[0] ? parsePage(input.brief, pages) : null);
  const parsedDomain = parseDomain(input.brief, domains);
  if (!page || !parsedDomain) return null;
  const { domain } = parsedDomain;
  const productNoun = parsedDomain.productNoun ? briefCasing(input.brief, parsedDomain.productNoun) : subject.head;
  const pageLabel = pagesIn[0] ?? page.names.en[0] ?? page.id.replace(/-/g, " ");

  // 2. Candidates by fit.
  const fit = await source.fit(domain.id);
  if (!fit) return null;
  const minFit = wildness >= 4 ? 1 : 2;
  const fitOf = new Map<string, FitScore>(fit.map((f) => [f.cardId, f]));
  const candidateIds = fit
    .filter((f) => f.score >= minFit)
    .sort((a, b) => b.score - a.score || jitter(key, a.cardId) - jitter(key, b.cardId))
    .slice(0, MAX_CANDIDATES)
    .map((f) => f.cardId);
  const cardMap = await source.cards(candidateIds);
  if (!cardMap) return null;
  const allowedMoves = new Set<MoveId>(input.moves ?? ["transplant", "material", "era", "constraint", "scale", "lens"]);
  const protect = protectedElements(input.brief, input.mustKeep ?? []);
  const lensTerms = lens ? [lens.id.replace(/-/g, " "), lens.name.en, ...lens.terms] : [];
  const isLensCard = (c: IngredientCard) => c.kind === "tradition" && (c.id.includes(lens?.id ?? "\u0000") || lensTerms.some((t) => has(c.name, t) || has(t, c.name)));
  const regionOk = (c: IngredientCard) => {
    if (c.kind !== "tradition" || !market) return true;
    if (market === "gulf" && wildness < WIDER_REGION_FROM_WILDNESS) return c.region === "gulf";
    return c.region === "gulf" || c.region === "mena";
  };
  const cards = candidateIds
    .map((id) => cardMap.get(id))
    .filter((c): c is IngredientCard => Boolean(c))
    .filter((c) => (lens && isLensCard(c)) || (allowedMoves.has(KIND_MOVE[c.kind]) && regionOk(c)))
    .filter((c) => wildness >= 5 || !domain.clashFamilies.includes(c.family))
    .filter((c) => !brokenMustKeep({ mood: "", [KIND_SLOT[c.kind]]: c.name }, protect));

  // 3. MMR by family and kind; learning weights and Gulf-first scale relevance.
  const relevance = (c: IngredientCard) => {
    const base = (fitOf.get(c.id)?.score ?? 0) / 3 + 0.3 * jitter(key, c.id);
    const gulf = market === "gulf" && c.kind === "tradition" && c.region === "gulf" ? GULF_BONUS : 0;
    const weight = options.ingredientWeights?.get(directionTermKey(c.name.toLowerCase())) ?? 1;
    return (base + gulf) * weight;
  };
  const mmr = (pool: IngredientCard[], n: number, chosen: IngredientCard[] = []): IngredientCard[] => {
    const left = [...pool];
    const out: IngredientCard[] = [];
    while (out.length < n && left.length > 0) {
      let bestI = 0;
      let bestScore = -Infinity;
      left.forEach((c, i) => {
        const sim = Math.max(0, ...[...chosen, ...out].map((s) => similarity(c, s)));
        const score = relevance(c) - LAMBDA * sim;
        if (score > bestScore + 1e-9) {
          bestScore = score;
          bestI = i;
        }
      });
      out.push(left.splice(bestI, 1)[0]!);
    }
    return out;
  };
  const lensCards = lens ? cards.filter(isLensCard) : [];
  if (lens && lensCards.length === 0) return null;
  const nonLens = cards.filter((c) => !lensCards.includes(c));
  const leadsLens = mmr(lensCards, GENERATED);
  const leads = [...leadsLens, ...mmr(nonLens, GENERATED - leadsLens.length, leadsLens)].slice(0, GENERATED);
  if (leads.length < Math.min(input.count, MIN_LEADS)) return null;

  // 4. The second card (texture or motion) and the clash check.
  const usedSecond = new Set<string>();
  const picks: Pick[] = leads.map((lead, i) => {
    const wantsSecond = wildness >= TWIST_FROM_WILDNESS || (lens && !isLensCard(lead));
    if (!wantsSecond) return { lead, second: null, adds: null };
    const adds: Pick["adds"] = i % 2 === 0 ? "texture" : "motion";
    const pool = (lens && !isLensCard(lead) ? lensCards : cards).filter((c) => c.id !== lead.id && !leads.includes(c) && !clashes(lead, c));
    const pool2 = pool.length > 0 ? pool : (lens && !isLensCard(lead) ? lensCards : []).filter((c) => c.id !== lead.id);
    const ranked = [...pool2].sort(
      (a, b) =>
        Number(usedSecond.has(a.id)) - Number(usedSecond.has(b.id)) ||
        Number(a.family === lead.family) - Number(b.family === lead.family) ||
        jitter(`${key}|second|${i}`, a.id) - jitter(`${key}|second|${i}`, b.id),
    );
    const second = ranked[0] ?? null;
    if (second) usedSecond.add(second.id);
    return { lead, second, adds: second ? (lens && !isLensCard(lead) ? "texture" : adds) : null };
  });

  // 5. Mechanics: the page's wild spot elements, by the lead card's lines, spread over the bend.
  const lines = await source.lines(leads.map((c) => c.id));
  if (!lines) return null;
  const lineOf = new Map<string, CardElementLine>(lines.map((l) => [`${l.cardId}|${l.element}`, l]));
  const order = elementOrder(page, protect);
  if (order.length === 0) return null;
  const mechanicsByElement = new Map<UiElement, Mechanic[]>();
  const mechanicsFor = async (el: UiElement): Promise<Mechanic[] | null> => {
    if (!mechanicsByElement.has(el)) {
      const list = await source.mechanics(el);
      if (!list) return null;
      mechanicsByElement.set(el, list);
    }
    return mechanicsByElement.get(el)!;
  };
  const elementUse = new Map<MechanicElement, number>();
  const usedMechanics = new Set<string>();
  const ranked = (lead: IngredientCard) =>
    order
      .map((el, idx) => ({
        el,
        score: (lineOf.get(`${lead.id}|${el}`)?.buildability ?? 2) + Math.max(0, 3 - idx) - 2 * (elementUse.get(ELEMENT_TO_MECHANIC[el]!) ?? 0),
        idx,
      }))
      .sort((a, b) => b.score - a.score || a.idx - b.idx)
      .map((x) => x.el);

  type Built = { pick: Pick; id: string; element: UiElement; mechanic: Mechanic | null; d: Direction };
  const built: Built[] = [];
  const titles = new Set<string>();
  const whys = new Set<string>();
  const scope = pagesIn.length > 0 ? `Use it only on the ${joinList(pagesIn)}, one or two pages, not the whole product.` : `Use it on the ${pageLabel}, one or two pages, not the whole product.`;

  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i]!;
    const { lead, second } = pick;
    const cardIds = [lead.id, ...(second ? [second.id] : [])];
    const id = stableId(`${key}|${i}|${cardIds.join("+")}`);
    const moves: MoveId[] = [...new Set([KIND_MOVE[lead.kind], ...(second ? [KIND_MOVE[second.kind]] : [])])];
    const ingredients: Ingredients = { mood: lead.family, [KIND_SLOT[lead.kind]]: lead.name };
    if (second && !ingredients[KIND_SLOT[second.kind]]) ingredients[KIND_SLOT[second.kind]] = second.name;
    const idea = words(lead.name.toLowerCase()).slice(0, 5).join(" ");
    const elements = ranked(lead);
    let why = fitOf.get(lead.id)?.reason ?? `${lead.idea}`;
    if (whys.has(why)) why = `${lead.name}: ${why}`;

    const draw = async (attempt: number) => {
      const el = elements[attempt % elements.length]!;
      const list = (await mechanicsFor(el)) ?? [];
      const mech =
        [...list]
          .filter((m) => !usedMechanics.has(m.id))
          .sort((a, b) => Number(b.pages.includes(page.id)) - Number(a.pages.includes(page.id)) || b.buildability - a.buildability || a.id.localeCompare(b.id))[0] ?? null;
      const line = lineOf.get(`${lead.id}|${el}`);
      const how = fixCase(line?.how ?? (mech ? `${lead.name}: ${mech.how}` : `${lead.name} as the ${PART[ELEMENT_TO_MECHANIC[el]!]}`));
      const element = ELEMENT_TO_MECHANIC[el]!;
      const spec = cardSpec({ pick, platform, arabic, element, mechanic: mech, how, pageLabel, why });
      const dm: DirectionMechanic = { element, how: sentence(how).replace(/\.$/, "") };
      return { el, mech, spec, dm };
    };
    let drawn = await draw(0);
    const prior = built.map((b) => b.d);
    for (let attempt = 1; attempt < MAX_COHERENCE_TRIES; attempt++) {
      if (checkCoherence({ id, moves, ingredients, searchQuery: idea, mechanic: drawn.dm, spec: drawn.spec }, prior).length === 0) break;
      drawn = await draw(attempt);
    }
    elementUse.set(drawn.dm.element, (elementUse.get(drawn.dm.element) ?? 0) + 1);
    if (drawn.mech) usedMechanics.add(drawn.mech.id);
    whys.add(why);

    const titleBase = clipTitle(`${lead.name} ${subject.head}`);
    const title = !titles.has(titleBase.toLowerCase()) && words(titleBase).length <= MAX_TITLE_WORDS ? titleBase : clipTitle(lead.name);
    titles.add(title.toLowerCase());
    const twist = second && (wildness >= TWIST_FROM_WILDNESS || lens)
      ? words(`with the ${pick.adds} of ${second.name}`).slice(0, MAX_TWIST_WORDS).join(" ")
      : "";
    const prompt = fixCase(
      [
        sentence(lead.idea),
        sentence(lead.surprise),
        `Build it this way: ${drawn.dm.how}.`,
        second ? `${second.name} adds only its ${pick.adds}.` : "",
        lead.culturalNotes ? sentence(lead.culturalNotes) : "",
        platform === "any" ? "Built for any screen." : `Built for a ${profile.label}.`,
        scope,
        rule.hint,
      ]
        .filter(Boolean)
        .join(" "),
    );
    built.push({
      pick,
      id,
      element: drawn.el,
      mechanic: drawn.mech,
      d: {
        id,
        move: moves.join(" + "),
        moves,
        title: fixCase(title),
        twist: fixCase(twist ? `${twist.charAt(0).toUpperCase()}${twist.slice(1)}` : ""),
        searchQuery: idea,
        searchQueries: [],
        prompt,
        ingredients,
        platform,
        pages: [...pagesIn],
        spec: drawn.spec,
        artQueries: [],
        mechanic: drawn.dm,
        cardIds,
        ...(drawn.mech ? { mechanicId: drawn.mech.id } : {}),
        recipeIds: [],
      },
    });
  }

  // 7. Queries from recipes, then the Phase 0 lanes; no query shared between directions.
  const ap = atlasPlatform(platform);
  const keysFor = (b: Built) => {
    const cardId = b.pick.lead.id;
    const el = b.element;
    return {
      concept: [
        { lane: "concept" as const, page: page.id, platform: ap, element: el, cardId },
        { lane: "concept" as const, element: el, cardId },
        { lane: "concept" as const, cardId },
      ],
      component: [
        { lane: "component" as const, page: page.id, platform: ap, element: el },
        { lane: "component" as const, page: page.id, element: el },
        { lane: "component" as const, platform: ap, element: el },
      ],
      art: [{ lane: "art" as const, cardId }],
      baseline: [
        { lane: "baseline" as const, page: page.id, platform: ap },
        { lane: "baseline" as const, page: page.id },
      ],
    };
  };
  const allKeys = built.flatMap((b) => Object.values(keysFor(b)).flat()).map(normKey);
  const uniqueKeys = [...new Map(allKeys.map((k) => [JSON.stringify(k), k])).values()];
  // Missing recipes are not an error: the Phase 0 lanes (P0-17 taste lanes included) take over.
  const recipes = (await source.recipes(uniqueKeys)) ?? [];
  const byKey = new Map<string, QueryRecipe[]>();
  for (const r of recipes) {
    const k = JSON.stringify(normKey(r.key));
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  const uiOk = (r: QueryRecipe) => holdsNoun(r.query, productNoun, page) && words(r.query).length <= 7;
  const artOk = (r: QueryRecipe) => !UI_WORDS.test(r.query);
  const usedQueries = new Set<string>();
  const usedRecipes = new Set<string>();
  const baseline = bestRecipe(byKey, keysFor(built[0]!).baseline, uiOk, new Set());

  for (const b of built) {
    const keys = keysFor(b);
    const recipeIds: string[] = [];
    const own: string[] = [];
    for (const lane of ["concept", "component"] as const) {
      const r = bestRecipe(byKey, keys[lane], uiOk, usedRecipes);
      if (!r) continue;
      usedRecipes.add(recipeId(r));
      recipeIds.push(recipeId(r));
      own.push(r.query);
    }
    const p0 = phase0Queries({
      brief: input.brief,
      idea: b.d.searchQuery,
      taste,
      id: b.id,
      platform,
      styleWords: b.d.spec.styleWords,
      pages: pagesIn,
      element: b.d.mechanic.element,
      rule: b.pick.lead.kind === "constraint",
    });
    b.d.searchQueries = takeQueries({ own: [...own, ...p0.own], shared: p0.shared }, usedQueries);
    const art = keys.art.flatMap((k) => (byKey.get(JSON.stringify(normKey(k))) ?? []).filter(artOk)).sort((x, y) => y.precision - x.precision).slice(0, 2);
    for (const r of art) recipeIds.push(recipeId(r));
    const artQueries: string[] = [];
    for (const q of [...art.map((r) => r.query), ...b.pick.lead.artQueries, ...(b.pick.second?.artQueries ?? [])]) {
      const t = words(q).slice(0, 6).join(" ");
      if (!t || UI_WORDS.test(t) || artQueries.some((o) => o.toLowerCase() === t.toLowerCase())) continue;
      artQueries.push(t);
      if (artQueries.length >= 3) break;
    }
    b.d.artQueries = artQueries.length > 0 ? artQueries : [b.d.searchQuery];
    if (baseline) recipeIds.push(recipeId(baseline));
    b.d.recipeIds = [...new Set(recipeIds)];
  }

  return applyBrand({
    brief: input.brief,
    subject: fixCase(subject.title),
    wildness,
    wildnessLabel: rule.label,
    lens: lens ? { id: lens.id, name: lens.name, arabicFont: lens.arabicFont } : null,
    suggestedLenses: lens ? [] : suggestLenses(input.brief),
    platform,
    pages: pagesIn,
    wildSpots: pagesIn.length > 0 ? [] : wildSpotsFor(platform),
    directions: built.map((b) => b.d).slice(0, input.count),
    atlas: { pageId: page.id, domainId: domain.id, productNoun },
  }, input.brand);
}
