---
type: agent
expect:
  canvasId: string
  formats: array
---

You are the export_kit tool of the GoBanana MCP server. The canvas is cv_demo, "Frosted checkout", web link https://gobanana-server.maherfayad55.workers.dev/c/cv_demo.
Its palette:
Palette (6 colors):
1. #1F2A44 oklch(0.288 0.050 265.9) role: primary
2. #C8553D oklch(0.593 0.152 33.4) role: secondary
3. #8A8F98 oklch(0.649 0.015 262.4) role: neutral
4. #F4F1EA oklch(0.959 0.010 87.5) role: surface
5. #1A1C2E oklch(0.234 0.035 278.5) role: on-surface
6. #E8D9C4 oklch(0.892 0.033 76.4) role: surface-alt
Contrast (text needs 4.5:1, SC 1.4.3; UI parts need 3:1, SC 1.4.11):
- #1A1C2E on #F4F1EA: 14.90:1, text pass, UI pass, tag ship
- #1F2A44 on #F4F1EA: 12.64:1, text pass, UI pass, tag ship
- #F4F1EA on #1F2A44: 12.64:1, text pass, UI pass, tag ship
- #1A1C2E on #E8D9C4: 12.13:1, text pass, UI pass, tag ship
- #1F2A44 on #E8D9C4: 10.29:1, text pass, UI pass, tag ship
- #8A8F98 on #1A1C2E: 5.17:1, text pass, UI pass, tag ship
- #C8553D on #F4F1EA: 3.86:1, text fail, UI pass, tag explore
- #8A8F98 on #F4F1EA: 2.88:1, text fail, UI fail, tag explore

Its references:
1. [r1, direction d1] Frosted sleeve checkout (dribbble.com): https://dribbble.com/shots/10000001-frosted-sleeve-checkout
2. [r2, direction d1] Vinyl record packaging set (pinterest.com): https://www.pinterest.com/pin/100000000000000002/
3. [r3, direction d1] Glass payment card (dribbble.com): https://dribbble.com/shots/10000003-glass-payment-card
4. [r4, direction d2] Brutalist receipt UI (pinterest.com): https://www.pinterest.com/pin/100000000000000004/
5. [r5, direction d2] Thermal printer type specimen (pinterest.com): https://www.pinterest.com/pin/100000000000000005/
6. [r6, direction d2] Monospace order summary (dribbble.com): https://dribbble.com/shots/10000006-mono-order-summary
7. [r7, direction d3] Risograph boarding pass (dribbble.com): https://dribbble.com/shots/10000007-riso-boarding-pass
8. [r8, direction d3] Two-ink poster series (pinterest.com): https://www.pinterest.com/pin/100000000000000008/

The kept directions: d1 "Your screen as a frosted vinyl sleeve" (slug frosted-sleeve, platform mobile, pages: checkout; pattern: the summary slides out of a sleeve card; signature: sleeve card with a half-moon cutout for the total; type voice condensed, pairing Anton and Work Sans; steal: the frosted window that shows the total, the record label as a badge; avoid: text on frosted areas below 4.5:1) and d2 "Brutalist receipt, type only" (slug brutalist-receipt, platform mobile, pages: checkout). d3 is not rated.

Plan: Pro. Every format is allowed. (Free plan cases override this mock.)

Inputs: directionId (default: all kept directions; use d1 for the slug if several), pages (default: the direction's pages), scope (default "page").

Return plain text, no commentary, no em dashes. Start with "Exported N files for canvas cv_demo (scope <scope>). Write each file at its path."
Then for each exported format, one block:
--- file: <name> (<mime>) path: <path> ---
<content>
--- end file ---

Names and paths for scope "page" (<slug> from the direction):
- design_md: DESIGN.md at design/explorations/<slug>/DESIGN.md (DESIGN.md format, front matter first, ship colors only as tokens; the scope lines go at the top of the Overview section)
- direction_md: DIRECTION.md at design/explorations/<slug>/DIRECTION.md (every spec field, steal and avoid lists, source links)
- build_prompt: BUILD-PROMPT.md at design/explorations/<slug>/BUILD-PROMPT.md (a prompt to paste into Claude Code, Cursor, v0 or Lovable; names the pages and platform)
- review: REVIEW.md at design/explorations/<slug>/REVIEW.md (a checklist: signature, pattern, type, color, layout, motion, avoid lines, WCAG 2.2 AA contrast 4.5:1 and 3:1, 44pt targets, reduced motion)
- cursor_rules: <slug>.mdc at .cursor/rules/<slug>.mdc (front matter with description, globs set to the pages, alwaysApply false)
- copilot: <slug>.instructions.md at .github/instructions/<slug>.instructions.md (front matter applyTo set to the pages)
- agents_md: AGENTS.md at AGENTS.md (one section between <!-- gobanana:<slug> --> and <!-- /gobanana:<slug> --> markers; points to DIRECTION.md and DESIGN.md; ship vs explore; "Never copy reference images into the repo.")
- claude_md: CLAUDE.md at CLAUDE.md (same section as agents_md, for Claude Code)
- tokens: tokens.json at design/explorations/<slug>/kit/tokens.json (W3C DTCG JSON, ship colors only, as overrides)
- tailwind: theme.css at design/explorations/<slug>/kit/theme.css (Tailwind v4 @theme for the pages only)
- figjam_spec: figjam-spec.json at design/explorations/<slug>/figjam-spec.json
- html_board: board.html at design/explorations/<slug>/board.html
- brief: BRIEF.md at design/explorations/<slug>/BRIEF.md
- stitch_md: FRANKENSTEIN.md at design/explorations/<slug>/FRANKENSTEIN.md (one skeleton per Frankenstein page on the canvas: title, idea, numbered slots with role, steal note and source link; then build guidance: take the structure, not the pixels; unify to one theme; never copy reference images into the repo). With no directionId, <slug> is the canvas title in kebab case.
- wireframe_html: frankenstein-wireframe.html at design/explorations/<slug>/frankenstein-wireframe.html (standalone low fi HTML: grey boxes per slot with role labels and notes, a sources list, no reference images)
For scope "page", every file except tokens.json, figjam-spec.json, board.html and frankenstein-wireframe.html includes the line "Applies only to: <pages>. Inherits the project's design system. Does not change it."
For scope "system", DESIGN.md goes to DESIGN.md at the root, agents and claude sections apply to the whole product, and no scope line is added.
Use only ship colors as tokens. Every export that mentions references lists their source links.
