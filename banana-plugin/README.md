# GoBanana

**Mobbin shows what works. GoBanana shows what's next.**

GoBanana is a Claude plugin for wild design exploration. Ask your agent to "go wild" on a screen, and GoBanana bends the brief into unexpected directions, pulls linked references from Pinterest, Dribbble, Behance and Awwwards into a moodboard canvas, extracts a palette with WCAG checks, and exports a DESIGN.md, an AGENTS.md, design tokens and a FigJam board.

The plugin connects your agent to the GoBanana MCP server and adds 6 skills that tell the agent which tools to call, in which order, and how to present the results.

> Status: v0.1.0, pre-launch. The domain is not chosen yet, so every URL in this repo uses the placeholder `banana.example`. See [Placeholders](#placeholders).

## Install

### Claude Code

From the marketplace repo that lists GoBanana (owner and repo are set at launch):

```text
/plugin install banana --marketplace <owner>/<repo>
```

Or load this folder directly while developing:

```bash
claude --plugin-dir ./banana-plugin
```

Then run `/mcp`, pick `plugin:banana:banana`, and log in. GoBanana uses OAuth, so there is no API key to paste.

### claude.ai and Cowork

Add the plugin from your organization's plugin settings or from Anthropic's directory once it is listed. The GoBanana server shows up as a connector; connect it and log in.

## What it does

| Skill | Say something like | What happens |
| --- | --- | --- |
| `banana-explore` | "go wild on our checkout", "push this design", "crazy ideas for a coffee site" | Shapes your ask into a brief, opens a canvas, bends it into 8 ideas, drops the ones that cannot become UI for your screen (`rate_directions`), searches the shortlist UI first into the tray, audits the results (`rate_references`, re-searching a weak lane with better words), then shows only the kept ideas |
| `banana-moodboard` | "make a moodboard", "arrange this", "put it in FigJam" | Sections per direction, short notes, a clean layout; optionally a FigJam board through the Figma MCP, or an HTML board |
| `banana-palette` | "palette", "colors from these" | Extracts colors with roles and tags each pair `ship` or `explore` by WCAG 2.2 contrast |
| `banana-design-md` | "DESIGN.md", "design system file" | Exports DESIGN.md, writes it, runs `npx @google/design.md lint`, fixes what it flags |
| `banana-agents-md` | "AGENTS.md", "rules for coding agents" | Writes an AGENTS.md that points coding agents at DESIGN.md |
| `banana-asset-kit` | "asset kit", "starter kit" | Tokens, Tailwind theme, safe CSS gradients, one open-licence font pairing and a Lucide or Phosphor pick, in numbered files |

### Wildness

| Level | Label | |
| --- | --- | --- |
| 1 | Fresh | Same layout, new flavour |
| 2 | Bold | One strong move |
| 3 | Weird | Two moves combined (default) |
| 4 | Wild | Two or three moves |
| 5 | Bananas | Three moves, usability ignored on purpose |

### MCP tools

`bend_brief`, `search_references`, `rate_references`, `rate_directions`, `extract_palette`, `open_canvas`, `add_to_canvas`, `arrange_canvas`, `get_canvas`, `export_kit`. The server does no AI work: bend moves are templates and word lists, and any thinking happens in your own agent. The server returns text; your agent writes the files.

If your client cannot show the canvas inline, every skill gives you the web link to open it full screen.

## Hard rules on images and sources

- **GoBanana never downloads, stores or re-hosts reference images.** It keeps URLs and metadata only. Images load in your browser from their source.
- **Every reference shows its source link**: on the canvas, in share links, in every export, and in every skill reply.
- **Never copy reference images into your repo.** The skills will not do it, and the AGENTS.md they write tells coding agents not to either. Reference images belong to their owners.
- **No scraping.** References come from web search results only.
- Palette extraction reads thumbnails in memory on the server to compute colors, then drops them.

## Plans

Free covers `bend_brief` (unlimited), 30 searches a month, 3 canvases, and the `design_md` and `brief` exports. Pro unlocks the other exports (AGENTS.md, tokens, Tailwind, FigJam, HTML board) and higher limits. When you hit a limit, the skills show the plain upgrade message once and stop; they never retry in a loop.

## Evals

`evals/` holds 27 test briefs in the format `claude plugin eval` reads: one folder per case with a `prompt.md` and `graders/*.md`, plus `case.yaml` and a `fixture.sh` where a case needs files in the workspace. `evals/mocks/banana/` answers the GoBanana tools with fixed replies, so runs never touch the real server. Graders check that the right skill fired, the tools ran in a sensible order, source links and the canvas link appear, and files were written.

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

Results go to `evals/results/`, which is git-ignored. Skill evals are tracked, not blocking (spec section 13).

## Validate

```bash
claude plugin validate --strict ./banana-plugin
```

## Placeholders

- `https://banana.example` stands in for the real domain in `.mcp.json`, `.claude-plugin/plugin.json` (homepage, documentation, support, privacy and terms links) and the eval mocks. Replace them all together once the domain is chosen.
- The product is called "GoBanana". The plugin id (`banana`), the skill names (`banana-*`), the MCP tool names and the `.mcp.json` server key stay `banana`, so existing installs keep working.
- `assets/icon.png` is a placeholder icon.

## Contributing

Contributor notes for Claude Code live in `.claude/CLAUDE.md`, not at the root, because a root `CLAUDE.md` is not loaded for plugin users and fails strict validation. Spec deviations are logged in `DECISIONS.md`.

## License

MIT. See [LICENSE](LICENSE).
