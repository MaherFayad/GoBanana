# What to take from Impeccable

Source: `pbakaus/impeccable` at commit `08d5b470` (2026-10-17), release v4.6.0. Read from a local clone. Apache 2.0.
Companion to [explore-v3-plan.md](explore-v3-plan.md). Status: proposal.

## How to read this

Impeccable makes many claims. Only a few are backed by numbers in the public repo; its main eval framework is private (`CLAUDE.md`: "The eval framework lives in a separate private repo at `~/code/impeccable-evals/`"). Each item below is tagged:

- **Measured:** numbers in a commit or doc in the repo.
- **Enforced:** a script or test makes it happen; it is not left to the model.
- **Asserted:** a rule in the skill text with no public measurement.

Ranked by what it would change for GoBanana, with evidence breaking ties.

---

## Take these

### 1. The model proposes, the dice pick (Measured)

**Their finding** (commit `c1953a379`, 2026-07-13): "a single model's resonance ranking is deterministic (30/35 identical concepts across 16 framings); dice must come from the script, mirroring the palette-seed result."

So asking the model for "wild ideas" gives the same idea almost every time. Asking a script for random ideas gives noise. Impeccable splits the job (`skill/reference/new-work.md` §3):

1. **The model lists 7 grounded candidates** from the audience's world: "concrete visual systems, artifacts, places, or rituals the audience knows by heart", each with why it resonates and how it looks. The list must span at least three material families. The category default and "its predictable opposite" are named first and kept off the list (the rut).
2. **The script assigns one**, by seed, and deals catalog challengers.
3. **The model judges each challenger** on two axes only: audience identification and product clarity.

**Why this is GoBanana's biggest fix.** Today GoBanana runs only step 2, over global word lists. That is why an AI agent dashboard gets "Seersucker 35mm slide mount" (see the probe in the plan). The model never grounds the ideas. The server rule "no AI calls" holds, because the agent is the model:

- `bend_brief` gains `candidates`: 5 to 7 objects of `{ name, why, looks, family }` that the agent writes from the audience's world. The skill gives the agent the rut rule and the three-families rule.
- The server rolls which candidates become directions (seeded PRNG, as today). It deals 1 or 2 challengers from its own lists. The word lists become the challenger catalog, which is a job they are good at.
- `rate_directions` learning keeps weighting the dice (it already does, in `lib/learning/directions.ts`).
- With no `candidates`, today's behaviour is unchanged, plus the domain packs from the plan as a seed.

**Effort:** medium (server input and roll; a skill step). It replaces most of the hand-written metaphor lists in the domain-pack plan. The packs keep their tensions, parts, edge cases and reflexes.

### 2. Verdicts and named raises, not silent drops (Asserted, but cheap)

Each challenger gets a verdict decided before borrowing: **wins**, **competitive** or **declined**.

> "A declined challenger is not spent: name the one discipline of its system the assigned direction lacks, and raise the assigned direction to match... Write each raise into the presented direction as its own line, named for its donor; a raise nobody can read did not happen."

Declined ones still show, "demoted, compact and quiet... the demoted row is the hand's proof of judgment."

**For GoBanana:**
- Today's explore skill says "Never show a dropped idea." Change that: dropped ideas show as one compact row on the Pick page, each with what the kept direction took from it ("RAISE from Kitchen ticket rail: one strip per agent, nothing else on the row").
- The user sees the judgment and can still adopt a dropped idea.

**Effort:** small (skill text plus a Pick page row).

### 3. Decision page rules (Enforced in their tool; directly reusable)

Our Pick page (plan, Workstream A) should follow their decision page rules (`new-work.md` §3, `serve-question`):

- **Same anatomy on every card:** thesis, palette, materials, first viewport, **honest risk**. Add the honest risk line to our cards: "Risk: supervisors may read the strips as decoration until the first approval."
- **Equal salience:** salience encodes the verdict, never "the accident of which cards have images." Every card gets the same sketch fidelity.
- **One pick card, never a ranked list:** "a lineup of your candidates hands selection back to a taste function and invites the safest card." The pick never takes the lead position.
- **The standing exit:** the category standard, "played straight", is always available and never recommended. This is our Mobbin "Shipped today" strip. When the user takes it, ask for 2 or 3 products to match and build the standard at full craft.
- **Re-roll in three registers:** plain, safer, bolder. "The register is the user's steering... never yours to pre-select." A re-roll removes every direction already shown. After two re-rolls in a row, ask what quality is missing. These map onto our steering verbs.
- **Same structure in the page and the question tool:** the AskUserQuestion options carry the assigned direction, the pick, the challengers, and the standing exit last.
- **Ask last** (from `critique.md`): "Prose emitted after a structured question is withheld until the user answers it." In Claude Code the AskUserQuestion call must be the final thing in the turn, after the Pick page link and the summary.

**Effort:** small (folds into P3 of the plan).

### 4. Mode by surface: what a world may lend a working screen (Asserted, but it fixes our worst probe output)

From `skill/reference/mode-operate.md`:

> "The world lends four things and only these: type, palette, density, and one signature move. It never supplies the layout, the navigation model, or the controls."

> "A world taken from a tool or instrument the audience operates (a terminal, a scope, a control panel, a cockpit)... comes back as a costume of that tool on a working screen."

> "Name the signature move concretely... service health drawn as a transit map, a schedule set in a timetable's column rhythm."

From `SKILL.src.md`: "Choose the mode from the requested surface, not the product... A tool's landing page is still Persuade."

**For GoBanana:**
- Every page gets a mode (Persuade, Operate, Read, Experience), set from `wildSpots` and the page name.
- **Operate pages:** the mechanic becomes the "one signature move" and nothing else. That rules out "Barometer dial frames the total" on a dashboard.
- **Reject the audience's own tools as metaphors.** For AI and agent products that means no terminal, no chat bubble, no robot. Update the plan's `ai-agents` pack: keep other trades' tools (air traffic flight strips, a kitchen ticket rail); drop anything the supervisors themselves use.
- **The Ship track is Operate by definition.**

**Effort:** small to medium (bend rules plus pack data).

### 5. Test the skill description, measured against neighbours (Measured)

`tests/skill-behavior/activation.eval.mjs`, baseline 2026-10-16, 3 samples. The setup:
- 12 skills in the prompt (theirs plus 11 neighbours)
- 54 cases: 34 positive, 20 negative

| Model | Old description (118 words) | New (81 words) | False positives |
| --- | --- | --- | --- |
| Sonnet | 35% recall | 55% | 0/21 |
| Gemini | 76% | 89% | 0/21 |

What they learned:
- "Shorter is not free": a 53-word version lost core asks.
- "The verb enumeration does real work; the long topic list... did not."
- "Sonnet decides at the first step. When its first action is not `Skill`, it explores with Bash or Read and almost never loads the skill afterwards."

**For GoBanana:**
- `gobanana-explore`'s description is about 1,000 characters, mostly trigger phrases, and sits next to likely neighbours: impeccable, design-shotgun, frontend-design, figma-generate-design, design-consultation.
- Build the same harness: our 10 skills plus 6 to 8 neighbours, about 40 cases, 3 samples, two descriptions compared.
- Today we test whether the skill fired (`skill-fired.md` graders in `banana-plugin/evals`). We never test whether it fires against competition.

**Effort:** medium (an eval script; about $1 per sweep by their numbers).

### 6. Rule ids tied to tests, and a prose gate in the build (Enforced)

- Every binding rule in their skill text carries a marker, for example `<!-- rule:skill-pick-card-one-only -->`.
- `tests/skill-reference.test.mjs` asserts that the contract text still says what it must. For example, all six direction-contract blocks exist.
- `validateSkillProse` fails `bun run build` on an em dash in `skill/**/*.md`.

**For GoBanana:**
- We already ban em dashes in UI copy, but nothing enforces it.
- Add a Vitest that scans `banana-plugin/skills/**/*.md`, tool descriptions and `SERVER_INSTRUCTIONS` for em dashes. It would also catch the Arabic copy rules where they are checkable: diacritics in Arabic strings, Eastern Arabic digits in examples.
- Add rule markers to the few rules that must never drift:
  - never download images
  - source link always
  - taste first
  - Pick page before code
  - ask last

**Effort:** small.

### 7. Measure the build; never trust "it matches" (Measured, n=1)

"Models systematically believe their HTML, CSS, and SVG recreation of an image succeeded when it did not" (`new-work.md` §6).

Their first sweep (`docs/COMP-FIDELITY.md`, 2026-08-16) moved comp fidelity "from the mid-50s to the mid-60s" when the measured gates ran. Their own caveat: "Small numbers, one sample each; read as a smoke, not a verdict."

**For GoBanana:** the full comp state machine is too heavy (see "Skip"). Take the principle where a measurement is cheap and needs no AI:
- `gobanana-build`'s drift check and `gobanana-critique` compare **measured** values, not eyeballed ones:
  - contrast pairs (we already compute WCAG in `extract_palette`)
  - the palette of the built screenshot against the direction's ship colors
  - type size ratios
- Say each miss as a number, as they do ("cap height 78px in the build, 103px in the comp").

**Effort:** medium.

### 8. A fresh reviewer, judgment before numbers (Asserted)

`critique.md`:
- "Assessment A (design review) and Assessment B (detector/browser evidence) MUST run as two isolated sub-agents."
- "Assessment A must finish before detector findings enter the parent synthesis context. Detector output is deterministic, but it still anchors judgment."

`new-work.md` §7: "a reviewer that inherits your transcript inherits your framing, your optimism, and your abstractions." A degraded single-context run must open with a `DEGRADED` banner.

**For GoBanana:** `gobanana-critique` grades in a fresh subagent that gets only REVIEW.md, the direction contract and the screenshots, then merges with axe and contrast results afterwards. If no subagent tool is available, say so in the first line.

**Effort:** small (skill text). There is no public measurement, but it is cheap and the reasoning is sound.

### 9. A short direction contract with a memory test (Enforced in their tests)

They record the chosen direction in "six short blocks, roughly 150 words":
- **THESIS**, which names the category-default arrangement it refuses
- **OWN-WORLD**, "specific enough to be recognizable with all content removed"
- **STORY**
- **FIRST VIEWPORT**
- **FORM**, with the seed reference so the roll can be replayed
- **FINISH**

"If a block reads like a mood, the direction is not decided yet." The memory test: "if someone left after one viewport, what would they describe an hour later? If the honest answer is a mood, the concept has not committed yet."

**For GoBanana:**
- DIRECTION.md is a long spec (15 axes). Put a six-block contract at its top, with the bend seed, so a run can be replayed.
- Put the memory test in triage: a direction whose answer is a mood fails test (a) "UI path".

**Effort:** small (export template plus a skill line).

### 10. Truth binds claims, not demonstrations (Asserted)

> "Demonstration data is design material: author it at full fidelity and label it synthetic... What stays uninventable are commercial and factual claims: prices, customers, benchmarks, endpoints, capabilities the product does not have."

Also, from `init.md`: no "invented testimonials, customers, benchmarks, pricing."

**For GoBanana drafts and Pick page sketches:**
- Realistic sample data is fine when it is labelled.
- Invented claims never are.
- In KSA fintech or travel drafts that includes fake VAT numbers or ZATCA QR codes that look real. Use placeholders that read as samples.

**Effort:** small.

### 11. The rendition prior, written down per model (Asserted)

A `<claude>` block appears only in their Claude build:

> "warm, bookish, family, and child-facing subjects come out as cream grounds, serif display with italic accents, and lamplight... Treat that first palette as already spent."

There is also a model-neutral list of the "saturated looks":
- cream plus serif plus terracotta
- near-black plus one neon accent
- broadsheet hairlines plus italic serif plus mono labels
- flat ink plus hard offset shadows

**For GoBanana:** the Pick page sketches and drafts are written by the model, so these priors hit them. Add the four looks and the Claude prior to `clean-floor.md` as a self-check for the Stretch and Wild cards. The Ship track inherits the project's tokens, so it is exempt.

**Effort:** small. Write it in our own words (licence note below).

### 12. A context-aware menu when the skill is called bare (Asserted)

`routing.md`: with no argument, read project signals and "lead with the 2-3 highest-value next commands, each with a one-line reason... Never auto-run a command."

**For GoBanana:** a bare `/gobanana` reads `get_canvas summary: true` and the repo, then suggests 2 or 3 next steps:
- "Board has 3 kept directions and no Frankenstein pages: frankenstein it"
- "Direction kept but never exported: hand off"

**Effort:** small.

---

## Skip these

| What | Why not |
| --- | --- |
| The comp-led build state machine (plates, `font-match`, `comp-diff`, a 72% hero gate) | Needs image generation, which conflicts with our "no image generation" rule on the server and our scope (exploration, not pixel fidelity). Their own note: "a frontier-tier job... Smaller or faster models... stall under the hero gate". Evidence is n=1. |
| The paid catalog and the roll API | Their CLAUDE.md: "the catalog is the paid-service moat." Ours is the reference search plus our word lists. |
| Roll and choice telemetry to a server | Every roll sends a ping by default. For GoBanana that is personal data processing that needs a stated purpose (PDPL: purpose limitation, data minimisation). We already learn from explicit `rate_*` calls, which is enough. |
| Font ban lists copied as is | Their list targets Latin web display faces. Our Arabic lenses name Arabic display faces on purpose. Write our own per-lens guidance. |
| Corpus judging of detector rules | Strong method: two judges over a real-site corpus, a rule retired after 9% judged harm (commit `d98b0be4e`). But we have no detector. Revisit if `clean-floor.md` grows into automated checks. |
| Live browser mode, the Rust engine, 18 harness ports | Out of scope. We run as an MCP server plus a plugin; Claude Code and the Claude app are our harnesses. |

## Licence

Impeccable is Apache 2.0 (`LICENSE`, with a `NOTICE.md` for its own third-party sources).
- Take ideas and structure freely.
- Write all rule text in our own words.
- If any passage is adapted closely, credit it in `banana-server/THIRD_PARTY_NOTICES.md` (or a plugin `NOTICE`) with the source file and licence.
- Quotes in this doc are for internal reference only; they are not product copy.

## Where each item lands in the plan

| Item | Plan workstream | Phase |
| --- | --- | --- |
| 1. Model proposes, dice pick | D (domain packs become the seed and fallback) | P0 |
| 2. Verdicts and raises | E (tracks), Pick page | P1 |
| 3. Decision page rules | A (Pick page) | P3 |
| 4. Mode by surface | D (mechanics), E (Ship = Operate) | P0 |
| 5. Activation eval | Evals | P1 |
| 6. Rule ids and prose gate | Evals | P0 |
| 7. Measured drift | F (output control) | P4 |
| 8. Fresh reviewer | F | P4 |
| 9. Six-block contract | C (bets), exports | P2 |
| 10. Truth binds claims | F (`clean-floor.md`) | P4 |
| 11. Rendition prior | F (`clean-floor.md`) | P4 |
| 12. Context-aware menu | B (context) | P2 |

## Sources (all in `pbakaus/impeccable`)

- Roll finding, 30/35 identical: commit `c1953a379` (2026-07-13)
- Roll, verdicts, decision page, standing exit, registers, contract, rendition prior: https://github.com/pbakaus/impeccable/blob/main/skill/reference/new-work.md
- Operate rules: https://github.com/pbakaus/impeccable/blob/main/skill/reference/mode-operate.md
- Modes, routing, setup: https://github.com/pbakaus/impeccable/blob/main/skill/SKILL.src.md and https://github.com/pbakaus/impeccable/blob/main/skill/reference/routing.md
- Isolated critique, ask last: https://github.com/pbakaus/impeccable/blob/main/skill/reference/critique.md
- Activation eval and baseline: https://github.com/pbakaus/impeccable/blob/main/tests/skill-behavior/README.md
- Contract tests: https://github.com/pbakaus/impeccable/blob/main/tests/skill-reference.test.mjs
- Prose gate and private evals note: https://github.com/pbakaus/impeccable/blob/main/CLAUDE.md
- Comp fidelity sweep: https://github.com/pbakaus/impeccable/blob/main/docs/COMP-FIDELITY.md
- Rule retired on judged harm: commit `d98b0be4e` (2026-10-07)
