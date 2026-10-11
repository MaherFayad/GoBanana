---
title: MCP tools
description: Every GoBanana MCP tool, what it does, and what it costs.
---

The GoBanana server speaks MCP over HTTP at:

```text
https://gobanana-server.maherfayad55.workers.dev/api/mcp
```

Every tool returns a short text reply for the agent and structured data for the client. When something goes wrong, the reply is a short plain message, never a raw error.

## Tools

<div class="gb-table">

| Tool | What it does | Plan |
| --- | --- | --- |
| [`ping`](/docs/reference/tools/ping/) | Checks the connection and shows your account. | Free |
| [`bend_brief`](/docs/reference/tools/bend-brief/) | Turns a brief into wild directions. | Free, no limit |
| [`rate_directions`](/docs/reference/tools/rate-directions/) | Keeps or drops directions on a canvas. | Free |
| [`search_references`](/docs/reference/tools/search-references/) | Finds UI references with source links. | 1 search per call |
| [`rate_references`](/docs/reference/tools/rate-references/) | Rates results so later searches improve. | Free |
| [`new_canvas`](/docs/reference/tools/new-canvas/) | Creates a canvas without showing it. | Canvas limit |
| [`open_canvas`](/docs/reference/tools/open-canvas/) | Shows a canvas inline and returns its web link. | Canvas limit when it creates one |
| [`add_to_canvas`](/docs/reference/tools/add-to-canvas/) | Places references, notes, swatches and sections. | Item limit |
| [`arrange_canvas`](/docs/reference/tools/arrange-canvas/) | Tidies a canvas or a section. | Free |
| [`get_canvas`](/docs/reference/tools/get-canvas/) | Reads a canvas, or lists recent ones. | Free |
| [`extract_palette`](/docs/reference/tools/extract-palette/) | Pulls colors and checks contrast. | Free |
| [`export_kit`](/docs/reference/tools/export-kit/) | Exports DESIGN.md, AGENTS.md, tokens and more. | Free: 2 formats. Pro: all |

</div>

Limits are on [Plans and limits](/docs/reference/plans/).

## Canvas view tools

Two more tools exist for the inline canvas only: `save_canvas_state` and `load_canvas_state`. They are hidden from the model. Agents use `get_canvas` and `add_to_canvas` instead.

## A typical order

1. `new_canvas`
2. `bend_brief` with the `canvasId`
3. `rate_directions`
4. `search_references` for each kept direction
5. `rate_references`
6. `add_to_canvas`, then `arrange_canvas`
7. `open_canvas` to show the board
8. `extract_palette` and `export_kit`
