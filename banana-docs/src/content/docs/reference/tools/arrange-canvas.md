---
title: arrange_canvas
description: Tidy a board or one section with one of four layouts. Same result as the canvas toolbar.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All | None | Yes, positions only | idempotent |

## Inputs

| Name | Type | Required | Limits | What it does |
| --- | --- | --- | --- | --- |
| `canvasId` | string | Yes | 1 to 100 characters | The board |
| `layout` | enum | Yes | `by_direction`, `masonry`, `grid`, `hero` | The layout |
| `sectionId` | string | No | 1 to 120 characters | Arrange only this section |

| Layout | What it does |
| --- | --- |
| `by_direction` | One column per section. Art row stays above the UI grid. The default for boards with several directions |
| `masonry` | 4 columns that keep image shapes |
| `grid` | Equal cells |
| `hero` | The first item large, the rest below |

## Example call

```json
{ "name": "arrange_canvas", "arguments": { "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f", "layout": "by_direction" } }
```

## Example output

```text
Arranged 31 items in "Coffee launch page" with the by_direction layout.
Web link: https://gobanana-server.maherfayad55.workers.dev/c/c3f1a0d2-…
```

The skills call it once, after the last `add_to_canvas`, and do not read the board in between.

## Messages

| Message | Fix |
| --- | --- |
| "layout must be one of: by_direction, masonry, grid, hero." | Pick a listed layout |
| "That section was not found on this canvas…" | Use a current `sectionId` |
