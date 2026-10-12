---
name: gobanana-moodboard
description: Build and arrange a GoBanana moodboard from references in the canvas tray - one section per direction, an "Art direction" row above the "UI references" grid, a "steal:" note on each placed reference, and an optional "Shipped today" note - and optionally rebuild it as a FigJam board through the Figma MCP or an HTML board. Use when the user says "make a moodboard", "arrange this", "lay these out", "put these on the board", "tidy the canvas", "group by direction", "add steal notes", "moodboard in FigJam", "send the board to Figma", or "make an HTML board". Runs get_canvas, add_to_canvas, arrange_canvas and export_kit (figjam_spec, html_board) from the GoBanana MCP server. Every tile keeps its source link. To find new references first, use gobanana-explore; to stitch parts of them into new pages, use gobanana-frankenstein.
---

# GoBanana moodboard

Turn the tray into a board people can read: one section per direction, the wild idea as images in the art row, real UI in the grid below, and a short note on each tile saying what to steal. Optionally rebuild it in FigJam.

## Ground rules

- **Every tile keeps its source link**, on the GoBanana canvas, in FigJam and in any HTML board.
- **Never download, save or copy reference images** to the repo or to disk. Boards point at the source URLs.
- **Two zones, never mixed.** Tray references carry a `zone`: `art` (the idea as raw images) or `ui` (screens and components). Art goes in the section's "Art direction" row; UI goes in the "UI references" grid. Never move an art item into the UI grid to fill it.
- **The server only returns text.** When a file is needed (HTML board), you write it.
- **Trust write results.** The `add_to_canvas` and `arrange_canvas` answers are the record. Read the board once in step 1; do not call `get_canvas` again to check each write.
- **Always arrange.** Every run that places or moves items ends with one `arrange_canvas` call, after the last `add_to_canvas`.
- Plain words, no em dashes.

## Steps

### 1. Find the canvas

Use the `canvasId` from this conversation. If there is none, call `get_canvas` with no `canvasId` to list recent canvases and use the one the user means (ask only if two could fit). Then call `get_canvas` with the id to see directions (with their spec when saved), sections, tray references with their zone, notes and palettes.

If the tray is empty, run the gobanana-explore flow first.

### 2. Place items

Call `add_to_canvas` with `canvasId`, the direction's `sectionId` and `items`:

1. One `{ "type": "section", "title": "<direction title>" }` per kept direction, unless sections exist. Skip dropped directions.
2. **Art row: 2 to 4** art references, best first: `{ "type": "reference", "referenceId": "...", "note": "steal: <what to take>" }`. The server puts art items in the "Art direction" row above the UI grid.
3. **UI grid: 6 to 8** UI references, best first, each with a `steal:` note the same way.
4. One idea note per section: `{ "type": "note", "text": "WILD: <twist>. PATTERN: <pattern>. SIGNATURE: <signature>." }`, from the direction's spec when you have it.
5. If a palette exists, swatches as `{ "type": "swatch", "hex": "...", "role": "..." }`.
6. Check for a Mobbin connector first. If there is one, place 2 to 4 Mobbin screens per direction in its UI grid when they fit (its BUILD ON anchors, or a shipped screen that is already wild in its way), each as `{ "type": "screen", "imageUrl": "<image_url>", "sourceUrl": "<mobbin_url>", "app": "...", "platform": "ios", "note": "steal: ..." }` with the URLs exactly as the Mobbin tool returned them; they count toward the 6 to 8 UI items. Add one board note `Shipped today: [App, screen](mobbin link), ...` and a `BUILD ON: [App, screen](mobbin link)` line in each direction's idea note (see gobanana-explore steps 0, 6b and 11). The board hotlinks the screens and links each to its Mobbin page; never download them, never pass them to `search_references`. With no Mobbin connector, skip this and do not mention Mobbin.

**Steal notes:** up to 280 characters, start with `steal:`, name one concrete thing for the page: `steal: the stamped date as a section divider`, `steal: the tab bar that hides on scroll`. Draw them from the direction's `spec.steal` and from what the title says. Look at the returned thumbnails before rating or noting: `get_canvas` and `add_to_canvas` results carry a small image after each reference's line, so write the note from what you see in it. Links in notes are clickable on the board.

If the user picked specific references, add only those. If the plan's item cap is hit, relay the message and stop adding.

### 3. Arrange (always)

Right after the last `add_to_canvas`, call `arrange_canvas` once with a `layout`. Do not skip it, and do not read the board in between:

| Layout | Use when |
| --- | --- |
| `by_direction` | More than one section. Default. Keeps the art row above the UI grid |
| `masonry` | One mixed pile, keep aspect ratios |
| `grid` | Comparing like with like, equal cells |
| `hero` | One standout reference leads, others around it |

Pass `sectionId` to arrange one section only.

**Making one reference the hero:** with `hero`, the first item placed in a section leads. So when the user names a reference for the hero: if it is still in the tray, place it first in its direction's section with `add_to_canvas` (create the section first if needed); then call `arrange_canvas` with `layout: "hero"` and that `sectionId`. If it is already placed, call `arrange_canvas` with `layout: "hero"` straight away. Say which reference leads.

### 4. Show it

Say the board is ready. If the client shows the canvas inline, point to it. **Always** give the web link (`webUrl`) too. End with 2 to 3 highlights per direction on the board, each written exactly as `[title](sourceUrl) (site)`, with its steal note in a few words.

### 5. Offer next steps

- **Frankenstein it:** cut the best parts out of the UI references and stitch 3 or 4 new page variants from them, every part linked to its source (gobanana-frankenstein).
- **FigJam or HTML board:** see below.
- **Hand off** a kept direction to a coding tool (gobanana-handoff).

## FigJam board (optional)

1. Call `export_kit` with `canvasId` and `formats: ["figjam_spec"]`. The spec is JSON: `{ sections: [{ title, x, y, w, h, items: [{ type, x, y, w, h, imageUrl?, text?, hex?, sourceUrl, zone?, note? }] }] }`.
2. Check the Figma MCP is connected (tools such as `use_figma`, `create_new_file`). If not, tell the user to connect it, and give the GoBanana web link meanwhile.
3. Follow the Figma MCP's own skill instructions (load `figma-use-figjam` or `figma-use` before calling `use_figma`).
4. Build from the spec, keeping positions and sizes:
   - each section becomes a FigJam section; inside it, a labelled "Art direction" row above a "UI references" grid, as in the spec;
   - `image` items: place the image from its `imageUrl`, with a small label under it: site name linked to `sourceUrl`, then the steal note. If Figma cannot load the image, make a link card (title, site, link). Never save the image to disk;
   - `note` items become stickies, `swatch` items become color rectangles labelled with hex and role;
   - a final **Sources** section lists every `sourceUrl`.
5. Share the FigJam link. Reference images belong to their owners, so the board is for private reference.

## HTML board (optional)

Call `export_kit` with `formats: ["html_board"]` and write the returned `content` to its `path` (or `name`) in the folder the user picks. The page hotlinks images from their sources and lists sources at the bottom. Do not inline or download the images.

## When things go wrong

- **Quota, item cap or plan message** (`figjam_spec` and `html_board` are Pro): show it as is, with its upgrade link, once. Do not retry or loop. Offer what still works: the arranged canvas and its web link.
- **Canvas limit:** offer to add to an existing board, or to delete an old one: list boards with `get_canvas`, ask which, confirm by name ("Delete 'Frosted checkout' for good?"), and call `delete_canvas` with `confirm: true` only after an explicit yes.
- **Tool error or timeout:** retry once at most, then tell the user in one line.
- **GoBanana tools missing:** ask the user to enable the GoBanana connector (or run `/mcp` in Claude Code and log in).
