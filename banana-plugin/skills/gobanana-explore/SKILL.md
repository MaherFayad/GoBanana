---
name: gobanana-explore
description: Bend one page or screen into wild, usable directions, each with a full visual spec, then pull two zones of linked references into a GoBanana moodboard canvas - art direction (the wild idea as images) and platform-correct UI references - with a "steal:" note on each. For one crazy idea over a page or two (launch page, onboarding, empty state, 404, paywall, year in review), not a whole product redesign. Use when the user says "go wild", "push this design", "crazy ideas for", "make it weird", "make it cool", "make it bananas", "something nobody has done", "unexpected directions", "get me out of the box", "fresh take on", "inspire me", "where can we be weird", "this looks like every other app", or asks for bold visual concepts, art directions or references for a screen, page or launch. Runs get_canvas, new_canvas, bend_brief, search_references, rate_references, rate_directions, add_to_canvas, arrange_canvas and open_canvas from the GoBanana MCP server, plus the user's Mobbin connector when it is connected. Use gobanana-moodboard to arrange a board, gobanana-handoff to hand a kept direction to a coding tool.
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

## Steps

### 1. Shape the brief

Write a one-line brief (max 500 characters). A good brief names:

- **Subject:** the page or screen ("flight checkout screen", "launch page for a coffee roaster").
- **Audience or context**, if known.
- **The default to escape**, if they named one ("looks like every fintech app").
- **Must keep**, if any (brand color, Arabic and English).

If the ask is too vague to name a subject ("make it cool"), ask one short question that also covers wildness: "What are we designing, and how far should I push it: 1 (fresh) to 5 (bananas)?" Ask once. If the user said "just go", do not ask; guess and say what you assumed.

### 2. Pin the platform

One of `mobile`, `tablet`, `website`, `webapp` (or `any` when it truly does not matter).

| Words in the ask | Platform |
| --- | --- |
| iPhone, iOS, Android, app screen, mobile app, onboarding in the app, paywall | `mobile` |
| iPad, tablet | `tablet` |
| landing page, launch page, marketing site, homepage, campaign page, 404 on the site | `website` |
| dashboard, admin, SaaS, web app, settings in the browser, table, CRM | `webapp` |

If the words are clear, pin it and say it in your reply ("Platform: mobile"). If not, add it to your one question ("Is this for the phone app, the website or the web app?"). With "just go", guess and say so. Always pass `platform` to `bend_brief`; the server would detect it from the brief, but your read is better.

### 3. Pin the pages: where should the weirdness go?

Pass 1 to 3 `pages` to `bend_brief` (each up to 60 characters): the page or screen the idea is for ("checkout", "first run onboarding", "/launch").

- **The user named a page or screen:** use it.
- **The user named the whole product** ("go wild on our banking app", "make our site weird"): do not bend the whole product. Call `bend_brief` once with the brief, `platform` and no `pages` and no `canvasId` (free, nothing is saved). Its `wildSpots` lists places where weirdness pays off for that platform, each with a reason. Ask one question: "Where should the weirdness go?" and show 4 to 6 spots as a numbered list, one line each: the page and the why. The user picks 1 to 3. If they said "just go", take the top spot and say so. Then go on with those `pages`.

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
- **Taste:** ask once, unless the user said "just go": "Any 2 to 5 style words for the look you like, or a board I can look at?" Words that search well: minimal, glassmorphism, liquid glass, dark mode, big typography, monochrome, luxury, swiss style, bento grid, editorial, grainy, skeuomorphic. If the user shares images you can see, describe them in those words; never download them. Pass `taste` to `new_canvas` or `bend_brief`. Without taste, each direction uses its own style words (`spec.styleWords`). There is no house style; do not invent one.

### 6. Pick the canvas: extend one, or create one (do not show it yet)

1. **A canvas already in this conversation:** use its `canvasId`.
2. **Otherwise call `get_canvas` with no `canvasId`.** It lists recent canvases with their briefs. If one is the same product or project, use it: new directions get new sections, nothing is removed. Read it with its id so you do not repeat directions or references. Say in one line which board you are adding to.
3. **Only when nothing matches, or the user asks for a new board,** call `new_canvas` with a short `title`, the `brief` and `taste` if you have it.
4. **Canvas limit** (free plans have 3): relay the message once, then offer two ways out: add to an existing board, or delete an old one. To delete: list the boards with `get_canvas` (no id), ask which one, then confirm by name: "Delete 'Frosted checkout' for good? Its sections, references, tray and share link go too. This cannot be undone." Call `delete_canvas` with that `canvasId` and `confirm: true` only after the user's explicit yes. No yes, no delete. Never pick a board to delete yourself.

Do not call `open_canvas` yet. The user sees the board once, finished, in step 13.

### 7. Bend the brief, wide

Call `bend_brief` with `brief`, `wildness`, `platform`, `pages`, `count: 8` and the `canvasId`, plus `lens`, `moves` and `taste` if chosen. Each direction comes back with a `spec` (typography, typeVoice, color, layout, imagery, motion, texture, iconography, density, signature, pattern, steal, avoid, styleWords, whyItFits) and `artQueries`. It is free and unlimited.

### 8. Triage the ideas (before you show any)

Keep an idea only if all three hold:

- **(a) UI path.** Its `spec.pattern` and `spec.signature` give the named page a concrete UI move on this platform ("fare cards that stack like boarding passes"). If you cannot say it in a few words, it fails.
- **(b) Usable UI references.** After search and audit it has at least 6 on-topic UI references for the platform. Art references do not count here.
- **(c) Not a near duplicate** of a kept idea.

1. **First pass, free:** apply (a) and (c) to all 8. Shortlist the best 3 (up to 4, or the number the user asked for). Each costs one search.
2. **Second pass, after searching:** apply (b). Retry the weakest UI lane first (step 10.3). Still under 6: drop it.
3. **Rate:** call `rate_directions` once with every idea: `drop` with `reasons` (`no_ui_path`, `no_usable_refs`, `off_brief`, `duplicate_idea`, `too_literal`) and `keep` with `strong_salvage` or `great_refs` for the ones you show. Keeps are recorded too, so later bends learn what works. Dropped directions leave the canvas.

### 9. Search both zones for the shortlist

For each shortlisted direction call `search_references` with `directionId`, `canvasId` and `count: 12`. The default `zone` for a direction is `both`: about a third art, the rest UI, in one search.

- **UI lanes** (`zone: "ui"`): `fidelity` (real screens for the page), `taste` (the style words on the page), `hero`, `component`, `bridge` (the idea already applied to UI; often empty), `locale` (Arabic UI). The server words them for the platform and picks sources to match: website briefs pull from website galleries (hero sections, landing pages, bento layouts), mobile briefs from mobile app and motion galleries, web apps from dashboard galleries, plus Pinterest, Dribbble, Behance and Awwwards.
- **Art lane** (`lane: "art"`, `zone: "art"`): the direction's `artQueries` on Pinterest and Behance: the raw ingredient as images (the weave, the receipt, the riso print). The art row may also draw on poster and type galleries. The server drops shops and listings, but check anyway.
- The server keeps at most 2 results per studio, prefers newer work, and drops UI kits and templates.

Each result line shows `[referenceId, lane]` and its zone. Do not pass a direction's query as `query` when you have its id. Use `zone: "ui"` or `zone: "art"` only to search one zone again. Leave `sources` at the default (the server picks UI galleries by platform) unless the user asks for a specific source.

### 10. Audit and rate every search, both zones

The server does not look at images. You do.

1. **Judge every result** from its title, site and URL, and the image when you can see it.
2. **Call `rate_references`** with the `canvasId` and one rating per judged result. Always rate the junk so it leaves the tray:
   - **UI zone, `bad`:** wrong platform (a web dashboard on a phone brief), shops, stock, UI kit sales, cluttered sheets, duplicates, near empty mockups, apps for another product, anything not UI.
   - **Art zone, `bad`:** shops and product listings, prices, fashion and clothing listings, Etsy or Amazon pages, logo sheets, stock, and anything off the idea (a car air freshener on a weaving direction). Art does not have to be UI; it has to be the idea.
   - Reasons: `off_topic`, `stock_or_shop`, `not_ui` (UI zone only), `cluttered`, `duplicate`, `low_craft`, `wrong_style`.
   - **`great`** for standouts only, about the top 10 to 20%: `great_craft`, `on_style`, `on_brief`.
3. **Retry a weak lane.** If more than 40% of one lane is bad, search that lane again: `search_references` with `directionId`, `canvasId`, `lane` and a new `query`. UI lanes: name the screen or component ("cinema seat picker ui"). Art lane: `lane: "art"` with words for the raw thing, no UI words ("sadu weaving close up", "risograph two ink print"). At most 2 retries per lane; each counts toward the quota.
4. **Count** usable UI references per direction for test (b), and usable art references separately.

### 11. Shipped vs next (only when Mobbin is connected)

Look for the user's own Mobbin connector: tools named like `mcp__*Mobbin*__search_screens`, `search_flows` or `search_sections`. If none exist, skip this step silently: do not mention Mobbin.

If connected, search once per page (not per direction) for the same page on the same platform, for example "checkout" on iOS. Use the tool's own inputs. Pick 3 to 6 real shipped screens. Then:

- Add them to the board as **one** note, no images: `Shipped today: [Airbnb, checkout](mobbin link), [Revolut, payment sheet](mobbin link), ...`.
- Mention them in your reply in one line, as the "what works" baseline next to the wild directions.
- Never place Mobbin screens as references, never pass Mobbin links to `search_references` or `add_to_canvas` as references, never download them.

### 12. Place both zones with steal notes

For each kept direction, call `add_to_canvas` with its `sectionId` (create the section first if it does not exist):

- **Art direction row: 2 to 4 art items**, best first, from the art zone only. Each gets a `note` (up to 280 characters) that starts with `steal:` and names what to take for the page, drawn from `spec.steal`: `steal: the misregistered second ink as the price highlight`.
- **UI references grid: 6 to 8 UI items**, best first, from the UI zone only. Each gets a `steal:` note too: `steal: the bottom sheet that holds the fare breakdown`.
- **One idea note** per section: `WILD: <twist>. PATTERN: <spec.pattern>. SIGNATURE: <spec.signature>.`
- The Mobbin note from step 11, once per board, if any.

Never place a result you rated `bad`. Notes are short and plain; links in notes are clickable on the board. Then call `arrange_canvas` once with `by_direction`: the art row stays above the UI grid in each section.

### 13. Show the board and present the kept directions

Call `open_canvas` with the `canvasId`. If the client shows it inline, say it is open above. **Always** give the web link too: "Open the board here: <webUrl>".

Present each kept direction as a compact spec card, from its `spec`. One short line per field:

> **1. Checkout as a frosted vinyl sleeve** (transplant + material)
> Platform: mobile. Page: checkout.
> Pattern: fare summary slides out of a sleeve.
> Signature: the sleeve card with a half-moon cutout for the total.
> Type: condensed grotesk, big tabular numerals.
> Color: frosted off-white, one ink blue accent, 1 in 10.
> Layout: one column, 16px margins, sticky pay button in thumb reach.
> Motion: the sleeve slides 200ms on confirm; nothing moves with reduced motion.
> Why it fits: travel tickets are objects people keep.
> Art direction: [Frosted record sleeve](sourceUrl) (pinterest.com), [Clear vinyl packaging](sourceUrl) (behance.net)
> UI: [Glass payment sheet](sourceUrl) (dribbble.com), [Fare breakdown card](sourceUrl) (dribbble.com)

Then:

- **One line** on dropped ideas: "Dropped 5 of 8 ideas: 3 had no clear screen idea, 1 found too few UI references, 1 repeated another." Never list them one by one.
- **One line** on removed results: "Removed 6 results (2 shop listings, 1 web dashboard, 3 off idea)."
- **One line** on shipped screens, if Mobbin ran: "Shipped today: [Airbnb, checkout](link), [Revolut, payment](link)."

### 14. Offer next steps

- **Hand off:** turn a kept direction into scoped files for Claude Code, Cursor, Copilot, v0 or Lovable (gobanana-handoff).
- **Build then critique:** build the page, then screenshot and grade it against the direction (gobanana-critique).
- **Palette:** colors from the art direction or UI references, with WCAG checks (gobanana-palette).
- **Turn it up or down:** wildness N+1 or N-1, a lens, other taste words, or another page from the wild spots.

## When things go wrong

- **Quota or plan message:** show it as is, with the link, once. Do not retry or loop. `bend_brief` is still free; offer to keep refining the directions and their specs.
- **Canvas limit:** see step 6.4. Never delete without an explicit yes.
- **An art lane comes back empty or all junk after 2 retries:** place no art for that direction and say so in one line. The direction can still pass on UI.
- **Tool error or timeout:** retry once at most, then tell the user in one line and continue with what you have.
- **GoBanana tools missing:** the GoBanana MCP server is not connected. Tell the user to enable the GoBanana connector (or run `/mcp` in Claude Code and log in).
