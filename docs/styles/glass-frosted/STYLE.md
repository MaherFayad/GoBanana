---
name: style-glass-frosted
description: Glass and frosted. Frosted translucent panels layered over a colourful or photographic backdrop. Load when a direction, brief or board uses the glass-frosted style, to search, place, judge or build in it.
---

# Glass and frosted (`glass-frosted`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `glass-frosted`.

## Definition

Frosted translucent panels layered over a colourful or photographic backdrop.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- A blurred backdrop showing through a panel.
- A soft white edge highlight on the panel.
- Layered cards with soft shadow.
- A landscape or colour field behind a window.

Genres: Mobile, Web (apps and dashboards), Web showcase.

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** Glass used lightly over one rich backdrop, with the text still sharp and readable.
- **Cheap:** Everything blurred, glass on a flat grey ground (it has nothing to show), five stacked glass cards.

## Do

- Give the glass something to show: a photo or a colour field.
- Keep one or two glass layers.
- Put a solid fallback under text for contrast.

## Don't

- Do not blur on a plain ground.
- Do not stack glass on glass on glass.
- Do not let the backdrop drop text contrast under 4.5:1.

## Nearest neighbour: `soft-3d-objects` (Soft 3D objects)

Look at the material. Glass is a flat translucent sheet; soft 3D is a lit object with volume and a cast shadow.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | "glassmorphism app ui", "liquid glass ios app ui", "frosted glass widget app ui" |
| Web (apps and dashboards) | "glassmorphism dashboard ui", "frosted glass web app ui" |
| Web showcase | "glassmorphism website" |
| Deck | not used |
| Brand | not used |

Words in a brief or taste that name this style: "glass", "glassmorphism", "frosted", "frosted glass", "liquid glass", "translucent", "glassy".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `soft-3d-objects`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: Everything blurred, glass on a flat grey ground (it has nothing to show), five stacked glass cards.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

Hejazi roshan screens read well as the backdrop behind a frosted panel; the lattice shows through.

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.
