---
name: style-flat-color-field
description: Flat colour field. Flat, shadowless blocks of solid colour, with one bold ground and no gradients. Load when a direction, brief or board uses the flat-color-field style, to search, place, judge or build in it.
---

# Flat colour field (`flat-color-field`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `flat-color-field`.

## Definition

Flat, shadowless blocks of solid colour, with one bold ground and no gradients.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- A solid saturated ground (lime, orange, red, cobalt, green).
- Flat shapes with hard edges.
- No shadow, no blur.
- Black or white type.

Genres: Deck, Brand, Web (apps and dashboards), Web showcase, Mobile.

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** 2 or 3 flat colours and a strong type or mark.
- **Cheap:** Six pastels, drop shadows creeping in, flat stock illustration characters.

## Do

- Commit the frame to one bold ground.
- Limit the palette to 2 or 3 colours.
- Let type or a mark carry the idea.

## Don't

- No gradients or soft shadows.
- No pastel rainbow.
- No Corporate Memphis people.

## Nearest neighbour: `playful-too-fun` (Playful, too fun)

Look at the energy. Flat colour field is confident and static; playful adds character, bounce and surprise.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | "bold color app ui flat" |
| Web (apps and dashboards) | "flat color landing page bold" |
| Web showcase | "bold color website flat" |
| Deck | "bold color presentation slide" |
| Brand | "bold color brand identity", "color block poster" |

Words in a brief or taste that name this style: "flat color", "flat colour", "flat design", "color block", "colour block", "color blocking", "colour blocking", "bold color", "bold colour", "bauhaus".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `playful-too-fun`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: Six pastels, drop shadows creeping in, flat stock illustration characters.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

Sadu's red, black and white blocks are a ready flat palette; Bauhaus and Memphis lean here.

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.
