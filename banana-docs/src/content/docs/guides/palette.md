---
title: Palette and contrast
description: Pull colors from the art direction or the UI references, get roles, and see which pairs can ship under WCAG 2.2 and which stay concept only.
---

Say "palette from direction 2" or "do these colors pass contrast?". The `gobanana-palette` skill calls [`extract_palette`](/docs/reference/tools/extract-palette/) and puts the colors on the board as swatches.

## Where the colors come from

You pick the images, or the agent does:

1. the references you named or liked;
2. otherwise the items in the direction you mean. The **Art direction** row is a good source: it carries the idea's color (the weave, the riso inks). Mixing art and UI items from one direction is fine;
3. otherwise every reference on the board.

Up to 12 images per call. The palette has 5 to 9 colors (default 6).

## How it is computed

1. The server loads a small thumbnail of each image **in memory**, from an allowlisted image host.
2. A median cut quantizer finds the main colors. No AI.
3. The thumbnails are dropped as soon as the colors are computed. Nothing is saved.
4. Each color gets a role from its OKLCH lightness and chroma and how much of the images it covers: `primary`, `secondary`, `accent`, `neutral`, `surface`, `on-surface`.
5. Every color is checked against the surface, the on-surface color, white and black.

## Ship or explore

| Tag | Rule | Use it for |
| --- | --- | --- |
| `ship` | The pair reaches **4.5:1**, the WCAG 2.2 minimum for normal text (SC 1.4.3) | Text and anything that must be read on the wild page |
| `explore` | Under 4.5:1 | Mood, large decorative areas, concept work. Never body text |

Each pair also reports whether it reaches **3:1**, the minimum for UI parts such as icons, borders and focus rings (SC 1.4.11). A pair can be `explore` for text and still fine for an icon.

A wild palette is `explore` by default in spirit: it serves one page, not your product. Swatches on the board get `ship` when their color is part of at least one passing pair.

## A sample reply

The shape of the tool's answer, shortened, with example values:

```text
Palette of 6 colors:
- #f4f1ea oklch(95.6% 0.011 84.6) (surface)
- #1d2a5c oklch(29.5% 0.084 270.2) (on-surface)
- #2f5bd3 oklch(52.1% 0.18 264.1) (primary)
...
5 of 18 contrast pairs pass 4.5:1 for text (ship); the rest are explore only.
- #1d2a5c on #f4f1ea: 12.4:1
Added 6 swatches to the canvas.
```

The skill turns it into two tables (palette with roles, then contrast with a Text and a UI column) and suggests which way to move OKLCH lightness to rescue the best `explore` colors. Those suggestions need a re-check.

## Where the palette goes next

- **Hand-off files** say only `ship` colors carry text. See [Hand off](/docs/guides/handoff/).
- **Tokens and Tailwind theme** (Pro, `gobanana-asset-kit`): override tokens for the page, plus up to 4 safe gradients built only from `ship` pairs, so text stays readable across the whole gradient.
- **DESIGN.md** front matter takes `ship` colors only; `explore` colors stay in prose as "concept only".

## When images are skipped

`extract_palette` lists each skipped item with a reason:

| Reason | What to do |
| --- | --- |
| not an image item on this canvas | Pass image item ids from `get_canvas` |
| its image host is not on the allowlist | Pick a reference from another source |
| its format (for example WebP) is not supported yet | Pick another item |
| the image is too large / took too long to load | Pick another item, or retry |

If no image could be read, there is no palette, and the message says why for each item.
