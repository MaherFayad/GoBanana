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
| Crop accuracy | not measured (needs `bench/gold/`) | 0.8 or more |
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
