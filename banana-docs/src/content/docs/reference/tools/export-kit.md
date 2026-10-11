---
title: export_kit
description: "Export a canvas as files for your project."
---

Export a canvas as files for your project. Returns each file as text. Your agent writes them where you want.

**Title in clients:** Export kit

## Parameters

<div class="gb-table">

| Parameter | Type | Required | What it does |
| --- | --- | --- | --- |
| `canvasId` | string | Yes | The canvas id. |
| `formats` | list | Yes | One or more of `design_md` (DESIGN.md), `agents_md` (AGENTS.md), `tokens` (tokens.json), `tailwind` (theme.css), `figjam_spec` (figjam-spec.json), `html_board` (board.html), `brief` (BRIEF.md). |

</div>

## Example

```json
{
  "canvasId": "<canvasId>",
  "formats": [
    "design_md",
    "agents_md",
    "tokens"
  ]
}
```

## What it returns

Files, each with a `name`, `mime` and `content`. Formats your plan does not include are listed in `blocked`, with a short note.

## Plan

Free: `design_md` and `brief`. Pro: every format.

## Related

- [Export a kit](/docs/guides/export/)
- [All MCP tools](/docs/reference/tools/)
