---
name: style-soft-3d-objects
description: Soft 3D objects. UI widgets and cards rendered as lit, glossy or tactile 3D objects, in the Spline and Blender manner. Load when a direction, brief or board uses the soft-3d-objects style, to search, place, judge or build in it.
---

# Soft 3D objects (`soft-3d-objects`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `soft-3d-objects`.

## Definition

UI widgets and cards rendered as lit, glossy or tactile 3D objects, in the Spline and Blender manner.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- A rounded squircle slab with visible thickness.
- Glossy gradient glass, rubber or clay material.
- A cast shadow on a light or dark floor.
- One object per frame.

Genres: Mobile, Web (apps and dashboards), Deck, Brand.

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** One object, believable light, a real number or label on it.
- **Cheap:** Stock 3D people, plastic icon packs, floating coins and padlocks.

## Do

- Use one hero object and keep the UI around it flat.
- Light it from one side and ground it with a shadow.
- Give it a job: the card, the balance, the toggle.

## Don't

- No stock 3D characters.
- No 3D icon pack on every list row.
- No floating coins, shields and locks as decoration.

## Nearest neighbour: `webgl-3d-scene` (WebGL 3D scene)

Look at scale. Soft 3D is an object inside a UI or on a slide; WebGL 3D scene is a whole navigable world that is the page.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | "3d card app ui spline", "soft 3d widget app ui" |
| Web (apps and dashboards) | "3d object dashboard ui", "spline 3d web app ui" |
| Web showcase | not used |
| Deck | "3d object presentation cover slide" |
| Brand | "3d brand identity render" |

Words in a brief or taste that name this style: "soft 3d", "3d objects", "3d object", "3d icons", "clay", "claymorphism", "spline", "tactile 3d", "3d", "3d render".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `webgl-3d-scene`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: Stock 3D people, plastic icon packs, floating coins and padlocks.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

Najdi door studs and AlUla sandstone make good single objects; light them like a product.

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.
