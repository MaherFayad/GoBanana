---
name: style-type-led-brand-system
description: Type-led brand system. An identity built from one mark, one move and a pattern, applied to posters, signage and sets. Load when a direction, brief or board uses the type-led-brand-system style, to search, place, judge or build in it.
---

# Type-led brand system (`type-led-brand-system`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `type-led-brand-system`.

## Definition

An identity built from one mark, one move and a pattern, applied to posters, signage and sets.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- A wordmark or monogram.
- A repeating pattern or wall of the wordmark.
- One ground and one accent.
- The mark on a banner, bag or billboard; a poster set in one palette.

Genres: Brand, Deck, Web showcase.

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** One idea carried through many applications.
- **Cheap:** A logo floating on a mockup, twelve logo options on a page, a guideline template.

## Do

- Show the mark in use on real things.
- Carry one move (a cut, a stack, a bounce) everywhere.
- Keep one ground and one accent.

## Don't

- No logo-on-mockup only.
- No logo option sheets.
- No guideline templates.

## Nearest neighbour: `flat-color-field` (Flat colour field)

Look at the scope. A type-led brand system is the mark and its system across things; flat colour field is the surface treatment.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | not used |
| Web (apps and dashboards) | not used |
| Web showcase | "brand system website" |
| Deck | "brand presentation slides" |
| Brand | "logo system brand identity", "wordmark brand identity", "visual identity system poster" |

Words in a brief or taste that name this style: "wordmark", "logo system", "type led", "type-led", "brand system", "monogram", "identity system", "logotype".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `flat-color-field`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: A logo floating on a mockup, twelve logo options on a page, a guideline template.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

An Arabic and Latin wordmark pair built on one move is the Gulf version; a Sadu repeat makes the pattern.

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.
