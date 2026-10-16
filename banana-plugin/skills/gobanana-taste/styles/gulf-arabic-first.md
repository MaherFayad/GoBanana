---
name: style-gulf-arabic-first
description: Gulf and Arabic first. Arabic type and Gulf craft lead the layout, right to left, with pattern or material taken from a named Gulf craft. Load when a direction, brief or board uses the gulf-arabic-first style, to search, place, judge or build in it.
---

# Gulf and Arabic first (`gulf-arabic-first`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `gulf-arabic-first`.

## Definition

Arabic type and Gulf craft lead the layout, right to left, with pattern or material taken from a named Gulf craft.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- Arabic display, Naskh or Kufic type set large.
- A right to left layout with mirrored flow.
- Sadu, Talli, Najdi or roshan pattern used as a band or field, not a stamp.
- Warm sand, indigo, saffron and black grounds.

Genres: Mobile, Web (apps and dashboards), Web showcase, Deck, Brand.

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** Credits the craft, uses its real grammar, sets Arabic by a native eye and mirrors the layout.
- **Cheap:** A mosque silhouette, gold crescents, a pattern as wallpaper, Arabic letters in a Latin layout, fake letterforms.

## Do

- Set Arabic first and mirror the whole layout, numbers and icons included where they should flip.
- Name the craft and its region, and use its real motifs.
- Pair a real Arabic face with a Latin one by weight and size, not by look-alike.

## Don't

- No mosque silhouettes, gold crescents or camels as decoration.
- No pattern as wallpaper behind everything.
- No fake or broken Arabic shaping; no sacred text as decoration.

## Nearest neighbour: `type-led-brand-system` (Type-led brand system)

Look at direction and script. Gulf and Arabic first changes the layout and the script; a brand system only changes the mark.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | "arabic app ui rtl", "saudi app ui arabic" |
| Web (apps and dashboards) | "arabic dashboard ui rtl", "arabic web app ui" |
| Web showcase | "arabic website design", "saudi website design" |
| Deck | "arabic presentation design" |
| Brand | "arabic brand identity", "arabic typography poster", "saudi brand identity" |

Words in a brief or taste that name this style: "arabic first", "arabic-first", "gulf style", "khaleeji", "arabic typography", "arabic type", "arabic calligraphy", "khatt", "arabic lettering".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `type-led-brand-system`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: A mosque silhouette, gold crescents, a pattern as wallpaper, Arabic letters in a Latin layout, fake letterforms.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

Gulf lenses (atlas-build/data/lens-list.json): sadu, talli, qatt-asiri, najdi, hejazi-roshan, kufic, diwani, alula-strata, dhow. A lens is a modifier inside any style; this style is where Arabic and the craft lead.

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.

The owner's 211 picks hold no Arabic or Gulf work. The Gulf/Arabic picker tab (ids ga001 onward) holds candidates; exemplars come from the owner's picks there.
