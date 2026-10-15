/**
 * Coherence check for a direction (P0-08, pure, no AI). Spec fields used to be filled on their own:
 * the mood picked the color even when the ingredient implied another ("Boxing poster" with "cool
 * grays"), the mechanic named the header while the pattern named a bottom sheet, and several
 * directions shared one generic whyItFits line. bendBrief retries a direction (at most 5 times,
 * moving its mechanic) while this returns problems.
 */
import { LENSES, LISTS, lensEntries } from "./lists";
import type { MechanicElement } from "./mechanic";
import { MOVE_DEFS } from "./moves";
import { inspirationQuery } from "./queries";
import { fightsFamily, fixCase, leadFamily, PART } from "./spec";
import type { Direction, ListEntry, MoveId } from "./types";

/** Most draws bendBrief makes for one direction before it keeps the last one. */
export const MAX_COHERENCE_TRIES = 5;

/** The fields checkCoherence reads. */
export type CoherenceInput = Pick<Direction, "id" | "moves" | "ingredients" | "searchQuery" | "mechanic" | "spec">;

let lensIndex: ListEntry[] | undefined;

function entryFor(move: MoveId, label: string): ListEntry | undefined {
  const own = LISTS[MOVE_DEFS[move].list].find((e) => e.label === label);
  if (own || move !== "lens") return own;
  lensIndex ??= LENSES.flatMap(lensEntries);
  return lensIndex.find((e) => e.label === label);
}

/** The lead ingredient: the move whose idea is the direction's searchQuery. Undefined for old rows. */
export function leadIngredient(d: Pick<Direction, "moves" | "ingredients" | "searchQuery">): { move: MoveId; entry: ListEntry } | undefined {
  for (const move of d.moves) {
    const label = d.ingredients[MOVE_DEFS[move].slot];
    const entry = label ? entryFor(move, label) : undefined;
    if (entry && inspirationQuery(move, entry.query) === d.searchQuery) return { move, entry };
  }
  return undefined;
}

/** Remove a hint's text from a line, any case, so only the words the engine added are judged. */
function without(line: string, hint: string | undefined): string {
  if (!hint) return line;
  const h = fixCase(hint.trim().replace(/[.\s]+$/, "")).toLowerCase();
  return line.toLowerCase().split(h).join(" ");
}

/**
 * Problems with one direction, as plain lines; [] when it holds together:
 * - the pattern is not on the mechanic's part;
 * - the color line has temperature words that fight the lead ingredient's palette family (its own
 *   color hint and a constraint's color rule are the ingredient talking, so they are not judged);
 * - another direction of the same bend (`bend`) has the same layout or whyItFits line.
 */
export function checkCoherence(d: CoherenceInput, bend: readonly CoherenceInput[] = []): string[] {
  const problems: string[] = [];
  const part = PART[d.mechanic.element as MechanicElement];
  if (part && !d.spec.pattern.toLowerCase().includes(part)) {
    problems.push(`The pattern is not on the mechanic's ${part}: ${d.spec.pattern}`);
  }
  const lead = leadIngredient(d);
  if (lead) {
    const family = leadFamily(lead.move, lead.entry);
    const constraint = d.ingredients.constraint ? entryFor("constraint", d.ingredients.constraint) : undefined;
    // The ingredient's own words (its name, its color hint) and a constraint's color rule are not judged.
    const added = without(without(without(d.spec.color, lead.entry.hints.color), constraint?.hints.color), lead.entry.label);
    if (fightsFamily(added, family)) problems.push(`The color line fights the ${family} palette of ${lead.entry.label}: ${d.spec.color}`);
  }
  for (const o of bend) {
    if (o.id === d.id) continue;
    if (o.spec.layout === d.spec.layout) problems.push(`Same layout line as ${o.id}: ${d.spec.layout}`);
    if (o.spec.whyItFits === d.spec.whyItFits) problems.push(`Same whyItFits line as ${o.id}: ${d.spec.whyItFits}`);
  }
  return problems;
}
