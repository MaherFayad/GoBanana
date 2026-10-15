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
