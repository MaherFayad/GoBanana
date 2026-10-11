import type { MoveId } from "./types";

/**
 * Title and prompt templates. Tokens:
 *   {Subj} subject, capitalized   {subj} subject   {head} last word of the subject
 *   {x} the move's list entry     {X} entry, capitalized   {ax} entry with "a" or "an"
 *   {m} mood                      {amx} "a" or "an" + mood + entry
 * Plain words only, no em dashes.
 */

/** Opening clause when the move leads the direction. */
export const PRIMARY_TEMPLATES: Record<MoveId, readonly string[]> = {
  transplant: [
    "{Subj} as {ax}",
    "{Subj} as {amx}",
    "What if the {head} were {amx}",
    "{Subj} printed on {ax}",
    "{Subj} that behaves like {ax}",
    "{Subj} hiding inside {amx}",
    "{Subj}, reimagined as {ax}",
    "Turn the {head} into {amx}",
  ],
  material: [
    "{Subj} made of {x}",
    "{Subj} rendered in {x}",
    "{Subj} built from {x}",
    "{Subj} you could touch: {x}",
    "{Subj}, all {x}",
    "{Subj} wrapped in {x}",
    "{X} {subj}",
  ],
  era: [
    "{Subj} straight out of {x}",
    "{Subj}, {x} edition",
    "{X} {subj}",
    "{Subj}, rewound to {x}",
    "{Subj} smuggled back to {x}",
    "If {x} designed the {head}",
  ],
  constraint: [
    "{Subj}, but {x}",
    "{Subj} with one rule: {x}",
    "{Subj} on a strict diet: {x}",
    "Strip the {head} down: {x}",
    "{Subj} under one law: {x}",
  ],
  scale: [
    "{Subj} with giant {x}",
    "Tiny {head}, huge {x}",
    "{Subj} where the {x} are the size of buildings",
    "{Subj} at billboard scale, all {x}",
    "{Subj} drowned in oversized {x}",
    "{Subj} built from oversized {x}",
    "Zoom into the {head} until the {x} fill the room",
  ],
  lens: [
    "{Subj} through the eyes of {x}",
    "{Subj} in the language of {x}",
    "{Subj} drawn from {x}",
    "{X} meets {subj}",
    "{Subj}, patterned after {x}",
    "{Subj} with the rhythm of {x}",
  ],
};

/** Phrase appended when the move joins a combination. Constraint always goes last. */
export const MODIFIER_TEMPLATES: Record<MoveId, readonly string[]> = {
  transplant: [
    " shaped like {ax}",
    ", folded into {ax}",
    " inside {amx}",
    ", styled as {ax}",
    ", packaged like {ax}",
  ],
  material: [" in {x}", ", finished in {x}", " made of {x}", ", all {x}", ", cast in {x}"],
  era: [", {x} style", " straight out of {x}", ", {x} edition", ", rewound to {x}"],
  constraint: [", but {x}", " with one rule: {x}", ", under one rule: {x}"],
  scale: [" with giant {x}", ", {x} blown up huge", " with oversized {x}", ", {x} at billboard size"],
  lens: [
    ", in the language of {x}",
    ", through {x}",
    ", with the rhythm of {x}",
    ", patterned after {x}",
  ],
};

/** One sentence per move in the direction prompt. */
export const PROMPT_CLAUSES: Record<MoveId, string> = {
  transplant: "Borrow the format, print details and wear of {ax}.",
  material: "Render every surface as {x}, with real light and shadow.",
  era: "Take type, color and grid from {x}.",
  constraint: "Obey one hard rule: {x}.",
  scale: "Make the {x} enormous and shrink everything else.",
  lens: "Build pattern, rhythm and color from {x}.",
};

export const PROMPT_OPENING = "Redesign the {subj}.";

export function article(phrase: string): "a" | "an" {
  const p = phrase.trim().toLowerCase();
  if (/^(uni|use|usu|eu|one|once)/.test(p)) return "a";
  if (/^(hour|honest|honor|heir)/.test(p)) return "an";
  if (/^(8|11|18|80)/.test(p)) return "an";
  return /^[aeiou]/.test(p) ? "an" : "a";
}

export function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export interface TemplateVars {
  subj: string;
  head: string;
  x: string;
  m: string;
}

export function render(template: string, v: TemplateVars): string {
  const moodX = `${v.m} ${v.x}`;
  return template.replace(/\{(Subj|subj|head|X|x|ax|amx|m)\}/g, (_, token: string) => {
    switch (token) {
      case "Subj":
        return capitalize(v.subj);
      case "subj":
        return v.subj;
      case "head":
        return v.head;
      case "X":
        return capitalize(v.x);
      case "x":
        return v.x;
      case "ax":
        return `${article(v.x)} ${v.x}`;
      case "amx":
        return `${article(moodX)} ${moodX}`;
      case "m":
        return v.m;
      default:
        return token;
    }
  });
}
