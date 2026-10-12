---
title: frankenstein_page
description: Frankenstein it, step 2. Stack parts from the library into new pages, top to bottom, in a frame sized for the platform. From explicit rows, or from a recipe with up to 6 variants.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All | Each frame counts as one board item | Yes | |

Frames go side by side in a **Frankenstein pages** section on the board, created when missing. In tool output a Frankenstein page is called a stitch (`stitchId`, `st-…`).

## Inputs

| Name | Type | Required | Limits and default | What it does |
| --- | --- | --- | --- | --- |
| `canvasId` | string | Yes | 1 to 100 characters | The board |
| `recipe` | enum[] | One of these two | 1 to 14 roles | Roles top to bottom, filled from the library |
| `rows` | object[] | One of these two | 1 to 14 rows | Explicit rows of parts |
| `rows[].slots` | object[] | Yes | 1 to 3 | `{ partId, crop?, note? }`. `note` up to 280 characters |
| `rows[].widths` | number[] | No | one per slot, 2 to 3 values, each above 0 up to 12 | Relative widths, like `[1, 3]` for a sidebar. Default equal |
| `variants` | integer | No | 1 to 6 | With a recipe: how many pages. Each mixes at least 3 sources when the library allows |
| `platform` | enum | No | `mobile` (390px), `tablet` (834px), `website`, `webapp` (1440px) | Frame width. Default: the direction's platform, else website |
| `mode` | enum | No | `collage` (default), `wireframe`, `even` | The view |
| `title` | string | No | up to 120 characters | Page title |
| `note` | string | No | up to 280 characters | The idea in one line |
| `directionId` | string | No | 1 to 100 characters | The kept direction this page serves |

## Example call: recipe

```json
{
  "name": "frankenstein_page",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "platform": "website",
    "title": "Landing",
    "mode": "collage",
    "recipe": ["nav", "hero", "logos", "features", "cards", "testimonial", "cta", "footer"],
    "variants": 3
  }
}
```

## Example call: dictated rows

```json
{
  "name": "frankenstein_page",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "platform": "webapp",
    "title": "Dashboard home",
    "rows": [
      { "slots": [{ "partId": "pt-a1" }, { "partId": "pt-b2" }], "widths": [1, 4] },
      { "slots": [{ "partId": "pt-c3", "note": "steal: KPI cards with sparklines" }] }
    ]
  }
}
```

## Example output

```text
Made 3 Frankenstein pages in the "Frankenstein pages" section (sec_fk):
- Landing 1 (st-4a1b, website, collage)
  1. row rw-1: Nav (slot sl-1, part pt-9f2c1a) from "Dev tool landing page" on lapa.ninja https://… note: steal: the split nav…
  2. row rw-2: Hero (slot sl-2, part pt-77ab) from landing.love https://…
  …
Show each slot's source link next to it. Take the structure, not the pixels.
Change one with update_frankenstein, or make variants with remix_frankenstein.
Web link: https://gobanana-server.maherfayad55.workers.dev/c/c3f1a0d2-…
```

## Messages

| Message | Fix |
| --- | --- |
| "The parts library is empty. Cut parts from board images or search results with cut_parts first." | Run [`cut_parts`](/docs/reference/tools/cut-parts/) |
| "recipe is a list of 1 to 14 roles from: …" | Use listed roles |
| "This canvas has reached the 40 item limit on the free plan…" | Free up items |

Next: [`update_frankenstein`](/docs/reference/tools/update-frankenstein/), [`remix_frankenstein`](/docs/reference/tools/remix-frankenstein/).
