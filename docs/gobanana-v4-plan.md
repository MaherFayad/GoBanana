# GoBanana v4: two modes, designer pipeline, 100+ references, real directions

Status: proposal, not approved. Written 2026-10-17 on `claude/friendly-archimedes-514hlg`.
Builds on [explore-v3-plan.md](explore-v3-plan.md) (surfaces, context, bets, tracks, Pick page) and [impeccable-takeaways.md](impeccable-takeaways.md) (the agent proposes, the server rolls; mode rules; decision page rules).

## The product promise, rewritten

GoBanana helps solve the business problem and makes the experience simpler and better. Wild design is a tool for that, not the goal:
- **Bold** where it earns attention or memory.
- **Calm and clean** where people get a job done.
- **Removed** where it only adds complexity.

Every run ends with fewer things to build than the user started with, or a clear reason why not.

---

## 1. The first question: which mode

Before any work, ask once. Use AskUserQuestion in Claude Code; ask in chat in the Claude app. **Never go all in without this answer.** Most users want to explore first.

> How far should I take this?
> 1. **Explore directions (Recommended):** 6 to 8 very different directions with 100+ references on the board and a Pick page. Nothing is drafted or built until you say so.
> 2. **Explore, then draft my picks:** the same, and I draft the directions you pick as quick screens.
> 3. **Finished from the first go:** I work like a design team: problem, space, specs, wireframes, references, directions for you to pick, then the full app with components, tokens and a clean file structure.
> 4. **Just references:** a big clustered board, no directions yet.

**Why Explore is the default:**
- It is the cheapest way to see what is possible.
- It writes no code.
- The user keeps every taste decision.

**Every mode can move up a step later without redoing the work:**
- "draft these" after Explore
- "build it" after Drafts

The board, PROBLEM.md and the directions carry over.

**Stage 0 scales with the mode.** Section 2 below is the full version.
- **Explore and References:**
  - Stage 0 is light. Infer PROBLEM.md from the brief and the repo, and ask nothing extra beyond the taste question.
  - Show CHALLENGE.md as a short "Worth questioning" list on the Pick page, not a step the user must pass.
- **Drafts and Finished:** Stage 0 runs in full, because those modes spend real build effort.

**Where Finished is offered:**
- Only in **Claude Code with a repo or an empty folder**. It needs files, a shell and subagents. Claude Code supports subagents; plugin agents are ignored in claude.ai chat ([plugin platform support](https://claude.com/docs/plugins/platform-support.md)).
- In the Claude app, option 2 reads: "Finished needs Claude Code; I'll do drafts here and give you a build pack to finish there."

**Skip the question** when the user already said which:
- "explore", "directions", "go wild", "inspire me" → Explore
- "draft it", "mock it up" → Drafts
- "build the whole app", "ship it" → Finished
- "just references", "moodboard" → References

When unsure, ask. Never skip it to go further.

---

## 2. Stage 0 for every mode: understand, then simplify

This runs before any reference or direction. It is the step that makes GoBanana solve problems instead of decorating them.

### 2a. Understand the problem (PROBLEM.md)

Fill from CONTEXT.md, the repo, connected tools (analytics, tickets, research docs) and the user. Ask at most 3 questions in one turn, and only for what nothing else answers.

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

**The evidence rule:**
- Every claim in "Today" names its source: an analytics chart, a ticket count, a quote, or "assumed".
- Never invent numbers, customers or benchmarks (this follows Impeccable's "truth binds claims").

### 2b. Challenge the complexity (CHALLENGE.md)

The agent acts as the designer who asks "do we need this?" It reads the requested scope (features, fields, steps, settings, plans, options) and challenges each one that adds complexity without serving the job.

**Paste-ready skill text:**

```md
### Challenge before you design

You are the designer in the room who protects the user's attention. Before any reference or direction:

1. List every element the request or the current product puts on this page or flow: steps, fields, options, toggles, plans, banners, modals, notifications, settings.
2. For each, ask: which part of the Job does it serve, and what breaks if it goes? If the answer is "nothing breaks" or "a stakeholder wants it", it is a candidate to cut, merge, defer or default.
3. Look for complexity that comes from business decisions, not user needs:
   - three pricing tiers where two would do
   - a sign up before value
   - a required field nobody uses
   - a confirmation for a reversible action
   - a choice the product could make with a sensible default
   - a separate page for what fits in a sheet
4. Write CHALLENGE.md with up to 7 challenges, most impactful first. Each is one row:
   - what to change: cut, merge, default, defer, or reorder
   - why: the job and the evidence
   - what it saves: steps, fields, decisions, or support load
   - the risk
   - who must agree
5. Never remove anything silently. Show the challenges to the user in one short list and ask which to accept. Accepted ones become constraints for every direction. Rejected ones stay out of the work and are not raised again.
6. Do not challenge legal or regulatory requirements (PDPL consent, ZATCA invoice fields, accessibility). Make them simpler to complete, never optional.
7. Simpler is not emptier. Removing a step must not hide information the user needs to decide, such as the total, fees or cancellation terms.
```

**Grounding:**
- Impeccable `distill`: "What's the primary user goal? (There should be ONE)" (`skill/reference/distill.md`).
- ISO 9241-210: design starts from users, tasks and context of use.
- WCAG 2.2:
  - SC 3.3.7 Redundant Entry: don't ask for the same information twice
  - SC 3.3.8 Accessible Authentication: no puzzle or memory step to sign in
  - Both are direct simplicity requirements.

### 2c. The subtract direction

Every run keeps one direction whose idea is subtraction: "the same job with the accepted challenges applied and nothing added". It sits in the Ship track. It is often the right answer, and showing it next to the wild ones keeps the run honest. The same idea as Impeccable's "standing exit", turned to simplicity.

---

## 3. Modes: Explore (recommended) and Drafts, rebuilt

Explore runs steps 0 to 6 below and stops at the Pick page with one question: "Draft any of these?" Drafts runs step 7 too, for the picks only.

### The flow

| # | Step | What happens | Subagents (Claude Code) |
| --- | --- | --- | --- |
| 0 | Understand and simplify | PROBLEM.md, CHALLENGE.md, one question (accept challenges and taste words) | `gb-researcher` reads repo, docs and analytics in parallel with the main thread |
| 1 | Map the page | Each page or region marked **Bananas** (wild pays), **Stretch** or **Calm** (a job is done here; Ship track only) | none |
| 2 | Wide sweep | 40 to 60 references for the page type, components and adjacent worlds, before any direction exists | 2 `gb-scout` agents |
| 3 | Directions | 6 to 8 directions, built from the agent's grounded candidates and the server roll, checked for difference (section 5) | main thread |
| 4 | Deep search | Each direction's own UI and art lanes, about 12 to 18 kept per direction | up to 4 `gb-scout` agents, one per 2 directions |
| 5 | Cluster and place | 100 to 150 references on the board, clustered (section 4) | `gb-curator` |
| 6 | Pick page | 6 to 8 cards, one pick, the standing exit, re-roll registers, then AskUserQuestion last | main thread |
| 7 | Draft the picks | Only the chosen ones, in the sandbox path, screenshots back to the board | one `gb-builder` per picked direction, `isolation: worktree` |

**Subagent facts** ([Claude Code subagents](https://code.claude.com/docs/en/sub-agents)):
- Each starts with a fresh context and "doesn't see your conversation history, the skills you've already invoked, or the files Claude has already read." Every agent therefore gets a full input packet (brief, PROBLEM.md, accepted challenges, taste, platform, rules), as Impeccable does for its reviewers.
- Plugin agents ignore `hooks`, `mcpServers` and `permissionMode`, but they can call the session's MCP tools.
- Up to 20 run at once by default.
- Our own cap is **4 scouts at once**, because Serper allows 5 requests a second and our search sends up to 4 in flight (`SERPER_MAX_IN_FLIGHT`, `docs/search-quality-experiment.md`).

**In the Claude app** (no subagents): the same steps run in the main thread, with the sweep and deep search done in fewer, larger calls.

### Budget per run (Pro)

| Step | Searches | Kept references |
| --- | --- | --- |
| Wide sweep | 4 (count 24 each) | 40 to 60 |
| Deep search | 8 (one per direction, count 24) | 90 to 140 |
| Lane retries | up to 4 | n/a |
| **Total** | **12 to 16** | **100 to 150 on the board** |

**Pro:** 300 searches a month is about 20 runs.
**Free:** 30 searches and **40 items per canvas**. A Free board cannot hold 100 references. See decision 1.

---

## 4. 100+ references, clustered

### What is wrong today

- **Too few.** One search per kept direction, 3 directions kept, 6 to 8 UI and 2 to 4 art items placed each. That is about 30 references on a finished board.
- **Thin variety.** All searches start from the direction. Nothing looks at the space first, so the board never shows what the category does, what neighbours do, or the strong outliers.
- **No clusters.** `arrange_canvas` knows `by_direction` and masonry. A section is a flat grid with no grouping by what each reference is good for.

### The fix

**1. A sweep before directions.** `search_references` gains a `sweep` input that plans lanes for the space, not a direction:
- page type (fidelity), Dribbble and Pinterest
- 2 component lanes from the page's parts (approval gate, run timeline, empty state)
- adjacent domains: the same job in other industries ("queue management app ui" for an agent supervision board)
- the user's taste words on the page type
- locale (Arabic UI) when the brief is Arabic

The sweep results feed the agent's direction candidates (Impeccable item 1: ground the candidates in what the space shows).

**2. Bigger searches.**
- `count` max goes from 24 to 40.
- Requests per call stay at 8 (`SERPER_MAX_REQUESTS`); the extra count comes from page 2 and 3 of the strongest lanes (`SERPER_MAX_PAGES` is already 3).
- Dedup by shot or pin id across the whole canvas, not per call.

**3. Clusters on the board.** Each direction section holds labeled clusters by what to take from them:
- `layout`
- `component` (per part: approval gate, timeline)
- `type`
- `color`
- `motion`
- `art` (section 6)

Plus one **Space** section from the sweep, clustered by what the category does, adjacent worlds, and outliers.

**Server changes:**
- `add_to_canvas` items take `cluster: string` (up to 40 characters).
- `arrange_canvas` gains `by_cluster`: inside each section, one labeled row per cluster, best first. It stays deterministic layout, no AI.
- **Optional deterministic hints:** `extract_palette` already decodes thumbnails in memory. A `color_stats` field per reference (lightness, chroma, main hue, never stored as an image) lets the curator sort a cluster from dark to light or group "drenched" against "restrained". Hard rule 1 holds: it computes numbers, it never judges.

**4. The curator does the judging.**
- `gb-curator` reads the tray with thumbnails, at most 12 per call (`MAX_THUMBS`), so 100+ references take about 10 calls, split across scouts.
- It places, clusters and writes a `steal:` note for each.
- It rates junk `bad` so it leaves the tray, and 1 to 3 standouts per cluster `great`.

**5. Limits to raise** (`lib/canvas/store.ts`, `lib/billing/plans.ts`):
- tray 200 to 400
- Pro items 300 to 500
- check `MAX_STATE_BYTES` (1 MB) against a 150 reference board with notes; raise to 2 MB if needed

---

## 5. 6 to 8 directions that speak different languages, first shot

### What is wrong today

- Directions differ in their ingredient words (seersucker or barometer) but often share a visual language.
- Nothing checks that two directions look different.
- Triage keeps 3.

### The language axes

Every direction declares a value on each of 7 axes. The server checks the set.

| Axis | Values |
| --- | --- |
| Type voice | grotesk, neo-grotesk, editorial serif, classic serif, mono, condensed, rounded, display retro, script, slab (`TypeVoice` today) |
| Color strategy | restrained, committed, full palette, drenched (Impeccable `new-work.md` §4) |
| Ground | light, dark, colored, photographic |
| Density | airy, balanced, dense |
| Composition | grid, editorial, poster, spatial or layered, list-first, card-first |
| Material | flat, paper and print, glass and light, 3D and object, photographic, textile and pattern |
| Motion grammar | still, snap, glide, spring, cinematic |

**The difference rule:**
- Every pair of kept directions differs on at least **4 of 7** axes.
- No two share both type voice and color strategy.
- No two come from the same tension or the same material family (`families.ts`).
- The bend refuses a set that fails, and says which pair and which axes.

**The spread:**
- 2 Ship, one of them the subtract direction
- 2 or 3 Stretch
- 2 or 3 Wild

On Calm pages every direction holds to Impeccable's Operate limit: "type, palette, density, and one signature move", never the layout, navigation or controls.

### Agent instructions (paste-ready, for the explore skill)

```md
### Directions: six to eight, each its own language

1. Ground first. From PROBLEM.md, the accepted challenges and the sweep, list 7 to 10 candidates from the audience's world: objects, places, rituals, graphic traditions, publications, signage, data graphics. Each needs a line on why it resonates, a line on how it looks, and its material family. Span at least 4 families. Before listing, name the category default and its predictable opposite; neither may appear. Never use a tool the audience itself operates (for AI products: no terminal, no chat bubble, no robot).
2. Pass them as `candidates` to bend_brief with `count: 8`. The server rolls which become directions and adds 1 or 2 challengers.
3. For each direction, fill all 7 language axes, the mechanic (one working part of the page), the bet (hypothesis, tension, measure), the edge case it survives, and an honest risk.
4. Run the checks before you show anything:
   - Memory test: what would someone describe an hour after seeing the first screen? If the answer is a mood, rework it.
   - Category test: could someone guess this look from the category name alone? Rework it.
   - Saturated looks: cream plus serif plus terracotta; near-black plus one neon; broadsheet hairlines plus italic serif plus mono labels; flat ink plus hard offset shadows. Landing on one without the brief asking for it fails.
   - Difference: the server's pair check passes.
   - Job: the direction still does the Job in PROBLEM.md, with the accepted challenges applied.
5. Keep 6 to 8. Fewer than 6 survive: bend again with new candidates, at most once, then show what you have and say why.
6. Show every kept direction on the Pick page with equal weight. Show dropped ones as one compact row, each with what a kept direction took from it.
```

**Server changes:**
- `bend_brief` takes `candidates` (Impeccable item 1).
- Directions gain `language` (the 7 axes).
- Add the pair check and a `diversity` report in the result.
- Default `count` stays 8; the triage target moves from 3 to 6 to 8.

---

## 6. Art (non-UI) references that are actually useful

### What is wrong today

- **Raw objects, not design.** Art queries are the raw ingredient (`artQueries` in `lib/bend/spec.ts`: "seersucker texture", "barometer dial"). They return product photos, shop listings and close-ups. The search experiment found raw ingredients give 92% item pages but only 12% have a usable title, and "poster" helps only on popular topics ("sadu weaving poster: 0").
- **Random ingredients.** For an agent dashboard, a photo of seersucker fabric has nothing to give.
- **No translation.** The `steal:` note is free text. Nothing forces the agent to say which UI part the image becomes.
- **Wrong placement.** Art sits in its own row, away from the UI it should inform, so it reads as mood, not material.

### The fix: art as design systems, translated

**1. Search the world's graphic systems, not its objects.** Impeccable: the audience's world "includes its graphic and screen traditions... the notation, publications, identity programs, data graphics, and interfaces it reads daily", and "Catalog worlds are working systems, not mood references."

Art lanes get a ladder per ingredient, first hit wins:
1. `{ingredient} identity system` or `{ingredient} signage system` on Behance/gallery (the best source for identity and craft, per the experiment)
2. `{ingredient} graphic design` or `{ingredient} poster` on Pinterest/pin, popular topics only
3. `{ingredient} pattern` or `{ingredient} typography`
4. the raw ingredient, as today, last

With candidates grounded in the audience's world (section 5), the ingredients are things with graphic traditions (flight strips, ticket rails, departure boards, Sadu), so step 1 or 2 usually hits.

**2. Every art reference carries a translation.** `add_to_canvas` art items take:
- `stealAxis`: one of type, color, pattern, composition, texture, motion, notation
- `becomes`: the UI part, up to 80 characters, for example "the approval gate: one strip per agent, color by state"

An art item without `becomes` is refused. The `steal:` note stays for the why.

**3. Rate art by usefulness, not beauty.** New `bad` reasons for the art zone:
- `object_only`: a product photo with no graphic system to take
- `no_translation`: nothing maps to a UI part

The skill rule: "Keep an art reference only if you can name the UI part it becomes. A beautiful image that becomes nothing is junk here."

**4. Place art next to what it informs.** Inside each direction section, an art item sits in the cluster of its `stealAxis` (color art in the color cluster, pattern art next to the divider or progress components). It no longer sits in a separate mood row.

**5. Count.** 4 to 6 art references per direction (up from 2 to 4), so 30 to 45 per board, all translated.

---

## 7. Mode: Finished from the first go

Claude Code only. It runs the drafting pipeline, then carries on like a design team. **Two gates:** the user approves once after the spec and wireframes, and once at the Pick page. Everything else runs on its own and says what it assumed.

### The stages

| # | Stage | Output (in `design/gobanana/`) | Subagents |
| --- | --- | --- | --- |
| 0 | Understand and simplify | PROBLEM.md, CHALLENGE.md | `gb-researcher` |
| 1 | Space | SPACE.md: shipped baseline (Mobbin when connected), must keeps, a page map marked Bananas, Stretch or Calm | `gb-researcher`, `gb-scout` |
| 2 | Spec | SPEC.md: pages, flows, every state (empty, loading, error, offline, edge cases from PROBLEM.md), content model, acceptance criteria, WCAG 2.2 AA, RTL, PDPL and ZATCA where they apply | `gb-spec-writer` |
| 3 | Wireframe instructions | WIREFRAMES.md per page (regions, hierarchy, components, states) plus low-fi HTML wireframes, grey boxes and real labels (extends `wireframe_html`) | `gb-spec-writer` |
| **Gate 1** | Approve | One AskUserQuestion: spec and wireframes as they are, or what to change. Shown with an Artifact of the wireframes. | |
| 4 | References | Sweep plus deep search, 100 to 150 on the board, clustered | up to 4 `gb-scout`, `gb-curator` |
| 5 | Bananas zones | Pages marked Bananas get Wild and Stretch directions | main thread |
| 6 | Calm zones | Pages marked Calm get Ship only: clean floor, standard controls, one signature move at most | main thread |
| 7 | Directions | 6 to 8 directions across the app (section 5), on the Pick page | main thread |
| **Gate 2** | Pick | Pick page plus AskUserQuestion, asked last | |
| 8 | System | Tokens (DTCG plus the project's theme format), type scale, color roles with WCAG checks, spacing, motion tokens; `export_kit` with `scope: "system"`, the one case where GoBanana writes the product's system | `gb-builder` |
| 9 | Components | The component set the wireframes name, each with states, RTL and keyboard support, in the framework's own conventions | 2 to 3 `gb-builder` agents, `isolation: worktree`, split by component group |
| 10 | Pages | Each page from its wireframe, using only the components; Bananas pages carry the picked direction's signature move | one `gb-builder` per 2 to 3 pages |
| 11 | Review | A fresh-context critique per page against SPEC.md, WIREFRAMES.md and the direction; then axe and contrast numbers; fixes in one batch; two rounds at most | `gb-reviewer` (fresh, no transcript) |
| 12 | Hand-off | README section, DESIGN.md from the built system, CLAUDE.md or AGENTS.md section, screenshots on the board | main thread |

### File structure

Follow the framework's own conventions first, found in the repo. When the folder is empty, use this (Next.js App Router shown; the plan stays framework-neutral):

```
app/                       routes, one folder per page in SPEC.md
components/
  ui/                      primitives: button, input, sheet, tabs (standard controls)
  patterns/                composed parts named in WIREFRAMES.md (approval-gate, run-timeline)
  signature/               the picked direction's signature move, isolated so it can be removed
styles/
  tokens.css               generated from design/gobanana/tokens.json
lib/                       data and state, no UI
design/gobanana/           PROBLEM, CHALLENGE, SPACE, SPEC, WIREFRAMES, DIRECTION, DESIGN.md, tokens.json
```

**Rule:** the signature move lives in `components/signature/` so the team can keep it, tune it, or delete it in one place. A wild idea must never be smeared across the codebase.

### Agents to ship in the plugin (`banana-plugin/agents/`)

| Agent | Job | Tools |
| --- | --- | --- |
| `gb-researcher` | Problem and space; reads repo, docs, analytics and Mobbin; writes PROBLEM.md and SPACE.md drafts | Read, Grep, Glob, WebSearch, MCP |
| `gb-spec-writer` | SPEC.md and WIREFRAMES.md, low-fi HTML wireframes | Read, Write |
| `gb-scout` | One lane set: search, look at every thumbnail, rate, return kept ids with cluster and steal notes | GoBanana MCP |
| `gb-curator` | Place, cluster and arrange the board; write steal and becomes notes | GoBanana MCP |
| `gb-builder` | Tokens, components or pages from the packet; screenshots | Read, Write, Edit, Bash |
| `gb-reviewer` | Fresh critique against spec, wireframes and direction; returns ship, fix or rebuild | Read, Bash (screenshots), GoBanana MCP |

Each agent's file holds its own rules (no image downloads, source links, Arabic copy rules, ask nothing: return questions to the main thread). Subagents never ask the user; only the main thread asks.

---

## 8. Evals to add (`banana-plugin/evals`)

| # | Case | Pass if |
| --- | --- | --- |
| 55-mode-question | "Help me design our booking flow" in Claude Code | First reply asks the four-mode question with Explore marked recommended; no search, no files written |
| 56-mode-skip | "Give me wild directions for the paywall" | No mode question; Explore with light Stage 0; ends at the Pick page with "Draft any of these?"; no code |
| 56b-explore-no-build | Explore run, user picks one | Asks before drafting; nothing written to project source |
| 57-challenge | Brief with 3 pricing tiers, a sign up wall and 9 checkout fields | CHALLENGE.md has at least 3 challenges with what each saves and the risk; nothing removed before the user answers; ZATCA and consent fields not challenged |
| 58-subtract-direction | Any drafting run | One Ship direction applies the accepted challenges and adds nothing new |
| 59-hundred-refs | Drafting run on Pro | 100 or more references placed, every one with a cluster and a source link, no `bad` item placed |
| 60-eight-languages | Drafting run | 6 to 8 directions; every pair differs on at least 4 language axes; no shared tension or family |
| 61-art-translated | Drafting run | Every art item has `stealAxis` and `becomes`; no art item rated `object_only` is placed |
| 62-finished-gates | "Build the whole app" in an empty repo | Two AskUserQuestion gates (after wireframes, at the Pick page) and no component code before Gate 2 |
| 63-signature-isolated | Finished run | Signature move code lives only under `components/signature/` |
| 64-finished-not-in-chat | Claude app, "build the whole app" | Says Finished needs Claude Code, offers Drafts plus a build pack |

---

## 9. How we know it works: the Impeccable method

Impeccable's strongest habit is that it **measures**: changes ship only with a before and after, and its README tables say what was measured and how small the sample was. GoBanana adopts the same discipline. Each item names the Impeccable practice it copies.

### 9a. A fixed brief corpus

Impeccable runs the same "niches" every time (for example `01-observability` and `07-vintage-moto-forum` in `docs/COMP-FIDELITY.md`). We keep 16 briefs in `banana-plugin/evals/corpus/`, spread across the cases that broke before:

| Area | Briefs |
| --- | --- |
| AI | agent supervision dashboard, AI writing assistant onboarding, AI coding agent launch page |
| Gulf | Saudi flight checkout (Arabic, RTL), Saudi fintech home, government e-service form (Absher-like task, calm), Riyadh ride-hailing captain app, Ramadan campaign page |
| Work | B2B logistics dashboard, HR leave request |
| Consumer | meditation sleep onboarding, kids education home, luxury hotel website, recipe app empty state |
| Pricing and simplicity | SaaS pricing page with 4 tiers, e-commerce checkout with 11 fields |

Each brief has a short answer key: the Job, the must keeps, and the complexity a good run should question.

### 9b. Skill on against skill off

Impeccable's eval "runs the same brief through a model with and without the skill loaded" (CLAUDE.md, evals framework). We do the same:
- Each corpus brief runs through Claude with GoBanana and through plain Claude asked for "6 to 8 design directions with references".
- Same model, 3 samples each.

### 9c. What we score

Deterministic scores come from the board and tool results, with no judge:

| Score | How | Target |
| --- | --- | --- |
| Difference | Mean pairwise distance over the 7 language axes, out of 7 | at least 4.5 |
| Grounding | Share of directions whose candidate came from the audience's world (not the challenger pool, not the audience's own tools) | at least 70% |
| References | Placed references per board, junk placed (rated `bad` yet on the board), duplicate rate | 100+, 0 junk, under 3% duplicates |
| Art usefulness | Share of art items with `becomes` filled and not `object_only` | 100% |
| Simplicity | Challenges found against the answer key's list; challenges that wrongly touch legal or accessibility needs | at least 2 of 3 found, 0 wrong |
| Contracts | Mode question asked, no code before a pick, question asked last, source links everywhere | 100% |

Judged scores come from 2 judges, run blind and apart (Impeccable runs its two critique assessments "isolated" so one cannot anchor the other):
- **Judges:** one model judge with a fixed rubric and a fresh context, and the owner on a 4-brief sample.
- **The rubric:**
  - Would you show this direction to a client?
  - Does it serve the Job?
  - Does it make the product simpler or clearer anywhere?
  - Is it a look someone could guess from the category alone?
- Each scored 0 to 3.

### 9d. Behaviour and activation tests

- **Behaviour.** Impeccable's `tests/skill-behavior` asserts on tool calls, not prose: "the assertions key on tool calls rather than content". Our `banana-plugin/evals` already grades `tool_used`; extend it with the contracts above.
- **Activation.** Run our skills against 6 to 8 neighbour skills, 3 samples, comparing description drafts. Read category totals, never single cells, because "single cells swing between 0/3 and 3/3 across runs" (their activation README).

### 9e. Release rules

- **No rule change without a before and after on the corpus.** At least 3 samples for the briefs the change touches. Report the table in `banana-plugin/evals/README.md` with the date, the model and the sample size, as Impeccable's baseline tables do.
- **Say how strong the evidence is.** One sample is "a smoke, not a verdict" (their words). Never round a smoke up to a claim in docs or the site.
- **Retire what hurts.** Impeccable retired a detector rule after judges found 9% of its findings harmful and then none useful (commit `d98b0be4e`). We do the same for our junk filters and rating reasons: sample 30 removed results a month. If judges call more than 10% of removals wrong, loosen or drop that filter.
- **Degraded runs say so.** When a run could not use subagents, could not see thumbnails or could not publish the Pick page, its first line says what was skipped (Impeccable's `DEGRADED` banner). A silent degraded run counts as a failed run.

### 9f. Real-use signal

Impeccable's decision page records which card was chosen and whether the user re-rolled. We already record explicit `rate_directions` and `rate_references` calls. Add the Pick page outcome:
- first-shot pick, or re-roll and which register
- which track was picked
- whether the subtract direction won

The north-star number is the **first-shot pick rate**: runs where the user picks without a re-roll.

**Privacy (PDPL: purpose limitation and data minimisation):**
- Store only on the user's own canvas.
- Use it only to improve directions for that user and the aggregate counts.
- State it on the privacy page.
- No telemetry pings to third parties.

### 9g. Practices adopted from Impeccable, in one list

| Impeccable practice | Where it lives in this plan |
| --- | --- |
| The model proposes, the dice pick (30/35 identical concepts finding) | Section 5, `candidates` |
| The rut: name the category default and its opposite first | Section 5, step 1 |
| Spans at least three material families | Section 5 (we ask 4) |
| Mode by surface; the world lends only type, palette, density, one signature move on working screens | Sections 3 (page map), 5, 7 (Calm zones) |
| Never a tool the audience operates as a costume | Section 5, step 1 |
| Decision page: equal salience, one pick, standing exit, re-roll registers, ask last | v3 Pick page plus Section 2c (subtract as the standing exit for simplicity) |
| Verdicts and named raises from declined ideas | Section 5, step 6 |
| Truth binds claims, synthetic data labelled | Section 2a, evidence rule |
| `distill`: one primary goal | Section 2b |
| Saturated looks and the Claude rendition prior | Section 5, step 4 |
| Memory test | Section 5, step 4 |
| Six-block direction contract | impeccable-takeaways.md item 9, used in DIRECTION.md |
| Fresh-context reviewer, judgment before numbers | Section 7, stage 11 (`gb-reviewer`) |
| Input packets for subagents, since they start fresh | Section 3, subagent facts |
| Two-round ceiling on fixes | Section 7, stage 11 |
| Context-aware menu, never auto-run | impeccable-takeaways.md item 12 |
| Rule ids plus contract tests, prose gate in the build | impeccable-takeaways.md item 6, V4.0 |
| Skill on against skill off evals, corpus of niches, baseline tables, small-sample honesty | Section 9 |
| Retire rules by judged harm | Section 9e |
| DEGRADED banner | Section 9e |

## 10. Phases

| Phase | What | Depends on |
| --- | --- | --- |
| **V4.0** | Stage 0 (PROBLEM.md, CHALLENGE.md, subtract direction); mode question; skill text from sections 2 and 5 | none, skills only |
| **V4.1** | `candidates` and language axes with the pair check; triage to 6 to 8 | server bend |
| **V4.2** | Sweep, count 40, canvas-wide dedup, `cluster` and `by_cluster`, raised limits | server search, canvas |
| **V4.3** | Art ladder, `stealAxis` and `becomes`, new art reasons, art in clusters | server search, add_to_canvas |
| **V4.4** | Plugin agents (`gb-scout`, `gb-curator` first) and parallel drafting | V4.2 |
| **V4.5** | Finished mode: spec and wireframe stages, Gate 1 Artifact, system and component build, reviewer, hand-off | V4.4 and v3 Pick page |

---

## 11. Decisions for the owner

1. **Free plan and 100+ references.** Free boards hold 40 items. Options:
   - (a) Free stays at 40 and drafts show the best 40; the Pick page says Pro shows the full board.
   - (b) Raise Free to 120 items and keep searches at 30.
   - (c) Free gets one full run a month.

   Recommendation: (c). It shows the real product once, and searches are the cost driver, not items.
2. **Finished mode on the Free plan.** It uses many searches and exports. Recommendation: Pro only, with Drafts on Free.
3. **CHALLENGE.md tone.** Recommendation: direct and short, one row per challenge, never moralizing; the user decides.
4. **GoBanana writing the product's design system** in Finished mode (`scope: "system"`), which today's rules forbid by default. Recommendation: allowed only in Finished mode and only after Gate 2.

## References

- Impeccable `distill`, Operate mode, new-work, critique: https://github.com/pbakaus/impeccable/tree/main/skill/reference
- Claude Code subagents (fresh context, plugin agent limits, 20 concurrent, `isolation: worktree`, nesting): https://code.claude.com/docs/en/sub-agents
- Plugin platform support (agents ignored in chat): https://claude.com/docs/plugins/platform-support.md
- Claude Code artifacts (Gate 1 wireframe page, Pick page): https://code.claude.com/docs/en/artifacts
- GoBanana search experiment (site scoping, art lane findings, Serper 5 requests a second): `docs/search-quality-experiment.md`
- Limits in code: `lib/sources/web-search.ts` (`SERPER_MAX_REQUESTS` 8, `SERPER_MAX_PAGES` 3, `SERPER_MAX_IN_FLIGHT` 4), `lib/mcp/tools/search_references.ts` (count 4 to 24), `lib/vision/thumbs.ts` (`MAX_THUMBS` 12), `lib/canvas/store.ts` (`MAX_TRAY` 200, `MAX_STATE_BYTES` 1 MB), `banana-docs/src/content/docs/reference/plans.md` (items and searches per plan)
- WCAG 2.2 SC 3.3.7 Redundant Entry, SC 3.3.8 Accessible Authentication: https://www.w3.org/TR/WCAG22/
- ISO 9241-210:2019, human-centred design for interactive systems
