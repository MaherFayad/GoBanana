---
title: export_kit
description: Export a board as files for your repo - DIRECTION.md, BUILD-PROMPT.md, REVIEW.md, DESIGN.md, Cursor rules, Copilot instructions, AGENTS.md and CLAUDE.md sections, tokens and more. Page scoped by default.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| Free: 6 formats. Pro: all 16 | None | No. Returns text; your agent writes the files | |

## Inputs

| Name | Type | Required | Limits and default | What it does |
| --- | --- | --- | --- | --- |
| `canvasId` | string | Yes | 1 to 100 characters | The board |
| `formats` | enum[] | Yes | 1 to 16, see below | Which files |
| `directionId` | string | No | 1 to 100 characters | One kept direction. Default: all kept directions |
| `pages` | string[] | No | 1 to 5, each up to 80 characters | Route names or globs: `"pricing page"`, `"/launch"`, `"app/pricing/**"` |
| `scope` | enum | No | `page` (default), `system` | `page`: applies only to the pages, inherits your system. `system`: the direction becomes your system |

**Formats:** `design_md`, `brief`, `direction_md`, `build_prompt`, `stitch_md`, `culture_md`, `claude_settings` (Free) · `review`, `cursor_rules`, `copilot`, `agents_md`, `claude_md`, `tokens`, `tailwind`, `figjam_spec`, `html_board`, `wireframe_html` (Pro). Paths and contents: [Export formats](/docs/reference/exports/).

## Example call

```json
{
  "name": "export_kit",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "directionId": "bd-mob5pq35",
    "pages": ["/launch"],
    "scope": "page",
    "formats": ["direction_md", "build_prompt", "review", "cursor_rules", "agents_md"]
  }
}
```

## Example output

The first text block is a summary; then one text block per file with its name, type and path:

```text
Exported 5 files from "Coffee launch page": DIRECTION.md, BUILD-PROMPT.md, REVIEW.md, gobanana-spa-like-cereal-box.mdc, AGENTS.md.
Scope: one wild page. These files sit on top of the project's own design system and do not replace it or its DESIGN.md.
Write each file below to its path in the user's project. AGENTS.md and CLAUDE.md are sections between gobanana:<slug> markers: replace the marked block if it exists, else append it. Keep the source links.
```

```text
File: DIRECTION.md (text/markdown)
path: design/explorations/spa-like-cereal-box/DIRECTION.md

# Wild direction: Coffee launch page
> **Scope: one wild page, not the product design system.** Applies only to: /launch.
…
```

On Free, the free formats export and the rest are listed with the upgrade message in the same answer: "These formats need Pro: review, cursor_rules, agents_md. Upgrade: …". If every requested format is Pro, the answer is the message alone.

`structuredContent`: `{ canvasId, scope, files: [{ name, mime, path, content, append? }], blocked, note? }`. `append: true` marks AGENTS.md and CLAUDE.md: merge by markers, never overwrite.

## Messages

| Message | Fix |
| --- | --- |
| "These formats need Pro: …" | Upgrade, or use the free formats |
| "This canvas has no direction with that id. Call get_canvas to see the direction ids." | Use a kept direction's id |
| "pages takes 1 to 5 route names or globs, each up to 80 characters…" | Fewer, shorter pages |
| "scope must be "page" (one wild page, the default) or "system" (the whole design system)." | Pick one |

Guide: [Hand off to your coding agent](/docs/guides/handoff/).
