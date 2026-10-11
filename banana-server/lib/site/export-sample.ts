/**
 * The export preview on the landing page ("Ship a kit, not a moodboard"): the start of a
 * DESIGN.md and its tokens, as an export_kit call would write them for the "Woven checkout"
 * example. Shown as code (always left to right), so it stays English on both pages. The colors
 * are the --st-art-* tokens the example tiles are drawn with.
 */
export const SAMPLE_DESIGN_MD = `# Woven checkout

## Direction
Material: Sadu tent bands. A flight checkout where
each step is one woven stripe, and the stripes stop
when the payment is done.

## Rules
- Stripes mark progress only. Nothing else repeats.
- One accent per screen: madder on wool.
- Body text never sits on a stripe.

## Colors
| Role    | Value   | On wool |
|---------|---------|---------|
| primary | #a23b2c | 5.3:1   |
| surface | #efe6d6 | base    |
| ink     | #1c1a19 | 14.0:1  |

## References
- Sadu weaving close-up (pinterest.com)
- Night market signage (behance.net)`;

export const SAMPLE_TOKENS = `{
  "color": {
    "primary": { "$value": "#a23b2c" },
    "surface": { "$value": "#efe6d6" },
    "ink":     { "$value": "#1c1a19" },
    "accent":  { "$value": "#e8a33d" }
  },
  "font": {
    "sans":   { "$value": "Inter" },
    "arabic": { "$value": "IBM Plex Sans Arabic" }
  },
  "radius": { "card": { "$value": "16px" } }
}`;
