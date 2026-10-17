# Banana Bench baseline

The baseline is the first run the owner rates (docs/next-step-plan.md P0-14, Gate 1). Every later
change must beat it (section 8). Fill in the blanks below after rating.

## How to rate and score

1. Open `bench/runs/<date>/report.html` in a browser (it hotlinks every image, so you need to be online).
2. For each direction, rate brief relevance, coherence and wow from 1 to 5. Relevance 4 or 5 counts
   as on brief. Mark each reference great, good or bad. Notes are optional.
3. Ratings are kept in that browser. Click **Download ratings.json** and save it as
   `bench/runs/<date>/ratings.json` (Load ratings.json reads it back).
4. Run `node bench/score.mjs bench/runs/<date>` and paste the table below.

To make a new run: `node scripts/bench-run.mjs` (needs `SERPER_API_KEY` and `DATABASE_URL` in
`.dev.vars`, or pass `--dev-vars <path>`; stops before `--budget`, default 150 credits), or
`node scripts/bench-run.mjs --dry` for bend only, with no search.

## Baseline run

- Run: `bench/runs/2026-10-15/` (commit: 0a27d6e, engine before P0-05 to P0-08 and P0-16)
- Briefs: 10 (`bench/briefs.json`), 3 directions each, 18 of 30 directions searched
  (144 Serper credits, budget 150; the other 12 are rated on the spec only)
- Rated by: Claude (agent) on 2026-10-15, at the owner's request. These are not owner gold ratings: the owner should spot check them, and J10 still needs the owner's own 100 gold ratings.

| Metric | Baseline | Target |
| --- | --- | --- |
| Brief relevance | 13.3% (4 of 30 rated 4 or 5) | 80% or more |
| Spec coherence (checkCoherence failures; owner median) | not in the engine yet; rated median 3 | 0 |
| Query overlap | 23 shared UI queries (8 of 8 searched boards) | 0 |
| Reference precision (top 8 UI) | 61.1% (88 of 144) | 75% or more |
| Distance from slop | not measured by this bench | Fewer than 2 matches |
| Crop accuracy | ROLE_BANDS 0.141 mean IoU, 0.5% of parts at 0.8 or more (200 agent-made gold parts, `npx tsx scripts/crop-iou.ts`, 2026-10-16) | 0.8 or more |
| Wow (median) | 3 | Median 4 |
| Accessibility | not measured by this bench | 100% |
| Cost (Serper credits per board) | about 24 (8 per direction search, 3 directions) | 15 or fewer |

## Notes from rating

- Best directions: dala painting in the fitness empty state, Tokyo 1964 for Dubai listings, Cairo cinema posters (great art, wrong region), circus poster with Ankara wax colours for kids reading, giant letterforms for SaaS pricing.
- Worst directions and why: a mechanic that does not exist on the page (a progress bar on a plan picker and on a listing page, a total on onboarding); region misses on Gulf briefs (Persian rug borders and Mesopotamian seals on Saudi and GCC briefs, Egyptian cinema on a GCC OTA); clashing pairs (Frutiger Aero with Talavera tiles, a cross-stitch boxing poster for Ramadan); rule-only directions with no idea ("only one accent color", "no rounded corners", "giant chevrons").
- Patterns in bad references: the eSIM topic collapsed to "picker", so the UI lanes returned date, colour and AI pickers (1 of 16 on page). The Ramadan food offers brief got prayer apps and no food delivery. Gallery lanes (screensdesign, nicelydone, lapa) often return off-page screens. Art lanes are the strongest part: concrete objects and named traditions return real, on-idea images, while stacked style words drift to modern lookalikes (club flyers, modern Egyptian posters, a Jamini Roy horse for Dala). Many "good" UI results are on page but generic Dribbble concepts, so precision overstates usefulness.

## Phase 0 after

- Run: `bench/runs/2026-10-15b/` (branch `next/p0-taste-impl`: all of Phase 0, P0-01 to P0-17, with the
  P0-17 step 3 taste lanes, routing and title rules)
- Same 10 briefs, 3 directions each, same round robin: 18 of 30 directions searched (144 Serper credits,
  budget 150). 28 of the 30 direction ids are the same as the baseline; P0-07 replaced two (eSIM:
  Mesopotamian seals became mashrabiya in limestone; Ramadan: Persian rug borders became Sadu borders).
- Rated by: Claude (agent) on 2026-10-15, from contact sheets of the hotlinked results in headless Chrome
  (screenshots deleted after rating). A different agent rated the baseline, so small differences are
  rater noise; the owner should spot check both.
- Great share: computed from `ratings.json` (top 8 UI per searched direction); `score.mjs` reports good
  or great only.

| Metric | Baseline (2026-10-15) | After Phase 0 (2026-10-15b) | Target |
| --- | --- | --- | --- |
| Brief relevance | 13.3% (4 of 30) | 13.3% (4 of 30) | 80% or more |
| Spec coherence (checkCoherence failures; rated median) | not in the engine; median 3 | 0 of 30 fail; median 3 | 0 |
| Query overlap (score.mjs) | 23 shared UI queries (8 of 8 boards) | 21 (8 of 8 boards) | 0 |
| Query overlap without the baseline (fidelity) lane | 10 | 9 | 0 |
| Reference precision (good or great, top 8 UI) | 61.1% (88 of 144) | 69.5% (98 of 141) | 75% or more |
| **Great share (top 8 UI)** | **5.6% (8 of 144)** | **13.5% (19 of 141)** | rising (P0-17) |
| Great share, mobile briefs | 3.8% (3 of 80) | 13.0% (10 of 77) | |
| Wow (median) | 3 | 3 | Median 4 |
| Cost (Serper credits per search) | 8 (about 24 per board) | 8 (about 24 per board) | 15 or fewer per board |

Notes:

- **P0-17 is met on this bench.** The share of great UI references rose from 5.6% to 13.5%, and no brief's
  bend quality dropped: 27 directions rate the same, three rate higher (eSIM mashrabiya 2/2/2 to 3/3/3,
  eSIM ruler ticks coherence 2 to 3 with the progress bar now on the pick, compare, buy steps, Ramadan
  Sadu borders relevance 2 to 3).
- **Where the great results came from:** the taste lane (9 of 34 great, was 2 of 40), 60fps on the flight
  checkout (3 of 5 great: CRED swipe to pay, Airbnb card payment, Apple Pay), and the "Welcome Screen UI
  from {App} iOS App" pins on banking onboarding (Revolut, Superlist, Alive, Airchat). ScreensDesign is
  gone from mobile (18 baseline slots, 0 great). The eSIM board is on page now (13 of 16 eSIM screens,
  was 2 of 16), thanks to the P0-16 topic.
- **Query overlap is mostly a bench artifact.** The bench does not wire the canvas baseline, so every
  direction reruns the fidelity lane and the light twin. Without them, 9 queries are still shared: the
  taste lane is a brief level lane now ("dark {phrase} ui ios app" is the same for every direction with
  no user taste), and a thin direction's extra request can repeat a query. bend_brief's `searchQueries`
  still share nothing (P0-05 test).
- **Worst remaining failure patterns:**
  1. The mobile Pinterest taste lane drifts when the page has no Pinterest series: "dark ramadan offers
     ui ios app" returned a District profile, Andante and Flighty paywalls and a MasterClass welcome
     screen (0 of 5 on page), and "dark esim plan ui ios app" and "dark flight checkout ui ios app" kept
     nothing. The series wording works for paywall, welcome and wallet pages only.
  2. Ramadan food offers is still the worst board: prayer, timer and calendar apps, no food delivery
     (2 of 16 on page).
  3. The web app "dark mode minimal" lane loses the topic: bar-quality dark dashboards, but sales and
     analytics, not resident services. Nicelydone's one head word ("government") returned a landing page.
  4. Website taste and bridge lanes still return kits and neighbours (button sheets, a furniture store,
     dashboards on a pricing brief); bridge lanes kept 3 results in 18 searches.
  5. Bend: relevance is unchanged at 13.3%. Twists unrelated to the title (film frames on mashrabiya,
     stitches on a slide mount), Frutiger Aero with Talavera, Egyptian cinema on a Gulf brief, a total
     frame on onboarding and a progress bar on a listing page all pass checkCoherence.

## Gold sets and crop accuracy (2026-10-16)

- Gold sets are agent-made at the owner's request (DECISIONS.md, 2026-10-16): `bench/gold/ratings-gold.json`
  (100 J10 ratings) and `bench/gold/crops-gold.json` (200 J11 parts on 39 UI references).
- Default crops (`npx tsx scripts/crop-iou.ts`): ROLE_BANDS 0.141 mean IoU, 0.5% of parts at 0.8 or more. The
  unreviewed J1 page anatomies (`--anatomy`, 162 pages) do not help: 0.134 mean, 1.5% at 0.8 or more. Most
  gold images are presentations (several phones or a window on a backdrop), where a fixed band cannot land.
- Agent crops (J11, Sonnet 5.5 with vision at the cut size, `atlas-build/jobs/j11-crops.ts`, $0.28): the plain
  cut_parts instruction scores 0.708 mean IoU, 55% at 0.8 or more, 81% at 0.5 or more (195 parts; one reply did
  not parse); the tuned measuring rules score 0.698 on the same parts (0.69 on all 200), also 55% at 0.8. The
  tuned prompt does not beat the plain one, so the cut_parts text stays as it is. Weakest roles: toolbar,
  content, status-header and tabbar (about 0.3 to 0.6); strongest: sidebar, sheet, list, chart, cta (0.8 to 0.93).
  Gate 3 asks 0.8 mean: agent crops are not there yet.

## Gate 2: Atlas engine (2026-10-16)

- Branch `next/gate-2` (from `next/phase-1`, d98d2ab, then the owner's taste picks 3b90c77). Engine: `BEND_ENGINE=atlas`
  over a local Atlas built from every committed raw file (`atlas-build/out/server/v1`, 184 shards, manifest
  `fa6a3a8eec8d`). The CC0 index (J9) is not in it: `j9-cc0 --from-raw` refetches 27,000 museum records and did not
  finish, so the art lane ran without CC0 items. The Atlas answered 7 of 10 briefs; banking onboarding, fitness
  empty state and kids reading fell back to the word lists.
- Three runs, same 10 briefs, same 18 of 30 directions searched (144 Serper credits each): `bench/runs/2026-10-16g2a`,
  `g2b`, `g2c`. Bend is deterministic (the same 30 directions each time) and 88% of the references repeat, so the
  runs are close to one measurement taken three times.
- Rated by Claude (agent), from contact sheets of the hotlinked results, against `docs/taste-bar.md` and the
  owner's 120 taste picks (notes in `atlas-build/data/j7-taste-notes.md`). Run a was rated in full; b and c reuse
  a's rating for every reference they share and rate only the 18 new ones. Not the owner's ratings: spot check.
- J7 inputs: 1,644 page wordings (6 for each of 274 page and platform pairs), judged on the new picks notes. The 2,248
  art wordings wait for a top-up.

| Metric | Baseline (10-15) | Phase 0 (10-15b) | Atlas a | Atlas b | Atlas c | Target |
| --- | --- | --- | --- | --- | --- | --- |
| Brief relevance | 13.3% (4 of 30) | 13.3% (4 of 30) | 20% (6 of 30) | 20% (6 of 30) | 20% (6 of 30) | 80% or more |
| Spec coherence (failures; rated median) | median 3 | 0 of 30; median 3 | 0 of 30; median 3 | 0 of 30; median 3 | 0 of 30; median 3 | 0 |
| Query overlap (shared UI queries) | 23 | 21 | 21 | 21 | 21 | 0 |
| Reference precision (good or great, top 8 UI) | 61.1% | 69.5% (98 of 141) | 57.4% (81 of 141) | 57.1% (80 of 140) | 60.3% (85 of 141) | 75% or more |
| **Great share (top 8 UI)** | 5.6% | 13.5% (19 of 141) | 12.8% (18 of 141) | 11.4% (16 of 140) | 12.1% (17 of 141) | rising |
| Wow (median) | 3 | 3 | 3 | 3 | 3 | 4 |
| Cost (Serper credits per board) | about 24 | about 24 | 24 | 24 | 24 | 15 or fewer |

### J10 judge (Opus 5.5 with vision, trusted only at 75% agreement or more with the gold set)

| Metric | Agreement with gold | Trusted |
| --- | --- | --- |
| Brief relevance | 73.3% (22 of 30) | no |
| Spec coherence | 100% (30 of 30) | yes |
| Wow | 93.3% (28 of 30) | yes |
| Reference precision | 84.3% (59 of 70) | yes |
| Great share | 82.9% (58 of 70) | yes |
| Reference verdict (exact) | 70% (49 of 70) | no |

On the trusted metrics the judge scores the three runs at: precision 43.3%, 40.7%, 43.3%; great share 7.1%, 7.9%,
7.8%; coherence median 3; wow median 2, 3, 3. It is stricter than the agent rater (precision 43% against 58%, great 7.6%
against 12.1%), and it was calibrated on the 2026-10-15b ratings, so use the judge for comparing runs and the agent
ratings for comparing with the two earlier tables. Judge relevance (33% to 40% on brief) is not trusted. Cost of J10:
$1.68.

### Gate 2 verdict (plan section 9: 80% on brief, 0 shared queries, 0 coherence failures)

- **80% on brief: not met.** 20% (6 of 30) on every run, up from 13.3%. The six: bars instead of numbers on the eSIM
  picker, the dhow plank progress on flight checkout, dala painting on the fitness empty state, square Kufic on Dubai
  real estate, the Ankara circus poster on kids reading, tabular figures on Qatar services. The Atlas picks
  ingredients that fit the page but still pairs them with unrelated textures and eras (Frutiger Aero for eSIM, manila
  folder, paper planes and mica for a Saudi Ramadan food page, a total frame on banking onboarding), and none of the
  Ramadan directions has anything to do with food delivery or the Gulf.
- **0 shared queries: not met on the raw count, bench artifact for most of it.** 21 shared UI queries in 8 of 8
  boards, the same as Phase 0. The bench does not wire the canvas baseline lane, so every direction reruns the
  fidelity lane and the taste lane repeats its brief-level wording.
- **0 coherence failures: met.** `checkCoherence` flags 0 of 30 on all three runs (the rated median is 3, so the check
  is permissive).
- **Not a win over Phase 0 on references.** Great share 12.1% mean against 13.5%, precision 58.3% mean against 69.5%.
  The Atlas improves relevance (13.3% to 20%) and the bend variety, but the reference lanes are the same code as
  Phase 0 and the pages the Atlas names for the ramadan, esim and saas briefs return neighbours (prayer apps, landing
  pages and dashboards on a pricing brief, empty-state kits on fitness). Gate 2 is not passed.
- J7 (search fix): 1,439 of the 1,644 wordings were judged on 4 or more usable thumbnails (205 returned too few
  item pages), 367 recipes kept (best 2 per key at precision 0.5 or more) for 206 of the 274 keys, and 68 keys dropped
  with no wording at 0.5 (list in `atlas-build/review/j7-recipes-dropped.json`, mostly tablet and web app pairs).
  I checked 5 trial wordings by eye on the thumbnails (plan picker on iOS returned calendars and planners): the judge's
  bad calls agreed with mine on all of them.
- Spend: Serper 2,144 credits (J7 1,712, three runs 432; 356 left on the account); Claude $6.89 ($5.03 J7, $0.18
  taste notes, $1.68 J10).

## Gate 2 fix (2026-10-16)

- Branch `next/gate2-fix` (from `next/phase-1`, 76faa3c). Diagnosis and the fixes: `bench/GATE2-DIAGNOSIS.md`.
  Atlas: rebuilt from every committed raw file, now with the CC0 index (`atlas-build/out/server/v1`, 228 shards,
  manifest `ed9f4297b5fe`; 184 shards as in g2a plus 44 CC0 shards, 7,786 items). The Atlas answered 10 of 10 briefs.
- Three runs, same 10 briefs, budget 150 each:
  - `g2d`: all fixes, the canvas baseline wired in the bench and no request sent twice on one board (the product).
  - `g2e`: g2d plus the bridge lane cap (one UI place) and a direction's own taste wording when the brief-level
    one already ran. The bend is the same as g2d (same 30 directions).
  - `g2f`: g2e's engine with `--no-baseline` (every direction reruns the brief-level lanes, as g2a did), to
    compare the engine and recipe fixes with g2a on equal terms.
- Rated by Claude (agent) as g2a was: contact sheets of the hotlinked results against `docs/taste-bar.md` and the
  owner's picks; references already rated on the same brief in g2a to g2c (same reference id or image) reuse
  that rating, 94 new ones were rated by eye (55, 26, 13). Directions were rated once (g2d) and the rating reused
  for g2e and g2f (identical directions). Not the owner's ratings: spot check.

| Metric | Phase 0 (10-15b) | Atlas g2a | Fix g2d | Fix g2e | Fix g2f (old bench setup) | Target |
| --- | --- | --- | --- | --- | --- | --- |
| Atlas answered | n/a | 7 of 10 | 10 of 10 | 10 of 10 | 10 of 10 | |
| Brief relevance (4 or 5) | 13.3% (4 of 30) | 20% (6 of 30) | 20% (6 of 30) | 20% (6 of 30) | 20% (6 of 30) | 80% or more |
| Relevance mean (1 to 5); directions rated 1 | 3.03; 0 | 2.43; 5 | 2.73; 0 | 2.73; 0 | 2.73; 0 | |
| Spec coherence (failures; rated median) | 0 of 30; median 3 | 0 of 30; median 3 | 0 of 30; median 3 | 0 of 30; median 3 | 0 of 30; median 3 | 0 |
| Query overlap (shared UI queries) | 21 | 21 | **0** | **0** | 19 | 0 |
| Reference precision (good or great, top 8 UI) | 69.5% (98 of 141) | 57.4% (81 of 141) | 56.0% (75 of 134) | 59.5% (78 of 131) | 65.7% (92 of 140) | 75% or more |
| **Great share (top 8 UI)** | 13.5% (19 of 141) | 12.8% (18 of 141) | 6.7% (9 of 134) | 7.6% (10 of 131) | 13.6% (19 of 140) | rising |
| Directions searched | 18 | 18 | 20 | 19 | 18 | |
| Wow (median) | 3 | 3 | 3 | 3 | 3 | 4 |
| Cost (Serper credits per search) | 8 | 8 | 7.1 | 7.5 | 8 | |

Notes:

- **What moved.** Zero shared queries is met in the product setup (g2d, g2e). On equal bench terms (g2f against
  g2a) the engine and recipe fixes bring precision back from 57.4% to 65.7% and great share from 12.8% to 13.6%,
  close to Phase 0. The fidelity lane is 82% good again (54 of 66) now that page-only recipes no longer replace
  the topic wording.
- **The trade-off.** With no request sent twice on a board, the second and third directions lose the brief-level
  lanes (fidelity, mobile taste), which hold most of the good and great results, so per-direction precision and
  great share fall (g2e 59.5% and 7.6%). Before, a rerun of the same request gave the next direction the next
  results of that request (the canvas dedupe skipped the ones already placed); now no request is paid for twice,
  and those deeper results are not fetched. A next step: one deeper brief-level request shared out across the
  board's directions.
- **Relevance did not move past 20%.** The right domain removed every direction rated 1 (mean 2.43 to 2.73), but
  the card draw inside the domain is still generic (GATE2-DIAGNOSIS.md cause 5).
- **J10 judge** (the batch `msgbatch_016e1k3y2b59B3KdWYxJKhsX`, resumed in round 2, $1.23): on its trusted metrics
  g2e precision 44.3% (58 of 131), great 6.9%; g2f precision 32.1% (45 of 140), great 6.4%; coherence and wow median
  3 on both. Relevance agreement with the gold is 70% this time, still under the 75% trust bar.
- **Gate 2 verdict: not passed.** 0 shared queries and 0 coherence failures are met; 80% on brief is not (20%).
- Spend: Serper 423 credits by the account balance (2,500 before, 2,077 after; the bench counted 141, 142 and 144 requests); Claude
  $0 so far (the J10 batch is billed when it finishes; no other API calls).

## Gate 2 round 2 (2026-10-16)

- Branch `next/gate2-r2` (from `next/phase-1`, ce65aa1). What changed (details in `bench/GATE2-DIAGNOSIS.md`, round 2):
  1. **J4b page fit** (`atlas-build/jobs/j4b-page-fit.ts`, kind `page-fit`, one shard per domain): for each of the 60
     domains, its top 40 cards by J4 fit (rule and layout cards left out) against the 12 pages that matter for it (the
     Bench briefs' pages of the domain, pages named like the domain, then the core pages), each pair scored 0 to 3 with
     a short reason. Opus 5.5, batch, every page summary in the cached prefix: 28,800 pairs, 1,007 scored 3 (3.5%),
     0 rejects, $4.17 (budget j4b $12). The bend leads with the page score (`leadFit`; a card the page fit did not judge
     counts its domain fit less 2) and gives the page reason as the why.
  2. **Rule and layout cards never lead** (`isRuleCard`: constraints and "controls and UI bits" elements). As the second
     card they add their rule to the layout. Leads that were rules: 6 of 30 in g2d, 0 in g2g to g2i.
  3. **J7 topic slot**: kept page recipes on Pinterest, Dribbble and Behance are templates ("dark minimal {topic} landing
     page website ui", 338 of 367), filled at run time with the brief's topic (`briefTopic`: the product noun, else the
     domain name the brief holds, else its words the domain's names share). Rebuilt from raw, no Serper. Gallery recipes
     stay page-only: in g2g "coffee shop landing page" on SiteInspire and "analytics SaaS pricing page" on Awwwards kept
     0 results. The round 1 guard (topic and Phase 0 precision) is unchanged.
  4. **One deep shared request per board**: the first direction search also asks the fidelity lane's page 2, and what the
     brief-level lanes (fidelity, taste) found but did not place is kept on the canvas baseline as a pool (at most 16);
     each later direction takes up to 4 (`lib/sources/baseline.ts`). No request is sent twice.
  5. **CC0 art in the bench**: `scripts/bench-run.mjs` never passed `allowImage` or `loadTakedowns` to search_references.
     The museum hosts are on the allowlist, but with no `allowImage` the plan refuses every CC0 item, and the merge needs
     the takedown list. Wired as the live tool wires them: 5 CC0 results show per run. CC0 matching is stricter (two
     shared words, or one telling word the item's title or motif names).
  6. Fixes found by run g2g: an empty fidelity lane is still saved on the board (its request ran twice on coffee), and
     pooled results push out art past the art quota when a direction has little UI of its own.
  7. The one more evidence-based fix after g2h: the mechanic lands on the element the lead's page reason names
     (`reasonElements`). In g2g and g2h, 6 of the 14 directions off brief had their idea built on another element
     ("each finished step lands as stamp" built as a divider).
- Atlas: local, built from the committed raw files plus `raw/j4b-page-fit.jsonl` (`atlas-build/out/server/v1`, 288 shards,
  manifest `dc639915fe6b`). Not uploaded.
- Three runs, same 10 briefs, budget 150 each, product setup (canvas baseline wired):
  - `g2g`: items 1 to 5.
  - `g2h`: g2g plus item 6 (same 30 directions as g2g).
  - `g2i`: g2h plus item 7 (same cards; 9 directions build their mechanic on another element).
- Rated by Claude (agent) as in round 1: contact sheets of the hotlinked results in headless Chrome against
  `docs/taste-bar.md` and the owner's picks. References rated on the same brief in an earlier run reuse that rating (100,
  124 and 134); the rest were rated by eye (37, 30 and 15). Directions were rated from their specs. Not the owner's
  ratings: spot check.

| Metric | Phase 0 (10-15b) | Fix g2e | R2 g2g | R2 g2h | R2 g2i | Target |
| --- | --- | --- | --- | --- | --- | --- |
| Brief relevance (4 or 5) | 13.3% (4 of 30) | 20% (6 of 30) | **53.3% (16 of 30)** | **53.3% (16 of 30)** | **56.7% (17 of 30)** | 80% or more |
| Relevance mean (1 to 5) | 3.03 | 2.73 | 3.53 | 3.53 | 3.57 | |
| Spec coherence (failures; rated median) | 0 of 30; median 3 | 0 of 30; median 3 | 0 of 30; median 3 | 0 of 30; median 3 | 0 of 30; median 3.5 | 0 |
| Query overlap (shared UI queries) | 21 | 0 | 1 | **0** | **0** | 0 |
| Reference precision (good or great, top 8 UI) | 69.5% (98 of 141) | 59.5% (78 of 131) | 58.4% (80 of 137) | 55.8% (86 of 154) | 55.0% (82 of 149) | 75% or more |
| Great share (top 8 UI) | 13.5% (19 of 141) | 7.6% (10 of 131) | 10.9% (15 of 137) | 10.4% (16 of 154) | 9.4% (14 of 149) | rising |
| Directions searched | 18 | 19 | 19 | 20 | 20 | |
| CC0 results shown | 0 | 0 | 5 | 5 | 5 | |
| Wow (median) | 3 | 3 | 3 | 3 | 3 | 4 |
| Serper credits (per search) | 144 (8) | 142 (7.5) | 142 (7.5) | 145 (7.3) | 142 (7.1) | |

J10 judge on the same runs (batch, $1.75). Calibration on the gold this time: relevance 80% agreement (trusted for the
first time, it was 73.3% and 70%), coherence 96.7%, wow 90%, precision 84.3%, great 85.7%.

| Judge metric | g2e | g2f | R2 g2g | R2 g2h | R2 g2i |
| --- | --- | --- | --- | --- | --- |
| Brief relevance (4 or 5) | 63.3% (19 of 30) | 60% (18 of 30) | 73.3% (22 of 30) | 79.3% (23 of 29) | **80% (24 of 30)** |
| Reference precision | 44.3% | 32.1% | 49.6% (68 of 137) | 48.7% (75 of 154) | 42.3% (63 of 149) |
| Great share | 6.9% | 6.4% | 6.6% | 4.5% | 4% |
| Coherence; wow (median) | 3; 3 | 3; 3 | 3; 3 | 3; 3 | 4; 3 |

The judge is more lenient on relevance than the agent rater (80% against 56.7% on g2i) and stricter on references.
g2e and g2f were judged before this calibration, when relevance was not trusted.

Notes:

- **Relevance moved from 20% to 53 to 57%** (mean 2.73 to 3.57). The page fit picks cards that serve the page's job and
  says so ("Stacked lit prices per data plan", "Each finished step lands as stamp", "Empty sash invites first patch"),
  where the domain fit said "Sport gear suits fitness". 13 of 30 are still off brief: cards that serve the page but not
  the brief's world, a Gulf card from the wrong country or on a global brief, and ideas that name a protected element.
- **References did not move.** Precision 55 to 58% against 59.5% (g2e) and 69.5% (Phase 0); great share 9.4 to 10.9%
  against 7.6% (g2e). The later directions now show more UI results (51 in g2e, 69 to 74 now) at about the same
  precision: pooled results are 55 to 58% good (15 of 26 in g2h, 14 of 27 in g2i). Two boards pull precision down in
  every run: Ramadan food offers (1 or 2 good of 12 to 14: prayer apps; the Phase 0 topic "ramadan offers" drops the food
  delivery) and SaaS pricing (5 to 7 of 16: the fidelity wording returns analytics dashboards). Real estate is 14 to 15
  of 16.
- **Gate 2 verdict: not passed on the agent ratings** (the same method as every earlier table). 0 shared queries (g2h,
  g2i) and 0 coherence failures are met; 80% on brief is not (56.7% at best). The J10 judge, now trusted on relevance,
  scores g2i at exactly 80%, so the gate turns on the rater: the owner's spot check of the g2i directions decides.
  What remains: `bench/GATE2-DIAGNOSIS.md`, round 2.
- Spend: Serper 429 credits (142, 145, 142; budget 450). Claude $7.15: J4b $4.17 (budget $12), J10 $2.98 (resume
  $1.23, round 2 runs $1.75; cap $5).

## Gate 2 round 3 (2026-10-16)

- Branch `next/gate2-r3` (from `next/phase-1`, aa01854). What changed (details in `bench/GATE2-DIAGNOSIS.md`, round 3):
  brief-level fit (`lib/atlas/brief-fit.ts`), Gulf places, a theme only from a whole name or an occasion, the `plan`
  mechanic part and must-keep conflicts, J1 and J2 search hints (`lib/atlas/search-hints.ts`), the recipe guard (6
  judged results, no style words in a fidelity recipe) and the taste lane wording. All deterministic: no new J job.
- Atlas: local, rebuilt from the committed raw files (`atlas-build/out/server/v1`, 288 shards, manifest
  `6b856111260d`); the dry bend reproduced all 30 g2i direction ids before any change. Not uploaded.
- Two runs, same 10 briefs, budget 150 each, product setup (canvas baseline wired). The bend is the same in both (30
  identical directions); g2k differs only in the occasion search topic ("ramadan food delivery" in place of
  "ramadan food delivery offers", after g2j left one Ramadan direction with no UI result).
- Rated by Claude (agent) as in rounds 1 and 2: references rated on the same brief in an earlier run reuse that rating
  (117 and 126), the rest by eye from contact sheets of the hotlinked results in headless Chrome against
  `docs/taste-bar.md` (24 and 19). Directions were rated from their specs; a direction reuses an earlier rating only
  when its id, title, mechanic and why are all the same (1 of 30), since most mechanics moved. The same agent wrote the
  fixes, so the J10 judge below is the independent check. Not the owner's ratings: spot check.

| Metric | Phase 0 (10-15b) | R2 g2i | R3 g2j | R3 g2k | Target |
| --- | --- | --- | --- | --- | --- |
| Brief relevance (4 or 5), agent | 13.3% (4 of 30) | 56.7% (17 of 30) | **83.3% (25 of 30)** | **83.3% (25 of 30)** | 80% or more |
| Brief relevance (4 or 5), J10 judge | n/a | 80% (24 of 30) | 73.3% (22 of 30) | 73.3% (22 of 30) | 80% or more |
| Relevance mean (1 to 5), agent | 3.03 | 3.57 | 3.83 | 3.83 | |
| Spec coherence (failures; rated median) | 0 of 30; median 3 | 0 of 30; median 3.5 | 0 of 30; median 3 | 0 of 30; median 3 | 0 |
| Query overlap (shared UI queries) | 21 | 0 | **0** | **0** | 0 |
| Reference precision (good or great, top 8 UI), agent | 69.5% (98 of 141) | 55.0% (82 of 149) | **68.1% (96 of 141)** | 62.8% (91 of 145) | 75% or more |
| Great share (top 8 UI), agent | 13.5% (19 of 141) | 9.4% (14 of 149) | 11.3% (16 of 141) | 11.7% (17 of 145) | rising |
| Reference precision; great share, J10 | n/a | 42.3%; 4% | 51.8%; 7.8% | 48.3%; 6.2% | |
| Directions searched | 18 | 20 | 21 | 21 | |
| Wow (median) | 3 | 3 | 3 | 3 | 4 |
| Serper credits (per search) | 144 (8) | 142 (7.1) | 144 (6.9) | 143 (6.8) | |

J10 calibration this time ($1.29, batch `msgbatch_01FkgKyAJ7sqnGKwmMMzq1Ve`): relevance 76.7% agreement with the gold
(trusted), coherence 96.7%, wow 93.3%, precision 84.3%, great 88.6% (all trusted).

Per brief, agent precision g2j / g2k: banking 75 / 69%, coffee 75 / 75%, Dubai 81 / 81%, eSIM 81 / 81%, fitness 83 /
70%, flight 50 / 43%, kids 75 / 69%, Qatar 25 / 31%, Ramadan 100% (3 of 3) / 67% (6 of 9), SaaS pricing 63 / 44%.
No result in either run is a dashboard on SaaS pricing or a prayer app on Ramadan.

Notes:

- **Relevance moved from 56.7% to 83.3% on the agent ratings.** 9 of the 13 g2i directions off brief are fixed: the
  Gulf region misses (4) leave their boards, the plan ideas build on the plan cards (3), and Swiss, Ankara, ice cream
  truck, Scandinavian and tally marks give way to cards tied to the brief. 5 are rated 3: Walnut Veneer, Arcade
  Cabinet, Dotted Leaders, Ruler Ticks and Game Cartridge.
- **The J10 judge moved the other way, from 80% to 73.3%.** Of the 5 the agent rates 3, it rates Dotted Leaders and Ruler
  Ticks 3 too, and Walnut, Arcade and Game Cartridge 4. It marks down 9 directions the agent rates 4 (in one run or
  both), nearly all for the second card or the twist: a receipt texture on the eSIM board, a tiffin carrier
  (South Asian) on the Saudi souq sign, an Ankara 1930s texture on the Dubai wind towers, the Nafath reason (a Saudi
  login) on a global banking brief. The brief-level fit scores the lead card; the second card is still drawn by
  seeded jitter from the candidates, with no brief fit. That is the next fix, and it is free: rank the second card by
  the same brief fit, and give a reason that names a Gulf system the same cost on a brief with no market.
- **Precision is back toward Phase 0**: 68.1% in g2j (the recipe guard and the taste wording; the fidelity lane is 76%
  good, 59% in round 2) and 62.8% in g2k, where SaaS pricing fell to 7 of 16 (its Phase 0 wording now returns SaaS
  landing pages without a pricing section). Zero shared queries held.

### Gate 2 verdict (plan section 9: 80% on brief, 0 shared queries, 0 coherence failures)

- **On the agent ratings (the rater of every earlier table): met.** 83.3% on brief on both runs, 0 shared queries, 0
  coherence failures.
- **On the J10 judge (trusted on relevance, 76.7% agreement): not met.** 73.3% on both runs.
- So Gate 2 passes only on the agent rater, and that agent also wrote the fixes. The two raters disagree on 9 of 30
  directions, mostly on the second card. The owner's spot check of g2j decides which rater the gate follows. The
  second card fix above should move both raters, and costs nothing.
- Spend: Serper 287 credits (144 and 143; budget 300; the account went from 1,200 to 713 while another agent also
  used it). Claude $1.29 (J10; cap $3). No J job for the bend.

## Gate 2 final (2026-10-17)

- Branch `next/gate2-final` (from `next/phase-1`, 9369400, which holds the second card fix of round 3b). One run, `g2l`,
  the same 10 briefs, budget 150, product setup (canvas baseline wired, `--atlas`). Atlas: rebuilt locally with every
  job `--from-raw` and `ops.ts layout` (288 shards, manifest `c0d5a6a01cfe`, no API calls, not uploaded). A dry bend
  before the run gave the same 30 leads as g2j and g2k; 17 of the 18 second cards differ, as in the round 3b dry run.
- Rated by Claude (agent) as in g2j and g2k, against `docs/taste-bar.md` and the owner's picks (`bench/taste/picks.json`,
  UI genres). References rated on the same brief in an earlier run reuse that rating (138 of 147); 9 new ones were
  rated by eye from a contact sheet (7 good, 2 bad: a SaaS landing page with no pricing section, a wireframe style gov
  page). Directions were rated from their specs, all 30 fresh since the second card changed their ids. Craftwork, Best
  Designs on X and x.com items were never model inputs (none were in the new set). The same agent wrote the fixes, so
  the J10 judge is the independent check. Not the owner's ratings: spot check.

| Metric | Phase 0 (10-15b) | R3 g2j | R3 g2k | Final g2l | Target |
| --- | --- | --- | --- | --- | --- |
| Brief relevance (4 or 5), agent | 13.3% (4 of 30) | 83.3% (25 of 30) | 83.3% (25 of 30) | **86.7% (26 of 30)** | 80% or more |
| Brief relevance (4 or 5), J10 judge | n/a | 73.3% (22 of 30) | 73.3% (22 of 30) | 90% (27 of 30), not trusted this round | 80% or more |
| Relevance mean (1 to 5), agent | 3.03 | 3.83 | 3.83 | 3.87 | |
| Spec coherence (failures; rated median) | 0 of 30; median 3 | 0 of 30; median 3 | 0 of 30; median 3 | 0 of 30; median 4 | 0 |
| Query overlap (shared UI queries) | 21 | 0 | 0 | **0** | 0 |
| Reference precision (good or great, top 8 UI), agent | 69.5% (98 of 141) | 68.1% (96 of 141) | 62.8% (91 of 145) | 70.7% (104 of 147) | 75% or more |
| Great share (top 8 UI), agent | 13.5% (19 of 141) | 11.3% (16 of 141) | 11.7% (17 of 145) | 12.9% (19 of 147) | rising |
| Reference precision; great share, J10 | n/a | 51.8%; 7.8% | 48.3%; 6.2% | 47.6% (70 of 147); 7.5% (11 of 147) | |
| Directions searched | 18 | 21 | 21 | 21 | |
| Wow (median) | 3 | 3 | 3 | 3 | 4 |
| Serper credits (per search) | 144 (8) | 144 (6.9) | 143 (6.8) | 143 (6.8) | |

J10 calibration this time (one scored run, $0.89, batch): relevance 69% agreement with the gold (20 of 29), under the 75%
trust bar and down from 76.7% in round 3. Over four calibrations on the same gold directions it has been 70%, 80%,
76.7% and 69%, so relevance sits on the trust line. Coherence 96.6%, wow 93.1%, precision 81.4% and great 85.7% are
trusted. One calibration record was rejected as malformed. Because relevance is not trusted, the judge's 90% is
indicative only.

Notes:

- **The second card fix moved both raters up.** Agent relevance 83.3% to 86.7%, judge 73.3% to 90%. The foreign second
  cards the judge marked down in round 3 (tiffin carrier on the Saudi souq sign, Ankara 1930s on the Dubai wind towers)
  are gone. Off brief for the agent: Walnut Veneer, Arcade Cabinet, Dotted Leaders and Game Cartridge, all leads with
  no tie to the brief's world (the same four as round 3; Ruler Ticks moved up with a marble texture).
- **The raters agree on 25 of 30 directions** on the line at 4. The judge marks down Fingerprint (Nafath reason on a
  global banking brief), Dotted Leaders and Wool Felt (a back button on a home screen); it marks up Walnut Veneer,
  Arcade Cabinet and Game Cartridge.
- **References are back near Phase 0 on the agent rater** (70.7% against 69.5%, great share 12.9% against 13.5%) and
  above g2j and g2k. 138 of 147 were seen before, so this is mostly the same pool; the SaaS pricing and Qatar boards
  stay the weakest.
- **The judge is stricter on references** (47.6% against 70.7%), as in every round; use it to compare runs.

### Gate 2 final verdict (plan section 9: 80% on brief, 0 shared queries, 0 coherence failures)

- **Agent rater: met.** 86.7% on brief, 0 shared queries, 0 coherence failures.
- **J10 judge: met on the number (90%), but relevance is not a trusted metric this round (69% agreement).**
- **Gate 2 passes on both raters, with the caveat that the judge's relevance is untrusted.** The owner's spot check of
  g2l is still the deciding evidence, since the agent that rated also wrote the fixes.
- Not a gate criterion: reference precision 70.7% (agent) is under the 75% target.
- Spend: Serper 143 credits (the bench count; the account stays above the 350 floor). Claude $0.89 (J10, cap $2); no
  other API calls, no J job for the bend.

## Refinement R3: judge calibration and crops (2026-10-17)

Branch `next/refine-r3` (from `next/phase-1`, e7dfb28). Jobs in `atlas-build/jobs/`: `r3-judge.ts` (pass 1),
`r3-judge-adj.ts` (second pass and report), `r3-crops.ts`, `r3-gold.ts`. All Message Batches with cached prefixes,
under the spend guard (budget `r3`, $23). Spend: $9.55 (r3-judge $7.49, r3-judge-adj $0.30, r3-crops $1.06,
r3-gold $0.70). No Serper.

### Round 1: J10 relevance (held-out gold only)

The old J10 prompt agreed with the 30 gold directions on the on-brief call 70%, 80%, 76.7% and 69% over four
calibrations. The R3 judge turns the relevance line into a rubric with three checks (page, world, idea), adds 12 gold
examples (text, with the gold scores and reason) and two votes; where the votes split on the on-brief call, a second
Opus pass decides. Measurement: per seed the 30 gold directions are split into 3 stratified folds, and each direction
is judged only by prompts whose examples come from the other two folds, so every scored item is held out. Seeds 1 to 3
reshuffle the folds.

| Judge | Seed 1 | Seed 2 | Seed 3 | Gold on brief found | Gold off brief found |
| --- | --- | --- | --- | --- | --- |
| Old J10 prompt (4 earlier calibrations, no split) | 70%, 80%, 76.7%, 69% (one per calibration) | | | 1 of 4 (last run) | 20 of 26 (last run) |
| v1 rubric, no examples, one vote | 90% | | | 1 of 4 | 26 of 26 |
| v1 rubric + 8 examples, final | 83.3% | 76.7% | 83.3% | 1 to 3 of 4 | 22 to 23 of 26 |
| **v2 rubric + 12 examples, final** | **86.7%** | **80%** | **80%** | 1 of 4 | 23 to 25 of 26 |
| v2, single votes (a, b) | 86.7%, 90% | 80%, 86.7% | 80%, 86.7% | | |

- **Target met: 80% or more on all 3 seeds** (mean 82.2%), and on all 6 single votes. Coherence within 1 is 89 of 90,
  wow 87 of 90. Relevance is a trusted metric again by the 75% rule.
- v1's rubric named gold items as its examples (dried leaves, giant chevrons), so its numbers are optimistic and it
  was dropped. v2's rubric uses examples that are not in the gold, adds wildness (a far world is on brief at wildness
  4 or 5 when it gives the page a clear voice) and lets a look that pulls in two directions lower relevance, which is
  how the gold rater scores it. The rubric was still written with the gold's reasons in view; only the examples are
  cross-fitted.
- The second pass changed little: 5 split votes in v2 (6 in v1, where the high-effort second pass sided against the
  gold in both trial items). In v2 it sees both votes' examples at medium effort.
- **Caveat: the gold has only 4 on-brief directions of 30**, so agreement mostly measures the off-brief call. The
  judge finds 1 of the 4 on-brief golds: it is strict. Read its on-brief rate as a lower bound, and grow the gold with
  on-brief items (round 3) before leaning on it.

**g2l rescored** (`bench/runs/2026-10-17g2l/ratings-judge-r3.json`: directions from the R3 v2 judge, two votes, no
split needed; references copied from J10's `ratings-judge.json`, whose reference prompt did not change):

| Metric | Agent | Old J10 (untrusted) | **R3 judge (trusted)** | Target |
| --- | --- | --- | --- | --- |
| Brief relevance (4 or 5) | 86.7% (26 of 30) | 90% (27 of 30) | **73.3% (22 of 30)** | 80% or more |
| Spec coherence (failures; median) | 0; 4 | 0; 3 | 0; 3 | 0 |
| Wow (median) | 3 | 3 | 3 | 4 |
| Reference precision (J10 verdicts) | 70.7% | 47.6% | 47.6% (same verdicts) | 75% or more |

The R3 judge and the agent agree on 20 of 30. Both put Dotted Leaders off brief. The judge puts 7 more off brief, all
for a thin idea (the world only skins one button, a header band or the dividers): Jebena Coffee Pot, Googie 1958,
Qamar al-Din, Ruler Ticks, Coral Stone Blocks, Emirati Barjeel and Stickers. It puts 3 of the agent's off-brief ones on
brief: Walnut Veneer, Arcade Cabinet and Game Cartridge. **On the trusted judge g2l is under the 80% bar (73.3%)**, so
Gate 2's pass rests on the agent rater and the owner's spot check. Given how strict the judge is on the 4 gold
on-brief items, the true rate is likely between the two. The judge's main complaint (the world shrinks to a skin on
one element) is a concrete target for the next bend fix.

### Round 2: crop accuracy (J11 follow-up)

`r3-crops.ts` splits the 39 gold images once (seeded, stratified on the weak roles): 20 dev images (105 parts) to
iterate on, 19 held-out (95 parts) for the ship decision. Sonnet 5.5, as J11. Mean IoU per gold part (no box scores 0):

| Prompt | Dev (2 repeats) | Held-out (2 repeats) |
| --- | --- | --- |
| plain (today's cut_parts look text) | 0.717, 0.735 (0.726) | 0.696, 0.709 (**0.702**) |
| roles (find the screen, then rules for status-header, tabbar, toolbar, content, bars hug) | 0.712, 0.706 (0.709) | not run (lost on dev) |
| roles-px (roles, edges answered in pixels and divided by the job) | 0.722, 0.715 (0.718) | 0.674, 0.710 (0.692) |
| bars (short bar and text-block rules only) | 0.706, 0.705 (0.706) | not run (lost on dev) |
| plain, parts listed screen by screen (an eval change, not a prompt) | 0.773 (1 repeat) | 0.729 (1 repeat) |

- **No prompt change ships.** No variant beats plain on dev, and the best one (roles-px) also loses on held-out
  (0.692 against 0.702). The cut_parts look text stays as it is. Plain scores 0.70 to 0.73 over 4 repeats, in line
  with J11's 0.708.
- The weak roles stay weak: status-header 0.33 to 0.66, tabbar 0.44 to 0.67, content 0.25 to 0.70, toolbar 0 to 0.73
  (2 to 11 parts per role and split, so noisy).
- **Much of the gap is which screen, not how tight.** On presentation images with 3 phones, a role asked once can
  sit on any phone, and the gold labeller picked one. Listing the parts screen by screen in the gold's order lifts
  plain by 0.03 to 0.05. A real agent knows which screen it wants, so the 0.8 gate is closer than 0.70 suggests, but
  the bench measures the grouped list. A fairer J11 eval (each part named with its screen) is the next step, not a
  new prompt.

### Round 3: gold growth (unconfirmed)

`r3-gold.ts` had Opus 5.5 (the R3 v2 judge prompt, 12 gold examples, high effort) propose ratings for the g2l items
that are not in the gold: 30 directions and 134 top 8 UI references (great 9, good 56, bad 69), each with a reason.
They are in `bench/gold-candidates/2026-10-17g2l.json` and `.md`, marked `confirmed: false`. Nothing reads that
folder, and the gold is unchanged. Owner action: review the rows (the on-brief directions matter most, since the gold
has only 4) and move the confirmed ones into `bench/gold/ratings-gold.json`.

## Refinement R4: directions act on the page (2026-10-17)

Branch `next/refine-r4` (from `next/phase-1`, 5e180c6). Job `atlas-build/jobs/r4-judge-dirs.ts` (job id `r3-dirs`,
budget r3): bends the 10 Bench briefs with the local Atlas (rebuilt `--from-raw`, manifest `72b82c4ee007`, no
Serper, `bench-run.mjs --dry --atlas`) into `bench/runs/r4-<tag>/`, then rates the 30 directions from their specs
with the R3 v2 judge exactly as its g2l score stage did (same system prompt, same 12 gold examples per vote, two
votes, the R3 second pass where they split). The directions are not searched, so the judge rates the idea alone.

| Bend | What changed | On brief (R3 judge, final) | Split votes |
| --- | --- | --- | --- |
| r4-0 | none (next/phase-1) | 73.3% (22 of 30), the same as g2l | 1 |
| r4-1 | page span, main part on the page, page parse | 96.7% (29 of 30) | 1 |
| **r4-2** | r4-1 plus wild spot fallback and task part ranking | **100% (30 of 30)** | 0 |

What changed in the bend (`lib/atlas/page-span.ts`, `lib/atlas/bend.ts`), deterministic, no model calls:

- **The mechanic spans the page.** Each direction names 2 or 3 parts from the page's J1 anatomy (its sections on
  this platform, then its wild spots), the mechanic's own part first and at least one flow part (steps, slides, a
  sheet) or structure part (plan cards, deal cards, listing rows, map, chart, hero). A part's line is the lead card's
  J4 line for that element (buildability 3 or more), else a J5 mechanic already loaded for it. Parts are ranked by
  kind, J1 wild spots, the J4b page reason's elements and required sections, and spread over the bend. A part a
  must-keep protects (the total, the main button, plan cards) is never named. `mechanic.parts` and `mechanic.task`
  carry them; the layout line and the prompt say them.
- **The main task works differently.** One sentence: the brief's own task list when it has one ("review the
  itinerary, add bags and seats, pay"), else the part's task ("comparing and picking a plan"), now runs through the
  part that carries the task most (wild spots and required sections first). Then the must-keep line.
- **The mechanic's own part is one the page has.** A section on this platform or a wild spot gains 3, a flow or
  structure element 1.5, and a page reason's element counts as named only when the page has it (r4-0 put a dotted
  leader total on an offers page with no total). Among named elements a structure one comes first ("offer" names the
  hero, the season banner, before the top bar).
- **Page parse.** A narrower page whose name holds the matched name's words and more of the brief wins ("kids reading
  app home screen" is kids-home, not app-home).

The judge's r4-0 complaint (the world only skins a button, a header band, nav chips or the dividers: Jebena, Googie,
Qamar al-Din, Ruler Ticks, Coral Stone, Barjeel, Stickers, Wool Felt) is gone from every r4-2 note; what remains are
coherence and wow notes (a twist that never shows, an expected idea). Caveats: specs only, no references (g2l was
rated with 4 UI and 2 art thumbnails); the judge was calibrated on gold with only 4 on-brief items, and the new
layout line says outright that the idea acts on the page, which is what its rubric asks, so a searched Bench run
and the owner's spot check should confirm it. Spend: $2.91 (r3-dirs).

### Crop test: each part names its screen

`r3-crops.ts` has a third list order, `screens`: the gold parts are grouped into screens by horizontal overlap
(counted from the left) and each part is asked for with its screen ("screen 2 of 3: status-header, cards"), as a
real agent that knows which screen it wants would. And a candidate cut_parts look line, `screen` (find the named
screen and its edges first, never cross into another screen). Held-out images (19, 95 parts), Sonnet 5.5:

| Prompt | List | Held-out mean IoU | At 0.8 or more |
| --- | --- | --- | --- |
| plain (today) | grouped (R3, 2 repeats) | 0.702 | 57 to 58% |
| plain (today) | screen by screen in gold order (R3, 1 repeat) | 0.729 | 58% |
| plain (today) | **each part names its screen** (2 repeats) | **0.732** (0.729, 0.736) | 63% |
| screen rule | each part names its screen (2 repeats) | 0.691 (0.679, 0.703) | 57% |

Naming the screen is worth 0.03 on held-out (the fairer J11 number is 0.73), still under the 0.8 gate. The screen
rule loses to plain, so **no cut_parts change ships**: the look text stays as it is. Spend $0.27 (r3-crops).
