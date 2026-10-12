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
import { isTypeVoice, PLATFORMS, type Platform } from "@/lib/direction-detail";
import { TONES, type EntryHints, type LensPreset, type ListEntry, type Tone } from "./types";

type RawEntry =
  | string
  | {
      label: string;
      query?: string;
      leads?: boolean;
      tone?: string[];
      w?: number;
      notOn?: string[];
      voice?: string;
      color?: string;
      tex?: string;
      motion?: string;
      img?: string;
      icons?: string;
      layout?: string;
      density?: string;
      pattern?: string;
      style?: string[];
    };

/**
 * Entries per list as first published (bend-v1). Entries past these counts were added in wild
 * directions v2. Briefs with no detected platform draw the first entries first, so their picks
 * (and direction ids) stay as they were. Never edit these numbers.
 */
export const LEGACY_SIZES: Readonly<Record<string, number>> = {
  objects: 58,
  materials: 58,
  eras: 51,
  constraints: 48,
  elements: 54,
  moods: 45,
  traditions: 48,
};

/** Default weirdness when an entry does not say: objects are odd by nature. */
const DEFAULT_WEIRD: Readonly<Record<string, 1 | 2 | 3>> = { objects: 2 };

function hintsOf(e: RawEntry, list: string): EntryHints {
  const raw: Exclude<RawEntry, string> = typeof e === "string" ? { label: e } : e;
  const w = raw.w === 1 || raw.w === 2 || raw.w === 3 ? raw.w : (DEFAULT_WEIRD[list] ?? 1);
  return {
    tone: (raw.tone ?? []).filter((t): t is Tone => (TONES as readonly string[]).includes(t)),
    weird: w,
    notOn: (raw.notOn ?? []).filter((p): p is Platform => (PLATFORMS as readonly string[]).includes(p)),
    ...(isTypeVoice(raw.voice) ? { voice: raw.voice } : {}),
    ...(raw.color ? { color: raw.color } : {}),
    ...(raw.tex ? { tex: raw.tex } : {}),
    ...(raw.motion ? { motion: raw.motion } : {}),
    ...(raw.img ? { img: raw.img } : {}),
    ...(raw.icons ? { icons: raw.icons } : {}),
    ...(raw.layout ? { layout: raw.layout } : {}),
    ...(raw.density ? { density: raw.density } : {}),
    ...(raw.pattern ? { pattern: raw.pattern } : {}),
    style: raw.style ?? [],
  };
}

/**
 * Entries reworded after launch, per list ("lens:<id>" for lens terms): new label to old label.
 * The old label stays the entry's key, so picks and direction ids never move. To reword an entry,
 * edit it in place (never reorder or change list lengths) and add a row here.
 */
export const RENAMED: Readonly<Record<string, Readonly<Record<string, string>>>> = renamedJson;

/** The bend-v1 part of a list (its first LEGACY_SIZES entries). */
export function legacyPart(list: string, entries: readonly ListEntry[]): readonly ListEntry[] {
  const n = LEGACY_SIZES[list];
  return n === undefined ? entries : entries.slice(0, n);
}

function normalize(raw: readonly RawEntry[], list: string): ListEntry[] {
  const renamed = RENAMED[list] ?? {};
  return raw.map((e) => {
    const label = typeof e === "string" ? e : e.label;
    const query = typeof e === "string" ? e : (e.query ?? e.label);
    const leads = typeof e === "string" ? true : (e.leads ?? true);
    return { label, query, key: renamed[label] ?? label, leads, hints: hintsOf(e, list) };
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
