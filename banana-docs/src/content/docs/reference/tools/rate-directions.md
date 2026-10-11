---
title: rate_directions
description: "Keep or drop bend_brief directions on a canvas after the agent judges them, so the board shows only usable ideas."
---

Keep or drop `bend_brief` directions on a canvas after the agent judges them, so the board shows only usable ideas. A dropped direction leaves the canvas with its section, the items in it and its tray results. Later bends suggest often dropped ideas less.

**Title in clients:** Rate directions

## Parameters

<div class="gb-table">

| Parameter | Type | Required | What it does |
| --- | --- | --- | --- |
| `canvasId` | string | Yes | Canvas the directions were saved to (`bend_brief` with `canvasId`). |
| `ratings` | list | Yes | 1 to 20 ratings. Each is `{ directionId, verdict, reasons? }`. `verdict` is `keep` or `drop`. `reasons` can list `no_ui_path`, `no_usable_refs`, `off_brief`, `duplicate_idea`, `too_literal`, `strong_salvage`, `great_refs`. |

</div>

## Example

```json
{
  "canvasId": "<canvasId>",
  "ratings": [
    {
      "directionId": "bd-3kq9x1ma",
      "verdict": "drop",
      "reasons": [
        "no_ui_path"
      ]
    }
  ]
}
```

## What it returns

What was kept and what was dropped.

## Plan

Free.

## Related

- [Bend a brief into directions](/docs/guides/bend/)
- [All MCP tools](/docs/reference/tools/)
