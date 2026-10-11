import type { Wildness } from "./types";

export interface WildnessRule {
  label: string;
  /** Moves per direction: [min, max]. Level 4 alternates between 2 and 3. */
  moves: readonly [number, number];
  /** Keep layout words (screen, page, flow, UI, app) in the query. */
  keepLayoutWords: boolean;
  /** Strip usability words (easy, clean, intuitive) from the subject. */
  ignoreUsabilityWords: boolean;
  /** Closing line of each direction prompt. */
  hint: string;
}

/** Spec section 7, wildness table. */
export const WILDNESS: Record<Wildness, WildnessRule> = {
  1: {
    label: "Fresh",
    moves: [1, 1],
    keepLayoutWords: true,
    ignoreUsabilityWords: false,
    hint: "Keep the familiar layout and controls, change only the surface.",
  },
  2: {
    label: "Bold",
    moves: [1, 1],
    keepLayoutWords: false,
    ignoreUsabilityWords: false,
    hint: "Keep it usable, but let the layout bend.",
  },
  3: {
    label: "Weird",
    moves: [2, 2],
    keepLayoutWords: false,
    ignoreUsabilityWords: false,
    hint: "Let the two ideas collide in one screen.",
  },
  4: {
    label: "Wild",
    moves: [2, 3],
    keepLayoutWords: false,
    ignoreUsabilityWords: false,
    hint: "Push further than feels safe.",
  },
  5: {
    label: "Bananas",
    moves: [3, 3],
    keepLayoutWords: false,
    ignoreUsabilityWords: true,
    hint: "Ignore usability rules for this pass and make it unforgettable.",
  },
};
