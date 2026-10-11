import objects from "./lists/objects.json";
import materials from "./lists/materials.json";
import eras from "./lists/eras.json";
import constraints from "./lists/constraints.json";
import elements from "./lists/elements.json";
import moods from "./lists/moods.json";
import traditions from "./lists/traditions.json";
import layoutWords from "./lists/layout-words.json";
import usabilityWords from "./lists/usability-words.json";
import stopWords from "./lists/stop-words.json";
import lensesJson from "./lenses.json";
import type { LensPreset, ListEntry } from "./types";

type RawEntry = string | { label: string; query?: string };

function normalize(raw: readonly RawEntry[]): ListEntry[] {
  return raw.map((e) =>
    typeof e === "string" ? { label: e, query: e } : { label: e.label, query: e.query ?? e.label },
  );
}

/** Word lists the moves draw from (lib/bend/lists/*.json). */
export const LISTS = {
  objects: normalize(objects),
  materials: normalize(materials),
  eras: normalize(eras),
  constraints: normalize(constraints),
  elements: normalize(elements),
  moods: normalize(moods),
  traditions: normalize(traditions),
} as const;

export type ListName = keyof typeof LISTS;

/** Words stripped from the brief: layout words at wildness 2+, usability words at 5. */
export const LAYOUT_WORDS: ReadonlySet<string> = new Set(layoutWords);
export const USABILITY_WORDS: ReadonlySet<string> = new Set(usabilityWords);
export const STOP_WORDS: ReadonlySet<string> = new Set(stopWords);

export const LENSES: readonly LensPreset[] = lensesJson;
export const LENS_IDS = LENSES.map((l) => l.id);

export function getLens(id: string): LensPreset | undefined {
  return LENSES.find((l) => l.id === id);
}
