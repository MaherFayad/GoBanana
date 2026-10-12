---
title: rate_references
description: Rate search results great or bad so later searches improve. Bad results leave the tray and never come back for you. Free.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All | None | Yes: your blocklist, the tray, learning signals | |

The server does not look at images. Your agent does, and this is how it teaches search.

- **`bad`**: the item goes on your personal blocklist (never shown to you again) and leaves that board's tray.
- **`great`**: kept as a signal for wordings and creators that work.
- Only results saved on your own boards can be rated, so always search with a `canvasId`.
- A wording that many people rate well can help everyone's searches, but only after at least 3 different users rated it. Nobody sees your ratings.

## Inputs

| Name | Type | Required | Limits | What it does |
| --- | --- | --- | --- | --- |
| `canvasId` | string | No | 1 to 100 characters | The board whose tray holds the results. Bad ones are removed from it |
| `ratings` | object[] | Yes | 1 to 50 | One per result |
| `ratings[].referenceId` | string | Yes | 1 to 100 characters | The id in brackets in the search output |
| `ratings[].verdict` | enum | Yes | `great`, `bad` | |
| `ratings[].reasons` | enum[] | No | see below | Why |

**Reasons for bad:** `off_topic`, `stock_or_shop`, `cluttered`, `duplicate`, `low_craft`, `wrong_style`, `not_ui` (UI zone only). **Reasons for great:** `great_craft`, `on_style`, `on_brief`.

Rate only the junk and the 1 to 3 standouts per search. There is no "ok" verdict; leave ordinary good results unrated.

## Example call

```json
{
  "name": "rate_references",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "ratings": [
      { "referenceId": "ref_3m7k", "verdict": "bad", "reasons": ["stock_or_shop"] },
      { "referenceId": "ref_9x1a", "verdict": "bad", "reasons": ["off_topic", "not_ui"] },
      { "referenceId": "ref_8k2p", "verdict": "great", "reasons": ["on_brief"] }
    ]
  }
}
```

## Example output

```text
Rated 3: 1 great, 2 bad.
Bad results will not come back in later searches. 2 removed from the tray.
Next:
- bridge lane: search_references with directionId, lane "bridge" and new query words
```

Each bad rating returns a short hint for re-searching its lane. The skill retries a lane only when more than 40% of it was bad, at most twice.

## Messages

| Message | Meaning |
| --- | --- |
| "No ratings saved: those results are not on your canvases. Search with a canvasId, then rate the results." | The search had no `canvasId`, so nothing was saved to rate |
| "Not found on your canvases: ref_…" | Some ids are unknown |
