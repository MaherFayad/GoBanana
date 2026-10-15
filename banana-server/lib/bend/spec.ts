/**
 * The visual spec of a direction and its art queries, built by templates from the picked list
 * entries (their hints) and the platform profile. Rule based, no AI. Plain words, no em dashes,
 * one short sentence per axis.
 */
import type { TypeVoice, VisualSpec } from "@/lib/direction-detail";
import type { PlatformProfile } from "@/lib/platform";
import { article, capitalize } from "./templates";
import type { Domain } from "./tone";
import { ARABIC_FACE } from "./market";
import { LISTS } from "./lists";
import type { MechanicElement } from "./mechanic";
import type { ListEntry, MoveId, Tone } from "./types";



/** Style words verified live as search terms (lib/taste.ts). Only these reach styleWords. */
export const VERIFIED_STYLE_WORDS: readonly string[] = [
  "minimal",
  "glassmorphism",
  "liquid glass",
  "dark mode",
  "big typography",
  "monochrome",
  "luxury",
  "neumorphism",
  "swiss style",
  "bento grid",
  "editorial",
  "grainy",
  "skeuomorphic",
];

// ---------------------------------------------------------------------------
// Acronyms

const ACRONYMS: Readonly<Record<string, string>> = {
  b2b: "B2B", b2c: "B2C", d2c: "D2C", b2g: "B2G", ai: "AI", crm: "CRM", erp: "ERP", saas: "SaaS", paas: "PaaS",
  ios: "iOS", ipados: "iPadOS", macos: "macOS", iphone: "iPhone", ipad: "iPad", ui: "UI", ux: "UX", hr: "HR",
  ev: "EV", evs: "EVs", nft: "NFT", nfts: "NFTs", api: "API", apis: "APIs", kpi: "KPI", kpis: "KPIs", gcc: "GCC",
  ota: "OTA", sms: "SMS", faq: "FAQ", faqs: "FAQs", pdf: "PDF", seo: "SEO", cms: "CMS", vr: "VR", uae: "UAE",
  ksa: "KSA", usa: "USA", uk: "UK", nyc: "NYC", qr: "QR", "3d": "3D", "2d": "2D", sdk: "SDK", llm: "LLM",
  llms: "LLMs", gpu: "GPU", esg: "ESG", roi: "ROI", okr: "OKR", okrs: "OKRs", tv: "TV", dj: "DJ", diy: "DIY",
  hiit: "HIIT", gps: "GPS", nfc: "NFC", pos: "POS", rsvp: "RSVP", ar: "AR", esim: "eSIM", esims: "eSIMs", vpn: "VPN",
  bnpl: "BNPL",
};

const ACRONYM_RE = new RegExp(`(?<![\\p{L}\\p{N}'’-])(${Object.keys(ACRONYMS).join("|")})(?![\\p{L}\\p{N}'’-])`, "giu");

/** Write acronyms and brand casings the way people expect: "B2b analytics" to "B2B analytics". */
export function fixCase(text: string): string {
  return text.replace(ACRONYM_RE, (m) => ACRONYMS[m.toLowerCase()] ?? m);
}

// ---------------------------------------------------------------------------
// Lines

const VOICE_LINE: Record<TypeVoice, string> = {
  grotesk: "A sturdy grotesk",
  "neo-grotesk": "A neutral neo-grotesk",
  "serif-editorial": "A high contrast editorial serif",
  "serif-classic": "A classic book serif",
  mono: "A monospace",
  condensed: "A tall condensed sans",
  rounded: "A soft rounded sans",
  "display-retro": "A period display face",
  "script-hand": "A hand-drawn script",
  slab: "A chunky slab serif",
};

const TONE_VOICE: Record<Tone, TypeVoice> = {
  calm: "serif-editorial",
  energetic: "condensed",
  serious: "neo-grotesk",
  playful: "rounded",
  luxe: "serif-classic",
  dark: "grotesk",
  light: "neo-grotesk",
  warm: "serif-classic",
  cold: "neo-grotesk",
};

const TONE_MOTION: Record<Tone, string> = {
  calm: "Slow 300ms fades and eases, nothing loops",
  energetic: "Quick 150ms snaps with one bounce on success",
  serious: "Short 150ms fades, no decorative motion",
  playful: "Springy presses and a small burst on success",
  luxe: "Slow 400ms reveals with gentle easing",
  dark: "Glows fade in softly over 250ms",
  light: "Light 200ms fades and short slides",
  warm: "Soft 250ms eases, like paper settling",
  cold: "Precise 200ms moves on a straight path",
};

const TONE_TEXTURE: Record<Tone, string> = {
  calm: "Smooth matte surfaces with soft shadows",
  energetic: "Flat bold fills with crisp edges",
  serious: "Flat surfaces and hairline rules, no texture",
  playful: "Glossy fills with a light sheen",
  luxe: "Satin surfaces with fine highlights",
  dark: "Deep matte surfaces with soft glows",
  light: "Clean flat white surfaces",
  warm: "A soft paper grain on flat color",
  cold: "Clean flat surfaces with crisp edges",
};

const TONE_STYLE: Record<Tone, string> = {
  calm: "minimal",
  energetic: "big typography",
  serious: "swiss style",
  playful: "big typography",
  luxe: "luxury",
  dark: "dark mode",
  light: "minimal",
  warm: "editorial",
  cold: "monochrome",
};

const VOICE_ICONS: Record<TypeVoice, string> = {
  grotesk: "Simple 1.5px line icons from one set",
  "neo-grotesk": "Simple 1.5px line icons from one set",
  "serif-editorial": "Thin line icons with round ends, used sparingly",
  "serif-classic": "Thin line icons with round ends, used sparingly",
  mono: "Pixel-sharp line icons with square ends",
  condensed: "Bold filled glyphs",
  rounded: "Rounded filled icons",
  "display-retro": "Simple period-style glyphs",
  "script-hand": "Hand-drawn icons in one stroke",
  slab: "Chunky filled icons",
};

/** Case rules some constraints add to the typography line, by constraint key. */
const CASE_NOTE: Readonly<Record<string, string>> = {
  "all caps, everywhere": ", all caps",
  "lowercase letters only": ", lowercase only",
  "labels in small caps": ", small caps labels",
  "every heading in italics": ", italic headings",
  "numbers in tabular figures": ", tabular figures",
};

/** Body type for a voice. */
function bodyLine(voice: TypeVoice): string {
  if (voice === "mono") return "the same mono for body";
  if (voice === "neo-grotesk" || voice === "grotesk") return "the same family for body";
  return "a plain sans for body";
}

/** Words that mark a query as UI, never allowed in art queries. */
export const UI_WORDS = /\b(ui|ux|app|apps|screen|screens|website|websites|web|dashboard|interface|landing|page|pages|mobile|template|mockup|figma|layout|grid|wireframe)\b/i;

/** The ingredients one direction is built from, by move (the twist garnish included). */
export interface SpecInput {
  profile: PlatformProfile;
  /** Moves in direction order, the twist garnish last. */
  moves: readonly MoveId[];
  entries: Readonly<Partial<Record<MoveId, ListEntry>>>;
  /** The headline's lead move. */
  lead: MoveId;
  mood: ListEntry;
  /** True when the mood clashes with the domain on purpose (wildness 4 and 5). */
  clash: boolean;
  domain: Domain | null;
  /** Subject as shown in titles ("meditation onboarding"). */
  subject: string;
  /** The UI component the brief names, else the platform default ("onboarding", "card"). */
  component: string;
  /** The design must work in Arabic (lib/bend/market.ts needsArabic): the type line names an Arabic face. */
  arabic?: boolean;
  /**
   * The part the idea becomes (lib/bend/mechanic.ts). P0-08: the pattern and layout lines are
   * written on this part, so the spec never names a header while the mechanic is a progress bar.
   */
  mechanic: MechanicElement;
  /** The page the idea is for, as people say it: the first page given, else the subject ("eSIM plan picker"). */
  page: string;
}

/** Each mechanic element as the part the pattern and layout lines name. */
export const PART: Readonly<Record<MechanicElement, string>> = {
  progress: "progress bar",
  total: "total block",
  cta: "main button",
  divider: "section dividers",
  "section-nav": "section tabs",
  header: "header strip",
  "empty-state": "empty state",
};

// ---------------------------------------------------------------------------
// Palette family (P0-08): the lead ingredient sets the color; the mood only shifts it.

/** Words that read warm or cool in a color line. */
export const WARM_WORDS = /\b(warm|warmer|red|reds|orange|amber|gold|golden|rust|brown|ochre|terracotta|copper|peach|coral|saffron)\b/i;
export const COOL_WORDS = /\b(cool|cooler|cold|icy|ice|blue|blues|navy|teal|cyan|steel|silver|grey|gray|grays|greys|slate|mint)\b/i;

export type PaletteFamily = "warm" | "cool" | "neutral";

/** An ingredient's palette family from its tones: warm or cold alone, else neutral. */
export function paletteFamily(entry: ListEntry | undefined): PaletteFamily {
  const tones = entry?.hints.tone ?? [];
  const warm = tones.includes("warm");
  const cold = tones.includes("cold");
  return warm && !cold ? "warm" : cold && !warm ? "cool" : "neutral";
}

/**
 * The lead's palette family. A lens preset term has no tones of its own, so it takes the family of
 * the tradition with the same name ("Sadu weaving" is warm).
 */
export function leadFamily(move: MoveId, entry: ListEntry | undefined): PaletteFamily {
  const own = paletteFamily(entry);
  if (own !== "neutral" || move !== "lens" || !entry) return own;
  return paletteFamily(LISTS.traditions.find((t) => t.label.toLowerCase() === entry.label.toLowerCase()));
}

/** True when the text has a temperature word that fights the family (cool words on a warm ingredient). */
export function fightsFamily(text: string, family: PaletteFamily): boolean {
  return (family === "warm" && COOL_WORDS.test(text)) || (family === "cool" && WARM_WORDS.test(text));
}

/** How a mood shifts the lead's colors: temperature (unless it fights the lead) and contrast. */
const MOOD_CONTRAST: Record<Tone, string> = {
  calm: "soft contrast",
  energetic: "high contrast",
  serious: "restrained contrast",
  playful: "bright, clean contrast",
  luxe: "deep contrast",
  dark: "a dark base",
  light: "a light base",
  warm: "soft contrast",
  cold: "crisp contrast",
};

function moodShift(mood: ListEntry, family: PaletteFamily): string {
  const tones = mood.hints.tone;
  const temp = tones.includes("warm") && family !== "cool" ? "pushed warmer, " : tones.includes("cold") && family !== "warm" ? "pushed cooler, " : "";
  return `${temp}${MOOD_CONTRAST[moodTone(mood)]}`;
}

const words = (s: string) => s.split(/\s+/).filter(Boolean);

function first<T>(...values: (T | undefined | null | false)[]): T | undefined {
  for (const v of values) if (v) return v;
  return undefined;
}

/** "the onboarding", "the 404 page". */
const the = (c: string) => `the ${c}`;

function moodTone(mood: ListEntry): Tone {
  return mood.hints.tone[0] ?? "light";
}


function signature(input: SpecInput): string {
  const e = input.entries[input.lead];
  const label = e?.label ?? input.mood.label;
  const c = capitalize(the(input.component));
  switch (input.lead) {
    case "transplant":
      return `${c} built like ${article(label)} ${label}`;
    case "material":
      return `${c} rendered in ${label}, with real light and shadow`;
    case "era":
      return `${c} set in the type and color of ${label}`;
    case "constraint":
      return `${c} under one rule: ${label}`;
    case "scale":
      return `${c} led by giant ${label}`;
    case "lens":
      return `${c} framed by ${label} patterns`;
  }
}

/** The pattern, always on the mechanic's part (P0-08). */
function pattern(input: SpecInput): string {
  const e = input.entries[input.lead];
  const label = e?.label ?? "";
  const c = PART[input.mechanic];
  if (e?.hints.pattern) return `${capitalize(e.hints.pattern)}, on ${the(c)}`;
  switch (input.lead) {
    case "transplant":
      return `${capitalize(the(c))} laid out like ${article(label)} ${label}`;
    case "material":
      return `Layered ${label} on ${the(c)}, depth shows what matters`;
    case "era":
      return `${capitalize(the(c))} set in the headers and labels of ${label}`;
    case "constraint":
      return `${capitalize(the(c))} follows the rule: ${label}`;
    case "scale":
      return `One giant ${label.replace(/s$/, "")} anchors ${the(c)}`;
    case "lens":
      return `${capitalize(article(label))} ${label} band frames ${the(c)}`;
  }
}

/** Where the part sits, with the idea's name: unique per direction, written from the mechanic (P0-08). */
const PART_LAYOUT: Record<MechanicElement, string> = {
  progress: "{idea} progress bar across the top, steps below it",
  total: "{idea} total block right above the main button",
  cta: "{idea} main button alone in a fixed bar",
  divider: "{idea} bands between stacked sections",
  "section-nav": "{idea} tabs switch the sections at the top",
  header: "{idea} header strip over a single column",
  "empty-state": "{idea} art centered in the empty state, one action below",
};

function layout(input: SpecInput): string {
  const lead = input.entries[input.lead];
  const idea = input.lead === "scale" ? `giant ${lead?.label ?? ""}` : (lead?.label ?? input.mood.label);
  const part = PART_LAYOUT[input.mechanic].replace("{idea}", idea);
  const rule = input.entries.constraint?.hints.layout;
  const grid = input.profile.gridShort;
  const withRule = rule ? `${part}; ${rule.charAt(0).toLowerCase()}${rule.slice(1)}, on ${grid}` : "";
  return withRule && words(withRule).length <= 30 ? withRule : `${part}, on ${grid}`;
}

function imagery(input: SpecInput): string {
  const { entries, lead } = input;
  const c = entries.constraint?.hints.img;
  // The lead ingredient first (P0-08); a constraint's imagery rule only when it leads or nothing else speaks.
  if (c && lead === "constraint") return c;
  const byMove: Record<MoveId, () => string | undefined> = {
    transplant: () => entries.transplant && `Real photos of ${entries.transplant.label} details, cropped close`,
    lens: () => entries.lens && `${capitalize(entries.lens.label)} motifs as flat borders and fills, no stock photos`,
    material: () => entries.material && `Close-up ${entries.material.label} renders, softly lit`,
    era: () => entries.era && (entries.era.hints.img ?? `Flat illustration in the manner of ${entries.era.label}`),
    scale: () => entries.scale && `Giant ${entries.scale.label} as the main graphic, no photos`,
    constraint: () => undefined,
  };
  const leadLine = byMove[lead]();
  if (leadLine) return leadLine;
  if (c) return c;
  for (const m of input.moves.filter((x) => x !== lead)) {
    const line = byMove[m]();
    if (line) return line;
  }
  return "No stock photos; type and color carry the screen";
}

function typeVoice(input: SpecInput): TypeVoice {
  const { entries } = input;
  return (
    first(
      entries.constraint?.hints.voice,
      entries.era?.hints.voice,
      entries.lens?.hints.voice,
      entries.transplant?.hints.voice,
      entries.scale?.hints.voice,
      entries.material?.hints.voice,
      input.mood.hints.voice,
    ) ?? TONE_VOICE[moodTone(input.mood)]
  );
}

function styleWords(input: SpecInput): string[] {
  const { entries } = input;
  const all = [
    ...(entries.constraint?.hints.style ?? []),
    ...(entries.era?.hints.style ?? []),
    ...(entries.material?.hints.style ?? []),
    ...(entries.transplant?.hints.style ?? []),
    ...(entries.lens?.hints.style ?? []),
    ...(entries.scale?.hints.style ?? []),
    ...input.mood.hints.style,
  ];
  const out = [...new Set(all.filter((s) => VERIFIED_STYLE_WORDS.includes(s)))].slice(0, 3);
  if (out.length === 0) out.push(TONE_STYLE[moodTone(input.mood)]);
  return out;
}

function steal(input: SpecInput): string[] {
  const { entries } = input;
  const line: Record<MoveId, (e: ListEntry) => string> = {
    transplant: (e) => `The print details and wear of ${article(e.label)} ${e.label}`,
    material: (e) => `How light sits on ${e.label}`,
    era: (e) => `The type and color of ${e.label}`,
    lens: (e) => `The pattern rhythm of ${e.label}`,
    scale: (e) => `The scale jump of giant ${e.label}`,
    constraint: (e) => `The discipline of one rule: ${e.label}`,
  };
  const order: MoveId[] = [input.lead, ...input.moves.filter((m) => m !== input.lead)];
  const out = order.flatMap((m) => (entries[m] ? [line[m](entries[m]!)] : []));
  out.push(`The ${input.mood.label} color temperature`);
  return [...new Set(out)].slice(0, 4);
}

function avoid(input: SpecInput): string[] {
  const out: string[] = [];
  if (input.entries.material) out.push(`Text over ${input.entries.material.label} without a solid backing`);
  else if (input.entries.constraint?.hints.color) out.push("Color as the only signal for errors");
  out.push(...input.profile.avoid);
  return out.slice(0, 3);
}

/**
 * Why the idea fits, written from the lead ingredient, the page and the mechanic's part (P0-08).
 * No generic fallback: every line names the ingredient, so no two directions of a bend share one.
 */
function whyItFits(input: SpecInput): string {
  const label = input.entries[input.lead]?.label ?? input.mood.label;
  const page = input.page;
  const part = PART[input.mechanic];
  if (input.clash && input.domain) {
    return `A deliberate clash: ${label} in a ${input.mood.label} mood is the last thing ${input.domain.audience} expect, so it sticks`;
  }
  const plural = /s$/i.test(label) && !/ss$/i.test(label);
  switch (input.lead) {
    case "transplant":
      return `People already know how to read ${article(label)} ${label}, so the ${page} borrows that habit for its ${part}`;
    case "material":
      return `${capitalize(label)} ${plural ? "give" : "gives"} the ${page} a surface people want to touch, shown on the ${part}`;
    case "era":
      return `${capitalize(label)} ${plural ? "give" : "gives"} the ${page} a voice people remember, while the ${part} still works as expected`;
    case "constraint":
      return `One rule, ${label}, keeps the ${page} calm and makes the ${part} stand out`;
    case "scale":
      return `Giant ${label} make the ${part} of the ${page} impossible to miss`;
    case "lens":
      return `${capitalize(label)} ${plural ? "root" : "roots"} the ${page} in a craft its users know, carried by the ${part}`;
  }
}

/** "The colors of a real exhibition catalog" (one thing), "The colors of real halftone dots" (many) or "of real limestone" (a material). */
function realColors(label: string, mass: boolean): string {
  const many = mass || (/s$/i.test(label) && !/ss$/i.test(label));
  return `The colors of ${many ? "real" : "a real"} ${label}, one base and one accent`;
}

/** The color line: the lead ingredient's colors first, other ingredients as accents, the mood only shifts (P0-08). */
function colorLine(input: SpecInput): string {
  const { entries, lead, mood } = input;
  const leadEntry = entries[lead];
  const family = leadFamily(lead, leadEntry);
  const rule = entries.constraint?.hints.color;
  const base =
    (lead === "constraint" ? rule : undefined) ??
    leadEntry?.hints.color ??
    rule ??
    realColors(leadEntry?.label ?? mood.label, lead === "material");
  const opposite = (f: PaletteFamily) => (family === "warm" && f === "cool") || (family === "cool" && f === "warm");
  const accent = [entries.lens, entries.era].find((e) => e && e !== leadEntry && !fightsFamily(e.label, family) && !opposite(paletteFamily(e)));
  const accentText = accent && !base.includes(accent.label) ? `; accents from ${accent.label}` : "";
  return `${base}${accentText}; ${moodShift(mood, family)}, text at 4.5 to 1 or more`;
}

/** The full visual spec for one direction. */
export function buildSpec(input: SpecInput): VisualSpec {
  const { profile, entries, mood } = input;
  const voice = typeVoice(input);
  const caseNote = entries.constraint ? (CASE_NOTE[entries.constraint.key] ?? "") : "";
  const color = colorLine(input);
  const motionHint = first(entries.transplant?.hints.motion, entries.material?.hints.motion, entries.era?.hints.motion);
  const motion = `${motionHint ?? TONE_MOTION[moodTone(mood)]}, and none with reduced motion on`;
  // The lead ingredient's surface first (P0-08), then a material or object surface.
  const surface = first(entries[input.lead]?.hints.tex, entries.material?.hints.tex, entries.transplant?.hints.tex);
  const texture = surface
    ? // A material or object surface is busy: text never sits on it (field report, 2026-10-12:
      // "text on a textured background will fail contrast").
      `${surface.replace(/[.\s]+$/, "")}; text sits on solid panels, never on the texture`
    : (first(
        entries.constraint?.hints.style.includes("grainy") && "Fine print grain over flat color",
        mood.hints.tex,
        [entries.era, mood].some((e) => e?.hints.style.includes("grainy")) && "Fine print grain over flat color",
      ) ?? TONE_TEXTURE[moodTone(mood)]);
  const iconBase = first(entries.constraint?.hints.icons, entries.era?.hints.icons) ?? VOICE_ICONS[voice];
  const iconography = profile.platform === "mobile" ? `${iconBase}, 24pt in the tab bar` : iconBase;
  const density = entries.constraint?.hints.density
    ? `${entries.constraint.hints.density}; ${profile.density.charAt(0).toLowerCase()}${profile.density.slice(1)}`
    : profile.density;

  const spec: VisualSpec = {
    typography: `${VOICE_LINE[voice]} for display at ${profile.display}, ${bodyLine(voice)} at ${profile.body}${caseNote}${
      input.arabic ? `; Arabic in ${ARABIC_FACE[voice]} at the same sizes, right to left` : ""
    }.`,
    typeVoice: voice,
    color: sentence(color),
    layout: sentence(layout(input)),
    imagery: sentence(imagery(input)),
    motion: sentence(motion),
    texture: sentence(texture),
    iconography: sentence(iconography),
    density: sentence(density),
    signature: sentence(signature(input)),
    pattern: sentence(pattern(input)),
    steal: steal(input).map(sentence),
    avoid: avoid(input).map(sentence),
    styleWords: styleWords(input),
    whyItFits: sentence(whyItFits(input)),
  };
  return spec;
}

/** One clean sentence: acronyms fixed, first letter up, one closing period, no em dashes. */
function sentence(text: string): string {
  const t = fixCase(text.replaceAll(String.fromCharCode(0x2014), ",").trim()).replace(/[.\s]+$/, "");
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}.`;
}

// ---------------------------------------------------------------------------
// Art queries

/**
 * One medium word after the ingredient, never a stacked suffix (P0-16): "oversized ruler ticks
 * graphic print close-up" returned 0 results live (2026-10-13), while concrete objects ("exhibition
 * catalog") returned real spreads. Objects and scale elements go bare: the concrete noun only.
 */
const ART_TAIL: Record<MoveId, { tail: string; skip: RegExp }> = {
  transplant: { tail: "", skip: /$^/ },
  material: { tail: "texture", skip: /\b(texture|paper|glass|print)\b/i },
  era: { tail: "poster", skip: /\b(poster|posters|graphics|design|art|aesthetic|cover|covers|flyer|flyers|ads|typography|zine|illustration|architecture|magazine|catalog|print)\b/i },
  lens: { tail: "pattern", skip: /\b(pattern|fabric|textile|print|art|weaving|braid|braiding|trim|mural|murals|majlis|house|interior|painted|painting|tiles?|rugs?|embroidery|knit|quilts?|posters?|neon|silver|mosaic|pottery|porcelain|doors?|windows?|screens|labels|curtains|crests|marquetry|enamel|craft|palette|sweater|woodcut|impression|miniature|cloth|seals?)\b/i },
  // A one word element alone is too abstract ("stripes" returned White Stripes band posters, field
  // report 2026-10-12): it gets "graphic". Two words or more go bare ("ruler ticks").
  scale: { tail: "graphic", skip: /\b(graphic|graphics|poster|posters|print)\b/i },
  constraint: { tail: "poster", skip: /\b(poster|print|art|typography|lettering)\b/i },
};

/**
 * 1 to 3 image queries of the direction's ingredients for the art zone: the concrete noun, with at
 * most one medium word ("korean bojagi pattern", "synthwave 1984 poster", "holographic foil
 * texture", "ruler ticks", "exhibition catalog"). At most 6 words, never UI words.
 */
export function artQueries(
  moves: readonly MoveId[],
  entries: Readonly<Partial<Record<MoveId, ListEntry>>>,
  lead: MoveId,
  mood: ListEntry,
): string[] {
  // Constraints are rules, not things: they only make an art query when nothing else does.
  const order: MoveId[] = [lead, ...moves.filter((m) => m !== lead)].filter((m) => m !== "constraint");
  if (order.length === 0) order.push("constraint");
  const out: string[] = [];
  for (const m of order) {
    const e = entries[m];
    if (!e) continue;
    // A verified concrete object wins and goes bare ("measuring ruler" for ruler ticks).
    const base = e.hints.art ?? e.query;
    const { tail, skip } = ART_TAIL[m];
    const q = words(tail && !e.hints.art && !skip.test(base) && words(base).length < (m === "scale" ? 2 : 4) ? `${base} ${tail}` : base)
      .slice(0, 6)
      .join(" ");
    if (UI_WORDS.test(q) || out.some((o) => o.toLowerCase() === q.toLowerCase())) continue;
    out.push(q);
    if (out.length >= 3) break;
  }
  if (out.length === 0) out.push(`${mood.query} color palette`);
  return out;
}
