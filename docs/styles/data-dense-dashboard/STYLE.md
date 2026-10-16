---
name: style-data-dense-dashboard
description: Data dense dashboard. Many real numbers, tables and thin charts in one calm grid, with one figure that wins. Load when a direction, brief or board uses the data-dense-dashboard style, to search, place, judge or build in it.
---

# Data dense dashboard (`data-dense-dashboard`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `data-dense-dashboard`.

## Definition

Many real numbers, tables and thin charts in one calm grid, with one figure that wins.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- 4 or more widgets in view.
- Thin bar and line charts, small multiples.
- Status chips and a table set in small type.
- One hero metric among the small ones.

Genres: Web (apps and dashboards), Mobile, Deck.

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** Real, believable data, a quiet palette, aligned columns and one number that wins.
- **Cheap:** Rainbow pies, every card a different chart type, lorem numbers, icon rows, four equal KPI cards.

## Do

- Use one chart colour plus grey, and one highlight.
- Align numbers on tabular figures.
- Give the hero metric 2 to 3 times the size of the rest.

## Don't

- No pie or donut unless the brief is about shares.
- No decorative icons beside every number.
- No fake precision (12 decimals) or lorem data.

## Nearest neighbour: `hero-numeral` (Hero numeral)

Count the figures. Data dense has many figures with one dominant; hero numeral has one figure and little else.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | "stats screen app ui charts", "finance app ui data dense" |
| Web (apps and dashboards) | "analytics dashboard ui dense table", "saas dashboard ui thin charts" |
| Web showcase | not used |
| Deck | "data slide presentation chart" |
| Brand | not used |

Words in a brief or taste that name this style: "data dense", "dense dashboard", "data heavy", "information dense", "dense data", "data rich".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `hero-numeral`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: Rainbow pies, every card a different chart type, lorem numbers, icon rows, four equal KPI cards.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

Sadu's banded rows suit table striping; keep pattern out of the charts.

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.
