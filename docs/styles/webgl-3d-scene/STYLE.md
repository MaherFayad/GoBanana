---
name: style-webgl-3d-scene
description: WebGL 3D scene. A real-time 3D object or world is the website itself, moved by scroll or mouse. Load when a direction, brief or board uses the webgl-3d-scene style, to search, place, judge or build in it.
---

# WebGL 3D scene (`webgl-3d-scene`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `webgl-3d-scene`.

## Definition

A real-time 3D object or world is the website itself, moved by scroll or mouse.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- A rendered object centred in the frame (a helmet, an igloo, a planet, an isometric town).
- Depth and light effects.
- Sparse UI chrome on top.
- Often a loader or an "enter" button.

Genres: Web showcase, Web (apps and dashboards).

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** A bespoke object, one clear interaction, fast load.
- **Cheap:** A stock 3D blob over a SaaS headline, a heavy scene with no content, a model that is not the product.

## Do

- Make the 3D the product or the story, not decoration.
- Keep one interaction (scroll or drag) and say it.
- Give a still fallback for reduced motion and slow devices.

## Don't

- No stock blob behind a headline.
- No scene that hides the content.
- Not for decks.

## Nearest neighbour: `soft-3d-objects` (Soft 3D objects)

Look at scale. WebGL 3D scene is a whole world that is the page; soft 3D is an object inside a UI.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | not used |
| Web (apps and dashboards) | "webgl hero web app" |
| Web showcase | "webgl portfolio", "3d landing page", "three js website" |
| Deck | not used |
| Brand | not used |

Words in a brief or taste that name this style: "webgl", "three js", "threejs", "three.js", "shader", "shaders", "real time 3d", "realtime 3d", "3d scene", "3d website", "3d web", "immersive 3d".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `soft-3d-objects`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: A stock 3D blob over a SaaS headline, a heavy scene with no content, a model that is not the product.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

A navigable AlUla canyon or a dhow under sail is a strong single world; keep the craft accurate.

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.
