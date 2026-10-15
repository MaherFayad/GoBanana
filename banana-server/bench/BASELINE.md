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

- Run: `bench/runs/2026-10-15/` (commit: ________)
- Briefs: 10 (`bench/briefs.json`), 3 directions each, 18 of 30 directions searched
  (144 Serper credits, budget 150; the other 12 are rated on the spec only)
- Rated by: ________ on ________

| Metric | Baseline | Target |
| --- | --- | --- |
| Brief relevance | ____ % | 80% or more |
| Spec coherence (checkCoherence failures; owner median) | not in the engine yet; median ____ | 0 |
| Query overlap | 23 shared UI queries (8 of 8 searched boards) | 0 |
| Reference precision (top 8 UI) | ____ % | 75% or more |
| Distance from slop | not measured by this bench | Fewer than 2 matches |
| Crop accuracy | not measured (needs `bench/gold/`) | 0.8 or more |
| Wow (median) | ____ | Median 4 |
| Accessibility | not measured by this bench | 100% |
| Cost (Serper credits per board) | about 24 (8 per direction search, 3 directions) | 15 or fewer |

## Notes from rating

- Best directions: ________
- Worst directions and why: ________
- Patterns in bad references: ________
