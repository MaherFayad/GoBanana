# atlas-build

Offline builder for the Banana Atlas (docs/next-step-plan.md section 6). It calls the Claude API.
The server never calls AI and never imports this folder; it only reads the JSON shards this
folder produces.

## Setup

```
cd atlas-build
npm install
```

- Node 22 or later.
- The key lives in `atlas-build/.env` (git-ignored): `ANTHROPIC_API_KEY=...` and, for J7,
  `SERPER_API_KEY=...`. A worktree without its own `.env` reads the main checkout's
  `C:\Users\Admin\Documents\GitHub\Gobanana\atlas-build\.env`. Values are never printed.
- `npm run models` checks that the key can use the models in `config.ts` (`OPUS`, `SONNET`,
  `HAIKU`, all the 5.5 family) and sends one tiny image to `JUDGE` to prove it reads images
  (about $0.0002). It writes `data/models.json`.
- `npm run fonts` refreshes `data/google-fonts.json` from Google Fonts metadata (one fetch).

## Run a job

```
npx tsx run.ts <job> --dry              # build every prompt, print the estimate and the budget check, call nothing
npx tsx run.ts <job> --limit 5          # a real run on the first 5 inputs
npx tsx run.ts <job>                    # the full run
npx tsx run.ts <job> --offset 500 --limit 500   # a slice (image-heavy jobs: run in slices)
npx tsx run.ts <job> --from-raw         # rebuild outputs from saved replies, no API calls
```

`<job>` is a file in `jobs/`, for example `example` or `j3-cards`. Always run `--dry` first, then
`--limit 5`, read the review page, then the full run.

Each run:

1. **Spend guard.** Estimates the run (on the high side) and refuses it when the estimate plus what
   `costs.csv` already shows would pass the job's budget, its block cap (plan 6.4) or the total cap.
   Budgets are in `config.ts` `BUDGETS`, keyed by the job id before the first hyphen (`j3-cards`
   uses `j3`). Only the owner raises a budget.
2. **Batch.** Sends the requests through the Message Batches API (50% off) with the job's system
   prompt as a cached prefix. Batch ids are saved to `state/<job>.json` at once: if the run stops,
   running the same command again resumes those batches instead of paying twice. `--fresh` forgets
   them.
3. **Ledger.** Logs real usage of every reply to `costs.csv`. All checkouts share one ledger: the
   main checkout's `atlas-build/costs.csv` (or `ATLAS_COSTS`).
4. **Replies.** Saved to `raw/<job>.jsonl` (text and usage only; request bodies and images are never
   written to disk).
5. **Validation.** Each record is parsed with its zod schema from `schema.ts`, then the writing rules
   (no em dashes, no tashkeel), then the job's own checks (Google Fonts names, computed contrast).
   Failures go to `rejects/<job>.jsonl` and are never shipped.
6. **Output.** `out/v1/<kind>/<shard>.json` (each under 100 KB) and `out/v1/manifest.json` with
   sha256 for every shard.
7. **Review.** `review/<job>.html`, a random 10% of the valid records.

## J7 query recipes (Serper plus judge)

`jobs/j7-recipes.ts` tests about 3,900 wordings: 6 for each J1 page and platform pair and the 3 art
queries of each J3 card. Each wording costs 1 Serper credit (one image search, thumbnails fetched into
memory only) and one judge call. Only wordings and scores are stored. It needs `out/v1/anatomy` and
`out/v1/cards` (`npx tsx run.ts j1-anatomy --from-raw`, then `j3-cards`).

- `npx tsx j7-taste.ts` writes `data/j7-taste-notes.md` from the exemplar picks (`picks.json`, else
  `picks.default.json`) once, so the judge prompt carries notes instead of images. Rerun it after the
  owner saves `picks.json`.
- Picks carry a `genre` (banana-server/bench/taste/genres.mjs). `j7-taste.ts` reads the Mobile UI
  and Web UI picks by default; `npx tsx j7-taste.ts --genre presentation` and `--genre branding`
  write `data/j7-taste-notes-<genre>.md` from that genre's picks, which the judge prompt reads for the
  genre lanes.
- Genre lane inputs (`deck` and `brand`, banana-server lib/sources/genre.ts): up to 4 wordings for
  each of the 13 genre kinds (key `{ lane: "deck" | "brand", page: <kind slug> }`), appended after
  the art inputs so chunk offsets of earlier runs stay put. About 50 extra Serper credits.
- The key is read from `SERPER_API_KEY` or `banana-server/.dev.vars`. A real run checks the account
  balance first and refuses a slice that would take it under 2,500 credits (the product's runtime
  credits). Every search is logged to `serper.csv` next to `costs.csv`.
- Inputs are ordered by value (bench pages, other pages, then art), so run it in chunks:
  `--offset 0 --limit 250`, `--offset 250 --limit 250`, and so on. Each chunk resumes from its batch if
  stopped. After the last chunk run `npx tsx run.ts j7-recipes --from-raw` to build the whole output
  (a chunk's own output covers only that chunk). Keys with no wording at 0.5 or more are listed in
  `review/j7-recipes-dropped.json`.
- The full-job `--dry` estimate is high (the guard prices the cached prefix as a write on every
  request); real spend is about a third of it. Chunks of 250 pass the guard.

## Owner review and upload

1. Open `review/<job>.html` for every job you want to ship and read the sample. Look at
   `rejects/<job>.jsonl` if the reject count is high.
2. Not happy: say what is wrong; the job's prompt is fixed and the job rerun.
3. Happy: run `npx tsx upload.ts` (optionally `--kind cards`, a server kind). It checks every job
   shard against the job manifest, turns `out/v1/` into the server's layout in `out/server/v1/`
   (`lib/layout.ts`: `pages`, `domains`, `lenses`, `slop` split by size; `fit/<domainId>`,
   `mechanics/<element>`, `cc0/<region>` named; `cards`, `lines` and `recipes` in hash buckets with
   the loader's own `bucketOf`), prints the `wrangler r2 object put banana-atlas/atlas/v1/...`
   commands, and copies that manifest to `banana-server/lib/atlas/manifest.json`. Job kinds map as
   `anatomy` to `pages` and `card-elements` to `lines`; kinds the server does not read are skipped.
   A named shard over 100 KB (one domain's fit, one element's mechanics, one region's CC0 items)
   stops the run. Run the printed commands yourself from `banana-server/`. Agents never run them.

## Content ops without the API

The owner's skill `.claude/skills/gobanana-atlas-ops` (repo root) adds records written in a Claude
Code session. `npx tsx ops.ts validate <kind> <file>` checks them (schema, writing rules, fonts,
shipPairs), `npx tsx ops.ts merge <kind> <file> --out out/candidate` adds them to a copy of the
output, and `npx tsx ops.ts layout <jobOut> <serverOut>` writes the server layout for a Bench run
(`node scripts/bench-run.mjs --atlas <serverOut>` in banana-server). No API calls, no upload.

## Add a job

One file in `jobs/` that default-exports `defineJob({...})` (see `lib/job.ts` and
`jobs/example.ts`):

| Field | What it is |
| --- | --- |
| `id` | `"j3-cards"`. The part before the first hyphen is the budget key. |
| `kind` | Output folder `out/v1/<kind>/`. Use a `SCHEMAS` key from `schema.ts`. |
| `model`, `mode`, `effort` | `OPUS`, `SONNET` or `HAIKU` from `config.ts`; `"batch"` or `"direct"`. |
| `schema` | The zod schema from `schema.ts`. |
| `system` | The cached prefix: `PROMPT_RULES` and `typeText("IngredientCard")` from `lib/prompt.ts`, plus taxonomy. Keep it byte-for-byte stable. |
| `maxTokens`, `expectedOutputTokens` | Per request; thinking counts as output. The estimate uses the expected value. |
| `loadInputs(ctx)` | The work items. Read repo files, earlier `out/v1/` kinds, owner lists. |
| `requestId(input, i)` | Unique and stable, `[a-zA-Z0-9_-]{1,64}`. |
| `buildPrompt(input, ctx)` | The user message: text, or blocks with images from `lib/thumbs.ts` `fetchThumbBlock` (use `placeholderImage()` when `ctx.dry`). |
| `parse?` | Reply text to raw records. Default reads the JSON block. |
| `prepare?` | Fills computed fields before the schema, for example `withShipPairs`. |
| `check?` | Rules beyond the schema, for example `checkCardFonts`. Return problems. |
| `finalize?` | Cross-record work: dedupe, merge, sort. |
| `shardOf?` | Shard name per record (lowercase-hyphen). Default one shard split by size. |
| `renderReview?` | Custom HTML per record on the review page. Escape all text. |
| `verify?` | Render or run check on the finalized records (J13: WebGL and WAAPI in headless Chrome). Returns problems by record id. |
| `repairPrompt?` | With `verify`: each failing record gets one repair request carrying its problems (`fix-<id>`, replies in `raw/<job>-repair.jsonl`, same spend guard). A repair that fails again is dropped to rejects. `--from-raw` reuses saved repairs and never calls the API. |

## Stunning layer (P1-J13)

`j13-shaders` (GLSL ES 1.00 fragment shaders, uniforms `u_resolution`, `u_time`, `u_c0` to `u_c3`)
and `j13-motion` (WAAPI keyframes plus timing; the script computes the CSS, including the
`prefers-reduced-motion` rule, in `lib/motion-css.ts`). Inputs are the J3 cards and J6 lenses in
`out/v1` (run `j3-cards` and `j6-lenses` with `--from-raw` first). The render checks are in
`lib/render-stunning.ts`; `npx tsx tests/render-stunning.manual.ts` shows them passing and failing
on known good and bad samples. Frame strips go to `review/j13-shaders/` and `review/j13-motion/`.
The server layout puts them in `shaders/NN` and `motion/NN` (read whole); the loader's
`ATLAS_KINDS` does not list these kinds yet.

## Tests

```
npm run typecheck
npm test
```
