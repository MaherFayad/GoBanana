---
title: Canvases and the dashboard
description: Where your boards live, what goes on them, and how to find them again.
---

A canvas is a moodboard. It opens inline in the chat and full screen on the web, with the same saved state.

## Where to find your canvases

- **Your canvases page.** Sign in on the [canvases page](https://gobanana-server.maherfayad55.workers.dev/en/canvases) to see every canvas you opened from Claude, with its directions and references. Choose one to see its brief, its view link and its sources.
- **The web link.** Every tool reply that touches a canvas includes its web link, `/c/<id>`.
- **In the chat.** Ask your agent to list your recent canvases. It calls [`get_canvas`](/docs/reference/tools/get-canvas/) without a `canvasId` and gets your 10 most recent.

Canvases start in the chat. Ask Claude for one, for example: "Open a canvas for a calm flight checkout."

## What goes on a canvas

| Item | What it shows |
| --- | --- |
| Section | A titled frame. Each bend direction gets one. |
| Image | A reference, loaded from its source, with a source chip that links to it. |
| Note | Short text. |
| Swatch | A color with its hex and OKLCH values, a role, and its contrast on white and on black. |
| Type sample | A font pairing with a sample line. |
| Upload | Your own image (Pro). |

If a reference image does not load, the canvas shows a link card with the title, the source site and the link.

## The tray

Search results wait in the tray. Drag one onto the board, or focus it and press <kbd>Enter</kbd>.

## Toolbar

The web canvas toolbar has the zoom controls, the save state, **Upload image**, **Share** and the keyboard shortcuts. The save state reads "Unsaved changes", "Saving…", "All changes saved" or "Could not save".

Changes save on their own about one second after you stop.

## Layouts

Ask your agent to tidy the board, or a single section. [`arrange_canvas`](/docs/reference/tools/arrange-canvas/) has four layouts:

| Layout | What it does |
| --- | --- |
| `by_direction` | One column per section. |
| `masonry` | 4 columns, keeps image shapes. |
| `grid` | Equal cells. |
| `hero` | First item large, the rest below. |

## Keyboard

Everything you can drag, you can also do with the keyboard. Press <kbd>?</kbd> on the canvas to see every shortcut, or read [Keyboard shortcuts](/docs/reference/shortcuts/).

## Limits

Free includes 3 canvases with 40 items each. Pro has no canvas limit and 300 items per canvas. See [Plans and limits](/docs/reference/plans/).
