---
title: Palette and contrast checks
description: Pull a color palette from your references and see which pairs pass WCAG 2.2 contrast.
---

[`extract_palette`](/docs/reference/tools/extract-palette/) pulls colors from image items on a canvas. It is free.

Say "make a palette from these" and the `gobanana-palette` skill runs it for you.

## What you get

- **Colors.** 5 to 9 colors, 6 by default. Each has a hex value, an OKLCH value and a role.
- **Contrast pairs.** Each pair of colors gets a contrast ratio and a tag.

| Tag | Meaning |
| --- | --- |
| `ship` | Passes 4.5:1 for text (WCAG 2.2, SC 1.4.3). Safe for production. |
| `explore` | Does not pass. Use it for concepts only. |

Pass `addSwatches` to put the colors on the canvas as swatches.

## Which images it reads

Pass 1 to 12 image item ids from the canvas. The server reads each thumbnail in memory, computes the colors, then drops it. Nothing is written to disk or kept.

An item is skipped, with a plain reason, when:

- it is not an image item on this canvas,
- its image host is not on the allowlist,
- the image could not be loaded, took too long or is too large,
- its format, for example WebP, is not supported yet.

## In your exports

Only `ship` colors go into the DESIGN.md front matter. `explore` colors are listed in the prose as concept only. The AGENTS.md export tells coding agents the same rule. See [Export a kit](/docs/guides/export/).
