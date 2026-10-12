# GoBanana plugin

Claude plugin for the GoBanana MCP server: 9 skills that drive the server's 16 tools for one wild page or two: exploration, moodboards, Frankenstein pages, scoped exports, hand-off and critique. Design spec for the current behavior: `docs/wild-directions-v2-spec.md` in the monorepo. Full spec: `docs/banana-build-spec.md` in the GoBanana monorepo (sections 1, 2, 6, 10, 13 and 14).

This file lives in `.claude/` on purpose. A `CLAUDE.md` at the plugin root is not loaded for plugin users, and `claude plugin validate --strict` fails on it.

## Hard rules
- The server does no AI work. Skills tell the user's own agent what to think and which tools to call.
- Never download, save or copy third-party reference images. Not in skills, evals, fixtures or docs. URLs and metadata only. A Frankenstein part is a crop rectangle the browser applies, never an image file.
- User-facing words say "Frankenstein it" and "Frankenstein pages"; the tool names (`cut_parts`, `frankenstein_page`, `remix_frankenstein`, `update_frankenstein`, `stitch_md`) stay as they are.
- Every reference shows its source link, in every skill reply and every export.
- No scraping instructions of any kind. References come only from `search_references`.
- The server returns text; the agent writes files to disk.
- Page scope by default: exports apply only to the named pages and never replace the project's DESIGN.md, AGENTS.md or CLAUDE.md (merge a marked section).
- Two zones: art direction and UI references are never mixed on a board.
- Mobbin is used only through the user's own connector. Its screens may go on the board as `add_to_canvas` `screen` items (hotlinked image_url, linked to mobbin_url) and be Frankenstein parts when wild or fitting; never downloaded, never passed to `search_references`.
- Never delete a canvas without the user's explicit yes.
- Ship vs explore: only `ship` colors (WCAG 2.2 SC 1.4.3 at 4.5:1 for text, SC 1.4.11 at 3:1 for UI parts) become tokens.
- Quota and plan messages are relayed once, as is. Never retry in a loop.
- Writing: plain words, no em dashes. Check with `grep -rn $'\xe2\x80\x94' .` before committing.

## Plugin rules
- Name is `gobanana`: kebab-case, never starting with `claude-` or `anthropic-`.
- No top-level `bin/` folder (claude.ai and Cowork refuse to install plugins with one).
- No `CLAUDE.md` at the plugin root (see above).
- Skill frontmatter: only `name` and `description`, so skills also load on claude.ai and Cowork. The description is what triggers the skill: lead with what it does, then concrete trigger phrases. Keep it under 1,536 characters.
- `.mcp.json` points at the remote server. It points at `https://gobanana-server.maherfayad55.workers.dev` until a custom domain is chosen; change it in `.mcp.json`, `.claude-plugin/plugin.json`, the skills and `evals/mocks/` together.
- Keep tool names and inputs in skills in sync with spec section 6 and `evals/mocks/gobanana/_tools.json`.

## Commands
- validate: `claude plugin validate --strict .`
- load locally: `claude --plugin-dir .`
- evals (free load check): `claude plugin eval . --runs 1 --ablation none --max-cost-usd 0 --no-publish`
- evals (full): `claude plugin eval . --allow-tools Write Edit "Bash(npx *)" "WebFetch(domain:registry.npmjs.org)" --scaffold --no-publish`

## Working style
- Run `claude plugin validate --strict .` after every change; it must pass (spec section 13).
- When a skill changes, run its eval cases (`--case '<glob>'`) and compare scores before and after.
- Record any deviation from the spec in `DECISIONS.md` with the reason.
- Ask before changing hard rules, pricing or plan limits.
