---
name: gobanana-moodboard
description: Build and arrange a GoBanana moodboard from references in the canvas tray, and optionally rebuild it as a FigJam board through the Figma MCP. Use when the user says "make a moodboard", "arrange this", "lay these out", "put these on the board", "tidy the canvas", "group by direction", "moodboard in FigJam", "send the board to Figma", or "make an HTML board". Runs get_canvas, add_to_canvas, arrange_canvas and export_kit (figjam_spec, html_board) from the GoBanana MCP server. Every tile keeps its source link. To find new references first, use gobanana-explore.
---

# GoBanana moodboard

Turn the tray of search results into a board people can read: one section per direction, a short note on why each one matters, then a clean layout. Optionally rebuild the same board in FigJam.

## Ground rules

- **Every tile keeps its source link**, on the GoBanana canvas, in FigJam and in any HTML board. Never drop a link to make a board look cleaner.
- **Never download, save or copy reference images** to the repo or to disk. The canvas and the HTML board point at the source URLs.
- **The server only returns text.** When a file is needed (HTML board), you write it to disk.
- **References are UI only** (app screens, web pages, dashboards, components). A direction's wild idea goes on the board as words in a note, never as an image.
- Plain words, no em dashes.

## Steps

### 1. Find the canvas

Use the `canvasId` from this conversation. If there is none, ask for the board link or id, or call `open_canvas` to create a new one. Then call `get_canvas` to see sections, tray references, notes and palettes.

If the tray is empty, run the gobanana-explore flow first (`bend_brief`, then `search_references` with this `canvasId`).

### 2. Place items

Call `add_to_canvas` with `canvasId` and `items`:

1. One `{ "type": "section", "title": "<direction title>" }` per direction, unless sections already exist.
2. The references for each direction as `{ "type": "reference", "referenceId": "..." }`, passing that direction's `sectionId`. They are all UI references; lead with the strongest screen.
3. One short `{ "type": "note", "text": "..." }` per section with the direction's idea: the twist and what to salvage for the screen, for example `WILD: misregistered two-ink print. SALVAGE: two-color ticket with offset type.` Keep each part under 12 words. If the user wants wilder images, explain that references stay UI and make the note bolder instead.
4. If a palette exists, add swatches as `{ "type": "swatch", "hex": "...", "role": "..." }`.

If the user picked specific references, add only those. If the plan's item cap is hit, relay the message (see below) and stop adding.

### 3. Arrange

Call `arrange_canvas` with a `layout`:

| Layout | Use when |
| --- | --- |
| `by_direction` | More than one section. Default |
| `masonry` | One mixed pile, keep aspect ratios |
| `grid` | Comparing like with like, equal cells |
| `hero` | One standout reference leads, others around it |

Pass `sectionId` to arrange one section only.

### 4. Show it

Say the board is ready. If the client shows the canvas inline, point to it. **Always** give the web link (`webUrl`) too, because many clients cannot show the inline canvas.

## FigJam board (optional)

When the user wants the board in Figma or FigJam:

1. Call `export_kit` with `canvasId` and `formats: ["figjam_spec"]`. The spec is JSON: `{ sections: [{ title, x, y, w, h, items: [{ type, x, y, w, h, imageUrl?, text?, hex?, sourceUrl }] }] }`.
2. Check the Figma MCP is connected (tools such as `use_figma`, `create_new_file`). If not, tell the user to connect the Figma connector, and give the GoBanana web link meanwhile.
3. Follow the Figma MCP's own skill instructions for FigJam (load `figma-use-figjam` or `figma-use` before calling `use_figma`). Create a new FigJam file, or use the board URL the user gives.
4. Build from the spec, keeping its positions and sizes:
   - each section becomes a FigJam section with its title;
   - `image` items: place the image from its `imageUrl` with the Figma MCP, and put a small text label right under it with the site name, linked to `sourceUrl`. If Figma cannot load the image, make a link card instead (title, site, link). Never save the image to disk on the way;
   - `note` items become stickies, `swatch` items become color rectangles labelled with hex and role;
   - add a final **Sources** section listing every `sourceUrl`.
5. Share the FigJam link. Remind the user that reference images belong to their owners, so the board is for private reference.

## HTML board (optional)

If the user wants a file they can open or share: call `export_kit` with `formats: ["html_board"]` and write the returned `content` to the returned `name` (for example `moodboard.html`) in the folder the user picks. The page hotlinks images from their sources and lists sources at the bottom. Do not inline or download the images.

## When things go wrong

- **Quota, item cap or plan message** (for example `figjam_spec` and `html_board` are Pro): show the message as is, with its upgrade link, once. Do not retry or loop. Offer what still works: the arranged GoBanana canvas and its web link.
- **Tool error or timeout:** retry once at most, then tell the user in one line.
- **GoBanana tools missing:** ask the user to enable the GoBanana connector (or run `/mcp` in Claude Code and log in).
