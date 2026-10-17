/**
 * Art translation (V4.3, plan section 6): every art direction reference names what it gives the
 * page. `stealAxis` is what to take from the image, `becomes` is the UI part it turns into.
 * Pure, no imports, so the canvas UI, the tools and the exports can share it.
 */

export const STEAL_AXES = ["type", "color", "pattern", "composition", "texture", "motion", "notation"] as const;
export type StealAxis = (typeof STEAL_AXES)[number];

/** Longest `becomes` line: the UI part an art reference turns into. */
export const MAX_BECOMES = 80;

export function isStealAxis(v: unknown): v is StealAxis {
  return typeof v === "string" && (STEAL_AXES as readonly string[]).includes(v);
}

/** A trimmed `becomes` of 1 to MAX_BECOMES characters, else null. */
export function cleanBecomes(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length >= 1 && s.length <= MAX_BECOMES ? s : null;
}

/** Default by_cluster row of an art item: the row of what it informs. */
const AXIS_CLUSTER: Record<StealAxis, string> = {
  type: "type",
  color: "color",
  motion: "motion",
  composition: "layout",
  pattern: "art",
  texture: "art",
  notation: "art",
};

export function clusterForAxis(axis: StealAxis): string {
  return AXIS_CLUSTER[axis];
}

/** The plain refusal for an art item without a valid stealAxis and becomes. `n` counts from 1. */
export function artTranslationMessage(n: number): string {
  return `Item ${n} is art: add stealAxis (${STEAL_AXES.slice(0, -1).join(", ")} or ${STEAL_AXES[STEAL_AXES.length - 1]}) and becomes, the UI part it turns into, up to ${MAX_BECOMES} characters.`;
}

/** The plain refusal for a UI item that carries a bad stealAxis or becomes. `n` counts from 1. */
export function translationFieldsMessage(n: number): string {
  return `Item ${n}: stealAxis must be ${STEAL_AXES.slice(0, -1).join(", ")} or ${STEAL_AXES[STEAL_AXES.length - 1]}, and becomes 1 to ${MAX_BECOMES} characters. Fix them or leave them out.`;
}
