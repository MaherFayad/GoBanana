---
title: update_frankenstein
description: Change one Frankenstein page with a list of ops - swap, move, moveRow, remove, insert, crop, widths, mode, note, title - applied in order, all or nothing.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All | None | Yes | all or nothing |

## Inputs

| Name | Type | Required | Limits | What it does |
| --- | --- | --- | --- | --- |
| `canvasId` | string | Yes | 1 to 100 characters | The board |
| `stitchId` | string | Yes | up to 120 characters | The Frankenstein page (`st-…`) |
| `ops` | object[] | Yes | 1 to 30 | Applied in order. If one fails, none apply |

## Ops

| `op` | Fields | Does |
| --- | --- | --- |
| `swap` | `slotId`, `partId` | Put another part in a slot |
| `move` | `slotId`, `index`, `rowId?` | Move a slot within its row, or to another row |
| `moveRow` | `rowId`, `index` | Move a whole row (0 is the top) |
| `remove` | `slotId` or `rowId` | Remove a slot or a row |
| `insert` | `slots` (1 to 3: `partId`, `role?`, `crop?`, `note?`), `index?` or `afterRowId?`, `widths?` | Add a new row. Default at the end |
| `crop` | `slotId`, `crop` `{x, y, w, h}` | Recrop a slot without a new part |
| `widths` | `rowId`, `widths` (1 to 3 numbers, each up to 12) | Relative slot widths |
| `mode` | `mode`: `collage`, `wireframe`, `harmonize` (`even` still works for one release) | Switch the view |
| `note` | `note` (up to 280), `slotId?` | With `slotId`: the slot's steal note. Without: the page's one line idea. Empty clears it |
| `title` | `title` (1 to 120) | Rename the page |

Slot and row ids (`sl-…`, `rw-…`) come from `frankenstein_page` or `get_canvas`.

## Example call

```json
{
  "name": "update_frankenstein",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "stitchId": "st-4a1b",
    "ops": [
      { "op": "swap", "slotId": "sl-3", "partId": "pt-1b7e44" },
      { "op": "widths", "rowId": "rw-5", "widths": [1, 2] },
      { "op": "note", "note": "Editorial nav over a dashboard hero" },
      { "op": "mode", "mode": "wireframe" }
    ]
  }
}
```

## Example output

```text
Applied 4 changes to Frankenstein page st-4a1b:
- Landing 1 (st-4a1b, website, wireframe): Editorial nav over a dashboard hero
  1. row rw-1: Nav (slot sl-1, part pt-9f2c1a) from lapa.ninja https://…
  …
Show each slot's source link next to it. Take the structure, not the pixels.
Web link: https://gobanana-server.maherfayad55.workers.dev/c/c3f1a0d2-…
```
