---
title: extract_palette
description: Pull a color palette from image items on a board, with roles and WCAG contrast checks. Optionally place the colors as swatches.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All | Swatches count as items | Saves the palette; swatches with `addSwatches` | |

Thumbnails are read **in memory** from allowlisted image hosts, the colors are computed with a median cut quantizer, and the images are dropped right away. Nothing is stored but the colors.

## Inputs

| Name | Type | Required | Limits and default | What it does |
| --- | --- | --- | --- | --- |
| `canvasId` | string | Yes | 1 to 100 characters | The board |
| `itemIds` | string[] | Yes | 1 to 12 | Image item ids from `get_canvas` or `add_to_canvas` |
| `size` | integer | No | 5 to 9, default 6 | Number of colors |
| `addSwatches` | boolean | No | default false | Place the colors on the board as swatches |

## Output

- `palette[]`: `hex`, `oklch`, `role` (`primary`, `secondary`, `accent`, `neutral`, `surface`, `on-surface`).
- `contrast[]`: every color against the surface, the on-surface color, white and black: `fg`, `bg`, `ratio`, `passesText` (4.5:1, SC 1.4.3), `passesUi` (3:1, SC 1.4.11), and `tag`: `ship` when it passes for text, else `explore`.
- `skipped[]`: items that could not be read, with a reason.
- `swatches[]`: placed swatches. A swatch is tagged `ship` when its color is in a passing pair. They go in the section all source images share, else below the board.

## Example call

```json
{
  "name": "extract_palette",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "itemIds": ["it_42", "it_43", "it_44"],
    "size": 6,
    "addSwatches": true
  }
}
```

## Example output

Shape of the answer, with example values:

```text
Palette of 6 colors:
- #f4f1ea oklch(95.6% 0.011 84.6) (surface)
- #1d2a5c oklch(29.5% 0.084 270.2) (on-surface)
…
5 of 18 contrast pairs pass 4.5:1 for text (ship); the rest are explore only.
- #1d2a5c on #f4f1ea: 12.4:1
Skipped it_44: its format (for example WebP) is not supported yet.
Added 6 swatches to the canvas.
Web link: https://gobanana-server.maherfayad55.workers.dev/c/c3f1a0d2-…
```

## Skip reasons

not an image item on this canvas · its image host is not on the allowlist · its image link is not valid · the image could not be loaded · the link did not return an image · the image is too large · the image took too long to load · the image link redirects too many times · its format (for example WebP) is not supported yet · the image could not be read.

If no image could be read: "No image could be read, so there is no palette." with the reason per item.

Guide: [Palette and contrast](/docs/guides/palette/).
