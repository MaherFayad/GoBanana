---
title: Your first board
description: From one prompt to a canvas full of directions and references.
---

This walk-through uses the Claude plugin. Without the plugin, your agent can call the same [tools](/docs/reference/tools/) itself.

## 1. Ask for something wild

Type a prompt like this:

```text
Go wild on a calm flight checkout screen.
```

The `gobanana-explore` skill picks it up.

## 2. What the agent does

1. Shapes your ask into a short brief.
2. Creates a canvas with [`new_canvas`](/docs/reference/tools/new-canvas/).
3. Bends the brief into ideas with [`bend_brief`](/docs/reference/tools/bend-brief/). The directions are saved on the canvas.
4. Drops ideas that cannot become UI for your screen with [`rate_directions`](/docs/reference/tools/rate-directions/).
5. Searches UI references for the shortlist with [`search_references`](/docs/reference/tools/search-references/). Results land in the canvas tray. The wild idea goes into notes, never images.
6. Audits the results with [`rate_references`](/docs/reference/tools/rate-references/), and searches a weak lane again with better words.
7. Places the keepers with [`add_to_canvas`](/docs/reference/tools/add-to-canvas/) and shows the board with [`open_canvas`](/docs/reference/tools/open-canvas/).

## 3. Look at the board

Each direction is a section. References sit inside it with their source links. Notes and swatches sit next to them.

- In Claude, the canvas can show inline in the chat.
- Every reply also has a web link. It opens the same board full screen at `/c/<id>`.
- All your canvases are listed on your [canvases page](https://gobanana-server.maherfayad55.workers.dev/en/canvases).

Changes save on their own about one second after you stop. The toolbar then shows "All changes saved".

## 4. Keep going

- "Make a palette from the references" runs `extract_palette`. See [Palette and contrast checks](/docs/guides/palette/).
- "Arrange this as a masonry board" runs [`arrange_canvas`](/docs/reference/tools/arrange-canvas/).
- "Write a DESIGN.md" runs `export_kit`. See [Export a kit](/docs/guides/export/).

:::tip
To add to a board you already have, say so. The agent can list your recent canvases with [`get_canvas`](/docs/reference/tools/get-canvas/) and reuse one instead of making a new one.
:::
