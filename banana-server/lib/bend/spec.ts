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

/** Second component for the pattern line: one the platform has that the signature does not use. */
function patternComponent(input: SpecInput): string {
  return input.profile.components.find((c) => c !== input.component) ?? input.profile.defaultComponent;
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

function pattern(input: SpecInput): string {
  const e = input.entries[input.lead];
  const label = e?.label ?? "";
  const c = patternComponent(input);
  if (e?.hints.pattern) return `${capitalize(e.hints.pattern)}, as ${the(c)}`;
  switch (input.lead) {
    case "transplant":
      return `${capitalize(the(c))} laid out like ${article(label)} ${label}`;
    case "material":
      return `Layered ${label} panels as ${the(c)}, depth shows what matters`;
    case "era":
      return `Headers and labels from ${label} on ${the(c)}`;
    case "constraint":
      return `${capitalize(the(c))} follows the rule: ${label}`;
    case "scale":
      return `One giant ${label.replace(/s$/, "")} anchors ${the(c)}`;
    case "lens":
      return `${capitalize(article(label))} ${label} band as the divider in ${the(c)}`;
  }
}

function imagery(input: SpecInput): string {
  const { entries, lead } = input;
  const c = entries.constraint?.hints.img;
  if (c) return c;
  const byMove: Record<MoveId, () => string | undefined> = {
    transplant: () => entries.transplant && `Real photos of ${entries.transplant.label} details, cropped close`,
    lens: () => entries.lens && `${capitalize(entries.lens.label)} motifs as flat borders and fills, no stock photos`,
    material: () => entries.material && `Close-up ${entries.material.label} renders, softly lit`,
    era: () => entries.era && (entries.era.hints.img ?? `Flat illustration in the manner of ${entries.era.label}`),
    scale: () => entries.scale && `Giant ${entries.scale.label} as the main graphic, no photos`,
    constraint: () => undefined,
  };
  const order: MoveId[] = [lead, ...input.moves.filter((m) => m !== lead)];
  for (const m of order) {
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

function whyItFits(input: SpecInput): string {
  const lead = input.entries[input.lead]?.label ?? input.mood.label;
  if (input.clash && input.domain) {
    return `A deliberate clash: a ${input.mood.label} mood is the last thing ${input.domain.audience} expect, so it sticks`;
  }
  if (input.domain) return `${capitalize(article(input.mood.label))} ${input.mood.label} mood suits ${input.domain.audience}, and ${lead} ${/s$/i.test(lead) && !/ss$/i.test(lead) ? "give" : "gives"} it a story`;
  return `${capitalize(article(input.mood.label))} ${input.mood.label} mood and ${lead} give the ${input.subject} a look no competitor has`;
}

/** The full visual spec for one direction. */
export function buildSpec(input: SpecInput): VisualSpec {
  const { profile, entries, mood } = input;
  const voice = typeVoice(input);
  const caseNote = entries.constraint ? (CASE_NOTE[entries.constraint.key] ?? "") : "";
  const accent = first(entries.lens, entries.era);
  const baseColor = entries.constraint?.hints.color ?? mood.hints.color ?? `${capitalize(article(mood.label))} ${mood.label} palette with one accent`;
  const color =
    entries.constraint?.hints.color || !accent
      ? `${baseColor}; text at 4.5 to 1 contrast or more`
      : `${baseColor}; accents from ${accent.label}, text at 4.5 to 1 or more`;
  const constraintLayout = entries.constraint?.hints.layout;
  const layout = constraintLayout ? `${constraintLayout}, on ${profile.gridShort}.` : profile.grid;
  const motionHint = first(entries.transplant?.hints.motion, entries.material?.hints.motion, entries.era?.hints.motion);
  const motion = `${motionHint ?? TONE_MOTION[moodTone(mood)]}, and none with reduced motion on`;
  const surface = first(entries.material?.hints.tex, entries.transplant?.hints.tex);
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
    layout: sentence(layout),
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

const ART_TAIL: Record<MoveId, { tail: string; skip: RegExp }> = {
  transplant: { tail: "design close-up", skip: /\b(poster|posters|cover|covers|label|labels|sign|signs|map|chart|card|cards|menu|ticket|tickets|stamp|stamps|board|page|manual|program|playbill|catalog)\b/i },
  material: { tail: "texture", skip: /\b(texture|paper|glass|print)\b/i },
  era: { tail: "poster", skip: /\b(poster|posters|graphics|design|art|aesthetic|cover|covers|flyer|flyers|ads|typography|zine|illustration|architecture|magazine|catalog|print)\b/i },
  lens: { tail: "pattern", skip: /\b(pattern|fabric|textile|print|art|weaving|braid|braiding|trim|mural|murals|majlis|house|interior|painted|painting|tiles?|rugs?|embroidery|knit|quilts?|posters?|neon|silver|mosaic|pottery|porcelain|doors?|windows?|screens|labels|curtains|crests|marquetry|enamel|craft|palette|sweater|woodcut|impression|miniature|cloth|seals?)\b/i },
  // Subject, medium and composition, never an abstract word alone: "oversized stripes poster"
  // returned White Stripes band posters (field report, 2026-10-12).
  scale: { tail: "graphic print close-up", skip: /$^/ },
  constraint: { tail: "poster", skip: /\b(poster|print|art|typography|lettering)\b/i },
};

/**
 * 1 to 3 image queries of the direction's ingredients for the art zone, phrased as a visual
 * (subject, medium, composition): "korean bojagi pattern", "synthwave 1984 poster", "holographic
 * foil texture", "oversized stripes graphic print close-up". At most 6 words, never UI words.
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
    const base = m === "scale" ? `oversized ${e.query}` : e.query;
    const { tail, skip } = ART_TAIL[m];
    const q = words(tail && !skip.test(base) && words(base).length < 4 ? `${base} ${tail}` : base)
      .slice(0, 6)
      .join(" ");
    if (UI_WORDS.test(q) || out.some((o) => o.toLowerCase() === q.toLowerCase())) continue;
    out.push(q);
    if (out.length >= 3) break;
  }
  if (out.length === 0) out.push(`${mood.query} color palette`);
  return out;
}
