---
name: style-retro-pixel-halftone
description: Retro, raw, pixel and halftone. A deliberate older or rougher look: halftone, dither, pixel, Art Deco, vintage badge, or raw brutalist type and grid. Load when a direction, brief or board uses the retro-pixel-halftone style, to search, place, judge or build in it.
---

# Retro, raw, pixel and halftone (`retro-pixel-halftone`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `retro-pixel-halftone`.

## Definition

A deliberate older or rougher look: halftone, dither, pixel, Art Deco, vintage badge, or raw brutalist type and grid.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- Dot-screen or dither texture, or a pixelated image.
- Deco display letters or a round badge, limited ink colours, paper grain.
- Or raw: system or mono type used loud, a visible grid, harsh contrast.
- Cut-off or overlapping text, visible table lines, noise or glitch.

Genres: Brand, Web showcase, Deck, Mobile, Web (apps and dashboards).

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** Texture as a second voice on one element (the "BUDGET" card), not a wash; raw on purpose and exact underneath (alignment is tight).
- **Cheap:** A retro filter on everything, an 80s neon grid, fake worn textures; or just messy, or neo-brutalist cards with thick black borders and a pastel shadow.

## Do

- Use the texture or rawness on one element or one layer.
- Keep the grid exact under the rough surface.
- Use 2 or 3 inks, as print would.

## Don't

- No retro filter over the whole screen.
- No synthwave grid by default.
- No thick-border pastel-shadow neo-brutalist cards.

## Nearest neighbour: `type-led-brand-system` (Type-led brand system)

Look at the cue. Retro quotes an older medium (print, pixel, CRT) or a raw unstyled one; a type-led brand system is about the mark and its system, any era.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | "halftone app ui texture", "pixel retro app ui" |
| Web (apps and dashboards) | "brutalist web app ui", "retro terminal ui" |
| Web showcase | "brutalist website", "experimental website", "retro website pixel" |
| Deck | "brutalist presentation slide" |
| Brand | "halftone poster design", "retro brand identity", "brutalist poster" |

Words in a brief or taste that name this style: "retro", "vintage", "pixel", "pixel art", "8 bit", "8-bit", "halftone", "dither", "risograph", "art deco", "deco", "grainy", "grain", "glitch", "brutalist", "brutalism", "neubrutalism", "neubrutalist", "experimental", "teletext".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `type-led-brand-system`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: A retro filter on everything, an 80s neon grid, fake worn textures; or just messy, or neo-brutalist cards with thick black borders and a pastel shadow.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

Old Gulf print (stamps, ration cards, cinema posters) and Kufic on a pixel grid work well; avoid orientalist vintage.

## Merged into this style

- `brutalist-raw` (draft 1) was folded in here (owner decision, 2026-10-16). It lives in: The definition and signals (raw system type, visible grid, harsh contrast, glitch), Great vs cheap (raw on purpose and exact underneath; no neo-brutalist pastel-shadow cards), the Don'ts, and the web and showcase keywords ("brutalist website", "experimental website"). The showcase id "experimental" maps here.

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.
