/**
 * Style ids (docs/styles/INDEX.md). Dependency free and tiny, so the canvas UI bundle can clean a
 * reference's `styles` without loading the style data. tests/styles.test.ts checks this list
 * against styles.json.
 */
export const STYLE_IDS = [
  "dark-luminous",
  "dark-quiet-matte",
  "data-dense-dashboard",
  "glass-frosted",
  "soft-3d-objects",
  "vivid-gradient",
  "photographic-hero",
  "big-type-display",
  "hero-numeral",
  "editorial-serif",
  "minimal-mono-light",
  "flat-color-field",
  "retro-pixel-halftone",
  "playful-too-fun",
  "illustrative-handmade",
  "webgl-3d-scene",
  "motion-first",
  "type-led-brand-system",
  "gulf-arabic-first",
] as const;

export type StyleId = (typeof STYLE_IDS)[number];

/** Most style tags on one reference: its main style and at most one more. */
export const MAX_STYLE_TAGS = 2;

/** Draft 1 ids the owner merged (2026-10-16): old tags still read as the style they joined. */
export const MERGED_STYLE_IDS: Readonly<Record<string, StyleId>> = {
  "packaging-product-shot": "photographic-hero",
  "brutalist-raw": "retro-pixel-halftone",
  "ai-orb-glow": "dark-luminous",
};

export function isStyleId(value: unknown): value is StyleId {
  return typeof value === "string" && (STYLE_IDS as readonly string[]).includes(value);
}

/**
 * Clean style tags: known ids only (merged draft ids read as the style they joined), no repeats,
 * main style first, at most MAX_STYLE_TAGS. Undefined when none is left.
 */
export function cleanStyles(raw: unknown): StyleId[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: StyleId[] = [];
  for (const v of raw) {
    const id = typeof v === "string" ? (MERGED_STYLE_IDS[v.trim().toLowerCase()] ?? v.trim().toLowerCase()) : null;
    if (!isStyleId(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length >= MAX_STYLE_TAGS) break;
  }
  return out.length > 0 ? out : undefined;
}
