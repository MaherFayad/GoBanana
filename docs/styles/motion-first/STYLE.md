---
name: style-motion-first
description: Motion first. The design is the movement (scrub, drag, morph, kinetic type), and the still is the least of it. Load when a direction, brief or board uses the motion-first style, to search, place, judge or build in it.
---

# Motion first (`motion-first`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `motion-first`.

## Definition

The design is the movement (scrub, drag, morph, kinetic type), and the still is the least of it.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- A slider, dial or scrubber with a visible state.
- Motion blur or a trail, or a mid-transition frame.
- A before and after pair.
- A "0:07" or 60fps mark on the shot.

Genres: Mobile, Web showcase, Web (apps and dashboards), Deck.

**Layered style.** Stills cannot show motion. It is a tag layered on a base style (almost always dark luminous or minimal mono light), so it is usually the second tag, and it needs a motion exemplar beside the still.

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** One rehearsed gesture with a clear start and end state and a reason.
- **Cheap:** Fades on everything, bouncing icons, parallax for its own sake.

## Do

- Pick one gesture and design both end states.
- Keep it under 400 ms for UI, and honour reduced motion.
- Show it with a video or GIF beside the still.

## Don't

- No motion on every element.
- No parallax as the idea.
- Not a main style on its own: layer it on a base style.

## Nearest neighbour: `webgl-3d-scene` (WebGL 3D scene)

Look at the carrier. Motion first is a UI gesture or a type move; WebGL 3D is a rendered world.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | "micro interaction app ui animation", "60fps app animation" |
| Web (apps and dashboards) | "interactive dashboard animation" |
| Web showcase | "scroll storytelling", "animation", "interactive" |
| Deck | "animated presentation slides" |
| Brand | "motion identity" |

Words in a brief or taste that name this style: "motion", "motion first", "motion led", "motion heavy", "animated", "animation", "animations", "micro interactions", "microinteractions", "lottie", "scroll story", "scroll storytelling", "scrollytelling", "storytelling", "parallax", "interactive", "gamified".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `webgl-3d-scene`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: Fades on everything, bouncing icons, parallax for its own sake.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

A Talli braid that tightens as progress fills, or a Sadu row that weaves in, are good single gestures.

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.
