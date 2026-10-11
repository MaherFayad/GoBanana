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
