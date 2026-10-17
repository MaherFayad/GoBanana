---
name: gobanana-finish
description: Finished from the first go - work like a design team and take a whole app or feature from the problem to shipped code in Claude Code. Writes PROBLEM.md and CHALLENGE.md, maps the space (SPACE.md), writes SPEC.md, WIREFRAMES.md and low fi HTML wireframes, asks the user once to approve them (Gate 1), runs the GoBanana explore flow for the bold pages and keeps the task pages calm, asks the user to pick a direction on a Pick page (Gate 2), then builds the design system, the components and the pages with subagents, reviews them with a fresh reviewer, and hands off with screenshots, DESIGN.md and an AGENTS.md or CLAUDE.md section. Use when the user picked "Finished from the first go", or says "build the whole app", "build the whole feature", "from design to code", "design and build it", "ship it", "take it all the way", or "do the full pipeline". Claude Code only, since it needs a repo or an empty folder, a shell and file writes. Runs get_canvas, new_canvas, bend_brief, search_references, rate_references, rate_directions, add_to_canvas, arrange_canvas, open_canvas, reconcile_direction and export_kit from the GoBanana MCP server, through the gobanana-explore flow.
---

# GoBanana finish

Finished from the first go: problem, space, spec, wireframes, references, directions for the user to pick, then the full app with tokens, components, pages and a clean file structure. The work runs on its own and says what it assumed. The user is asked twice:

- **Gate 1:** after the spec and the wireframes.
- **Gate 2:** at the Pick page, after the directions.

Nothing else stops the run, except a real block (see "When things go wrong").

Bold where it earns attention or memory, calm and clean where people get a job done, removed where it only adds complexity. Every run ends with fewer things to build than the user asked for, or a clear reason why not.

## Ground rules

- **Claude Code only.** See "First: check where you are".
- **Two gates, asked by you.** Only the main thread asks the user, with AskUserQuestion, at Gate 1, at Gate 2, and when blocked. Subagents never ask; they return questions to you.
- **No product code before Gate 2.** Before the pick you write only files under `design/gobanana/` (Markdown and the HTML wireframes). No component, page, token, theme, `shadcn init` or package install before Gate 2.
- **The product's system only after Gate 2.** `export_kit` with `scope: "system"` and theme edits happen in stage 8 and later, never before.
- **Source links, always.** Every reference you mention carries its link, like `[Title](sourceUrl) (dribbble.com)`.
- **Never download, save or copy reference images.** Not into the repo, not into a temp folder, not as base64, not as a placeholder. This includes Mobbin screens and the board. Screenshots of the user's own build are fine.
- **Truth binds claims.** Never invent numbers, customers, prices, benchmarks or capabilities. Sample data is fine when it is labelled as a sample. No real looking VAT numbers or ZATCA QR codes: use placeholders that read as samples.
- **Arabic copy.** Noun labels (الحجز, not احجز الآن), no diacritics, Western digits (0 to 9), Latin codes stay Latin (RUH, SAR). Arabic and English get equal care.
- **Plain words.** Short sentences. No em dashes.
- **One AskUserQuestion per stop,** with every question for that stop in the same call, and asked last in the turn (the user sees nothing you write after it until they answer).

## First: check where you are

Finished needs files, a shell and subagents. Check before any other work:

- You have a shell (the Bash tool) and can write files (Write or Edit).
- There is a project folder: a repo, or an empty folder.

**If either is missing** (the Claude app chat, a read only session, no folder), do no stage. Reply in a few lines:

> Finished needs Claude Code, with a repo or an empty folder, a shell and subagents. Here I can explore directions with references on a board, then give you a build pack (DIRECTION.md, BUILD-PROMPT.md, REVIEW.md) to finish in Claude Code.

Then offer to start Explore now (the gobanana-explore skill) and, after a pick, a build pack (the gobanana-handoff skill). Stop and wait.

**If both are there:** say "Mode: Finished" in one line and go on. When this skill starts from the mode question in gobanana-explore, the mode is already settled; do not ask it again.

## Subagents, packets, and the degraded path

This skill ships six agents with the plugin. Spawn them with the Agent tool as `gobanana:<name>`:

| Agent | Stages | Job |
| --- | --- | --- |
| `gb-researcher` | 0, 1 | Reads the repo, docs, connected analytics and tickets, and Mobbin; returns PROBLEM.md and SPACE.md drafts |
| `gb-spec-writer` | 2, 3 | Writes SPEC.md, WIREFRAMES.md and the HTML wireframes |
| `gb-scout` | 1, 4 | One lane set: search, look, rate, return kept ids with clusters and steal notes (from the explore flow) |
| `gb-curator` | 4 | Places, clusters and arranges the board (from the explore flow) |
| `gb-builder` | 8, 9, 10, 11 | The system, then a component group, then pages; fixes |
| `gb-reviewer` | 11 | Fresh critique per page; returns ship, fix or rebuild |

**Every spawn gets a full written input packet.** A subagent starts with a fresh context: it does not see this conversation, the skills you loaded or the files you read. Write the packet so it stands alone:

```
GoBanana packet: <agent>, <stage>
Job: <one line: what to produce>
Project root: <absolute path>
Brief: <the user's ask, in one or two lines, quoted>
Platform: <mobile | tablet | website | webapp>   Languages: <ar default, en> or <en, ar>
Taste: <the user's style words, or "none given">
Read first: <absolute paths: PROBLEM.md, CHALLENGE.md, SPACE.md, SPEC.md, WIREFRAMES.md, DIRECTION.md, as they exist>
Accepted challenges: <ids and one line each>   Rejected, do not raise again: <ids>
Page map: <page: Bananas | Stretch | Calm>
Direction contract: <the six blocks, or "none before Gate 2">
You own: <paths you may write>   Do not touch: <paths>
Build rules: ${CLAUDE_PLUGIN_ROOT}/skills/gobanana-finish/references/build-rules.md (builders: read it first)
Return: <the exact shape you want back>
Rules: never ask the user (list questions under "Questions for the main thread" and go on with a stated assumption); never download or copy reference images; keep every source link; Arabic copy rules; plain words, no em dashes.
```

Do not pass the transcript. Pass paths and facts.

**Degraded path.** If there is no Agent tool, or a `gobanana:gb-*` agent is not in its list, run that stage inline in this thread, following the same agent's job, and say so once in the first line of your next reply:

> DEGRADED: no GoBanana subagents here, so these stages run in this one context and the review is not fresh.

Name the stages it covers. When `gb-reviewer` is missing, the review in stage 11 runs inline and the banner says the review shares this context.

## Where the files go

All design files go in `design/gobanana/` at the project root: PROBLEM.md, CHALLENGE.md, SPACE.md, SPEC.md, WIREFRAMES.md, `wireframes/` (HTML), DIRECTION.md, DESIGN.md, `tokens.json`, `screens/` (screenshots of the user's own build).

**Code follows the repo's own conventions first.** Read the repo (framework, router, `components.json` aliases, `src/` or not, i18n setup) and match it. Use this default only when the folder is empty or has no convention (Next.js App Router shown):

```
app/                       routes, one folder per page in SPEC.md
components/
  ui/                      primitives: button, input, sheet, tabs (standard controls)
  patterns/                composed parts named in WIREFRAMES.md
  signature/               the picked direction's signature move, isolated so it can be removed
styles/
  tokens.css               generated from design/gobanana/tokens.json
lib/                       data and state, no UI
design/gobanana/           PROBLEM, CHALLENGE, SPACE, SPEC, WIREFRAMES, DIRECTION, DESIGN.md, tokens.json
```

**The signature move lives only in `components/signature/`** (or the repo's equivalent folder), so the team can keep it, tune it or delete it in one place. Never spread a wild idea across the codebase.

## Stage 0: understand and simplify (in full)

Start `gb-researcher` right away with its packet (the brief, the project root, the platform if known, and what to return: a PROBLEM.md draft, the evidence it found with sources, and a SPACE.md draft for stage 1). While it reads, the main thread goes on: shape the brief, pin the platform and the languages, and pick or create the canvas (the explore flow's canvas step: reuse a matching board, else `new_canvas`; do not open it yet).

**Platform.** Use the words in the ask (the platform table in gobanana-explore). For "the whole app" in an empty repo with no platform named, assume a responsive web app and say so; confirm it at Gate 1.

**Languages.** The project's. With none, and the brief names an Arabic or GCC market (Riyadh, Saudi, Gulf), Arabic is the default and English is fully supported.

### PROBLEM.md

Fill it from CONTEXT.md, the repo, connected tools (analytics, tickets, research docs), the researcher's draft and the brief:

```md
# Problem
Job: the one thing the user of this page must get done
Who and when: the person, their situation, their device, their hurry
Goal and metric: what the business needs, the number that shows it
Today: how it works now, where people drop or call support (evidence, with source)
Constraints: legal (PDPL consent, ZATCA e-invoice), brand, tech, deadline
Edge cases: the 3 to 5 situations that break the happy path
Unknowns: what we are guessing, and how to check it
```

For a whole app, write one Job per main flow, then one line for the app's job.

**The evidence rule:**

- Every claim in "Today" names its source: an analytics chart, a ticket count, a quote, or "assumed".
- Never invent numbers, customers or benchmarks. An empty repo has no evidence: write "assumed" and put the check in Unknowns.

**Questions.** Ask nothing yet when the brief names the subject and you can assume the rest: list the assumptions in Unknowns and confirm them at Gate 1. Ask now only when you are blocked (no subject you can design, or two readings that change the whole spec): one AskUserQuestion, at most 3 questions, only for what nothing else answers. If the taste words are missing, ask for 3 to 5 style words or a reference board in that same call; never invent them.

### CHALLENGE.md

You are the designer in the room who protects the user's attention. Before any reference or direction:

1. List every element the request or the current product puts on each page or flow: steps, fields, options, toggles, plans, banners, modals, notifications, settings.
2. For each, ask: which part of the Job does it serve, and what breaks if it goes? If the answer is "nothing breaks" or "a stakeholder wants it", it is a candidate to cut, merge, defer or default.
3. Look for complexity that comes from business decisions, not user needs:
   - three pricing tiers where two would do
   - a sign up before value
   - a required field nobody uses
   - a confirmation for a reversible action
   - a choice the product could make with a sensible default
   - a separate page for what fits in a sheet
4. Write CHALLENGE.md with up to 7 challenges, most impactful first. Each is one row: id (C1, C2), what to change (cut, merge, default, defer or reorder), why (the job and the evidence), what it saves (steps, fields, decisions or support load), the risk, who must agree.
5. **Never remove anything silently.** The spec applies each challenge as *proposed* and marks it, and the user accepts or rejects them at Gate 1. Accepted ones become constraints for every stage after. Rejected ones go back into the spec and are not raised again.
6. **Never challenge legal or regulatory requirements:** PDPL consent, ZATCA invoice fields, accessibility (WCAG 2.2 AA). Make them simpler to complete, never optional.
7. **Simpler is not emptier.** Removing a step must not hide what the user needs to decide, such as the total, fees or cancellation terms.

Tone: direct and short, one row per challenge, never moralizing. The user decides.

## Stage 1: space (SPACE.md)

1. **Shipped baseline.** When the user has a Mobbin connector (tools named like `mcp__*Mobbin*__search_screens`), the researcher, or you, searches it once per main page on the platform: 3 to 6 real screens, their links, the layout most of them share. Without Mobbin, skip it silently.
2. **The wide sweep.** Run the explore flow's wide sweep once on the canvas (one `search_references` call with `sweep: true`, `count: 40`, the app's main page as `query`, up to 3 `components`, up to 3 `adjacent` phrases), through one `gb-scout` when present. Rate it as the explore flow says. It maps the space now; stage 4 does not repeat it.
3. **Write SPACE.md:**
   - **Baseline:** what shipped apps and the sweep's category cluster share (the rut), with links.
   - **Must keeps:** the patterns users rely on that no direction may break (a clear total, one primary action, the step indicator, a visible date and time).
   - **Adjacent and outliers:** what other industries do for the same job, with links.
   - **Page map:** every page or region in the app, each marked **Bananas** (wild pays: first run, empty states, success moments, the landing or home hero), **Stretch** (some room) or **Calm** (a job is done here: forms, booking steps, payment, settings, tables; Ship track only). One line of why per page. Most pages of a working app are Calm.

## Stage 2: spec (SPEC.md)

Spawn `gb-spec-writer` with its packet (PROBLEM.md, CHALLENGE.md, SPACE.md, the platform, languages, the page map). It writes `design/gobanana/SPEC.md`:

- Pages and flows, one section per page in the page map, with its route.
- Every state per page: empty, loading, error with a way out, offline where it applies, success, and the edge cases from PROBLEM.md.
- Content model: the entities, their fields, and which are required.
- Acceptance criteria per page, testable.
- WCAG 2.2 AA (contrast 4.5:1 text and 3:1 UI parts and focus, targets at least 24 by 24 px, keyboard reach, labels, no redundant entry SC 3.3.7, accessible sign in SC 3.3.8), RTL and both languages, PDPL consent and ZATCA invoice fields where they apply.
- Each proposed challenge applied and marked `[C2 proposed]`, with one line on what comes back if it is rejected.

## Stage 3: wireframe instructions (WIREFRAMES.md and HTML)

The same `gb-spec-writer` run (or a second one) writes:

- `design/gobanana/WIREFRAMES.md`: per page, the regions in order, the hierarchy, the components each region uses (named once, reused across pages: these names become the component list in stage 9), and the states.
- `design/gobanana/wireframes/index.html` plus one HTML file per page: low fi, grey boxes, real labels in the default language with the other language one click away, `dir` set, mobile (390 wide) and desktop (1440 wide) frames side by side, inline CSS only, no external images, no reference images, no web fonts. A box that stands for an image says what goes there ("Clinic photo").

Read both files before Gate 1. Fix anything that breaks the evidence rule, the challenge rules or the Arabic copy rules.

## Gate 1: approve the spec and the wireframes

1. **Show the wireframes.** When the session has the Artifact tool, publish `design/gobanana/wireframes/index.html` (with the page files as supporting files) as a private Artifact, following the tool's own rules, and give its link. Without it, give the local path to open in a browser: `design/gobanana/wireframes/index.html`.
2. **Write a short summary:** the pages with their Bananas, Stretch or Calm mark, the platform and languages you assumed, the open Unknowns, and the challenges as one short list (id, change, what it saves).
3. **Ask, last in the turn,** with one AskUserQuestion call:
   - "Spec and wireframes": Approve as they are (Recommended) / Change something (say what).
   - "Which challenges do you accept?": All of them / None / Some (type the ids).
   - Add a third question only for an assumption that changes the build (the platform, the default language).

Stop and wait. On "change", have `gb-spec-writer` revise the named parts, show what changed in a few lines, and go on without asking again unless the change is large. Restore every rejected challenge in SPEC.md and WIREFRAMES.md, and mark accepted ones as accepted.

## Stages 4 to 7: references and directions (the explore flow)

Run the gobanana-explore flow in Explore mode on the same canvas, with these changes:

- **Skip** its mode question (the mode is Finished), its taste question when you have taste, its light Stage 0 (PROBLEM.md and the accepted challenges replace it), its wide sweep (done in stage 1), its "Where should the weirdness go?" question (the page map answers it), and its closing question "Draft any of these?" (Gate 2 replaces it).
- **Pass** the must keeps from SPACE.md as `mustKeep`, the accepted challenges as constraints, and the pages marked Bananas and Stretch as `pages` (at most 3 per bend; the most important first).
- **Stage 4, references:** the deep search per kept direction, rating, clustering and placement as the explore flow says, 100 to 150 on the board on Pro. Use up to 4 `gb-scout` agents (one per 2 directions) and `gb-curator` when present, as the explore flow spawns them.
- **Stage 5, Bananas zones:** pages marked Bananas and Stretch get the Wild and Stretch directions. Each direction's mechanic lands on a working part of one of those pages.
- **Stage 6, Calm zones:** pages marked Calm get the Ship track only. Hold them to the Operate limit: a direction may change only the type, the palette, the density and one signature move at most. The layout, the navigation and the controls stay as the wireframes have them, standard and clean.
- **Stage 7, directions:** 6 to 8 directions across the app, each its own language, with the subtract direction in the Ship track (the same jobs with the accepted challenges applied and nothing added). Triage and rate them as the explore flow says. For each kept direction, note what it does on the Bananas pages and what it lends the Calm pages.

## Gate 2: the Pick page

1. **Publish the Pick page.** When the explore flow has a Pick page, use it. Otherwise, with the Artifact tool, publish one page: one card per kept direction with the same anatomy and equal weight (title and track, mechanic, feel, what it does on the Bananas pages, what it lends the Calm pages, honest risk, refs as links), one "My pick" card that is never in the lead position, and the standing exit last (the category standard, played straight, never recommended). No reference image on the page: link to the board. Without the Artifact tool, write `design/gobanana/pick.html` and give its path.
2. **Open the board** (`open_canvas`) and give its web link.
3. **Write a short summary**, then **ask last,** with one AskUserQuestion call: "Which direction should I build?" with the pick, up to 2 other cards and the standing exit last as options (the user can type any card number, or "safer", "bolder" or "plain" to re-roll). A re-roll removes every direction already shown; after two re-rolls in a row, ask what quality is missing.

Stop and wait. After the pick:

- Call `reconcile_direction` with the `canvasId` and the picked `directionId`, and tell the user about each conflict it lists in one line.
- Write `design/gobanana/DIRECTION.md`: the six block direction contract on top (about 150 words: THESIS, which names the category default it refuses; OWN-WORLD, recognizable with all content removed; STORY; FIRST VIEWPORT; FORM, with the bend seed so the run can be replayed; FINISH), then the full spec from `export_kit` `direction_md`. If a block reads like a mood, sharpen it before you build.

## Stage 8: the system

Spawn one `gb-builder` for the system, in the main checkout. Its packet: the build rules path, SPEC.md, WIREFRAMES.md, DIRECTION.md, the repo's conventions (or the default structure), and the `ship` colors.

- Call `export_kit` with `scope: "system"` and `formats: ["tokens", "tailwind", "design_md"]` for the picked direction (the one case where GoBanana writes the product's system, and only after Gate 2). Write the files into `design/gobanana/` (tokens as `tokens.json`) and pass their paths in the packet.
- The builder follows the component ladder and the base choice in the build rules: the project's own components first; for a new project, `shadcn init` on React Aria for an Arabic first product, Base UI otherwise, Radix kept where it already runs; the closest shadcn style to the direction; the direction's `ship` tokens in the theme; `styles/tokens.css` from `tokens.json`; the type scale with an Arabic and a Latin face; color roles with WCAG numbers; spacing and motion tokens; i18n with `ar` and `en`; `dir` on `<html>`; the direction provider.
- In an existing shadcn project, the build rules say when `shadcn apply` is safe; ask before either `apply` or hand edits to the theme (this is a block, so it is one of the allowed questions).

## Stage 9: components

Split the component list from WIREFRAMES.md into 2 or 3 groups (for example form controls, booking parts, layout and navigation) and spawn one `gb-builder` per group, at the same time. Each packet lists the components it owns, their states, RTL and keyboard needs, and the folder it may write. The signature move is its own group, written only to `components/signature/`, with a still version for reduced motion.

**Isolation.** Pass `isolation: "worktree"` on each group's spawn when the folder is a git repo and the system from stage 8 is on the branch a worktree starts from (worktrees check out tracked files only, from the default branch unless `worktree.baseRef` is `"head"`). Then bring each group's files back from its worktree into the main checkout and run the type check once. Do not commit for the user unless they asked. When a worktree cannot see the system (an empty folder, nothing committed), run the groups without isolation in the main checkout, each writing only its own folder, and say so in one line.

## Stage 10: pages

Spawn one `gb-builder` per 2 to 3 pages. Each builds its pages from their wireframes using only the components from stage 9: no new primitives in a page. Bananas pages carry the picked direction's signature move from `components/signature/`; Calm pages stay standard. Every state from SPEC.md, both languages, every string through i18n. Each builder returns its files and its screenshots (stage 11 sizes).

## Stage 11: review

For each page, spawn a fresh `gb-reviewer` with no transcript: only SPEC.md, WIREFRAMES.md, DIRECTION.md (the contract on top), the page's route, how to run the app, and the build rules path. It judges first against the spec, the wireframes and the contract from its own screenshots, then reads axe and contrast numbers, and returns **ship**, **fix** (a list of fixes, each with evidence) or **rebuild** (the page misses the wireframe or the contract), and never edits code.

- **fix:** batch every fix for the page into one `gb-builder` run, then review again with a new `gb-reviewer`.
- **rebuild:** one `gb-builder` rebuilds the page from its wireframe, then a new review.
- **Two fix rounds at most** per page (a rebuild counts as one). After the second, stop and list what is left in the report as not fixed.

## Stage 12: hand-off

1. **Screenshots** of every page in Arabic and English at 390 by 844 and 1440 by 900, saved in `design/gobanana/screens/`. When the build runs at an https address (a preview deploy), place them on the board with `add_to_canvas` as `{ "type": "build", "imageUrl": "<https screenshot>", "url": "<https page>", "title": "<page> ar 390" }`. With only a local dev server, skip the board step and say so in one line. Never send image bytes.
2. **DESIGN.md from the built system:** start from the `design_md` export, make every token match the built theme file (not the plan), write it at `design/gobanana/DESIGN.md`, and lint it as gobanana-design-md says.
3. **Agent rules:** run the gobanana-agents-md flow for a CLAUDE.md or AGENTS.md section (whichever the repo uses; both when both exist), merged between its markers, pointing to `design/gobanana/` and naming `components/signature/` as the one place the wild move lives.
4. **README section:** how to run the app, where the design files live, and the two languages.
5. **Report,** short, in this order:
   - **Reused:** the project's own components and assets.
   - **Added by shadcn CLI:** each component, with the base and style.
   - **New:** components and pages written for this app, and the signature folder.
   - **Placeholders to replace:** each designed placeholder with its page and size.
   - **Not checked:** anything you could not check (a screenshot size, an axe run, a real device), and anything left after two fix rounds.
   - The reviewer verdict per page, the board link, and the Artifact links.

## When things go wrong

- **Blocked mid run** (a command fails twice, a choice changes the whole build, the theme needs `apply`): ask one AskUserQuestion with the smallest choice that unblocks you. A subagent's "Questions for the main thread" go here only when you cannot answer them from the files.
- **Quota or plan message:** show it as is, with its link, once. Never retry in a loop. Before Gate 2, offer to continue on what the board holds; after, build with what you have.
- **A Free board (40 items):** place the best fitting set as the explore flow says, and say once that Pro shows the full board.
- **GoBanana tools missing:** say the GoBanana connector is not connected (`/mcp` in Claude Code to log in). Stages 0 to 3 and 8 to 12 can still run; references and directions cannot.
- **No browser for screenshots:** try the Playwright MCP, then `npx --yes playwright screenshot`; if none works, review from the code, mark the visual checks "not checked" and say so.
- **Subagent returns broken or empty work:** run it once more with a sharper packet; then do that stage inline and say so.
