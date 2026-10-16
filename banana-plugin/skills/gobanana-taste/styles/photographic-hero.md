---
name: style-photographic-hero
description: Photographic hero. A real photograph is the material: a phone in a hand, a window over a mountain, a face, or a product family lit like a studio shot. Load when a direction, brief or board uses the photographic-hero style, to search, place, judge or build in it.
---

# Photographic hero (`photographic-hero`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `photographic-hero`.

## Definition

A real photograph is the material: a phone in a hand, a window over a mountain, a face, or a product family lit like a studio shot.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- A full-bleed photo, or a device held in a photographed hand.
- A UI window over a landscape.
- Natural or studio light with shallow depth.
- Type laid over the photo; or 3 to 6 packs in one palette on a seamless backdrop.

Genres: Mobile, Web (apps and dashboards), Web showcase, Deck, Brand.

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** One photo with a clear subject and a UI or type that fits it; a packaging family with one system, lit to feel real.
- **Cheap:** Stock handshakes, a lone laptop with nothing on screen, a photo under a coloured wash, a shelf of generic bottles, a flat label pasted on a bottle render.

## Do

- Pick one photo with one subject and crop it with intent.
- Let the UI or type sit where the photo leaves room.
- For packaging, show the family together, lit once.

## Don't

- No stock business photography.
- No coloured wash over the photo to hide it.
- No mockup bundles or generic bottle renders.

## Nearest neighbour: `editorial-serif` (Editorial serif)

Ask what leads. In photographic hero the picture leads; in editorial serif the type leads and the photo supports.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | "app ui in hand photo", "app screen over landscape photo" |
| Web (apps and dashboards) | "web app window over landscape", "dashboard mockup photo desk" |
| Web showcase | "photography website full bleed" |
| Deck | "photo presentation slide full bleed" |
| Brand | "packaging design family studio shot", "brand identity in use photo" |

Words in a brief or taste that name this style: "photographic", "photography", "photo led", "photo-led", "full bleed photo", "product shot", "packaging shot", "studio shot", "lifestyle photo".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `editorial-serif`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: Stock handshakes, a lone laptop with nothing on screen, a photo under a coloured wash, a shelf of generic bottles, a flat label pasted on a bottle render.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

Photograph the real craft: a Sadu loom, Talli braid on a sleeve, a Najdi door. Credit the maker.

## Merged into this style

- `packaging-product-shot` (draft 1) was folded in here (owner decision, 2026-10-16). It lives in: The definition and signals (a packaging family lit like a studio shot), Great vs cheap (one system, lit to feel real; no generic bottles), the Don'ts (no mockup bundles) and the brand keywords ("packaging design family studio shot").

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.
