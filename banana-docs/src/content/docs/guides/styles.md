---
title: Styles
description: The 19 visual styles GoBanana names, how your agent reads them from thumbnails, and how boards stay varied.
---

Every reference, board and direction has a visual style: dark and glowing, quiet and matte, big type, a huge number, glass, a photo, flat colour and so on. GoBanana names 19 of them so your agent can tell them apart, keep a board from turning into ten copies of one look, and give each direction its own style.

The server never looks at images. Your agent reads the style from each thumbnail and passes it back with [`rate_references`](/docs/reference/tools/rate-references/) (`styles`, 1 or 2 ids, main first). The [`gobanana-taste`](/docs/reference/skills/) skill teaches it how.

## The 19 styles

| Style id | Name | What it looks like |
| --- | --- | --- |
| `dark-luminous` | Dark luminous | Near-black, one glow or lit object is the only light |
| `dark-quiet-matte` | Dark quiet matte | Flat matte near-black UI, tone steps and hairlines, no glow |
| `data-dense-dashboard` | Data dense dashboard | Many real numbers and thin charts, one figure wins |
| `glass-frosted` | Glass and frosted | Frosted panels over a colour or photo backdrop |
| `soft-3d-objects` | Soft 3D objects | Lit, glossy 3D objects inside a UI |
| `vivid-gradient` | Vivid gradient field | A saturated gradient is the main surface |
| `photographic-hero` | Photographic hero | A real photo is the material, packaging shots included |
| `big-type-display` | Big type display | One word set huge in a heavy sans |
| `hero-numeral` | Hero numeral | One huge figure with small grey labels |
| `editorial-serif` | Editorial serif | A refined serif on a calm magazine grid |
| `minimal-mono-light` | Minimal mono light | A quiet light UI with one accent |
| `flat-color-field` | Flat colour field | Flat solid colour, one bold ground |
| `retro-pixel-halftone` | Retro, raw, pixel and halftone | Halftone, pixel, deco or raw brutalist type |
| `playful-too-fun` | Playful, too fun | Character, colour and bounce first |
| `illustrative-handmade` | Illustrative and handmade | Drawn or collaged artwork carries it |
| `webgl-3d-scene` | WebGL 3D scene | A real-time 3D world is the website |
| `motion-first` | Motion first | The movement is the design (usually a second tag) |
| `type-led-brand-system` | Type-led brand system | One mark and one move across many things |
| `gulf-arabic-first` | Gulf and Arabic first | Arabic type and Gulf craft lead, right to left |

Packaging and product shots count as `photographic-hero`, brutalist and raw work as `retro-pixel-halftone`, and AI orbs and ambient glow as `dark-luminous`.

## One style per direction

`bend_brief` gives each direction a style id, and no two directions of one brief share one. When your brief or taste names a style ("glassmorphism", "big typography", "dark"), the first direction takes it and the second its nearest neighbour, and search uses that style's own words.

## Boards stay varied

A board is one direction's UI references (the art row does not count):

- At most 3 references of one style, or 2 on a board of 6 or fewer.
- At most 60% of a board carries any one style. Dark luminous and dark quiet matte count as one (dark) unless you ask for dark.
- At least 3 styles on a board, or 4 at 8 or more, when you asked for no style.
- When you ask for a style, at least 60% of each board is that style or its nearest neighbour.
- At most 1 vivid gradient reference unless you ask for it: it is the look closest to default AI pages.

Search orders results by these rules, and [`get_canvas`](/docs/reference/tools/get-canvas/) with `summary: true` reports the style mix of each direction and which references still need a style.
