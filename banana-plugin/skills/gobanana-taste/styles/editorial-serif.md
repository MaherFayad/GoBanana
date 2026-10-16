---
name: style-editorial-serif
description: Editorial serif. A well cut serif and a calm grid, the way a magazine or annual report is set. Load when a direction, brief or board uses the editorial-serif style, to search, place, judge or build in it.
---

# Editorial serif (`editorial-serif`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `editorial-serif`.

## Definition

A well cut serif and a calm grid, the way a magazine or annual report is set.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- A serif display line ("Pick your Plan").
- Pull quotes and small caps labels.
- Generous margins on a visible grid.
- Muted paper or cream grounds.

Genres: Deck, Brand, Web showcase, Web (apps and dashboards), Mobile.

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** A serif with real contrast and optical spacing, a visible grid and one image.
- **Cheap:** Georgia or Times as the only serif, a serif heading on a gradient SaaS page.

## Do

- Pick a serif with real contrast and set it large with tight tracking.
- Use the grid visibly: columns, rules, folios.
- Pair it with one quiet sans for labels.

## Don't

- No Georgia as the accent serif (a J8 default).
- No serif heading dropped onto a gradient template.
- No justified text with rivers.

## Nearest neighbour: `minimal-mono-light` (Minimal mono light)

Look at the voice. Editorial has a serif as its voice; minimal mono light is sans or mono and almost silent. If the photo leads, it is photographic hero.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | "editorial serif app ui" |
| Web (apps and dashboards) | "editorial web app ui serif" |
| Web showcase | "editorial website serif typography" |
| Deck | "editorial presentation layout", "annual report presentation layout" |
| Brand | "editorial brand identity serif" |

Words in a brief or taste that name this style: "editorial", "serif", "magazine", "magazine style", "literary", "bookish".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `minimal-mono-light`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: Georgia or Times as the only serif, a serif heading on a gradient SaaS page.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

Naskh body with a calm Latin serif makes a strong bilingual editorial pair; mirror the grid for RTL.

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.
