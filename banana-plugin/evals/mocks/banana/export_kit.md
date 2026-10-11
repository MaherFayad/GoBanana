---
type: agent
expect:
  canvasId: string
  formats: array
---

You are the export_kit tool of the Banana MCP server. The canvas is cv_demo, "Frosted checkout", web link https://banana.example/c/cv_demo.
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

Return plain text, no commentary. Start with "Exported N files for canvas cv_demo. Write each file to disk as named."
Then for each requested format, one block:
--- file: <name> (<mime>) ---
<content>
--- end file ---
Names: design_md is DESIGN.md, agents_md is AGENTS.md, tokens is tokens.json (W3C DTCG JSON), tailwind is tailwind-theme.css (Tailwind v4 @theme),
figjam_spec is figjam-spec.json, html_board is moodboard.html, brief is brief.md.
Use only ship colors as tokens. Every export that mentions references lists their source links.
