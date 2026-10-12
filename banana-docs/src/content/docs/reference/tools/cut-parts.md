---
title: cut_parts
description: Frankenstein it, step 1. Cut parts (nav, hero, cards, footer and more) out of board images or search results into the board's parts library, as crop rectangles. Free.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All | None. Library holds 80 parts per board | Yes | |

A part is a role, a crop rectangle over a hotlinked image, a light or dark tag and a note. Nothing is downloaded or cut out of an image file; the browser shows the rectangle over the original.

## Inputs

| Name | Type | Required | Limits | What it does |
| --- | --- | --- | --- | --- |
| `canvasId` | string | Yes | 1 to 100 characters | The board |
| `cuts` | object[] | Yes | 1 to 24 per call | The parts to cut |
| `cuts[].itemId` | string | One of these two | up to 120 characters | A placed board image |
| `cuts[].referenceId` | string | One of these two | up to 100 characters | A search result in the tray |
| `cuts[].role` | enum | Yes | see below | What the part is on a page |
| `cuts[].crop` | object | No | `x`, `y` 0 to 1; `w`, `h` above 0 up to 1 | Fractions of the image, from the top left. Leave out and the server guesses a band by role |
| `cuts[].theme` | enum | No | `light`, `dark`, `unknown` | As seen |
| `cuts[].note` | string | No | 1 to 280 characters | What to take, starting with `steal:` |

**Roles.** Web and shared: `nav`, `hero`, `logos`, `features`, `cards`, `gallery`, `stats`, `testimonial`, `pricing`, `cta`, `form`, `faq`, `content`, `footer`. Web app: `sidebar`, `toolbar`, `table`, `chart`, `filters`. Mobile: `status-header`, `tabbar`, `list`, `detail`, `sheet`, `empty`. Anything else: `other`. Any role works on any platform.

**Guessed bands** when there is no `crop`: nav top 8% (4% on tall full page shots), hero the next 35% (15%), footer and tabbar the bottom 10%, status-header top 14%, sidebar left 18%, anything else the middle band. Guessed parts carry `guessedCrop: true`.

## Example call

```json
{
  "name": "cut_parts",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "cuts": [
      { "itemId": "it_42", "role": "nav", "crop": { "x": 0, "y": 0, "w": 1, "h": 0.035 }, "theme": "dark", "note": "steal: the split nav with the search pill in the middle" },
      { "itemId": "it_43", "role": "pricing", "crop": { "x": 0.05, "y": 0.42, "w": 0.9, "h": 0.2 }, "theme": "light", "note": "steal: the middle plan that breaks the grid" },
      { "referenceId": "ref_77aa", "role": "footer" }
    ]
  }
}
```

## Example output

```text
Cut 3 parts for Frankenstein pages (library: 11 of 80).
- pt-9f2c1a: nav from dribbble.com https://dribbble.com/shots/…, crop x 0% y 0% w 100% h 4%
- pt-1b7e44: pricing from lapa.ninja https://www.lapa.ninja/post/…, crop x 5% y 42% w 90% h 20%
- pt-c0de99: footer from landing.love https://landing.love/sites/…, crop x 0% y 90% w 100% h 10% (guessed, pass a crop to fix it)
Next: frankenstein_page with rows of part ids, or a recipe of roles.
```

## Messages

| Message | Fix |
| --- | --- |
| "The parts library holds up to 80 parts. It has 78, so cut at most 2 more. Nothing was cut." | Remove parts, or reuse them |
| "Some images have links the canvas cannot use. Nothing was cut." | Pick references from allowlisted sources |
| "cuts must be a list of 1 to 24 cuts…" | Each cut needs `itemId` or `referenceId` (one), and a `role` |

Guide: [Frankenstein it](/docs/guides/frankenstein/).
