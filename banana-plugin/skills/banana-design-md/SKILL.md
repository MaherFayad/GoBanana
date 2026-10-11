---
name: banana-design-md
description: Turn a Banana moodboard canvas into a DESIGN.md design system file that coding agents can follow, write it to disk, and lint it until it passes. Use when the user mentions "DESIGN.md", "design system file", "design spec for my agent", "turn this board into a design system", "write the design rules down", or "lint my DESIGN.md". Runs get_canvas and export_kit (design_md) from the Banana MCP server, then npx @google/design.md lint. For AGENTS.md use banana-agents-md; for tokens and Tailwind use banana-asset-kit.
---

# Banana DESIGN.md

Export the canvas as a DESIGN.md (Google Labs DESIGN.md format, alpha), save it in the user's project, and make sure it lints clean.

## Ground rules

- **The server returns text; you write the file.** Never ask the user to copy and paste it.
- **Ship vs explore.** Only colors tagged `ship` go in the front matter. They passed WCAG 2.2 contrast: SC 1.4.3 at 4.5:1 for text and SC 1.4.11 at 3:1 for UI parts. Colors tagged `explore` stay in prose under Colors, marked "concept only". Never move an `explore` color into the front matter to fix a lint error.
- **Sources stay linked.** Keep any Sources list or reference links the export includes. Never copy reference images into the repo.
- Plain words, no em dashes.

## Steps

1. **Find the canvas.** Use the `canvasId` from this conversation, or ask. Call `get_canvas`.
2. **Check for a palette.** If the canvas has no palette, run `extract_palette` first (see banana-palette) with `addSwatches: true`. DESIGN.md colors come from `ship` swatches; without them the file has no colors.
3. **Export.** Call `export_kit` with `canvasId` and `formats: ["design_md"]`. This format is on the Free plan.
4. **Write the file.** Save the returned `content` as `DESIGN.md` at the project root, or where the user asks.
   - If a `DESIGN.md` already exists, do not overwrite it silently. Show what would change and ask. If they want both, save the new one as `DESIGN.banana.md`.
5. **Lint.** Run:

   ```bash
   npx --yes @google/design.md@0.4.0 lint DESIGN.md
   ```

   The output is JSON with `findings` and a `summary` of `errors`, `warnings` and `infos`. The exit code can be 0 even with warnings, so read the summary.
6. **Fix and re-run.** Fix every error, and every warning you can, then lint again. Stop after 3 rounds and show the user anything left. Common fixes:
   - `broken-ref`: a component uses a key outside `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`, or points at a token that does not exist (for example `{colors.accent}` with no `accent`). Remove the key or point at a real token.
   - `section-order`: sections must run Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts. Reorder; do not delete content.
   - `missing-primary`, `missing-typography`: add the missing token from a `ship` swatch or the chosen font pairing. If none passes contrast, tell the user instead of inventing one.
   - `contrast-ratio`: a text and background pair fails. Pick another `ship` color for that component, or tell the user which pair fails and by how much.
   - `unknown-key`, `orphaned-tokens`: remove the stray key, or use the token in a component.
7. **Report.** Say where the file is, that lint passes (or what is left), and how many colors are `ship` vs `explore`.
8. **Offer next steps:** an AGENTS.md that points coding agents at this file (banana-agents-md), and tokens plus a Tailwind theme (banana-asset-kit).

## When things go wrong

- **Quota or plan message:** show it as is, with its upgrade link, once. Do not retry or loop.
- **`npx` cannot run** (no Node, no network): say so, give the exact lint command for the user to run later, and still check the file by eye against the section order and component keys above.
- **Inline canvas not shown:** give the canvas web link from `open_canvas` or `get_canvas` so the user can review the board.
- **Tool error or timeout:** retry once at most, then tell the user in one line.
- **Banana tools missing:** ask the user to enable the Banana connector (or run `/mcp` in Claude Code and log in).
