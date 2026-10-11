---
title: arrange_canvas
description: "Tidy a canvas or one section."
---

Tidy a canvas or one section. Use it after adding items, or when you want a cleaner board.

**Title in clients:** Arrange canvas

## Parameters

<div class="gb-table">

| Parameter | Type | Required | What it does |
| --- | --- | --- | --- |
| `canvasId` | string | Yes | The canvas id. |
| `layout` | string | Yes | `by_direction` (one column per section), `masonry` (4 columns, keeps image shapes), `grid` (equal cells) or `hero` (first item large, the rest below). |
| `sectionId` | string | No | Arrange only this section. |

</div>

## Example

```json
{
  "canvasId": "<canvasId>",
  "layout": "masonry"
}
```

## What it returns

Each item with its new position and size, and the web link.

## Plan

Free.

## Related

- [Canvases and the dashboard](/docs/guides/canvases/)
- [All MCP tools](/docs/reference/tools/)
