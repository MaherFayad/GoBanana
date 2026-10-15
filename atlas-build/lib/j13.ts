/**
 * Shared parts of the P1-J13 stunning layer jobs (jobs/j13-shaders.ts, jobs/j13-motion.ts):
 * the inputs (J3 card family groups and J6 lens packs), the ties check, the culture rules and
 * the dedupe.
 *
 * Inputs read the J3 and J6 outputs from out/v1 (rebuild them with
 * `npx tsx run.ts j3-cards --from-raw` and `npx tsx run.ts j6-lenses --from-raw`).
 */
import { PATHS } from "../config.ts";
import type { IngredientCard, LensPack } from "../schema.ts";
import { readKind } from "./shards.ts";

export type CardGroup = { mode: "cards"; key: string; kind: IngredientCard["kind"]; families: string[]; cards: IngredientCard[]; count: number };
export type LensInput = { mode: "lens"; key: string; lens: LensPack; cards: IngredientCard[]; count: number };
export type J13Input = CardGroup | LensInput;

let cache: { cards: IngredientCard[]; lenses: LensPack[] } | null = null;

export function atlasInputs(): { cards: IngredientCard[]; lenses: LensPack[] } {
  if (cache) return cache;
  const cards = readKind<IngredientCard>(PATHS.out, "cards");
  const lenses = readKind<LensPack>(PATHS.out, "lenses");
  if (cards.length === 0 || lenses.length === 0) {
    throw new Error("J13 needs the J3 cards and J6 lenses in out/v1: run `npx tsx run.ts j3-cards --from-raw` and `npx tsx run.ts j6-lenses --from-raw` first");
  }
  cache = { cards, lenses };
  return cache;
}

const KIND_ORDER: IngredientCard["kind"][] = ["tradition", "material", "era", "element", "scale", "object", "constraint"];

/** Words that must appear in culturalNotes for a lens (the tradition named exactly). */
export const LENS_WORDS: Record<string, string[]> = {
  sadu: ["sadu"],
  talli: ["talli"],
  "qatt-asiri": ["qatt"],
  najdi: ["najdi", "najd"],
  "hejazi-roshan": ["roshan", "rawasheen", "hejaz"],
  kufic: ["kufic"],
  diwani: ["diwani"],
  "alula-strata": ["alula"],
  dhow: ["dhow"],
  "swiss-international": ["swiss", "international typographic"],
  "japanese-ma": ["japanese", " ma "],
  memphis: ["memphis"],
  bauhaus: ["bauhaus"],
  azulejo: ["azulejo"],
  zellige: ["zellige"],
  "block-print": ["block print", "block-print", "block printing"],
};

/** Evenly spaced picks, so a group's sample spans the whole family (deterministic). */
function spread<T>(items: readonly T[], n: number): T[] {
  if (items.length <= n) return [...items];
  return Array.from({ length: n }, (_, i) => items[Math.floor((i * items.length) / n)]!);
}

/**
 * Card family groups (up to 3 families of one kind each, about 23 groups) and one input per lens.
 * `perGroup` and `perLens` are the records each request asks for.
 */
export function j13Inputs(perGroup: number, perLens: number, sample = 14): J13Input[] {
  const { cards, lenses } = atlasInputs();
  const out: J13Input[] = [];
  for (const lens of lenses) {
    const words = LENS_WORDS[lens.id] ?? [lens.id];
    const related = cards.filter((c) => words.some((w) => w.trim().length > 2 && `${c.name} ${c.culturalNotes ?? ""}`.toLowerCase().includes(w.trim())));
    out.push({ mode: "lens", key: `lens-${lens.id}`, lens, cards: related.slice(0, 6), count: perLens });
  }
  for (const kind of KIND_ORDER) {
    const fams = [...new Set(cards.filter((c) => c.kind === kind).map((c) => c.family))].sort();
    for (let i = 0; i < fams.length; i += 3) {
      const families = fams.slice(i, i + 3);
      const pool = families.flatMap((f) => spread(cards.filter((c) => c.kind === kind && c.family === f).sort((a, b) => a.id.localeCompare(b.id)), Math.ceil(sample / families.length)));
      out.push({ mode: "cards", key: `${kind}-${i / 3 + 1}`, kind, families, cards: pool.slice(0, sample), count: perGroup });
    }
  }
  return out;
}

const hexes = (c: IngredientCard | LensPack) => c.palette.map((p) => `${p.hex} ${p.role} (${p.name})`).join(", ");

/** Card lines for a prompt. `focus` picks the card fields the job needs. */
export function cardLines(cards: readonly IngredientCard[], focus: "texture" | "motion"): string {
  return cards
    .map((c) => {
      const f = focus === "texture" ? `texture: ${c.texture}` : `motion: ${c.motion.verb}, ${c.motion.ms} ms; reduced: ${c.motion.reduced}`;
      return `- ${c.id} | ${c.name} | ${c.kind}, ${c.family}${c.region ? `, ${c.region}` : ""}\n  idea: ${c.idea}\n  ${f}\n  palette: ${hexes(c)}${c.culturalNotes ? `\n  cultural notes: ${c.culturalNotes}` : ""}`;
    })
    .join("\n");
}

/** The lens facts a prompt needs (no motif SVG). */
export function lensFacts(l: LensPack): string {
  return [
    `Lens id: ${l.id}. Name: ${l.name}. Region: ${l.region}.`,
    `Story: ${l.story}`,
    `Credit: ${l.credit}`,
    `Shape grammar: ${l.shapeGrammar.join("; ")}`,
    `Rhythm: ${l.rhythm}`,
    `Motion verb: ${l.motionVerb}`,
    `Palette: ${hexes(l)}`,
    `Do: ${l.dos.join("; ")}`,
    `Don't: ${l.donts.join("; ")}`,
  ].join("\n");
}

/** The culture rules for both jobs (the J6 rules, for code and motion instead of a motif tile). */
export const CULTURE_RULES = `Culture rules (never break):
- Name the tradition exactly in culturalNotes: the people who make it, the region, the medium, as the lens or card gives them. If a fact is not in the request and you are not sure of it, leave it out. Never invent what a pattern means.
- Never use sacred or Quranic text, names of God, the shahada, religious symbols, flags or national emblems as decoration, texture or pattern. Do not draw them, and do not name them as the idea.
- Never draw real script as random pattern, and never fake script. A calligraphic lens (Square Kufic, Diwani) gives only construction: the grid, the baseline, the stroke rhythm and slant. Never letters or letter-like glyphs.
- No cliches as shorthand for a region: no camels, dunes, palm trees, lanterns, oil, "Arabian Nights" looks or generic arabesque. The same for every culture's tourist cliches.
- The Gulf is not the Levant, the Maghreb, Turkey or Iran. Keep the region exact.
- Borrow grammar (rhythm, repeat, proportion, color ratio, how it is made), never a copied artwork or a picture of an object or building.`;

/** Words that must not be the idea of a record (flags, sacred text and symbols as decoration). */
const BANNED = /\b(flags?|quran\w*|qur'an\w*|shahada|allah|scriptures?|holy verses?|sacred text|national emblems?|crescent moons?|crucifix\w*)\b/i;

type Tied = { id: string; name: string; idea: string; cardIds: string[]; families: string[]; lensIds: string[]; culturalNotes?: string };

/** prepare step: keep known card and lens ids, force the lens of a lens request, compute families. */
export function prepareTies(raw: unknown, input: J13Input): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const { cards, lenses } = atlasInputs();
  const byId = new Map(cards.map((c) => [c.id, c]));
  const lensIds = new Set(lenses.map((l) => l.id));
  const r = { ...(raw as Record<string, unknown>) };
  const cardIds = (Array.isArray(r.cardIds) ? r.cardIds : []).filter((x): x is string => typeof x === "string" && byId.has(x));
  const lensList = (Array.isArray(r.lensIds) ? r.lensIds : []).filter((x): x is string => typeof x === "string" && lensIds.has(x));
  if (input.mode === "lens" && !lensList.includes(input.lens.id)) lensList.unshift(input.lens.id);
  r.cardIds = [...new Set(cardIds)];
  r.lensIds = [...new Set(lensList)];
  r.families = [...new Set(cardIds.map((id) => byId.get(id)!.family))].sort();
  return r;
}

/** check step: at least one tie, the culture rules on names and notes. */
export function checkTies(rec: Tied): string[] {
  const out: string[] = [];
  const { cards } = atlasInputs();
  const byId = new Map(cards.map((c) => [c.id, c]));
  if (rec.cardIds.length === 0 && rec.lensIds.length === 0) out.push("ties to no J3 card and no J6 lens");
  const notes = ` ${(rec.culturalNotes ?? "").toLowerCase()} `;
  const tradition = rec.cardIds.some((id) => byId.get(id)?.kind === "tradition");
  if ((rec.lensIds.length > 0 || tradition) && !rec.culturalNotes) out.push("culturalNotes is required with a lens or a tradition card");
  for (const l of rec.lensIds) {
    const words = LENS_WORDS[l] ?? [l];
    if (rec.culturalNotes && !words.some((w) => notes.includes(w))) out.push(`culturalNotes must name the ${l} tradition exactly`);
  }
  if (BANNED.test(`${rec.name} ${rec.idea}`)) out.push("name or idea uses flags, sacred text or religious symbols");
  return out;
}

/**
 * finalize step: unique ids (a repeat gets "-2", "-3"; renamed in place so the runner still knows
 * each record's input), exact duplicates dropped.
 */
export function uniqueIds<T extends { id: string }>(records: readonly T[], same: (r: T) => string): T[] {
  const seen = new Set<string>();
  const bodies = new Set<string>();
  const out: T[] = [];
  for (const r of records) {
    const body = same(r);
    if (bodies.has(body)) continue;
    bodies.add(body);
    let id = r.id.slice(0, 48).replace(/-+$/, "");
    for (let n = 2; seen.has(id); n++) id = `${r.id.slice(0, 45).replace(/-+$/, "")}-${n}`;
    seen.add(id);
    r.id = id;
    out.push(r);
  }
  return out;
}

/** The repair message shared by both jobs. */
export function repairText(kind: string, record: object, problems: readonly string[], context: string): string {
  const { families: _f, css: _c, ...rest } = record as Record<string, unknown>;
  return `This ${kind} failed the render check in headless Chrome. Fix every problem below and keep its idea, id and ties. Reply with the one corrected ${kind} object.

Problems:
${problems.map((p) => `- ${p}`).join("\n")}

The record that failed:
\`\`\`json
${JSON.stringify(rest, null, 1)}
\`\`\`

What it was written for:
${context}`;
}

export function inputContext(input: J13Input | undefined, focus: "texture" | "motion"): string {
  if (!input) return "(no input)";
  return input.mode === "lens" ? lensFacts(input.lens) : `Cards from ${input.families.join(", ")}:\n${cardLines(input.cards.slice(0, 6), focus)}`;
}
