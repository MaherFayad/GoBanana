---
name: gobanana-handoff
description: Hand one kept GoBanana direction to the user's coding tools as a scoped harness pack - DIRECTION.md, BUILD-PROMPT.md, REVIEW.md and DESIGN.md under design/explorations/<slug>/, plus Cursor rules, Copilot instructions and AGENTS.md or CLAUDE.md sections that apply only to the target pages. Detects Claude Code, Cursor, Copilot, Codex, v0 and Lovable from the repo, writes every file at its suggested path, and merges into existing AGENTS.md or CLAUDE.md instead of overwriting. Use when the user says "hand this off", "harness pack", "set up my agents for this page", "build prompt", "Cursor rules for this", "Copilot instructions", "prompt for v0", "prompt for Lovable", "get this ready to build", or "export the direction". Runs get_canvas and export_kit (direction_md, build_prompt, review, design_md, cursor_rules, copilot, agents_md, claude_md) from the GoBanana MCP server.
---

# GoBanana handoff

Turn one kept direction into the files a coding tool needs to build its page or two, and nothing more. The pack is scoped: it applies only to the named pages, inherits the project's design system, and does not change it.

## Ground rules

- **Page scope, always** (`scope: "page"`), unless the user asks in so many words for the direction to become the product's system (`scope: "system"`).
- **Write each file at its returned `path`.** Create folders as needed.
- **Never overwrite `AGENTS.md` or `CLAUDE.md`.** Merge one section between `<!-- gobanana:<slug> -->` and `<!-- /gobanana:<slug> -->` markers. Text outside the markers stays byte for byte. Never touch `.github/copilot-instructions.md`, global Cursor rules, the project's own `DESIGN.md`, tokens or theme.
- **Files that GoBanana owns** (`design/explorations/<slug>/*`, `.cursor/rules/gobanana-<slug>.mdc`, `.github/instructions/gobanana-<slug>.instructions.md`): if one already exists from an earlier export, show what changes and ask before replacing it.
- **No reference images in the repo.** The files link to sources; never download or save images.
- Plain words, no em dashes.

## Steps

### 1. Pick the direction and pages

Use the `canvasId` from this conversation, or ask. Call `get_canvas`. Pick the kept direction (`directionId`); if several are kept and the user did not say, ask which one. Pages: the direction's `pages`, or the routes the user names. Map them to the project's real routes or globs when you can see the code (`app/pricing/page.tsx`, `src/pages/onboarding/**`). Ask one question only if you cannot tell.

### 2. Detect the coding tools

Look in the repo, then confirm in one line ("I see Cursor and Claude Code; I'll set up both."). Ask only when nothing is found.

| Sign in the repo | Tool | Formats |
| --- | --- | --- |
| `CLAUDE.md`, `.claude/` | Claude Code | `claude_md` |
| `.cursor/`, `.cursorrules` | Cursor | `cursor_rules` |
| `.github/copilot-instructions.md`, `.github/instructions/` | GitHub Copilot | `copilot` |
| `AGENTS.md` | Codex and other AGENTS.md readers | `agents_md` |
| `lovable-tagger` in package.json, a Lovable remote, or the user says Lovable | Lovable | `build_prompt` (paste it) |
| the user says v0, or a v0 link | v0 | `build_prompt` (paste it) |

Always include `direction_md`, `build_prompt` and `review`. Add `design_md` when the user wants a DESIGN.md too. When the canvas has Frankenstein pages (stitches in `get_canvas`) and the user wants to build one, add `stitch_md` (FRANKENSTEIN.md, Free) and, on Pro, `wireframe_html` (frankenstein-wireframe.html); with no kept direction, export only those two plus `build_prompt` and leave out `directionId`.

### 3. Export

Call `export_kit` with `canvasId`, `directionId`, `pages`, `scope: "page"` and the `formats` from step 2. Every file comes back with `name`, `path` and `content`.

| Format | File and path | Plan |
| --- | --- | --- |
| `direction_md` | `design/explorations/<slug>/DIRECTION.md`: the full visual spec | Free |
| `build_prompt` | `design/explorations/<slug>/BUILD-PROMPT.md`: paste into Claude Code, Cursor, v0 or Lovable | Free |
| `design_md` | `design/explorations/<slug>/DESIGN.md`: scoped tokens as overrides | Free |
| `review` | `design/explorations/<slug>/REVIEW.md`: checklist for build then critique | Pro |
| `cursor_rules` | `.cursor/rules/gobanana-<slug>.mdc`, with `globs` for the pages | Pro |
| `copilot` | `.github/instructions/gobanana-<slug>.instructions.md`, with `applyTo` for the pages | Pro |
| `agents_md` | a section for `AGENTS.md` | Pro |
| `claude_md` | a section for `CLAUDE.md` | Pro |
| `stitch_md` | `design/explorations/<slug>/FRANKENSTEIN.md`: a skeleton per Frankenstein page with source links | Free |
| `wireframe_html` | `design/explorations/<slug>/frankenstein-wireframe.html`: grey boxes, no reference images | Pro |

### 4. Write the files

- New files: write at `path`.
- `agents_md` and `claude_md`: if the file exists, merge the section inside its markers (replace only the text between markers for the same slug). If it does not exist, create it with just the section. Show the user the diff for any file that existed before.
- If DESIGN.md or DIRECTION.md sits elsewhere, fix the pointers in the other files.

### 5. Report

A short list of written files with paths, then one line on scope: "These apply only to /pricing and /launch. They inherit your design system and do not change it." Then how to use them:

- **Claude Code, Codex:** they read the AGENTS.md or CLAUDE.md section on their own; or paste BUILD-PROMPT.md.
- **Cursor:** the rule attaches when you edit files matching the globs.
- **Copilot:** the instructions apply to files matching `applyTo`.
- **v0, Lovable:** paste BUILD-PROMPT.md into a new chat.

Offer next: build the page now, then grade it (gobanana-critique).

## On the Free plan

`review`, `cursor_rules`, `copilot`, `agents_md` and `claude_md` are Pro. The export returns the free files and a plan message for the rest. Write `DIRECTION.md` and `BUILD-PROMPT.md` (and `DESIGN.md` if asked), relay the plan message once with its link, and say that BUILD-PROMPT.md works in any tool by pasting it. Do not retry. If the user asks, add a two-line pointer by hand to their AGENTS.md or CLAUDE.md, inside the markers: which pages, and "read design/explorations/<slug>/DIRECTION.md first".

## When things go wrong

- **No kept direction on the canvas:** run gobanana-explore first, or ask the user to keep one.
- **Quota or plan message:** show it as is, with its link, once. Do not retry or loop.
- **Tool error or timeout:** retry once at most, then tell the user in one line.
- **GoBanana tools missing:** ask the user to enable the GoBanana connector (or run `/mcp` in Claude Code and log in).

See `docs/HARNESS.md` in the plugin for what each file holds and how each tool picks it up.
