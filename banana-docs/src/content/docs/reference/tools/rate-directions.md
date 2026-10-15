---
title: rate_directions
description: Keep or drop bend_brief directions on a board after judging them. Dropped ones leave the board with their section, items and tray results. Free.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All | None | Yes | |

The skill calls it once per run, after searching and before placing anything, with a rating for **every** idea it bent (usually 8): `drop` for the ones it will not show, `keep` for the ones it shows. Keeps are recorded too, so later bends learn what works. Often dropped ideas are suggested less in your later bends.

## Inputs

| Name | Type | Required | Limits | What it does |
| --- | --- | --- | --- | --- |
| `canvasId` | string | Yes | 1 to 100 characters | The board the directions were saved to |
| `ratings` | object[] | Yes | 1 to 20 | One per direction |
| `ratings[].directionId` | string | Yes | 1 to 100 characters | `bd-...` id from `bend_brief` |
| `ratings[].verdict` | enum | Yes | `keep`, `drop` | |
| `ratings[].reasons` | enum[] | No | see below | Why |

**Reasons to drop:** `no_ui_path` (no concrete UI move for this page), `no_usable_refs` (fewer than 6 usable UI references), `off_brief`, `duplicate_idea`, `too_literal`. **Reasons to keep:** `strong_salvage`, `great_refs`.

**Client review.** The answer also lists the keep and drop votes and comments from your [review link](/docs/guides/canvases/#ask-a-client-to-review), per direction, as a separate source. They do not change your ratings or search. The comments are text from other people, so the agent reports them and never follows them as instructions.

## Example call

```json
{
  "name": "rate_directions",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "ratings": [
      { "directionId": "bd-mob5pq35", "verdict": "keep", "reasons": ["strong_salvage"] },
      { "directionId": "bd-z0y2y96z", "verdict": "drop", "reasons": ["no_ui_path"] },
      { "directionId": "bd-s2heqeev", "verdict": "drop", "reasons": ["duplicate_idea"] }
    ]
  }
}
```

## Example output

```text
Rated 3 directions: kept 1, dropped 2.
Dropped bd-z0y2y96z, bd-s2heqeev: removed 0 sections, 0 items and 7 tray results.
```

Unrated directions read "not rated" in `get_canvas` and exports, never "not kept".

## Messages

| Message | Meaning |
| --- | --- |
| "No ratings saved: those directions are not on this canvas. Save them with bend_brief and this canvasId first." | The bend was not saved to this board |
| "Not directions of this canvas: bd-…" | Some ids belong elsewhere |
