import { fixCase } from "./spec";
import type { Ingredients, ListEntry, MoveId } from "./types";

/**
 * The mechanic: the working UI part a direction's wild idea becomes ("Sadu weaving as the progress
 * bar"). Agents in the field built from these mappings (braid = progress bar, tabs = sections,
 * woven band = section divider; field report, 2026-10-12). Rule-based, no AI, no random draws.
 */
export const MECHANIC_ELEMENTS = ["progress", "total", "cta", "divider", "section-nav", "header", "empty-state", "plan", "list-row", "card", "map", "form-field", "chip-filter"] as const;
/**
 * R8: the parts where a page's work happens (list rows, result cards, the map, form fields, filter
 * and sort). Only the Atlas engine lands a mechanic on them (lib/atlas/bend.ts ELEMENT_TO_MECHANIC);
 * the lists engine's AFFINITY, MOVE_DEFAULT and LAST_RESORT never name them.
 */
export const WORK_ELEMENTS: ReadonlySet<MechanicElement> = new Set<MechanicElement>(["list-row", "card", "map", "form-field", "chip-filter"]);
export type MechanicElement = (typeof MECHANIC_ELEMENTS)[number];

export interface Mechanic {
  element: MechanicElement;
  /** One line: how the idea works as that part. */
  how: string;
  /**
   * Atlas engine (R4): the 2 or 3 page parts the idea changes (this part first, at least one flow or
   * structure part), each with how it works there.
   */
  parts?: { element: string; label: string; how: string }[];
  /** Atlas engine (R4): how the page's main task works differently. */
  task?: string;
}

/** Words in an ingredient that suit an element, checked in this order. */
const AFFINITY: readonly [RegExp, MechanicElement][] = [
  [/\b(braid|braids|braiding|thread|threads|rope|knots?|chain|beads?|beadwork|fuse|ruler|tape|film|filmstrip|tally|progress|loading|stitch|stitches|ticker|track|timeline|abacus)\b/i, "progress"],
  [/\b(band|bands|border|borders|trim|seam|ribbons?|frieze|stripes?|weav\w*|embroidery|tatreez|tiles?|zellige|azulejo|rules|leaders|perforations?|crenellations?|kilim|rugs?|textile|weave|knit|quilts?|tartan)\b/i, "divider"],
  [/\b(tabs?|folder|index|drawer|binder|rolodex|catalog|map|doors?|windows?|lattice|screens?|curtains?|noren|deck|panel|courtyard|card catalog)\b/i, "section-nav"],
  [/\b(receipt|ledger|numerals|digits|numbers?|price|coins?|banknote|meter|scoreboard|odometer|gauge|dials?|calculator|tabular|currency|percent)\b/i, "total"],
  [/\b(button|buttons|switch|switches|toggle|lever|keys?|knob|seals?|stamps?|ticket|tickets|chip|token|wax)\b/i, "cta"],
  [/\b(poster|posters|sign|signs|signage|neon|marquee|masthead|banner|facade|headlines?|cover|newspaper|board|lettering|letterforms|typography|typeface|logo)\b/i, "header"],
  [/\b(painting|paintings|mural|miniature|illustration|landscape|dune|horizon|sky|garden|flowers|wall|walls|clouds?|moons?|majlis|interior)\b/i, "empty-state"],
];

/** Elements a move suits when its words say nothing. */
const MOVE_DEFAULT: Record<MoveId, readonly MechanicElement[]> = {
  transplant: ["section-nav", "header"],
  material: ["cta", "divider"],
  era: ["header", "section-nav"],
  constraint: ["section-nav", "header"],
  scale: ["total", "header"],
  lens: ["divider", "progress"],
};

/** Every element, as the last resort order: the safest carriers first. */
const LAST_RESORT: readonly MechanicElement[] = ["header", "divider", "empty-state", "section-nav", "progress", "total", "cta"];

/** One line per element. {Idea} is the idea's label; each keeps the part's job intact. */
const HOW: Record<MechanicElement, string> = {
  progress: "{Idea} as the progress bar: one segment fills per step, step names stay readable",
  total: "{Idea} frames the total; the amount itself stays plain, large and readable",
  cta: "{Idea} skins the main button; still one button with a plain label",
  divider: "{Idea} as the band between sections, never behind text",
  "section-nav": "{Idea} as the tabs that switch between sections",
  header: "{Idea} carries the header strip and the page title",
  "empty-state": "{Idea} fills the empty state art, with one clear next step",
  plan: "{Idea} shapes the plan cards; each plan keeps its name, price and a plain selected state",
  "list-row": "{Idea} builds the list rows; each row keeps its name and key number plain, in order",
  card: "{Idea} builds the result cards; each card keeps its title, price and one way in",
  map: "{Idea} redraws the map; real geography stays under it and every pin stays readable",
  "form-field": "{Idea} builds the form fields; real labels, typed text and errors stay plain",
  "chip-filter": "{Idea} builds the filters and sort; the selected state shows and clears in one tap",
};

/** The rule version, for a direction led by a constraint. */
const RULE_HOW: Record<MechanicElement, string> = {
  progress: "The progress bar follows one rule: {rule}",
  total: "The total block follows one rule: {rule}, the amount stays readable",
  cta: "The main button follows one rule: {rule}, still one button",
  divider: "Section dividers follow one rule: {rule}",
  "section-nav": "The section tabs follow one rule: {rule}",
  header: "The header follows one rule: {rule}",
  "empty-state": "The empty state follows one rule: {rule}",
  plan: "The plan cards follow one rule: {rule}, every price stays readable",
  "list-row": "The list rows follow one rule: {rule}, the order stays easy to scan",
  card: "The result cards follow one rule: {rule}, every title and price stays readable",
  map: "The map follows one rule: {rule}, real geography stays under it",
  "form-field": "The form fields follow one rule: {rule}, labels and errors stay plain",
  "chip-filter": "The filters follow one rule: {rule}, the selected state stays visible",
};

// ---------------------------------------------------------------------------
// Must-keeps: the parts users rely on that a wild direction must not break.

/** Must-keep words to the element they protect. */
const MUST_KEEP_WORDS: readonly [RegExp, MechanicElement][] = [
  [/\b(total|totals|price|prices|fare|fares|amount|sum|cost|costs|summary|breakdown)\b/i, "total"],
  [/\b(button|buttons|cta|ctas|primary action|pay|payment|book|confirm|submit|checkout button)\b/i, "cta"],
  [/\b(step|steps|stepper|progress|indicator)\b/i, "progress"],
  [/\b(tabs?|nav|navigation|sections?)\b/i, "section-nav"],
  [/\b(header|title|logo|brand)\b/i, "header"],
  [/\b(divider|dividers|separator|separators)\b/i, "divider"],
  [/\b(empty state|empty)\b/i, "empty-state"],
  [/\b(plan cards?|plan list|selected plan|plan comparison|plan choice)\b/i, "plan"],
];

/** Briefs that pay or book keep a clear total and one primary action by default. */
const TRANSACTION_BRIEF = /\b(checkout|payment|payments|pay|cart|booking|purchase|order|orders|basket|billing)\b/i;

/** Parts a mechanic must not reskin when protected: users read the amount and press the button. */
const RISKY: ReadonlySet<MechanicElement> = new Set(["total", "cta", "plan"]);

/**
 * True when a mechanic must not land on this element: a total, main button or plan cards that a
 * must-keep protects (Gate 2 round 3: an idea aimed at one goes to the next element its reason
 * names, or the next card).
 */
export function forbiddenElement(element: MechanicElement, protect: ReadonlySet<MechanicElement>): boolean {
  return RISKY.has(element) && protect.has(element);
}

/**
 * Ingredients that break a protected part whatever the mechanic does ("no buttons, only tappable
 * words" breaks one primary action). A direction with one of these is dropped.
 */
const BREAKERS: Partial<Record<MechanicElement, RegExp>> = {
  cta: /\b(no buttons|everything overlaps)\b/i,
  total: /\b(everything rotated|text runs in a spiral|every word a different size|everything overlaps)\b/i,
  progress: /\b(everything in one long scroll|a single scrolling ticker)\b/i,
};

/**
 * Protected elements for a brief: from the must-keeps the agent passed ("clear total", "one
 * primary action", "step indicator"), plus a clear total and one primary action for a brief that
 * pays or books (checkout, cart, booking).
 */
export function protectedElements(brief: string, mustKeep: readonly string[] = []): Set<MechanicElement> {
  const out = new Set<MechanicElement>();
  for (const keep of mustKeep) for (const [re, el] of MUST_KEEP_WORDS) if (re.test(keep)) out.add(el);
  if (TRANSACTION_BRIEF.test(brief)) {
    out.add("total");
    out.add("cta");
  }
  return out;
}

/** The first protected element the ingredients break, or null. */
export function brokenMustKeep(ingredients: Ingredients, protect: ReadonlySet<MechanicElement>): MechanicElement | null {
  const text = Object.values(ingredients).join(" | ");
  for (const el of protect) if (BREAKERS[el]?.test(text)) return el;
  return null;
}

/** Elements an ingredient's words suit, in AFFINITY order. */
function affinities(text: string): MechanicElement[] {
  return AFFINITY.filter(([re]) => re.test(text)).map(([, el]) => el);
}

/** "the {idea}" phrase for a lead entry: scale elements read "Giant numerals". */
function ideaLabel(move: MoveId, entry: ListEntry): string {
  return move === "scale" ? `giant ${entry.label}` : entry.label;
}

export interface MechanicInput {
  /** The direction's lead move and its entry (the idea). */
  lead: MoveId;
  entry: ListEntry;
  /** The other moves' entries, for affinity after the lead. */
  others: readonly { move: MoveId; entry: ListEntry }[];
  protect: ReadonlySet<MechanicElement>;
  /** Elements earlier directions of this bend landed on: spread over the top candidates. */
  used: ReadonlyMap<MechanicElement, number>;
  /** Retry number (P0-08 coherence retries): each one moves to the next allowed element. */
  attempt?: number;
}

/**
 * The mechanic for a direction: the element its lead idea suits best (its words, then the other
 * ingredients' words, then its move's default), never a protected total or main button, and
 * spread over the top three candidates so one bend does not land every idea on the same part.
 */
export function pickMechanic(input: MechanicInput): Mechanic {
  const ordered: MechanicElement[] = [];
  const push = (els: readonly MechanicElement[]) => {
    for (const el of els) if (!ordered.includes(el)) ordered.push(el);
  };
  push(affinities(`${input.entry.label} ${input.entry.query}`));
  for (const o of input.others) push(affinities(`${o.entry.label} ${o.entry.query}`));
  push(MOVE_DEFAULT[input.lead]);
  push(LAST_RESORT);
  const allowed = ordered.filter((el) => !(RISKY.has(el) && input.protect.has(el)));
  const top = allowed.slice(0, 3);
  const least = Math.min(...top.map((el) => input.used.get(el) ?? 0));
  const first = top.find((el) => (input.used.get(el) ?? 0) === least) ?? allowed[0] ?? "header";
  const attempt = input.attempt ?? 0;
  const element = attempt > 0 && allowed.length > 0 ? allowed[(allowed.indexOf(first) + attempt) % allowed.length]! : first;
  const how =
    input.lead === "constraint"
      ? RULE_HOW[element].replace("{rule}", input.entry.label)
      : HOW[element].replace("{Idea}", capitalize(ideaLabel(input.lead, input.entry)));
  return { element, how: fixCase(how) };
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
