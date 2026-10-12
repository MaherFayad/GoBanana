---
title: remix_frankenstein
description: Make variants of a Frankenstein page with other parts in its slots, placed right of the original. Lock what you love, vary the rest. Same call, same result.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All | Each new frame counts as one board item | Yes | seeded |

## Inputs

| Name | Type | Required | Limits | What it does |
| --- | --- | --- | --- | --- |
| `canvasId` | string | Yes | 1 to 100 characters | The board |
| `stitchId` | string | Yes | up to 120 characters | The Frankenstein page to remix (`st-…`) |
| `count` | integer | Yes | 1 to 6 | How many variants |
| `lock` | string[] | No | up to 42 slot ids or roles | Keep these as they are, for example `["nav", "hero"]` |
| `vary` | enum[] | No | 1 to 26 roles | When set, only these roles change |

New frames are titled "<original>, remix 1", "…, remix 2" and remember which page they came from.

## Example call

```json
{
  "name": "remix_frankenstein",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "stitchId": "st-4a1b",
    "count": 3,
    "lock": ["nav", "hero"]
  }
}
```

## Example output

```text
Made 3 variants of Frankenstein page st-4a1b:
- Landing 1, remix 1 (st-9c0d, website, collage)
  1. row rw-1: Nav (slot sl-1, part pt-9f2c1a) from lapa.ninja https://…
  …
Show each slot's source link next to it. Take the structure, not the pixels.
Web link: https://gobanana-server.maherfayad55.workers.dev/c/c3f1a0d2-…
```

The skill presents each new take with locked slots marked "(kept)" and one line on what changed.
