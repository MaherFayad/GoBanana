/**
 * R9: the direction spec agrees with itself and with the page (pure, no model).
 *
 * The R7 draft judge named the spec as the weakest part of 12 of 20 drafts:
 * - the second card's texture and motion lines named objects from the card's own world ("a honey
 *   fill level", "the parts list card", "the new initials") instead of a part of this page;
 * - colors named in the text were not in the palette ("mustard", "cobalt", "a yellow credit counter");
 * - density words fought the card ("Dense; ... generous spacing", "Dense; airy sections").
 *
 * `coherentSpec` rebuilds the texture and motion lines from the cards with their places moved onto the
 * R4 page-span parts (the texture onto the part its place words name, else the part the main task runs
 * through; the second card's motion onto the task part, timed to the main task), keeps the card's own
 * material and verb (translated, not tamed), then swaps every color word or hex that is not in the
 * lead palette for the nearest palette color and makes the spacing words agree with the card's
 * density. `coherentMechanic` applies the same color check to the mechanic lines the Bend it lines
 * show, so the spec and the Frankenstein page name the same colors.
 */
import type { Mechanic as DirectionMechanic } from "@/lib/bend/mechanic";
import type { VisualSpec } from "@/lib/direction-detail";
import { hexToOklab, oklabDistance } from "@/lib/palette/color";
import { PLATFORM_PROFILES, type Platform } from "@/lib/platform";
import type { IngredientCard } from "./types";

export type SpecPart = { element: string; label: string; how: string };

export interface SpecContext {
  lead: IngredientCard;
  second: IngredientCard | null;
  /** What the second card adds. */
  adds: "texture" | "motion" | "rule" | null;
  platform: Platform;
  /** The R4 page-span parts, the mechanic's own part first; empty without a span. */
  parts: readonly SpecPart[];
  /** The R4 task sentence ("The main task, pick a plan, buy, now runs through the plan cards: ..."). */
  task?: string;
  /** The page's name ("eSIM plan picker"), for the twist sentence. */
  pageLabel?: string;
}

const lowerFirst = (s: string) => (/^[A-Z](?![A-Z0-9])/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const trimEnd = (s: string) => s.trim().replace(/[.;,\s]+$/, "");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The task phrase and the part it runs through, read back from the R4 task sentence. */
export function parseTask(task: string | undefined): { phrase: string; label: string } | null {
  const m = /^The main task, (.+?), now runs through the (.+?):/.exec(task ?? "");
  return m ? { phrase: m[1]!, label: m[2]! } : null;
}

// ---------------------------------------------------------------------------
// Places: the part of the card's own world a texture names, moved onto a page part.

const NOUN = "cards?|panels?|bands?|boards?|buttons?|charts?|strips?|tiles?|numerals?|shapes?|patch(?:es)?|headers?|banners?|badges?|maps?|sheets?|counters?|sash(?:es)?|rows?|plates?|faces?";
const DET = "the|one|each|a|an|that one|every|its";
const MODS = "(?:[a-z0-9-]+\\s+){0,3}?";
/** The place noun is the last word of the place ("step header card" ends on "card", not "header"). */
const LAST = `(?!\\s+(?:${NOUN})\\b)`;
/** "on the top band of the card", "on the top edge of the order card". */
const OF_PLACE = new RegExp(`\\b(on|along|across|at)\\s+(?:the|its)\\s+((?:top|bottom|left|right|upper|lower|outer|inner|leading|trailing)\\s+(?:edge|band|strip|corner|rim|border|half|third|line))\\s+of\\s+(?:${DET})\\s+(${MODS})(${NOUN})\\b${LAST}(\\s+only)?`, "gi");
/** "on one progress or stats card only", "behind the hero numeral only", "only on the step header card". */
const PREP_PLACE = new RegExp(`\\b(on|onto|behind|across|along|inside|over|under|around)\\s+(only\\s+)?(?:${DET})\\s+(?:single\\s+)?(${MODS}(?:or\\s+[a-z-]+\\s+)?)(${NOUN})\\b${LAST}(?!\\s+of\\b)(\\s+only)?`, "gi");
/** A sentence that opens on the card's own part: "One focus card only:", "The hero card gets ...". */
const LEAD_ONLY = new RegExp(`(^|[.:]\\s+)(?:one|the|each|a)\\s+(${MODS})(${NOUN})${LAST}(?:\\s+alone)?\\s+only:\\s*`, "gi");
const LEAD_GETS = new RegExp(`(^|[.:]\\s+)(?:only\\s+)?(?:the|one|each|a)\\s+(${MODS})(${NOUN})${LAST}(?:\\s+alone)?\\s+(?:gets|carries|has|holds|wears|takes)\\s+`, "gi");

/** Which page elements a place word points at, most specific first. */
const PLACE_ELEMENTS: Array<[RegExp, readonly string[]]> = [
  [/\bmap\b/, ["map"]],
  [/\b(button|cta|striker)\b/, ["cta"]],
  [/\b(chart|stats?|progress|numerals?|counter|gauge|score)\b/, ["chart", "progress", "stepper", "total", "price-breakdown"]],
  [/\b(chip|tag|filter)\b/, ["chip-filter"]],
  [/\b(rows?|list)\b/, ["list-row"]],
  [/\b(hero|header|banner|board|top)\b/, ["hero", "header", "onboarding-slide", "empty-state"]],
  [/\b(sheet|receipt)\b/, ["sheet", "card", "price-breakdown"]],
  [/\b(card|panel|tile|patch|patches|plate|face|sash|badge|shape|strip|band)\b/, ["card", "paywall-plan", "list-row", "total", "hero"]],
];

/** The page part a place phrase lands on: the part its words name, else the task part, else the first. */
export function placePart(place: string, parts: readonly SpecPart[], taskLabel: string | null): SpecPart | null {
  if (parts.length === 0) return null;
  const words = place.toLowerCase();
  for (const [re, els] of PLACE_ELEMENTS) {
    if (!re.test(words)) continue;
    for (const el of els) {
      const hit = parts.find((p) => p.element === el);
      if (hit) return hit;
    }
  }
  return parts.find((p) => p.label === taskLabel) ?? parts[0]!;
}

/**
 * A card texture with its own places moved onto this page: the first place becomes the page part it
 * points at, later places of the card's world are dropped ("sitting on a fine twill weave on the sash
 * card" keeps the weave, not the sash). Returns the text and the part, or null when nothing named a place.
 */
export function placeTexture(texture: string, parts: readonly SpecPart[], taskLabel: string | null): { text: string; part: SpecPart | null } {
  let part: SpecPart | null = null;
  const take = (place: string) => (part ??= placePart(place, parts, taskLabel));
  let first = true;
  let text = texture.trim();
  if (parts.length === 0) return { text, part: null };
  text = text.replace(LEAD_ONLY, (_m, pre: string, mods: string, noun: string) => {
    const p = take(`${mods}${noun}`)!;
    first = false;
    return `${pre}On the ${p.label} only: `;
  });
  text = text.replace(LEAD_GETS, (_m, pre: string, mods: string, noun: string) => {
    if (!first) return `${pre}`;
    const p = take(`${mods}${noun}`)!;
    first = false;
    return `${pre}On the ${p.label}: `;
  });
  text = text.replace(OF_PLACE, (_m, prep: string, edge: string, mods: string, noun: string, only: string | undefined) => {
    if (!first) return `${prep} its ${edge}`;
    const p = take(`${mods}${noun}`)!;
    first = false;
    return `${prep} the ${edge} of the ${p.label}${only ?? ""}`;
  });
  text = text.replace(PREP_PLACE, (m, prep: string, onlyBefore: string | undefined, mods: string, noun: string, only: string | undefined, offset: number, whole: string) => {
    // A place already moved onto this page ("on the plan cards") stays as it is.
    if (parts.some((p) => m.toLowerCase().endsWith(p.label.toLowerCase()) || whole.slice(offset).toLowerCase().startsWith(`${prep} the ${p.label}`.toLowerCase()))) return m;
    if (!first) return `${prep === "on" || prep === "onto" ? "" : `${prep} it`}\u0000`;
    const p = take(`${mods}${noun}`)!;
    first = false;
    return `${prep} ${onlyBefore ?? ""}the ${p.label}${only ?? ""}`;
  });
  text = text
    // A later place of the card's world becomes "there" (the part named first), or "behind it".
    .replace(/(\b(?:behind|across|along|inside|over|under|around) it)\u0000/g, "$1")
    .replace(/\u0000/g, " there")
    .replace(/\s+there\b/g, " there")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/(^|\.\s+)([a-z])/g, (_m, pre: string, c: string) => `${pre}${c.toUpperCase()}`)
    .replace(/(On the [^:.]+:\s+)([A-Z])(?=[a-z ])/g, (_m, pre: string, c: string) => `${pre}${c.toLowerCase()}`);
  return { text, part };
}

/**
 * Why the second card is there, in this page's words: the sentence of its surprise that says what it
 * gives a UI ("Small hollows carved in rows into rock become a tactile dot system for steps, counts
 * and ratings"), with "the UI" made this page. The draft judge read a bare "(from X)" as a line left
 * over from another direction; the twist sentence says it is this direction's second card, and why.
 */
export function twistWhy(card: Pick<IngredientCard, "surprise" | "idea">, pageLabel?: string): string {
  const sentences = (card.surprise || card.idea).split(/(?<=[.!?])\s+/).map(trimEnd).filter(Boolean);
  const pick = sentences.find((x) => /\b(UI|interface|screen|app|page)\b/.test(x)) ?? sentences[sentences.length - 1] ?? "";
  const page = pageLabel ? `the ${pageLabel}` : "the page";
  return pick.replace(/\bthe (UI|interface|app|screen)\b/i, page);
}

/** The texture line: the card's surface on one page part, where the card said where it goes. */
export function textureLine(ctx: SpecContext): { line: string; surface: string } {
  const card = ctx.adds === "texture" && ctx.second ? ctx.second : ctx.lead;
  const task = parseTask(ctx.task);
  const { text, part } = placeTexture(card.texture, ctx.parts, task?.label ?? null);
  const body = trimEnd(text);
  const borrowed = card !== ctx.lead;
  if (!borrowed) return { line: `${body}; text sits on solid panels, never on the texture.`, surface: `${body}.` };
  // A borrowed texture that named no place of its own still lands on one part of this page.
  const target = part ?? (ctx.parts.length ? ctx.parts.find((p) => p.label === task?.label) ?? ctx.parts[0]! : null);
  const placed = target && !part ? `On the ${target.label} only: ${lowerFirst(body)}` : body;
  const why = twistWhy(card, ctx.pageLabel);
  return {
    line: `The twist, the surface of ${card.name}${why ? `: ${lowerFirst(why)}` : ""}. ${upperFirst(placed)}; text sits on solid panels, never on the texture.`,
    surface: `${placed}.`,
  };
}

// ---------------------------------------------------------------------------
// Motion: the borrowed verb on the part the main task runs through.

const REDUCED_VERBS =
  "swaps|swap|jumps|jump|appears|appear|shows|show|updates|update|snaps|snap|fades|fade|lands|land|sits|sit|stays|stay|changes|change|replaces|replace|moves|move|steps|step|switches|switch|drops|drop|turns|turn|holds|hold|settles|settle|becomes|become|goes|go|is|are|cuts|cut|fills|fill|opens|open|closes|close|flips|flip|slides|slide|arrives|arrive";
const SUBJECT = new RegExp(`(^|:\\s+)(?:the |a |an |each |every )?(?:new |final |current |next |whole )?((?:[a-z'-]+\\s+){0,3}?[a-z'-]+)\\s+(${REDUCED_VERBS})\\b`, "i");
const THIRD: Record<string, string> = { go: "goes", is: "is", are: "is", switch: "switches", stay: "stays" };

/**
 * The reduced motion text of a borrowed card with its subject made "it" (the page part), so "The rod
 * jumps straight to its new position" reads "it jumps straight to its new position".
 */
export function reducedOnPart(reduced: string): string {
  const r = trimEnd(reduced);
  const m = SUBJECT.exec(r);
  if (!m || /^(instant|no|short|a short|static)\b/i.test(m[2]!)) return lowerFirst(r);
  const verb = m[3]!.toLowerCase();
  const v = THIRD[verb] ?? (/(s)$/.test(verb) ? verb : `${verb}s`);
  return lowerFirst(`${r.slice(0, m.index)}${m[1]}it ${v}${r.slice(m.index + m[0].length)}`);
}

/** The motion line: the lead's own, or the second card's verb on the task part, timed to the main task. */
export function motionLine(ctx: SpecContext): string {
  const borrowed = ctx.adds === "motion" && ctx.second ? ctx.second : null;
  const card = borrowed ?? ctx.lead;
  const { verb, ms, reduced } = card.motion;
  if (!borrowed) return `${upperFirst(trimEnd(verb))} in ${ms}ms; with reduced motion on, ${lowerFirst(trimEnd(reduced))}.`;
  const task = parseTask(ctx.task);
  const part = ctx.parts.find((p) => p.label === task?.label) ?? ctx.parts[0];
  if (!part) return `${upperFirst(trimEnd(verb))} in ${ms}ms (from ${card.name}); with reduced motion on, ${lowerFirst(trimEnd(reduced))}.`;
  const when = task ? `, each time the main task moves on (${task.phrase})` : "";
  const why = twistWhy(card, ctx.pageLabel);
  return `The twist, the motion of ${card.name}${why ? `: ${lowerFirst(why)}` : ""}. ${upperFirst(trimEnd(verb))} in ${ms}ms on the ${part.label}${when}; with reduced motion on, ${reducedOnPart(reduced)}.`;
}

// ---------------------------------------------------------------------------
// Colors: every color the text names is in the palette, or becomes the nearest palette color.

/** Color words the text may name, with a typical hex. Materials (gold, copper, rust, sand) are left out on purpose. */
export const COLOR_WORDS: Record<string, string> = {
  red: "#D32F2F", crimson: "#B0122B", scarlet: "#E0301E", maroon: "#7A1F2B", burgundy: "#800020",
  orange: "#F28C28", amber: "#FFB000", saffron: "#F4C430", yellow: "#F2D43D", mustard: "#D4A017", ochre: "#CC7722",
  green: "#3A9D4A", emerald: "#2E8B57", teal: "#1F8A8A", turquoise: "#30C5C5", aqua: "#4FD1E0", cyan: "#22B8CF",
  blue: "#2F6FD6", cobalt: "#1F4FA8", navy: "#1B2A4A", indigo: "#3F3A9E", violet: "#7F4FC9", purple: "#6E3FA3",
  lilac: "#B9A2D8", lavender: "#B7A6E0", pink: "#E87AA4", magenta: "#C2185B", fuchsia: "#D63AF9",
  brown: "#7A4E2D", tan: "#C8A27A", beige: "#E6D8BE", cream: "#F3ECD8", ivory: "#F6F1E3",
  white: "#FFFFFF", black: "#111111", gray: "#808080", grey: "#808080", terracotta: "#C4623E",
};
/** A palette color this close (OKLab) to a word's typical color counts as that color. */
export const SAME_COLOR = 0.09;
const COLOR_RE = new RegExp(`(?:\\b[a-z]+-)?\\b(${Object.keys(COLOR_WORDS).join("|")})\\b`, "gi");
const HEX_RE = /#[0-9a-f]{6}\b/gi;

type Swatch = { name: string; hex: string; lab: [number, number, number] };
const swatches = (palette: IngredientCard["palette"]): Swatch[] =>
  palette.flatMap((p) => {
    try {
      return [{ name: p.name, hex: p.hex.toUpperCase(), lab: hexToOklab(p.hex) }];
    } catch {
      return [];
    }
  });
const nearest = (lab: readonly number[], sw: readonly Swatch[]) =>
  sw.reduce((best, s) => (oklabDistance(lab, s.lab) < oklabDistance(lab, best.lab) ? s : best), sw[0]!);

/**
 * Every color word and hex in `text` that is not in the palette becomes the nearest palette color's
 * name (a hex becomes the nearest palette hex). A word is in the palette when a palette color's name
 * holds it or a palette color is within SAME_COLOR of it. Names in `keep` (card names, which may hold
 * a color word: "White Text on Color") are never touched.
 */
export function paletteColors(text: string, palette: IngredientCard["palette"], keep: readonly string[] = []): string {
  const sw = swatches(palette);
  if (sw.length === 0 || !text) return text;
  const masks: string[] = [];
  let out = text;
  for (const name of [...keep].filter(Boolean).sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(escapeRe(name), "gi"), (m) => `\u0001${masks.push(m) - 1}\u0002`);
  }
  // Palette names already in the text stay as they are ("canopy amber").
  for (const s of [...sw].sort((a, b) => b.name.length - a.name.length)) {
    out = out.replace(new RegExp(`\\b${escapeRe(s.name)}\\b`, "gi"), (m) => `\u0001${masks.push(m) - 1}\u0002`);
  }
  out = out.replace(COLOR_RE, (m, word: string) => {
    const w = word.toLowerCase().replace("grey", "gray");
    const named = sw.some((s) => new RegExp(`\\b${w === "gray" ? "gr[ae]y" : w}\\b`, "i").test(s.name));
    if (named) return m;
    const lab = hexToOklab(COLOR_WORDS[w]!);
    const near = nearest(lab, sw);
    if (oklabDistance(lab, near.lab) <= SAME_COLOR) return m;
    return `\u0003${near.name}`;
  });
  out = out.replace(HEX_RE, (m) => {
    if (sw.some((s) => s.hex === m.toUpperCase())) return m;
    try {
      return nearest(hexToOklab(m), sw).hex;
    } catch {
      return m;
    }
  });
  return out
    .replace(/\b([Aa]) \u0003(?=[aeiou])/g, "$1n ")
    .replace(/\u0003/g, "")
    .replace(/\u0001(\d+)\u0002/g, (_m, i: string) => masks[Number(i)]!);
}

/**
 * The color line's palette: every palette color with its role and name, so a color the other lines
 * name ("cobalt", "mustard") is visibly in the palette (R7 listed one color per role, by hex only).
 */
export function paletteList(palette: IngredientCard["palette"]): string {
  return (["surface", "ink", "accent", "support"] as const)
    .flatMap((r) => palette.filter((p) => p.role === r))
    .map((p) => `${p.role} ${p.name} ${p.hex.toUpperCase()}`)
    .join(", ");
}

/** The spec's color line from the lead card (no closing period). */
export function colorLine(lead: Pick<IngredientCard, "name" | "palette" | "shipPairs">): string {
  const pairs = lead.shipPairs.slice(0, 2).map(([fg, bg]) => `${fg.toUpperCase()} on ${bg.toUpperCase()}`);
  return `Palette from ${lead.name}: ${paletteList(lead.palette)}${pairs.length ? `; ship pairs ${pairs.join(", ")}` : ""}; text at 4.5 to 1 or more`;
}

// ---------------------------------------------------------------------------
// Density: spacing words agree with the card.

const DENSE_SWAPS: Array<[RegExp, string]> = [
  [/\bgenerous spacing\b/gi, "tight spacing"],
  [/\bcomfortable spacing\b/gi, "close spacing"],
  [/\bairy sections\b/gi, "packed sections"],
  [/\bone message per screen height\b/gi, "several blocks per screen height"],
  [/\bone idea per screen\b/gi, "several facts per screen"],
  [/\b(?:plenty of|lots of|generous) (?:white ?space|room)\b/gi, "little white space"],
  [/\bbreathing room\b/gi, "tight gaps"],
  [/\b(?:spacious|roomy)\b/gi, "compact"],
  [/\bairy\b/gi, "dense"],
  [/\bgenerous\b/gi, "tight"],
];
const AIRY_SWAPS: Array<[RegExp, string]> = [
  [/\btight spacing\b/gi, "generous spacing"],
  [/\bclose spacing\b/gi, "generous spacing"],
  [/\bcompact (tables|lists|rows)\b/gi, "roomy $1"],
  [/\b(?:little|no) white ?space\b/gi, "plenty of white space"],
  [/^dense,\s*/i, "open, "],
  [/\b(?:dense|packed|crowded|cramped|compact)\b/gi, "open"],
];
const BALANCED_SWAPS: Array<[RegExp, string]> = [
  [/^dense,\s*/i, "even, "],
  [/\bairy sections\b/gi, "even sections"],
];

/** Spacing words in `text` made to agree with the card's density (airy, balanced or dense). */
export function densityWords(text: string, density: IngredientCard["density"]): string {
  const swaps = density === "dense" ? DENSE_SWAPS : density === "airy" ? AIRY_SWAPS : BALANCED_SWAPS;
  return swaps.reduce((t, [re, to]) => t.replace(re, (m) => (/^[A-Z]/.test(m) ? upperFirst(m.replace(re, to)) : m.replace(re, to))), text);
}

/** The density line: the card's density, then the platform's spacing words made to agree with it. */
export function densityLine(density: IngredientCard["density"], platform: Platform): string {
  const profile = PLATFORM_PROFILES[platform].density.trim();
  const words = densityWords(lowerFirst(profile), density).replace(/[.\s]+$/, "");
  return `${upperFirst(density)}; ${words}.`;
}

// ---------------------------------------------------------------------------

/**
 * The pattern line names the mechanic only when the signature is that mechanic's line ("Lead: how").
 * When the signature is the lead card's own line, the mechanic's name was an extra, unexplained
 * interaction ("a draining button countdown", "a fanned type deck") that the draft judge read as a
 * second idea fighting the first, so the pattern names the lead on its part.
 */
export function patternLine(spec: Pick<VisualSpec, "pattern" | "signature">, leadName: string): string {
  if (spec.signature.startsWith(`${leadName}:`)) return spec.pattern;
  return spec.pattern.replace(/^(.+? on the [^:]+): .*$/, "$1.");
}

/** The spec with the R9 checks: texture and motion on this page's parts, palette colors, density words. */
export function coherentSpec(spec: VisualSpec, ctx: SpecContext): VisualSpec {
  const keep = [ctx.lead.name, ...(ctx.second ? [ctx.second.name] : [])];
  const pal = (t: string) => paletteColors(t, ctx.lead.palette, keep);
  const texture = textureLine(ctx);
  const space = (t: string) => t.replace(/\b(?:generous|tight|comfortable|close) spacing\b|\bairy sections\b|\b(?:spacious|roomy|cramped|crowded)\b/gi, (m) => densityWords(m, ctx.lead.density));
  return {
    ...spec,
    layout: space(pal(spec.layout)),
    motion: pal(motionLine(ctx)),
    texture: pal(texture.line),
    density: densityLine(ctx.lead.density, ctx.platform),
    signature: pal(spec.signature),
    pattern: pal(patternLine(spec, ctx.lead.name)),
    whyItFits: pal(spec.whyItFits),
    steal: spec.steal.map((s) => pal(/^The surface: /.test(s) ? `The surface: ${texture.surface}` : s)),
  };
}

/** The mechanic lines (how, parts, task) with the same palette check as the spec. */
export function coherentMechanic(dm: DirectionMechanic, ctx: Pick<SpecContext, "lead" | "second">): DirectionMechanic {
  const keep = [ctx.lead.name, ...(ctx.second ? [ctx.second.name] : [])];
  const pal = (t: string) => paletteColors(t, ctx.lead.palette, keep);
  return {
    ...dm,
    how: pal(dm.how),
    ...(dm.parts ? { parts: dm.parts.map((p) => ({ ...p, how: pal(p.how) })) } : {}),
    ...(dm.task ? { task: pal(dm.task) } : {}),
  };
}
