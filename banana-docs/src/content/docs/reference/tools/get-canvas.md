---
title: get_canvas
description: Read a board - brief, directions with their spec, sections, items with source links and notes, palettes, the parts library and Frankenstein pages - or list your 10 most recent boards.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All | None | No | read only |

## Inputs

| Name | Type | Required | Limits | What it does |
| --- | --- | --- | --- | --- |
| `canvasId` | string | No | 1 to 100 characters | The board to read. Leave out to list your recent boards |

## List mode

```json
{ "name": "get_canvas", "arguments": {} }
```

```text
Recent canvases, newest first:
- c3f1a0d2-…: "Coffee launch page" (24 references, 3 directions, updated 2026-10-12) brief: launch page for a specialty coffee roaster
- 7be0…: "Frosted checkout" (31 references, 4 directions, updated 2026-10-09) brief: flight checkout screen for a GCC travel OTA
If the user's request continues one of these, pass its canvasId to bend_brief, search_references and add_to_canvas to add to it.
```

A new account gets "No canvases yet. Create one with new_canvas."

## Read mode

```json
{ "name": "get_canvas", "arguments": { "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f" } }
```

The text lists, in order:

1. Title, web link and brief.
2. **Directions**: id, title, search text, platform, pages, `kept`, `dropped` or `not rated`, and a compact spec (type, signature, pattern, layout, color, style words). The long build prompt is left out here; exports use it.
3. **Sections** with their items: `image it_…: Title (dribbble.com) https://… [art direction] [ship] note: steal: …`, notes and swatches.
4. Items not in a section.
5. Palettes.
6. **Parts library** by role, each part with its source, `(guessed crop)` when the server guessed, and its note.
7. **Frankenstein pages**: title, id, platform, view mode, remix origin, and a skeleton row by row (role, slot id, part id, source link, note).
8. How many search results wait in the tray.

The skills read a board once at the start and trust write results after that, instead of calling `get_canvas` after every change.

## Messages

| Message | Fix |
| --- | --- |
| "That canvas was not found…" | Wrong id or another account |
| "Pass a canvasId, or nothing to list recent canvases." | Bad input shape |
