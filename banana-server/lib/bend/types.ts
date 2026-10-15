import type { Platform, TypeVoice, VisualSpec } from "@/lib/direction-detail";
import type { Mechanic } from "./mechanic";

export type { Platform, VisualSpec } from "@/lib/direction-detail";

/** The six bend moves (spec section 7). */
export const MOVES = ["transplant", "material", "era", "constraint", "scale", "lens"] as const;
export type MoveId = (typeof MOVES)[number];

export type Wildness = 1 | 2 | 3 | 4 | 5;

/** Input after validation and defaults. */
export interface BendInput {
  brief: string;
  wildness: Wildness;
  /** Moves the engine may use. Omitted means all six. */
  moves?: MoveId[];
  /** Culture lens preset id from lenses.json. Forces the lens move into every direction. */
  lens?: string;
  /** Number of directions, 1 to 8. Defaults to 6. */
  count?: number;
  /**
   * The user's own style words for the taste lane (lib/taste.ts). Never changes ids. Without them
   * the taste lane uses each direction's spec.styleWords (never the owner's DEFAULT_TASTE).
   */
  taste?: readonly string[];
  /** Where the design lives. Leave out to detect it from the brief (lib/platform.ts). */
  platform?: Platform;
  /** Up to 3 pages or screens the wild idea is for ("pricing page"). Never changes ids. */
  pages?: string[];
  /**
   * Patterns users rely on that no direction may break ("clear total", "one primary action").
   * Never changes ids: a direction that breaks one is dropped, and mechanics avoid them.
   */
  mustKeep?: string[];
}

/** Tones a list entry can carry; subjects map to compatible tones (lib/bend/tone.ts). */
export const TONES = ["calm", "energetic", "serious", "playful", "luxe", "dark", "light", "warm", "cold"] as const;
export type Tone = (typeof TONES)[number];

/** Visual hints on a list entry; the visual spec is built from them (lib/bend/spec.ts). */
export interface EntryHints {
  tone: readonly Tone[];
  /** How odd the entry is: 1 design-literate, 2 surprising, 3 absurd. Gated by wildness. */
  weird: 1 | 2 | 3;
  /** Platforms the entry is never used on. */
  notOn: readonly Platform[];
  voice?: TypeVoice;
  color?: string;
  tex?: string;
  motion?: string;
  img?: string;
  icons?: string;
  layout?: string;
  density?: string;
  pattern?: string;
  /** Verified search style words (lib/taste.ts). */
  style: readonly string[];
}

/** A word list entry: the label reads well in titles, the query is short and image-searchable. */
export interface ListEntry {
  label: string;
  query: string;
  /**
   * Stable identity used for picking and for direction ids. Equals the label, except for
   * entries reworded after launch (lib/bend/renamed.json), which keep their old label here.
   */
  key: string;
  /** Reads well right before the subject ("Art Deco 1925 checkout"). False for entries like "1990s rave flyers". */
  leads: boolean;
  hints: EntryHints;
}

/** The list entries one direction is built from, keyed by the slot each move fills. */
export interface Ingredients {
  mood: string;
  object?: string;
  material?: string;
  era?: string;
  constraint?: string;
  element?: string;
  tradition?: string;
}

export interface Direction {
  /** Stable id derived from the seed, for example "bd-3kq9x1ma". */
  id: string;
  /** Moves joined with " + ", primary move first. */
  move: string;
  moves: MoveId[];
  /** A creative director's pitch of at most 10 words, from the two strongest moves. */
  title: string;
  /**
   * One short line (at most 8 words) with the third move or a constraint or scale garnish,
   * shown after "Twist:". Empty at wildness 1 and 2.
   */
  twist: string;
  /**
   * The direction's idea: the lead headline ingredient, raw (at most 5 words). Search returns UI
   * only, so search_references with this as `query` searches it in UI forms ("{idea} app ui").
   */
  searchQuery: string;
  /**
   * This direction's own UI queries (lib/bend/queries.ts, P0-05), no two directions of one bend
   * sharing one in any word order: the mechanic lane ("{core} {page} {element} {surface}"), the
   * idea on its part ("{ingredient} {element} ui", not for a rule), the bridge ("{ingredient} ui
   * design", else "{ingredient} interface"), then taste, the brief's other component lane, hero
   * and locale when an earlier direction does not already have them. The brief's page lane
   * (fidelity) is left out: it is the canvas baseline. Plain words: the server adds negatives and
   * site operators when it searches. At most 7 words each.
   */
  searchQueries: string[];
  /** The full combined idea (every move and the twist) for the agent to riff on. */
  prompt: string;
  ingredients: Ingredients;
  /** Where the design lives (detected from the brief unless given). */
  platform: Platform;
  /** The pages the wild idea is for; empty means the brief's own screen. */
  pages: string[];
  /** The full visual spec: type, color, layout, imagery, motion and more, for the platform. */
  spec: VisualSpec;
  /** 1 to 3 image queries of the ingredients for the art zone (subject, medium, composition), no UI words. */
  artQueries: string[];
  /** The working UI part the wild idea becomes (lib/bend/mechanic.ts): build the direction around it. */
  mechanic: Mechanic;
}

/** A place where weirdness pays off on a platform (lib/bend/wild-spots.json). */
export interface WildSpot {
  page: string;
  why: string;
}

export interface LensPreset {
  id: string;
  name: { en: string; ar: string };
  region: string;
  /** Search phrasings, also the lens move's list entries (never reorder: they key direction ids). */
  terms: string[];
  /** Words that mark a search query as this lens's ("talli"). Empty: only its own terms match. */
  anchors: string[];
  /**
   * Title words that mean an off-tradition result ("talli embroidery" returned Egyptian
   * tulle-bi-telli): the search drops them (lib/sources/quality.ts lensExcludeWords).
   */
  exclude: string[];
  /** Arabic display font suggestion on Google Fonts. */
  arabicFont: { family: string; url: string };
}

export interface BendResult {
  brief: string;
  /** Subject pulled from the brief and used in titles. */
  subject: string;
  wildness: Wildness;
  wildnessLabel: string;
  lens: { id: string; name: { en: string; ar: string }; arabicFont: { family: string; url: string } } | null;
  /** Lens ids that fit the brief's Gulf or Arab market when no lens is set, best first; else []. */
  suggestedLenses: string[];
  platform: Platform;
  pages: string[];
  /** Top places for one wild page on this platform. Empty when pages were given. */
  wildSpots: WildSpot[];
  directions: Direction[];
}
