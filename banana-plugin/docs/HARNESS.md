# The harness pack

The harness pack is the set of files `gobanana-handoff` writes so a coding tool can build one wild page from a kept direction. Every file is scoped: it applies only to the named pages, inherits the project's design system, and does not change it.

`<slug>` is the direction's short name, for example `frosted-sleeve`.

## The files

| File | Path | What it holds | Plan |
| --- | --- | --- | --- |
| DIRECTION.md | `design/explorations/<slug>/DIRECTION.md` | The full visual spec: pattern, signature, type, color, layout, imagery, motion, texture, icons, density, what to steal, what to avoid, why it fits, and the source links | Free |
| BUILD-PROMPT.md | `design/explorations/<slug>/BUILD-PROMPT.md` | One prompt to paste into any tool: pages, platform, spec, constraints, done when | Free |
| DESIGN.md | `design/explorations/<slug>/DESIGN.md` | Google Labs DESIGN.md format. Tokens written as overrides for the pages; lints with `@google/design.md` | Free |
| REVIEW.md | `design/explorations/<slug>/REVIEW.md` | Checklist for build then critique (`gobanana-critique`) | Pro |
| FRANKENSTEIN.md | `design/explorations/<slug>/FRANKENSTEIN.md` | Frankenstein pages from `gobanana-frankenstein`: a skeleton per page (role, steal note, source link per slot) and build guidance: take the structure, not the pixels, and unify to one theme | Free |
| frankenstein-wireframe.html | `design/explorations/<slug>/frankenstein-wireframe.html` | A standalone low fi wireframe: grey boxes per slot with role labels and notes, a sources list, no reference images | Pro |
| Cursor rule | `.cursor/rules/gobanana-<slug>.mdc` | The rules, with `globs` set to the pages | Pro |
| Copilot instructions | `.github/instructions/gobanana-<slug>.instructions.md` | The rules, with `applyTo` set to the pages | Pro |
| AGENTS.md section | `AGENTS.md`, between `<!-- gobanana:<slug> -->` markers | Which pages, where the files are, ship vs explore | Pro |
| CLAUDE.md section | `CLAUDE.md`, between the same markers | Same, for Claude Code | Pro |

When the canvas has Frankenstein pages, BUILD-PROMPT.md lists them, so a coding tool can build from a skeleton. Open frankenstein-wireframe.html in a browser to see the structure; it loads no reference images.

Every file opens with the same scope block:

> Applies only to: /pricing, /launch. Inherits the project's design system. Does not change it.

Ask for `scope: "system"` only when the direction should become the product's design system. Then DESIGN.md goes to the project root and the rules are global.

## How each tool picks them up

| Tool | What it reads | What to do |
| --- | --- | --- |
| Claude Code | `CLAUDE.md` at the root and in folders it works in; `@path` imports | The CLAUDE.md section points to DIRECTION.md. Or paste BUILD-PROMPT.md |
| Cursor | `.cursor/rules/*.mdc`; a rule with `globs` attaches when you edit matching files | Nothing. Edit a page file and the rule is in context |
| GitHub Copilot | `.github/instructions/*.instructions.md` with `applyTo` globs; `.github/copilot-instructions.md` for global rules | Nothing. GoBanana never edits the global file |
| Codex and other AGENTS.md readers | `AGENTS.md` at the root and in nested folders; the closest one wins | The AGENTS.md section points to DIRECTION.md |
| v0 | Your prompt, plus project instructions if you set them | Paste BUILD-PROMPT.md into a new chat |
| Lovable | Your prompt, plus project knowledge if you set it | Paste BUILD-PROMPT.md into the chat, or into project knowledge |

## Merging rules

- `AGENTS.md` and `CLAUDE.md` are never overwritten. GoBanana adds or updates only its own section between `<!-- gobanana:<slug> -->` and `<!-- /gobanana:<slug> -->`.
- `.github/copilot-instructions.md`, the project's root `DESIGN.md`, tokens, theme and global CSS are never touched in page scope.
- Files under `design/explorations/<slug>/` and the per slug Cursor and Copilot files belong to GoBanana. On a second export the agent shows the diff and asks before replacing them.
- No reference images go in the repo. Files link to sources. Frankenstein parts are crops the browser applies, never image files.

## Examples

- [AGENTS.example.md](AGENTS.example.md): an AGENTS.md for a project using GoBanana.
- [CLAUDE.example.md](CLAUDE.example.md): the CLAUDE.md section.
