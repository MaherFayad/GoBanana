# Frankenstein it (internal name: stitch)

Client facing name, owner decision 2026-10-12: **"Frankenstein it"** everywhere users or agents read copy (UI, tool descriptions and outputs, skill `gobanana-frankenstein`, README, export files FRANKENSTEIN.md and frankenstein-wireframe.html). Code keeps the internal name `stitch`. Tool ids (owner decision, renamed 2026-10-12): `cut_parts`, `frankenstein_page`, `remix_frankenstein`, `update_frankenstein`.

Owner request (2026-10-12): with the help of the agent, cut parts out of every reference and stitch them into new, unique pages. The nav comes from one page, part of the hero from another, the cards from a third, and so on. Make several of these at once. One part in light and the next in dark is fine. This is for generating ideas and stitching them into something new, not for a finished design.

Branch: `feat/wild-directions-v2`. Contract: `banana-server/lib/stitch/types.ts`. Do not change its shapes without telling the lead.

## How designers do it, and the tool for each step

| Designer step | Tool or UI |
| --- | --- |
| Collect references | Existing: search_references, add_to_canvas |
| Look and slice: "I want this nav, that hero" | `cut_parts`. The agent looks at the image (it can see it) and passes a role and a crop. Without a crop, the server guesses a band by role and aspect (nav at the top, footer at the bottom) and marks it `guessedCrop`. In the canvas UI, a "Cut part" action on an image opens a crop editor (drag handles plus number fields for keyboard users). |
| A swipe file of parts by role | Parts library: `CanvasState.parts`, with a "Parts" tab in the tray grouped by role |
| Stack slices into a page | `frankenstein_page`. Rows of 1 to 3 slots stacked in a frame sized for the platform (390, 834 or 1440). Pass rows of part ids, or pass a `recipe` (a list of roles) plus `variants` (1 to 6), and the server fills each role from the library. Variants differ in which part fills each role, and each one mixes at least 3 sources when the library allows. Frames are placed side by side in a "Stitches" section. |
| Try combinations | `remix_frankenstein`. Takes a stitchId, a `count`, `lock` (slot ids or roles to keep) and `vary` (roles to swap) and makes new variants next to the original. Seeded, so the same call gives the same result. |
| Push slices around | `update_frankenstein`. Operations: swap a slot's part, move a slot or row, remove, insert, recrop, set row widths, set mode, set a note. In the canvas UI: select a slot, Alt+Arrow to move it, drop a part from the Parts tab onto a slot to swap it (with a keyboard menu "Swap with part..."), and Enter to recrop. |
| Squint to see the structure | Mode `wireframe` (grayscale, softened, role labels) and `even` (dark parts inverted so the page reads as one theme). `collage` shows the parts as they are. |
| Annotate | A note on each slot (what to steal) and a note on the stitch (the idea in one line) |
| Hand off | export_kit formats `stitch_md` (STITCH.md: page skeleton per stitch, each slot with role, source link and note, plus build guidance: take the structure, not the pixels, and unify to one theme) and `wireframe_html` (a standalone low fi HTML wireframe: grey boxes per slot with role labels and notes, with no reference images by default). BUILD-PROMPT.md lists the stitches when there are any. |

## Rules

- A part is a crop rectangle over a hotlinked image URL. The browser crops it with CSS (object-position and scale in an overflow hidden box). The server never fetches or stores image bytes. Only allowlisted image hosts are used, as on the rest of the canvas.
- Every slot shows its source (site chip with a link) in the canvas, the shared view and every export.
- No AI on the server. Default crops come from role and aspect rules. Variant filling is seeded combinatorics.
- Parts library limit is `MAX_PARTS` (80). A stitch frame counts as one canvas item toward the plan item caps. No pricing or plan changes.
- WCAG 2.2 AA: every drag has a keyboard path, slots are focusable with labels like "Hero, from dribbble.com", and the crop editor has number inputs.
- Plain words, no em dashes.

## Default crops (server guess, no vision)

These are bands of the source image, picked by role, the platform of the source, and the image aspect ratio (tall full page shots versus single screen shots):

- nav: top 0 to 8% (top 0 to 4% for tall full page shots)
- hero: the next 35% (the next 15% for full page shots)
- footer: the bottom 10%
- tabbar (mobile): the bottom 10%
- status-header: top 0 to 14%
- sidebar: the left 18%, full height
- Everything else: the middle band

The agent should always pass its own crop when it can see the image. The guess is only a fallback.

## Ownership

| Agent | Owns |
| --- | --- |
| stitch-server | `lib/stitch/**` (pure logic: default crops, recipe filling, variants, ops, validation), the state and snapshot integration (`canvas/types.ts`, `canvas/state.ts`, `canvas/factory.ts`, `canvas/layout-adapter.ts`, `lib/canvas/**`, `lib/layout/**`), the tools `cut_parts`, `frankenstein_page`, `remix_frankenstein` and `update_frankenstein` plus `get_canvas` output and `lib/mcp/tools/index.ts`, exports (`lib/export/**`, `lib/quota.ts` format list), and tests |
| stitch-ui | `canvas/nodes/**` (new StitchNode), `canvas/stitch/**` (new: crop editor, slot UI), `canvas/Tray.tsx` (Parts tab), `canvas/CanvasApp.tsx`, `canvas/ImageNode` "Cut part" action, `canvas/canvas.css`, `canvas/Toolbar.tsx`, `canvas/ImagePreview.tsx`, `canvas/SharedCanvas.tsx`, and canvas UI tests |
| plugin | `banana-plugin/**` |

Nobody edits DECISIONS.md or CLAUDE.md. Do not commit; the lead commits.
