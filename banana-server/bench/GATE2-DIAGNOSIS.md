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

Before, a rerun of the same request gave the next direction that request's next results (the canvas dedupe
skipped the ones already placed), and those were often still on the bar (the second and third welcome-screen
pins on banking onboarding). With no request paid for twice, those deeper results are not fetched. The metric
is per direction, so this is a real trade-off for the gate, not an error. A next step that keeps both: one deeper
brief-level request (page 1 and 2 at once) whose results are shared out across the board's directions. The bridge lane ("{idea} ui design") kept 0 good results in 25 rated
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

## Round 2 (2026-10-16, branch `next/gate2-r2`)

What was done for each remaining cause, and what three new runs (`g2g`, `g2h`, `g2i`, product setup) measured. Table
and method: `BASELINE.md`, "Gate 2 round 2".

| Cause | Fix | Measured |
| --- | --- | --- |
| 5. Generic lead card inside the right domain | J4b page fit (`atlas-build/jobs/j4b-page-fit.ts`): top 40 cards of each domain against its 12 pages, score and a short reason; the bend leads with the page score and gives the page reason as the why | On brief 20% to 53.3% (g2g), relevance mean 2.73 to 3.53; whys name the page job |
| 5. Rule cards leading ("Everything in a Bento Grid", "One Thing Moves") | `isRuleCard`: never a lead, only a second card that adds its rule | 0 of 30 leads are rule or layout cards (6 in g2d) |
| J7 recipes have no topic | Template slot on full-text sources, filled by `briefTopic`; galleries stay page-only (g2g: topic phrases on SiteInspire and Awwwards kept 0) | A filled template takes the fidelity lane on 3 boards (coffee, SaaS pricing, real estate: "dark minimal coffee shop landing page website ui"); real estate is 15 of 16 good, SaaS pricing still finds dashboards; Ramadan's "{topic} offers page ui ios app" is judged 0.75, under the 0.76 guard |
| 4. Zero shared queries costs directions 2 and 3 | One deep shared request: fidelity page 2 on the first search, unplaced brief-level results pooled on the canvas, 4 per later direction | 0 shared queries (g2h, g2i); later directions show 69 to 74 UI results (51 in g2e) at 51 to 53% good (55% in g2e); the pool itself is 55 to 58% good |
| 6. No CC0 art in the bench | The bench never passed `allowImage` and `loadTakedowns` to search_references (the museum hosts were allowed; the check was missing, so it refused all); stricter CC0 matching | 5 CC0 results per run (0 before) |
| (found in g2g) | An empty fidelity lane is saved on the board; the pool share pushes out art past the art quota | g2g's one shared query is gone in g2h |
| (found in g2g, g2h) | The mechanic lands on the element the lead's page reason names (`reasonElements`) | g2i: 9 directions moved to the named element; on brief 53.3% to 56.7% |

### What remains (g2i, 13 of 30 off brief, 55% precision)

1. **Cards that serve the page but not the brief's world** (6 of 13): Swiss columns on SaaS pricing, Scandinavian rooms
   on Dubai listings, tally marks on kids reading, an ice cream truck menu on Ramadan offers, an arcade attract screen
   on fitness, Ankara 1930s on banking. J4b scores the page job within a domain, so a card that does the page's job
   well scores 3 even when nothing ties it to the brief's product or market. Next: a brief-level check of the top 8
   leads (the brief's topic, market and theme words against the card), or J4b per brief kind rather than per domain.
2. **Region inside the Gulf** (4): Najdi mud architecture on Dubai apartments and on Qatar services, the dallah and
   Arabic coffee on a global coffee shop brief. Cards carry `region: "gulf"` with no country, and a global brief
   still draws Gulf cards. Next: a country tag on Gulf cards (J3 top-up) and a small cost for regional cards on a
   brief with no market.
3. **The named element is protected** (3): "slide jaw to pick data amount" and "plans as stepped shades" name the
   plan or its button, which the must keep "one primary action" protects, so they land on a divider or the header.
   Next: a plan card element (`paywall-plan`, `card`) that is not the primary action.
4. **Theme parsing is noisy**: kids reading parses a real estate theme ("home"), Qatar services a BNPL theme ("pay").
   The theme adds 0.4 of its fit. Next: a theme only from a whole domain name or a festival word.
5. **References**: Ramadan food offers keeps 1 or 2 good of 12 to 14 in every run (the Phase 0 topic is "ramadan
   offers"; `briefTopic` says "food delivery", but only templates use it) and SaaS pricing 5 to 7 of 16 (the filled
   template "dark minimal analytics SaaS pricing page website ui" returns analytics dashboards: the topic words pull
   the dashboard look). Next: the Phase 0 lanes take `briefTopic` too, and for a page whose topic names a product
   look (analytics, dashboard) the topic goes after the page words or is left out.
6. **CC0 matching** is word overlap between museum titles and card art words: 5 results a run, few of them on idea
   ("Prospect of Jerusalem" for Gulf modernism). Next: J9 tags items with card ids or families offline.

### Gate 2 after round 2

- 0 shared queries: **met** (g2h, g2i).
- 0 coherence failures: **met** (0 of 30 on every run; rated median 3 to 3.5).
- 80% on brief: **not met on the agent ratings** (56.7% at best, from 20%). The J10 judge, trusted on relevance for
  the first time (80% agreement with the gold), scores g2i at 80% (24 of 30); the owner's spot check decides which
  rater the gate follows.

## Round 3 (2026-10-16, branch `next/gate2-r3`)

What was done for the 13 directions g2i left off brief and for the weak reference searches, and what two new runs
(`g2j`, `g2k`, product setup, same 10 briefs, budget 150 each) measured. Atlas: rebuilt locally from the committed raw
files (288 shards, manifest `6b856111260d`); the dry bend reproduced all 30 g2i direction ids before any change. No new
J job: every fix is deterministic and reads text the Atlas already has. Table: `BASELINE.md`, "Gate 2 round 3".

| g2i cause (directions) | Fix | Measured on g2j and g2k (same 30 directions in both) |
| --- | --- | --- |
| Cards that fit the page, not the brief (6: Swiss columns on SaaS pricing, ice cream truck on Ramadan, Ankara 1930s on banking, Scandinavian rooms on Dubai, tally marks on kids reading, arcade on fitness) | Brief-level fit, `lib/atlas/brief-fit.ts`: the card's own text, region and J4 and J4b reasons against the brief's market, Gulf places, occasion, audience and telling product words. A card from another named region costs a step on a market brief; a regional era whose J4 reason names only a style ("visible grid suits dashboards", "civic modernism suits banks") costs 1.5 steps on a brief with no market; the brief's occasion gains; drink and pork cards never go on a Gulf or kids brief (the craft beer can was a Ramadan candidate). A theme domain now comes only from a whole domain name or an occasion word ("food" had made restaurants the Ramadan theme; now it is faith and lifestyle) | Swiss, Ankara, ice cream truck, Scandinavian and tally marks are gone. Their places went to Pocket Calculator and Dark Mode SaaS (pricing), Wax Seals (banking), Dotted Leaders (Ramadan), Emirati Barjeel (Dubai), Stickers and Game Cartridge (kids): 4 of 6 rated on brief. The arcade stays (fitness has only 4 judged candidates) |
| Wrong Gulf region (4: Najdi mud on Dubai and on Qatar, Arabic coffee and the dallah on a global coffee brief) | Gulf places: cities and countries map to a country, and Saudi cities to Najd, the Hejaz, Asir, the Eastern Province or the north. A card named for one country (Najdi, Emirati, Omani) or whose text names one without the Gulf as a whole goes only on that country's briefs; Gulf cards go only on Gulf briefs; a lens overrides | 0 of 30 directions have a Gulf card off its country or market. Replacements: Jebena (Ethiopian coffee origin) and Googie (the 1950s coffee shop look) on coffee, Barjeel wind towers on Dubai, Manila folders on Qatar. All 4 rated on brief |
| Idea aimed at a protected element (3: dial caliper and paint swatch on a divider and a header, punch card on a header) | New mechanic part `plan` (the plan cards). `paywall-plan` maps to it instead of the main button, so "one primary action" no longer pushes plan ideas elsewhere. A mechanic never lands on a protected total, main button or plan cards; a card whose page reason names only protected parts gives way to the next card; a named element always comes before an unnamed one (the spread over the bend had moved the punch card to the header) | Dial caliper, paint swatch, gas station (eSIM) and numerals, calculator, dark SaaS (pricing) build on the plan cards; punch card builds on the progress bar. All rated on brief |
| Ramadan references returned prayer apps (1 or 2 good of 12 to 14) | J1 and J2 search hints on `detail.atlas`: when the Phase 0 topic ("ramadan offers") shares no word with the product the brief names (J2), the topic becomes occasion plus product ("ramadan food delivery"); results whose titles name the occasion domain's own look words (prayer, adhan, qibla, hijri, quran, from faith and lifestyle's J2 nouns, minus words the food domain says, like iftar) are dropped | g2j with "ramadan food delivery offers": 3 of 3 good but one direction found no UI at all. g2k with the shorter topic: 6 of 9 good, no prayer app |
| SaaS pricing returned dashboards (5 to 7 good of 16) | The domain's surface nouns (dashboard, chart, report, widget: J2 product nouns that are pages of their own) are dropped from titles on another page; the fidelity recipe "dark minimal {topic} pricing page website ui" no longer replaces the Phase 0 wording (fix 5) | No dashboard in the top 8. 10 of 16 good in g2j, 7 of 16 in g2k: the "analytics saas pricing page" wording now pulls SaaS landing pages with no pricing section |
| Precision 55% | Fix 5: a recipe needs 6 judged results to replace a Phase 0 lane, and a fidelity recipe may not hold style words (the style-word templates kept 6 of 24 in round 2, the plain property listing template 20 of 20). The taste lane keeps the domain whole before it cuts style words and never leaves a lone "big" ("dark mode shop landing page" kept 0 of 9, "big analytics saas pricing page" 1 of 8) | 68.1% (g2j) and 62.8% (g2k); great share 11.3% and 11.7%. Fidelity lane 76% good in g2j (was 59% in round 2). Shared queries stay at 0 |

Also: a shared name word counts as a shared family in MMR ("Manila File Folder" and "Folder Tabs" had led two Qatar
directions), and "stage" no longer reads as a step ("dark stage around highlighted plan" was built as a progress bar).

### What remains after round 3

1. **Five directions rated 3** in both runs: Walnut Veneer (coffee, generic wood), Arcade Cabinet (fitness, thin),
   Dotted Leaders (Ramadan, an offers idea with nothing of Ramadan), Ruler Ticks (Dubai, nothing of luxury or Dubai),
   Game Cartridge (kids, not reading). All five lead with a J4b page score and no tie to the brief's world; the next
   step is a tie the page fit can see (J4b per brief kind, or a brief-level top-up judge for fit-3 cards).
2. **References on two boards**: Qatar services (25% and 31%: the pooled brief-level results and "government
   services dashboard ui" return generic dashboards) and flight checkout (43 to 50%: the fidelity lane drifts to
   cruise and sportsbook shots). The mechanic component lanes are still the weakest lane.
3. **Ramadan coverage**: 9 UI results on the board in g2k (12 to 14 before) because the title filter drops more.

4. **The second card** (found by J10): the brief-level fit ranks the lead card only; the second card that adds a
   texture or motion is still drawn by seeded jitter, so a tiffin carrier reaches a Saudi souq sign and an Ankara 1930s
   texture reaches Dubai wind towers. J10 marks 9 directions down for it. Next: rank the second card by the same
   brief fit, and cost a reason that names a Gulf system (Nafath) on a brief with no market.

### Gate 2 after round 3

- 0 shared queries: **met** (g2j, g2k). 0 coherence failures: **met** (0 of 30, rated median 3).
- 80% on brief: **met on the agent ratings** (83.3% on both runs, the rater of every earlier table), **not met on the
  J10 judge** (73.3% on both runs, trusted at 76.7% agreement). The agent that rated also wrote the fixes. The
  owner's spot check of g2j decides which rater the gate follows. Details: `BASELINE.md`, "Gate 2 round 3".

## Round 3b (2026-10-17, branch `next/second-card`)

This fixes item 4 of "What remains after round 3". The second card, the one that adds a texture, motion or rule,
was still drawn by seeded jitter, so J10 marked 9 of 30 directions down for a foreign texture on a Gulf lead. Now
`rankSeconds` (`lib/atlas/bend.ts`) ranks it with the lead's own relevance: J4b page fit, brief-level fit, the domain
step, Gulf-first, learning weights and the taste tie breaker. Rules:

- Never the lead's family, and never a card that shares a name word with the lead. Rule and layout cards are allowed.
- Region (`secondRegionOk`): on a Gulf brief only Gulf and global cards, on a MENA brief also MENA cards. A card from
  another region goes on only when the brief asks for it (it names the card's region or a word of the card's name),
  or when the card names the brief's occasion. A brief with no market takes any region, since the brief fit already
  scores it. A lens card added to a non-lens lead keeps the lens rule.
- Cards an earlier direction took come last, then cards that share a name word with another shown lead ("Sticker
  Sheet" under Wool Felt while "Stickers" leads the next direction). The jitter and the card id only break ties, so
  the same brief gives the same pick.

Method: the Atlas was rebuilt locally from the committed raw files (`--from-raw`, 288 shards, manifest
`dc639915fe6b`). A dry Bench run (`--dry --atlas`, no Serper, no API) before the change reproduced all 30 g2j
direction ids. In the same dry run after the change, every lead is the same and 17 of the 18 second cards changed.
The other 4 briefs run at wildness 1 or 2 and carry no second card. Direction ids change where the second card
changed, because the id holds both card ids.

| Brief | Lead | Old second (round 3) | New second (round 3b) |
| --- | --- | --- | --- |
| eSIM plan picker (GCC) | Gas Station Price Sign | texture of Bilingual Baqala Receipt (Gulf) | texture of Eidiya Money Envelope (Gulf) |
| eSIM plan picker (GCC) | Dial Caliper | motion of Karak Tea Glass (Gulf) | motion of Bilingual Baqala Receipt (Gulf) |
| eSIM plan picker (GCC) | Paint Swatch Card | rule of Progress Bars | texture of Pill Blister Pack |
| Coffee shop landing | Walnut Veneer | texture of Spun Sugar | texture of Cottagecore 2020 |
| Coffee shop landing | Jebena Coffee Pot | motion of Woven Rattan | motion of Woven Rattan (same) |
| Coffee shop landing | Googie 1958 | texture of Rishtan Ceramics (Central Asia) | texture of Corduroy |
| Fitness empty state | Badges | rule of Navigation at the Bottom | texture of Foosball Table |
| Fitness empty state | Arcade Cabinet | motion of Puffer Jacket Nylon | rule of Bars Instead of Numbers |
| Fitness empty state | Munich 1972 Olympics | texture of Watch Dial | texture of Matte Rubber |
| Ramadan offers (Saudi) | Qamar al-Din Apricot Sheet | texture of Flat Design 2013 | rule of Everything Ticks Once per Second |
| Ramadan offers (Saudi) | Hand-Painted Souq Shop Sign | **motion of Tiffin Carrier (South Asia)** | motion of Milk Carton |
| Ramadan offers (Saudi) | Dotted Leaders | texture of Thermal Receipt | texture of Parchment Baking Paper |
| Dubai real estate | Ruler Ticks | rule of Every Block a Different Texture | texture of Polished Marble |
| Dubai real estate | Coral Stone Blocks | motion of Walnut Veneer | motion of Scale Bars |
| Dubai real estate | Emirati Barjeel Wind Towers | **texture of Ankara Republic 1930s (Turkey)** | texture of Walnut Veneer |
| Kids reading home | Wool Felt | texture of Sewing Button | texture of Bubbles |
| Kids reading home | Stickers | rule of A Single Accent Shape Repeats | motion of Egg Carton |
| Kids reading home | Game Cartridge | texture of Bubbles | texture of Cereal Box |

Flight checkout, banking onboarding, SaaS pricing and Qatar services carry no second card (wildness 1 or 2) and did
not change.

What to eyeball: both J10 cases are gone, and no second card on a Gulf brief comes from another region. Without
the name-word rule against the other shown leads, Wool Felt took Sticker Sheet while Stickers led the next
direction; with it, Wool Felt takes Bubbles. Gulf briefs still draw few Gulf second cards (only the eSIM
board), because the strongest Gulf cards are already leads among the 8 directions the bend generates. Not measured
yet: no live run and no J10 pass, since both need Serper or the API.
