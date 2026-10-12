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
  platform?: Platform;
  /** Pages or screens the direction applies to ("pricing page", "/launch"). Empty means the brief's screen. */
  pages?: string[];
  spec?: VisualSpec;
  /** Raw art direction queries (non UI): the ingredients as images, for the art zone. */
  artQueries?: string[];
  twist?: string;
  prompt?: string;
  wildness?: number;
  /** "keep" or "drop" from rate_directions; missing means not rated yet. */
  verdict?: "keep" | "drop";
}

/** Reference zone on a board: UI references or art direction (the wild idea as images). */
export const ZONES = ["ui", "art"] as const;
export type Zone = (typeof ZONES)[number];

export function zoneOf(value: unknown): Zone {
  return value === "art" ? "art" : "ui";
}
