# Decisions

Deviations from `banana-build-spec.md` for the plugin, with the reason. Checked against Claude Code 2.1.296 and the plugin docs at code.claude.com on 2026-10-11.

## 2026-10-11: CLAUDE.md lives in `.claude/`, not the plugin root

Spec section 14 puts `CLAUDE.md` at the root of `banana-plugin/`. A root `CLAUDE.md` is never loaded for plugin users, and `claude plugin validate --strict` fails on it ("CLAUDE.md at the plugin root is not loaded as project context"). Claude Code also reads `.claude/CLAUDE.md` as project memory, so contributor notes moved there.

## 2026-10-11: plugin.json fields

All fields the spec lists are valid: `name`, `displayName`, `version`, `description`, `author`, `homepage`, `license`, `privacyPolicyUrl`, `termsOfServiceUrl`, `icon`. The last three are directory listing fields that Claude Code ignores at load time; they need Claude Code 2.1.281 or later to pass `--strict`, and `icon` is a path to an image inside the plugin (`./assets/icon.png`), not a URL. Added `documentationUrl`, `supportUrl` and `keywords` for the directory listing. `author` is an object (`name`, optional `url`).

## 2026-10-11: skill frontmatter is `name` and `description` only

Claude Code accepts more keys (`when_to_use`, `allowed-tools` and others), but claude.ai and Cowork reject unknown keys. Trigger phrases go in `description`.

## 2026-10-11: evals use the `claude plugin eval` case format

20 cases in `evals/<case>/prompt.md` + `graders/*.md`, with suite-wide MCP mocks in `evals/mocks/gobanana/`. `_tools.json` mirrors spec section 6 so mocked tools carry real descriptions and input schemas.

## 2026-10-11: font list follows the server

`gobanana-asset-kit` lists the pairings from `banana-server/lib/kit/fonts.json` (all OFL-1.1). Keep the two in sync.

## 2026-10-11: DESIGN.md lint pinned to 0.4.0

Skills run `npx --yes @google/design.md@0.4.0 lint DESIGN.md`, the version the server pins.

## 2026-10-11: audit loop in gobanana-explore

After every `search_references`, the agent judges each result (title, site, URL, and the image when it can see it) and calls `rate_references`: `bad` for off topic, shop or stock, DIY or decor in a UI lane, cluttered or duplicate results; `great` for about the top 10 to 20%. If more than 40% of a lane is bad it re-searches that lane once with `directionId`, `lane` and words that describe the visual, at most 2 retries per lane, and tells the user in one line what it dropped. The server does no AI work, so this is where judgment happens; ratings make later searches better (server DECISIONS.md, Learning rows). Eval cases 21 to 24 cover the audit, a lane retry, clean results with no retry, and the retry cap. The search mock now tags each result `[id, lane]`, as the server text does.


## 2026-10-11: idea triage in gobanana-explore

The owner found about 60% of a live "Flight checkout screen for a GCC travel OTA" board unrelated to flight booking (Sadu weaving, seed packets, suzani jackets, tassels, a car air freshener). The agent now opens the canvas first, bends 8 ideas, and keeps an idea only if (a) its salvage maps to a concrete UI pattern for the actual screen, (b) after search and audit it has at least 3 on-topic usable UI or bridge references (inspiration alone does not count), and (c) it is not a near duplicate of a kept idea. (a) and (c) run before any search, so only a shortlist of 3 (at most 4, or the number the user asked for) costs searches; existing evals that cap searches at 3 still hold. It calls `rate_directions` with `drop` plus reasons for every rejected idea and `keep` for the shown ones, so the canvas never shows dropped ideas, presents only the kept ones and says in one line how many were dropped and why. Placement is UI first, at most 2 inspiration images per section; `mix: "balanced"` or `"wild"` only when the user asks for wilder references. Evals 25 (triage), 26 (UI-first placement) and 27 (wild mix) cover it.

## 2026-10-11: product name in prose is GoBanana

User-facing prose (skill text, README, plugin.json `displayName` and `description`, eval prompts, graders and mock text) says "GoBanana". Ids stay `banana`: the plugin `name`, the `banana-*` skill folders and names, the MCP tool names, the `evals/mocks/gobanana` folder and the `.mcp.json` server key, so existing installs keep working. The wildness label "Bananas" is unchanged.

## Plugin id renamed to gobanana (2026-10-11)

The owner approved breaking the old install. Plugin `name`, the skill folders and names (`gobanana-*`), the `.mcp.json` server key and `evals/mocks/gobanana` now say `gobanana`; graders use `mcp__plugin_gobanana_gobanana__*`. `.mcp.json` and plugin.json URLs point at the live Worker `gobanana-server.maherfayad55.workers.dev` (renamed from `banana-server`). MCP tool names and the `DESIGN.banana.md` fallback filename are unchanged. This supersedes the entry above that kept ids as `banana`.

## 2026-10-11: search results are UI only

Owner: "100% of all search results are UI images, and component images, no matter what I ask." The server removed the inspiration lane (no raw idea is ever searched), gates every result on a UI title, adds component lanes from the brief and forces plain queries into UI forms (server DECISIONS.md, same date; docs/search-quality-experiment.md rounds 11a and 11b). `mix` is accepted and ignored. The skills no longer mention mix or inspiration: every placed reference is UI, and a direction's wild idea goes on the board as a note (twist and salvage), never as an image. When the user asks for raw inspiration images, the agent says in one line that search is UI only and puts the wildness into the directions and notes. Evals 21, 22 and 24 now audit and retry UI lanes (22 and 24 retry the bridge lane), 26 checks UI-only placement with the idea in a note, and 27 checks the UI-only explanation (no `mix: "wild"`). This supersedes the placement and mix parts of the idea triage entry above.

## 2026-10-11: build the board hidden, show it finished, 6 to 8 per direction

The owner saw the inline canvas appear empty and fill in (or not refresh) while the agent worked, and found a banking board too thin (1 or 2 references per section, one a furniture shop). The explore flow now calls `new_canvas` (creates the board, no inline view), bends, searches with `count: 12`, places 6 to 8 usable UI references per kept direction with `add_to_canvas`, arranges, and only then calls `open_canvas` with the `canvasId`, so the user sees the board once, finished. Triage test (b) needs 6 usable references (retry the weakest lane first). Bridge results that are apps for another product are rated `bad` with `off_topic` and never placed. Eval 01 checks `new_canvas` before the first search and `add_to_canvas` before `open_canvas`.

## 2026-10-11: extend boards instead of starting new ones

The owner wants a request to expand or edit an existing board, not create one each time. `get_canvas` without a `canvasId` now lists the user's 10 most recent canvases with their briefs. The explore skill uses a canvas from the conversation first; otherwise it lists recent canvases and reuses one that is the same product or project (new directions get new sections, nothing is removed), reads it to avoid repeats, and says which board it is adding to. It calls `new_canvas` only when nothing matches or the user asks for a new board. The moodboard skill does the same.

## 2026-10-12: wild directions v2 in the plugin

Spec: `docs/wild-directions-v2-spec.md` in the monorepo. These rows supersede "search results are UI only" (2026-10-11) and the placement parts of the idea triage row.

| Decision | Reason |
| --- | --- |
| Positioning in every skill and the README: one crazy idea over a page or two, not the product's main direction. | Live test finding 4: one exploration was turning into the product's design system. |
| gobanana-explore pins `platform` (from the brief, or one question) and always passes it to `bend_brief`, with 1 to 3 `pages`. | Finding 5: phone briefs got web dashboards and 12 column grids. The agent's read beats keyword detection. |
| A whole-product ask runs `bend_brief` without `pages` and without `canvasId` to get `wildSpots`, then asks "Where should the weirdness go?". A fallback list is inlined in the skill. | Bending the whole product is off positioning; the first bend is free and saves nothing. Skills cannot rely on reading `docs/` at runtime. |
| Two zones replace "UI only": 2 to 4 art items in the Art direction row, 6 to 8 UI items in the UI grid, never mixed, art never counts toward triage test (b). | The old junk came from mixing (round 11); zones keep the idea as images without polluting the UI grid. |
| Every placed reference gets a `note` starting with `steal:`. | Owner idea "what to steal"; makes each tile actionable. |
| Kept directions are shown as compact spec cards (title, move, platform, page, pattern, signature, type, color, layout, motion, why it fits, then art and UI highlights with links). | Finding 2: a one-line direction gave no visual direction. |
| Art audit uses the same `rate_references` flow; art junk is shops, listings, prices, fashion, Etsy or Amazon, logo sheets, stock, off idea. `not_ui` is never used on art. | Same learning loop for both zones. |
| No default taste: without taste each direction's `spec.styleWords` are used. | Finding 2: the owner's taste was forced on every user. |
| Shipped vs next: only through the user's own Mobbin connector (tools matching `*Mobbin*__search_screens`, `search_flows`, `search_sections`), once per page, 3 to 6 screens, one board note with links, never images, never sent to GoBanana. Silent skip when not connected. | Hard rules: no scraping, no re-hosting, Mobbin stays agent side. |
| Exports default to `scope: "page"` and write at the returned `path` under `design/explorations/<slug>/`. The project's own DESIGN.md, tokens, theme and global rules are never touched unless the user asks for `system` in so many words. | Finding 4. |
| AGENTS.md and CLAUDE.md are merged between `<!-- gobanana:<slug> -->` and `<!-- /gobanana:<slug> -->` markers, never overwritten. | Safe re-export: replace only our own section. |
| New skill gobanana-handoff (harness pack) detects tools from repo signs (CLAUDE.md or .claude, .cursor, .github instructions, AGENTS.md, lovable-tagger) and always exports `direction_md`, `build_prompt`, `review`. On Free it writes DIRECTION.md and BUILD-PROMPT.md and relays the plan message once. | Finding 3: thin harness docs. Free keeps a scoped path to build. |
| New skill gobanana-critique: REVIEW.md from the repo or `export_kit` `review` (on Free, a checklist built from DIRECTION.md), screenshots at 390x844, 834x1194, 1440x900 by platform (website and any also 390x844), pass, fix or not checked with evidence, top 3 fixes, edits only inside the page scope. | Owner idea "build then critique". Screenshots are of the user's own page, never of references. |
| `delete_canvas` only after the user's explicit yes to a named board; skills never pick a board to delete. Offered at the canvas limit next to reusing a board. | Owner addition 2026-10-12. Deletion cannot be undone. |
| Source wording is generic ("UI galleries by platform, plus Pinterest, Dribbble, Behance, Awwwards"); README has a TODO for the final list. | The search agent's gallery list depends on live tests. |
| Per-case mock folders renamed from `mocks/banana` to `mocks/gobanana`. | Missed in the 2026-10-11 rename: per-case mocks must sit under the `.mcp.json` server key, so cases 08, 10, 11, 13 to 17, 20 to 22, 24 and 26 were silently using suite mocks. |
| Suite mocks `bend_brief` and `get_canvas` are now agent mocks. `bend_brief` reflects `platform`, `pages` and `wildSpots`; `get_canvas` answers both the list call (no `canvasId`) and the read call. Suite `export_kit` is Pro with paths; Free cases override it. | The old `get_canvas` mock required `canvasId`, which aborts any run where the skill lists canvases first. |
| Eval cases: 26 and 27 rewritten for two zones (renamed `26-two-zone-placement`, `27-raw-inspiration-art-zone`); 13 to 16 and 20 moved to scoped paths; new 28 to 39 (platform mobile, website, webapp; wild spot picker; Mobbin not connected; handoff; handoff on Free; critique; default page scope; canvas limit asks first; delete with explicit yes; Mobbin connected). | Coverage for every new rule. |
| Case 39 (Mobbin connected) mocks a non-plugin server under `mocks/mobbin/` and is tagged `needs-verify`. | The eval docs do not say whether a server outside `.mcp.json` can be mocked. Check with `--keep-temp`; if not, the case needs a stub plugin. `claude plugin eval` is early access and could not be run here. |
| Docs added: `docs/HARNESS.md`, `docs/AGENTS.example.md`, `docs/CLAUDE.example.md`, `docs/WHERE-WEIRDNESS-PAYS.md`. Examples use `.example.md` names. | A file named AGENTS.md or CLAUDE.md inside the plugin could be loaded as live instructions by agents working in this repo. |

## 2026-10-12: Frankenstein it in the plugin

Spec: `docs/stitch-spec.md` in the monorepo; contract `banana-server/lib/stitch/types.ts`.

| Decision | Reason |
| --- | --- |
| The feature is "Frankenstein it" (Frankenstein pages) in all user-facing words. The skill is `gobanana-frankenstein`; eval folders are `40-` to `45-frankenstein-*`. Tool names stay `cut_parts`, `frankenstein_page`, `remix_frankenstein`, `update_frankenstein`, and the skill tells the agent that a "stitch" in tool output is a Frankenstein page. | Owner naming decision, 2026-10-12. Tool ids are internal and owned by the server. |
| Export files are FRANKENSTEIN.md (format `stitch_md`, Free) and frankenstein-wireframe.html (format `wireframe_html`, Pro), under `design/explorations/<slug>/`. The skill writes each at the returned `path`. | Owner naming decision; same page-scoped folder as the rest of the harness pack. |
| The skill works like a designer: pick board, platform and one page type; look; cut 2 to 4 candidates per role from at least 4 sources, each with a role, a tight crop, a theme and a `steal:` note; stitch a recipe with 3 or 4 variants (or explicit rows when the user dictates parts); review rhythm, hierarchy, contrast jumps, seams and source spread; fix with `update_frankenstein` and `remix_frankenstein` with `lock`; at most two fix rounds. | Mirrors the designer workflow table in the spec. The server does no judging, so the agent does. |
| Crops come from what the agent saw or what the user said. When it cannot see the images it says so once, passes no `crop` (the server guesses and sets `guessedCrop`), uses `theme: "unknown"`, starts notes with `guessed:`, and flags guessed crops in the reply. | Never describe pixels you did not see. Eval agents cannot see images, so case 40 gives the positions in the prompt and case 42 checks the honest path. |
| Cuts come only from UI zone references (placed items or tray references), never art zone images or references rated `bad`, and only for the page's platform. | Art is mood, not page parts; same platform rule as explore. |
| A user who asks for cut images as files gets a one line no and FRANKENSTEIN.md, the wireframe and the links instead. | Hard rule: never download, save, crop or copy reference images. A part is a rectangle the browser applies. Case 45. |
| gobanana-explore and gobanana-moodboard offer Frankenstein it as a next step. README, `docs/HARNESS.md` and the export table list the two new files. | Discoverability. |
| `_tools.json` gains the four tools and the two formats with schemas written from the lead's brief before the server code landed (op fields for `update_frankenstein`: `slotId`, `rowId`, `partId`, `index`, `slots`, `widths`, `crop`, `mode`, `note`, `title`). Suite mocks: `cut_parts` and `frankenstein_page` are agent mocks with deterministic part ids (`pt-<item digits>-<role>`) so a stitch can be traced to its source; `get_canvas` gains a website board `cv_stitch`. | Keep evals runnable now; re-check `_tools.json` against `lib/mcp/tools` once the server tools exist. |
| 2026-10-12: Mobbin check comes first (step 0), the baseline search runs before the bend (step 6b) and shapes triage (drop ideas that only restyle the baseline), and each kept direction gets a `BUILD ON:` Mobbin link in its idea note. The server's MCP instructions carry the same flow, so connector-only agents (no plugin) do it too. Still links only. | Owner: use both GoBanana and Mobbin screens to get more solid ideas. |
| 2026-10-12, 0.1.2: Mobbin screens go on the board as images (owner decision; replaces "links only, never images, never sent to GoBanana" above). Per kept direction, 2 to 4 Mobbin screens that fit (its BUILD ON anchors, or a shipped screen already wild in its way) go in its UI grid as `add_to_canvas` `{ "type": "screen", imageUrl, sourceUrl, app, platform, note, directionId }`, counted in the 6 to 8 UI items, each with a `steal:` note; up to 3 may sit beside the "Shipped today" note. gobanana-frankenstein may cut them as parts when wild or fitting (a real pay bar under a wild hero), never the whole page. Eval 39 now expects screens placed as hotlinked images with Mobbin links; eval 32 (no connector, no mention) is unchanged. | Owner: Mobbin found through the user's own connector should be on the board and usable in Frankenstein pages. The server only hotlinks the URLs the agent passes (mobbin.com pages, mobbin.com images), never fetches or stores them; image links expire after about 30 days and then show a link card. |
| 2026-10-12, 0.1.3: New skill gobanana-build (stitchId + directionId): reconcile_direction, get_snapshot, palette and fonts, build row by row against the parts with an RTL mirror line per part and the Arabic copy rules (noun labels, no diacritics, Western digits, Latin IATA codes), a drift check per row, then add_to_canvas type build next to the page. gobanana-explore, gobanana-moodboard and gobanana-frankenstein each gain one line: look at the returned thumbnails before rating or noting. Mocks: get_snapshot added to `_tools.json` and `evals/mocks/gobanana/get_snapshot.md`. | Owner decision 2026-10-12: tool results now carry pass-through thumbnails and get_snapshot shows each Frankenstein part, so skills should build from what the agent sees, not from titles. reconcile_direction is added to the server by another change. |
| 2026-10-15: gobanana-explore relays the server's new shared monthly search budget message ("searches are paused until ...") once, as is, with no upgrade pitch. New eval 54-search-budget-paused. | Server P0-01 added a global Serper credit cap; upgrading does not lift it, so the skill must not suggest it. |
| 2026-10-15: The server runs the fidelity lane once per canvas and lists its results under "Shipped today" (P0-03). gobanana-explore (step 9 and 12) and gobanana-moodboard place them in one "Shipped today" section with no directionId, never in a direction and never counted in its 6 to 8 UI items; the Mobbin "Shipped today" note joins that section. The search mock follows the new output; new eval 55-shipped-today-section. | Directions stop repeating the same generic shots, and the shipped baseline still shows on the board once. |
| 2026-10-15: gobanana-explore says each result belongs to one direction: the server leaves out results another direction already has and may run one extra UI request itself when fewer than 6 UI are left (not one of the agent's lane retries). Never place one reference in two directions. Search mock: later direction searches never repeat another direction's results. | Server P0-04. |
| 2026-10-15, P0-10: gobanana-frankenstein looks first, then cuts: `cut_parts` with `look: { itemId }` returns the image up to 1200 px wide with its pixel size (server side pass-through, never stored), and the agent measures each crop as fractions. The line that called not seeing the image "the usual case" is gone; the guessed-crop path stays for a look that shows no image (host off the allowlist, uploads, clients that do not show tool images). `_tools.json` and `evals/mocks/gobanana/cut_parts.md` gain `look`, and `cuts` is no longer required. | Owner decision D4; guessed crops from 236 to 400 px thumbnails were the main Frankenstein quality bug. |
| 2026-10-15, P0-12: gobanana-frankenstein and gobanana-build ask the user to press "Show in chat" in the inline canvas to get the composed Frankenstein page as one image (drawn in their browser, sent through MCP Apps model context, never stored); pages with a Pinterest part come back as the parts view, since Pinterest sends no CORS header. The get_snapshot mock carries the same hint line. | Owner decision D1 option (a). |
