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

/**
 * Titles name the idea in at most 4 words, never the brief: "GCC travel checkout drawn from Sadu"
 * read like a template (field report, 2026-10-12). The first template that fits the cap and is not
 * taken wins, so the plainest form comes first; the others only keep titles unique.
 */
/** Title from a single move (wildness 1 and 2, and wildness 3+ when the other move is the twist). */
export const SINGLE_TEMPLATES: Record<MoveId, readonly string[]> = {
  transplant: ["{Obj}", "{M} {obj}", "{Obj} remix"],
  material: ["All {mat}", "{Mat} everything", "{Mat}"],
  era: ["{Era} revival", "{Era}", "Back to {era}"],
  constraint: ["{Rule}"],
  scale: ["Giant {el}", "Huge {el}", "Billboard {el}"],
  lens: ["{Lens}", "Modern {lens}", "{Lens} remix"],
};

/**
 * Title from the two strongest moves, keyed by the pair in canonical move order.
 * Constraint is never in the headline pair (it always becomes the twist), so its pairs are absent.
 */
export const PAIR_TEMPLATES: Readonly<Record<string, readonly string[]>> = {
  "transplant+material": ["{Mat} {obj}", "{Obj} in {mat}"],
  "transplant+era": ["{Eralead} {obj}", "{Obj}, {era}"],
  "material+era": ["{Eralead} {mat}", "{Mat}, {era}"],
  "transplant+lens": ["{Lens} {obj}", "{Obj} in {lens}"],
  "material+lens": ["{Lens} in {mat}", "{Mat} {lens}"],
  "era+lens": ["{Eralead} {lens}", "{Lens}, {era}"],
  "transplant+scale": ["Giant {el} {obj}", "{Obj} of giant {el}"],
  "material+scale": ["Giant {mat} {el}", "{Mat} giant {el}"],
  "era+scale": ["{Eralead} giant {el}", "Giant {el}, {era}"],
  "scale+lens": ["{Lens}, giant {el}", "Giant {el} in {lens}"],
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
