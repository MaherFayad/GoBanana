---
title: Export a kit
description: Turn a canvas into DESIGN.md, AGENTS.md, tokens, a Tailwind theme, a FigJam layout, an HTML board and a brief.
---

When the board feels right, export it as files your coding agent reads. The tool is [`export_kit`](/docs/reference/tools/export-kit/). It returns each file as text, and your agent writes the files where you want them.

Colors carry their contrast results, and every reference keeps its source link.

## Formats

<div class="gb-table">

| Format | File | What it is | Plan |
| --- | --- | --- | --- |
| `design_md` | `DESIGN.md` | The direction, rules and references in one file. | Free |
| `brief` | `BRIEF.md` | The brief, the directions tried, what was kept and notes. | Free |
| `agents_md` | `AGENTS.md` | Build notes for coding agents. Points them at DESIGN.md. | Pro |
| `tokens` | `tokens.json` | Colors and type as design tokens, in JSON. | Pro |
| `tailwind` | `theme.css` | A theme for Tailwind. | Pro |
| `figjam_spec` | `figjam-spec.json` | A layout you can rebuild in FigJam. | Pro |
| `html_board` | `board.html` | One static page laid out like the canvas, with a sources list. | Pro |

</div>

Ask for a Pro format on Free and the export still returns the free files, plus a short note on which formats need Pro.

## DESIGN.md

DESIGN.md follows the Google Labs DESIGN.md format. Only colors tagged `ship` go into its front matter. The `gobanana-design-md` skill writes the file and checks it:

```bash
npx @google/design.md lint DESIGN.md
```

Then it fixes anything the lint flags.

## AGENTS.md

The `gobanana-agents-md` skill writes an AGENTS.md that tells coding agents to:

- read DESIGN.md before writing any UI,
- use `ship` tokens in production and keep `explore` tokens for concepts,
- never copy reference images into the repo.

## FigJam

Say "put it in FigJam". The `gobanana-moodboard` skill exports `figjam_spec`, then builds the board with the Figma MCP. Every tile keeps its source link.

## Asset kit

Say "asset kit" or "starter kit". The `gobanana-asset-kit` skill exports `tokens` and `tailwind`, then adds:

- safe CSS gradients from color pairs that pass contrast,
- one open-licence font pairing,
- one icon set pick, Lucide or Phosphor.

Files get English names, numbered in order.

:::caution
Reference images belong to their owners. Exports link to them. Never copy them into your project.
:::
