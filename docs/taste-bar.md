# Taste bar

The quality GoBanana's references must reach. Set by the owner on 2026-10-15, with two of their own
Pinterest boards as the bar:

- Mobile: https://www.pinterest.com/maherfayad55/mobile/ (517 pins)
- Dashboard: https://www.pinterest.com/maherfayad55/dashboard/ (143 pins)

These boards are the owner's own, read by a person, not by the server. The server never scrapes
Pinterest (hard rule). Any automated reading of them needs the official Pinterest API with the
owner's own OAuth consent (see "Taste import" in docs/next-step-plan.md, VAL-03).

## What the bar looks like

Read from the first screen of both boards on 2026-10-15.

- **Shipped-grade craft, not concept shots.** Real product polish: tight type, real data, real
  states. Few pastel "travel app concept" comps, no flat stock illustrations, no UI kits.
- **One screen, shown well.** A single phone or window, often in a hand or on a photo or landscape
  backdrop (Spline style 3D, a laptop on a desk, a window over a mountain). Rarely 3 to 5 screens in
  a row on a purple gradient.
- **Dark first, restrained colour.** Near-black surfaces, monochrome with one accent (lime, orange,
  electric blue), luminous gradients and glow used as a single focal point.
- **Big numbers and editorial type.** Hero figures ("$63,000", "1054", "12,480"), serif or condensed
  display moments ("Pick your Plan"), small grey labels.
- **Glass and depth, done lightly.** Frosted panels, soft shadows, layered cards, widgets on a desktop.
- **Data that looks real.** Dashboards with dense, quiet tables, thin bar charts, status chips; no
  rainbow pie charts.
- **Texture as a second voice.** Halftone, dot grids, grain on a card ("BUDGET" card), not as a
  background wash.

## What fails the bar (seen in the 2026-10-15 Bench run)

- Generic Dribbble concept comps: three pastel phones, purple gradient, stock 3D people.
- Wrong page that matches a word ("picker" giving date and colour pickers).
- UI kits, button sheets and component dumps.
- Screens from category apps unrelated to the brief (prayer apps for a food offers page).

## How to use it

- **Bench:** a reference is **great** only if it could sit on these boards and is on the brief's
  page. On page but generic is **good**. Off page or below the bar is **bad**.
- **Agent rating (skills):** the same rule for `rate_references`.
- **Query recipes (P1-J7):** the judging prompt gets this file plus 20 to 40 exemplar pins the owner
  picks, and precision counts only results that pass the bar.

## Presentation (decks and slides)

Added 2026-10-16 for the `deck` lane (banana-server/lib/sources/genre.ts) and the picker's
Presentation tab. The same bar, read for slides. Measured on 65 candidates from Pitch's template
gallery and Serper finds on Dribbble, Behance and Pinterest, looked at in contact sheets.

- **A shipped deck, not a template sheet.** Real slides from a real pitch or report, shown one or
  two at a time. Not a 30-slide grid of a "PowerPoint template", not infographic packs, not
  mockup bundles with pastel 3D people.
- **One idea per slide.** One headline, one figure or one image. A cover that is a single word set
  huge ("KPI REPORT", "Moodboard") beats a busy agenda.
- **Big numbers carry the slide.** "$100b", "11,170", "50 / 24 / 26" in large display type, small
  grey labels, a thin line or bar chart at most. No rainbow pies, no icon rows.
- **Dark first, one accent.** Near-black or deep green and navy grounds with one orange, lime or red
  accent; a single photo or glow as the focal point.
- **Editorial type.** Condensed or serif display moments, a calm grid, generous margins; annual
  report spreads with pull quotes count when the type leads.
- **Fails the bar:** template sales sheets ("60+ slides, editable"), infographic kits, isometric
  stock illustration, every slide a different layout, decks that are app screenshots on gradients.

## Branding (identities, posters, packaging)

Added 2026-10-16 for the `brand` lane and the picker's Branding tab. Measured on 64 candidates from
The Brand Identity, BP&O, Mindsparkle, Brand New, Fonts In Use and Serper finds.

- **Shipped identity in use.** The mark on a real thing: a billboard, a bag, a bottle, a hoarding,
  a museum banner. Case study images from studios, not a logo floating on a mockup.
- **One strong idea.** One mark, one move ("a coin over the type", "type that bounces"), carried
  through. A lime roundel on black beats a page of twelve logo options.
- **Restraint in colour.** One ground and one accent (lime on black, cream on oxblood, red on red);
  dark grounds are welcome, not required.
- **Type leads.** Big, confident type: condensed, blackletter, bubble or a well cut serif. Posters
  where the words are the image.
- **Packaging as a family.** A small set in one palette, lit like a product shot, not a shelf of
  generic bottles.
- **Fails the bar:** logo service promos ("Custom Logo Design | 100+"), brand guideline templates,
  mockup packs, before and after sheets with nothing applied (Brand New's lead images are often
  these: fine as a source, rarely an exemplar), listicles ("Top 10 playful branding").

## Gulf and Arabic (the `gulf-arabic-first` style)

Added 2026-10-16 with the style round (docs/styles) and the picker's Gulf/Arabic tab (45
candidates, judged by eye in contact sheets).

- **Arabic leads.** Arabic display type set large and well, or a bilingual system where Arabic is
  not an afterthought; the layout mirrors right to left.
- **Real Gulf work.** Shipped identities (museums, festivals, cafes, banks), posters and type in
  use, sites and apps that ship in Arabic.
- **Craft with its grammar.** Sadu, Najdi, AlUla and other lenses used as a band, a mark or a
  material, credited, not as wallpaper.
- **Fails the bar:** mosque silhouettes, gold crescents and camels as decoration, pattern as
  wallpaper, fake or broken Arabic, Latin layouts with Arabic sprinkled on, Ramadan stock kits.
