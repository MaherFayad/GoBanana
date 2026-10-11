---
name: banana-agents-md
description: Write an AGENTS.md that tells coding agents to follow the project's DESIGN.md, use only ship tokens, treat explore tokens as concept only, and never copy reference images. Use when the user mentions "AGENTS.md", "rules for coding agents", "tell Cursor, Codex or Claude Code how to use the design", "agent instructions for the UI", or "make my agents follow the design system". Runs export_kit (agents_md) from the GoBanana MCP server and points to DESIGN.md. To create DESIGN.md first, use banana-design-md.
---

# GoBanana AGENTS.md

Export the design rules for coding agents and save them where agents read them. AGENTS.md is short on purpose: it points to DESIGN.md, which holds the tokens.

## Ground rules

- **The server returns text; you write the file.**
- **Ship vs explore.** `ship` tokens passed WCAG 2.2 contrast (SC 1.4.3 at 4.5:1 for text, SC 1.4.11 at 3:1 for UI parts) and can be used in production. `explore` tokens are concept material and need a design review first. Keep this wording.
- **Sources.** Reference images belong to their owners. Never copy them into the repo. Keep this line in the file.
- Plain words, no em dashes.

## Steps

1. **Find the canvas.** Use the `canvasId` from this conversation, or ask.
2. **Check DESIGN.md.** Look for `DESIGN.md` in the project. If it is missing, offer to make it first (banana-design-md), because AGENTS.md points to it. If the user says no, continue and tell them the pointer will be dangling until DESIGN.md exists.
3. **Export.** Call `export_kit` with `canvasId` and `formats: ["agents_md"]`.
4. **Write the file.**
   - No `AGENTS.md` yet: save the returned `content` as `AGENTS.md` at the project root.
   - `AGENTS.md` exists: do not overwrite it. Add the exported text as a `## Design rules` section (merge headings so nothing is duplicated), and show the user the change.
   - If DESIGN.md lives somewhere other than the root, fix the path in the text.
5. **Claude Code users:** if the project has a `CLAUDE.md` that does not mention AGENTS.md, offer to add the line `@AGENTS.md` so Claude Code loads the rules too. Ask before editing.
6. **Report** where the file is and the three rules it sets: read DESIGN.md first, ship only in production, never copy reference images.

## When things go wrong

- **Plan message** (`agents_md` is a Pro format): show it as is, with its upgrade link, once. Do not retry or loop. Offer what is free: DESIGN.md (banana-design-md). If the user then asks you to write a short rules section by hand, keep it to the three rules above and the pointer to DESIGN.md.
- **Inline canvas not shown:** give the canvas web link so the user can review the board.
- **Tool error or timeout:** retry once at most, then tell the user in one line.
- **GoBanana tools missing:** ask the user to enable the GoBanana connector (or run `/mcp` in Claude Code and log in).
