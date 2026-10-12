---
title: new_canvas
description: Create a moodboard canvas without showing it, and get its canvasId. Fill it, then show it once, finished, with open_canvas.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All. Free owns at most 3 boards | Counts toward the canvas limit | Yes | not idempotent |

The skills use this instead of `open_canvas` so you never watch an empty board fill up. They call it only when none of your recent boards fits the request.

## Inputs

| Name | Type | Required | Limits | What it does |
| --- | --- | --- | --- | --- |
| `title` | string | No | 1 to 80 characters | Board title. Default: made from the brief, else "Untitled moodboard" |
| `brief` | string | No | 1 to 500 characters | The design brief, saved on the board |
| `taste` | string[] | No | 1 to 5 words, each up to 40 characters | Style words. Searches on this board use them |

## Example call

```json
{
  "name": "new_canvas",
  "arguments": {
    "title": "Coffee launch page",
    "brief": "launch page for a specialty coffee roaster",
    "taste": ["grainy", "big typography"]
  }
}
```

## Example output

```text
Created canvas "Coffee launch page" (id c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f). It is not shown yet.
Web link: https://gobanana-server.maherfayad55.workers.dev/c/c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f
Taste for searches: grainy, big typography.
Next: pass this canvasId to bend_brief and search_references, place results with add_to_canvas, then call open_canvas with this canvasId to show the finished board.
```

## Messages

| Message | Fix |
| --- | --- |
| "You have used your 3 free canvases. Upgrade for unlimited canvases: …" | Reuse a board, delete one, or upgrade |
| "title must be 1 to 80 characters." | Shorten |
| "taste must be 1 to 5 short style words, for example minimal or dark mode." | Fewer, shorter words |
