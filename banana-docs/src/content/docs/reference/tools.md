---
title: MCP tools
description: All 17 tools the GoBanana server gives your agent, grouped by job, with plan, quota and what each one changes. Source of truth - banana-server/lib/mcp/tools.
---

The GoBanana MCP server at `https://gobanana-server.maherfayad55.workers.dev/api/mcp` registers these tools. The endpoint needs a sign in for every call, so every tool runs as your account.

## By job

| Tool | Does | Plan | Uses a search | Changes data |
| --- | --- | --- | --- | --- |
| [`ping`](/docs/reference/tools/ping/) | Checks the connection and shows your email | All | No | No |
| **Bend and judge** | | | | |
| [`bend_brief`](/docs/reference/tools/bend-brief/) | Turns a brief into wild directions with a visual spec, or returns wild spots | All, unlimited | No | Saves directions with `canvasId` |
| [`rate_directions`](/docs/reference/tools/rate-directions/) | Keeps or drops directions on a board | All | No | Yes |
| **Search and judge** | | | | |
| [`search_references`](/docs/reference/tools/search-references/) | Finds UI references and art direction for a direction or a query | All | **Yes, 1 per call** | Fills the tray with `canvasId` |
| [`rate_references`](/docs/reference/tools/rate-references/) | Rates results great or bad; bad ones leave and never return | All | No | Yes |
| **Boards** | | | | |
| [`new_canvas`](/docs/reference/tools/new-canvas/) | Creates a board without showing it | All (Free: 3 boards) | No | Yes |
| [`open_canvas`](/docs/reference/tools/open-canvas/) | Shows a board inline, or creates and shows one | All | No | Creates one without `canvasId` |
| [`get_canvas`](/docs/reference/tools/get-canvas/) | Reads a board, or lists your 10 most recent | All | No | No |
| [`add_to_canvas`](/docs/reference/tools/add-to-canvas/) | Places references, notes, swatches and sections | All (Free: 40 items) | No | Yes |
| [`arrange_canvas`](/docs/reference/tools/arrange-canvas/) | Lays out a board or one section | All | No | Yes |
| [`delete_canvas`](/docs/reference/tools/delete-canvas/) | Deletes a board for good, with `confirm: true` | All | No | Yes, destructive |
| **Frankenstein it** | | | | |
| [`cut_parts`](/docs/reference/tools/cut-parts/) | Cuts parts (crop rectangles) into the parts library | All | No | Yes |
| [`frankenstein_page`](/docs/reference/tools/frankenstein-page/) | Stacks parts into new page variants | All | No | Yes |
| [`remix_frankenstein`](/docs/reference/tools/remix-frankenstein/) | Makes variants of a page with a lock | All | No | Yes |
| [`update_frankenstein`](/docs/reference/tools/update-frankenstein/) | Changes one page with ops | All | No | Yes |
| **Color and files** | | | | |
| [`extract_palette`](/docs/reference/tools/extract-palette/) | Colors with roles and WCAG contrast | All | No | Saves the palette; swatches with `addSwatches` |
| [`export_kit`](/docs/reference/tools/export-kit/) | Returns files: DIRECTION.md, BUILD-PROMPT.md, rules... | Free: 5 formats, Pro: all 15 | No | No |

Two more tools exist for the canvas view only: `save_canvas_state` and `load_canvas_state`. MCP Apps hosts hide them from the model. Agents must not call them.

## Common rules

- **Input is checked, never thrown.** Every tool advertises a strict JSON schema but answers bad input with one plain sentence, like "brief must be 1 to 500 characters.". Read `content[0].text`.
- **Text plus structure.** Each answer has readable text for the agent (`content`) and the same data as `structuredContent` for apps.
- **Ids.** Canvas, direction, reference and item ids are 1 to 100 characters of letters, digits, `_` and `-`. Direction ids from `bend_brief` look like `bd-z0y2y96z`; reference ids like `ref_...`; part ids `pt-...`; Frankenstein page ids `st-...`.
- **Takedowns** are checked on every board load and search. Blocked links vanish everywhere, including share links.
- **Source links.** Tool text keeps reminding the agent: always show each reference's source link.
- **Common messages:** "You are not signed in. Reconnect to sign in again.", "That canvas was not found. Call open_canvas to create one, or check the canvasId.", "The canvas changed while saving. Try again.", "Something went wrong on our side. Try again in a minute."

## Typical order

```text
get_canvas (list) → new_canvas → bend_brief (count 8, canvasId)
→ search_references (per kept direction) → rate_references → rate_directions
→ add_to_canvas → arrange_canvas → open_canvas
→ cut_parts → frankenstein_page → update_frankenstein / remix_frankenstein
→ extract_palette → export_kit
```
