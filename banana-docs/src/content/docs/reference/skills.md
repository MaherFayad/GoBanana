---
title: Plugin skills
description: The 11 skills in the GoBanana Claude plugin, what to say to trigger each one, which tools it calls and what you get.
---

The plugin (`gobanana`, version 0.1.3) adds these skills on top of the MCP server. Claude picks one from what you say; you can also name it (`/gobanana-explore` in Claude Code). Every skill follows the same ground rules: source link for every reference, never download or copy images, plain words, one question at most per turn, show a plan or quota message once and stop.

| Skill | Say something like | Tools | You get |
| --- | --- | --- | --- |
| `gobanana-explore` | "go wild on our launch page", "crazy ideas for onboarding", "make it weird", "where can our app be weird" | `get_canvas`, `new_canvas`, `bend_brief`, `search_references`, `rate_references`, `rate_directions`, `add_to_canvas`, `arrange_canvas`, `open_canvas`, plus your Mobbin connector | 3 or 4 kept directions as compact spec cards, a finished board in two zones with steal notes, one line on what was dropped |
| `gobanana-moodboard` | "make a moodboard", "arrange this", "group by direction", "put it in FigJam", "make an HTML board" | `get_canvas`, `add_to_canvas`, `arrange_canvas`, `export_kit` (`figjam_spec`, `html_board`) | Sections per direction, art row above UI grid, steal notes, a clean layout; optionally FigJam or HTML |
| `gobanana-frankenstein` | "frankenstein it", "nav from this, hero from that", "remix this one", "wireframe from my references" | `get_canvas`, `cut_parts`, `frankenstein_page`, `update_frankenstein`, `remix_frankenstein`, `open_canvas`, `export_kit` (`stitch_md`, `wireframe_html`) | 3 or 4 Frankenstein pages, each as a numbered skeleton with source links |
| `gobanana-build` | "build this Frankenstein page", "build the screen from the board", "code this page from the parts" | `reconcile_direction`, `get_snapshot`, `get_canvas`, `add_to_canvas` (`build`) | The screen built row by row against the parts, with an Arabic RTL note per part, a drift check per row, and a screenshot of the build placed next to its Frankenstein page |
| `gobanana-palette` | "palette", "colors from the art direction", "do these colors pass contrast" | `get_canvas`, `extract_palette` | Colors with roles, a contrast table, `ship` or `explore` per pair, swatches on the board |
| `gobanana-handoff` | "hand this off", "Cursor rules for this", "prompt for v0", "set up my agents for this page" | `get_canvas`, `export_kit` | The scoped harness pack, written into your repo, merged into AGENTS.md and CLAUDE.md |
| `gobanana-design-md` | "DESIGN.md for this page", "lint my DESIGN.md" | `get_canvas`, `export_kit` (`design_md`, `direction_md`), `npx @google/design.md@0.4.0 lint` | A scoped DESIGN.md that lints clean (up to 3 fix rounds) |
| `gobanana-agents-md` | "AGENTS.md", "rules for coding agents", "make my agents follow this direction" | `get_canvas`, `export_kit` (`agents_md`, `claude_md`) | A marked section in AGENTS.md (and CLAUDE.md) |
| `gobanana-asset-kit` | "asset kit", "tokens for this page", "gradients from the palette", "which fonts and icons" | `get_canvas`, `extract_palette`, `export_kit` (`tokens`, `tailwind`) | `kit/00-readme.md` to `kit/06-sources.md` |
| `gobanana-culture` | "make it feel Saudi", "use sadu", "Najdi doors", "Ramadan campaign", or any brief that names a culture, region, script or occasion | `get_canvas`, `get_snapshot`, `bend_brief`, `search_references`, `rate_references`, `add_to_canvas`, `export_kit` | Each cultural item named exactly, sorted by sensitivity, turned into a UI part, with meaning, steal, credit and care notes, and a Cultural brief in the hand-off |
| `gobanana-critique` | "critique the build", "does this match the direction", "grade my page" | `get_canvas`, `export_kit` (`review`), a browser tool | A pass or fix table with evidence, the top 3 fixes, applied in page scope on yes |

## Font pairings in the asset kit

All SIL Open Font License 1.1, on Google Fonts. The default is `space-grotesk-inter`; bilingual Arabic and English products get a pairing with Arabic.

| Pairing | Display | Body | Scripts | Mood |
| --- | --- | --- | --- | --- |
| `space-grotesk-inter` | Space Grotesk | Inter | Latin | tech, clean, confident |
| `fraunces-work-sans` | Fraunces | Work Sans | Latin | warm, editorial, playful |
| `playfair-source-sans` | Playfair Display | Source Sans 3 | Latin | luxury, editorial, classic |
| `syne-dm-sans` | Syne | DM Sans | Latin | art, experimental, gallery |
| `bricolage-instrument-sans` | Bricolage Grotesque | Instrument Sans | Latin | quirky, friendly, startup |
| `dm-serif-dm-sans` | DM Serif Display | DM Sans | Latin | elegant, hospitality, calm |
| `archivo-black-archivo` | Archivo Black | Archivo | Latin | poster, brutal, sport |
| `unbounded-manrope` | Unbounded | Manrope | Latin | futuristic, crypto, wide |
| `instrument-serif-inter-tight` | Instrument Serif | Inter Tight | Latin | fashion, editorial, minimal |
| `anton-work-sans` | Anton | Work Sans | Latin | poster, loud, condensed |
| `space-mono-space-grotesk` | Space Mono | Space Grotesk | Latin | retro, terminal, developer |
| `ibm-plex-arabic-plex-sans` | IBM Plex Sans Arabic | IBM Plex Sans | Arabic, Latin | corporate, fintech, bilingual |
| `noto-kufi-noto-sans-arabic` | Noto Kufi Arabic | Noto Sans Arabic | Arabic, Latin | geometric, government, heritage |
| `readex-pro-plex-arabic` | Readex Pro | IBM Plex Sans Arabic | Arabic, Latin | friendly, app, bilingual |
| `cairo-tajawal` | Cairo | Tajawal | Arabic, Latin | retail, travel, modern |
| `alexandria-almarai` | Alexandria | Almarai | Arabic, Latin | bold, lifestyle, youthful |
| `el-messiri-noto-naskh` | El Messiri | Noto Naskh Arabic | Arabic, Latin | heritage, editorial, hospitality |
| `reem-kufi-tajawal` | Reem Kufi | Tajawal | Arabic, Latin | geometric, cultural, signage |

## Editing a skill

Skills are plain `SKILL.md` files in `banana-plugin/skills/<name>/`. Edit one and load the folder with `claude --plugin-dir` to try it. Frontmatter is `name` and `description` only, so the same skill works in Claude Code, Claude.ai and Cowork. See [Claude Code setup](/docs/setup/claude-code/#option-c-local-development-with-plugin-dir).
