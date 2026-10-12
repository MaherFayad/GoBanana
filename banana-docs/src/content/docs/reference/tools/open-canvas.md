---
title: open_canvas
description: Show a board inline in clients with MCP Apps and get its web link. Without a canvasId it creates a new board and shows it.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All | Without `canvasId`: counts toward the canvas limit | Only when it creates a board | |

`open_canvas` is linked to the MCP Apps resource `ui://banana/canvas`. Clients that support MCP Apps (Claude.ai, Claude Desktop) render the board in the chat. Every client gets the web link in the text.

## Inputs

| Name | Type | Required | Limits | What it does |
| --- | --- | --- | --- | --- |
| `canvasId` | string | No | 1 to 100 characters | The board to show. Leave out to create a new one |
| `title` | string | No | 1 to 80 characters | Title for a new board |
| `brief` | string | No | 1 to 500 characters | Brief for a new board |
| `taste` | string[] | No | 1 to 5 words | Style words for searches on this board |

## Example call

```json
{ "name": "open_canvas", "arguments": { "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f" } }
```

## Example output

```text
Opened canvas "Coffee launch page" (id c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f).
Web link: https://gobanana-server.maherfayad55.workers.dev/c/c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f
It has 31 items and 9 results in its tray.
```

`structuredContent.canvas` is small on purpose (`id`, `title`, `webUrl`, `brief`, `items`, `sections`, `tray` counts) because some hosts show it to the model. The full board goes to the view only, in the result's `_meta`.

## The inline view

- Pan, zoom, move, edit notes, use [keyboard shortcuts](/docs/reference/shortcuts/). Changes save to the same board as the web.
- It refreshes on its own while visible: about every 4 seconds with focus, 15 seconds without, never while hidden.
- **Upload** and **Share** are web only; uploads show as link cards inline.

## Messages

| Message | Fix |
| --- | --- |
| "canvasId must be an id from open_canvas." | Use an id from `get_canvas` |
| "That canvas was not found…" | Wrong id or another account |
| "You have used your 3 free canvases…" | Only when creating |
