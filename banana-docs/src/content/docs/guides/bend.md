---
title: Bend a brief into directions
description: How bend_brief turns a plain brief into wild directions, and how to steer it.
---

A bend takes a plain brief, like "flight checkout screen", and pushes it somewhere unexpected. The tool is [`bend_brief`](/docs/reference/tools/bend-brief/). It is free and has no monthly limit.

Bends come from rules and word lists, not from an AI model. Your own agent does the thinking on top.

## What a direction holds

| Part | What it is |
| --- | --- |
| Title | A short pitch, at most 10 words. |
| Twist | One short extra move, at most 8 words. Empty at wildness 1 and 2. |
| Search query | The idea in a few words. |
| Prompt | The full combined idea, for your agent to riff on. |
| Id | A stable id like `bd-3kq9x1ma`. Pass it to `search_references`. |

## Moves

Each direction is built from one or more moves.

| Move | What it does |
| --- | --- |
| `transplant` | Moves the screen into another object or industry. |
| `material` | Renders the UI in a physical material. |
| `era` | Moves it to another design period. |
| `constraint` | Removes a default, like no cards, one color or type only. |
| `scale` | Plays with size and density. |
| `lens` | Pulls from a visual tradition. |

Pass `moves` to limit which ones are used. Leave it out to use all six.

## Wildness

| Level | Label | What changes |
| --- | --- | --- |
| 1 | Fresh | Same layout, new flavour. |
| 2 | Bold | One strong move. |
| 3 | Weird | Two moves combined. The plugin's default. |
| 4 | Wild | Two or three moves. |
| 5 | Bananas | Three moves, usability ignored on purpose. |

## Culture lenses

Pass `lens` to pull every direction from one visual tradition.

| Id | Lens |
| --- | --- |
| `sadu` | Sadu weaving |
| `najdi` | Najdi architecture |
| `kufic` | Square Kufic geometry |
| `mashrabiya` | Mashrabiya |
| `desert-modern` | Desert modern |
| `memphis` | Memphis design |
| `swiss-international` | Swiss International Style |
| `japanese-ma` | Japanese ma |

## Count and taste

- `count` sets how many directions come back: 1 to 8, default 6.
- `taste` takes up to 5 short style words, like "glassmorphism" or "big typography". They describe the look you like. Searches on the canvas reuse them.

## Save directions on a canvas

Pass `canvasId` to save the directions on a canvas. Then [`search_references`](/docs/reference/tools/search-references/) can take a `directionId`, and results for a direction land in that direction's section.

## Keep or drop ideas

Not every idea can become UI for your screen. The agent rates each direction with [`rate_directions`](/docs/reference/tools/rate-directions/):

- `keep` for the ones you will see.
- `drop`, with reasons, for an idea with no UI path, too few usable references, off brief or a near duplicate.

A dropped direction leaves the canvas with its section, the items in it and its tray results. Later bends suggest often dropped ideas less. Ideas from your last 3 canvases come back only rarely, so new briefs stay fresh.
