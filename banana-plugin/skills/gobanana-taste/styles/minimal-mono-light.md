---
name: style-minimal-mono-light
description: Minimal mono light. A quiet light product UI in one tone with one accent and tight, real type. Load when a direction, brief or board uses the minimal-mono-light style, to search, place, judge or build in it.
---

# Minimal mono light (`minimal-mono-light`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `minimal-mono-light`.

## Definition

A quiet light product UI in one tone with one accent and tight, real type.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- White or light grey ground with black text.
- One accent colour.
- Thin dividers, no shadows to speak of.
- One screen shown clean.

Genres: Mobile, Web (apps and dashboards), Deck, Brand.

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** Shipped-grade: real data, tight type, every state resolved.
- **Cheap:** A pastel concept with stock illustration and lorem, or an empty wireframe.

## Do

- Use one accent and spend it on the main action.
- Set type tight with a clear scale of 3 or 4 sizes.
- Show real content and real states.

## Don't

- No pastel palettes with stock illustration.
- No soft 16 px cards under a centred hero (the J8 default).
- No wireframe greys passed off as design.

## Nearest neighbour: `flat-color-field` (Flat colour field)

Look at the ground. Minimal mono is neutral with an accent; flat colour field commits the whole frame to one bold colour.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | "minimal light app ui", "clean ios app ui light" |
| Web (apps and dashboards) | "minimal light web app ui", "clean saas dashboard light" |
| Web showcase | not used |
| Deck | "minimal presentation slide white" |
| Brand | "minimal brand identity" |

Words in a brief or taste that name this style: "minimal", "minimalist", "minimalism", "light mode", "monochrome", "swiss", "quiet light".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `flat-color-field`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: A pastel concept with stock illustration and lorem, or an empty wireframe.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

Japanese ma and Swiss International lean here. Gulf: Najdi whitewash with one ochre accent.

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.
