---
name: gobanana-taste
description: Taste and styles for any GoBanana output (mobile and web screens, websites, decks, brand work, Frankenstein pages, builds). Names the 19 visual styles (dark luminous, dark quiet matte, glass, soft 3D, big type, hero numeral, editorial serif, flat colour, retro and halftone, playful, WebGL, Gulf and Arabic first and more), shows how to read a style from a thumbnail, tags references with rate_references styles, keeps each board's style mix (at most 3 of one style, at least 3 styles, 1 vivid gradient, 60% of an asked style), gives every direction its own style, and judges great versus cheap at the owner's bar. Use when a direction names a style id, when the user says "what style is this", "tag the styles", "too samey", "all dark", "more variety", "make it more editorial", "is this cheap", "judge the references", or when you rate, place or critique references. Loads styles/<id>.md for the style a direction uses. Works with search_references, rate_references, add_to_canvas, get_canvas and bend_brief from the GoBanana MCP server.
---

# GoBanana taste

Every board, deck and page has a visual style. This skill names them, reads them from thumbnails,
keeps a board varied, and judges a reference against the owner's bar. It applies to every output
type: phone screens, web apps, websites, decks, brand work, Frankenstein pages and builds.

The style index lives in `styles/` next to this file: one `styles/<id>.md` per style, with its
signals, great versus cheap, dos and don'ts, nearest neighbour, keywords per genre and judge
rubric. In the GoBanana monorepo the same files are `docs/styles/<id>/STYLE.md` (index:
`docs/styles/INDEX.md`). **Load `styles/<id>.md` when a direction uses that style**, before you
rate, place, write a spec or build for it.

## Ground rules

- **Read the picture, never the title.** A style is what you see in the thumbnail. If you cannot
  see the image, leave it untagged and say so.
- **1 or 2 tags, main first.** The main style is the one you notice first. Add a second only when
  it is clearly there too.
- **Never download, save or copy reference images.** Tags are words on the reference, nothing else.
- Plain words, no em dashes.

## The 19 styles

| Style id | What it is | Nearest neighbour |
| --- | --- | --- |
| `dark-luminous` | Near-black, one glow, bloom, lit object or AI orb is the only light | `dark-quiet-matte` |
| `dark-quiet-matte` | Flat matte near-black UI, tone steps and hairlines, no glow | `dark-luminous` |
| `data-dense-dashboard` | Many real numbers, tables and thin charts, one figure wins | `hero-numeral` |
| `glass-frosted` | Frosted translucent panels over a colour or photo backdrop | `soft-3d-objects` |
| `soft-3d-objects` | Lit glossy or tactile 3D objects inside a UI (Spline, Blender) | `webgl-3d-scene` |
| `vivid-gradient` | A saturated gradient or mesh is the main surface | `dark-luminous` |
| `photographic-hero` | A real photo is the material: phone in hand, window over a landscape, a studio product family | `editorial-serif` |
| `big-type-display` | One word or line set huge in a heavy or condensed sans | `editorial-serif` |
| `hero-numeral` | One huge figure with small grey labels | `big-type-display` |
| `editorial-serif` | A well cut serif on a calm magazine grid | `minimal-mono-light` |
| `minimal-mono-light` | Quiet light UI, one tone, one accent, tight real type | `flat-color-field` |
| `flat-color-field` | Flat shadowless solid colour, one bold ground | `playful-too-fun` |
| `retro-pixel-halftone` | Halftone, dither, pixel, deco, vintage, or raw brutalist type and grid | `type-led-brand-system` |
| `playful-too-fun` | Character, colour and bounce first; the page is a toy | `illustrative-handmade` |
| `illustrative-handmade` | Drawn, printed or collaged artwork carries it | `playful-too-fun` |
| `webgl-3d-scene` | A real-time 3D world is the website itself | `soft-3d-objects` |
| `motion-first` | The movement is the design (layered: usually the second tag) | `webgl-3d-scene` |
| `type-led-brand-system` | One mark, one move, a pattern, applied across things | `flat-color-field` |
| `gulf-arabic-first` | Arabic type and Gulf craft lead, right to left | `type-led-brand-system` |

Merged in the owner's review: packaging and product shots are `photographic-hero`, brutalist and
raw work is `retro-pixel-halftone`, AI orbs and ambient glow are `dark-luminous`.

## Reading a style from a thumbnail

Ask these in order and stop at the first clear answer for the main style:

1. **Is the ground near-black?** Then look for a light source. A glow, bloom, lit object or orb:
   `dark-luminous`. Only tone steps and hairlines: `dark-quiet-matte`. Many widgets and tables
   with one hero number: `data-dense-dashboard` (main) and the dark style as second.
2. **Is a photograph the material?** A hand, a landscape, a face, a product family:
   `photographic-hero`. If a big serif headline leads over a smaller photo: `editorial-serif`.
3. **Does type carry it?** One huge word in a heavy sans: `big-type-display`. One huge figure:
   `hero-numeral`. A refined serif and a grid: `editorial-serif`. Arabic type set large and the
   layout mirrored: `gulf-arabic-first`.
4. **What is the surface?** Frosted panels over a backdrop: `glass-frosted`. A lit object with
   thickness and a shadow: `soft-3d-objects`. A gradient across most of the frame:
   `vivid-gradient`. Flat solid colour, no shadow: `flat-color-field`. Dots, dither, pixels,
   deco or raw system type: `retro-pixel-halftone`.
5. **Is it drawn or a toy?** Calm drawn or collaged art: `illustrative-handmade`. Loud, bouncy,
   a mascot: `playful-too-fun`.
6. **Is it a whole 3D world on a website?** `webgl-3d-scene`.
7. **A light, quiet product screen with one accent?** `minimal-mono-light`.
8. **Is there a motion cue** (a scrubber, a trail, a mid-transition frame, a "0:07" mark)? Add
   `motion-first` as the second tag, never as the only one.

When two styles fit, check the nearest neighbour line in `styles/<id>.md`: it says how to tell
them apart.

## Tagging references

- **After a search,** read the thumbnails and pass `styles` in `rate_references`, one entry per
  rating: `{ referenceId, verdict, styles: ["glass-frosted", "minimal-mono-light"] }`. Tags are
  saved on the canvas tray and the placed reference. A rating needs a verdict, so tag the
  ordinary good results you place with `add_to_canvas` instead (below).
- **Search results may already carry `styles`.** Those are a first guess from the words that found
  them (the style request) or your earlier tags. Check each on its thumbnail and correct it with
  `rate_references` when it is wrong.
- **When placing,** `add_to_canvas` takes `styles` on a reference item too.

## Keeping a board varied (the diversity rule)

A board is one direction's UI references; the art row does not count.

1. At most **3** references of one main style per direction, or **2** when the board has 6 or fewer.
2. At most **60%** of a board carries any one tag. `dark-luminous` and `dark-quiet-matte` count as
   one tag (dark) unless the brief asks for dark.
3. At least **3** main styles per board when no style is asked, or **4** at 8 or more.
4. When the brief or taste asks for a style: at least **60%** of the board is that style or its
   nearest neighbour.
5. Each direction names its style id, and no two directions of one brief share a main style.
6. At most **1** `vivid-gradient` reference per board unless asked: it is the closest style to the
   default AI look.

`search_references` already orders results by rules 1, 2 and 6 and says when it moved some.
`get_canvas` with `summary: true` checks the whole rule per direction and lists untagged
references: fix what it reports by swapping references, not by retagging honestly tagged ones.

## Every direction has a style

`bend_brief` gives each direction a `styleId` (a "Styles" line in its text), never shared within
one brief. An asked style goes to the first direction and its neighbour to the second. Load
`styles/<id>.md` for each kept direction, and show the style id on the direction card. When the
user wants a different style for a direction, say which id you use and keep the ids distinct.

## Judging great versus cheap

Use the owner's bar (docs/taste-bar.md in the monorepo) plus the style's own rubric:

- **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
  none of the style's cheap marks.
- **good:** on style and on page, but generic. Leave it unrated.
- **bad:** off page, off an asked style, a template or kit, or a cheap mark of its style.
- **Default AI look, each mark lowers the grade one step:** a centred hero over three rounded
  12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent, gradient
  text.

## Outputs other than screens

- **Decks:** read each slide like a thumbnail; `big-type-display`, `hero-numeral`, `editorial-serif`
  and `dark-luminous` carry most good decks. Keep one style per deck and vary across directions.
- **Brand work:** `type-led-brand-system`, `flat-color-field`, `photographic-hero` (packaging),
  `illustrative-handmade` and `retro-pixel-halftone` are the usual mains.
- **Builds and Frankenstein pages:** name the style you built in, then check the build against
  that style's signals and don'ts in `styles/<id>.md` (gobanana-critique grades it).
