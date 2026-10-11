---
title: new_canvas
description: "Create a moodboard canvas without showing it, and get its canvasId."
---

Create a moodboard canvas without showing it, and get its `canvasId`. Pass the id to `bend_brief`, `search_references` and `add_to_canvas`, then call `open_canvas` with it to show the finished board.

**Title in clients:** New canvas

## Parameters

<div class="gb-table">

| Parameter | Type | Required | What it does |
| --- | --- | --- | --- |
| `title` | string | No | Canvas title, up to 80 characters. |
| `brief` | string | No | The design brief, up to 500 characters. |
| `taste` | list | No | Up to 5 short style words, each up to 40 characters, for example `["glassmorphism", "big typography", "dark mode"]`. Saved on the canvas for later searches. |

</div>

## Example

```json
{
  "title": "Calm checkout",
  "brief": "A calm flight checkout screen"
}
```

## What it returns

The new canvas id and its web link.

## Plan

Counts toward your canvas limit: 3 on Free, unlimited on Pro.

## Related

- [Your first board](/docs/start/first-board/)
- [Canvases and the dashboard](/docs/guides/canvases/)
- [All MCP tools](/docs/reference/tools/)
