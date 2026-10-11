---
title: search_references
description: "Find UI references (app screens, web pages, dashboards, components) on Dribbble, Pinterest, Behance and Awwwards."
---

Find UI references (app screens, web pages, dashboards, components) on Dribbble, Pinterest, Behance and Awwwards. Every result links to its source. Results are always UI, whatever the words. Pass a `directionId` from `bend_brief`, or a `query`. Pass `canvasId` to add the results to that canvas tray.

**Title in clients:** Search references

## Parameters

<div class="gb-table">

| Parameter | Type | Required | What it does |
| --- | --- | --- | --- |
| `directionId` | string | No | A direction id from `bend_brief`. Gives the best results. Pass this or `query`. |
| `query` | string | No | Search words, 1 to 300 characters. Pass this or `directionId`. |
| `sources` | list | No | 1 to 4 of `pinterest`, `dribbble`, `behance`, `awwwards`. Default: `pinterest` and `dribbble`. |
| `count` | integer | No | How many results, 4 to 24. Default 12. |
| `canvasId` | string | No | Adds the results to this canvas tray. |
| `taste` | list | No | Up to 5 short style words, each up to 40 characters, for example `["glassmorphism", "big typography", "dark mode"]`. Saved on the canvas for later searches. |
| `lane` | string | No | With `directionId` and `query`: search only this lane of the direction, with the query as its words. One of `fidelity`, `taste`, `component`, `hero`, `bridge`, `locale`. |
| `mix` | string | No | Ignored. Results are always UI. Kept so older calls still work. |

</div>

## Example

```json
{
  "directionId": "bd-3kq9x1ma",
  "canvasId": "<canvasId>",
  "count": 12
}
```

## What it returns

References, each with an `id`, `thumbUrl`, `imageUrl`, `sourceUrl`, `sourceSite`, `title`, `width` and `height`. Links only. No image is copied.

## Plan

Each call counts as one search toward your monthly limit: 30 on Free, 300 on Pro, 200 on Founding.

## Related

- [Find and rate references](/docs/guides/references/)
- [All MCP tools](/docs/reference/tools/)
