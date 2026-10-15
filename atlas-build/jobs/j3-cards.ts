/**
 * P1-J3 Ingredient cards (docs/next-step-plan.md 6.3): about 800 IngredientCard records on Opus,
 * batch.
 *
 * Two kinds of request:
 * - "list": 4 words from one banana-server/lib/bend/lists/*.json list (moods are not a card kind
 *   and are skipped). The model keeps strong words as full cards and drops weak ones with a reason.
 *   The list's hints (tone, voice, color, texture, motion, pattern) seed each card, and lens data
 *   from lenses.json seeds the matching traditions.
 * - "gap": cards for what the lists miss: Gulf traditions, objects and materials named here, the
 *   empty "scale" kind, and themed gaps the model fills with new words.
 *
 * The script, never the model, sets: id (from the list word or name), kind, family for objects in
 * lib/bend/families.ts, region for traditions named in lib/bend/market.ts, canonical Google Fonts
 * spelling, and shipPairs (lib/contrast.ts).
 *
 *   npx tsx run.ts j3-cards --dry
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OPUS, PATHS } from "../config.ts";
import type { FontIndex } from "../lib/fonts.ts";
import { checkCardFonts, defineJob, withShipPairs } from "../lib/job.ts";
import { PROMPT_RULES, typeText } from "../lib/prompt.ts";
import { extractJson } from "../lib/validate.ts";
import { IngredientCardSchema, type IngredientCard } from "../schema.ts";
import { TYPE_VOICES } from "../../banana-server/lib/direction-detail.ts";
import { OBJECT_FAMILIES } from "../../banana-server/lib/bend/families.ts";

const BEND = join(import.meta.dirname, "..", "..", "banana-server", "lib", "bend");

type Kind = IngredientCard["kind"];
type RawEntry = string | ({ label: string } & Record<string, unknown>);
type LensJson = {
  id: string;
  name: { en: string; ar: string };
  region: string;
  tier: string;
  meaning: string;
  uiMappings: Array<{ element: string; grammar: string; mechanic: string }>;
  sacredOrProtected: string[];
  arabicFont?: { family: string };
};

type Word = { label: string; hints: string; lens?: LensJson };
type Input =
  | { mode: "list"; list: string; kind: Kind; n: number; words: Word[] }
  | { mode: "gap"; key: string; kind: Kind; theme: string; count: number; words?: Word[]; region?: string };

// ---------------------------------------------------------------------------------------------
// Taxonomy. Card families are a closed set so the bend engine can spread picks over them (plan
// P1-I2 MMR over family and kind) and J2 domains can name them in fitsFamilies.

/** Families per kind. Object families are lib/bend/families.ts names plus two for the rest. */
export const CARD_FAMILIES: Readonly<Record<Kind, readonly string[]>> = {
  object: [...Object.keys(OBJECT_FAMILIES), "game, toy or sport gear", "tool, vessel or keepsake", "device or instrument"],
  material: [
    "glass and clear plastic", "metal", "stone, earth and mineral", "paper and print", "textile and fiber",
    "wood, cane and plant", "soft, rubber or inflatable", "liquid, wax and candy", "foil, gloss and iridescence",
  ],
  era: [
    "early modernism and avant-garde", "deco and streamline", "mid-century and space age", "pop, psychedelic and disco",
    "postmodern and 1980s", "digital and internet", "street, club and subculture", "regional modernism",
    "future and speculative", "ornament and craft revival",
  ],
  tradition: [
    "woven and knotted textile", "embroidery and stitch", "printed and dyed cloth", "tile and ceramic",
    "architecture and woodwork", "paper craft", "painting and folk art", "popular print and sign painting",
    "metal, bead and jewelry", "lettering and calligraphy", "gathering and hospitality",
  ],
  constraint: ["type rule", "color rule", "layout rule", "shape and line rule", "image rule", "motion and time rule", "data rule"],
  scale: ["tiny made huge", "huge made tiny", "microscopic", "aerial and cosmic", "body and hand"],
  element: [
    "glyphs and punctuation", "marks and stamps", "controls and UI bits", "shapes and patterns", "nature motifs",
    "data marks", "office and paper bits", "symbols and signs", "script and lettering",
  ],
};
const FAMILY_SET = new Map<Kind, Set<string>>(Object.entries(CARD_FAMILIES).map(([k, v]) => [k as Kind, new Set(v)]));

const OBJECT_FAMILY_OF = new Map(Object.entries(OBJECT_FAMILIES).flatMap(([f, keys]) => keys.map((k) => [k.toLowerCase(), f] as const)));

// ---------------------------------------------------------------------------------------------
// Repo inputs.

const LISTS: Array<{ list: string; kind: Kind }> = [
  { list: "traditions", kind: "tradition" },
  { list: "objects", kind: "object" },
  { list: "materials", kind: "material" },
  { list: "eras", kind: "era" },
  { list: "elements", kind: "element" },
  { list: "constraints", kind: "constraint" },
];

function readList(list: string): RawEntry[] {
  return JSON.parse(readFileSync(join(BEND, "lists", `${list}.json`), "utf8")) as RawEntry[];
}
const labelOf = (e: RawEntry) => (typeof e === "string" ? e : e.label);

/** market.ts imports server aliases, so its two tradition sets are read from the source text. */
function marketSets(): { gulf: Set<string>; mena: Set<string> } {
  const src = readFileSync(join(BEND, "market.ts"), "utf8");
  const strings = (block: string) => new Set([...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]!));
  const gulf = /const GULF_TRADITIONS = \[([\s\S]*?)\];/.exec(src)?.[1];
  const mena = /mena: new Set\(\[([\s\S]*?)\]\)/.exec(src)?.[1];
  if (!gulf || !mena) throw new Error("market.ts tradition sets not found");
  return { gulf: strings(gulf), mena: strings(mena) };
}
const MARKET = marketSets();

const LENSES = JSON.parse(readFileSync(join(BEND, "lenses.json"), "utf8")) as LensJson[];
const lens = (id: string) => LENSES.find((l) => l.id === id);
/** Card word (list label or gap word) to the lens that carries its meaning and care lines. */
const LENS_FOR: Record<string, string> = {
  "Sadu weaving": "sadu",
  "Najdi painted doors": "najdi",
  "Najdi mud architecture": "najdi",
  "Square Kufic lettering": "kufic",
  "mashrabiya screens": "mashrabiya",
  "Emirati talli braiding": "talli",
  "Al Qatt Al Asiri": "qatt-asiri",
  "Rijal Almaa stone villages": "qatt-asiri",
  "AlUla sandstone strata": "desert-modern",
  "Memphis 1981": "memphis",
  "Swiss style 1960s": "swiss-international",
};

/** The list entry's hints as one short line for the prompt. */
function hintLine(e: RawEntry): string {
  if (typeof e === "string") return "";
  const parts: string[] = [];
  const add = (k: string, label: string) => {
    const v = e[k];
    if (typeof v === "string" && v) parts.push(`${label}: ${v}`);
    else if (Array.isArray(v) && v.length) parts.push(`${label}: ${v.join(", ")}`);
  };
  add("tone", "tone");
  if (typeof e.w === "number") parts.push(`weirdness ${e.w} of 3`);
  add("voice", "voice");
  add("color", "color");
  add("tex", "texture");
  add("motion", "motion");
  add("pattern", "UI pattern");
  add("layout", "layout");
  add("img", "imagery");
  add("art", "art");
  add("style", "style");
  return parts.join("; ");
}

function word(label: string, hints = ""): Word {
  const l = LENS_FOR[label] ? lens(LENS_FOR[label]) : undefined;
  return { label, hints, ...(l ? { lens: l } : {}) };
}

// Gap words the owner's market needs most, named here (not left to the model) so names and
// places are right. Gulf first (market.ts, P0-07).
const GULF_TRADITIONS = [
  "Square Kufic lettering", "Najdi mud architecture", "Emirati khoos palm weaving", "Bahraini naqsh gypsum carving",
  "Hejazi coral stone houses", "Emirati barjeel wind towers", "Gulf dhow building", "Omani carved wooden doors",
  "Bisht zari edging", "Arabic coffee and the dallah", "Majlis gathering space", "Taif rose harvest",
  "Bahraini pearling heritage", "Gulf henna patterns", "Rijal Almaa stone villages", "barasti palm frond houses",
];
const GULF_OBJECTS = [
  "karak tea glass", "date shop gift box", "hand-painted souq shop sign", "mabkhara incense burner",
  "Gulf wedding invitation card", "Arabic typewriter keys", "pearl merchant's scales", "qalam reed pen",
  "eidiya money envelope", "bilingual baqala receipt",
];
const GULF_MATERIALS = ["AlUla sandstone strata", "frankincense resin", "coral stone blocks", "date palm trunk", "desert rose crystal"];

const THEMED_GAPS: Array<{ kind: Kind; theme: string; count: number }> = [
  { kind: "scale", theme: "tiny things blown up to fill a screen", count: 8 },
  { kind: "scale", theme: "huge things shrunk to fit in a hand", count: 8 },
  { kind: "scale", theme: "the microscopic: cells, crystals, fibers, grains", count: 8 },
  { kind: "scale", theme: "aerial, satellite and cosmic views", count: 8 },
  { kind: "scale", theme: "body and hand scale: things sized to a finger, palm or step", count: 8 },
  { kind: "object", theme: "science, medicine and lab objects", count: 6 },
  { kind: "object", theme: "sport, play and games", count: 6 },
  { kind: "object", theme: "kitchens and food packaging around the world", count: 6 },
  { kind: "object", theme: "offices, archives and paperwork", count: 6 },
  { kind: "object", theme: "music and audio gear", count: 6 },
  { kind: "object", theme: "everyday objects of East and South Asia", count: 6 },
  { kind: "object", theme: "everyday objects of Africa and Latin America", count: 6 },
  { kind: "object", theme: "tools of making: workshops, studios and print shops", count: 6 },
  { kind: "material", theme: "architecture and construction materials", count: 6 },
  { kind: "material", theme: "food and kitchen materials", count: 6 },
  { kind: "material", theme: "natural materials: minerals, plants and shells", count: 6 },
  { kind: "era", theme: "documented design eras of the Arab world, Iran and Turkey", count: 5 },
  { kind: "era", theme: "design eras of East and South Asia", count: 6 },
  { kind: "era", theme: "design eras of Africa and Latin America", count: 6 },
  { kind: "era", theme: "internet and product design aesthetics from 2015 to 2025", count: 5 },
  { kind: "element", theme: "elements of Arabic script and right to left typography (real letters and words only)", count: 6 },
  { kind: "element", theme: "elements of data visualization and dashboards", count: 6 },
  { kind: "element", theme: "elements of maps, transit and wayfinding", count: 6 },
  { kind: "constraint", theme: "constraints that work equally well in Arabic and Latin script", count: 8 },
  { kind: "constraint", theme: "constraints about motion, time and sequence", count: 6 },
  { kind: "constraint", theme: "constraints about numbers and data", count: 6 },
  { kind: "tradition", theme: "crafts of Central and South Asia not yet in the catalog", count: 5 },
  { kind: "tradition", theme: "crafts of the Pacific, Oceania and the Arctic not yet in the catalog", count: 5 },
];

const RESTORE: Array<[Kind, string[]]> = [
  ["tradition", ["Hejazi rawashin windows", "Delft blue pottery"]],
  ["material", ["woven rattan", "glazed ceramic"]],
  ["constraint", ["only space separates groups", "each view one solid color"]],
];
const RESTORE_THEME =
  "words restored after a first pass dropped both words of a near-duplicate pair (rawashin vs Hejazi coral stone houses, Delft vs gzhel, woven rattan vs cane webbing, glazed ceramic vs ceramic tile glaze, only space separates groups vs no cards no boxes, each view one solid color vs one color field per section); keep each one and make it clearly distinct from its partner";

const slug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function chunk<T>(xs: readonly T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

function loadAll(): Input[] {
  const inputs: Input[] = [];
  // Gulf gaps first: they matter most and the --limit 5 trial covers them.
  chunk(GULF_TRADITIONS, 4).forEach((ws, i) =>
    inputs.push({ mode: "gap", key: `gulf-tradition-${i + 1}`, kind: "tradition", theme: "Gulf traditions", count: ws.length, region: "gulf", words: ws.map((w) => word(w)) }),
  );
  chunk(GULF_OBJECTS, 5).forEach((ws, i) =>
    inputs.push({ mode: "gap", key: `gulf-object-${i + 1}`, kind: "object", theme: "Gulf everyday objects", count: ws.length, region: "gulf", words: ws.map((w) => word(w)) }),
  );
  inputs.push({ mode: "gap", key: "gulf-material-1", kind: "material", theme: "Gulf materials", count: GULF_MATERIALS.length, region: "gulf", words: GULF_MATERIALS.map((w) => word(w)) });
  inputs.push({ mode: "gap", key: "mena-tradition-1", kind: "tradition", theme: "Arabic calligraphy styles", count: 1, region: "mena", words: [word("Diwani calligraphy")] });
  for (const { list, kind } of LISTS) {
    chunk(readList(list), 4).forEach((entries, n) =>
      inputs.push({ mode: "list", list, kind, n: n + 1, words: entries.map((e) => word(labelOf(e), hintLine(e))) }),
    );
  }
  for (const g of THEMED_GAPS) inputs.push({ mode: "gap", key: slug(`${g.kind} ${g.theme}`).slice(0, 56), kind: g.kind, theme: g.theme, count: g.count });
  // Second pass (appended so earlier request ids keep their order): in the first pass the model
  // dropped both words of these near-duplicate pairs against each other, and Hejazi rawashin, a
  // market.ts Gulf tradition, as a duplicate of Hejazi coral stone houses. One word of each pair
  // comes back, written to stand apart from its partner.
  for (const [kind, words] of RESTORE) {
    inputs.push({ mode: "gap", key: `restore-${kind}`, kind, theme: RESTORE_THEME, count: words.length, words: words.map((w) => word(w)) });
  }
  return inputs;
}

// ---------------------------------------------------------------------------------------------
// System prompt (cached prefix; stable bytes).

function arabicFamilies(): string {
  const fonts = JSON.parse(readFileSync(PATHS.fonts, "utf8")) as { families: Array<{ family: string; subsets: string[] }> };
  return fonts.families
    .filter((f) => f.subsets.includes("arabic") && !/quran/i.test(f.family))
    .map((f) => f.family)
    .join(", ");
}

/** The existing words of one kind, sent with each request (not in the cached prefix, to keep it small). */
function catalog(kind: Kind): string {
  const words = LISTS.filter((l) => l.kind === kind).flatMap(({ list }) => readList(list).map(labelOf));
  if (kind === "tradition") words.push(...GULF_TRADITIONS, "Diwani calligraphy");
  if (kind === "object") words.push(...GULF_OBJECTS);
  if (kind === "material") words.push(...GULF_MATERIALS);
  return words.length ? `Catalog of existing ${kind} words: ${words.join("; ")}.` : `The catalog has no ${kind} words yet.`;
}

const SYSTEM = `You write ingredient cards for GoBanana, a tool that bends one app or web page into a wild but buildable design direction. A card turns one surprising word into a complete visual system a designer can build from with no other card: palette, type, texture, imagery and motion that clearly belong to the same thing. A developer reads the card and ships it.

${PROMPT_RULES}

The quality bar (docs/taste-bar.md): the owner's references are shipped-grade product craft, not concept shots. Write every card to that bar.
- Restraint. One idea carried all the way through beats five ideas. The word shows up in one or two strong moves, not everywhere.
- Palette: 4 to 6 colors, true to the word, with real names ("tin can silver", not "gray 2"). One surface, one ink that reads on it at 4.5:1 or more, one accent that leads, and one or two support colors. Color is restrained: a base plus one accent used as the focal point. Dark surfaces are welcome when the word allows it.
- type: tight, editorial hierarchy. The display face makes one big moment (a hero number, a short serif or condensed headline); the body face is quiet and very readable at 14 to 16 px. Never two loud faces. The voice must be one of: ${TYPE_VOICES.join(", ")}.
- texture: a second voice on one surface (a card, a header band, a sticker), never a background wash over everything. Say the exact technique (halftone at 20 percent on the header card, 2 percent grain on the price card) and where it goes.
- motion: one verb drawn from how the thing physically moves (flips, peels, stamps, unspools), 120 to 600 ms for UI, with an easing word if it matters. "reduced" says exactly what replaces it under prefers-reduced-motion (an instant swap or a short fade, never a bounce).
- imagery: what pictures or illustrations look like, concretely (crop, treatment, subject), at shipped quality. No stock 3D people, no pastel concept comps.
- avoid: 3 to 5 concrete ways this card goes wrong (clichés, kitsch, legibility traps, stereotypes).
- artQueries: 2 to 4 image search queries for art references of the real thing, each 1 to 4 words, the concrete noun only ("airport split flap board", "zellige tile"). No style suffixes like "graphic print close-up", "aesthetic" or "design".
- idea: one plain sentence a designer could pitch. surprise: one sentence on why it is unexpected in UI and what it gives the interface (a mechanic, a structure, a feeling).
- name: the word as a title, in English. nameAr: the natural Arabic name in white Saudi dialect or standard Arabic, no tashkeel.
- Keep every text field tight: idea, surprise, texture, imagery and culturalNotes parts are one or two short sentences each. Concrete beats long.
- radius and density follow the thing itself (a passport stamp is small radius and dense; a soap bubble is round and airy).

Fonts:
- latin.display and latin.body: Google Fonts families, spelled exactly (for example "Inter Tight", "Instrument Serif", "Space Grotesk", "IBM Plex Mono", "Fraunces", "Bricolage Grotesque", "DM Serif Display", "Archivo Narrow", "Big Shoulders", "Libre Caslon Text", "Work Sans", "Newsreader"). Prefer families with real craft over defaults; avoid Roboto, Open Sans, Lato, Montserrat and Poppins unless the word truly calls for them. Do not invent families or add weights to the name.
- arabic.display and arabic.body: only these Google Fonts families with Arabic support: ${arabicFamilies()}. Body Arabic must be very readable (for example IBM Plex Sans Arabic, Noto Sans Arabic, Noto Naskh Arabic, Readex Pro, Tajawal, Almarai, Cairo, Vazirmatn). Arabic display should echo the Latin display in spirit (Kufi or geometric for condensed and grotesk, Naskh for serif, Ruqaa or hand styles only for script).

family: pick exactly one from the list for the card's kind:
${Object.entries(CARD_FAMILIES)
  .map(([k, v]) => `- ${k}: ${v.join(" | ")}`)
  .join("\n")}

region: "gulf" (Saudi Arabia, UAE, Qatar, Kuwait, Oman, Bahrain), "mena" (the rest of the Arab world, Turkey and Iran), "global" for things with no strong home, or a short lowercase region name such as "east-asia", "south-asia", "west-africa", "latin-america", "europe", "north-america", "oceania".

Culture (gobanana-culture skill):
- Meaning before motif. Name the tradition exactly: the region, the people who make it, the medium.
- Tiers. open: everyday crafts and forms; abstract freely and credit. care: marks tied to a living community or family (tribal marks, family patterns, regional dress, a named maker's work); use the grammar, not the exact mark. sacred or protected: religious text and symbols, national flags and emblems; never decoration, texture or pattern.
- Grammar, not artifact: take rhythm, repeat, proportion, color ratio and construction logic. Never trace or reuse a real piece.
- No tourist clichés (camels, dunes, oil, lanterns, "Arabian Nights" lettering, generic arabesque) for any culture.
- Arabic must be real, readable, joined words chosen with the user. Calligraphic styles carry real words, never random letters as pattern.
- Region precision: the Gulf is not the Levant, the Maghreb, Turkey or Iran.
- culturalNotes is required for every tradition card, and for any other card drawn from a specific living culture. Write it as four labelled sentences in one string: "Meaning: ... Steal: ... Credit: ... Care: <open|care|sacred tier> ...". Credit names the tradition and its people. Mention UNESCO or a museum only when you are sure it is true. When unsure of a fact, leave it out.

Keep or drop (list words only): you get existing words from GoBanana's word lists. Keep a word when it yields a distinctive, coherent visual system a real product could ship. Drop it when it is weak: too vague to give a palette, type and motion of its own; a near duplicate of a stronger word in the catalog given with the request (name that word); a cliché; or unsafe to use respectfully. Most words are worth keeping; expect to drop about one in eight. When you keep a word, fix its gaps: the list hints are a starting point, correct them where they are wrong.

New words (gap requests): propose words not already in the catalog, concrete enough to picture and to search for. No near duplicates of catalog words.

Reply format: one \`\`\`json block holding {"cards": IngredientCard[], "dropped": [{"word": string, "why": string}]}. Every card also carries "word": the exact word it was written for (the list word or the given gap word, or your new word). Leave shipPairs as an empty array; the script computes it. Use the card's kind exactly as asked.

The record type:

${typeText("IngredientCard")}`;

// ---------------------------------------------------------------------------------------------
// Prompts.

function lensBlock(l: LensJson): string {
  return [
    `  Lens notes (GoBanana's ${l.name.en} lens, ${l.name.ar}; tier ${l.tier}):`,
    `  meaning: ${l.meaning}`,
    ...l.uiMappings.map((m) => `  maps: ${m.element}: ${m.grammar} -> ${m.mechanic}`),
    ...l.sacredOrProtected.map((s) => `  care: ${s}`),
    ...(l.arabicFont ? [`  suggested Arabic face: ${l.arabicFont.family}`] : []),
  ].join("\n");
}

function wordLines(words: readonly Word[]): string {
  return words.map((w) => [`- "${w.label}"${w.hints ? ` (list hints: ${w.hints})` : ""}`, ...(w.lens ? [lensBlock(w.lens)] : [])].join("\n")).join("\n");
}

function buildPrompt(input: Input): string {
  return `${promptBody(input)}

${catalog(input.kind)}`;
}

function promptBody(input: Input): string {
  if (input.mode === "list") {
    return `Kind: ${input.kind}. These ${input.words.length} words come from the ${input.list} list. For each, keep it as one full card or drop it with a reason.\n\n${wordLines(input.words)}`;
  }
  const region = input.region ? ` Set region to "${input.region}".` : "";
  if (input.words) {
    return `Kind: ${input.kind}. Gap request (${input.theme}). Write one full card for each of these ${input.words.length} new words; drop one only if it cannot be done respectfully or accurately, and say why.${region}\n\n${wordLines(input.words)}`;
  }
  return `Kind: ${input.kind}. Gap request. Propose ${input.count} strong new words on the theme "${input.theme}" and write one full card for each. Each word must be concrete, distinct from the others and from the catalog, and good for a shipped product.${region}`;
}

// ---------------------------------------------------------------------------------------------
// Script-side fields.

/** Old or display-only names the model reaches for, to their Google Fonts family. */
const FONT_ALIASES: Record<string, string> = { "Big Shoulders Display": "Big Shoulders", "Big Shoulders Text": "Big Shoulders" };

/** Fixes the case of a Google Fonts family name ("ibm plex mono" to "IBM Plex Mono"); unknown names stay as they are for the check to reject. */
function canonicalFont(name: unknown, fonts: FontIndex): unknown {
  if (typeof name !== "string") return name;
  const hit = fonts.byName.get(name.trim().toLowerCase());
  if (hit) return hit.family;
  return FONT_ALIASES[name.trim()] ?? name;
}

const dropped: Array<{ request: string; word: string; why: string }> = [];

function prepare(raw: unknown, input: Input, ctx: { fonts: () => FontIndex }): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = { ...(raw as Record<string, unknown>) };
  const w = typeof r.word === "string" ? r.word : typeof r.name === "string" ? r.name : "";
  delete r.word;
  const listed = input.words?.find((x) => x.label.toLowerCase() === w.toLowerCase());
  const key = listed?.label ?? w;
  r.id = slug(key);
  r.kind = input.kind;
  if (input.kind === "object") {
    const fam = OBJECT_FAMILY_OF.get(key.toLowerCase());
    if (fam) r.family = fam;
  }
  if (input.mode === "gap" && input.region) r.region = input.region;
  if (input.kind === "tradition" && MARKET.gulf.has(key)) r.region = "gulf";
  else if (input.kind === "tradition" && MARKET.mena.has(key)) r.region = "mena";
  const t = r.type as { latin?: Record<string, unknown>; arabic?: Record<string, unknown> } | undefined;
  if (t?.latin && t.arabic) {
    const fonts = ctx.fonts();
    for (const slot of [t.latin, t.arabic]) {
      slot.display = canonicalFont(slot.display, fonts);
      slot.body = canonicalFont(slot.body, fonts);
    }
  }
  if (typeof r.culturalNotes === "string" && !r.culturalNotes.trim()) delete r.culturalNotes;
  if (r.region === "south-east-asia") r.region = "southeast-asia";
  return withShipPairs(r);
}

function check(card: IngredientCard, ctx: Parameters<typeof checkCardFonts>[1]): string[] {
  const out = [...checkCardFonts(card, ctx)];
  if (card.shipPairs.length === 0) out.push("no palette pair passes 4.5:1, so nothing can ship");
  if (!card.palette.some((p) => p.role === "surface")) out.push("palette has no surface");
  if (!card.palette.some((p) => p.role === "ink")) out.push("palette has no ink");
  if (!FAMILY_SET.get(card.kind)?.has(card.family)) out.push(`family "${card.family}" is not in the ${card.kind} families`);
  if (card.artQueries.some((q) => q.split(/\s+/).length > 5)) out.push("an artQuery is longer than 5 words");
  if (card.motion.ms < 80 || card.motion.ms > 2000) out.push(`motion.ms ${card.motion.ms} is outside 80 to 2000`);
  if (card.region === "gulf" && card.kind === "tradition" && !card.culturalNotes) out.push("Gulf tradition without culturalNotes");
  return out;
}

export default defineJob<Input, IngredientCard>({
  id: "j3-cards",
  kind: "cards",
  model: OPUS,
  mode: "batch",
  schema: IngredientCardSchema,
  system: SYSTEM,
  maxTokens: 24000,
  expectedOutputTokens: 5500,
  effort: "low",

  loadInputs: () => loadAll(),
  requestId: (input) => (input.mode === "list" ? `list-${input.list}-${input.n}` : `gap-${input.key}`),
  buildPrompt: (input) => buildPrompt(input),

  parse: (text, input) => {
    const v = extractJson(text) as { cards?: unknown[]; dropped?: Array<{ word?: string; why?: string }> } | unknown[];
    if (Array.isArray(v)) return v;
    for (const d of v.dropped ?? []) dropped.push({ request: input.mode === "list" ? `list-${input.list}-${input.n}` : `gap-${input.key}`, word: String(d.word ?? ""), why: String(d.why ?? "") });
    return v.cards ?? [];
  },
  prepare: (raw, input, ctx) => prepare(raw, input, ctx),
  check,
  finalize: (cards, ctx) => {
    const seen = new Set<string>();
    const out: IngredientCard[] = [];
    for (const c of cards) {
      if (seen.has(c.id)) {
        ctx.log(`  duplicate id dropped: ${c.id}`);
        continue;
      }
      seen.add(c.id);
      out.push(c);
    }
    mkdirSync(PATHS.review, { recursive: true });
    writeFileSync(join(PATHS.review, "j3-cards-dropped.json"), JSON.stringify(dropped, null, 2));
    ctx.log(`  words dropped by the model as weak: ${dropped.length} (review/j3-cards-dropped.json)`);
    return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  },
  shardOf: (card) => card.kind,
});
