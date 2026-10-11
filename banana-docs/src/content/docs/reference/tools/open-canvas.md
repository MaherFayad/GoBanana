---
title: open_canvas
description: "Show a canvas inline, or create and show one when you leave out canvasId, and get its web link."
---

Show a canvas inline, or create and show one when you leave out `canvasId`, and get its web link. Clients that support MCP Apps show the canvas in the chat. Every client gets the web link.

**Title in clients:** Open canvas

## Parameters

<div class="gb-table">

| Parameter | Type | Required | What it does |
| --- | --- | --- | --- |
| `canvasId` | string | No | Canvas to open. Leave out to create a new canvas. |
| `title` | string | No | Canvas title, up to 80 characters. |
| `brief` | string | No | The design brief, up to 500 characters. |
| `taste` | list | No | Up to 5 short style words, each up to 40 characters, for example `["glassmorphism", "big typography", "dark mode"]`. Saved on the canvas for later searches. |

</div>

## Example

```json
{
  "canvasId": "<canvasId>"
}
```

## What it returns

The canvas `id`, `title`, `webUrl` and `brief`, with counts of items, sections and tray results.

## Plan

Free to open. Creating a canvas counts toward your canvas limit: 3 on Free, unlimited on Pro.

## Related

- [Your first board](/docs/start/first-board/)
- [Canvases and the dashboard](/docs/guides/canvases/)
- [All MCP tools](/docs/reference/tools/)
