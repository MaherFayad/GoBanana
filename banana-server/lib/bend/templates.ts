import type { MoveId } from "./types";

/**
 * Title, twist and prompt templates. Plain words only, no em dashes.
 *
 * Tokens name a role. Each move fills one role with its list entry:
 *   transplant {obj}   material {mat}   era {era}   constraint {rule}
 *   scale {el}         lens {lens}      plus {m} mood, {subj} subject, {head} last two subject words
 * Prefix "a-" adds "a" or "an" to the phrase: {a-obj}, {a-m-obj} ("a neon-lit matchbook").
 * Hyphens join several roles into one phrase: {mat-obj} ("frosted glass vinyl record sleeve").
 * A capital first letter capitalizes the result: {Subj}, {Era}, {A-obj}.
 * {eralead} and {matlead} are the era or material placed right before the subject; they are only
 * filled for entries that read well there (list entries with "leads": false skip those templates).
 */

/** Role each move fills in templates. */
export const ROLE: Record<MoveId, string> = {
  transplant: "obj",
  material: "mat",
  era: "era",
  constraint: "rule",
  scale: "el",
  lens: "lens",
};

/** Headline from a single move (wildness 1 and 2, and wildness 3+ when the other move is the twist). */
export const SINGLE_TEMPLATES: Record<MoveId, readonly string[]> = {
  transplant: [
    "{Subj} as {a-obj}",
    "{Subj} as {a-m-obj}",
    "What if the {head} were {a-m-obj}",
    "{Subj} printed on {a-obj}",
    "{Subj} that works like {a-obj}",
    "{Subj} hiding inside {a-m-obj}",
    "Turn the {head} into {a-m-obj}",
  ],
  material: [
    "{Subj} made of {mat}",
    "{Subj} in {mat}",
    "{Matlead} {subj}",
    "{Subj} you could touch, all {mat}",
    "{Subj} wrapped in {mat}",
    "{Subj} rendered in {m} {mat}",
    "{Subj} built from {mat}",
  ],
  era: [
    "{Subj} straight out of {era}",
    "{Subj}, {era} edition",
    "{Eralead} {subj}",
    "{Subj}, rewound to {era}",
    "{Subj} smuggled back to {era}",
    "{Subj} as seen in {era}",
  ],
  constraint: [
    "{Subj}, but {rule}",
    "{Subj} with one rule: {rule}",
    "{Subj} on a strict diet: {rule}",
    "Strip the {head} down: {rule}",
    "{Subj} under one law: {rule}",
    "{Subj}, rule one: {rule}",
  ],
  scale: [
    "{Subj} with giant {el}",
    "Tiny {head}, huge {el}",
    "{Subj} where the {el} are the size of buildings",
    "{Subj} at billboard scale, all {el}",
    "{Subj} drowned in oversized {el}",
    "{Subj} built from oversized {el}",
  ],
  lens: [
    "{Subj} through the eyes of {lens}",
    "{Subj} in the language of {lens}",
    "{Subj} drawn from {lens}",
    "{Subj} meets {lens}",
    "{Subj}, patterned after {lens}",
    "{Subj} with the rhythm of {lens}",
  ],
};

/**
 * Headline from the two strongest moves, keyed by the pair in canonical move order.
 * Constraint is never in the headline pair (it always becomes the twist), so its pairs are absent.
 */
export const PAIR_TEMPLATES: Readonly<Record<string, readonly string[]>> = {
  "transplant+material": [
    "{Subj} as {a-obj} in {mat}",
    "{Subj} in {mat}, sold like {a-obj}",
    "{Subj} as {a-obj}, all {mat}",
    "{Matlead} {subj}, folded into {a-obj}",
    "{Subj} in {mat}, packaged like {a-obj}",
    "What if the {head} were {a-obj} in {mat}",
    "{Subj} printed on {a-obj} made of {mat}",
  ],
  "transplant+era": [
    "{Subj} as {a-obj} from {era}",
    "{Eralead} {subj}, packaged like {a-obj}",
    "{Subj} as {a-obj}, {era} style",
    "{Subj} printed on {a-obj} from {era}",
    "{Subj} as {a-obj}, {era} edition",
    "{Subj} smuggled into {era} as {a-obj}",
  ],
  "material+era": [
    "{Eralead} {subj} in {mat}",
    "{Subj} in {mat}, rewound to {era}",
    "{Matlead} {subj} straight out of {era}",
    "{Subj} cast in {mat}, {era} edition",
    "{Subj} in {mat}, as seen in {era}",
    "{Eralead} {subj}, all {mat}",
  ],
  "transplant+lens": [
    "{Subj} as {a-obj} patterned with {lens}",
    "{Subj} meets {lens}, sold like {a-obj}",
    "{Subj} as {a-obj} in the language of {lens}",
    "{Subj} printed on {a-obj}, after {lens}",
    "{Subj} as {a-obj} drawn from {lens}",
    "{Subj} meets {lens}, packaged like {a-obj}",
    "{Subj} as {a-obj} with the rhythm of {lens}",
    "{Subj} as {a-obj}, after {lens}",
  ],
  "material+lens": [
    "{Subj} in {mat}, patterned after {lens}",
    "{Subj} meets {lens}, all in {mat}",
    "{Matlead} {subj} with the rhythm of {lens}",
    "{Matlead} {subj}, after {lens}",
    "{Subj} drawn from {lens}, finished in {mat}",
    "{Matlead} {subj} in the language of {lens}",
  ],
  "era+lens": [
    "{Eralead} {subj} meets {lens}",
    "{Subj} meets {lens}, rewound to {era}",
    "{Subj} patterned after {lens}, {era} style",
    "{Subj} drawn from {lens}, {era} edition",
    "{Eralead} {subj} with the rhythm of {lens}",
    "{Subj} in the language of {lens}, {era} edition",
  ],
  "transplant+scale": [
    "{Subj} as {a-obj} with giant {el}",
    "{Subj} as {a-obj}, {el} blown up huge",
    "{Subj} printed on {a-obj}, all oversized {el}",
    "Tiny {head}, huge {el}, packaged like {a-obj}",
    "{Subj} as {a-obj} buried in giant {el}",
    "{Subj} folded into {a-obj} with billboard {el}",
  ],
  "material+scale": [
    "{Subj} in {mat} with giant {el}",
    "{Matlead} {subj}, {el} blown up huge",
    "Giant {el} in {mat} run the {head}",
    "{Subj} built from oversized {el} in {mat}",
    "Tiny {head}, huge {el}, all {mat}",
    "{Subj} in {mat}, {el} at billboard size",
  ],
  "era+scale": [
    "{Eralead} {subj} with giant {el}",
    "{Subj}, {era} style, {el} blown up huge",
    "Tiny {head}, huge {el}, straight out of {era}",
    "{Subj} rewound to {era}, all oversized {el}",
    "{Subj} as seen in {era}, with giant {el}",
    "{Eralead} {subj} built from oversized {el}",
  ],
  "scale+lens": [
    "{Subj} meets {lens}, with giant {el}",
    "{Subj} patterned after {lens}, {el} blown up huge",
    "Tiny {head}, huge {el}, patterned after {lens}",
    "{Subj} with giant {el} drawn from {lens}",
    "{Subj} with the rhythm of {lens} and giant {el}",
    "Oversized {el} meet {lens} on the {head}",
  ],
};

/** One short line carrying the third move, or a constraint or scale garnish. Shown after "Twist:". */
export const TWIST_TEMPLATES: Record<MoveId | "mood", readonly string[]> = {
  transplant: [
    "folded into {a-obj}",
    "packaged like {a-obj}",
    "it ships as {a-obj}",
    "printed on {a-obj}",
    "shaped like {a-obj}",
    "the wear of {a-obj}",
  ],
  material: [
    "every surface in {mat}",
    "finished in {mat}",
    "trimmed in {mat}",
    "buttons made of {mat}",
    "edges cast in {mat}",
    "the whole thing in {mat}",
  ],
  era: [
    "type and color from {era}",
    "rewound to {era}",
    "colors lifted from {era}",
    "straight out of {era}",
    "styled like {era}",
    "a grid borrowed from {era}",
  ],
  constraint: [
    "{rule}",
    "{rule}, no exceptions",
    "{rule}, start to finish",
    "{rule}, nothing breaks it",
    "{rule}, end to end",
    "house rule: {rule}",
  ],
  scale: [
    "{el} blown up huge",
    "giant {el} everywhere",
    "{el} at billboard size",
    "{el} the size of buildings",
    "oversized {el} crowd the edges",
    "{el} as big as the screen",
  ],
  lens: [
    "patterned after {lens}",
    "borders from {lens}",
    "colors from {lens}",
    "the rhythm of {lens}",
    "trimmed with {lens}",
    "{lens} in the margins",
  ],
  mood: [
    "{a-m} mood throughout",
    "{m} all over",
    "mood: {m}",
    "shot in {m} tones",
    "{m} mood, start to finish",
    "dial the mood to {m}",
  ],
};

/** One sentence per move in the direction prompt. */
export const PROMPT_CLAUSES: Record<MoveId, string> = {
  transplant: "Borrow the format, print details and wear of {a-obj}.",
  material: "Render every surface as {mat}, with real light and shadow.",
  era: "Take type, color and grid from {era}.",
  constraint: "Obey one hard rule: {rule}.",
  scale: "Make the {el} enormous and shrink everything else.",
  lens: "Build pattern, rhythm and color from {lens}.",
};

export const PROMPT_OPENING = "Redesign the {subj}.";

/**
 * Template list sizes in bend-v1. The old title picker shuffled each list on first use with the
 * same seeded stream that picks moves and entries, so the engine still spends those draws to keep
 * every direction id unchanged. Never edit these numbers.
 */
export const LEGACY_TEMPLATE_SIZES: {
  primary: Record<MoveId, number>;
  modifier: Record<MoveId, number>;
} = {
  primary: { transplant: 8, material: 7, era: 6, constraint: 5, scale: 7, lens: 6 },
  modifier: { transplant: 5, material: 5, era: 4, constraint: 3, scale: 4, lens: 4 },
};

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

/** Values for template roles: subj, head, m, and any of obj, mat, era, rule, el, lens. */
export type TemplateVars = Record<string, string | undefined>;

const TOKEN = /\{([A-Za-z]+(?:-[A-Za-z]+)*)\}/g;

/** Roles a template uses, lowercased, without the article prefix. */
export function templateRoles(template: string): string[] {
  const roles = new Set<string>();
  for (const [, token] of template.matchAll(TOKEN)) {
    const parts = (token ?? "").toLowerCase().split("-");
    for (const p of parts[0] === "a" && parts.length > 1 ? parts.slice(1) : parts) roles.add(p);
  }
  return [...roles];
}

/** True when every role the template uses has a value. */
export function canRender(template: string, vars: TemplateVars): boolean {
  return templateRoles(template).every((r) => Boolean(vars[r]));
}

/** Fill a template. Throws when a role has no value, so a bad template never ships half rendered. */
export function render(template: string, vars: TemplateVars): string {
  return template.replace(TOKEN, (_, token: string) => {
    const parts = token.split("-");
    const upper = /^[A-Z]/.test(token);
    const withArticle = parts.length > 1 && parts[0]?.toLowerCase() === "a";
    const names = withArticle ? parts.slice(1) : parts;
    const phrase = names
      .map((n) => {
        const v = vars[n.toLowerCase()];
        if (v === undefined || v === "") throw new Error(`Template role {${n}} has no value: ${template}`);
        return v;
      })
      .join(" ");
    const out = withArticle ? `${article(phrase)} ${phrase}` : phrase;
    return upper ? capitalize(out) : out;
  });
}
