---
name: gobanana-explore
description: Bend one page or screen into wild, usable directions, each with a full visual spec, then pull two zones of linked references into a GoBanana moodboard canvas - art direction (the wild idea as images) and platform-correct UI references - with a "steal:" note on each. For one crazy idea over a page or two (launch page, onboarding, empty state, 404, paywall, year in review), not a whole product redesign. Use when the user says "go wild", "push this design", "crazy ideas for", "make it weird", "make it cool", "make it bananas", "something nobody has done", "unexpected directions", "get me out of the box", "fresh take on", "inspire me", "where can we be weird", "this looks like every other app", or asks for bold visual concepts, art directions or references for a screen, page or launch. Runs get_canvas, new_canvas, bend_brief, search_references, rate_references, rate_directions, add_to_canvas, arrange_canvas and open_canvas from the GoBanana MCP server, plus the user's Mobbin connector when it is connected. Use gobanana-moodboard to arrange a board, gobanana-frankenstein to stitch parts of the references into new pages, gobanana-handoff to hand a kept direction to a coding tool.
---

# GoBanana explore

Turn a fuzzy "make it cooler" into a few sharp, buildable directions for one page or two, then fill a board with two zones of references: the wild idea as images (art direction) and real UI for the platform. Mobbin shows what works. GoBanana shows what's next.

GoBanana is for one crazy idea over a page or two: a launch page, onboarding, an empty state, a 404, a paywall, a year in review. It is not the product's main design direction. Say so when the user asks to redesign the whole product, and help them pick where the weirdness should go.

The GoBanana server does no thinking. It bends the brief with word lists and templates and runs web image searches. You do the thinking: shape the brief, pin the platform and pages, reject weak ideas, judge every result, write the notes.

## Ground rules

- **Source links, always.** Every reference you mention gets its source link, like `[Title](sourceUrl) (dribbble.com)`. No link, no mention.
- **Never download, save or copy reference images.** Not into the repo, not into a temp folder, not as base64. Link to them. This holds for Mobbin screens too.
- **Do not describe images you have not seen.** Talk about the direction and the titles, not pixels you cannot see.
- **Plain words.** Short sentences. No em dashes.
- **Usable beats wild.** Reject any idea that cannot become UI for the named page. Never show a dropped idea.
- **Two zones, never mixed.** Each direction has art direction references (zone `art`: the idea as raw images, for mood, texture, color and form) and UI references (zone `ui`: screens and components for the platform). Art items go in the "Art direction" row of the section; UI items go in the "UI references" grid. Never put an art item in the UI grid, never count art toward the UI total, never present art as a screen to build.
- **Right platform.** Never show web dashboards or landing pages on a phone brief, and never phone screens on a website or web app brief. Rate them `bad` with `off_topic`.
- **One question at most per turn.** When you must ask, fold everything you need (subject, platform, where the weirdness goes) into one short question. Never a list of questions.
- **Trust write results.** `add_to_canvas`, `rate_directions`, `rate_references` and `arrange_canvas` answers are the record. Do not call `get_canvas` after each write to check it. Read the board at most once, at the end, and only if you need something from it.

## Steps

### 0. Check for Mobbin first

Before anything else, look for the user's own Mobbin connector: tools named like `mcp__*Mobbin*__search_screens`, `search_flows` or `search_sections`. Note the answer; steps 6b, 8 and 11 use it. When it is connected, the run uses both: Mobbin for what real shipped apps do on this page (the baseline and the usable patterns), GoBanana for the wild directions and references that go past it. If none exist, skip every Mobbin step silently: do not mention Mobbin.

### 1. Shape the brief

Write a one-line brief (max 500 characters). A good brief names:

- **Subject:** the page or screen ("flight checkout screen", "launch page for a coffee roaster").
- **Audience or context**, if known.
- **The default to escape**, if they named one ("looks like every fintech app").
- **Must keep**, if any (brand color, Arabic and English).

If the ask is too vague to name a subject ("make it cool"), ask ONE short question that folds in the platform and states the wildness default, then stop and wait:

> What should I make cool, and is it for a phone app, a website or a web app? I'll go at 3 of 5 unless you say otherwise.

Do not ask about wildness, taste or anything else separately. Ask once. If the user said "just go", do not ask; guess and say what you assumed.

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

- **Lens** (`lens`): a culture preset when the user mentions Saudi, Gulf, Arabic or regional heritage. Ids: `sadu`, `najdi`, `kufic`, `mashrabiya`, `desert-modern`. Never ask for or use sacred text or religious verses.
- **Moves** (`moves`): only when the user asks for a kind of bend: `transplant`, `material`, `era`, `constraint`, `scale`, `lens`.
- **Taste:** use the style words the user gave, if any. Do not ask for taste; the user can add style words later. Words that search well: minimal, glassmorphism, liquid glass, dark mode, big typography, monochrome, luxury, swiss style, bento grid, editorial, grainy, skeuomorphic. If the user shares images you can see, describe them in those words; never download them. Pass `taste` to `new_canvas` or `bend_brief`. Without taste, each direction uses its own style words (`spec.styleWords`). There is no house style; do not invent one.

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

Use both in the next steps: put the default to escape into the brief you pass to `bend_brief` when it helps ("not the usual summary card and payment sheet"), and keep the screens' Mobbin links for steps 11 and 12.

### 7. Bend the brief, wide

Call `bend_brief` with `brief`, `wildness`, `platform`, `pages`, `count: 8` and the `canvasId`, plus `lens`, `moves` and `taste` if chosen. Each direction comes back with a `spec` (typography, typeVoice, color, layout, imagery, motion, texture, iconography, density, signature, pattern, steal, avoid, styleWords, whyItFits) and `artQueries`. It is free and unlimited.

### 8. Triage the ideas (before you show any)

Keep an idea only if all three hold:

- **(a) UI path.** Its `spec.pattern` and `spec.signature` give the named page a concrete UI move on this platform ("fare cards that stack like boarding passes"). If you cannot say it in a few words, it fails.
- **(b) Usable UI references.** After search and audit it has at least 6 on-topic UI references for the platform. Art references do not count here.
- **(c) Not a near duplicate** of a kept idea.
- **With Mobbin (step 6b):** also drop an idea that lands on the baseline (it only restyles what shipped apps already do), and prefer ideas whose `spec.pattern` keeps the must keeps. Name the Mobbin pattern a kept idea builds on.

1. **First pass, free:** apply (a) and (c) to all 8. Shortlist the number the user asked for, or 3 when they gave no number. Never more than 4. Each shortlisted direction costs one search (step 9). If a shortlisted idea fails (b), you may search one backup idea, still within 4.
2. **Second pass, after searching:** apply (b). Retry the weakest UI lane first (step 10.3). Still under 6: drop it.
3. **Rate, required:** after the searches and before you place anything, call `rate_directions` once with a rating for every one of the 8 ideas: `drop` with `reasons` (`no_ui_path`, `no_usable_refs`, `off_brief`, `duplicate_idea`, `too_literal`) and `keep` with `strong_salvage` or `great_refs` for the ones you show. Do this every run, even when searches went badly or you keep only one idea. Keeps are recorded too, so later bends learn what works. Dropped directions leave the canvas.

### 9. Search both zones for the shortlist

For each shortlisted direction call `search_references` once with `directionId`, `canvasId` and `count: 12`. The default `zone` for a direction is `both`: about a third art, the rest UI, in one search. That is the whole search budget: one search per shortlisted direction (at most 4), plus lane retries from step 10.3 (at most 2 per lane). Do not search again for any other reason.

- **UI lanes** (`zone: "ui"`): `fidelity` (real screens for the page), `taste` (the style words on the page), `hero`, `component`, `bridge` (the idea already applied to UI, so each direction gets UI of its own idea; it runs right after fidelity, and the reply says when it found nothing), `locale` (Arabic UI, also when only the board brief says Arabic or RTL). The server words them for the platform and picks sources to match: website briefs pull from website galleries (hero sections, landing pages, bento layouts), mobile briefs from mobile app and motion galleries, web apps from dashboard galleries, plus Pinterest, Dribbble, Behance and Awwwards.
- **Art lane** (`lane: "art"`, `zone: "art"`): the direction's `artQueries` on Pinterest and Behance: the raw ingredient as images (the weave, the receipt, the riso print). The art row may also draw on poster and type galleries. The server drops shops and listings, but check anyway.
- The server keeps at most 2 results per studio, prefers newer work, and drops UI kits and templates.

Each result line shows `[referenceId, lane]` and its zone. Do not pass a direction's query as `query` when you have its id. Use `zone: "ui"` or `zone: "art"` only to search one zone again. Leave `sources` at the default (the server picks UI galleries by platform) unless the user asks for a specific source.

### 10. Audit and rate every search, both zones

The server does not look at images. You do.

1. **Judge every result** from its title, site and URL, and the image when you can see it.
2. **Call `rate_references`** with the `canvasId`, once per search. Rate only two kinds of result: the junk (`bad`) and the 1 to 3 standouts (`great`). Leave ordinary good results unrated; there is no "ok" verdict, so never mark every usable result `great`. Always rate the junk so it leaves the tray:
   - **UI zone, `bad`:** wrong platform (a web dashboard on a phone brief), shops, stock, UI kit sales, cluttered sheets, duplicates, near empty mockups, apps for another product, anything not UI.
   - **Art zone, `bad`:** shops and product listings, prices, fashion and clothing listings, Etsy or Amazon pages, logo sheets, stock, and anything off the idea (a car air freshener on a weaving direction). Art does not have to be UI; it has to be the idea.
   - Reasons: `off_topic`, `stock_or_shop`, `not_ui` (UI zone only), `cluttered`, `duplicate`, `low_craft`, `wrong_style`.
   - **`great`** for standouts only, 1 to 3 per search: `great_craft`, `on_style`, `on_brief`.
3. **Retry a weak lane, only then.** If more than 40% of one lane's results are bad, you must search that lane again: `search_references` with `directionId`, `canvasId`, `lane` and a new `query`. UI lanes: keep the idea's main word and name the screen or component ("film frame seat picker ui", not "oversized film frames"). A `bridge` retry filters titles by its own main word, so short words work ("islamic pattern app", "rawashin pattern app"). Art lane: `lane: "art"` with words for the raw thing, no UI words ("sadu weaving close up", "risograph two ink print"). Rate the retry's results too. At most 2 retries per lane; each counts toward the quota. If the lane is still bad after 2 retries, stop and say so in one line. When no lane is over 40% bad, do not retry anything: clean results need no second search.
4. **Count** usable UI references per direction for test (b), and usable art references separately.

### 11. Shipped vs next (only when step 0 found Mobbin)

Use the screens from step 6b. For each kept direction, also find 1 or 2 Mobbin screens or sections that show the real pattern it builds on (`search_sections` for a component, such as "seat picker" or "bottom sheet"), when step 6b did not already give one. Then:

- Add the baseline to the board as **one** note, no images, in step 12: one `add_to_canvas` item `{ "type": "note", "text": "Shipped today: [Airbnb, checkout](mobbin link), [Revolut, payment sheet](mobbin link), ..." }`. Place it even if the wild directions end up thin.
- In each kept direction's idea note, add its anchor: `BUILD ON: [Revolut, payment sheet](mobbin link)`. This is what keeps the wild idea usable.
- Mention them in your reply in one line, as the "what works" baseline next to the wild directions.
- Never place Mobbin screens as references, never pass Mobbin links to `search_references` or `add_to_canvas` as references, never download them.

### 12. Place both zones with steal notes

For each kept direction, call `add_to_canvas` with its `sectionId` (create the section first if it does not exist):

- **Art direction row: 2 to 4 art items**, best first, from the art zone only. Each gets a `note` (up to 280 characters) that starts with `steal:` and names what to take for the page, drawn from `spec.steal`: `steal: the misregistered second ink as the price highlight`.
- **UI references grid: 6 to 8 UI items**, best first, from the UI zone only. Each gets a `steal:` note too: `steal: the bottom sheet that holds the fare breakdown`.
- **One idea note** per section: `WILD: <twist>. PATTERN: <spec.pattern>. SIGNATURE: <spec.signature>.`
- The Mobbin note from step 11, once per board, and the `BUILD ON:` line in each idea note, if Mobbin ran.

Never place a result you rated `bad`. Notes are short and plain; links in notes are clickable on the board. Then call `arrange_canvas` once with `by_direction`: the art row stays above the UI grid in each section. Do not read the board back between these calls.

If the user asked for raw inspiration (textures, objects, posters, "less UI"), give the art row its full 4 items and keep the UI grid UI only.

### 13. Show the board and present the kept directions

Call `open_canvas` with the `canvasId`. If the client shows it inline, say it is open above. **Always** give the web link too: "Open the board here: <webUrl>".

Keep the reply short and in this order: the board link, one line with platform, page and wildness, the direction cards, the one-liners below, then next steps (step 14). No prose paragraphs.

Present each kept direction as a compact card, from its `spec`, five short lines at most, and always end it with its highlights: 2 to 3 UI references and 1 or 2 art references, each written exactly as `[title](sourceUrl) (site)`:

> **1. Checkout as a frosted vinyl sleeve** (transplant + material)
> Pattern: fare summary slides out of a sleeve. Signature: a half-moon cutout shows the total.
> Look: condensed grotesk, frosted off-white with one ink blue accent; the sleeve slides 200ms, still with reduced motion.
> Why it fits: travel tickets are objects people keep.
> Art direction: [Frosted record sleeve](sourceUrl) (pinterest.com), [Clear vinyl packaging](sourceUrl) (behance.net)
> UI: [Glass payment sheet](sourceUrl) (dribbble.com), [Fare breakdown card](sourceUrl) (dribbble.com)

The full spec is on the board and in the hand-off files; do not repeat every field here.

If the user asked for raw inspiration, add one line: "The raw stuff (textures, objects, posters) lives in each direction's Art direction row; the UI references stay in their own grid."

Then:

- **One line** on dropped ideas, counts and reasons only: "Dropped 5 of 8 ideas: 3 had no clear screen idea, 1 found too few UI references, 1 repeated another." Never name the dropped ideas or list them one by one, not even in brackets.
- **One line** on removed results, and any lane you retried: "Removed 6 results (2 shop listings, 1 web dashboard, 3 off idea); retried the bridge lane once as 'film strip seat picker ui'."
- **One line** on shipped screens, if Mobbin ran: "Shipped today: [Airbnb, checkout](link), [Revolut, payment](link)."

### 14. Offer next steps

- **Hand off:** turn a kept direction into scoped files for Claude Code, Cursor, Copilot, v0 or Lovable (gobanana-handoff).
- **Build then critique:** build the page, then screenshot and grade it against the direction (gobanana-critique).
- **Palette:** colors from the art direction or UI references, with WCAG checks (gobanana-palette).
- **Frankenstein it:** cut the best parts out of the UI references (a nav from one, a hero from another, cards from a third) and stitch 3 or 4 new page variants on the board, each part linked to its source (gobanana-frankenstein).
- **Turn it up or down:** wildness N+1 or N-1, a lens, other taste words, or another page from the wild spots.

## When things go wrong

- **Quota or plan message:** show it as is, with the link, once. Do not retry or loop. `bend_brief` is still free; offer to keep refining the directions and their specs.
- **Canvas limit:** see step 6.4. Never delete without an explicit yes.
- **An art lane comes back empty or all junk after 2 retries:** place no art for that direction and say so in one line. The direction can still pass on UI.
- **Tool error or timeout:** retry once at most, then tell the user in one line and continue with what you have.
- **GoBanana tools missing:** the GoBanana MCP server is not connected. Tell the user to enable the GoBanana connector (or run `/mcp` in Claude Code and log in).
