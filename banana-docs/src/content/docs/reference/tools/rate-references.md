---
title: rate_references
description: "Rate search results so later searches get better."
---

Rate search results so later searches get better. Bad results leave the canvas tray and never come back in your searches. Each bad rating returns a hint for searching that lane again.

**Title in clients:** Rate references

## Parameters

<div class="gb-table">

| Parameter | Type | Required | What it does |
| --- | --- | --- | --- |
| `canvasId` | string | No | Canvas whose tray holds the results. Bad ones are removed from it. |
| `ratings` | list | Yes | 1 to 50 ratings. Each is `{ referenceId, verdict, reasons? }`. `verdict` is `great` or `bad`. `reasons` can list `off_topic`, `low_craft`, `stock_or_shop`, `cluttered`, `duplicate`, `wrong_style`, `not_ui`, `great_craft`, `on_style`, `on_brief`. |

</div>

## Example

```json
{
  "canvasId": "<canvasId>",
  "ratings": [
    {
      "referenceId": "<referenceId>",
      "verdict": "bad",
      "reasons": [
        "stock_or_shop"
      ]
    }
  ]
}
```

## What it returns

What was recorded, and a re-search hint for each bad rating.

## Plan

Free.

## Related

- [Find and rate references](/docs/guides/references/)
- [All MCP tools](/docs/reference/tools/)
