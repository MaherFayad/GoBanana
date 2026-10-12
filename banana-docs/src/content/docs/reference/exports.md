---
title: Export formats
description: Every export_kit format - the file, where it goes in your repo, what is in it, and the plan it needs.
---

`<slug>` is the direction's short name, for example `frosted-sleeve`. Every path is relative to your repo root and is a suggestion: your agent writes the file there unless you keep the files elsewhere.

## The table

| Format | File and path | Plan | What it holds |
| --- | --- | --- | --- |
| `direction_md` | `design/explorations/<slug>/DIRECTION.md` | Free | The full visual spec per kept direction, the brief, pages and file globs, platform, wildness, lens, the board link and every source link |
| `build_prompt` | `design/explorations/<slug>/BUILD-PROMPT.md` | Free | One prompt to paste into Claude Code, Cursor, v0 or Lovable: pages, platform, spec, constraints, done when. Lists Frankenstein pages |
| `design_md` | `design/explorations/<slug>/DESIGN.md` (scope `system`: root `DESIGN.md`) | Free | Google Labs DESIGN.md format. Tokens as page overrides, `ship` colors only in the front matter |
| `brief` | `design/explorations/<slug>/BRIEF.md` | Free | The brief and the board in prose |
| `stitch_md` | `design/explorations/<slug>/FRANKENSTEIN.md` | Free | A skeleton per Frankenstein page with role, steal note and source link per slot, plus build guidance |
| `review` | `design/explorations/<slug>/REVIEW.md` | Pro | The build then critique checklist |
| `cursor_rules` | `.cursor/rules/gobanana-<slug>.mdc` | Pro | Rules with `globs` for the pages |
| `copilot` | `.github/instructions/gobanana-<slug>.instructions.md` | Pro | Rules with `applyTo` for the pages |
| `agents_md` | `AGENTS.md`, between `<!-- gobanana:<slug> -->` markers | Pro | Which pages, where the files are, ship vs explore, no images, done when |
| `claude_md` | `CLAUDE.md`, between the same markers | Pro | The same for Claude Code, with `@` imports |
| `tokens` | `design/explorations/<slug>/kit/tokens.json` | Pro | W3C design tokens (DTCG JSON) as overrides for the pages |
| `tailwind` | `design/explorations/<slug>/kit/theme.css` | Pro | A Tailwind theme for the pages |
| `figjam_spec` | `design/explorations/<slug>/figjam-spec.json` | Pro | Board layout as JSON for rebuilding in FigJam through the Figma MCP |
| `html_board` | `design/explorations/<slug>/board.html` | Pro | A standalone HTML board that hotlinks images and lists sources |
| `wireframe_html` | `design/explorations/<slug>/frankenstein-wireframe.html` | Pro | Grey boxes per slot with role labels and notes, a sources list, no reference images |

## Scope block

In page scope (the default) every Markdown file opens with:

```markdown
> **Scope: one wild page, not the product design system.** Applies only to: pricing page.
> Files: `**/pricing/**`, `**/pricing.*`.
> This inherits the project's own design system and its existing DESIGN.md, and does not change them.
> Tokens here are page level overrides: use them only inside these pages. The full spec lives in `design/explorations/<slug>/`.
```

JSON and CSS files carry the same sentence in a comment or a field.

## Page names become globs

| You pass | Globs |
| --- | --- |
| `pricing page` | `**/pricing/**`, `**/pricing.*` |
| `/launch` | `**/launch/**`, `**/launch.*` |
| `/` | `**/app/page.*`, `**/pages/index.*` |
| `app/pricing/**` | `app/pricing/**` (kept) |
| `src/pages/onboarding.tsx` | `src/pages/onboarding.tsx` (kept) |

Common page words map to short slugs: launch or landing page to `launch`, 404 to `not-found`, year in review to `year-in-review`, sign up to `signup`, log in to `login`.

## Merging

`agents_md` and `claude_md` come back with `append: true`. Replace the block between `<!-- gobanana:<slug> -->` and `<!-- /gobanana:<slug> -->` if it exists, else append it. Never overwrite the file. GoBanana never touches `.github/copilot-instructions.md`, your root DESIGN.md, tokens, theme or global CSS in page scope.

## No images, ever

No export contains or downloads a reference image. Every file links to sources. The HTML board and FigJam spec point at the original image URLs.

## Asset kit layout

The `gobanana-asset-kit` skill writes `tokens` and `tailwind` plus its own files into a numbered kit folder:

| File | Holds |
| --- | --- |
| `kit/00-readme.md` | What the kit is, its pages, ship vs explore |
| `kit/01-tokens.json` | The `tokens` export |
| `kit/02-tailwind-theme.css` | The `tailwind` export |
| `kit/03-gradients.css` | Up to 4 gradients built only from `ship` pairs |
| `kit/04-fonts.css` | One open licence font pairing (SIL OFL), self hostable |
| `kit/05-icons.md` | Lucide (ISC) or Phosphor (MIT), with size and stroke |
| `kit/06-sources.md` | Every reference as `[title](link) (site)` |
