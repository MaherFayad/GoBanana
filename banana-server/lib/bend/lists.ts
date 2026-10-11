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
import renamedJson from "./renamed.json";
import type { LensPreset, ListEntry } from "./types";

type RawEntry = string | { label: string; query?: string };

/**
 * Entries reworded after launch, per list ("lens:<id>" for lens terms): new label to old label.
 * The old label stays the entry's key, so picks and direction ids never move. To reword an entry,
 * edit it in place (never reorder or change list lengths) and add a row here.
 */
export const RENAMED: Readonly<Record<string, Readonly<Record<string, string>>>> = renamedJson;

function normalize(raw: readonly RawEntry[], list: string): ListEntry[] {
  const renamed = RENAMED[list] ?? {};
  return raw.map((e) => {
    const label = typeof e === "string" ? e : e.label;
    const query = typeof e === "string" ? e : (e.query ?? e.label);
    return { label, query, key: renamed[label] ?? label };
  });
}

/** Word lists the moves draw from (lib/bend/lists/*.json). */
export const LISTS = {
  objects: normalize(objects, "objects"),
  materials: normalize(materials, "materials"),
  eras: normalize(eras, "eras"),
  constraints: normalize(constraints, "constraints"),
  elements: normalize(elements, "elements"),
  moods: normalize(moods, "moods"),
  traditions: normalize(traditions, "traditions"),
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

/** A lens preset's terms as list entries (the term is both label and query). */
export function lensEntries(lens: LensPreset): ListEntry[] {
  return normalize(lens.terms, `lens:${lens.id}`);
}
