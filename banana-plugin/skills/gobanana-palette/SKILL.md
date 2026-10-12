---
name: gobanana-palette
description: Pull a color palette from references on a GoBanana moodboard canvas (art direction images or UI references), assign roles, and check every pair against WCAG 2.2 contrast so the user knows what can ship and what is concept only. Use when the user says "palette", "colors from these", "pull the colours", "what colors are on this board", "colors from the art direction", "color scheme from the moodboard", "extract colors", or "do these colors pass contrast". Runs get_canvas and extract_palette (with addSwatches) from the GoBanana MCP server.
---

# GoBanana palette

Extract a palette from the references the user likes, add the swatches to the canvas, and explain roles and contrast in plain words.

## Ground rules

- **No image handling on your side.** The server reads thumbnails in memory to compute colors and drops them. Never download, save or copy reference images to get colors yourself.
- **Credit the sources.** Link each reference the palette came from: `[title](sourceUrl) (site)`.
- **A wild palette is explore by default.** These colors serve one wild page, not the product. Unless the user says the palette will become part of their product's system, call every color "for this page" and treat any pair that fails contrast as `explore`.
- Plain words, no em dashes.

## Steps

1. **Find the canvas and the items.** Use the `canvasId` from this conversation, or ask. Call `get_canvas`. Pick `itemIds`:
   - the references the user named or liked;
   - else the items in the direction they mean. The art direction row is a fine source: it carries the idea's color (the weave, the riso inks). Mixing art and UI items from the same direction is fine too;
   - else all references on the board (say so).
2. **Extract.** Call `extract_palette` with `canvasId`, `itemIds`, `size` (default 6; 5 for a tight set, up to 9 for a rich board) and `addSwatches: true`.
3. **Show the palette** as a small table: hex, OKLCH, role (primary, secondary, neutral, surface, on-surface, accent).
4. **Show contrast** from the `contrast` list, worst failures last:

   | Text or UI | On | Ratio | Text (4.5:1) | UI (3:1) | Tag |
   | --- | --- | --- | --- | --- | --- |

   Explain in two lines:
   - **ship:** passes WCAG 2.2 for its use. Text needs 4.5:1 (SC 1.4.3). Icons, borders, focus rings and other UI parts need 3:1 (SC 1.4.11). Safe to build with on the wild page.
   - **explore:** fails for that use. Keep it for mood, large decorative areas or concept work, and do not put body text on it.
5. **Suggest fixes** for the best `explore` colors: which way to move OKLCH lightness to reach the target. It is a suggestion that needs a re-check.
6. **Point to the canvas.** The swatches are on the board now. If the client cannot show the inline canvas, give the web link.
7. **Offer next steps:** hand the direction to a coding tool with these colors as page level overrides (gobanana-handoff), or tokens for the page (gobanana-asset-kit).

## When things go wrong

- **No references selected or found:** say so, and offer to search first (gobanana-explore).
- **Some thumbnails fail to load:** the palette may come from fewer items. Say how many were used.
- **Quota or plan message:** show it as is, with its upgrade link, once. Do not retry or loop.
- **Tool error or timeout:** retry once at most, then tell the user in one line.
- **GoBanana tools missing:** ask the user to enable the GoBanana connector (or run `/mcp` in Claude Code and log in).
