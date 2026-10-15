# GoBanana

**Mobbin shows what works. GoBanana shows what's next.**

GoBanana is a Claude plugin for one crazy idea over a page or two: a launch page, onboarding, an empty state, a 404, a paywall, a year in review. It is not for your product's main design direction. Your product keeps its design system; the wild page inherits it and overrides only what the idea needs.

Ask your agent to "go wild" on a page. GoBanana bends the brief into unexpected directions, each with a full visual spec, fills a moodboard canvas with two zones of linked references (the wild idea as images, and real UI for your platform), and hands the direction you keep to Claude Code, Cursor, Copilot, Codex, v0 or Lovable as scoped files. Then it can screenshot what you built and grade it against the direction.

The plugin connects your agent to the GoBanana MCP server and adds 11 skills that tell the agent which tools to call, in which order, and how to present the results.

> Status: v0.1.0, beta. The server runs at `https://gobanana-server.maherfayad55.workers.dev` until a custom domain is chosen. See [Placeholders](#placeholders).

## Install

### Claude Code

Install from the GoBanana marketplace (Claude Code 2.1.275 or later):

```text
/plugin install gobanana --marketplace MaherFayad/GoBanana
```

On older versions, add the marketplace first, then install:

```text
/plugin marketplace add MaherFayad/GoBanana
/plugin install gobanana@gobanana
```

Or load this folder directly while developing:

```bash
claude --plugin-dir ./banana-plugin
```

Then run `/mcp`, pick `plugin:gobanana:gobanana`, and log in. GoBanana uses OAuth, so there is no API key to paste.

### claude.ai and Cowork

Add the plugin from your organization's plugin settings or from Anthropic's directory once it is listed. The GoBanana server shows up as a connector; connect it and log in.

## The flow

1. **Pin the platform and the page.** Mobile, tablet, website or web app, from your words or one question. If you name the whole product, the agent asks "Where should the weirdness go?" and offers the spots where it pays off on that platform ([docs/WHERE-WEIRDNESS-PAYS.md](docs/WHERE-WEIRDNESS-PAYS.md)).
2. **Bend.** 8 ideas, each with a spec: pattern, signature component, type, color, layout, motion, texture, icons, density, what to steal, what to avoid, why it fits. The agent drops the ones that cannot become UI for your page and keeps 3 or 4.
3. **Search two zones.** Art direction: the wild idea as images (the weave, the receipt, the riso print). UI: screens and components for your platform only, never web dashboards on a phone brief. The agent rates every result and drops shops, listings and off idea pins.
4. **Shipped vs next.** If you have a Mobbin connector, the agent puts 2 to 4 real shipped screens that fit each direction in its UI grid and adds a "Shipped today" note with links to them. The board shows the images straight from Mobbin and links each one to its Mobbin page; nothing is downloaded.
5. **Board.** Per direction: an "Art direction" row (2 to 4) above a "UI references" grid (6 to 8), each tile with a short "steal:" note and its source link.
6. **Hand off.** Scoped files for your coding tools, under `design/explorations/<slug>/` ([docs/HARNESS.md](docs/HARNESS.md)).
7. **Frankenstein it (optional).** Cut the best parts out of the references (a nav here, a hero there) and stitch new page variants from them, every part linked to its source. See [Frankenstein it](#frankenstein-it).
8. **Build then critique.** Screenshots at your platform's sizes, a pass or fix grade per checklist item, the top 3 fixes, applied inside the page only.

## Skills

| Skill | Say something like | What happens |
| --- | --- | --- |
| `gobanana-explore` | "go wild on our launch page", "crazy ideas for onboarding", "where can our app be weird" | Pins platform and pages, bends 8 ideas, keeps 3 or 4, searches art and UI zones, audits, adds Mobbin screens and a "shipped today" note when connected, places both zones with steal notes, shows compact spec cards |
| `gobanana-moodboard` | "make a moodboard", "arrange this", "put it in FigJam" | Sections per direction, art row above UI grid, steal notes, clean layout; optionally FigJam or an HTML board |
| `gobanana-palette` | "palette", "colors from the art direction" | Extracts colors with roles and tags each pair `ship` or `explore` by WCAG 2.2 contrast |
| `gobanana-design-md` | "DESIGN.md for this page" | Scoped DESIGN.md under `design/explorations/<slug>/`, linted with `@google/design.md` |
| `gobanana-agents-md` | "AGENTS.md", "rules for coding agents" | A scoped section merged into AGENTS.md or CLAUDE.md, never overwriting |
| `gobanana-asset-kit` | "asset kit", "tokens for this page" | Override tokens, Tailwind theme, safe gradients, one font pairing, one icon set, for the page only |
| `gobanana-handoff` | "hand this off", "Cursor rules for this", "prompt for v0" | Detects your tools, exports the harness pack, writes each file at its path, merges into AGENTS.md or CLAUDE.md |
| `gobanana-frankenstein` | "frankenstein it", "nav from this, hero from that", "make new layouts from my board" | Cuts parts out of the board's UI references (role, crop, light or dark, steal note), stitches 3 or 4 page variants from a recipe, reviews and fixes them, remixes with a lock, exports FRANKENSTEIN.md |
| `gobanana-build` | "build this Frankenstein page", "code this screen from the parts" | Refreshes the direction from the board, looks at each part with get_snapshot, builds row by row against the parts with an RTL note per part, runs a drift check, and places a screenshot of the build next to the page |
| `gobanana-critique` | "critique the build", "does this match the direction" | Screenshots at platform sizes, grades the REVIEW.md checklist with evidence, top 3 fixes inside page scope |

### Platforms

| Platform | UI references | Export defaults | Critique sizes |
| --- | --- | --- | --- |
| `mobile` | App screens and mobile galleries; web titles dropped | 4 columns, 16px margins, 44pt targets, tab bar and bottom sheet | 390x844 |
| `tablet` | Tablet and app screens | Split views, larger targets | 834x1194 |
| `website` | Landing pages, heroes, sites; website galleries | 12 columns, fluid type with clamp | 1440x900 and 390x844 |
| `webapp` | Dashboards and web apps; mobile only titles dropped | 12 columns or sidebar shell, dense 8px rhythm, tables, keyboard | 1440x900 |

### Wildness

| Level | Label | |
| --- | --- | --- |
| 1 | Fresh | Same layout, new flavour |
| 2 | Bold | One strong move |
| 3 | Weird | Two moves combined (default) |
| 4 | Wild | Two or three moves |
| 5 | Bananas | Three moves, usability ignored on purpose |

### MCP tools

`bend_brief`, `search_references`, `rate_references`, `rate_directions`, `extract_palette`, `new_canvas`, `open_canvas`, `add_to_canvas`, `arrange_canvas`, `get_canvas`, `delete_canvas`, `export_kit`, `cut_parts`, `frankenstein_page`, `remix_frankenstein`, `update_frankenstein`.

- `bend_brief` takes `platform` and up to 3 `pages`, and returns `wildSpots` when no pages are given.
- `search_references` returns two zones, `ui` and `art`. Sources: UI galleries by platform, plus Pinterest, Dribbble, Behance and Awwwards. At most 2 results per studio, newer work first, UI kits dropped.
  - Website galleries: Lapa Ninja, Siteinspire, CSS Design Awards, landing.love, Unsection, Supahero, The FWA, Httpster, Dark Design.
  - Web app galleries: Nicelydone and Refero (the "Shipped today" baseline only); SaaSFrame only when named in `sources`. Components: 21st.dev (React and Tailwind components, good parts for Frankenstein pages). Mobile galleries: 60fps (pay, card, checkout and wallet pages); ScreensDesign (tablet) and Figma Community only when named in `sources`. Style: Bento Grids.
  - Art direction: Fonts In Use, typographic posters, Swissted, The Brand Identity, BP&O, Cosmos, Are.na, Designspiration.
  - Reached through web image search only, never scraped. Each search picks galleries by platform and style words.
- `add_to_canvas` reference items take a `note` (what to steal, up to 280 characters).
- `cut_parts`, `frankenstein_page`, `remix_frankenstein` and `update_frankenstein` power Frankenstein it. A part is a role plus a crop rectangle over a hotlinked image; the browser applies it. `get_canvas` lists parts by role and each Frankenstein page with its skeleton.
- `delete_canvas` deletes a canvas for good (sections, items, tray, share link) and frees a slot. It needs `confirm: true`, and the skills call it only after you say yes to a named board. You can also delete boards from the web dashboard.

The server does no AI work: bend moves and specs are templates and word lists, and any thinking happens in your own agent. The server returns text; your agent writes the files.

If your client cannot show the canvas inline, every skill gives you the web link to open it full screen.

## Exports and plans

`export_kit` takes `directionId`, `pages` (routes or globs like `app/pricing/**`) and `scope`. The default scope is `page`: every file applies only to the named pages, inherits your design system and does not change it. `scope: "system"` is for when you want the direction to become your product's system.

| Format | File | Plan |
| --- | --- | --- |
| `design_md` | `design/explorations/<slug>/DESIGN.md` | Free |
| `brief` | `BRIEF.md` | Free |
| `direction_md` | `design/explorations/<slug>/DIRECTION.md` | Free |
| `build_prompt` | `design/explorations/<slug>/BUILD-PROMPT.md` | Free |
| `review` | `design/explorations/<slug>/REVIEW.md` | Pro |
| `cursor_rules` | `.cursor/rules/gobanana-<slug>.mdc` | Pro |
| `copilot` | `.github/instructions/gobanana-<slug>.instructions.md` | Pro |
| `agents_md` | Section in `AGENTS.md` | Pro |
| `claude_md` | Section in `CLAUDE.md` | Pro |
| `tokens`, `tailwind` | Override tokens and theme for the pages | Pro |
| `figjam_spec`, `html_board` | Board as FigJam spec or HTML | Pro |
| `stitch_md` | `design/explorations/<slug>/FRANKENSTEIN.md` | Free |
| `wireframe_html` | `design/explorations/<slug>/frankenstein-wireframe.html` | Pro |
| `claude_settings` | Keys to merge into `.claude/settings.json` so teammates are offered the plugin | Free |

Free also covers `bend_brief` (unlimited), 30 searches a month and 3 canvases. When you hit a limit, the skills show the plain upgrade message once and stop; they never retry in a loop. At the canvas limit they offer to add to an existing board or delete an old one, and delete only after you say yes.

## Frankenstein it

Frankenstein pages: the nav from one reference, part of the hero from another, the cards from a third, stacked into a new page. Several at once. Light next to dark is fine. It is for ideas over one page, not a finished design or your product's system.

`gobanana-frankenstein` works the way a designer slices a swipe file:

1. **Pick the board, the platform and one page type** (landing, pricing, dashboard home, a phone home screen).
2. **Look and slice.** The agent looks at each reference when it can see it, picks the strongest parts, and calls `cut_parts` with a role, a tight crop, light or dark, and a `steal:` note. It aims for 2 to 4 candidates per role from at least 4 sources. If it cannot see the images it says so, cuts by role only, and every crop is marked as a guess.
3. **Stack.** `frankenstein_page` with a recipe (for a website: nav, hero, logos, features, cards, testimonial, cta, footer) and 3 or 4 variants, or with the exact rows you dictated ("nav from this, hero from that").
4. **Judge and fix.** Rhythm, hierarchy, contrast jumps, seams, and whether it reads as one page. Fixes go through `update_frankenstein` (swap, move, recrop, widths); `remix_frankenstein` keeps the rows you like and swaps the rest. Modes `even` and `wireframe` help you judge structure.
5. **Present.** A numbered skeleton per variant: role, what it steals, and the source link.
6. **Hand off.** FRANKENSTEIN.md (Free) and frankenstein-wireframe.html (Pro, grey boxes, no reference images). BUILD-PROMPT.md lists the Frankenstein pages. Build, then critique.

Nothing is cut out of an image file. A part is a rectangle the browser shows over the original image at its source, and every part keeps its link.

## Harness pack

`gobanana-handoff` writes the pack for the tools it finds in your repo: `CLAUDE.md` or `.claude/` for Claude Code, `.cursor/` for Cursor, `.github/` instructions for Copilot, `AGENTS.md` for Codex, and a paste-ready BUILD-PROMPT.md for v0 and Lovable. It merges a marked section into AGENTS.md and CLAUDE.md and never overwrites them. See [docs/HARNESS.md](docs/HARNESS.md), [docs/AGENTS.example.md](docs/AGENTS.example.md) and [docs/CLAUDE.example.md](docs/CLAUDE.example.md).

## Hard rules on images and sources

- **GoBanana never downloads, stores or re-hosts reference images.** It keeps URLs and metadata only. Images load in your browser from their source.
- **Every reference shows its source link**: on the canvas, in share links, in every export, and in every skill reply.
- **Parts are crops in the browser, not files.** Frankenstein it never cuts or saves pieces of a reference; the crop is a rectangle over the hotlinked image.
- **Never copy reference images into your repo.** The skills will not do it, and the files they write tell coding agents not to either.
- **Mobbin through your own connector.** The agent searches with your own Mobbin connector; GoBanana never searches Mobbin. Screens it places are shown straight from Mobbin's image links and linked to their Mobbin pages, never downloaded or stored. Mobbin image links expire after about 30 days; then the tile shows a link to the screen instead.
- **No scraping.** References come from web search results only.
- Palette extraction reads thumbnails in memory on the server to compute colors, then drops them.

## Evals

`evals/` holds test briefs in the format `claude plugin eval` reads: one folder per case with a `prompt.md` and `graders/*.md`, plus `case.yaml` and a `fixture.sh` where a case needs files in the workspace. `evals/mocks/gobanana/` answers the GoBanana tools with fixed replies, and a case can override one tool in `<case>/mocks/gobanana/`. The stateful tools (`get_canvas`, `search_references`, `add_to_canvas`, `bend_brief`, the Frankenstein tools) are agent mocks that read the run's earlier calls, so a board read after a write shows the write; their shared rules live in `evals/mocks/gobanana/_canvas-rules.txt`. Runs never touch the real server.

On Windows, `--scaffold` runs `bash` from `PATH`, and `C:\Windows\System32\bash.exe` (WSL) cannot read the Windows fixture path. Put Git Bash first for the run: `$env:PATH = "C:\Program Files\Git\bin;" + $env:PATH` in PowerShell.

```bash
cd banana-plugin

# Check every case loads, without spending anything
claude plugin eval . --runs 1 --ablation none --max-cost-usd 0 --no-publish

# One case, one run
claude plugin eval . --case '01-*' --runs 1 --ablation none --no-publish

# Full suite (cases that write files, lint DESIGN.md or need fixtures)
claude plugin eval . \
  --allow-tools Write Edit "Bash(npx *)" "WebFetch(domain:registry.npmjs.org)" \
  --scaffold --threshold 0.8 --no-publish
```

Results go to `evals/results/`, which is git-ignored. Skill evals are tracked, not blocking.

## Validate

```bash
claude plugin validate --strict ./banana-plugin
```

## Placeholders

- `https://gobanana-server.maherfayad55.workers.dev` stands in for the real domain in `.mcp.json`, `.claude-plugin/plugin.json` and the eval mocks. Replace them all together once the domain is chosen.
- The plugin id is `gobanana`, the skills are `gobanana-*` and the `.mcp.json` server key is `gobanana`. MCP tool names are unchanged.
- `assets/icon.png` is a placeholder icon.

## Contributing

Contributor notes for Claude Code live in `.claude/CLAUDE.md`, not at the root, because a root `CLAUDE.md` is not loaded for plugin users and fails strict validation. Decisions are logged in `DECISIONS.md`.

## License

MIT. See [LICENSE](LICENSE).
