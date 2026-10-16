# Gate 2 diagnosis (2026-10-16)

Why the Atlas engine failed Gate 2 on `bench/runs/2026-10-16g2a` to `g2c`, ranked by impact, with the
evidence, the fix on branch `next/gate2-fix`, and what the fix measured on three new runs (`g2d`, `g2e`,
`g2f`). All numbers are from `ratings.json` (agent ratings against `docs/taste-bar.md` and the owner's picks
in `bench/taste/picks.json`), top 8 UI references per searched direction, unless marked as the J10 judge.

Method: the g2a Atlas was rebuilt locally from every committed raw file (`npx tsx run.ts <job> --from-raw`,
then `npx tsx ops.ts layout out/v1 out/server/v1`) and a dry Bench run reproduced g2a exactly (the same 30
direction ids, the same 7 of 10 briefs on the Atlas). Then `parsePage`, `parseDomain`, the fit shards and the
recipe shard were read for each brief, and every g2a reference was grouped by lane and query
(`node bench/score.mjs` plus the per-lane counts below).

## Ranked root causes

### 1. The brief parser picked the wrong domain, or none (relevance; 7 of 10 briefs)

`parseDomain` scored a product noun at 2 plus its words and a domain name at its words, and matched names
only as whole phrases. Page words in the J2 product nouns then decided the domain:

| Brief | g2a domain | Why | Right domain |
| --- | --- | --- | --- |
| coffee shop landing page | productivity | "page" is a productivity product noun (score 3) and beat the name "coffee shop" (2) | coffee |
| Ramadan offers page for a Saudi food delivery app | productivity | "page" (3) beat "food delivery" (2) | food-delivery |
| pricing page for a B2B analytics SaaS | productivity | "page" (3) beat "B2B analytics" (2) | analytics-saas |
| government services dashboard for Qatar residents | analytics-saas | "dashboard" (3) beat "government services" (2) | government |
| banking onboarding | none | names are "retail banking", "mobile banking": no whole phrase in the brief | retail-banking |
| fitness app empty state | none | names are "fitness and gyms", "fitness tracker", "gym app" | fitness |
| kids reading app home screen | none | names are "kids learning", "children's reading apps" | kids-learning |

The page was found for all 10 (no missing page, recipe or platform mapping): the three "no Atlas match"
briefs were a domain miss only, and `bendBriefAtlas` returns null without a domain, so they fell to the word
lists. The four wrong domains explain the worst g2a directions: the Ramadan food page got a manila folder,
paper planes and mica (relevance 1, 1, 1), the pricing page a manila timestamp card, marbled paper and a
flat-pack manual (3, 3, 2), all productivity cards.

**Fix:** `parseDomain` now ignores product nouns that are page words ("page", "screen", "dashboard", or the
head word of the matched page's names), counts whole names at 2 per word, and adds single content words
shared with a domain's names when the word names 3 domains or fewer ("banking", "fitness", "kids",
"reading"). `parsePage` falls back to the nearest page by shared words. The Atlas now answers 10 of 10
briefs with the right domain on all 10 (`tests/atlas-gate2-fix.test.ts`).

**Also fixed in the bend, same cause family:** a theme domain the brief also names ("Ramadan" names
faith-lifestyle) adds 0.4 of its fit; fit reasons that name a rare brief word ("reading", "itinerary") add up
to 0.5 fit; on a Gulf brief every Gulf card gains 0.3 (traditions 0.5, as before), and below wildness 4 an era
or tradition from another named region is dropped (g2a: "Beirut 1960s" on the GCC flight checkout, relevance
2). Long card names are no longer clipped mid-phrase ("The Layout Mirrors").

**Measured:** mean relevance 2.43 (g2a) to 2.73 (g2d); directions rated 1 went from 5 to 0. On brief (4 or 5)
stayed at 6 of 30 (20%). See cause 5: picking the right domain was necessary, not sufficient.

### 2. Page-only recipes replaced the Phase 0 lanes that named the topic (precision; the main reason it fell)

J7 kept only `baseline` recipes (367, keyed by page and platform; no concept, component or art recipe passed),
judged on the page alone. At search time a recipe replaced the fidelity lane whenever it named the page, so it
dropped the brief's product:

| Brief | Phase 0 fidelity (2026-10-15b) | g2a recipe | g2a result |
| --- | --- | --- | --- |
| saas-pricing | "analytics saas pricing page website ui", 6 of 6 good | "pricing page" on Awwwards (J7 1.0) | 0 kept in the top 8; brief 10 of 16 to 1 of 16 |
| coffee-shop-landing | "coffee shop website ui", 5 of 6 | "dark minimal landing page website ui" (J7 0.875) | 0 of 6 |
| qatar-gov-services | "government services dashboard ui", 1 of 2 | "dark mode minimal gov services dashboard ui" (0.714) | 0 of 3 with the gallery word |
| ramadan-food-delivery | "ramadan offers ui ios app", 1 of 3 | "offers page ui ios app" (0.75) | 0 of 3 |

The J7 precision was honest for the page in general but is not predictive once the brief names a product.

**Fix:** `lib/atlas/recipe-fit.ts`. A UI recipe may replace a Phase 0 lane only when it names a topic word of
the brief (product noun or topic, page words left out) and its J7 precision is at least the Phase 0 lane's
measured Bench precision (fidelity 0.76 = 52 of 68, component 0.59 = 16 of 27 on 2026-10-15b; bridge 0). Used
by the bend (recorded recipe ids) and the search plan.

**Measured:** g2f (all fixes, the same bench setup as g2a, no canvas baseline): precision 65.7% (92 of 140),
great 13.6%, against g2a 57.4% and 12.8%, and Phase 0 69.5% and 13.5%. Fidelity lane 82% (54 of 66).

### 3. The 21 shared queries: 14 are the bench, 7 are the product

| Source in g2a | Count | Kind |
| --- | --- | --- |
| Fidelity lane and its light twin rerun by every direction (incl. the "pricing page" recipe) | 12 | bench artifact: `bench-run.mjs` gave the tool no `getBaseline`, so P0-03 never skipped the lane |
| Baseline gallery word ("pay" on 60fps, "coffee shop" on Lapa) | 2 | bench artifact, same reason |
| Mobile taste bar wording ("dark {page} ui ios app"), the same for every direction with no user taste | 6 | product: a brief-level lane |
| Two directions with a mechanic on the same element ("analytics saas button website ui") | 1 | product |

**Fix:** the bench keeps each board's canvas baseline in memory as the live tool does (`--no-baseline` keeps
the old behavior for comparisons), and the canvas baseline now records every request a direction search sent
(`CanvasBaseline.sent`, `sentKey`): a later direction search on the same canvas skips any request the canvas
already sent, and a skipped brief-level taste request gives way to the direction's own taste wording
(`LaneTexts.tasteAlt`, from its style words). **Measured: 0 shared queries on g2d and g2e** (19 on g2f with the
old bench setup).

### 4. Zero shared queries costs the later directions their best lanes (precision and great share)

The brief-level lanes are the precise ones (fidelity 82%, taste about 60% and most of the great results).
Running them once per canvas leaves the second and third directions with their own lanes: component (about
50%) and bridge. Per direction, the top 8 then falls:

| Run | Setup | Precision | Great share | Shared queries |
| --- | --- | --- | --- | --- |
| g2f | all fixes, old bench (every direction reruns brief lanes) | 65.7% | 13.6% | 19 |
| g2d | all fixes, canvas baseline wired, no request twice | 56.0% | 6.7% | 0 |
| g2e | g2d plus the bridge cap and direction taste wording | 59.5% | 7.6% | 0 |

The board as a whole does not lose results (no request runs twice, so every result is still on the board
once); what moves is which direction a result is credited to. The metric is per direction, so this is a real
trade-off for the gate, not an error. The bridge lane ("{idea} ui design") kept 0 good results in 25 rated
across 2026-10-15b, g2a, g2d and g2e; it is now capped at one UI place while another UI lane has results
(`TAIL_LANES`), which raised g2e over g2d.

### 5. Within the right domain, the card draw is generic (relevance; still open)

With the right domain on all 10 briefs, 6 of 30 directions are on brief (g2d). The fit-3 lists are long
(telecom 14, food delivery 50, kids learning 90) and mix strong cards with layout rules and loose objects whose
J4 reason is a single generic line ("Sport gear suits fitness" for a surfboard, "Wood board suits coffee" for a
butcher block, "Account tiles" for "Everything in a Bento Grid"). The pick among fit-3 cards is mostly the
seeded jitter (0.3 of a fit point) and MMR. Rated 2 in g2d: surfboard (fitness), butcher block and Iznik tiles
(coffee), bento rule (banking), "Layout Mirrors by Language", flat-pack manual and a progress bar (kids), "One
Thing Moves" (Qatar), baking paper and gold stars (Ramadan), Frutiger Aero (eSIM). Rated 4: flight strips and a
metro line (flight checkout), ledger ticks (banking), Munich 1972 (fitness), treemap plans (pricing), Gulf
modernism blocks (Qatar).

Not the rubric: the 9 word-list directions rated in both the Phase 0 and the g2a runs were 3 of 9 on brief
then and 2 of 9 in g2a (one direction of rater difference in 30). Not the references: relevance is rated on the
spec. Not the judge: J10 relevance agreement is 73.3%, under the 75% trust bar, and is not used.

**What it needs (not done here):** a fit score per card and page, not only per domain (J4 has element lines,
not page lines), a buildability or "names the page's job" check on the lead card, rules and constraint cards as
a second card rather than a lead, and a re-judged J4 reason for the fit-3 cards of the 10 Bench domains.

### 6. The CC0 index was not built

`j9-cc0 --from-raw` rebuilt sheets from the museum pool in `.cache/j9-pool.json` (git-ignored), so on a
fresh checkout it harvested the APIs again (about 27,000 record fetches). Also, `lib/layout.ts` refuses a named
shard over 100 KB, and one region (Europe, 3,357 items) is 1.7 MB.

**Fix:** the judged part of the pool (580 sheets, 9,280 items, metadata and URLs only) is committed as
`atlas-build/data/j9-pool.json.gz` (466 KB); `loadPool` reads the cache, then the snapshot, and never harvests
on `--from-raw` or `--dry` (an error instead). A real run refreshes the snapshot. CC0 regions over the limit are
split into parts `<region>_00`, `_01`, ... and the server source reads a region's parts, at most 3 shards a
search (`MAX_CC0_PARTS`); a Gulf brief reads Gulf, then MENA, then untagged items. **Built:** 7,786 items, 45
shards, rebuilt in 2.4 s with no network. The Bench does not show CC0 art yet: museum image hosts are not on
the image allowlist until the owner confirms them (J9 note), so `allowImage` drops them.

## J7 coverage

206 of 274 keys. None of the dropped keys explains the 3 fallback briefs (that was cause 1). Dropped keys that
touch Bench pages: plan-picker mobile and website, empty-state tablet and webapp, offers-page website, and the
showcase-style website variants (3d, animation, playful, webgl) of every website page. With cause 2 fixed, a
recipe is used only where it names the topic, so most J7 recipes no longer apply to product briefs: the next
J7 round should word recipes with a topic slot ("{topic} pricing page website ui").

## Gate 2 after the fixes

- 0 shared queries: **met** (g2d, g2e).
- 0 coherence failures: **met** (`checkCoherence` 0 of 30 on every run; rated median 3).
- 80% on brief: **not met** (20%). Cause 5 is the gap.
- Not a gate criterion, but tracked: precision 59.5% and great share 7.6% with zero shared queries (g2e),
  65.7% and 13.6% with the old bench setup (g2f).
