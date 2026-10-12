---
title: delete_canvas
description: Delete a board for good - sections, items, tray, directions and view link. Needs confirm true, and the user's explicit yes first.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All. On Free it frees a canvas slot | None | Yes, **cannot be undone** | destructive, idempotent |

:::danger[Ask first]
The tool's own description tells agents to ask you first, name the board, and call only after you say yes. The GoBanana skills never pick a board to delete on their own. Keep `delete_canvas` out of any "always allow" list.
:::

## Inputs

| Name | Type | Required | Limits | What it does |
| --- | --- | --- | --- | --- |
| `canvasId` | string | Yes | 1 to 100 characters | The board to delete |
| `confirm` | `true` | Yes | must be exactly `true` | Set only after the user said yes to deleting this board |

## What goes

Sections, items, the tray, directions, the parts library, Frankenstein pages and the share link. Images you uploaded to the board are deleted too, unless another of your boards shows them.

## Example call

```json
{ "name": "delete_canvas", "arguments": { "canvasId": "7be0c1aa-…", "confirm": true } }
```

## Example output

```text
Deleted canvas "Frosted checkout" for good.
```

```json title="structuredContent"
{ "deleted": true, "canvasId": "7be0c1aa-…", "title": "Frosted checkout", "uploadsDeleted": 0 }
```

## Messages

| Message | Meaning |
| --- | --- |
| "Nothing was deleted. Ask the user to confirm, then call again with confirm: true." | `confirm` missing or not `true` |
| "That canvas was not found. It may already be deleted; get_canvas lists your canvases." | Wrong id, or already gone |
| "Nothing was deleted: image storage is not available right now. Try again in a minute." | Uploads could not be removed, so nothing was |
