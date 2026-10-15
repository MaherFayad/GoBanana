---
name: gobanana-atlas-ops
description: Owner content ops for the Banana Atlas - add ingredient cards, mechanics, lens packs, query recipes, domains or page anatomies by writing them in this Claude Code session (the owner's own subscription, no API credit), validate them with the atlas-build zod schemas, run a Banana Bench subset against the current Atlas, and prepare a new shard version only when the subset does not get worse. Never uploads; the owner runs the printed wrangler commands. Use when the owner says "add 20 cards for the coffee domain", "add mechanics for the stepper", "add a lens for Najdi doors", "more recipes for the paywall page", "grow the Atlas", "atlas ops", or "refresh the Atlas shards".
---

# GoBanana Atlas ops

Grow the Banana Atlas by hand, a few records at a time, without the Claude API: you write the
records here, the scripts in `atlas-build/` check them, the Bench says whether they help, and the
owner uploads. Plan: docs/next-step-plan.md P2-03 (and sections 6.2, 6.5, 8).

## Hard rules

- **No API calls.** Do not run `npx tsx run.ts` (that spends API credit). You write the records yourself in this session; `atlas-build/ops.ts` only validates, merges and lays out.
- **Never upload.** Never run `wrangler r2 object put`, `wrangler deploy` or anything that writes to R2 or Cloudflare. `npx tsx upload.ts` only prints the commands; the owner runs them.
- **Words, scores and URLs only.** No image bytes anywhere. CC0 items keep `imageUrl` and `pageUrl` as links.
- **Writing rules** (the validator enforces most): plain words, no em dashes, Arabic in white Saudi dialect with no tashkeel and noun-form labels, no invented facts about real people or brands. Traditions: name the tradition and its people (`culturalNotes`, lens `credit`), never sacred or Quranic text as decoration, never tribal marks used casually. Fonts only from Google Fonts (`atlas-build/data/google-fonts.json`; Arabic slots need the arabic subset). Leave `shipPairs` empty: the script computes them.
- **Only keep a version that is not worse** on the Bench subset (step 5). Otherwise stop and report.

## Steps

### 1. Pin the request

Kind, count and target, from the owner's words: "20 cards for the coffee domain" is kind `cards`, 20 records, domain `coffee`. Kinds are the `SCHEMAS` keys in `atlas-build/schema.ts`: `anatomy`, `domains`, `cards`, `fit`, `card-elements`, `mechanics`, `lenses`, `recipes`, `cc0`, `slop`. Ask one question only if the target is unclear.

### 2. Read what exists

- The types and rules: `atlas-build/schema.ts` (section 6.2 types, verbatim) and `atlas-build/lib/prompt.ts` (`PROMPT_RULES`).
- The current records: `atlas-build/out/v1/<kind>/*.json` (and `out/v1/domains`, `out/v1/fit` for the domain). Note ids, families and names already used; never repeat an idea or an id.
- Families: `banana-server/lib/bend/families.ts`; type voices: `TYPE_VOICES` in `banana-server/lib/direction-detail.ts`; stitch roles for anatomy: `banana-server/lib/stitch/types.ts`; source ids for recipes: `banana-server/lib/sources/registry.ts`.

### 3. Write the records

Write them as one JSON array to `atlas-build/ops/<YYYY-MM-DD>-<kind>-<slug>.json`. What a request really needs:

- **Cards** for a domain also need, or the bend never picks them: a `fit` row for that domain per card (score 0 to 3 with a one line reason; 2 or more to be drawn at wildness 1 to 3), and `card-elements` lines for the elements the domain's pages put wild spots on (how, buildability 1 to 5). Write those as two more files.
- Each card stands alone: palette (surface, ink, accent, support), type (voice, Latin and Arabic display and body), texture, imagery, motion with a reduced motion fallback, radius, density, avoid, art queries without UI words.
- **Mechanics:** 4 word names, one sentence a developer can build from, RTL and WCAG 2.2 notes, the page ids where they pay off.
- **Recipes:** the key, the query and the source. You cannot judge results here, so set `precision` to 0, `judged` to 0 and `at` to today: the bend prefers judged recipes, and the quarterly refresh (`atlas-build/jobs/j7-refresh.ts`) or J7 judges them when API credit is there.
- **Lenses:** a static SVG motif tile with `currentColor`, no script; `dos` and `donts` include "no sacred or Quranic text as decoration".

### 4. Validate and merge into a candidate

From `atlas-build/`:

```
npx tsx ops.ts validate cards ops/2026-11-02-cards-coffee.json
```

It runs the zod schema, the writing rules, the Google Fonts check and computes `shipPairs`, and writes rejects to `rejects/ops-<kind>.jsonl`. Fix every reject and validate again. Then build a candidate next to the current output, never on top of it:

```
rm -rf out/candidate && cp -r out/v1 out/candidate
npx tsx ops.ts merge cards ops/2026-11-02-cards-coffee.json --out out/candidate
npx tsx ops.ts merge fit ops/2026-11-02-fit-coffee.json --out out/candidate
npx tsx ops.ts merge card-elements ops/2026-11-02-lines-coffee.json --out out/candidate
npx tsx ops.ts layout out/v1 out/bench/base
npx tsx ops.ts layout out/candidate out/bench/candidate
```

A new record with an existing id (or the same card and domain for fit) replaces the old one. `layout` writes the server's shard layout (`lib/layout.ts`); it stops when a named shard (one domain's fit, one element's mechanics, one region's CC0 items) passes 100 KB.

### 5. Bench subset: not worse, or stop

Pick 3 to 5 briefs from `banana-server/bench/briefs.json` that touch the change (for coffee: `coffee-shop-landing`; add a brief to the file only with the owner's yes). From `banana-server/`, run both without search (no Serper credits):

```
node scripts/bench-run.mjs --dry --only coffee-shop-landing,<id> --date ops-<date>-base --atlas ../atlas-build/out/bench/base
node scripts/bench-run.mjs --dry --only coffee-shop-landing,<id> --date ops-<date>-candidate --atlas ../atlas-build/out/bench/candidate
node bench/score.mjs bench/runs/ops-<date>-base --json
node bench/score.mjs bench/runs/ops-<date>-candidate --json
```

The candidate is **not worse** when, on the same briefs:

- the Atlas engine answers at least as many briefs (the run prints "Atlas engine answered N of M briefs"),
- spec coherence failures do not go up,
- and, if the owner rates both runs (report.html, Download ratings into each run folder), brief relevance and wow do not go down.

A search run (drop `--dry`, keep `--budget 40` or less) adds query overlap and reference precision, but spends Serper credits: ask the owner first. If the candidate is worse on any line, stop, show the table side by side, and say which records you think caused it. Never ship a worse version.

### 6. Prepare the new version (the owner uploads)

Only when step 5 passed:

1. Keep the old version for rollback: `cp banana-server/lib/atlas/manifest.json atlas-build/ops/manifest-<old hash first 12>.json`.
2. Make the candidate the output: `rm -rf out/v1 && mv out/candidate out/v1`.
3. `npx tsx upload.ts`. It writes `out/server/v1`, prints the `wrangler r2 object put banana-atlas/atlas/v1/...` commands and copies the new manifest (new hash) to `banana-server/lib/atlas/manifest.json`. The server caches shards by manifest hash, so the new version never mixes with the old.
4. Hand the printed commands to the owner to run from `banana-server/`, then deploy is theirs too. Do not run them.
5. Append one line to `atlas-build/ops/log.md`: date, kind, count, file, Bench result (base vs candidate), old and new manifest hash.

## Reply

Short: what was added (kind, count, file), rejects fixed, the Bench subset table (base, candidate), the verdict (ready to upload, or stopped and why), and the owner's next command.
