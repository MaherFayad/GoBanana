---
title: Install the plugin in Claude
description: Add the GoBanana plugin to Claude Code, claude.ai or Cowork.
---

The GoBanana plugin connects Claude to the GoBanana MCP server and adds 6 skills. The skills tell Claude which tools to call, in which order, and how to show the results.

:::note[Beta]
The plugin is at version 0.1.0. The marketplace that lists it is set at launch. Until then, you can connect the server directly: see [Connect the MCP server](/docs/start/connect/).
:::

## Claude Code

Install from the marketplace that lists GoBanana:

```text
/plugin install gobanana --marketplace <owner>/<repo>
```

Or load the plugin folder directly while developing:

```bash
claude --plugin-dir ./banana-plugin
```

Then sign in:

1. Run `/mcp`.
2. Pick the GoBanana server.
3. Log in in the browser.

GoBanana uses OAuth, so there is no API key to paste.

:::caution[Renamed server]
The plugin's server key was renamed from `banana` to `gobanana`. If you installed an older copy, reinstall the plugin.
:::

## claude.ai and Cowork

Add the plugin from your organization's plugin settings, or from Anthropic's directory once it is listed. The GoBanana server shows up as a connector. Connect it and log in.

## The skills

<div class="gb-table">

| Skill | Say something like | What happens |
| --- | --- | --- |
| `gobanana-explore` | "go wild on our checkout", "push this design" | Shapes a brief, opens a canvas, bends it into ideas, drops the ones with no UI path, searches references for the rest and shows the kept ideas. |
| `gobanana-moodboard` | "make a moodboard", "arrange this", "put it in FigJam" | Sections per direction, short notes and a clean layout. Optionally a FigJam board through the Figma MCP, or an HTML board. |
| `gobanana-palette` | "palette", "colors from these" | Extracts colors with roles and tags each pair `ship` or `explore` by WCAG 2.2 contrast. |
| `gobanana-design-md` | "DESIGN.md", "design system file" | Exports DESIGN.md, writes it, runs the lint and fixes what it flags. |
| `gobanana-agents-md` | "AGENTS.md", "rules for coding agents" | Writes an AGENTS.md that points coding agents at DESIGN.md. |
| `gobanana-asset-kit` | "asset kit", "starter kit" | Tokens, a Tailwind theme, safe CSS gradients, one open-licence font pairing and a Lucide or Phosphor pick, in numbered files. |

</div>

If your client cannot show the canvas inline, every skill gives you the web link to open it full screen.

## Check the connection

Ask Claude to check the GoBanana connection. It calls [`ping`](/docs/reference/tools/ping/) and replies with the account you are signed in with.

## Next

[Your first board](/docs/start/first-board/)
