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
}

/** A word list entry: the label reads well in titles, the query is short and image-searchable. */
export interface ListEntry {
  label: string;
  query: string;
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
  /** A creative director's one-line pitch. */
  title: string;
  /** Short image search query (at most 9 words) for search_references. */
  searchQuery: string;
  /** One line the agent can riff on when sketching the direction. */
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
