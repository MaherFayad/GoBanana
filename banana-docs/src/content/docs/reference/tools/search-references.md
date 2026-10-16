---
title: search_references
description: Find design references for a bend direction or a query, in two zones - UI references and art direction - each with its source link. One call is one search.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All | **1 search per call** (Free 30 a month, Pro 300) | With `canvasId`: fills the tray, saves taste | open world |

Results are links and titles only. GoBanana never downloads or stores the images. A failed search does not count.

## Inputs

| Name | Type | Required | Limits and default | What it does |
| --- | --- | --- | --- | --- |
| `directionId` | string | One of these two | 1 to 100 characters | A direction from `bend_brief` saved on a canvas. Searches all its lanes |
| `query` | string | One of these two | 1 to 300 characters | Plain words. With `directionId` and `lane`: the new words for that lane |
| `canvasId` | string | No | 1 to 100 characters | Adds results to that board's tray, skips results already on it |
| `count` | integer | No | 4 to 24, default 12 | How many results |
| `zone` | enum | No | `ui`, `art`, `both` | Default `both` for a direction (about a third art, at least 3), `ui` for a query |
| `lane` | enum | No | `fidelity`, `taste`, `component`, `hero`, `bridge`, `locale`, `gallery`, `art` | With `directionId` and `query`: redo one lane |
| `taste` | string[] | No | 1 to 5 words | Style words, saved on the canvas |
| `sources` | enum[] | No | 1 to 4 source ids | Force sources. Leave out: the server picks galleries by platform and style. [Source ids](/docs/reference/sources/) |
| `mix` | enum | No | `ui`, `balanced`, `wild` | Ignored. Kept so older calls still work |
| `thumbs` | boolean | No | default `true` | A small thumbnail of each result (up to 12) after the text, each after the line that names it, so the agent rates and notes from the image, not the title. Fetched per call at the source's small size, never stored. See [get_snapshot](/docs/reference/tools/get-snapshot/) |

## Lanes

A direction search runs several lanes at once, each with its own wording:

| Lane | Zone | Searches for |
| --- | --- | --- |
| `fidelity` | UI | Real screens for the page on the platform |
| `taste` | UI | The style words on the page (yours, or the direction's) |
| `hero` | UI | Hero sections (websites) |
| `component` | UI | The components the brief and spec name (bottom sheet, pricing table...) |
| `bridge` | UI | The wild idea already applied to UI. Often empty |
| `locale` | UI | Arabic UI, when the brief is Arabic |
| `gallery` | UI | Curated UI galleries picked by platform and style |
| `art` | Art | The direction's `artQueries` as raw images on Pinterest, Behance and art galleries |

## What the server filters

- Only item pages on the chosen sites (one shot, pin, site or screen); list, tag and search pages are dropped.
- UI kits, templates and "for Adobe XD" or "Figma kit" titles are dropped.
- At most 2 results per studio or creator, newer work first on Dribbble and Behance.
- Wrong platform titles (web dashboards on a phone brief, phone screens on a web app brief).
- Art zone junk: shops, product listings, prices, fashion, Etsy or Amazon, logo sheets, stock, and music, band, tour or merch titles (unless the art query is about music).
- Look-alike traditions for a lens query (talli drops Egyptian tulle-bi-telli). The reply says in one line how many lens and music or merch results it dropped (`droppedWhy`), so the agent can rephrase.
- Anything you rated `bad` before, and anything already on the same board.
- Taken down links and domains.

Your agent still judges every result and rates the rest with [`rate_references`](/docs/reference/tools/rate-references/).

X post links in the results are never references (no image is kept): the reply lists up to 5 of them as `xPosts`, links only, and the agent can place one with `add_to_canvas` `{ "type": "xpost", "url" }`. See [X posts](/docs/reference/sources/#x-posts).

## Example call

```json
{
  "name": "search_references",
  "arguments": {
    "directionId": "bd-mob5pq35",
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "count": 12
  }
}
```

Redo one lane with better words:

```json
{
  "name": "search_references",
  "arguments": {
    "directionId": "bd-mob5pq35",
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "lane": "bridge",
    "query": "cereal box hero section website"
  }
}
```

## Example output

The shape, with example titles and ids:

```text
Found 8 UI references and 4 art direction references for "cereal box". Show each source link with its image.
UI references:
1. [ref_8k2..., fidelity] Coffee brand landing page (lapa.ninja, ui): https://www.lapa.ninja/post/...
2. [ref_9x1..., hero] Bold packaging hero (dribbble.com, ui): https://dribbble.com/shots/...
...
Art direction (place these in the art row, not with the UI references):
9. [ref_3m7..., art] Vintage cereal box back panel (pinterest.com, art): https://www.pinterest.com/pin/...
...
Added to the tray of canvas c3f1a0d2-....
Rate standouts and misses with rate_references (ids in brackets).
```

`structuredContent` carries `references[]` (each with `id`, `title`, `sourceUrl`, `sourceSite`, `imageUrl`, `thumbUrl`, `zone`, `lane`), `zones` (counts), `queries`, `lanes`, `sources`, `dropped`, `droppedWhy` (`lens`, `offTopic` and art `junk` counts, when above 0) and `addedToTray`.

## Messages

| Message | Fix |
| --- | --- |
| "You have used your 30 free searches this month. Upgrade: …" | See [Plans](/docs/reference/plans/) |
| "Pass a directionId from bend_brief or a query." | Give one of them |
| "That direction was not found. Directions are saved only when bend_brief gets a canvasId…" | Bend with `canvasId`, or search by `query` |
| "To redo one lane, pass directionId, lane and query (the new words for that lane)." | Add the missing field |
| "That direction has no hero lane. Its lanes: fidelity, taste, …" | Pick a listed lane |
| "Search failed. Try again in a minute." | Retry once. Not counted |

Related: [Sources](/docs/reference/sources/), [FAQ: few results](/docs/faq/#why-did-search-find-so-few-results).
