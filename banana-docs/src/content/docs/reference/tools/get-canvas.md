---
title: get_canvas
description: "Read a canvas: its brief, directions, sections, items with their source links and notes, swatches and palettes."
---

Read a canvas: its brief, directions, sections, items with their source links and notes, swatches and palettes. Leave out `canvasId` to list your recent canvases, so the agent can add to one instead of creating another.

**Title in clients:** Get canvas

## Parameters

<div class="gb-table">

| Parameter | Type | Required | What it does |
| --- | --- | --- | --- |
| `canvasId` | string | No | Canvas to read. Leave out to list your 10 most recent canvases. |

</div>

## Example

```json
{
  "canvasId": "<canvasId>"
}
```

## What it returns

The canvas and its tray, or a list of recent canvases, newest first.

## Plan

Free. Read only.

## Related

- [Canvases and the dashboard](/docs/guides/canvases/)
- [All MCP tools](/docs/reference/tools/)
