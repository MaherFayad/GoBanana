---
name: gobanana-build
description: Build one Frankenstein page into a real screen, row by row, against the parts on the GoBanana board. Takes a stitchId and a directionId, refreshes the direction spec from the board with reconcile_direction, looks at every part with get_snapshot (each part's source image and the crop band the page uses), pulls the palette and fonts, builds each row against its part, says per part whether it mirrors in Arabic RTL, follows the Arabic copy rules, finishes with a drift check of each built row against its part, and places a screenshot of the build next to the page with add_to_canvas type build for side by side review. Use when the user says "build this Frankenstein page", "build the page from the board", "code this screen from the parts", "turn the stitch into a screen", "build st_...", or "make the Frankenstein page real". Runs reconcile_direction, get_snapshot, get_canvas and add_to_canvas from the GoBanana MCP server. Use gobanana-frankenstein first when there is no Frankenstein page yet, gobanana-handoff for a scoped file pack, and gobanana-critique to grade the result.
---

# GoBanana: build a Frankenstein page

Turn one Frankenstein page into a working screen. The page is a stack of parts cut from other people's work; you build the structure and the moves in the project's own code and content, never the pixels.

## Ground rules

- **Look before building.** Call `get_snapshot` on the page before you write any screen, and look at every image. Build from what you see, not from titles. If your client shows you no images, say so in one line and ask the user for screenshots or a description; never guess a part from its title.
- **Never download, save or copy reference images.** Thumbnails come inside tool results and stay there. Never write them to disk, never put them in the repo, never trace them. Use the project's own icons, images and copy.
- **Source link for every part you mention**, like `[Fintech pricing page](sourceUrl) (dribbble.com)`.
- **Page scope.** Build only the named page. Use the project's design system; put new tokens in a wrapper scoped to the page. Do not change shared components; add a local variant.
- Plain words, short sentences, no em dashes.

## Inputs

- `stitchId`: the Frankenstein page to build (from `get_canvas`, or the page the user named).
- `directionId`: the direction it serves. If the page has one, use it; otherwise ask once which direction, or build without one and say so.
- The `canvasId` from this conversation, or from `get_canvas` with no id.

## Steps

### 1. Refresh the direction

Call `reconcile_direction({ canvasId, directionId })`. It updates the direction's spec from what is on the board now and returns conflicts (for example the spec says mono type but the kept parts are all serif). Show each conflict in one line and how you will resolve it; ask only when two readings change the build a lot. If the tool is not there, read the spec from `get_canvas` and say the spec may be stale.

### 2. Look at the page, part by part

Call `get_snapshot({ canvasId, stitchId })`. It is a parts view, not a rendered composite: rows in order, and for each part its full source image, its crop rect (fractions of the image: the band the page uses), role, theme and note.

To see the whole page composed, ask the user once to press "Show in chat" in the inline canvas and pick this page. Their browser draws it as one image and it reaches you with their next message, with a row by row layout. If a part's host blocks drawing (Pinterest does), you get the parts view and a line saying why. Without the inline canvas, the parts view is enough.

For each row, write one short line: role, what you see in the crop band (layout, density, type size and weight, color, radius, the one move worth taking), and the source link. If a row has 2 or 3 slots, note the width share.

If the snapshot says a thumbnail was not shown (host not allowed, too large, over the cap), call `get_snapshot` again for that section, or ask the user to describe that part. Do not invent it.

### 3. Pull palette and fonts

- **Palette:** the direction's ship colors from `get_canvas` (palettes and swatches tagged `ship`). Only `ship` colors become tokens; `explore` colors are for concepts. If there is no palette, offer gobanana-palette first.
- **Fonts:** the type pairing from the direction spec or the type sample on the board. Load with `font-display: swap`.

### 4. Build row by row against the collage

Build the page top to bottom, one row at a time, in the project's framework:

1. Take the structure and the move from the part's band, not its content. Unify the theme: parts may mix light and dark; the page uses one.
2. Use the direction's tokens, the platform's grid and the project's components.
3. Real content from the product, never the reference's text or images.
4. For each row, state in one line whether it **mirrors in Arabic RTL** (most layouts do: nav order, chevrons, progress, sliders) or stays as is (media controls, charts with time on the x axis, logos, phone numbers), and build it with logical properties (`margin-inline-start`, `inset-inline-end`) so the mirror is automatic.

**Arabic copy rules**, when the page has Arabic:
- Labels as nouns, not verbs (a button reads "الدفع", not "ادفع الآن").
- No diacritics.
- Western digits (0 to 9) for prices, dates, times and counts.
- Airport and airline codes stay Latin (RUH, DXB, SV).

### 5. Drift check

Call `get_snapshot` again, take a screenshot of each built row (Playwright MCP, Chrome tools or `npx playwright screenshot`, of the user's own page only), and compare row by row: layout, spacing rhythm, type scale, color roles, the signature move. Write a table: row, part, matches or drifts, what drifted, fix. Fix the drifts that break the direction; list the rest.

### 6. Place the build next to the page

When the build runs at an https address (a preview deploy, or the user's own site), call:

```json
{ "name": "add_to_canvas", "arguments": { "canvasId": "...", "items": [{ "type": "build", "imageUrl": "https://<deploy>/<screenshot.png>", "url": "https://<deploy>/<page>", "stitchId": "st_...", "title": "Build 1" }] } }
```

It goes to the right of the Frankenstein page, the same size, with a Build chip, for side by side review. Pass an https link only; never image bytes. With no https address yet (a local dev server), skip this step and say so.

### 7. Report

Short: what you built (files), the RTL line per row, the drift table, the source link of every part, and the board link from the `add_to_canvas` result.

## When things go wrong

- **`get_snapshot` says the page was not found:** read the ids with `get_canvas` and ask which page.
- **No images in the results:** say so once, ask for screenshots or a description, and do not build from titles.
- **The build looks like one reference:** the page leans on a single part. Take the move, not the look; change the content, the color roles and the type to the direction's.
