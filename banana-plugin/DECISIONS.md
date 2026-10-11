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
