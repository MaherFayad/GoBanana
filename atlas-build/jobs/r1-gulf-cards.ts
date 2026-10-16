/**
 * R1 Gulf depth (refinement round 1, budget r1): new Gulf and Arabic ingredient cards across the
 * Gulf sub-regions, so a Gulf brief can draw a Gulf second card when the strong Gulf cards are
 * already leads (banana-server/bench/GATE2-DIAGNOSIS.md round 3b).
 *
 * One request per sub-region (UAE, Qatar, Kuwait, Bahrain, Oman, and the Saudi regions Najd, Hejaz,
 * Asir and the Eastern Province) plus one for pan-Gulf and Arabic words. Each carries words named
 * here (so places and names are right) and asks for a few more the model must be sure of. The
 * system prompt is the J3 brief plus Gulf rules plus the catalog of every existing card name, all in
 * the cached prefix. Names carry their place word (Najdi, Emirati, Qatari, ...) because the bend
 * routes Gulf cards by place words (banana-server lib/atlas/brief-fit.ts cardPlaces).
 *
 * The script sets id (from the word), kind (from the word, or the model's for its own words),
 * object families from lib/bend/families.ts, canonical font names and shipPairs, as J3 does.
 * Output: the whole cards kind with the new cards added (an id already in the catalog is skipped).
 *
 *   needs out/v1/cards
 *   npx tsx run.ts r1-gulf-cards --dry
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OPUS, PATHS } from "../config.ts";
import { readKindRecords } from "../lib/atlas-read.ts";
import type { FontIndex } from "../lib/fonts.ts";
import { defineJob, withShipPairs } from "../lib/job.ts";
import { j3CardIds, mergeByKey } from "../lib/refine.ts";
import { extractJson } from "../lib/validate.ts";
import { IngredientCardSchema, type IngredientCard } from "../schema.ts";
import { OBJECT_FAMILIES } from "../../banana-server/lib/bend/families.ts";
import { SYSTEM as J3_SYSTEM, canonicalFont, check as j3Check, slug } from "./j3-cards.ts";

type Kind = IngredientCard["kind"];
type Word = { word: string; kind: Kind; region?: string; note?: string };
export type Input = { key: string; area: string; words: Word[]; extra: number };

/** Sub-regions, each with named words and how many more the model proposes. */
export const GULF_GROUPS: Input[] = [
  {
    key: "uae", area: "the UAE (Emirati)", extra: 2,
    words: [
      { word: "Emirati falcon hood", kind: "object", note: "the leather hood (burqa) of falconry; falconry is on the UNESCO list for the UAE, Saudi Arabia, Qatar and others" },
      { word: "Dubai Creek abra", kind: "object", note: "the wooden water taxi across Dubai Creek" },
      { word: "Abu Dhabi Cultural Foundation 1981", kind: "era", note: "the white modernist cultural centre opened in 1981" },
    ],
  },
  {
    key: "qatar", area: "Qatar (Qatari, Doha)", extra: 2,
    words: [
      { word: "Doha Souq Waqif mud plaster", kind: "material", note: "the restored souq's mud and straw plaster walls with exposed wooden poles" },
      { word: "Qatari Al Zubarah pearling town", kind: "tradition", note: "the walled pearling and trading town, a UNESCO World Heritage Site since 2013" },
      { word: "gargoor fish trap", kind: "object", note: "the domed wire fish trap of Gulf fishermen, made in Qatar, Bahrain, the UAE and the Saudi coast; say Gulf" },
    ],
  },
  {
    key: "kuwait", area: "Kuwait (Kuwaiti)", extra: 3,
    words: [
      { word: "Kuwait Towers 1979", kind: "era", note: "the three towers with spheres clad in coloured steel discs, opened in 1979" },
      { word: "mandoos chest", kind: "object", note: "the wooden chest studded with brass, a bridal chest across the Gulf, strongly tied to Kuwait and the UAE; say Gulf" },
    ],
  },
  {
    key: "bahrain", area: "Bahrain (Bahraini)", extra: 2,
    words: [
      { word: "Bahraini Bani Jamra weaving", kind: "tradition", note: "the cloth weaving of the village of Bani Jamra" },
      { word: "Bahraini A'ali pottery", kind: "tradition", note: "the pottery kilns of the village of A'ali" },
      { word: "Dilmun stamp seal", kind: "element", note: "the round Bronze Age stamp seals of Dilmun found in Bahrain; Qal'at al-Bahrain is a UNESCO site" },
    ],
  },
  {
    key: "oman", area: "Oman (Omani)", extra: 2,
    words: [
      { word: "Omani aflaj water channels", kind: "tradition", note: "the falaj irrigation channels; the Aflaj Irrigation Systems of Oman are a UNESCO site" },
      { word: "Omani Bahla pottery", kind: "tradition", note: "the pottery of the town of Bahla" },
      { word: "Omani kumma embroidery", kind: "tradition", note: "the hand-stitched cap worn by Omani men; regional dress, so care tier" },
    ],
  },
  {
    key: "najd", area: "Najd in central Saudi Arabia (Najdi, Riyadh, Diriyah, Qassim)", extra: 2,
    words: [
      { word: "Najdi shurfat parapets", kind: "element", note: "the stepped and triangular crenellations on Najdi mud buildings, as at At-Turaif in Diriyah" },
      { word: "Najdi athl wood beams", kind: "material", note: "tamarisk (athl) beams with palm ribs above in Najdi roofs" },
      { word: "Najdi mihbash coffee mortar", kind: "object", note: "the wooden mortar whose rhythmic pounding of coffee beans welcomes guests" },
    ],
  },
  {
    key: "hejaz", area: "the Hejaz in western Saudi Arabia (Hejazi, Jeddah, Taif, Yanbu)", extra: 3,
    words: [
      { word: "Hejaz Railway 1908", kind: "era", note: "the railway from Damascus to Medina, its stone stations and timetable print; Ottoman era" },
      { word: "Jeddah Corniche sculptures 1980s", kind: "era", note: "the open-air sculptures along the Jeddah Corniche; name artists only when sure" },
    ],
  },
  {
    key: "asir", area: "Asir in south-western Saudi Arabia (Asiri, Abha, Rijal Almaa)", extra: 3,
    words: [
      { word: "Asiri slate-banded mud towers", kind: "tradition", note: "mud tower houses with rows of projecting slate bands that shed rain" },
      { word: "Asiri juniper wood", kind: "material", note: "the juniper (arar) of the Asir highlands" },
    ],
  },
  {
    key: "eastern", area: "the Eastern Province of Saudi Arabia (Al Ahsa, Hofuf, Qatif, Dammam, Dhahran)", extra: 2,
    words: [
      { word: "Dhahran Air Terminal 1961", kind: "era", note: "the arched modernist airport terminal completed in 1961" },
      { word: "Al Ahsa Oasis from above", kind: "scale", note: "the palm oasis seen from the air, a UNESCO site since 2018" },
      { word: "Gulf sabkha salt crust", kind: "material", note: "the salt flats of the Gulf coast in the Eastern Province and the UAE; say Gulf" },
    ],
  },
  {
    key: "arabic", area: "the whole Gulf and Arabic script", extra: 0,
    words: [
      { word: "Gulf date syrup dibs", kind: "material", note: "date syrup, dark and glossy" },
      { word: "Gulf qurm mangroves", kind: "material", note: "the grey mangrove (qurm) of the Gulf coast" },
      { word: "Hijri and Gregorian dates side by side", kind: "constraint", region: "gulf", note: "Saudi Arabia uses the Umm al-Qura calendar" },
      { word: "Arabic sets the size, Latin follows", kind: "constraint", note: "a bilingual type rule" },
      { word: "Ruqaa handwriting", kind: "element", region: "mena", note: "the everyday Arabic hand; real words only" },
      { word: "Eastern Arabic digits", kind: "element", region: "mena", note: "the digits used in Arabic text in the Gulf and the Mashriq" },
    ],
  },
];

let catalogCache: IngredientCard[] | null = null;
/** The J3 cards (the catalog new words must not repeat). */
const catalogCards = () => (catalogCache ??= readKindRecords<IngredientCard>("cards").filter((c) => j3CardIds().has(c.id)));

const KINDS = new Set<Kind>(["object", "material", "era", "tradition", "constraint", "scale", "element"]);
const OBJECT_FAMILY_OF = new Map(Object.entries(OBJECT_FAMILIES).flatMap(([f, keys]) => keys.map((k) => [k.toLowerCase(), f] as const)));

const system = () => `${J3_SYSTEM}

Gulf depth requests: GoBanana needs more Gulf and Arabic cards so a Gulf brief can take a Gulf card as its lead and another as its second card (the second card adds a texture, a motion or a rule). Rules for these cards, on top of everything above:
- Accuracy first. Every fact must be one you are sure of. Leave out a date, a maker, a listing or a meaning you are not sure of. Drop a word (with the reason) rather than guess.
- Place words. When the thing belongs to one place, the card's name carries that place word (Najdi, Hejazi, Asiri, Emirati, Qatari, Kuwaiti, Bahraini, Omani, or the city), because the engine only offers a place's cards to briefs for that place. A thing shared across the Gulf says "Gulf" in its idea or culturalNotes.
- Grammar for UI. Say what the interface takes from the thing: a band, a rhythm, a grid, a stamp, a motion, a color ratio. A card that only says "heritage" is not a card.
- Second-card use. Write texture and motion so they can sit under another lead: one surface, one moment, never a full background.
- Care. Open tier for everyday crafts, buildings, tools and materials; care tier for regional dress, family or tribal marks, and named makers. Never flags, emblems, royal or state seals, currency emblems, mosque or Kaaba imagery, or religious text. No camels, dunes, oil rigs, lanterns or "Arabian Nights" lettering.
- culturalNotes on every card that draws on a living culture (all of these except plain rule cards), in the four labelled sentences.
- New words you propose: documented, concrete things from the named area that a person from there would recognise; not in the catalog below; not near duplicates of each other. Give each its kind.

Catalog of existing card names (do not repeat them or write near duplicates):
${catalogCards()
  .map((c) => c.name)
  .sort((a, b) => a.localeCompare(b))
  .join("; ")}`;

function buildPrompt(input: Input): string {
  const named = input.words.map((w) => `- "${w.word}" (kind ${w.kind}${w.region ? `, region "${w.region}"` : ""})${w.note ? `: ${w.note}` : ""}`).join("\n");
  const extra = input.extra > 0 ? `\n\nThen propose ${input.extra} more words from ${input.area} and write a full card for each. Give each its "kind" and set region "gulf". Prefer kinds that work as a second card (material, element, object) unless a tradition is clearly missing.` : "";
  return `Gulf depth request: ${input.area}. Write one full card for each named word; drop one only if it cannot be done accurately or respectfully, and say why. Set region "gulf" unless the word gives another region.\n\n${named}${extra}\n\nEvery card carries "word" (the named word exactly, or your new word) and "kind".`;
}

const dropped: Array<{ request: string; word: string; why: string }> = [];

function prepare(raw: unknown, input: Input, ctx: { fonts: () => FontIndex }): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = { ...(raw as Record<string, unknown>) };
  const w = typeof r.word === "string" ? r.word : typeof r.name === "string" ? r.name : "";
  delete r.word;
  const named = input.words.find((x) => x.word.toLowerCase() === w.toLowerCase());
  r.id = slug(named?.word ?? w);
  if (named) r.kind = named.kind;
  else if (typeof r.kind !== "string" || !KINDS.has(r.kind as Kind)) r.kind = "object";
  r.region = named?.region ?? (typeof r.region === "string" && r.region !== "global" ? r.region : "gulf");
  if (r.kind === "object") {
    const fam = OBJECT_FAMILY_OF.get((named?.word ?? w).toLowerCase());
    if (fam) r.family = fam;
  }
  const t = r.type as { latin?: Record<string, unknown>; arabic?: Record<string, unknown> } | undefined;
  if (t?.latin && t.arabic) {
    const fonts = ctx.fonts();
    for (const slot of [t.latin, t.arabic]) {
      slot.display = canonicalFont(slot.display, fonts);
      slot.body = canonicalFont(slot.body, fonts);
    }
  }
  if (typeof r.culturalNotes === "string" && !r.culturalNotes.trim()) delete r.culturalNotes;
  return withShipPairs(r);
}

export function checkGulfCard(card: IngredientCard, ctx: Parameters<typeof j3Check>[1]): string[] {
  const out = j3Check(card, ctx);
  if (card.kind !== "constraint" && !card.culturalNotes) out.push("a Gulf or Arabic card without culturalNotes");
  if (card.culturalNotes && !/Credit:/.test(card.culturalNotes)) out.push("culturalNotes has no Credit: line");
  return out;
}

export default defineJob<Input, IngredientCard>({
  id: "r1-gulf-cards",
  kind: "cards",
  model: OPUS,
  mode: "batch",
  schema: IngredientCardSchema,
  get system() {
    return system();
  },
  maxTokens: 40000,
  expectedOutputTokens: 16000,
  effort: "high",

  loadInputs: () => GULF_GROUPS,
  requestId: (input) => `gulf-${input.key}`,
  buildPrompt: (input) => buildPrompt(input),

  parse: (text, input) => {
    const v = extractJson(text) as { cards?: unknown[]; dropped?: Array<{ word?: string; why?: string }> } | unknown[];
    if (Array.isArray(v)) return v;
    for (const d of v.dropped ?? []) dropped.push({ request: `gulf-${input.key}`, word: String(d.word ?? ""), why: String(d.why ?? "") });
    return v.cards ?? [];
  },
  prepare: (raw, input, ctx) => prepare(raw, input, ctx),
  check: checkGulfCard,
  finalize: (fresh, ctx) => {
    const j3 = j3CardIds();
    const seen = new Set<string>();
    const added: IngredientCard[] = [];
    for (const c of fresh) {
      if (j3.has(c.id) || seen.has(c.id)) {
        ctx.log(`  skipped, id already a card: ${c.id}`);
        continue;
      }
      seen.add(c.id);
      added.push(c);
    }
    mkdirSync(PATHS.review, { recursive: true });
    writeFileSync(join(PATHS.review, "r1-gulf-cards-dropped.json"), JSON.stringify(dropped, null, 2));
    writeFileSync(join(PATHS.review, "r1-gulf-cards-new.json"), JSON.stringify(added, null, 2));
    const merged = mergeByKey(readKindRecords<IngredientCard>("cards"), added, (c) => c.id);
    ctx.log(`  new cards: ${added.length}; dropped by the model: ${dropped.length}; cards: ${merged.length}`);
    return merged.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  },
  shardOf: (card) => card.kind,
});
