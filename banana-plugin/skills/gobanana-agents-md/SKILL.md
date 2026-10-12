---
name: gobanana-agents-md
description: Add a scoped GoBanana section to the project's AGENTS.md (and optionally CLAUDE.md) that tells coding agents how to build one wild page or two from a kept direction - which routes it covers, where its DIRECTION.md and DESIGN.md live, ship vs explore colors, and never copying reference images - without touching the project's global rules. Use when the user mentions "AGENTS.md", "rules for coding agents", "tell Codex or Claude Code how to build this page", "agent instructions for the launch page", or "make my agents follow this direction". Runs export_kit (agents_md, claude_md) from the GoBanana MCP server. For every coding tool at once (Cursor rules, Copilot, build prompt) use gobanana-handoff.
---

# GoBanana AGENTS.md

Export the direction's rules for coding agents as a section scoped to its pages, and merge it into the files agents already read. The section points to the scoped DIRECTION.md and DESIGN.md, which hold the detail.

## Ground rules

- **Scoped, not global.** The section applies only to the direction's pages (routes or globs). It says the rest of the product keeps its own design system. Never rewrite the project's global agent rules, never remove or reword existing sections, and never write scope `system` rules unless the user asks for them in so many words.
- **Merge, never overwrite.** If `AGENTS.md` or `CLAUDE.md` exists, add or update one section between `<!-- gobanana:<slug> -->` and `<!-- /gobanana:<slug> -->` markers. Everything outside the markers stays byte for byte.
- **The server returns text; you write the files.**
- **Ship vs explore.** `ship` colors passed WCAG 2.2 contrast (SC 1.4.3 at 4.5:1 for text, SC 1.4.11 at 3:1 for UI parts). `explore` colors are concept material. Keep this wording.
- **Sources.** Reference images belong to their owners. Never copy them into the repo. Keep this line.
- Plain words, no em dashes.

## Steps

1. **Find the canvas and direction.** Use the `canvasId` from this conversation, or ask. Call `get_canvas` and pick the kept direction (`directionId`).
2. **Find the pages.** The direction's `pages`, or the routes the user names. Pass them as `pages` (route names or globs like `app/pricing/**`).
3. **Check the scoped files.** Look for `design/explorations/<slug>/DIRECTION.md` and `DESIGN.md`. If missing, offer to export them first (gobanana-design-md, or gobanana-handoff for the full pack), because the section points at them. If the user says no, continue and say the pointers dangle until those files exist.
4. **Export.** Call `export_kit` with `canvasId`, `directionId`, `pages`, `scope: "page"` and `formats: ["agents_md"]`. Add `"claude_md"` when the project has a `CLAUDE.md`.
5. **Write.**
   - **No `AGENTS.md` yet:** create it at the returned `path` (the root `AGENTS.md`) with the section inside its markers.
   - **`AGENTS.md` exists:** do not overwrite it. Add the section at the end inside its markers, or replace only the text between existing markers for the same slug. Show the user the diff.
   - **`CLAUDE.md`:** same merge rule with the `claude_md` content. If `CLAUDE.md` does not mention AGENTS.md, offer to add `@AGENTS.md` instead; ask before editing.
   - Fix file paths in the text if the user keeps the scoped files elsewhere.
6. **Report** where the section went and the scope in one line: "Applies only to /pricing and /launch; everything else keeps your design system."

## When things go wrong

- **Plan message** (`agents_md` and `claude_md` are Pro): show it as is, with its upgrade link, once. Do not retry or loop. Offer what is free: `direction_md` and `build_prompt` (gobanana-handoff). If the user then asks you to write a short section by hand, keep it scoped: the pages it covers, a pointer to DIRECTION.md, ship only for text, and never copy reference images.
- **Inline canvas not shown:** give the canvas web link.
- **Tool error or timeout:** retry once at most, then tell the user in one line.
- **GoBanana tools missing:** ask the user to enable the GoBanana connector (or run `/mcp` in Claude Code and log in).
