---
title: Find and rate references
description: Search Pinterest, Dribbble, Behance and Awwwards for UI references, then rate them so later searches get better.
---

[`search_references`](/docs/reference/tools/search-references/) finds UI references: app screens, web pages, dashboards and components. Every result links to its source page.

## Where results come from

| Source | Site |
| --- | --- |
| `pinterest` | pinterest.com |
| `dribbble` | dribbble.com |
| `behance` | behance.net |
| `awwwards` | awwwards.com |

Pinterest and Dribbble are searched when you pick no sources. Results come from web search only. GoBanana never scrapes these sites, and it never copies the images.

## Results are always UI

Results are UI, whatever the words. The wild idea of a direction belongs in its notes, not in the images. A search for "vending machine checkout" looks for checkout screens that borrow from vending machines, not photos of vending machines.

## Search by direction or by words

- **By direction.** Pass a `directionId` from `bend_brief`. GoBanana searches a few lanes for it, such as real screens for your domain, your taste, and components. This gives the best results.
- **By words.** Pass a `query` of up to 300 characters.
- **Redo one lane.** Pass `directionId`, `lane` and `query` to search only that lane again with better words.

`count` sets how many results come back: 4 to 24, default 12.

## Put results on a canvas

Pass `canvasId` and the results wait in the canvas tray. From the tray you can:

- drag a result onto the board, or
- focus it and press <kbd>Enter</kbd>.

Your agent can place them with [`add_to_canvas`](/docs/reference/tools/add-to-canvas/) too.

## Taste

Pass `taste` with up to 5 style words, like "minimal", "dark mode" or "editorial". They are saved on the canvas, and later searches and bends reuse them.

## Rate results

[`rate_references`](/docs/reference/tools/rate-references/) is free. It makes later searches better.

- `bad`: off topic, shop or stock, cluttered, a duplicate, the wrong style or not UI. Bad results leave the canvas tray and never come back in your searches. Each bad rating returns a hint for searching that lane again.
- `great`: standouts only.

## Limits

One call to `search_references` counts as one search, however many lanes it runs. Free includes 30 searches a month. See [Plans and limits](/docs/reference/plans/).

Results on the takedown list never show. If your work shows up and you want it gone, send a [takedown request](https://gobanana-server.maherfayad55.workers.dev/en/takedown).
