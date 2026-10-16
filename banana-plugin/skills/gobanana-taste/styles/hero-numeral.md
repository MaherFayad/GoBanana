---
name: style-hero-numeral
description: Hero numeral. One huge figure carries the screen or slide, with small grey labels around it. Load when a direction, brief or board uses the hero-numeral style, to search, place, judge or build in it.
---

# Hero numeral (`hero-numeral`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `hero-numeral`.

## Definition

One huge figure carries the screen or slide, with small grey labels around it.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- A number at 5 to 10 times the label size ("$63,000", "13,143").
- A thin line or bar chart at most.
- Large empty space around the figure.
- One supporting label row.

Genres: Mobile, Web (apps and dashboards), Deck.

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** One real-feeling figure with its unit, one supporting label row, nothing else.
- **Cheap:** Four equal KPI cards, icons beside each number, a donut with a number in the middle.

## Do

- Use tabular figures and a real unit.
- Give the figure room: at least a third of the frame empty.
- Pair it with one thin chart at most.

## Don't

- No grid of equal KPI cards.
- No icon next to the number.
- No round numbers that look fake (1,000,000).

## Nearest neighbour: `big-type-display` (Big type display)

Look at the content. Hero numeral is a number with data meaning; big type is words. Many figures with one dominant is data dense dashboard.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | "big number app ui balance", "hero number finance app ui" |
| Web (apps and dashboards) | "big number dashboard ui" |
| Web showcase | not used |
| Deck | "big number slide presentation", "data slide big numbers" |
| Brand | not used |

Words in a brief or taste that name this style: "big number", "big numbers", "hero number", "hero numeral", "huge numbers", "numerals", "big figures", "large numbers".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `big-type-display`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: Four equal KPI cards, icons beside each number, a donut with a number in the middle.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

Eastern Arabic numerals set huge are a strong Gulf move; check digit shaping and direction.

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.
