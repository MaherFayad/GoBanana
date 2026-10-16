---
name: style-dark-quiet-matte
description: Dark quiet matte. A flat, matte, near-black product UI with no glow, built from tone steps and hairlines. Load when a direction, brief or board uses the dark-quiet-matte style, to search, place, judge or build in it.
---

# Dark quiet matte (`dark-quiet-matte`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `dark-quiet-matte`.

## Definition

A flat, matte, near-black product UI with no glow, built from tone steps and hairlines.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- Matte black or charcoal ground.
- Surfaces differ by 2 to 4% lightness; no glow, no bloom.
- 1 px borders and dividers.
- One small accent: a green or blue dot, a status chip.

Genres: Mobile, Web (apps and dashboards), Deck.

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** Reads as a real tool: dense but calm tables, thin charts, one accent, every state resolved.
- **Cheap:** A black skin on a light layout, grey on grey with no hierarchy, default chart colours on black.

## Do

- Build hierarchy from 3 or 4 surface tones and type weight, not colour.
- Keep one accent for status or the main action.
- Check that text on the raised surfaces still passes 4.5:1.

## Don't

- Do not add glow or gradients (that is dark luminous).
- Do not invert a light layout and call it dark.
- Do not use pure #000 with pure #fff text everywhere.

## Nearest neighbour: `dark-luminous` (Dark luminous)

No light source at all. If something glows or blooms it is dark luminous; if the frame is about information load more than surface, it is data dense dashboard.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | "dark matte app ui minimal", "charcoal app ui hairline" |
| Web (apps and dashboards) | "dark mode minimal web app ui", "dark saas dashboard matte ui" |
| Web showcase | not used |
| Deck | "dark minimal presentation slide" |
| Brand | not used |

Words in a brief or taste that name this style: "matte", "dark matte", "quiet dark", "charcoal", "graphite", "dark minimal".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `dark-luminous`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: A black skin on a light layout, grey on grey with no hierarchy, default chart colours on black.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

Najdi mud plaster tones and dhow teak work as the surface steps; a Kufic grid can set the hairlines.

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.
