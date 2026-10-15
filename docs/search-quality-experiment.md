# Search quality experiment (2026-10-11)

Live Serper image search, 51 queries, 10 results each. A result counts as **hi-fi** only when it is a
single item page (Dribbble `/shots/`, Pinterest `/pin/`, Behance `/gallery/`, Awwwards `/sites/`), not stock
or marketplace, larger side at least 600 px, and has a UI-sounding title.

## Query wording (Pinterest + Dribbble, 4 wild topics: Sadu pattern, car dashboard gauges, clothing care label, passport stamp)

| Variant | Hi-fi | Item pages | Clean | Big | UI title |
| --- | --- | --- | --- | --- | --- |
| `{topic} app concept` | 22% | 30% | 85% | 38% | 40% |
| `{topic} dashboard ui` | 15% | 25% | 80% | 45% | 48% |
| `{topic} app ui` | 8% | 22% | 82% | 35% | 38% |
| `{topic} mobile app ui design` | 8% | 18% | 82% | 32% | 40% |
| `{topic} design` | 5% | 68% | 65% | 50% | 8% |
| `{topic}` (raw) | 2% | 92% | 75% | 65% | 12% |
| `{topic} ui ux case study` | 2% | 8% | 82% | 32% | 55% |
| `{topic} app ui` + studio names (Tubik, Ramotion, Halo Lab, Outcrowd) | 0% | 0% | 93% | 37% | 27% |

## Plain screen-type queries (from the brief, no wild ingredient)

| Query | Site | Hi-fi |
| --- | --- | --- |
| flight booking app ui | dribbble | 8/10 |
| flight booking app ui | pinterest | 7/10 |
| airline app design | pinterest | 7/10 |
| airline checkout mobile app | dribbble | 5/10 |
| travel app dashboard ui | dribbble | 5/10 |
| boarding pass app ui | dribbble | 4/10 |
| flight checkout app concept | dribbble | 3/10 |

## Conclusions

1. Wild idea + UI words fails: those applied combinations barely exist online, and Google answers with tag and search pages. Studio and creator names do not help.
2. Raw wild ingredients return real item pages (92%) with strong visuals: good for an **inspiration lane**, after stock and size filters.
3. Common screen-type wording from the brief (`<domain> <product> app ui`, `... app design` on Pinterest) returns polished UI shots 50 to 80% of the time: the **fidelity lane**.
4. Behance returned 0 item pages through Google image search (search pages only): keep it opt-in.
5. Dribbble image URLs carry `?resize=` params; the original is larger. Pinterest `236x`/`474x` paths have a `736x` twin.

## Round 2: the owner's taste (boards `maherfayad55/mobile` and `/dashboard`, read via Pinterest's official public RSS feeds)

51 pins. Titles are empty or useless on most (31 of 51 have no title; others read "X", "(1) Instagram", Xiaohongshu titles), so **title words cannot carry this taste**. Sources are designer social posts (X, Instagram #50UIchallenge, Muzli, Dribbble, Xiaohongshu, Spline). Named creators: Gleb Kuznetsov, Robin Holesinsky, Basit A. Khan, Felix Haas, Halo Lab, SlabPixel, nickpylll.

Visual traits: single widget or card close-ups more than full screens; giant numerals as hero; airy off-white or soft grey studio staging; one floating phone; frosted glass, soft 3D, glowing orbs and aurora gradients; a dark set with orange or lime accents. Domains: fintech, crypto, AI assistants, productivity, health.

Query tests judged visually against the boards (pages of 10, Pinterest + Dribbble):

| Query | Clean single items | Visual match to the boards |
| --- | --- | --- |
| flight booking app ui | 9/10 | Competent, generic three-phone Dribbble shots |
| travel wallet app ui | 9/10 | Mixed |
| travel app card ui minimal | 8/10 | Closest of the domain queries (single card on off-white) |
| flight app ui dark | 9/10 | Moody, decent |
| travel app ui glassmorphism | 8/10 | Decent, staged scenes |
| soft 3d ui card | 6/10 | **Strongest craft match** (studio-lit 3D cards) |
| glassmorphism widget ui | 5/10 | Good on widgets |
| fintech app ui minimal | 7/10 | Close-up hand-held crops match well |
| ai assistant app ui | 10/10 | High metrics, **weak taste** (mascots, busy screens) |
| ui card widget minimal | 0/10 | Tag pages only |
| site:muz.li, site:x.com | 0 usable | Google does not index these as image items |

Conclusions: metadata scores do not equal taste; style words ("soft 3d", "glassmorphism", "minimal", "dark", "card", "widget") combined with a domain noun move results toward the owner's bar; creator names and social sources are not reachable through Google image search. Since the server may not analyze images (hard rule 1), taste has to come in as words: from a saved taste profile, or from the user's own agent, which can look at boards and pass style terms.

## Rounds 3 to 8: mastering the query grammar (386 live queries, 318 credits)

Same scoring, with two fixes: Dribbble reports the size of its resized variant (400x300) while the original is large, so the size rule applies to Dribbble only after the `?resize` strip. Results are also deduped by shot or pin id, so near-identical reposts count once.

### Round 3: site scoping (the biggest lever found)

6 queries x 10 results, good = item page, not stock, big enough.

| Site operator | Good | Item pages |
| --- | --- | --- |
| `(site:dribbble.com OR site:pinterest.com)` | 23/60 | 28/60 |
| `site:dribbble.com` | 26/60 | 31/60 |
| `site:pinterest.com` | 47/60 | 48/60 |
| `site:dribbble.com/shots` | 42/60 (≈57 after the size fix) | **60/60** |
| `site:pinterest.com/pin` | **56/60** | **60/60** |
| `site:behance.net/gallery` | 41/50 on raw ingredients | 50/50 (was 0 with plain `site:behance.net`) |

Use one source per query, with path scoping. Never use the OR form.

Serper also enforces **5 requests per second**: run no more than 4 at once and keep each search_references call to 8 requests or fewer.

### Round 4: component nouns (36 nouns x 2 sources)

Pinterest/pin scored 308/360; Dribbble/shots scored 270/360, about 340 after the size fix. Every noun in this list works:

- **Mobile (`{noun} app ui`):** onboarding, login, paywall, empty state, settings, profile, checkout, bottom sheet, tab bar, chat, notification, search, product detail, calendar, widget, music player, map, stats, wallet, booking, feed, camera, timer, order tracking.
- **Web (`{noun} ui`):** landing page, pricing page, hero section, saas dashboard, data table, admin panel, 404 page, footer, sign up page, kanban board, analytics dashboard.

Weak spots:
- Dribbble: paywall, bottom sheet, portfolio website.
- Pinterest: pricing page.

On taste: Pinterest leans older (2018 to 2020 flat-illustration reposts), while Dribbble is current. Prefer Dribbble for the fidelity and taste lanes.

### Round 5: style words (24 words on "fintech app ui", judged visually)

| Works (the style shows) | Works on Dribbble only | Avoid |
| --- | --- | --- |
| liquid glass, glassmorphism, monochrome, dark mode, luxury, big typography, neumorphism, swiss style | bento grid, editorial, skeuomorphic, grainy, "2025"/"2026" (adds recency, not style) | aurora gradient (returns logos), soft 3d (busy 3D illustration apps), claymorphism (few results), isometric, playful |

### Round 6: domains and word order

- `{domain} app ui` on Dribbble/shots scored 9 to 10 out of 10 across 22 domains: banking, crypto, health, fitness, meditation, food delivery, grocery, travel, real estate, ecommerce, education, ai assistant, productivity, smart home, car, music, social media, dating, weather, hr, logistics, insurance. Pinterest/pin scored 6 to 10.
- Word order makes no difference (style first 45, style last 46, style in the middle 39 out of 50). The middle placement is slightly worse, so put the style word first.

### Round 7: negatives, close-up words, inspiration lane

- **Negatives** `-template -kit -free -wireframe`:
  - neutral on Dribbble;
  - Pinterest pricing page went from 6 to 9;
  - "aurora gradient" went from 2 to 6.

  Use them on UI lanes.
- **Close-up words:** "single screen" gives one floating phone or a hand-held hero, the owner's taste. "widget ui" and "card ui" mix in kit sheets. "ui shot", "concept" and "exploration" behave like "app ui".
- **Inspiration lane (non-UI ingredient):**
  - The raw ingredient on Pinterest/pin and Behance/gallery is the most reliable.
  - "poster" and "graphic design" add art direction when the topic is popular (brutalist architecture: 10/10) but give 0 on niche topics (sadu weaving poster: 0).
  - "3d render" is only good for architecture-type subjects.
  - Behance/gallery is the best source for brand identity and craft.

### Round 8: whole grammar on 8 briefs

The briefs: islamic prayer, ev charging, luxury hotel web, kids education, recipe, logistics dashboard, mental health journal, saudi fintech.

**Result:** 27 to 54 unique good references per brief from 7 requests.

**Lane changes the round forced:**
- **Taste lane:** with the domain in it (`{style} {domain} app ui`), it returned the same shots as the fidelity lane, only 37 new across 8 briefs. **`{style} {component} ui` with no domain gave 66 new**, so the lanes now differ by design.
- **Niche or compound domains** ("saudi fintech", "islamic prayer"): Pinterest gave 1/10. Add a fallback ladder: if a query returns fewer than 5 good results, retry once with the core noun ("fintech").
- **GCC and RTL:**
  - "arabic app ui" scored 10/10 on both sources.
  - "arabic dashboard ui", "arabic website ui", "ramadan app ui", "quran app ui" and "islamic app ui" each scored 8 to 10.
  - "rtl app ui" works on Dribbble only.

## The grammar (what the server should send)

```
UI_NEG   = -template -kit -free -wireframe
SURFACE  = app → "app ui" | web → "website ui" | dashboard → "dashboard ui"

fidelity     "{domain} {SURFACE} {UI_NEG}"            site:dribbble.com/shots + site:pinterest.com/pin
taste        "{style} {domain} {component} ui design {UI_NEG}"  site:dribbble.com/shots   (round 9)
hero         "{style} {coreDomain} app single screen" site:dribbble.com/shots   (app surface only)
component    "{domain} {component} ui {UI_NEG}"       site:dribbble.com/shots
inspiration  "{ingredient}"                           site:pinterest.com/pin + site:behance.net/gallery
             + "{ingredient} poster" when the raw query fills (popular topic)
locale (ar)  "arabic {SURFACE}"                       site:dribbble.com/shots + site:pinterest.com/pin

fallback: fewer than 5 good → drop qualifiers to the core noun, retry once; never more than 8 requests per call
dedupe:   by shot id / pin id / gallery id across lanes
```

Style words to offer (verified): liquid glass, glassmorphism, monochrome, dark mode, luxury, big typography, neumorphism, swiss style, bento grid, editorial, grainy, skeuomorphic.
Do not offer: aurora gradient, soft 3d, claymorphism, isometric, playful.

## Round 9: keeping the taste lane on topic (15 queries)

Leaving the domain out of the taste lane (round 8) avoided repeats but drifted off topic: "big typography checkout ui" returned sneaker and restaurant checkouts. Repeats are now handled by cross-lane dedupe and the canvas exclude, so the domain goes back in, together with "ui design".

| Template (3 styles: big typography, minimal, glassmorphism) | Good | On-topic titles | New vs fidelity |
| --- | --- | --- | --- |
| `{style} {component} ui` | 24 | 1 | 24 |
| `{style} {domain} {component} ui design` | 21 | **20** | 19 |
| `{style} {domain} app {component} ui` | 20 | 20 | 17 |
| `{style} travel {component} app ui` (broader domain) | 26 | 18 | 26 |

New taste template: `{style} {domain} {component} ui design`.

## Round 10: bridge lane (32 queries)

The owner's live board for "Flight checkout screen for a GCC travel OTA" was about 60% unrelated to flight booking: Sadu weaving photos, seed packets, Uzbek suzani jackets, tassels, a car air freshener. The raw idea (inspiration lane) brings the mood but not the screen. Can a query carry the idea into UI directly? Four forms, one per idea, on `site:dribbble.com/shots` with the UI negatives:

| Form | Good | Title has the idea | Travel |
| --- | --- | --- | --- |
| `{i} ui design` | 39 | 11 | 0 |
| `{i} app ui` | 38 | 5 | 0 |
| `{i} travel app ui` | 41 | 3 | 31 |
| `{i} inspired flight app ui` | 23 | 0 | 18 |

- `{i} ui design` returned plenty of real shots, but only 11 of 39 were about the idea. The rest were generic UI that matched "ui design".
- When the idea is a real product, it works: "vending machine ui design" gave 7 real vending machine UIs.
- Niche crafts give nothing: "sadu" and "suzani" gave 0 shots that name the idea.
- Adding the domain ("travel", "flight") pulls results back to travel apps and drops the idea almost entirely (3 and 0 titles with the idea). That is the fidelity lane's job already.

**Conclusion:** keep the bridge lane only with the title precision filter. The server sends `"{ingredient} ui design"` (arm `app`: `"{ingredient} app ui"`) and keeps a result only when its title has the ingredient's head word (whole word, any case, singular or plural). Expect the lane to be empty often; its places flow to the other UI lanes. It costs 1 request, inside the 8-request cap, and comes before the hero lane when the budget cuts. Together with the new default `mix: "ui"` (about 20% inspiration, UI lanes first) and agent-side idea triage (`rate_directions`), a board for a screen brief should lead with screens.

## Rounds 11a and 11b: UI-only audit (owner: "100% of results are UI and component images")

Title gate on every result: keep only titles with a UI word (app, ui, ux, dashboard, website, landing, screen, mobile, onboarding, checkout, widget, component, ...), and drop logo/branding/poster/illustration/packaging titles unless they also say app, ui, dashboard or website. Untitled pins are dropped.

**11a: 8 briefs x 8 UI lanes** (fidelity on Dribbble and Pinterest, taste, two component lanes from the brief, hero, bridge, Arabic locale). About 400 results kept; every one reviewed by eye on contact sheets is a UI screen or component. Weak: 3 or 4 phone mockups with near-empty screens. The bridge lane (`{ingredient} ui design`) is almost always empty after the gate.

**11b: wild or non-UI asks forced into UI forms** (kept after gate, Dribbble shots):

| Ask | app ui | ui design | website ui | ui |
| --- | --- | --- | --- | --- |
| city pop 1985 | 0 | 3 | 0 | 3 |
| Uzbek suzani | 0 | 0 | 0 | 0 |
| brutalist | 7 | 6 | 6 | 9 |
| coffee shop branding | 9 | 8 | 9 | 9 |
| luxury perfume packaging | 5 | 5 | 5 | 4 |
| glassmorphism | 10 | 9 | 8 | 10 |
| japanese minimalism | 8 | 6 | 6 | 5 |
| make it cool | 10 | 10 | 10 | 10 |
| gas station sign | 6 | 7 | 2 | 6 |
| teletext 1980s | 0 | 0 | 0 | 0 |
| art nouveau | 2 | 4 | 4 | 4 |
| vaporwave | 4 | 0 | 2 | 1 |

All 60 sampled kept items were UI. Decision: remove the raw inspiration lane, gate every result, add component lanes from the brief, and force plain queries into UI forms. Wild ideas live in direction notes, not images.

## Round 12 (2026-10-15): the taste bar (P0-17 steps 1 and 2)

**Goal:** references at the quality of the owner's boards (`docs/taste-bar.md`). The boards were looked at
once in headless Chrome (first screen only, nothing saved).

**Method:** 125 Serper image queries (125 credits of the 150 budget), 10 results each, run through the
server's own mapper (`mapSerperImagesWithStats`: item page, host allowlist, junk, kit and UI title gates,
ranking). The top 8 kept results of each query were rendered as a contact sheet of hotlinked images in
headless Chrome and judged by eye against the bar:

- **great:** could sit on the owner's boards and is the brief's page;
- **good:** the brief's page, but generic;
- **bad:** off page, wrong platform, kit, listicle or below the bar.

Precision is **great out of 8 slots** (empty slots count as misses). "On page" is great plus good out of 8.
One judge (the agent), not owner gold ratings. The screenshots were deleted after rating.

**Pages:**
- **Mobile:** paywall, onboarding, wallet (finance home), checkout.
- **Web app:** analytics dashboard, admin data table. A CRM dashboard was added as a holdout check.

`{N}` below is the UI negatives (`-template -kit -free -wireframe`), sent on every Dribbble, Pinterest and
Behance query.

### Mobile

| Wording | Site | Pages | Great | On page |
| --- | --- | --- | --- | --- |
| `{page} app ui {N}` (today's fidelity lane) | dribbble | 4 | 2/32 (6%) | 28/32 (88%) |
| `minimal {page} app ui {N}` | dribbble | 4 | 1/32 (3%) | 28/32 (88%) |
| `{page} app product design {N}` | dribbble | 4 | 0/32 | 27/32 (84%) |
| `{page} app ui 2025 {N}` | dribbble | 4 | 0/32 | 25/32 (78%) |
| `{page} ios app ui {N}` | dribbble | 3 | 1/24 (4%) | 20/24 (83%) |
| `dark mode {page} app ui {N}` | dribbble | 4 | 3/32 (9%) | 22/32 (69%) |
| `dark mode minimal {page} app ui {N}` | dribbble | 4 | 4/32 (12%) | 20/32 (62%) |
| `dark {page} app single screen` (hero form) | dribbble | 3 | 1/24 (4%) | 12/24 (50%); paywall kept 0 of 10 |
| `dark finance app home screen ui`, `dark mode minimal banking app home ui` | dribbble | wallet | 6/16 (37%) | 13/16 (81%) |
| `{page} app ui {N}` | pinterest | 4 | 3/32 (9%) | 30/32 (94%) |
| `{page} app design {N}` | pinterest | 4 | 4/32 (12%) | 28/32 (88%) |
| `dark mode {page} app ui {N}` | pinterest | 4 | 9/32 (28%) | 26/32 (81%) |
| **`{phrase} ui ios app {N}`** | pinterest | 4 | **12/32 (37%)** | **31/32 (97%)** |
| **`dark {phrase} ui ios app {N}`** | pinterest | 4 | **16/32 (50%)** | 26/32 (81%) |
| `{page}` | screensdesign | 4 | 0/32 | 10/32 (31%) |
| `{page}` | 60fps | 4 | 4/32 (12%) | 13/32 (41%) |
| `pay` | 60fps | checkout | 4/8 (50%) | 6/8 |
| `{page} app ui {N}` | behance | 4 | 0/32 | 17/32 (53%) |
| `{page} app` | cosmos | 2 | 0 results | |

Per page, the best wording:

| Page | Best wording | Great |
| --- | --- | --- |
| Paywall | `dark paywall subscription ui ios app` on Pinterest | 8/8 |
| Onboarding | `welcome screen ui ios app` on Pinterest | 5/8 |
| Onboarding | `dark onboarding ui ios app` on Pinterest | 4/8 |
| Wallet home | `wallet balance ui ios app` on Pinterest | 6/8 |
| Wallet home | `dark wallet balance ui ios app` on Pinterest | 4/8 |
| Wallet home | `dark mode minimal banking app home ui` on Dribbble | 3/8 |
| Checkout | `pay` on 60fps (CRED, Swiggy, Airbnb, Apple Pay) | 4/8 |
| Checkout | `dark mode minimal checkout app ui` on Dribbble | 2/8 |

- **Why the winner works:** Pinterest holds a large series of reposted shipped screens titled
  "{Page} UI from {App} iOS App" ("Paywall & Subscription UI from Flighty iOS App", "Wallet & Balance UI
  from Revolut iOS App", "Welcome Screen UI from Claude iOS App"). One staged phone, real product polish,
  often dark: the bar. The query must use the series' page phrase: "paywall subscription", "wallet
  balance", "welcome screen".
- **Checkout has no series.** On Pinterest, `dark checkout ui ios app` drifted to wallets, banking and
  furniture shops (0/8 great, 4 bad). Checkout's great results came from 60fps shipped interactions
  and Dribbble.
- **Dribbble on mobile is on page but generic.** It gave 84 to 88% on page with every wording, but almost
  no great results: three-phone concept comps on gradients. Taste words do not fix this on Dribbble.
  `dark mode` even pulled web checkout pages onto a phone brief (4 of 8 bad).
- **Domain words help Dribbble:** "finance app home", "banking app home" lifted wallet from 0 to 37% great.

### Web app (dashboard)

| Wording | Site | Pages | Great | On page |
| --- | --- | --- | --- | --- |
| `{page} ui {N}` (today's fidelity lane) | dribbble | 3 | 4/24 (17%) | 22/24 (92%) |
| `minimal {page} ui {N}` | dribbble | 2 | 4/16 (25%) | 14/16 (88%) |
| `{page} product design {N}` | dribbble | 2 | 2/16 (12%) | 14/16 (88%) |
| `saas {page} ui {N}` | dribbble | 2 | 2/16 (12%) | 14/16 (88%) |
| `{page} ui 2025 {N}` | dribbble | 2 | 3/16 (19%) | 13/16 (81%) |
| `linear style {page} ui {N}` | dribbble | 1 | 1/8 | 5/8 |
| `dark mode {page} ui {N}` | dribbble | 3 | 11/24 (46%) | 20/24 (83%) |
| **`dark mode minimal {page} ui {N}`** | dribbble | 5 | **19/40 (48%)** | **36/40 (90%)** |
| `dark {page} web app ui {N}` | dribbble | 2 | 7/16 (44%) | 16/16 (100%) |
| `{page} ui {N}` | pinterest | 2 | 0/16 | 15/16 (94%), 2018 to 2020 shots |
| `dark mode {page} ui {N}` | pinterest | 2 | 2/16 (12%) | 11/16 (69%) |
| `{page} ui from web app {N}` | pinterest | 1 | 0/8 | 6/8 (no shipped web series) |
| one word (`analytics`, `table`) | nicelydone | 2 | 0/16 | 15/16 (94%) |
| two words (`analytics dashboard`) | nicelydone | 2 | 0/16 | 9/16 (56%) |
| one or two words | refero | 4 | 0/32 | 15/32 (47%) |
| one or two words | saasframe | 4 | 0/32 | 2/32 (6%) |
| page words | darkdesign, cosmos, arena | 4 | 0 kept | |
| `{page} ui {N}` | behance | 2 | 0/16 | 9/16 (56%) |

The `dark mode minimal` rows by page:

| Page | Great |
| --- | --- |
| Analytics dashboard | 5/8 |
| Finance dashboard | 4/8 |
| CRM dashboard (holdout) | 6/8 |
| Admin table | 3/8 |
| Data table | 1/5 |

- **Dark plus minimal is the lever on web.** It returns the bar's quiet dark dashboards: dense tables,
  thin bars, one accent, windows over landscape photos. "2025", "product design" and "saas" add nothing.
- **Dark variants repeat each other.** The same shots (Faris, Xenit, Sohail Ahmed) came back from
  `dark mode`, `dark mode minimal` and `dark mode ... 2025`. Send one dark wording per board, not three.
- **Galleries give shipped screens that never reach great.** Nicelydone and Refero are full-page
  screenshots, small and plain. They are fine for the "Shipped today" baseline. Nicelydone needs a single
  head word: `analytics` gave 94% on page, `analytics dashboard` gave 56%.
- **SaaSFrame indexes companies, not pages.** A page word matches analytics companies' landing pages,
  pricing pages, settings, docs and emails: 2 of 32 on page.

### Below-bar title patterns seen

1. **Listicles:**
   - "40 Best Mobile App Onboarding UI Examples"
   - "Onboarding design ideas | How to design app onboarding"
   - "Data Table UI Design Guide & 30+ Examples"
   - "Best Website Dashboard UI Examples for Design Inspiration #61"
2. **Promo and resource pins:**
   - "Design Resource / Onboarding screens"
   - "ScreensDesign - App Design Library & UI Inspiration from Top iOS Apps"
3. **Concept comps** (on page, generic, good at best):
   - "Wallet App Concept Design", "Digital Wallet UI concept", "Checkout Screen Concept"
   - "Exploration - Wallet App Dark Version"
   - `quality.ts` scores "concept" **up** today (UNCLUTTERED_WORDS and DESIGN_WORDS).
4. **Challenge shots:** "Daily UI #002", "Day 002 ( Credit Card Checkout )", "#DailyUI002",
   "Day 349: Checkout Process".
5. **Neighbour pages:**
   - On a paywall: "Mobile Loading States & Shimmer UI", "Add Interests Screen", "Hypnotizing welcome
     screen".
   - From "subscription plan": "Subscription Tracker app", "Wallpaper ... Pricing Plans".
6. **Wrong platform from "dark mode":**
   - Web pages on a phone brief: "Checkout Page [Dark mode]", "Credit Card Checkout Page - Dark Theme".
   - Phone screens on a web brief: "SaaS Dashboard Mobile App", "Table in a mobile view".
7. **Gallery shapes:**
   - SaaSFrame: "{Product} Landing Page UI Design", "Pricing Page", "Danger Zone Settings",
     "Account Verification Email".
   - ScreensDesign: "{App}: {Category} UI Breakdown" is a whole-app breakdown, so its image is often
     another screen (tracking prompt, home).

**Positive title pattern:** "{Page} UI from {App} iOS App", a shipped screen. It gave most of the great
mobile results.

### Proposal for step 3 (no code yet: the bend agent owns `lib/bend` and `quality.ts` today)

1. **Taste lane wording per platform** (`lib/bend/queries.ts`, `lib/sources/plan.ts`):
   - **Mobile, taste lane:** `dark {phrase} ui ios app {N}` on `pinterest.com/pin`. `{phrase}` maps the
     page noun to the series phrase:
     - paywall, plan picker → "paywall subscription"
     - onboarding, welcome, sign up → "welcome screen"
     - wallet, finance home, balance → "wallet balance"
     - otherwise → the page noun
   - **Mobile, light twin:** `{phrase} ui ios app {N}` replaces the Pinterest fidelity page.
   - **Mobile, hero lane:** drop `{style} {domain} app single screen`. It kept 0 and 1 of 10 for paywall
     and wallet. Spend its request on the light twin.
   - **Web app, taste lane:** `dark mode minimal {domain} {page} ui {N}` on `dribbble.com/shots`.
     Fallback: `dark {page} web app ui {N}`.
   - **Style words:** the user's taste words replace "dark" or "dark mode minimal" when given. The dark
     default is the owner's bar, not a house style.
   - **Never send:** "2025", "product design", "saas", "single screen".
2. **Source order:**
   - **Mobile:**
     1. Pinterest dark ios app
     2. Pinterest light ios app
     3. Dribbble fidelity with domain words ("{domain} app {page} ui")
     4. 60fps, only when the page is checkout, pay, card or wallet (searched as "pay" or "card")
   - **Mobile, drop from default routing:** ScreensDesign (0 great, 31% on page). Behance and Cosmos
     stay off mobile UI lanes.
   - **Web app:**
     1. Dribbble `dark mode minimal`
     2. Dribbble fidelity
     3. Nicelydone with one head word ("Shipped today" baseline)
     4. Refero with one head word
   - **Web app, drop from default routing:** SaaSFrame. Pinterest is a fallback only (old shots).
     `galleryWords` should cut the topic to its head word for Nicelydone and Refero.
3. **Title rules in `quality.ts`:**
   - **Drop as junk:**
     - listicles: `\b\d+\+?\s+(?:best|top)\b`, `\bexamples\b`, `\bdesign ideas\b`, `\bhow to\b`,
       `\bui design guide\b`, `\binspiration #\d+`
     - promos: `\bdesign (?:resource|library)\b`, `\bui inspiration from\b`
   - **Rank down by 1.5:**
     - `\bconcept\b`, `\bexploration\b`, `\bdaily ?ui\b`, `#dailyui`, `\bday\s*#?\d{1,3}\b`,
       `\bchallenge\b`
     - Remove "concept" from UNCLUTTERED_WORDS and DESIGN_WORDS.
   - **Rank up by 2:** `\bui from [^|]{2,40}\b(?:ios|android) app\b`.
   - **Recency:** extend `recencyScore` to Pinterest pins that carry a title year, since Pinterest UI
     results lean 2018 to 2020.
4. **Tests to add:**
   - `lib/bend/queries.test.ts`, mobile:
     - a paywall brief's taste lane is `dark paywall subscription ui ios app` on Pinterest;
     - a wallet brief maps to "wallet balance", an onboarding brief to "welcome screen";
     - no mobile lane contains "single screen", "2025" or "product design".
   - `lib/bend/queries.test.ts`, web app: the taste lane starts with "dark mode minimal" and names the
     page; the user's taste words replace "dark mode minimal" when given.
   - `lib/sources/registry.test.ts`:
     - `pickGalleries` for mobile never returns ScreensDesign without a tag;
     - for webapp it never returns SaaSFrame;
     - for checkout or wallet pages, mobile picks 60fps.
   - `lib/sources/plan.test.ts`: `galleryWords("nicelydone", "analytics dashboard ui")` is "analytics".
   - `lib/sources/quality.test.ts`:
     - the listicle and promo titles above are junk;
     - "Wallet & Balance UI from Revolut iOS App" ranks above "Wallet App Concept Design" at the same
       size;
     - "Daily UI #002 - Credit Card Checkout" ranks below a plain titled shot;
     - "concept" no longer scores up.
   - **Bench:** rerun the same briefs. Done when the share of great UI references rises and no brief's
     bend quality drops (P0-17).

**Risks:**
- One judge rated these. The owner should spot check a sheet before the wording ships.
- The Pinterest series is someone else's repost account. If it stops, the light Dribbble fidelity lane
  still gives 88% on page.
- Android briefs were not tested. "ios app" may need an "android app" twin.
