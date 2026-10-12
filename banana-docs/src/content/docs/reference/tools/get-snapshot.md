---
title: get_snapshot
description: Let the agent see a board, a section or a Frankenstein page without a browser - small thumbnails with positions, or a page's parts in row order with their crop rects. A parts view, not a rendered image.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All | None | No | read only |

## Inputs

| Name | Type | Required | Limits | What it does |
| --- | --- | --- | --- | --- |
| `canvasId` | string | Yes | 1 to 100 characters | The board |
| `sectionId` | string | No | a section id from `get_canvas` | Show this section's references with their positions |
| `stitchId` | string | No | a Frankenstein page id from `get_canvas` | Show this page's parts, row by row |
| `thumbs` | boolean | No | default `true` | `false` returns the text lines only |

Pass a `sectionId` or a `stitchId`, not both. With neither, you get the board's sections, Frankenstein pages and first references.

## A Frankenstein page

```json
{ "name": "get_snapshot", "arguments": { "canvasId": "c3f1a0d2-…", "stitchId": "st_…" } }
```

The result is text lines with an image after each one:

```text
Frankenstein page "Checkout A" (st_…, mobile, collage), 2 rows top to bottom.
This is a parts view, not a rendered composite: each part below is its full source image, and its crop rect says which band of it the page uses.
Row 1: Nav (part pt-…) from dribbble.com https://dribbble.com/shots/… Crop x 0.00, y 0.00, w 1.00, h 0.12 (fractions of the image below; the page uses only this band)
[image]
Row 2: Hero (part pt-…) from behance.net https://www.behance.net/gallery/… Crop x 0.00, y 0.10, w 1.00, h 0.35 …. Note: steal: the big date
[image]
Build each row from what you see here; check your build against these images.
```

Builds placed next to the page with `add_to_canvas` (type `build`) are listed at the end with their links.

## How the thumbnails work

- The server fetches each image at its source's own small size (Pinterest `236x`, Dribbble `resize=400x300`, Behance `disp`) and hands the bytes to the agent in the result. They are never stored, cached, logged or served at any address.
- Only image hosts on the search allowlist are fetched. Mobbin screens, your uploads and build screenshots are named with their link but not fetched.
- Up to 12 images per call, about 3 seconds each, about 1.5 MB in total. An image over 300 KB with no small size is skipped, and the line says so.

## Messages

| Message | Fix |
| --- | --- |
| "That Frankenstein page was not found…" | Read the page ids with `get_canvas` |
| "That section was not found…" | Read the section ids with `get_canvas` |
| "Pass a sectionId or a stitchId, not both." | Pick one |
