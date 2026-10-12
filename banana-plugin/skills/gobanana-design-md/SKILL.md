---
name: gobanana-design-md
description: Turn one kept GoBanana direction into a scoped DESIGN.md for the page or two it is for (design/explorations/<slug>/DESIGN.md), write it to disk and lint it until it passes. It inherits the project's own design system and never replaces the project's DESIGN.md unless the user asks for scope "system". Use when the user mentions "DESIGN.md", "design spec for this page", "design file for my agent", "write the direction down", "turn this board into a design spec", or "lint my DESIGN.md". Runs get_canvas (summary first), reconcile_direction and export_kit (design_md, optionally direction_md) from the GoBanana MCP server, then npx @google/design.md lint. For the full hand-off pack (build prompt, Cursor rules, Copilot, AGENTS.md section) use gobanana-handoff; for tokens use gobanana-asset-kit.
---

# GoBanana DESIGN.md

Export a kept direction as a DESIGN.md (Google Labs DESIGN.md format, alpha) scoped to its pages, save it in the user's project, and make sure it lints clean.

## Ground rules

- **Page scope by default.** A GoBanana direction is one wild idea for a page or two, not the product's design system. The default export (`scope: "page"`) applies only to the named pages, inherits the project's own design system, and writes its tokens as overrides. It goes to `design/explorations/<slug>/DESIGN.md`. Never write to or replace the project's own `DESIGN.md` unless the user asks for scope `system` in so many words ("make this our design system", "replace our DESIGN.md").
- **The server returns text; you write the file** at the returned `path`. Never ask the user to copy and paste.
- **Ship vs explore.** Only colors tagged `ship` go in the front matter (WCAG 2.2: SC 1.4.3 at 4.5:1 for text, SC 1.4.11 at 3:1 for UI parts). `explore` colors stay in prose, marked "concept only". Never move an `explore` color into the front matter to fix a lint error.
- **Sources stay linked.** Keep any Sources list. Never copy reference images into the repo.
- Plain words, no em dashes.

## Steps

1. **Find the canvas and the direction.** Use the `canvasId` from this conversation, or ask. Call `get_canvas` with `summary: true` (ids, titles, roles, notes and directionIds only); read the full view only if you need a spec or source links. Pick the kept direction the user means (`directionId`). If several are kept and the user did not say, ask which one. Leaving out `directionId` with several kept exports one folder per direction, never merged: then build and lint one folder at a time.
2. **Find the pages.** Use the direction's `pages`, or the routes the user names (`app/pricing/page.tsx`, `/launch`, `app/onboarding/**`). Look at the project's routes if it helps. Pass them as `pages`.
3. **Reconcile the direction with its board.** Call `reconcile_direction` with `canvasId` and `directionId`. It reads the colors of the direction's placed images (great ratings count more), saves the palette with WCAG checks and rewrites the spec's color line, so DESIGN.md matches what is on the board. Tell the user about every conflict it lists (the old spec next to what the board shows). `export_kit` also reconciles a direction that changed since its last run, but calling it yourself lets you show the conflicts first. With no images yet, run `extract_palette` (gobanana-palette) instead.
4. **Export.** Call `export_kit` with `canvasId`, `directionId`, `pages`, `scope: "page"` and `formats: ["design_md"]`. Add `"direction_md"` if the user wants the full visual spec too. Both are on the Free plan.
5. **Write the file** at the returned `path` (for example `design/explorations/frosted-sleeve/DESIGN.md`). Create the folders.
   - **The project already has a root `DESIGN.md`:** leave it alone. Tell the user in one line that the scoped file sits next to the project's system and inherits it.
   - **A file already exists at the scoped path** (an earlier export): do not overwrite it silently. Show what would change and ask. If they want both, save the new one with a `.banana.md` suffix (`DESIGN.banana.md`) in the same folder.
6. **Lint.** Run on the written path:

   ```bash
   npx --yes @google/design.md@0.4.0 lint design/explorations/<slug>/DESIGN.md
   ```

   The output is JSON with `findings` and a `summary` of `errors`, `warnings` and `infos`. The exit code can be 0 even with warnings, so read the summary.
7. **Fix and re-run.** Fix every error and every warning you can, then lint again. Stop after 3 rounds and show what is left. Common fixes:
   - `broken-ref`: a component uses a key outside `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`, or points at a token that does not exist. Remove the key or point at a real token.
   - `section-order`: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts. Reorder; do not delete content. Keep the scope lines in Overview.
   - `missing-primary`, `missing-typography`: add the token from a `ship` swatch or the export's font pairing. If none passes contrast, run `reconcile_direction` and export again, or tell the user instead of inventing one.
   - `contrast-ratio`: pick another `ship` color for that component, or say which pair fails and by how much.
   - `unknown-key`, `orphaned-tokens`: remove the stray key, or use the token in a component.
8. **Report** in a few lines: where the file is, the scope in one line ("Applies only to /pricing; inherits your design system, does not change it."), lint status, how many colors are `ship` vs `explore`, and the named fonts (Latin and Arabic display and body). When the project has its own root `DESIGN.md`, say so in those words first: "Your own DESIGN.md is left as it is. The new file at design/explorations/<slug>/DESIGN.md applies only to <pages> and inherits your design system."
9. **Offer next steps:** the full hand-off pack for the user's coding tools (gobanana-handoff), or build the page and grade it (gobanana-critique).

## Scope "system" (only when asked)

If the user explicitly wants the direction to become the product's design system, call `export_kit` with `scope: "system"`. The returned `path` is the root `DESIGN.md`. If one exists, do not overwrite it silently: show what would change and ask; if they want both, save as `DESIGN.banana.md`. Say in one line that this changes the whole product, not one page.

## When things go wrong

- **Quota or plan message:** show it as is, with its upgrade link, once. Do not retry or loop.
- **`npx` cannot run** (no Node, no network): say so, give the exact lint command, and check the file by eye against the section order and component keys above.
- **Inline canvas not shown:** give the canvas web link.
- **Export is long:** export_kit inlines about 20k characters and lists the rest. Fetch each listed file with `export_kit` and the same arguments plus `file: "<path>"`.
- **Tool error or timeout:** retry once at most, then tell the user in one line.
- **GoBanana tools missing:** ask the user to enable the GoBanana connector (or run `/mcp` in Claude Code and log in).
