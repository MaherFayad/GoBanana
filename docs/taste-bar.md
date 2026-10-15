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
