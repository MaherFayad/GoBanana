---
name: gobanana-explore
description: Bend one page or screen into wild, usable directions, each with a full visual spec, then pull two zones of linked references into a GoBanana moodboard canvas - art direction (the wild idea as images) and platform-correct UI references - with a "steal:" note on each. For one crazy idea over a page or two (launch page, onboarding, empty state, 404, paywall, year in review), not a whole product redesign. Use when the user says "explore directions", "go wild", "push this design", "crazy ideas for", "make it weird", "make it cool", "make it bananas", "something nobody has done", "unexpected directions", "get me out of the box", "fresh take on", "inspire me", "where can we be weird", "this looks like every other app", or asks for bold visual concepts, art directions or references for a screen, page or launch. Runs get_canvas, new_canvas, bend_brief, search_references, rate_references, rate_directions, add_to_canvas, arrange_canvas and open_canvas from the GoBanana MCP server, plus the user's Mobbin connector when it is connected. Use gobanana-moodboard to arrange a board, gobanana-frankenstein to stitch parts of the references into new pages, gobanana-handoff to hand a kept direction to a coding tool.
---

# GoBanana explore

Turn a fuzzy "make it cooler" into six to eight sharp, buildable directions for one page or two, each in its own visual language, then fill a board with two zones of references: the wild idea as images (art direction) and real UI for the platform. Mobbin shows what works. GoBanana shows what's next.

GoBanana is for one crazy idea over a page or two: a launch page, onboarding, an empty state, a 404, a paywall, a year in review. It is not the product's main design direction. Say so when the user asks to redesign the whole product, and help them pick where the weirdness should go.

The GoBanana server does no thinking. It bends the brief with word lists and templates and runs web image searches. You do the thinking: shape the brief, pin the platform and pages, reject weak ideas, judge every result, write the notes.

## Ground rules

- **Source links, always.** Every reference you mention gets its source link, like `[Title](sourceUrl) (dribbble.com)`. No link, no mention.
- **Never download, save or copy reference images.** Not into the repo, not into a temp folder, not as base64. Link to them. This holds for Mobbin screens too: the board hotlinks the connector's `image_url` and links each one to its `mobbin_url`, even when the Mobbin tool says to download.
- **Do not describe images you have not seen.** Talk about the direction and the titles, not pixels you cannot see.
- **Plain words.** Short sentences. No em dashes.
- **Usable beats wild.** Reject any idea that cannot become UI for the named page. Never name an idea dropped for no UI path, weak references or as a duplicate. Declined challengers are the one exception: they show on one compact line with what a kept direction took from them (step 7b).
- **Two zones, never mixed.** Each direction has art direction references (zone `art`: the idea as raw images, for mood, texture, color and form) and UI references (zone `ui`: screens and components for the platform). Art items go in the "Art direction" row of the section; UI items go in the "UI references" grid. Never put an art item in the UI grid, never count art toward the UI total, never present art as a screen to build.
- **Mode first.** Ask which mode before any other work (see "First: ask the mode"). Never skip it to go further.
- **Explore writes nothing.** Explore never writes project files or code. It ends at the board and the directions with the question "Draft any of these?".
- **Taste first.** Ask the user for 3 to 5 style words or a reference board before `bend_brief`, in the same turn as the mode question; never invent them.
- **Arabic copy.** Any Arabic UI copy you write (labels, notes, prompts): noun-form labels (الدفع, not ادفع الآن; ملخص الرحلة, not لخص رحلتك), no diacritics, Western digits (0 to 9), Latin IATA codes (RUH, DXB, JED), right to left.
- **Right platform.** Never show web dashboards or landing pages on a phone brief, and never phone screens on a website or web app brief. Rate them `bad` with `off_topic`.
- **One question at most per turn.** When you must ask, fold everything you need (mode, taste, subject, platform, where the weirdness goes) into one short question. Never a list of questions.
- **Trust write results.** `add_to_canvas`, `rate_directions`, `rate_references` and `arrange_canvas` answers are the record. Do not call `get_canvas` after each write to check it. Read the board at most once, at the end, and only if you need something from it.

## Steps

### First: ask the mode

Before any work (no search, no canvas, not even the free `bend_brief` in step 3), ask once. In Claude Code use AskUserQuestion; in the Claude app and elsewhere ask in chat. One question, four options, Explore first:

> How far should I take this?
> 1. **Explore directions (Recommended):** 6 to 8 very different directions with references on the board. Nothing is drafted or built until you say so.
> 2. **Explore, then draft my picks:** the same, and I draft the directions you pick as quick screens.
> 3. **Finished from the first go:** I work like a design team: problem, space, specs, wireframes, references, directions for you to pick, then the full app with components, tokens and a clean file structure.
> 4. **Just references:** a big clustered board, no directions yet.

In the Claude app, option 3 reads: "Finished needs Claude Code; I'll do drafts here and give you a build pack to finish there."

Fold the taste question into this same turn, so the user is asked once. If style words or a reference board are missing, add one line under the options (in AskUserQuestion, a second question in the same call): "Also give me 3 to 5 style words or a reference board." If the subject or platform is also missing, fold those in too (step 1). Then stop and wait.

**Skip the question** only when the user already said which:

- "explore", "directions", "go wild", "inspire me" -> Explore
- "draft it", "mock it up" -> Drafts (explore, then draft my picks)
- "build the whole app", "ship it" -> Finished
- "just references", "moodboard" -> Just references

When unsure, ask. Never skip it to go further. When you skip it, say the mode in one line ("Mode: Explore") and go on. If taste is still missing, ask only for taste (step 1).

**What each mode does:**

- **Explore:** steps 0 to 14. No project files, no code. It ends at the board and the directions with the question "Draft any of these?".
- **Drafts:** the Explore flow first. Draft only after the user picks, and only the picks, as quick screens.
- **Finished:** the full build pipeline is not built yet. Say in one line that it is coming, run Explore now, and offer drafting the picks next. In the Claude app, say Finished needs Claude Code and offer drafts plus a build pack (gobanana-handoff).
- **Just references:** steps 0 to 2 and 6, then one `search_references` with the brief as `query`, no `directionId` and `count: 24`; rate it (step 10), place the usable ones and call `arrange_canvas` with `masonry`. No `bend_brief`, no directions.

Every mode can move up a step later without redoing the work ("draft these", "build it"): the board and the directions carry over.

### 0. Check for Mobbin first

Right after the mode is settled, look for the user's own Mobbin connector: tools named like `mcp__*Mobbin*__search_screens`, `search_flows` or `search_sections`. Note the answer; steps 6b, 8, 11 and 12 use it. When it is connected, the run uses both: Mobbin for what real shipped apps do on this page (the baseline and the usable patterns, placed on the board as screens), GoBanana for the wild directions and references that go past it. If none exist, skip every Mobbin step silently: do not mention Mobbin.

### 1. Shape the brief

Write a one-line brief (max 500 characters). A good brief names:

- **Subject:** the page or screen ("flight checkout screen", "launch page for a coffee roaster").
- **Audience or context**, if known.
- **The default to escape**, if they named one ("looks like every fintech app").
- **Must keep**, if any (brand color, Arabic and English).

If the ask is too vague to name a subject ("make it cool"), ask ONE short question that folds in the platform, the taste and states the wildness default (in the same turn as the mode question when that is still open), then stop and wait:

> What should I make cool, and is it for a phone app, a website or a web app? Give me 3 to 5 style words or a reference board. I'll go at 3 of 5 unless you say otherwise.

**Taste first.** When the subject is clear but the user gave no style words or board, ask for them in that same one question ("Give me 3 to 5 style words, like minimal or big typography, or a reference board"). Do not ask about wildness or anything else separately. Ask once, together with the mode question. If the user said "just go", do not ask; never invent style words for them: each direction then uses its own `spec.styleWords`, and you say so.

### 1b. Light Stage 0: problem and worth questioning

Infer a short problem summary from the brief and the repo (README, copy, screens; analytics or ticket tools if connected). Ask nothing extra beyond the mode and taste question. Never invent numbers, customers or benchmarks; write "unknown" instead. Keep it in your head, not in a file:

- **Job:** the one thing the user of this page must get done.
- **Who:** the person, their situation and device.
- **Goal and metric:** what the business needs, and the number that shows it, if known.
- **Must keep:** brand, languages, legal parts, the one primary action. These also go into `mustKeep` (step 7).
- **Edge cases:** the 3 to 5 situations that break the happy path (empty, error, long names, Arabic and RTL, slow network).

Then note up to 5 **Worth questioning** items: complexity that comes from business decisions, not user needs. Look for extra pricing tiers, a sign up before value, a required field nobody uses, a confirmation for a reversible action, a choice a sensible default could make. Each is one line: what to change (cut, merge, default, defer) and why. Never remove anything silently. Never challenge legal or accessibility needs (PDPL consent, ZATCA invoice fields, WCAG); make them easier to complete, never optional. Simpler is not emptier: never hide the total, fees or cancellation terms.

The list goes in the final reply (step 13). It is not a gate the user must pass. The subtract direction (step 7) applies it; items the user accepts later become constraints for drafts, and rejected ones are not raised again.

### 2. Pin the platform

One of `mobile`, `tablet`, `website`, `webapp` (or `any` when it truly does not matter).

| Words in the ask | Platform |
| --- | --- |
| iPhone, iOS, Android, app screen, mobile app, onboarding in the app, paywall | `mobile` |
| iPad, tablet | `tablet` |
| landing page, launch page, marketing site, homepage, campaign page, 404 on the site | `website` |
| dashboard, admin, SaaS, web app, settings in the browser, table, CRM | `webapp` |

If the words are clear, pin it and say it in your reply ("Platform: mobile"). If not, fold it into your one question (step 1). With "just go", guess and say so. Always pass `platform` to `bend_brief`; the server would detect it from the brief, but your read is better.

### 3. Pin the pages: where should the weirdness go?

Pass 1 to 3 `pages` to `bend_brief` (each up to 60 characters): the page or screen the idea is for ("checkout", "first run onboarding", "/launch").

- **The user named a page or screen:** use it.
- **The user named the whole product** ("go wild on our banking app", "make our site weird") and no page: this step is required. Do not pick pages yourself and do not bend the whole product. Call `bend_brief` once with the brief, `platform` and no `pages` and no `canvasId` (free, nothing is saved). Its `wildSpots` lists places where weirdness pays off for that platform, each with a reason. Then reply with one line saying GoBanana works best on one page or two, not the whole app, and ask exactly one question: **"Where should the weirdness go?"** Show 4 to 6 spots as a numbered list, one line each: the page and the why. Say they can pick 1 to 3. Stop there and wait: no `new_canvas`, no search, no directions, and no other question (no taste, no style words). Only if the user said "just go" (or "don't ask"): take the top spot, say so, and go on with it as `pages`.

If the server returns no `wildSpots`, offer these:

- **mobile:** splash and first launch, onboarding, paywall, empty states, success moments, year in review, a settings easter egg.
- **tablet:** welcome, lean back reading views, empty states, recap stories.
- **website:** launch page, campaign page, homepage hero, 404, pricing, about or manifesto, year in review.
- **webapp:** first run and empty dashboard, upgrade moments, milestones, usage recap, 404 and errors.

Keep the daily task screens (sign in, checkout steps, forms, tables, navigation) calm unless the user names them.

### 4. Pick wildness (1 to 5)

| Level | Label | Feels like |
| --- | --- | --- |
| 1 | Fresh | Same layout, new flavour |
| 2 | Bold | One strong move |
| 3 | Weird | Two moves combined. **Default** |
| 4 | Wild | Two or three moves |
| 5 | Bananas | Three moves, usability ignored on purpose |

"A bit fresher" or "subtle" is 1 or 2. "Push this", "go wild" is 4. "Bananas", "unhinged" is 5. No signal: 3, and say they can turn it up or down.

### 5. Optional: lens, moves, taste

- **Lens** (`lens`): a curated culture preset when the user mentions Saudi, Gulf, Arabic or regional heritage. Gulf ids: `sadu` (Bedouin weaving), `najdi` (mud architecture), `kufic` (square Kufic geometry), `mashrabiya` (lattice screens), `talli` (Emirati metallic braid), `qatt-asiri` (Al Qatt Al Asiri wall painting from Asir), `desert-modern`. Global: `memphis`, `swiss-international`, `japanese-ma`. Each lens has tested search words, drops look-alike traditions from results (talli drops Egyptian tulle-bi-telli) and names an Arabic display font on Google Fonts; use that font in the spec. When a Gulf or Arabic brief has no lens, `bend_brief` suggests some: bend again with one of them unless the user said no lens. Never ask for or use sacred text or religious verses.
- **Moves** (`moves`): only when the user asks for a kind of bend: `transplant`, `material`, `era`, `constraint`, `scale`, `lens`.
- **Taste:** use the 3 to 5 style words or the board the user gave in step 1. Never invent them. Words that search well: minimal, glassmorphism, liquid glass, dark mode, big typography, monochrome, luxury, swiss style, bento grid, editorial, grainy, skeuomorphic. If the user shares images you can see, describe them in those words; never download them. Pass `taste` to `new_canvas` or `bend_brief`. Without taste, each direction uses its own style words (`spec.styleWords`). There is no house style; do not invent one.

### 6. Pick the canvas: extend one, or create one (do not show it yet)

1. **A canvas already in this conversation:** use its `canvasId`.
2. **Otherwise call `get_canvas` with no `canvasId`.** It lists recent canvases with their briefs and how many directions each has saved. If one is the same product or project, use it: new directions get new sections, nothing is removed. Do not start a new board for the same brief to "keep a run clean". Read it with its id so you do not repeat directions or references. Say in one line which board you are adding to.
3. **Only when nothing matches, or the user asks for a new board,** call `new_canvas` with a short `title`, the `brief` and `taste` if you have it.
4. **Canvas limit** (free plans have 3): relay the message once, then offer two ways out: add to an existing board, or delete an old one. To delete: list the boards with `get_canvas` (no id), ask which one, then confirm by name: "Delete 'Frosted checkout' for good? Its sections, references, tray and share link go too. This cannot be undone." Call `delete_canvas` with that `canvasId` and `confirm: true` only after the user's explicit yes. No yes, no delete. Never pick a board to delete yourself.

Do not call `open_canvas` yet. The user sees the board once, finished, in step 13.

### 6b. Mobbin baseline (only when step 0 found Mobbin)

Before you bend, search Mobbin once per page for the same page on the same platform, for example "checkout" on iOS (`search_screens`; add `search_flows` when the page is a flow, such as onboarding or checkout). Use the tool's own inputs. Pick 3 to 6 real shipped screens and write down, for yourself, in a few words each:

- **The baseline:** the layout, components and order most shipped apps share on this page ("summary card, then a payment sheet, sticky pay button").
- **The must keeps:** the patterns users rely on that a wild direction must not break (clear total, one primary action, the step indicator).

Use both in the next steps: put the default to escape into the brief you pass to `bend_brief` when it helps ("not the usual summary card and payment sheet"), and keep each screen's `mobbin_url`, `image_url`, app name and platform for steps 11 and 12.

### 7. Bend the brief, wide

Write the grounded `candidates` first (step 7b.1). Then call `bend_brief` with `brief`, `wildness`, `platform`, `pages`, `count: 8` (the most it takes), `candidates` and the `canvasId`, plus `lens`, `moves` and `taste` if chosen, and `mustKeep` with the must keeps from steps 1, 1b and 6b ("clear total", "one primary action", "step indicator"). Each direction comes back with a short `title` (the idea, at most 4 words), a `mechanic`, a `spec` (typography, typeVoice, color, layout, imagery, motion, texture, iconography, density, signature, pattern, steal, avoid, styleWords, whyItFits), `artQueries`, a `source` (`candidate`, `challenger` or `lists`) and a `language` (7 axes, step 7b.2). The result also carries `diversity`: `{ minAxesApart, pairsBelow4 }`. It is free and unlimited.

**Build every direction around its mechanic.** `mechanic` is `{ element, how }`: the working part of the page the wild idea becomes (`progress`, `total`, `cta`, `divider`, `section-nav`, `header` or `empty-state`; for example a braid as the progress bar, tabs as sections, a woven band as the section divider). It never breaks a must keep: the server drops a direction whose ingredients would. Use it in the pattern you describe, in the card, and in searches: look for UI that has that element ("flight checkout progress bar app ui").

### 7b. Directions: six to eight, each its own language

You propose, the server rolls. You write the grounded candidates; the server picks which lead directions, adds challengers from its own lists and gives every direction a language.

1. **Ground first, then pass them as `candidates`.** Before listing, name the rut in your head: the category default and its predictable opposite. Neither may appear. Then, from the problem summary, the Worth questioning list and the brief, write 7 to 10 candidates from the audience's world: objects, places, rituals, graphic traditions, publications, signage, data graphics. Each is one object:
   - `name` (up to 60 characters): the thing itself ("Railway departure board").
   - `why` (up to 160): why it resonates with this audience and how it can carry the mechanic.
   - `looks` (up to 160): ground, main colors, type voice and the one signature ("black ground, amber split flap letters, condensed caps, rows that flip in place").
   - `family` (up to 40): its material family ("signage", "print", "textile", "data graphics").

   Span at least 3 families. Never use a tool the audience itself operates (for AI products: no terminal, no chat bubble, no robot). When the brief paints its own picture ("a launch page like a night market"), at most one candidate may be that picture taken literally; the rest come from around it.
2. **Read the server's language.** Each direction's `language` is `{ typeVoice, colorStrategy, ground, density, composition, material, motion }` (color strategy: restrained, committed, full or drenched; ground: light, dark, colored or photographic; density: airy, balanced or dense; composition: grid, editorial, poster, layered, list-first or card-first; material: flat, print, glass, object, photographic or textile; motion: still, snap, glide, spring or cinematic). Use it as given in the idea notes and cards; do not write your own axes. You may give a direction a sharper title when its candidate names it better; keep its `directionId`.
3. **Judge the challengers.** At `count: 8` about 6 directions are candidate led (`source: "candidate"`) and about 2 are challengers (`source: "challenger"`). Judge each challenger against the candidate led directions on two axes only: audience identification (would this audience know it by heart?) and product clarity (does the page still read at a glance?). Decide its verdict before you borrow anything from it: **wins**, **competitive** or **declined**. Wins and competitive challengers join the shortlist like any direction. A declined challenger is not shown as a card and not searched. It is not wasted either: name the one discipline of its system the kept directions lack, and write it into the closest kept direction as its own line, `RAISE from <challenger title>: <the discipline, applied>` ("RAISE from Kitchen ticket rail: one strip per agent, nothing else on the row"). A raise nobody can read did not happen.
4. **Check before you show anything:**
   - **Difference:** `diversity.pairsBelow4` is empty. If it lists pairs, drop the weaker of each pair as `duplicate_idea`, or bend once more with that direction's candidate replaced (at most one re-bend; it counts as the second bend in step 8).
   - **Memory test:** what would someone describe an hour after seeing the first screen? If the answer is a mood, it fails.
   - **Category test:** if someone could guess the look from the category name alone, it fails.
   - **Saturated looks:** cream plus serif plus terracotta; near black plus one neon; broadsheet hairlines plus italic serif plus mono labels; flat ink plus hard offset shadows. Landing on one the brief did not ask for fails.
   - **Job:** it still does the Job from step 1b and keeps every must keep.
5. **The spread:** 2 Ship, 2 or 3 Stretch, 2 or 3 Wild. One Ship direction is the **subtract** direction: the same job with the Worth questioning items applied and nothing added. Take the calmest rolled direction for it and say what it removes. On calm task pages (forms, checkout steps, tables) every direction changes only type, palette, density and one signature move, never the layout, navigation or controls.

### 8. Triage the ideas (before you show any)

Keep an idea only if all of these hold:

- **(a) UI path.** Its `mechanic`, `spec.pattern` and `spec.signature` give the named page a concrete UI move on this platform ("fare cards that stack like boarding passes"). If you cannot say it in a few words, it fails.
- **(b) Usable UI references.** After search and audit it has at least 4 on-topic UI references for the platform. Art references do not count here.
- **(c) Its own language.** It passes the checks in step 7b.
- **With Mobbin (step 6b):** also drop an idea that lands on the baseline (it only restyles what shipped apps already do), and prefer ideas whose `spec.pattern` keeps the must keeps. Name the Mobbin pattern a kept idea builds on.

1. **First pass, free:** apply (a) and (c) to all 8, after the challenger verdicts (step 7b.3). Shortlist 6 to 8, or the number the user asked for. Each shortlisted direction costs one search (step 9). Fewer than 6 pass when the user asked for no smaller number: call `bend_brief` once more (new candidates in place of the failed ones, other `moves` or a `lens`), shortlist from both rolls, and if still under 6, go on with what you have and say why in one line. Never bend a third time.
2. **Second pass, after searching:** apply (b). Retry the weakest UI lane first (step 10.3). Still under 4: drop it.
3. **Rate, required:** after the searches and before you place anything, call `rate_directions` once with a rating for every idea from every bend (8, or 16 after a second bend): `drop` with `reasons` (`no_ui_path`, `no_usable_refs`, `off_brief`, `duplicate_idea`, `too_literal`) and `keep` with `strong_salvage` or `great_refs` for the ones you show. A declined challenger is a `drop` with `off_brief`. Do this every run, even when searches went badly or you keep only one idea. Keeps are recorded too, so later bends learn what works. Dropped directions leave the canvas.

### 9. Search both zones for the shortlist

For each shortlisted direction call `search_references` once with `directionId`, `canvasId` and `count: 12`. The default `zone` for a direction is `both`: about a third art, the rest UI, in one search. That is the whole search budget: one search per shortlisted direction (at most 8), plus lane retries from step 10.3 (at most 2 per lane). Do not search again for any other reason.

- **UI lanes** (`zone: "ui"`): `fidelity` (real screens for the page), `taste` (the style words on the page), `hero`, `component`, `bridge` (the idea already applied to UI, so each direction gets UI of its own idea; it runs right after fidelity, and the reply says when it found nothing), `locale` (Arabic UI, also when only the board brief says Arabic or RTL). The server words them for the platform and picks sources to match: website briefs pull from website galleries (hero sections, landing pages, bento layouts), mobile briefs from mobile app and motion galleries, web apps from dashboard galleries, plus Pinterest, Dribbble, Behance and Awwwards.
- **Art lane** (`lane: "art"`, `zone: "art"`): the direction's `artQueries` on Pinterest and Behance: the raw ingredient as images (the weave, the receipt, the riso print). The art row may also draw on poster and type galleries. The server drops shops and listings, but check anyway.
- The server keeps at most 2 results per studio, prefers newer work, and drops UI kits and templates.

Each result line shows `[referenceId, lane]` and its zone. Do not pass a direction's query as `query` when you have its id. Use `zone: "ui"` or `zone: "art"` only to search one zone again. Leave `sources` at the default (the server picks UI galleries by platform) unless the user asks for a specific source.

### 10. Audit and rate every search, both zones

The server does not look at images. You do.

**Look at the returned thumbnails before rating or noting.** `search_references` and `add_to_canvas` results carry a small thumbnail after the line that names each reference: name the colors and layout you see, and base every rating and `steal:` note on the image, not the title.

1. **Judge every result** from its title, site and URL, and the image when you can see it.
2. **Call `rate_references`** with the `canvasId`, once per search. Rate only two kinds of result: the junk (`bad`) and the 1 to 3 standouts (`great`). Leave ordinary good results unrated; there is no "ok" verdict, so never mark every usable result `great`. Always rate the junk so it leaves the tray:
   - **UI zone, `bad`:** wrong platform (a web dashboard on a phone brief), shops, stock, UI kit sales, cluttered sheets, duplicates, near empty mockups, apps for another product, anything not UI.
   - **Art zone, `bad`:** shops and product listings, prices, fashion and clothing listings, Etsy or Amazon pages, logo sheets, stock, and anything off the idea (a car air freshener on a weaving direction). Art does not have to be UI; it has to be the idea.
   - Reasons: `off_topic`, `stock_or_shop`, `not_ui` (UI zone only), `cluttered`, `duplicate`, `low_craft`, `wrong_style`.
   - **`great`** for standouts only, 1 to 3 per search: `great_craft`, `on_style`, `on_brief`.
3. **Retry a weak lane, only then.** If more than 40% of one lane's results are bad, you must search that lane again: `search_references` with `directionId`, `canvasId`, `lane` and a new `query`. UI lanes: keep the idea's main word and name the screen or component ("film frame seat picker ui", not "oversized film frames"). A `bridge` retry filters titles by its own main word, so short words work ("islamic pattern app", "rawashin pattern app"). Art lane: `lane: "art"` with words for the raw thing, no UI words ("sadu weaving close up", "risograph two ink print"). Rate the retry's results too. At most 2 retries per lane; each counts toward the quota. If the lane is still bad after 2 retries, stop and say so in one line. When no lane is over 40% bad, do not retry anything: clean results need no second search.
4. **Count** usable UI references per direction for test (b), and usable art references separately.

### 11. Shipped vs next (only when step 0 found Mobbin)

Use the screens from step 6b. For each kept direction, pick 1 or 2 Mobbin screens that fit it (2 to 4 when you keep 3 or fewer directions): the real pattern it builds on (its BUILD ON anchors) or a shipped screen that is already wild in its way. Search again (`search_sections` for a component, such as "seat picker" or "bottom sheet") only when step 6b did not already give one. Skip a screen that only shows the baseline the direction escapes. Then, in step 12:

- Place them as images in that direction's UI grid, each as one `add_to_canvas` item `{ "type": "screen", "imageUrl": "<image_url>", "sourceUrl": "<mobbin_url>", "app": "Revolut", "title": "payment sheet", "platform": "ios", "directionId": "<id>", "note": "steal: the pinned total above the pay button" }`. Pass the URLs exactly as the Mobbin tool returned them. They count toward the UI items, so the GoBanana UI references fill the rest. The tile's source chip reads mobbin.com and links to the screen page; if the image link has expired, the tile shows a link card instead.
- Add the baseline to the board as **one** note: `{ "type": "note", "text": "Shipped today: [Airbnb, checkout](mobbin link), [Revolut, payment sheet](mobbin link), ..." }`. Up to 3 of its screens may sit next to it as `screen` items (same call, no `directionId`), when the board has room under its item limit. Place it even if the wild directions end up thin.
- In each kept direction's idea note, add its anchor: `BUILD ON: [Revolut, payment sheet](mobbin link)`. This is what keeps the wild idea usable.
- Mention them in your reply in one line, as the "what works" baseline next to the wild directions.
- Never pass Mobbin links to `search_references`, never place Mobbin screens as `reference` items, never download them.

### 12. Place both zones with steal notes

For each kept direction, call `add_to_canvas` with its `sectionId` (create the section first if it does not exist):

Counts depend on how many directions you keep. With 4 to 8: 1 to 3 art and 4 to 6 UI each. With 1 to 3 (the user asked for fewer): 2 to 4 art and 6 to 8 UI each.

- **Art direction row**, best first, from the art zone only. Each gets a `note` (up to 280 characters) that starts with `steal:` and names what to take for the page, drawn from `spec.steal`: `steal: the misregistered second ink as the price highlight`.
- **UI references grid**, best first, from the UI zone only, including the Mobbin screens from step 11 when Mobbin ran. Each gets a `steal:` note too: `steal: the bottom sheet that holds the fare breakdown`.
- **One idea note** per section: `<TRACK>: <twist>. PATTERN: <spec.pattern>. SIGNATURE: <spec.signature>. LANGUAGE: <the 7 values of its language>. RISK: <its honest risk>.` TRACK is SHIP, STRETCH or WILD; the subtract direction starts `SUBTRACT:` and names what it removes. A direction that took a raise from a declined challenger ends its note with the `RAISE from <challenger title>: ...` line (step 7b.3).
- If Mobbin ran: the direction's Mobbin screens from step 11 (in the UI grid), the "Shipped today" note once per board, and the `BUILD ON:` line in each idea note.

Spread the items evenly across directions. When the board's item limit (Free: 40) cannot hold it all, place fewer per direction, at least 3 UI and 1 art each, and say so in one line. Never place a result you rated `bad`. Notes are short and plain; links in notes are clickable on the board. Then call `arrange_canvas` once with `by_direction`: the art row stays above the UI grid in each section. Do not read the board back between these calls.

If the user asked for raw inspiration (textures, objects, posters, "less UI"), give the art row its top count and keep the UI grid UI only.

### 13. Show the board and present the kept directions

Call `open_canvas` with the `canvasId`. If the client shows it inline, say it is open above. **Always** give the web link too: "Open the board here: <webUrl>".

Keep the reply short and in this order: the board link, one line with mode, platform, page and wildness, the Worth questioning list (step 1b, up to 5 one-line items), the direction cards, the one-liners below, then next steps and the closing question (step 14). No prose paragraphs.

Present each kept direction as a compact card, five lines (six with a raise), with equal weight and the same anatomy on every card, Ship first, then Stretch, then Wild. A winning or competitive challenger is a card like any other; mark it "(Stretch, challenger)". Lines, in order:

- **Title** and track.
- **Mechanic:** the working part of the page and how the idea becomes it.
- **Feel:** its `language` in one short line, in plain words: type voice, color strategy, ground, density with composition, material, motion. Never name a shadcn style (Vega, Nova, Maia, Lyra, Mira) or any other preset name.
- **Risk:** one honest line on how it could fail with real users.
- **RAISE from <challenger title>:** only on the card that took a raise (step 7b.3).
- **Refs:** 2 UI references and 1 art reference, each written exactly as `[title](sourceUrl) (site)`.

> **1. Frosted vinyl sleeve** (Stretch)
> Mechanic: total = the sleeve frames the total; the amount stays plain and large.
> Feel: condensed type, restrained color, light ground, airy cards, glass, glide.
> Risk: the frosted layer can wash out the total on low brightness screens.
> Refs: [Glass payment sheet](sourceUrl) (dribbble.com), [Fare breakdown card](sourceUrl) (dribbble.com); art: [Frosted record sleeve](sourceUrl) (pinterest.com)

The subtract card says what it removes in its Mechanic line. The full spec is on the board and in the hand-off files; do not repeat every field here.

If the user asked for raw inspiration, add one line: "The raw stuff (textures, objects, posters) lives in each direction's Art direction row; the UI references stay in their own grid."

Then:

- **One line** on declined challengers, if any, each with what it lent: "Declined challengers: Kitchen ticket rail (raised into 3: one strip per agent), Airport gate sign (raised into 5: one status word per row)."
- **One line** on other dropped ideas, counts and reasons only: "Dropped 2 of 8 ideas: 1 had no clear screen idea, 1 shared a language with another." Never name these or list them one by one, not even in brackets.
- **One line** on removed results, and any lane you retried: "Removed 6 results (2 shop listings, 1 web dashboard, 3 off idea); retried the bridge lane once as 'film strip seat picker ui'."
- **One line** on shipped screens, if Mobbin ran: "Shipped today: [Airbnb, checkout](link), [Revolut, payment](link)."

### 14. Offer next steps, then ask

One short line of other next steps: hand off (gobanana-handoff), Frankenstein it (gobanana-frankenstein: stitch new pages from parts of the UI references, each part linked to its source), palette with WCAG checks (gobanana-palette), or turn it up or down (wildness, a lens, other taste words, another page).

In Explore (and in Finished, which runs Explore for now), the last line of the reply is always the question **"Draft any of these?"**, with the card numbers to pick from. Write no files and no code until the user answers. In Drafts mode, ask the same question, then draft only the picks.

## When things go wrong

- **Quota or plan message:** show it as is, with the link, once. Do not retry or loop. `bend_brief` is still free; offer to keep refining the directions and their specs.
- **Canvas limit:** see step 6.4. Never delete without an explicit yes.
- **An art lane comes back empty or all junk after 2 retries:** place no art for that direction and say so in one line. The direction can still pass on UI.
- **Tool error or timeout:** retry once at most, then tell the user in one line and continue with what you have.
- **GoBanana tools missing:** the GoBanana MCP server is not connected. Tell the user to enable the GoBanana connector (or run `/mcp` in Claude Code and log in).
