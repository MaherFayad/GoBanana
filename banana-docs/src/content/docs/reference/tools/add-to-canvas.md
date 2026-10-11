---
title: add_to_canvas
description: "Place items on a canvas: references from search_references (by referenceId), notes, color swatches and sections."
---

Place items on a canvas: references from `search_references` (by `referenceId`), notes, color swatches and sections. New items go below what is already there. References found for a saved direction go to that direction's section.

**Title in clients:** Add to canvas

## Parameters

<div class="gb-table">

| Parameter | Type | Required | What it does |
| --- | --- | --- | --- |
| `canvasId` | string | Yes | The canvas id. |
| `items` | list | Yes | 1 to 50 items. Each is one of: `{ type: "reference", referenceId }`, `{ type: "note", text }` (up to 2000 characters), `{ type: "swatch", hex, role? }` (hex like `#ffd84d`, role up to 60 characters) or `{ type: "section", title, directionId? }` (title up to 120 characters). |
| `sectionId` | string | No | Section to place the items in. |

</div>

## Example

```json
{
  "canvasId": "<canvasId>",
  "items": [
    {
      "type": "reference",
      "referenceId": "<referenceId>"
    },
    {
      "type": "note",
      "text": "Keep the stripes for progress only"
    }
  ]
}
```

## What it returns

Each new item with its `id`, `type`, position and section, plus any skipped items with a reason, and the web link.

## Plan

Items per canvas: 40 on Free, 300 on Pro.

## Related

- [Canvases and the dashboard](/docs/guides/canvases/)
- [All MCP tools](/docs/reference/tools/)
