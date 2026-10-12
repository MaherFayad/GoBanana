---
name: gobanana-frankenstein
description: Frankenstein it - cut the best parts out of the references on a GoBanana board (a nav here, a hero there, cards from a third) and stack them into new Frankenstein pages, several variants at once, like a designer slicing a swipe file. Each part is a role, a crop rectangle the browser applies, a light or dark tag and a "steal:" note, always with its source link. For ideas, not a finished design or the product's system. Use when the user says "frankenstein it", "frankenstein this", "frankenstein page", "frankenstein", "stitch", "stitch a page", "mix parts", "nav from this, hero from that", "combine these references into a page", "make new layouts from my board", "remix the references", "remix this one", "keep the nav, change the rest", or "wireframe from my references". Runs get_canvas, cut_parts, frankenstein_page, update_frankenstein, remix_frankenstein, open_canvas and export_kit (stitch_md for FRANKENSTEIN.md, wireframe_html for frankenstein-wireframe.html) from the GoBanana MCP server. Use gobanana-explore first when the board has no references, and gobanana-handoff to build one.
---

# GoBanana: Frankenstein it

Frankenstein it: cut parts out of the references on a board and stack them into new pages. The nav comes from one site, the hero from another, the cards from a third. Make a few variants, judge them like a designer, fix the weak seams, and hand over a page skeleton with every source linked.

This is for ideas over one page, not the product's design system. A Frankenstein page is a sketch made of other people's work. In the tools it is called a stitch (`frankenstein_page`, `stitchId`); say "Frankenstein page" to the user: you take the structure and the moves, never the pixels.

## Ground rules

- **Source link for every part you mention**, like `[Fintech pricing page](sourceUrl) (dribbble.com)`. No link, no mention. The board and every export keep the links too.
- **Never download, save, crop or copy reference images.** A part is only a rectangle (fractions of the image) that the browser applies over the hotlinked image. Never fetch an image to disk, never cut it with a tool, never write it into the repo, not even "just to look". If the user asks for the cut images as files, say no in one or two lines, in these terms: "A part is only a crop rectangle the browser shows over the original image at its source; nothing is downloaded or cut, so there are no PNGs to save, and the images belong to their owners." Then offer FRANKENSTEIN.md, the wireframe, the board link, or building the sections with the project's own content.
- **Trust write results.** The `cut_parts`, `frankenstein_page`, `update_frankenstein` and `remix_frankenstein` answers are the record: read the parts and pages from them. Do not call `get_canvas` after each write to check it; read the board once at the start, and again only if you truly need something the answers did not give.
- **Do not describe pixels you did not see.** Say what you saw, what the user told you, or what the title says, and say which.
- **Right platform.** Mobile pages take mobile parts, websites take website parts, web apps take web app parts. Skip references for another platform.
- **UI zone only.** Cut from UI references (placed board items or tray references in zone `ui`). Art direction images are mood, not page parts. Never cut a reference rated `bad`.
- **Mobbin screens are parts too, as accents.** Mobbin screens on the board (source chip mobbin.com, placed from the user's Mobbin connector) are UI items: cut them by `itemId` like any other. Use one when it is wild or fits the direction, for example a real pay bar or tab bar under a wild hero, so the page keeps a pattern users know. Never build the whole page from Mobbin parts, and give each one its `[App, screen](mobbin link) (mobbin.com)` link like any part. Their crops are guessed as one screen, not a phone presentation.
- Plain words, short sentences, no em dashes.

## Steps

### 1. Pick the canvas, the platform and the page

**Canvas.** Use the `canvasId` from this conversation. Otherwise call `get_canvas` with no `canvasId` to list recent boards and use the one the user means; ask only if two could fit. Then call `get_canvas` with the id. It returns sections, placed items (with `itemId`, source link and zone), tray references, the parts library by role, and any Frankenstein pages (stitches) with their skeletons. Reuse parts that are already there; do not cut the same thing twice.

If the board has fewer than about 6 usable UI references, say so and offer the gobanana-explore flow first. Do not create a new canvas to Frankenstein.

**Platform.** `mobile`, `tablet`, `website` or `webapp`, from the user's words or the board's platform. If it is still unclear, ask one question. With "just go", take the board's platform and say so.

**Page.** One page type per run: "landing page", "pricing", "dashboard home", "onboarding screen". Default for a website is the landing page, for a web app the dashboard home, for mobile the home screen.

### 2. Look at the references

You need to know where things sit on each image to cut it well.

- **If you can see the images** (the user attached screenshots, or your client shows you the image from its URL without saving it), look at each one.
- **If the user described them** ("nav is the top strip, the pricing cards sit in the middle"), use their words.
- **If you cannot see them** (the usual case: most clients do not show the agent an image from its URL), say it once, plainly: "I can't see the images here, so I'm cutting by role and the server guesses each band (nav at the top, the pay button low and narrow, footer at the bottom; a phone presentation shot is cut from its middle phone). The crops are marked as guesses; adjust any of them in the canvas crop editor (Edit crop on a part), or tell me where things sit." Then cut with role only (no `crop`), set `theme` to `unknown`, and start each note with `guessed:` and what the title suggests. Keep the guessed crops: do not download or fetch the images to check them, and never pretend you saw them.

### 3. Pick the strongest parts and cut them

Work like a designer with a swipe file. For each reference, find the one or two parts worth stealing. For each part decide:

- **role**: one of `nav`, `hero`, `logos`, `features`, `cards`, `gallery`, `stats`, `testimonial`, `pricing`, `cta`, `form`, `faq`, `content`, `footer` (web); `sidebar`, `toolbar`, `table`, `chart`, `filters` (web app); `status-header`, `tabbar`, `list`, `detail`, `sheet`, `empty` (mobile); `other`.
- **crop**: a tight rectangle as fractions of the image, `{ "x": 0, "y": 0.04, "w": 1, "h": 0.18 }` (x and y from the top left, all 0 to 1). Tight means the part and its own padding, not half of the next section. Full page shots are tall, so bands are thin: a nav is often under 4% of the height.
- **theme**: `light` or `dark`, as you saw it; `unknown` if you did not.
- **note**: one line, up to 280 characters, starting with `steal:` and naming the move, not the look: `steal: the split nav with the search pill in the middle`, `steal: pricing cards where the middle plan breaks the grid`.

Aim for **2 to 4 candidates per role** in the recipe (step 4), drawn from **at least 4 different sources** (sites or studios), so the variants can really differ. Skip a role rather than cut a weak part for it.

Call `cut_parts` with `canvasId` and `cuts` (1 to 24 per call): `{ "itemId": "it_201", "role": "nav", "crop": {...}, "theme": "dark", "note": "steal: ..." }`. Use `itemId` for a placed board item, `referenceId` for a tray reference. The library holds 80 parts; if it is near full, reuse parts instead of cutting more. Parts the server cropped by guess come back with `guessedCrop`; keep that flag in mind when you present them.

### 4. Write the recipe and stitch the pages

A recipe is the list of roles, top to bottom. Start from the page type and drop roles you have no good parts for:

| Platform and page | Recipe |
| --- | --- |
| website, landing | `nav, hero, logos, features, cards, testimonial, cta, footer` |
| website, pricing | `nav, hero, pricing, faq, cta, footer` |
| webapp, dashboard | `sidebar` beside a `toolbar` row, then `stats, chart, table` |
| mobile, home | `status-header, hero` (or `detail`), `list, cards, tabbar` |
| tablet | the mobile recipe for app screens, the website recipe for sites |

**From the library:** call `frankenstein_page` with `canvasId`, `platform`, a short `title`, `mode: "collage"`, the `recipe` and `variants: 3` or `4`. The server fills each role from the library, so each variant mixes at least 3 sources when it can, and places the frames side by side in a section on the board. A web app sidebar sits in the same row as the content; if the server's recipe cannot express that, pass explicit `rows` instead (next point).

**The user dictated parts** ("nav from the dev tool page, hero from the coffee site"): cut those parts first, then call `frankenstein_page` with explicit `rows` and no recipe: one row per band, each `{ "slots": [{ "partId": "pt-...", "note": "steal: ..." }], "widths": [1, 3] }`. A row holds 1 slot (full width) or 2 to 3 side by side (sidebar and content, a card row). If a part they named is not on the board, say so and offer to search for it.

Pass `directionId` when the page serves one kept direction on the board, and a one line `note` with the idea.

### 5. Review each variant like a designer

Read each variant from the `frankenstein_page` answer: its rows, slots, parts and sources. Then judge it:

- **Rhythm:** dense and airy bands alternate; no three busy bands in a row.
- **Hierarchy:** one clear hero; no second hero fighting it from a `features` band.
- **Contrast jumps:** light next to dark is fine for ideas. A thin dark sliver between two light bands usually reads as a bug; swap it or try mode `even`.
- **Seams:** neighbours agree on margins and density; a full bleed band next to a boxed one needs a reason.
- **Sources:** no two neighbouring bands from the same site; at least 3 sources per variant.
- **One page:** it reads as one product, and you can say its idea in one line.

Fix what fails with `update_frankenstein` (`canvasId`, `stitchId`, `ops`), for example:

- `{ "op": "swap", "slotId": "sl-...", "partId": "pt-..." }` to try another part in a slot (the slot's note goes with the old part and the new part's note shows; a note the user wrote in the canvas stays; set a new one with `note`)
- `{ "op": "crop", "slotId": "sl-...", "crop": {...} }` to tighten a slot without a new part (only when you saw the image)
- `{ "op": "widths", "rowId": "rw-...", "widths": [1, 4] }`, `{ "op": "moveRow", "rowId": "rw-...", "index": 2 }`, `{ "op": "remove", "slotId": "sl-..." }`
- `{ "op": "note", "note": "Editorial nav over a dashboard hero" }` for the variant's one line idea, and `{ "op": "note", "slotId": "sl-...", "note": "steal: ..." }` for a slot

When one variant has rows you love, call `remix_frankenstein` with `stitchId`, `count` 2 to 4, `lock` set to those slot ids or roles (`["nav", "hero"]`), and `vary` for the roles to swap. It is seeded, so the same call gives the same result. A slot that gets a new part drops the note written for the old one, so read the new labels from the reply.

To judge structure, offer mode `even` (dark parts inverted so the page reads as one theme) or `wireframe` (grey with role labels): `{ "op": "mode", "mode": "wireframe" }`. Keep `collage` as the default view.

Stop after two rounds of fixes. Ideas, not polish.

### 6. Show the board and present

Call `open_canvas` with the `canvasId`. Always give the web link: "Open the board here: <webUrl>".

Per variant, a numbered skeleton, one line per slot: role, what it steals, the source link. Mark guessed crops. Write every slot of every variant in full, each with its own link; never collapse slots into "same as variant 1" or "slots 5 to 8 as above".

> **Variant 2: Editorial nav over a dashboard hero** (st-2)
> 1. Nav: the split nav with the search pill. [Dev tool landing page](sourceUrl) (lapa.ninja)
> 2. Hero: the terminal mock inside the headline. [AI startup hero](sourceUrl) (landing.love)
> 3. Cards: the middle plan that breaks the grid. [Fintech pricing page](sourceUrl) (dribbble.com)
> 4. Footer: the giant wordmark. [Agency footer](sourceUrl) (lapa.ninja) (guessed crop)
> Idea: an editorial shell around a product that shows its work.

Then one line on what you fixed ("Swapped the logos strip in variant 3, it repeated the hero's site"), and nothing about pixels you did not see. Every part or reference you name anywhere in the reply, in that line, in crop caveats and in next steps too, gets its markdown source link; simplest is to refer to slots by number ("slot 2 of variant 1") instead of naming the part or reference again. Do not list the parts library in prose.

If you could not see the images, say so in the first lines of the reply: the crops were guessed by role, each guessed slot is marked "(guessed crop)", and the user can check them on the board or tell you where things sit.

**After a remix:** say which slots were kept (for example "Kept the nav and hero from Landing 2"), then one skeleton per new take with its slots, the locked ones marked "(kept)", and one line on what changed versus the original. Every part keeps its link.

### 7. Offer next steps

- **Export:** `export_kit` with `formats: ["stitch_md"]` (Free) writes FRANKENSTEIN.md: a page skeleton per Frankenstein page with roles, source links and notes, plus build guidance (take the structure, not the pixels; unify to one theme). `wireframe_html` (Pro) writes frankenstein-wireframe.html, a standalone grey box wireframe with role labels and no reference images. Write each file at its returned `path`; never add reference images to the repo.
- **Hand off:** turn a Frankenstein page into a build prompt for Claude Code, Cursor, v0 or Lovable (gobanana-handoff; BUILD-PROMPT.md lists the Frankenstein pages).
- **Critique after building:** screenshot the built page and grade it (gobanana-critique).
- **More variants:** remix one with a lock, or a different page type from the same parts.

## When things go wrong

- **Quota or plan message** (for example `wireframe_html` on Free): show it as is, with its link, once. Do not retry or loop. Offer what still works: FRANKENSTEIN.md and the board link.
- **Parts library full** (80 parts) or the plan's item cap: relay the message, reuse existing parts, and stop cutting.
- **Too few references for a role:** leave the role out of the recipe and say so in one line, or offer gobanana-explore to find more.
- **Tool error or timeout:** retry once at most, then tell the user in one line and continue with what you have.
- **GoBanana tools missing:** ask the user to enable the GoBanana connector (or run `/mcp` in Claude Code and log in).
