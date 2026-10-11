---
title: extract_palette
description: "Pull a color palette from image items on a canvas, with WCAG contrast checks."
---

Pull a color palette from image items on a canvas, with WCAG contrast checks. Pairs tagged `ship` pass 4.5:1 for text. `explore` pairs are for concepts only. Thumbnails are read in memory and dropped.

**Title in clients:** Extract palette

## Parameters

<div class="gb-table">

| Parameter | Type | Required | What it does |
| --- | --- | --- | --- |
| `canvasId` | string | Yes | The canvas id. |
| `itemIds` | list | Yes | 1 to 12 image item ids from `get_canvas` or `add_to_canvas`. |
| `size` | integer | No | Number of colors, 5 to 9. Default 6. |
| `addSwatches` | boolean | No | Also place the colors on the canvas as swatches. |

</div>

## Example

```json
{
  "canvasId": "<canvasId>",
  "itemIds": [
    "<itemId>",
    "<itemId>"
  ],
  "size": 6,
  "addSwatches": true
}
```

## What it returns

The `palette` (hex, OKLCH and role per color), the `contrast` pairs with ratio and tag, any skipped items with a reason, and new swatches when `addSwatches` is on.

## Plan

Free.

## Related

- [Palette and contrast checks](/docs/guides/palette/)
- [All MCP tools](/docs/reference/tools/)
