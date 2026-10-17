/**
 * Refinement R4: a direction's mechanic spans the page instead of dressing one element.
 *
 * The trusted R3 judge put g2l at 73.3% on brief, and its main complaint was a thin idea: the world
 * only skins one button, a header band or the dividers. Here the mechanic names 2 or 3 parts of the
 * page from its J1 anatomy (sections and wild spots), at least one of them a structural or flow part
 * (the steps, the plan cards, the listing rows, the slides), says how the page's main task works
 * differently through that part, and keeps the must-keep rules. Rule based and deterministic, no
 * model calls: the lead card's J4 line per element (else a J5 mechanic already loaded for it), the
 * J4b page reason to rank the parts, and a spread over the bend so three directions do not name the
 * same parts.
 */
import type { MechanicElement } from "@/lib/bend/mechanic";
import { fixCase, PART } from "@/lib/bend/spec";
import type { Platform as ServerPlatform } from "@/lib/platform";
import type { CardElementLine, Mechanic, PageAnatomy, UiElement } from "./types";

/** Parts that carry the page's flow: moving from one step or moment to the next. */
export const FLOW_ELEMENTS: ReadonlySet<UiElement> = new Set(["stepper", "progress", "onboarding-slide", "sheet", "success", "modal"]);
/** Parts that carry its structure: what the page is made of and what the user scans, compares or picks. */
export const STRUCTURE_ELEMENTS: ReadonlySet<UiElement> = new Set(["card", "list-row", "paywall-plan", "price-breakdown", "map", "chart", "chip-filter", "sidebar", "hero", "empty-state"]);
/** Section roles that frame the page rather than do its task (a footer of links, the top bar, a logo strip). */
const FRAME_ROLES: ReadonlySet<string> = new Set(["footer", "nav", "status-header", "logos", "tabbar"]);

/** How much an element carries the page's main task, to pick the part the task runs through. */
const TASK_RANK: Partial<Record<UiElement, number>> = {
  stepper: 4,
  progress: 4,
  "onboarding-slide": 4,
  "paywall-plan": 4,
  card: 3,
  "list-row": 3,
  map: 3,
  chart: 3,
  "price-breakdown": 3,
  "empty-state": 2.5,
  "chip-filter": 2,
  hero: 2,
  sheet: 2,
  success: 2,
  modal: 1,
  sidebar: 1,
};

/** Atlas elements that are one part of the page under two names (a progress bar and a stepper). */
const SAME_PART: ReadonlyArray<ReadonlySet<UiElement>> = [new Set(["progress", "stepper"]), new Set(["total", "price-breakdown"]), new Set(["section-nav", "nav-tabs"])];
const samePart = (a: UiElement, b: UiElement) => a === b || SAME_PART.some((g) => g.has(a) && g.has(b));

export type PartKind = "flow" | "structure" | "surface";
export function partKind(el: UiElement, role?: string): PartKind {
  if (role && FRAME_ROLES.has(role)) return "surface";
  return FLOW_ELEMENTS.has(el) ? "flow" : STRUCTURE_ELEMENTS.has(el) ? "structure" : "surface";
}

/** True for a flow or structure element (by element alone, no section role). */
export const isStructural = (el: UiElement) => partKind(el) !== "surface";

export interface SpanPart {
  element: UiElement;
  /** The page's own name for the part (J1 section label), lower case. */
  label: string;
  /** How the idea works there: the lead card's J4 line, else a J5 mechanic. */
  how: string;
  kind: PartKind;
}

export interface PageSpan {
  /** 2 or 3 parts, the mechanic's own part first; at least one flow or structure part. */
  parts: SpanPart[];
  /** How the page's main task works differently, through the part that carries it. */
  task: string;
  /** The must-keep line, or "" when there is none. */
  keep: string;
}

/** Most parts a direction names, its own part included. */
export const MAX_PARTS = 3;
/** A J4 line under this buildability is not used for an extra part (a J5 mechanic is, or another part). */
const MIN_LINE = 3;

const ATLAS_PLATFORM: Partial<Record<ServerPlatform, PageAnatomy["platforms"][number]>> = { mobile: "mobile", tablet: "tablet", website: "website", webapp: "webapp" };

/** Page sections that show on this platform (a section with no bands shows on every one). */
export function platformSections(page: PageAnatomy, platform: ServerPlatform): PageAnatomy["sections"] {
  const p = ATLAS_PLATFORM[platform];
  return page.sections.filter((s) => !p || Object.keys(s.bands ?? {}).length === 0 || p in s.bands);
}

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const capital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const clean = (s: string) => fixCase(s.trim().replace(/[.\s]+$/, ""));

/** The page's main task in a few words, for the part that carries it. */
const TASK_PHRASE: Partial<Record<UiElement, string>> = {
  stepper: "moving through the steps",
  progress: "moving through the steps",
  "onboarding-slide": "getting through the first screens",
  "paywall-plan": "comparing and picking a plan",
  "price-breakdown": "checking what the price is made of",
  card: "scanning and picking",
  "list-row": "reading down the list",
  "chip-filter": "narrowing the choice",
  map: "choosing a place",
  chart: "reading the numbers",
  "empty-state": "taking the first step",
  hero: "the first impression",
  sheet: "the check step",
  modal: "the check step",
  success: "finishing",
  sidebar: "finding the right section",
};

/**
 * The task sentence: the brief's own task list when it has one ("flight checkout for a GCC OTA:
 * review the itinerary, add bags and seats, pay"), else the part's task phrase, through that part.
 */
export function taskSentence(brief: string, part: Pick<SpanPart, "element" | "label" | "how">): string {
  const listed = brief.split(":").slice(1).join(":").trim().replace(/[.\s]+$/, "");
  // A progress part with no steps in its name is a goal, not a step flow ("daily goal and sticker path").
  const own = part.element === "progress" && !/\bsteps?\b/i.test(part.label) ? "making progress" : TASK_PHRASE[part.element];
  const phrase = listed && listed.split(/\s+/).length <= 16 ? listed : (own ?? "using the page");
  return `${clean(`The main task, ${phrase}, now runs through the ${part.label}: ${lowerFirst(part.how)}`)}.`;
}

/** Protected parts that stay plain, for a brief with no must-keeps of its own. */
const KEEP_NAME: Partial<Record<MechanicElement, string>> = { total: "the total", cta: "the main button", plan: "each plan's name and price" };

/** The must-keep line: the brief's own must-keeps, else the protected parts that stay plain. */
export function keepLine(mustKeep: readonly string[], protect: ReadonlySet<MechanicElement>): string {
  const keeps = [...new Set(mustKeep.map((k) => k.trim()).filter(Boolean))];
  if (keeps.length) return `Must keep: ${keeps.join(", ")}.`;
  const plain = [...protect].map((m) => KEEP_NAME[m]).filter((x): x is string => Boolean(x));
  if (plain.length === 0) return "";
  return `${capital(joinAnd(plain))} ${plain.length > 1 ? "stay" : "stays"} plain and readable.`;
}

function joinAnd(xs: readonly string[]): string {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
}

export interface SpanInput {
  brief: string;
  page: PageAnatomy;
  platform: ServerPlatform;
  /** The mechanic's own part (an Atlas element), its mechanic element and its line. */
  main: { element: UiElement; mechanic: MechanicElement; how: string };
  /** The lead card's J4 line for an element, if any. */
  lineOf: (el: UiElement) => CardElementLine | undefined;
  /** J5 mechanics for an element, already loaded (none: only lines). */
  mechanicsOf?: (el: UiElement) => readonly Mechanic[];
  /** Elements the lead's J4b page reason names, in its order. */
  named: readonly UiElement[];
  /** Elements no part may reskin (a protected total, main button or plan cards). */
  forbidden: (el: UiElement) => boolean;
  /** How often earlier directions of this bend named each element. */
  used: ReadonlyMap<UiElement, number>;
  mustKeep: readonly string[];
  protect: ReadonlySet<MechanicElement>;
}

type Candidate = SpanPart & { score: number; order: number };

/** Score a wild spot with no section on this platform loses against the page's own sections. */
const SPOT_DROP = 3;

/** Names for a wild spot the page's sections do not show on this platform. */
const SPOT_LABEL: Partial<Record<UiElement, string>> = { progress: "progress bar", stepper: "steps", "paywall-plan": "plan cards", card: "cards", "list-row": "list", "empty-state": "empty state", "onboarding-slide": "slides", "chip-filter": "filter chips", "section-nav": "section tabs", "nav-tabs": "tabs", "bottom-nav": "tab bar" };

/**
 * The page's sections as candidate parts (one per element, with the page's label and a how line),
 * then its wild spots that no section shows on this platform.
 */
function candidates(input: SpanInput): Candidate[] {
  const sections = platformSections(input.page, input.platform);
  const wild = input.page.wildSpots.map((w) => w.element);
  const seen: UiElement[] = [input.main.element];
  const out: Candidate[] = [];
  const spots = wild.map((element) => ({ role: "", element, label: SPOT_LABEL[element] ?? element.replace(/-/g, " "), required: false, spot: true }));
  [...sections, ...spots].forEach((s, order) => {
    const el = s.element;
    if (seen.some((x) => samePart(x, el)) || input.forbidden(el)) return;
    seen.push(el);
    const line = input.lineOf(el);
    let how = line && line.buildability >= MIN_LINE ? clean(line.how) : "";
    if (!how) {
      const m = [...(input.mechanicsOf?.(el) ?? [])]
        .filter((x) => x.buildability >= MIN_LINE)
        .sort((a, b) => Number(b.pages.includes(input.page.id)) - Number(a.pages.includes(input.page.id)) || b.buildability - a.buildability || a.id.localeCompare(b.id))[0];
      if (m) how = clean(`${m.name}: ${lowerFirst(m.how.split(/[,;]/)[0] ?? m.how)}`);
    }
    if (!how) return;
    const kind = partKind(el, s.role);
    const named = input.named.indexOf(el);
    const score =
      (kind === "flow" ? 3 : kind === "structure" ? 2 : 0) +
      (kind === "surface" ? 0 : (TASK_RANK[el] ?? 0) * 0.5) +
      (wild.includes(el) ? 2 : 0) +
      (named >= 0 ? 3 - Math.min(2, named) * 0.5 : 0) +
      (s.required ? 1 : 0) +
      ((line?.buildability ?? 3) - 3) * 0.5 -
      1.5 * (input.used.get(el) ?? 0) -
      // A wild spot no section shows is a fallback: the page's own sections come first (r4-2 dry run).
      ("spot" in s ? SPOT_DROP : 0);
    out.push({ element: el, label: clean(lowerFirst(s.label)), how, kind, score, order });
  });
  return out.sort((a, b) => b.score - a.score || a.order - b.order);
}

/**
 * The page span for one direction: its own part, then the best page parts (flow and structure
 * first, the wild spots and the parts the page reason names next, the spread over the bend after),
 * so that at least one part is flow or structure; the main task through the part that carries it
 * most; and the must-keep line. Null when the page has no other usable part, or no flow or
 * structure part at all (the direction then keeps its one part, as before R4).
 */
export function spanPage(input: SpanInput): PageSpan | null {
  const pool = candidates(input);
  if (pool.length === 0) return null;
  const mainSection = platformSections(input.page, input.platform).find((s) => samePart(s.element, input.main.element));
  const main: SpanPart = {
    element: input.main.element,
    // A footer of links is not where tabs that switch sections live: the part keeps its own name then.
    label: clean(lowerFirst(mainSection && !(FRAME_ROLES.has(mainSection.role) && input.main.mechanic !== "header") ? mainSection.label : PART[input.main.mechanic])),
    how: clean(input.main.how),
    kind: partKind(input.main.element, mainSection?.role),
  };
  const picked: Candidate[] = [];
  if (main.kind === "surface") {
    const first = pool.find((p) => p.kind !== "surface");
    if (first) picked.push(first);
  }
  for (const p of pool) {
    if (picked.length >= MAX_PARTS - 1) break;
    if (!picked.includes(p)) picked.push(p);
  }
  picked.sort((a, b) => a.order - b.order);
  const parts: SpanPart[] = [main, ...picked.map(({ element, label, how, kind }) => ({ element, label, how, kind }))];
  if (parts.every((p) => p.kind === "surface")) return null;
  // The task runs through the part that carries it most; a wild spot or a required section of this
  // page counts more (r4-1: the plan preview of a coffee landing page and the agent card of a listing
  // were read as odd task carriers).
  const sections = platformSections(input.page, input.platform);
  const wild = new Set(input.page.wildSpots.map((w) => w.element));
  const rank = (p: SpanPart) =>
    p.kind === "surface" ? -1 : (TASK_RANK[p.element] ?? 0) + (wild.has(p.element) ? 1 : 0) + (sections.some((s) => samePart(s.element, p.element) && s.required) ? 0.5 : 0);
  const taskPart = parts.reduce((best, p) => (rank(p) > rank(best) ? p : best), parts[0]!);
  return { parts, task: taskSentence(input.brief, taskPart), keep: keepLine(input.mustKeep, input.protect) };
}

/** The layout line: the lead runs the page across its parts, then the main task, the other parts and the must keeps. */
export function spanLayout(leadName: string, pageLabel: string, span: PageSpan, grid: string): string {
  const names = joinAnd(span.parts.map((p) => `the ${p.label}`));
  // The task sentence already shows its part's line; the mechanic's own part is in mechanic.how.
  const others = span.parts
    .slice(1)
    .filter((p) => !span.task.includes(lowerFirst(p.how)))
    .map((p) => `${capital(p.label)}: ${lowerFirst(p.how)}.`);
  return [`${leadName} runs the ${pageLabel} across ${names}${grid}.`, span.task, ...others, span.keep].filter(Boolean).join(" ");
}
