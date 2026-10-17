# Explore v3: plan

Status: proposal, not approved. Written 2026-10-17 on `claude/friendly-archimedes-514hlg`.
Scope: `banana-server/lib/bend`, `banana-server/lib/mcp`, `banana-plugin/skills`, `banana-plugin/evals`.

## Positioning (one line)

GoBanana explores; it does not solve. Every direction is a **bet on the business problem**, shown in three tracks (Ship, Stretch, Wild). **The user picks before anything is built:** in Claude Code the first output is a Pick page (an Artifact) that shows the directions side by side. Drafts come only after a pick, and they live where the user works: the repo in Claude Code, an Artifact in the Claude app, or wherever the user says.

## The problems, with evidence

| # | Problem (owner's words) | Root cause in code |
| --- | --- | --- |
| 1 | In Claude Code inside a codebase, it ignores the codebase | No skill reads the repo before `bend_brief`. Only `gobanana-handoff` looks for files, and only at the end (`skills/gobanana-handoff/SKILL.md:28`). |
| 2 | No memory + "make drafts": it drafts into GoBanana instead of the Claude app canvas, or should ask | No rule says where drafts go. The board is the only surface the skills know. The server never checks what the host can show (`open_canvas` always registers the UI tool, `lib/mcp/tools/open_canvas.ts:194`). |
| 3 | Not tied to the business problem when chat drafts | A direction has no goal, job, bet or metric (`lib/bend/types.ts:87`). `whyItFits` is one template: "{mood} and {X} give the {subject} a look no competitor has" (`lib/bend/spec.ts`). |
| 4 | Not crazy enough, no edge business cases; AI and agent briefs are the most boring | See the probe below: no AI domain, random ingredients, checkout-only mechanics. No move generates scenarios or edge cases; every move bends the surface (`lib/bend/moves.ts`). |
| 5 | No safer, direct-to-build, clean option | Wildness 1 ("Fresh") is the only safe path and it is still a random reskin. No quality floor or anti-pattern list in the skills. |

### Probe: `bendBrief` at wildness 3, count 8 (run locally, 2026-10-17)

| Brief | `detectDomain` | Sample directions |
| --- | --- | --- |
| AI agent dashboard where teams supervise autonomous support agents | none | "Barometer dial", mechanic **total** ("frames the total") on a screen with no total. "Seersucker 35mm slide mount". "CD-ROM 1995 revival" + Delft pottery. "Swahili carved doors" as a progress bar. |
| AI writing assistant chat app onboarding | none | "Czech cubism 1912 revival", "Giant barcodes" with mechanic **total**, "Pakistani truck art". |
| Launch page for an AI coding agent startup | none | "Copper patina Chinese cloisonne", "Knitting pattern", "Giant circles" with mechanic **total**. |
| Flight checkout for a Saudi travel app | none | "Luggage tag" (good, but by chance), "Skateboard deck" + Yemeni qamariya, "Crushed velvet". |

Every `whyItFits` line is the same template. The good ideas for agents (air traffic flight strips, a kitchen ticket rail) are already in `objects.json`, but they only come up by luck.

**Diagnosis:** random is not the same as wild. A wild idea that lands comes from the subject's real tension (agents: trust, delegation, oversight) pushed into a foreign object. The engine skips the tension step.

---

## Workstream A: Surface routing (where am I, where do drafts go)

### The rule

- **The board holds other people's work** (linked references, Mobbin screens, Frankenstein parts).
- **Drafts are the user's own work** and go to the user's surface.
- The board links to each draft. It never becomes the draft tool.

### Detection: server side (hints only)

| Signal | Means | How sure |
| --- | --- | --- |
| Client capabilities carry `extensions["io.modelcontextprotocol/ui"].mimeTypes` with `text/html;profile=mcp-app` (at `initialize`, or per request in `_meta["io.modelcontextprotocol/clientCapabilities"]` under MCP 2026-07-28) | The host can show the inline canvas (claude.ai, Claude Desktop, mobile) | Spec |
| `clientInfo.name == "claude-code"` | Claude Code. It declares `elicitation: {form, url}` and no UI extension | Tested in this session (Claude Code 2.1.302) |
| `clientInfo.name == "claude-ai"` | Claude Desktop chat | Community report, unverified |

**Server change:**
- Every tool result gains a small `host` block: `{ inlineCanvas: boolean, client: "claude-code" | "claude-ai" | "other" }`.
- When `inlineCanvas` is false, `open_canvas` returns text only and a web link, so the skill never says "open above". This follows the MCP Apps spec: "Servers SHOULD check client capabilities before registering UI-enabled tools" and "SHOULD provide text-only fallback".

### Detection: skill side (the decision)

The skill decides from what Claude can see itself:
- **Repo tools plus a project:** Bash, Glob, Read and Write are present, and the working directory has `.git`, `package.json`, `CLAUDE.md` or `AGENTS.md`. This means Claude Code in a codebase.
- **Artifact tool present, no repo:** the Claude app.

The server `host` block breaks ties.

### Pick first (Claude Code)

In Claude Code the first thing the user sees is a **Pick page**, not code. Code is expensive and hard to compare; a page of options is cheap and easy to compare. Only the directions the user picks get drafted.

This matches two sources:
- Claude Code's own guidance for artifacts: "Lay out several design or implementation options side by side" and "Bring the result back to your session" (an export control that hands the choice back to the terminal).
- Impeccable v4, which shows its direction choices on a local decision page (`impeccable serve-question`) before it builds anything.

#### The flow

1. **Context.** Read the repo (Workstream B): framework, tokens, components, the route of the named page.
2. **Directions.** Bend, search and fill the board as today. The board holds the references.
3. **Pick page.** Publish an Artifact with the kept directions side by side: one Ship, one Stretch and one Wild, with "My pick" marked (Workstream E).
4. **Choose.** In the same turn, ask with **AskUserQuestion** (`multiSelect: true`):
   - one option per direction, "My pick" first and marked "(Recommended)"
   - "Other" lets the user mix ("Ship's layout with Wild's palette")
5. **Draft.** Draft only what the user picked, as code in the sandbox route (routing table below). Screenshot each draft onto the board as `type: "build"`.
6. **Record.** Republish the Pick page to the same URL with each draft's screenshot and a "Drafted" or "Not picked" state. This is allowed because a screenshot of the user's own build is their own work. The page becomes the decision log for the run.

#### What a direction card shows

The page is an HTML Artifact. Its CSP blocks every external image, and GoBanana never re-hosts reference images, so **no reference image goes on the Pick page.** References stay on the board, and the page links to them.

Each card shows:
- **Header:** the track and the title, for example "Ship · Flight strip approvals".
- **A rough sketch** of the named page drawn in HTML and CSS: low fidelity, the direction's type and palette, and the **mechanic drawn in place** (for example the approval gate as a flight strip). On the Ship card the sketch uses the project's own tokens, so it looks like their product.
- **The bet:** hypothesis, tension and what to measure, plus the edge case it survives.
- **Cost to build:** "this sprint, existing components" or "new component: approval strip". Plus the must keeps it holds.
- **Links:** 2 to 3 reference links as `title (site)` and the board link.
- **Steering hints:** "Reply safer, wilder, cleaner or more business for this card."

Extra blocks:
- A **"Shipped today" strip** at the top when Mobbin ran: text links only, the baseline the directions escape.
- A **"Copy as prompt"** button. It copies the pick, any mix and any notes as one line to paste into the terminal. It needs no capability, and is the fallback when the terminal question has scrolled away.

#### How the choice gets back to Claude

| Option | How | For | Against | Verdict |
| --- | --- | --- | --- | --- |
| A. Look on the page, choose in the terminal | Pick page plus AskUserQuestion in the same turn, with Copy as prompt as a backup | Instant; no runtime capability, so no publish permission prompt; works offline from the page | Choosing happens in a second place | **Ship this** |
| B. Choose on the page (`db` capability) | Card buttons write picks to a `picks` collection, and Claude reads them with ArtifactData | Choices stay saved; teammates can vote on a shared page | Declaring a capability asks before publish; a db write does not wake the session, so the user still has to say "done" | Later, for team reviews |
| C. Claude Design canvas | `/design` drafts one artboard per direction (beta template, Claude Code v2.1.265+) | Editable, exports PNG or PDF | Already a draft, not a cheap choice; reading the choice back is unclear; beta | Option for the draft step, not the pick |
| D. GoBanana inline canvas | MCP Apps | Already built | Claude Code does not render MCP Apps (it declares no UI extension) | No |

#### When artifacts are not available

Claude Code artifacts need:
- a Pro, Max, Team or Enterprise plan
- a claude.ai login (an API key, a gateway token or a cloud provider credential cannot publish)
- the Anthropic API as the provider

They are off in `-p` runs, the Agent SDK and the GitHub Action.

When publishing fails:
1. Write the same page to `design/explorations/<slug>/pick.html` in the repo. It is the user's own scoped folder, which matches the existing hand-off convention.
2. Say where it is in one line.
3. Still ask with AskUserQuestion.

Never block the pick on the page.

### Draft routing table

| Where | Draft target | How |
| --- | --- | --- |
| Claude Code, in a repo | **After the Pick page and a pick:** real code in the project's framework, in a sandbox route or `design/explorations/<slug>/drafts/` | Never touch production routes or shared components. Screenshot with Playwright and place the shot on the board as `type: "build"`. Republish the Pick page with the result. |
| Claude Code, no repo | **After the Pick page and a pick:** standalone HTML drafts in `design/explorations/<slug>/drafts/` | Same screenshot loop |
| Claude app (web, Desktop, mobile) | An Artifact (HTML page, or the Design template canvas when listed) | Add a `note` on the board linking to the artifact. The server cannot create artifacts; only the model or host can. |
| Unknown, or the user named nothing and has no memory | Ask once | See the question below |

**The one question when unsure.** Use AskUserQuestion in Claude Code; ask in chat in the Claude app.

> Where should the drafts go? 1. As code in this project (safe sandbox route) 2. As a page here in Claude 3. Just the board, no drafts

### Options considered

| Option | For | Against | Verdict |
| --- | --- | --- | --- |
| A. Host native surface, ask when unsure | Drafts live where the user already works; no new GoBanana surface | Two code paths | **Ship this** |
| B. Drafts as HTML items on the GoBanana board | One place for everything | GoBanana becomes a hosting and draft tool; competes with Artifacts and Claude Design; storage scope grows | No |
| C. Always ask | Never wrong | Friction on every run | Only as the fallback in A |

---

## Workstream B: Context without memory

Impeccable's lesson, from how it changed over versions:
- **v1.5 to v2.1:** a mandatory Context Gathering Protocol plus `.impeccable.md`. It said "You cannot infer this context by reading the codebase."
- **v3:** replaced that with PRODUCT.md, which holds durable product truth only.
- **v4:** the `init` command asks "at most three focused questions" and explicitly does not ask about aesthetics. Its gate was softened ("a narrow refinement of existing code proceeds… offering init afterward rather than blocking on it").

**GoBanana stance:**
- **Code tells what was built.** In Claude Code, read it for constraints: framework, tokens, components, RTL support, and the route of the named page.
- **The human tells who and why.** Ask for the job, the goal and taste.
- **Never block a scoped run on missing context.** Ask, then offer to save the answers.

### Where context lives

| Option | Surface | Verdict |
| --- | --- | --- |
| A. `design/gobanana/CONTEXT.md` in the repo | Claude Code | **Yes.** Versioned, readable by every coding agent; `gobanana-agents-md` can point to it. |
| B. A `context` field on the canvas (server side) | Claude app, and any host with no memory | **Yes.** The board becomes the memory: `get_canvas` returns it, so a new chat with no memory picks it up. |
| C. Host memory only | Claude app with memory on | No. Servers cannot read Claude memory (no documented API), and memory is off by default per member on Team and Enterprise. |

A and B mirror each other. When both exist, the repo file wins in Claude Code.

### Context template (paste ready)

```md
<!-- gobanana:context v1 -->
# GoBanana context

Product: what it is, in one line
Primary user: who, in what situation
Job: the one thing this page must get done for them
Goal: convert | activate | retain | trust | explain | recover | share
Metric: the number that moves if it works (for example checkout completion)
Market and language: for example KSA, Arabic first, RTL, Western digits
Must keep: clear total, one primary action, step indicator
Constraints: design system name, framework, regulatory (for example ZATCA e-invoice QR on receipts, PDPL consent on sign up)
Taste: 3 to 5 style words
Anti-references: looks to avoid
Shipped today: Mobbin baseline links, if any
```

### Intake rules

- **Three fields at most, asked in one turn.** This replaces today's "one question" rule for intake only, and matches Impeccable `init`.
  - In Claude Code: one AskUserQuestion call with up to 3 questions.
  - In the Claude app: one message with 3 short numbered asks.
- Ask the business fields first: **job, goal, taste**. The repo or the canvas fills the rest.
- **"Just go" still works.** Fill from what is known, say what was guessed, and never invent style words (the existing taste-first rule).
- **Privacy (PDPL: purpose limitation and data minimisation).** The canvas context holds business facts only. The tool description tells the agent never to put names, emails or customer data in it. It is deleted with the canvas. Show this in `privacy-and-sources.md`.

---

## Workstream C: Bets, not looks (the business anchor)

### New bend inputs (all optional)

- `goal`: the enum from the template.
- `job`: up to 120 characters.
- `edgeCases`: up to 3 short strings.

The skill fills them from context.

### New direction fields (paste ready)

```ts
/** What the direction bets on. Rule based, from the domain pack's tension and the mechanic. */
bet: {
  /** "If the approval gate reads like an air traffic flight strip, supervisors clear agents faster" */
  hypothesis: string;
  /** The tension it plays on, from the domain pack: "trust vs speed". */
  tension: string;
  /** What to measure: "time to approve, approvals undone within 1 hour". */
  measure: string;
};
/** The stress case this direction is built to survive, and how the mechanic shows it. */
edgeCase: { case: string; how: string };
```

`whyItFits` is rewritten from the bet. The old template line ("a look no competitor has") is deleted.

### New move: `scenario`

This is the first move that bends the **situation**, not the surface. It picks an edge case from the domain pack and makes it the hero of the page. Examples:
- "the agent is stuck and asks for help"
- "40 agents ran overnight"
- "split fare across 4 travellers in Ramadan peak"
- "the refund"

At wildness 1 to 2 the edge case is only a test the direction must pass. At wildness 3 and up it can be the headline ("Design the overnight report first").

Why this matters: edge cases are where the business lives (support cost, refunds, trust). They are also where generic AI output has nothing to copy, so they give the most original ideas.

---

## Workstream D: Domain packs (fixes "AI and agents are boring")

Move domains from the inline list in `tone.ts` into data files, `lib/bend/domains/<id>.json`. Add **ai-agents**, **ai-assistant** and **travel** first, then **gov-services**, **delivery** and **ride-hailing** for the Gulf market.

Each pack holds:
- the tensions
- metaphor objects keyed to each tension
- the page parts that can carry a mechanic
- edge cases
- category reflexes to refuse

### Ingredient draw rule

- **Wildness 1 to 3:** at least one ingredient comes from the pack's tension metaphors.
- **Wildness 4 to 5:** one ingredient from the pack, one foreign (today's random lists).

This keeps the collision but anchors one side to the subject.

### `ai-agents.json` (paste ready draft)

```json
{
  "id": "ai-agents",
  "words": ["agent", "agents", "agentic", "autonomous", "copilot", "assistant", "llm", "ai", "chatbot", "automation", "workflow", "orchestration", "وكيل", "ذكاء اصطناعي"],
  "allow": ["serious", "calm", "cold", "warm", "playful", "light", "dark"],
  "clash": [],
  "audience": "people who hand work to software and still answer for it",
  "tensions": [
    { "id": "trust-speed", "label": "trust vs speed", "metaphors": ["air traffic flight strip", "kitchen ticket rail", "bank teller window", "customs stamp desk"] },
    { "id": "autonomy-control", "label": "autonomy vs control", "metaphors": ["dog walker leash bundle", "valet key", "marionette control bar", "model railway control panel"] },
    { "id": "invisible-work", "label": "invisible work", "metaphors": ["night shift handover log", "newsroom wire ticker", "ship captain logbook", "hotel housekeeping board"] },
    { "id": "cost", "label": "cost of thinking", "metaphors": ["taxi meter", "parking meter", "chess clock", "electricity meter"] },
    { "id": "being-wrong", "label": "confident and wrong", "metaphors": ["court stenographer transcript", "proofreader marks", "weather forecast confidence cone", "lab notebook"] }
  ],
  "parts": ["run-timeline", "step-trace", "approval-gate", "autonomy-dial", "cost-meter", "confidence", "handoff", "composer", "citations", "empty-state"],
  "edgeCases": [
    "the agent is stuck and asks for help",
    "40 agents finished overnight",
    "a run failed halfway through",
    "the agent was confident and wrong",
    "cost spiked tenfold on one run",
    "a human takes over mid task",
    "first run with nothing connected"
  ],
  "reflexes": ["purple to blue gradient", "sparkle icon as the AI badge", "glowing orb or blob", "chat bubble as the whole UI", "dark with one neon accent", "an Ask anything box as the hero", "typing dots as the only thinking state"]
}
```

### Page-aware mechanics

Today `MECHANIC_ELEMENTS` is fixed to checkout parts (`lib/bend/mechanic.ts:9`). The fix:
- Elements come from the **page archetype plus the domain pack's `parts`**.
- `total` and `cta` are only offered when the brief or page is a transaction. This removes "Barometer dial frames the total" on a dashboard.
- Each new part gets a `HOW` line that keeps its job. For example, approval-gate: "{Idea} as the approval gate: one clear approve and one clear stop, the agent's reason stays readable".
- `MUST_KEEP_WORDS` protects the new parts too.

### Category reflexes

Each pack's `reflexes` go into `spec.avoid` and are rated `wrong_style` in the audit. This is Impeccable's "category-reflex check": "If someone could guess the theme and palette from the category name alone… it's the training-data reflex."

---

## Workstream E: Three tracks (Ship, Stretch, Wild)

Default output is one spread of three directions, not three of the same wildness. The skill marks **one "My pick"** with a one-line reason. (Impeccable shows one pick card and never a ranked list. We show three because the owner explores by comparing, and still take a stance.)

| Track | Wildness | What it may change | Bar |
| --- | --- | --- | --- |
| **Ship** | 1 | Type, palette, density and **one** signature move, inside the project's tokens and components | Buildable this sprint. Keeps every must keep and the Mobbin baseline layout. Passes the clean floor. No new components. |
| **Stretch** | 2 to 3 | The mechanic bends one working part; layout may bend | Must survive the direction's edge case. Clean floor holds. |
| **Wild** | 4 to 5 | The edge case or tension becomes the headline | Concept only; colors tagged `explore`. Still names its bet and measure. |

The Ship track follows Impeccable's "mode-operate" rule: "The world lends four things and only these: type, palette, density, and one signature move. It never supplies the layout, the navigation model, or the controls." It also follows the current `bolder`: "Amplify what the system already owns… The bolder version should look more like the same brand, not less."

**Server:**
- `bend_brief` gains `tracks?: ("ship" | "stretch" | "wild")[]`, default all three.
- A direction carries `track`.
- Ship directions use only `material` or `constraint` moves plus a pack metaphor at small scale.
- `count: 8` still generates wide. Triage keeps the best per track.

**Options considered:**
- A. Tracks (above). **Ship this.**
- B. Keep the single wildness dial and add a "safe" flag. No: it mixes two axes.
- C. Two runs, safe and wild. No: double the turns and searches.

---

## Workstream F: Output control (lessons from Impeccable)

| Impeccable mechanism | Source | GoBanana version |
| --- | --- | --- |
| Quality floor read right before any UI edit (`craft-floor.md`): a verify list plus a refuse list | `skill/reference/craft-floor.md` | `references/clean-floor.md` in `gobanana-build`, `gobanana-critique` and the new draft step. Our own words, covering: <ul><li>no gradient text</li><li>no side-stripe borders</li><li>no nested cards</li><li>no glass as decoration</li><li>no kicker above headings</li><li>tinted text on color, never gray</li><li>body 65 to 75ch</li><li>one authored motion moment</li><li>WCAG 2.2 AA contrast (SC 1.4.3, 1.4.11)</li><li>target size (SC 2.5.8)</li><li>focus visible (SC 2.4.7, 2.4.11)</li><li>reduced motion</li><li>Arabic rules (noun labels, no diacritics, Western digits, logical properties)</li><li>no em dashes</li></ul> |
| Re-roll registers: plain, safer, bolder. "The register is the user's steering… never yours to pre-select." | `skill/reference/new-work.md` §3 | **Steering verbs** after a run, each mapped to bend params: <ul><li>**safer**: track ship, keep the mechanic</li><li>**wilder**: wildness +1, add scenario</li><li>**cleaner**: rerun the clean floor and drop the twist</li><li>**more business**: rebend with goal and edgeCases</li><li>**edge case**: scenario move on</li><li>**another world**: same tension, new metaphor family</li></ul> Listed in step 14 of `gobanana-explore`. |
| "Standing exit": the category standard played straight, the user's door, "never recommend it" | v4.0.1 changelog | Already half there: the Mobbin "Shipped today" note. Keep it as the baseline and never present it as a direction. |
| Variety: roll from outside the model's ranking (`concept-seed`) | `new-work.md` §3, `crates/context/src/concept_seed.rs` | GoBanana already rolls on the server (seeded PRNG, `lib/bend/prng.ts`) and learns from `rate_directions`. Add a rule: no two kept directions from one tension, and no metaphor family repeated within one board (extends `families.ts`). |
| Deterministic detector (59 rules) plus hooks | `crates/live/assets/antipatterns.json`, `skill/reference/hooks.md` | No detector of our own in v3 (the server makes no AI calls and cannot reach localhost). In Claude Code, `gobanana-critique` runs axe plus our contrast checks. If the user has Impeccable installed, it can also run `npx impeccable detect <path> --json` and fold the findings in. Interop, not a dependency. |
| Mode by surface, not product ("A tool's landing page is still Persuade") | `SKILL.src.md` | Already close: `wildSpots` plus "keep calm" pages. Add the mode to the direction card so daily task screens default to the Ship track. |
| Per-harness builds (`<claude>` and `<codex>` blocks, `{{ask_instruction}}`) | `scripts/lib/transformers/providers.js` | Keep one source. Add a short "If you are in Claude Code / in the Claude app" block in the skill body. Plugin skills keep to the six frontmatter fields claude.ai accepts. |

**Licence note:** Impeccable is Apache 2.0. Write our own rules. If any wording is adapted, add it to `THIRD_PARTY_NOTICES.md`.

---

## Phases

| Phase | What | Done when |
| --- | --- | --- |
| **P0: not boring** (server) | Domain packs: ai-agents, ai-assistant, travel. Pack-anchored ingredient draw. Page-aware mechanics. `total` and `cta` only on transactions. `bet` and `edgeCase` fields; `whyItFits` from the bet. | The probe above re-run: every AI brief detects its domain; no mechanic says "total" off a transaction; at least 5 of 8 directions use a pack tension; no two `whyItFits` lines match. |
| **P1: tracks and steering** (server plus explore skill) | `tracks`, `track`, the `scenario` move, steering verbs, "My pick". | Default run shows Ship, Stretch and Wild with one pick; "safer" re-bends to Ship and keeps the mechanic. |
| **P2: context** (skills plus canvas field) | `CONTEXT.md` in the repo, `context` on the canvas, intake of 3 fields at most, repo read in Claude Code. | A new chat with no memory on an existing board asks nothing it already knows; Claude Code names the framework and tokens before bending. |
| **P3: pick first and surfaces** (skills first, then server) | Pick page in Claude Code (`references/pick-page.md` in `gobanana-explore`: card layout, sketch rules, Copy as prompt, no external images). AskUserQuestion in the same turn. Local `pick.html` fallback. Republish with screenshots after drafting. Then the `host` block, text-only `open_canvas` fallback, per-request capabilities (MCP 2026-07-28), the draft routing table, and the one question when unsure. | In Claude Code a run ends on a Pick page plus one AskUserQuestion; no code is written before a pick. "Make drafts" then writes only the picked directions to `design/explorations/<slug>/drafts/`, screenshots them to the board, and republishes the Pick page. In the Claude app it makes an Artifact and links it from the board. Unknown host: one question. |
| **P4: clean floor** (build, critique, draft) | `clean-floor.md`; critique runs axe and contrast; optional Impeccable detector interop. | A Ship draft passes the floor with zero P0 findings. |

## New evals (`banana-plugin/evals`)

| # | Prompt | Pass if |
| --- | --- | --- |
| 47-ai-agent-not-generic | "Go wild on the agent activity view of our support agents dashboard, minimal and editorial" | No mechanic on `total`. At least 2 kept directions name an agent tension. No reflex (purple gradient, sparkle, orb) in specs. |
| 48-code-reads-repo | Claude Code in a fixture repo with Tailwind tokens | Names the framework and tokens before `bend_brief`. Ship direction uses project tokens. |
| 48b-code-pick-first | Claude Code in a fixture repo: "go wild on the onboarding and draft it" | Publishes a Pick page (Artifact tool used) and asks with AskUserQuestion in the same turn. No Write or Edit to project source before the answer. No `<img>` with an external `src` in the page. |
| 48c-pick-fallback | Same, artifacts disabled (`CLAUDE_CODE_DISABLE_ARTIFACT=1`) | Writes `design/explorations/<slug>/pick.html`, says where it is, still asks with AskUserQuestion. |
| 48d-draft-only-picked | Follow-up: picks 1 of 3 | Drafts only that direction in the sandbox path. Places a `build` screenshot on the board. Republishes the Pick page to the same URL. |
| 49-drafts-claude-app | "Make drafts of the 3 directions", Artifact tool present, no repo | Makes an Artifact. Adds a board note linking it. Writes no HTML items to the board. |
| 50-drafts-unknown-asks | "Make drafts", no repo, no Artifact tool | One question with the 3 options. No drafts yet. |
| 51-no-memory-board-context | New chat, board has `context` | Asks no question the context answers. |
| 52-three-tracks | Clear brief, taste given | One Ship, one Stretch, one Wild, one "My pick". Each has a bet and a measure. |
| 53-steer-safer | Follow-up "safer" | Re-bends to Ship, keeps the mechanic, no new search unless the UI lane fails. |
| 54-edge-case-hero | "Go bananas on the refund screen" | The Wild direction makes the edge case the headline. Must keeps intact. |

Server Vitest: domain detection for AI and travel briefs; mechanic never `total` or `cta` without a transaction; `bet.hypothesis` names the mechanic; ids stable for the same input (bump `ENGINE_VERSION` to `bend-v2` once).

## Decisions for the owner

1. **Tracks by default (3 directions, one per track)** or keep "3 at one wildness" as the default. Recommendation: tracks.
2. **Canvas `context` stored on the server.** It touches the privacy page and PDPL data minimisation. Recommendation: yes, business facts only, deleted with the canvas.
3. **Intake allows 3 questions in one turn** (replacing "one question at most" for intake). Recommendation: yes.
4. **Optional Impeccable interop** in critique. Recommendation: yes, detect-only and never required.
5. **How the pick comes back in Claude Code:** look on the Pick page and choose in the terminal (A), or choose on the page with the `db` capability (B). Recommendation: A now, B later for team reviews.

## References

GoBanana code
- `banana-server/lib/bend/tone.ts` (domains), `lib/bend/mechanic.ts:9` (elements), `lib/bend/spec.ts` (`whyItFits`), `lib/bend/moves.ts`, `lib/bend/families.ts`, `lib/mcp/tools/open_canvas.ts`, `lib/mcp/instructions.ts`
- `banana-plugin/skills/gobanana-explore/SKILL.md`, `banana-plugin/docs/WHERE-WEIRDNESS-PAYS.md`

Impeccable (pbakaus/impeccable, v4.6.0, 2026-10-16)
- Current skill: https://github.com/pbakaus/impeccable/blob/main/skill/SKILL.src.md
- Quality floor: https://github.com/pbakaus/impeccable/blob/main/skill/reference/craft-floor.md
- New work, rolls, registers, saturated looks: https://github.com/pbakaus/impeccable/blob/main/skill/reference/new-work.md
- Context interview (3 questions, no aesthetics): https://github.com/pbakaus/impeccable/blob/main/skill/reference/init.md
- bolder / quieter / overdrive: https://github.com/pbakaus/impeccable/blob/main/skill/reference/bolder.md, https://github.com/pbakaus/impeccable/blob/main/skill/reference/quieter.md, https://github.com/pbakaus/impeccable/blob/main/skill/reference/overdrive.md
- Critique (isolated assessments, Nielsen /40): https://github.com/pbakaus/impeccable/blob/main/skill/reference/critique.md
- Detector rules: https://github.com/pbakaus/impeccable/blob/main/crates/live/assets/antipatterns.json
- Hooks: https://github.com/pbakaus/impeccable/blob/main/skill/reference/hooks.md
- Harness matrix: https://github.com/pbakaus/impeccable/blob/main/docs/HARNESSES.md
- v1 Context Gathering Protocol (historic): https://github.com/pbakaus/impeccable/blob/727f0a661e03ecc7d235ab4192399920858c69f6/source/skills/frontend-design/SKILL.md
- Interview with Paul Bakaus: https://latent.space/p/skill-engineering-design

Claude surfaces and MCP
- Interactive connectors (MCP Apps) on Claude, Cowork, Desktop, mobile: https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude
- Connectors overview: https://claude.com/docs/connectors/overview.md
- MCP Apps in Claude (domain, display modes, limits): https://claude.com/docs/connectors/building/mcp-apps
- MCP Apps spec (SEP-1865): https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp and https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx
- `getUiCapability` helper: https://apps.extensions.modelcontextprotocol.io/api/functions/server-helpers.getUiCapability.html
- Client extension matrix: https://modelcontextprotocol.io/extensions/client-matrix
- MCP 2026-07-28 (per-request client info and capabilities): https://blog.modelcontextprotocol.io/posts/2026-07-28/ and https://claude.com/blog/bringing-mcp-2026-07-28-to-claude
- Artifacts: https://support.claude.com/en/articles/17153992-what-are-artifacts
- Claude Code artifacts: https://code.claude.com/docs/en/artifacts. The parts this plan relies on:
  - "Compare alternatives" and "Bring the result back to your session" (a Copy as prompt export)
  - the CSP "blocks every external image"
  - the availability rules (plan, `/login`, Anthropic API only, off in `-p` and the Agent SDK, `CLAUDE_CODE_DISABLE_ARTIFACT`)
  - a publish that declares capabilities asks first
  - comments sent to Claude wake the session (v2.1.228+)
  - `/design` drafts a Claude Design canvas (v2.1.265+, beta)
- Impeccable decision page before building: `impeccable serve-question` in https://github.com/pbakaus/impeccable/blob/main/skill/reference/new-work.md
- Claude Code MCP (roots, `CLAUDE_PROJECT_DIR`, elicitation): https://code.claude.com/docs/en/mcp
- Claude Code memory: https://code.claude.com/docs/en/memory
- Claude memory (on by default for Free, Pro and Max; off per member on Team and Enterprise): https://support.claude.com/en/articles/11817273
- Elicitation spec: https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation; claude.ai request: https://github.com/anthropics/claude-ai-mcp/issues/153
- Plugin platform support: https://claude.com/docs/plugins/platform-support.md
- Skill authoring best practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

Standards
- WCAG 2.2: https://www.w3.org/TR/WCAG22/ (SC 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.5.8, 2.3.3)
- ISO 9241-210 (human-centred design: context of use first), the basis for Workstream B
- Saudi PDPL (SDAIA): purpose limitation and data minimisation, for the canvas `context` field

## Unverified

- `clientInfo.name` for Claude Desktop chat (`claude-ai`) comes from a community report. Use it as a hint only; capabilities decide.
- Whether the Desktop app's Code tab renders MCP Apps (feature gated, per community issues 88881 and 88370).
- When MCP 2026-07-28 per-request capabilities arrive in each Claude product ("rolling out soon").
