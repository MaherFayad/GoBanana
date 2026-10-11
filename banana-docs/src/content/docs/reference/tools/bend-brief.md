---
title: bend_brief
description: "Turn a plain design brief into wild, unexpected design directions."
---

Turn a plain design brief into wild, unexpected design directions. Each direction has a short title, a twist, a search query and a prompt to riff on. Pass `canvasId` to save the directions there, then call `search_references` with a direction id.

**Title in clients:** Bend a design brief

## Parameters

<div class="gb-table">

| Parameter | Type | Required | What it does |
| --- | --- | --- | --- |
| `brief` | string | Yes | What is being designed, in a few words, 1 to 500 characters. Example: "flight checkout screen". |
| `wildness` | integer | Yes | 1 Fresh, 2 Bold, 3 Weird, 4 Wild, 5 Bananas. Higher combines more moves. |
| `moves` | list | No | Limit which moves are used: `transplant`, `material`, `era`, `constraint`, `scale`, `lens`. Leave out to use all six. |
| `lens` | string | No | Culture lens preset: `sadu`, `najdi`, `kufic`, `mashrabiya`, `desert-modern`, `memphis`, `swiss-international` or `japanese-ma`. Every direction then pulls from that tradition. |
| `count` | integer | No | How many directions to return, 1 to 8. Default 6. |
| `canvasId` | string | No | Canvas from `open_canvas` or `new_canvas`. Saves the directions there so `search_references` can take a `directionId`. |
| `taste` | list | No | Up to 5 short style words, each up to 40 characters, for example `["glassmorphism", "big typography", "dark mode"]`. Saved on the canvas for later searches. |

</div>

## Example

```json
{
  "brief": "flight checkout screen",
  "wildness": 4,
  "count": 6
}
```

## What it returns

A list of directions. Each has an `id` (like `bd-3kq9x1ma`), the moves, a `title`, a `twist`, a `searchQuery` and a `prompt`.

## Plan

Free, no monthly limit.

## Related

- [Bend a brief into directions](/docs/guides/bend/)
- [All MCP tools](/docs/reference/tools/)
