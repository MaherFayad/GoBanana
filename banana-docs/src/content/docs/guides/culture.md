---
title: Culture and heritage
description: How GoBanana uses a tradition with its meaning, credit and care tier, shows a Culture chip on the board, and starts the hand-off with a Cultural brief.
---

When a brief names a culture, a craft or a region ("make it feel Saudi", "use sadu"), the `gobanana-culture` skill treats the tradition as something with an owner and a meaning, not as a style word. It takes the grammar (rhythm, proportion, color ratios, how it is made) and never copies a specific artwork.

## What goes on the board

Every cultural item the agent places carries a `culture` object, next to its note:

| Field | What it holds |
| --- | --- |
| `tradition` | The exact name, for example Sadu weaving |
| `region` | Where it comes from, as precisely as the source says |
| `community` | The people who keep it (optional) |
| `tier` | `open`, `care` or `sacred` |
| `meaning` | What it is and what it stands for, in plain words |
| `credit` | Who to credit |
| `sourceUrl` | A museum, UNESCO or national institution page (optional) |

It is plain text, stored with the item on your board. Nothing else is saved and no migration is needed.

## The Culture chip

A tile or note with culture data shows a small **Culture** chip. Click it, or tab to it and press Enter or Space, to open the tradition, region, care tier, meaning, credit and source link. Escape closes it and puts focus back on the chip. It works on the web and in the inline canvas, and it reads in Arabic when the page language is Arabic.

## The three tiers

| Tier | Meaning | What GoBanana does |
| --- | --- | --- |
| Open | A style or movement anyone may draw from | Credits the source and takes the grammar |
| Care | A living tradition of a community | Credits its people, avoids copying the artifact, and suggests a reviewer from the community before you ship |
| Sacred | Holy text or symbols | Never used as decoration. The agent says no in one line and offers an alternative |

## Lenses

The lenses `sadu`, `talli`, `qatt-asiri` and the others now carry a tier, a meaning, UI mappings (rows of element, grammar and the UI part it becomes), a list of things never to use as decoration, a reviewer hint and sources. `bend_brief` returns them with the lens, and they apply to every direction. A source is listed only when it was opened and checked; a lens with no verified page lists none.

## In the hand-off

- `DIRECTION.md` starts with a **Cultural brief** whenever an item carries `culture` or the board has a lens: tradition, tier, what we use, what we avoid, credit, sources and a suggested reviewer.
- `export_kit` with `culture_md` writes `design/explorations/<slug>/CULTURE.md` (Free): the brief, each cultural item with its meaning and credit, and three questions for the reviewer. Is the meaning right? Is anything used in a way that would offend? Is the credit right?

## What it will not do

It will not use Quran verses or other sacred text as a pattern, flags or emblems as decoration, fake Arabic-looking letters, or camel and dune clichés. It offers a better route, for example a square Kufic grid built from words you choose.

Related: [Export formats](/docs/reference/exports/), [`add_to_canvas`](/docs/reference/tools/add-to-canvas/), [Skills](/docs/reference/skills/).
