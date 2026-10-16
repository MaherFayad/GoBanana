/**
 * Shared contract for "wild directions v2" (docs/wild-directions-v2-spec.md).
 * Types only plus tiny pure helpers, no imports: bend, search, canvas, exports and the canvas UI
 * bundle all read these shapes.
 */

/** Where the design lives. Decides constraints, query words, sources and export defaults. */
export const PLATFORMS = ["mobile", "tablet", "website", "webapp", "any"] as const;
export type Platform = (typeof PLATFORMS)[number];

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

/** Type voice a direction asks for. Exports map it to an open licence font pairing. */
export const TYPE_VOICES = [
  "grotesk",
  "neo-grotesk",
  "serif-editorial",
  "serif-classic",
  "mono",
  "condensed",
  "rounded",
  "display-retro",
  "script-hand",
  "slab",
] as const;
export type TypeVoice = (typeof TYPE_VOICES)[number];

export function isTypeVoice(value: unknown): value is TypeVoice {
  return typeof value === "string" && (TYPE_VOICES as readonly string[]).includes(value);
}

/**
 * The visual spec of one direction: every axis a designer needs to build it, as short plain lines
 * (template output, no AI). Every string is one sentence, at most about 20 words.
 */
export interface VisualSpec {
  /** Type direction: families by voice, scale, case, weight. */
  typography: string;
  typeVoice: TypeVoice;
  /** Color strategy: base, accent, ratio, contrast note. */
  color: string;
  /** Layout and grid, written for the platform (no 12 columns on a phone). */
  layout: string;
  /** Imagery and illustration: photo, 3D, collage, none. */
  imagery: string;
  /** Motion: what moves, how fast, what never moves. Respects reduced motion. */
  motion: string;
  /** Surface and texture: grain, gloss, paper, glass. */
  texture: string;
  /** Icons and marks. */
  iconography: string;
  /** Information density for the platform. */
  density: string;
  /** The one component that carries the idea ("balance shown as a stamped ticket"). */
  signature: string;
  /** The concrete UI pattern this idea gives the screen (the salvage). */
  pattern: string;
  /** 2 to 4 things to steal from the art direction references. */
  steal: string[];
  /** 1 to 3 things that would break usability on this platform. */
  avoid: string[];
  /** 1 to 3 verified search style words (lib/taste.ts list) derived from the ingredients. */
  styleWords: string[];
  /** One line on why this idea suits this product and audience. */
  whyItFits: string;
}

/** Extra direction data saved on the canvas (directions.detail jsonb). All optional for old rows. */
export interface DirectionDetail {
  /** The brief bend_brief was given. Searches use it before the canvas brief, so one board can hold directions for several screens. */
  brief?: string;
  platform?: Platform;
  /** Pages or screens the direction applies to ("pricing page", "/launch"). Empty means the brief's screen. */
  pages?: string[];
  spec?: VisualSpec;
  /** Raw art direction queries (non UI): the ingredients as images, for the art zone. */
  artQueries?: string[];
  twist?: string;
  prompt?: string;
  wildness?: number;
  /** The working UI part the wild idea becomes ("progress", "Sadu weaving as the progress bar ..."). */
  mechanic?: { element: string; how: string };
  /**
   * Atlas ids (P1-I2, BEND_ENGINE=atlas only): the one place a direction keeps them. Search plan
   * v2 (P1-I3) reads the recipes, exports (P1-I5) the lead card, learning (P1-I6) credits the ids.
   * Old rows that saved flat `cardIds`, `mechanicId` and `recipeIds` are read into this field.
   */
  atlas?: DirectionAtlas;
  /** "keep" or "drop" from rate_directions; missing means not rated yet. */
  verdict?: "keep" | "drop";
  /** What reconcile_direction measured on the board for this direction. Missing until it runs. */
  reconciled?: Reconciled;
  /** VAL-08 Arabic-first pack: sample copy, RTL notes per part and an Arabic type pair. Missing on old rows. */
  arabic?: ArabicPack;
  /**
   * The direction's main style id (docs/styles, lib/styles/ids.ts), set by bend_brief. No two
   * directions of one brief share one. Missing on directions saved before styles.
   */
  styleId?: string;
}

/** One string in both languages: Arabic in white Saudi dialect without tashkeel, and what it says in English. */
export interface BiText {
  ar: string;
  en: string;
}

/** What flips and what must not for one part of the page in a right to left layout. */
export interface RtlNote {
  part: string;
  flips: string;
  keeps: string;
}

/** The Arabic type pair of a direction: from the J12 type atlas, or the voice's own fonts when the Atlas has none. */
export interface ArabicTypePair {
  source: "atlas" | "voice";
  /** J12 pair id; absent for the voice fallback. */
  id?: string;
  voice: TypeVoice;
  latin: { display: string; body: string };
  arabic: { display: string; body: string };
  notes?: string;
}

/** The Arabic-first pack of one direction (VAL-08). Deterministic: no model call at runtime. */
export interface ArabicPack {
  /** The page kind the copy was chosen for ("checkout", "booking", "generic"). */
  page: string;
  copy: { headline: BiText; action: BiText; support: BiText };
  rtl: RtlNote[];
  type: ArabicTypePair;
}

/** The Atlas ids of one direction (bend engine v2). */
export interface DirectionAtlas {
  /** Ingredient card ids, lead card first; the second card adds only texture or motion. */
  cardIds: string[];
  /** Mechanic id for the page's wild spot. */
  mechanicId?: string;
  /** Query recipe ids the direction's searches use. */
  recipeIds: string[];
  /** J13 stunning layer (VAL-14): shader recipe id (at most 1), exported as GLSL in the build prompt. */
  shaderIds?: string[];
  /** J13 motion recipe ids (at most 2), exported as CSS keyframes in the build prompt. */
  motionIds?: string[];
  /** The PageAnatomy id the brief was parsed into (crops read its bands). */
  pageId?: string;
  domainId?: string;
  productNoun?: string;
}

/** One contrast pair as reconcile_direction saves it. ship: passes 4.5:1 (text) or 3:1 (UI parts only). */
export interface ReconciledPair {
  fg: string;
  bg: string;
  ratio: number;
  passesText: boolean;
  passesUi: boolean;
  tag: "ship" | "explore";
}

/**
 * The board's own colors and mood for one direction (reconcile_direction), saved on the direction
 * so exports read the board, not the first guess in the spec. Hex values and ratios only.
 */
export interface Reconciled {
  /** ISO time of the run. */
  at: string;
  /** Fingerprint of the direction's placed images and great ratings at that time (lib/reconcile). */
  itemsKey: string;
  palette: { hex: string; oklch: string; role: string }[];
  contrast: ReconciledPair[];
  /** One plain line on the board's mood ("light, warm, one loud accent"). */
  mood: string;
  /** Images read, and how many of them were rated great. */
  images: number;
  great: number;
  /** Main colors (hex, most common first) inside each Frankenstein part's crop, by part id. */
  parts?: Record<string, string[]>;
}

/** Reference zone on a board: UI references or art direction (the wild idea as images). */
export const ZONES = ["ui", "art"] as const;
export type Zone = (typeof ZONES)[number];

export function zoneOf(value: unknown): Zone {
  return value === "art" ? "art" : "ui";
}
