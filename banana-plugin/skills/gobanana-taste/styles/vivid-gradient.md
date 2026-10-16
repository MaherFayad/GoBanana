---
name: style-vivid-gradient
description: Vivid gradient field. A saturated, smooth gradient or mesh is the main surface of the screen or slide. Load when a direction, brief or board uses the vivid-gradient style, to search, place, judge or build in it.
---

# Vivid gradient field (`vivid-gradient`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `vivid-gradient`.

## Definition

A saturated, smooth gradient or mesh is the main surface of the screen or slide.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- A full-bleed colour gradient or mesh.
- Blue to violet or orange to red, saturated.
- White type on the gradient.
- Often one glassy card on top.

Genres: Mobile, Web (apps and dashboards), Deck, Brand.

**Watch.** Closest style to the J8 default AI look. The judge gates it hardest, and the diversity rule allows at most 1 per board unless asked.

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** One hue family with luminous depth, and the gradient has a job (a mood, a plan colour, a state).
- **Cheap:** The default AI look: an indigo to violet gradient, gradient text, a gradient button on a gradient card.

## Do

- Stay in one hue family.
- Tie the gradient to meaning (a plan tier, a time of day).
- Keep everything on top flat and simple.

## Don't

- No indigo to violet as a default.
- No gradient text plus gradient buttons plus gradient cards.
- At most 1 vivid gradient reference per board unless the brief asks for it.

## Nearest neighbour: `dark-luminous` (Dark luminous)

Look at the area. Vivid gradient puts colour across most of the frame; dark luminous keeps the glow to one spot on black.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | "vivid gradient app ui", "mesh gradient app ui" |
| Web (apps and dashboards) | "gradient web app ui", "mesh gradient dashboard ui" |
| Web showcase | "gradient landing page" |
| Deck | "gradient presentation slide" |
| Brand | "gradient brand identity" |

Words in a brief or taste that name this style: "gradient", "gradients", "mesh gradient", "vivid gradient", "colorful gradient", "colourful gradient", "aurora".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `dark-luminous`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: The default AI look: an indigo to violet gradient, gradient text, a gradient button on a gradient card.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

Desert dusk over AlUla gives a warm one-family gradient; avoid the purple default.

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.
