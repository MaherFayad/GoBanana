/**
 * Google Fonts family check (plan 6.3: "the script rejects unknown names"). Reads the cached list
 * in data/google-fonts.json (refresh with `npm run fonts`). Arabic slots also need the family to
 * carry the arabic subset.
 */
import { readFileSync } from "node:fs";
import { PATHS } from "../config.ts";

export type FontList = { source: string; fetched: string; families: Array<{ family: string; category: string; subsets: string[] }> };

export type FontIndex = {
  /** Lowercased family name to its canonical spelling and subsets. */
  byName: Map<string, { family: string; subsets: string[] }>;
};

export function indexFonts(list: FontList): FontIndex {
  const byName = new Map<string, { family: string; subsets: string[] }>();
  for (const f of list.families) byName.set(f.family.toLowerCase(), { family: f.family, subsets: f.subsets });
  return { byName };
}

let cached: FontIndex | null = null;
export function loadFonts(path = PATHS.fonts): FontIndex {
  if (!cached) cached = indexFonts(JSON.parse(readFileSync(path, "utf8")) as FontList);
  return cached;
}

/**
 * Problems with one family name, empty when it is fine. The name must match a Google Fonts family
 * exactly (case included, so exports can use it as is); `script: "arabic"` also needs the subset.
 */
export function checkFamily(name: string, fonts: FontIndex, script: "latin" | "arabic" = "latin"): string[] {
  const hit = fonts.byName.get(name.trim().toLowerCase());
  if (!hit) return [`font "${name}" is not a Google Fonts family`];
  if (hit.family !== name) return [`font "${name}" must be spelled "${hit.family}"`];
  if (!hit.subsets.includes(script)) return [`font "${name}" has no ${script} subset`];
  return [];
}

type TypeSpec = { latin: { display: string; body: string }; arabic: { display: string; body: string } };

/** Checks the four families of an IngredientCard["type"] (also LensPack typePairs entries). */
export function checkTypeSpec(type: TypeSpec, fonts: FontIndex, path = "type"): string[] {
  return [
    ...checkFamily(type.latin.display, fonts, "latin").map((p) => `${path}.latin.display: ${p}`),
    ...checkFamily(type.latin.body, fonts, "latin").map((p) => `${path}.latin.body: ${p}`),
    ...checkFamily(type.arabic.display, fonts, "arabic").map((p) => `${path}.arabic.display: ${p}`),
    ...checkFamily(type.arabic.body, fonts, "arabic").map((p) => `${path}.arabic.body: ${p}`),
  ];
}
