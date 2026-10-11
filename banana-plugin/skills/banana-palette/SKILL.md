---
name: banana-palette
description: Pull a color palette from references on a GoBanana moodboard canvas, assign roles, and check every pair against WCAG 2.2 contrast so the user knows what can ship and what is concept only. Use when the user says "palette", "colors from these", "pull the colours", "what colors are on this board", "color scheme from the moodboard", "extract colors", or "do these colors pass contrast". Runs get_canvas and extract_palette (with addSwatches) from the GoBanana MCP server.
---

# GoBanana palette

Extract a palette from the references the user likes, add the swatches to the canvas, and explain roles and contrast in plain words.

## Ground rules

- **No image handling on your side.** The server reads thumbnails in memory to compute colors and drops them. Never download, save or copy reference images to get colors yourself.
- **Credit the sources.** When you say which references the palette came from, link each one: `[title](sourceUrl) (site)`.
- Plain words, no em dashes.

## Steps

1. **Find the canvas and the items.** Use the `canvasId` from this conversation, or ask. Call `get_canvas`. Pick `itemIds`:
   - the references the user named or liked;
   - else every reference in the section they mean;
   - else all references on the board (say so).
2. **Extract.** Call `extract_palette` with `canvasId`, `itemIds`, `size` (default 6; use 5 for a tight brand, up to 9 for a rich board) and `addSwatches: true`, so the swatches appear on the canvas.
3. **Show the palette** as a small table: hex, OKLCH, role (for example primary, secondary, neutral, surface, on-surface, accent).
4. **Show contrast** from the `contrast` list, worst failures last:

   | Text or UI | On | Ratio | Text (4.5:1) | UI (3:1) | Tag |
   | --- | --- | --- | --- | --- | --- |

   Explain in two lines:
   - **ship:** passes WCAG 2.2 for its use. Text needs 4.5:1 (SC 1.4.3). Icons, borders, focus rings and other UI parts need 3:1 (SC 1.4.11). Use these in production.
   - **explore:** fails for that use. Keep it for concept work, large decorative areas, or mood, and do not put body text on it.
5. **Suggest fixes** for the best `explore` colors: say which way to move OKLCH lightness (darker text, lighter surface) to reach the target. Make clear it is a suggestion that needs a re-check.
6. **Point to the canvas.** The swatches are on the board now. If the client cannot show the inline canvas, give the web link.
7. **Offer next steps:** DESIGN.md from the `ship` colors (banana-design-md), or tokens, Tailwind theme and gradients (banana-asset-kit).

## When things go wrong

- **No references selected or found:** say so, and offer to search first (banana-explore).
- **Some thumbnails fail to load:** the palette may come from fewer items. Say how many were used.
- **Quota or plan message:** show it as is, with its upgrade link, once. Do not retry or loop.
- **Tool error or timeout:** retry once at most, then tell the user in one line.
- **GoBanana tools missing:** ask the user to enable the GoBanana connector (or run `/mcp` in Claude Code and log in).
