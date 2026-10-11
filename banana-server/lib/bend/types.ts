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
  /** Style words for the taste lane (lib/taste.ts). Defaults to DEFAULT_TASTE. Never changes ids. */
  taste?: readonly string[];
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
   * Inspiration query: the lead ingredient alone with one anchor word (at most 5 words), for
   * search_references `query`. Same as searchQueries[0].
   */
  searchQuery: string;
  /**
   * Focused queries search_references runs for a directionId, one per lane: inspiration (same as
   * searchQuery), taste (brief domain and component plus one style word) and fidelity (the brief's
   * domain and screen type, shared by every direction of a brief). At most 6 words each.
   */
  searchQueries: string[];
  /** The full combined idea (every move and the twist) for the agent to riff on. */
  prompt: string;
  ingredients: Ingredients;
}

export interface LensPreset {
  id: string;
  name: { en: string; ar: string };
  region: string;
  terms: string[];
}

export interface BendResult {
  brief: string;
  /** Subject pulled from the brief and used in titles. */
  subject: string;
  wildness: Wildness;
  wildnessLabel: string;
  lens: { id: string; name: { en: string; ar: string } } | null;
  directions: Direction[];
}
