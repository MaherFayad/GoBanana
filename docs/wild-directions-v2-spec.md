# Wild directions v2: spec

Owner approved on 2026-10-12: fix all five findings from the live MCP test and build every product idea.
Branch: `feat/wild-directions-v2` (from `site/desktop-redesign`).

## Live test findings this fixes

1. **Results are generic.** Direction searches return the same generic Dribbble shots for every direction (bojagi direction: 0 of 12 on idea; synthwave: 1 of 12). The same studios repeat across directions. Awwwards returned 0 Awwwards results. A 2018 "UI Kit for Adobe XD" passed the template filter.
2. **No visual direction.** A direction is title + twist + query. No type, color, layout, imagery, motion, texture, icons, density. Moods are random ("acid bright" meditation). Titles read "B2b analytics", "Ai note-taking". With no taste given, the owner's personal default taste (glassmorphism, dark mode) is forced on every user.
3. **Thin harness docs.** AGENTS.md is about 20 lines; no Cursor rules, Copilot instructions, build prompt or review checklist.
4. **Wrong scope.** DESIGN.md and AGENTS.md say "use only these tokens for any UI": one wild exploration becomes the product design system. GoBanana is for one crazy idea over a page or two, not the product's main direction. Unrated directions are listed as "tried and not kept".
5. **No platform.** iPhone onboarding gets "a strict 12 column grid"; iPhone searches return web dashboards; exports give a phone 48px display and a 12 column grid.

## Product ideas to build

- **The one wild page.** A picker of where weirdness pays off per platform (launch page, campaign, onboarding, empty state, 404, paywall, pricing, year in review, splash, settings easter egg...). `bend_brief` takes `pages` and returns `wildSpots` when none are given.
- **Art direction zone.** Each direction gets the wild idea back as images (raw ingredient on Pinterest pins and Behance galleries), kept apart from the UI references: own lane `art`, own zone on the board, own tray tab. Shop, product and fashion listings are dropped. The old failure (round 11: 60% junk mixed into a UI board) came from mixing; zones fix it.
- **Shipped vs next.** The skill pairs concepts with real shipped screens from the user's own Mobbin connector when it is connected (links in a board note, never images, never server side).
- **What to steal.** Every placed reference can carry a short note from the agent ("steal: the stamped date as a section divider").
- **Build then critique.** Exports give a REVIEW.md checklist from the direction spec; a skill builds the page, screenshots it and grades it.

## Hard rules (unchanged)

No AI on the server. Never download, store or re-host third party images (URLs only). Source link everywhere. No scraping (search results only; Mobbin stays on the agent side, links only). Takedown checks. WCAG 2.2 AA. Plain words, no em dashes. `APP_NAME` only in `lib/config.ts`.

## Shared contract

`banana-server/lib/direction-detail.ts` (do not change shapes without telling the lead):

- `Platform` = mobile | tablet | website | webapp | any.
- `VisualSpec`: typography, typeVoice, color, layout, imagery, motion, texture, iconography, density, signature, pattern, steal[], avoid[], styleWords[], whyItFits.
- `DirectionDetail`: platform, pages, spec, artQueries, twist, prompt, wildness, verdict. Saved as `directions.detail` (jsonb, nullable).
- `Zone` = ui | art, on `Reference`, `TrayReference`, `ImageItem`.

### Bend output (`lib/bend/types.ts` Direction and BendResult)

- `Direction` gains `platform: Platform`, `pages: string[]`, `spec: VisualSpec`, `artQueries: string[]` (1 to 3 raw ingredient queries, no UI words). Existing fields and ids stay stable (ids never change for the same input).
- `BendResult` gains `platform: Platform`, `pages: string[]`, `wildSpots: { page: string; why: string }[]` (empty when `pages` was given).
- `BendInput` gains `platform?: Platform` (override; else `detectPlatform(brief)`) and `pages?: string[]` (up to 3, each up to 60 chars).
- `lib/platform.ts` exports `detectPlatform(brief): Platform` and `PLATFORM_PROFILES: Record<Platform, PlatformProfile>`.
- `laneTexts(brief, idea, taste, key, opts?: { platform?: Platform; styleWords?: readonly string[] })`: the optional `opts` is the only signature change.

### Search (`search_references`)

- New lane `art` (zone "art"): the direction's `artQueries` on Pinterest pins and Behance galleries. No UI title gate; a junk gate instead (shops, product listings, fashion, prices, Etsy or Amazon, logos sheets, stock). Result quota: about 1/3 of `count` for direction searches (at least 3), the rest UI. New input `zone?: "ui" | "art" | "both"` (default "both" for direction searches, "ui" for plain queries).
- Platform aware UI lanes: mobile uses app ui wording and drops web or dashboard titles; website uses landing page or website wording (Awwwards, Dribbble, plus new website gallery sources if they work live); webapp uses dashboard or web app wording and drops mobile only titles.
- No taste given: taste lane uses the direction's `spec.styleWords`; never the owner's DEFAULT_TASTE as a forced style. If there is nothing, the taste lane's quota goes to the other lanes.
- Studio cap: at most 2 results per creator per search. Recency: prefer newer item ids on Dribbble and Behance. Cross direction dedupe: skip references already in the canvas tray for another direction. Awwwards fixed (0 results today). Kit and template titles dropped ("UI Kit", "Template", "for Adobe XD", "Figma kit").
- Every result has `zone`.

### Canvas

- `directions.detail jsonb` column (migration 0004), saved by `bend_brief` (with `canvasId`), returned by `get_canvas`, `verdict` set by `rate_directions`.
- `zone` on tray references and image items. `add_to_canvas` reference items accept `note` (what to steal, up to 280 chars) and keep `zone`.
- Board layout: in a direction section, art items sit in a labelled "Art direction" row above the "UI references" grid (arrange_canvas and placement). Canvas UI: tray tabs "UI" and "Art direction", a small "Art" badge on art images, links in notes are clickable (rel noopener, source links kept).

### Exports (`export_kit`)

- Input gains `directionId?` (one kept direction; default all kept), `pages?` (route names or globs like `app/pricing/**`), `scope?: "page" | "system"` (default "page").
- Scope "page" (default): every file opens with a scope block: applies only to the named pages, inherits the project's own design system, does not change it. Tokens are written as overrides.
- New formats: `direction_md` (design/explorations/<slug>/DIRECTION.md, the full visual spec), `build_prompt` (BUILD-PROMPT.md, paste into Claude Code, Cursor, v0 or Lovable), `review` (REVIEW.md checklist for build then critique), `cursor_rules` (.cursor/rules/<slug>.mdc with globs), `copilot` (.github/instructions/<slug>.instructions.md with applyTo), `claude_md` (a CLAUDE.md section). `agents_md` rewritten to be scoped to the pages. Each file returns a suggested `path`.
- Platform defaults: mobile (4 columns, 16px margins, 44pt targets, display 34px, tab bar and bottom sheet), tablet, website (12 columns, fluid type with clamp), webapp (12 columns or sidebar shell, dense 8px rhythm, tables, keyboard).
- Font pairing picked from `spec.typeVoice`, not always Space Grotesk and Inter.
- Fix: unrated directions read "not rated", not "not kept".
- Plans: Free keeps design_md and brief, and gains direction_md and build_prompt (the scoped replacements). Everything else Pro. (Owner to confirm.)

## File ownership (parallel agents, one working tree)

| Agent | Owns |
| --- | --- |
| bend | `lib/platform.ts`, `lib/bend/**` except `queries.ts`, `lib/mcp/tools/bend_brief.ts`, bend tests |
| search | `lib/bend/queries.ts`, `lib/sources/**`, `lib/learning/**`, `lib/mcp/tools/search_references.ts`, `rate_references.ts`, search tests |
| canvas | `db/**`, `lib/db/**`, `lib/canvas/**`, `canvas/**`, `ui/**`, `lib/layout/**`, tools `add_to_canvas`, `arrange_canvas`, `get_canvas`, `rate_directions`, `new_canvas`, `open_canvas`, canvas and db tests |
| exports | `lib/export/**`, `lib/kit/**`, `lib/mcp/tools/export_kit.ts`, `lib/quota.ts` export format list, export tests |
| plugin | `banana-plugin/**` |

Nobody edits `DECISIONS.md`, `CLAUDE.md` or another agent's files: report deviations and decisions in the final message; the lead merges them. Do not commit; the lead commits.
