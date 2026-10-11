---
name: banana-explore
description: Turn a vague design ask into wild, unexpected directions and pull linked visual references for them into a Banana moodboard canvas. Use when the user says "go wild", "push this design", "crazy ideas for", "make it weird", "make it cool", "make it bananas", "something nobody has done", "unexpected directions", "get me out of the box", "fresh take on", "inspire me", "this looks like every other app", or asks for bold visual concepts, art directions or references for a screen, page, brand or product. Runs bend_brief, open_canvas, search_references, rate_references and rate_directions from the GoBanana MCP server. Use banana-moodboard to arrange an existing canvas, banana-palette for colors, banana-design-md for DESIGN.md.
---

# Banana explore

Turn a fuzzy "make it cooler" into a few sharp, usable directions, then pull real references for them into a moodboard canvas. Mobbin shows what works. GoBanana shows what's next.

The GoBanana server does no thinking. It bends the brief with word lists and templates, then runs a web image search. You do the thinking: shape the brief, pick the wildness, reject the ideas that cannot be used, sell the rest, choose what to search.

## Ground rules

- **Source links, always.** Every reference you mention gets its source link, like `[Title](sourceUrl) (dribbble.com)`. No link, no mention.
- **Never download, save or copy reference images.** Not into the repo, not into a temp folder, not as base64. Link to them. Images load from their source on the canvas.
- **Do not describe images you have not seen.** Search results give titles, sites and links. Talk about the direction, not about pixels you cannot see.
- **Plain words.** Short sentences. No em dashes.
- **Usable beats wild.** The user is designing a real screen. Reject any idea that cannot become UI for that screen instead of listing every idea. Never show a dropped idea.

## Steps

### 1. Shape the brief

Write a one-line brief (max 500 characters) from what the user said. A good brief names:

- **Subject:** the thing being designed ("flight checkout screen", "landing page for a coffee roaster").
- **Audience or context**, if known ("for Gen Z travellers", "mobile first").
- **The default to escape**, if they named one ("looks like every fintech app").
- **Must keep**, if any (brand color, platform, Arabic and English).

If the ask is too vague to name a subject ("make it cool"), ask one short question that also covers wildness. Example: "What are we designing, and how far should I push it: 1 (fresh) to 5 (bananas)?" Ask once. If the user has said "just go" or similar, do not ask; make a sensible guess and say what you assumed.

### 2. Pick wildness (1 to 5)

| Level | Label | Feels like |
| --- | --- | --- |
| 1 | Fresh | Same layout, new flavour |
| 2 | Bold | One strong move, layout words dropped |
| 3 | Weird | Two moves combined. **Default** |
| 4 | Wild | Two or three moves |
| 5 | Bananas | Three moves, usability ignored on purpose |

Read the user's words: "a bit fresher" or "subtle" is 1 or 2. "Push this", "go wild" is 4. "Bananas", "unhinged", "craziest thing you can" is 5. No signal: use 3 and tell them they can turn it up or down.

### 3. Optional: lens and moves

- **Lens** (`lens`): a culture preset. Offer it when the user mentions Saudi, Gulf, Arabic or regional heritage. Ids: `sadu` (Sadu weaving), `najdi` (Najdi mud architecture), `kufic` (Kufic geometric patterns), `mashrabiya`, `desert-modern`. Never ask for or use sacred text or religious verses.
- **Moves** (`moves`): only when the user asks for a kind of bend. `transplant` (another object or industry), `material` (a physical material), `era` (another design period), `constraint` (remove a default), `scale` (size and density), `lens` (a visual tradition).

### 4. Ask for taste, once

Ask one short question: "Any 2 to 5 style words for the look you like, or a board or images I can look at?" Skip it if the user already said "just go".

- **Style words** that search well: minimal, glassmorphism, liquid glass, dark mode, big typography, monochrome, luxury, neumorphism, swiss style, bento grid, editorial, grainy, skeuomorphic. Avoid soft 3d, aurora gradient, claymorphism, isometric and playful: they pull in busy or off-topic results.
- **Boards or images:** if the user shares a board link or images and you can see them, describe the style in 2 to 5 of the words above (for example "minimal, dark mode, big typography"). The server never looks at images, so taste only reaches it as words. Never download or save the images.
- Pass them as `taste` to `open_canvas` or `bend_brief` (with the `canvasId`). They are saved on the canvas, and every later search on it uses them. Without taste the server uses minimal, glassmorphism, big typography and dark mode.

### 5. Open a canvas

Call `open_canvas` with a short `title` (max 80), the `brief` and `taste` if you have it. Open the canvas before you bend, so the directions are saved to it (`rate_directions` and `directionId` searches need that). If a canvas already exists in this conversation, pass its `canvasId` instead of making a new one (free plans have 3 canvases).

- If the client shows the canvas inline, say it is open above.
- **Always** give the web link too (`webUrl`), because many clients cannot show the inline canvas. If you cannot tell whether it rendered, say: "Open the board here: <webUrl>".

### 6. Bend the brief, wide

Call `bend_brief` with `brief`, `wildness`, `count: 8` and the `canvasId`, plus `lens`, `moves` and `taste` if chosen. Ask for more ideas than you will show: you will reject the weak ones in step 7. It is free and unlimited, so it is fine to run it again with a different wildness.

### 7. Triage the ideas (before you show any)

Judge every direction for THIS screen. Keep an idea only if all three hold:

- **(a) UI path.** Its salvage maps to a concrete UI pattern for the brief's actual screen. Say the pattern to yourself in a few words: "seat map as a woven grid", "fare cards that stack like boarding passes". If you cannot name one, it fails. A pretty texture with no screen idea fails.
- **(b) Usable references.** After the search and audit (steps 8 and 9) it has at least 3 on-topic, usable references from the UI lanes (`fidelity`, `taste`, `bridge`, `hero`, `locale`). Inspiration results alone do not count.
- **(c) Not a near duplicate** of an idea you already kept (same move and a similar ingredient, or the same UI pattern).

How to run it without wasting searches:

1. **First pass, free:** apply (a) and (c) to all 8. Shortlist the best 3 (4 if the user wants more options, or the number they asked for, for example "pick 2"). Each shortlisted idea costs one search, so never shortlist more than 4. Drop the rest now.
2. **Second pass, after searching** the shortlist (steps 8 and 9): apply (b). An idea whose UI lanes give fewer than 3 usable references is dropped, even if you liked it.
3. **Keep the best 3 or 4 that pass** (fewer if fewer pass; never bend again just to fill the list unless the user asks). Call `rate_directions` once with the `canvasId` and one rating per idea: `"drop"` with `reasons` for every idea you rejected, `"keep"` for the ones you show. Reasons: `no_ui_path`, `no_usable_refs`, `off_brief`, `duplicate_idea`, `too_literal` for drops; `strong_salvage`, `great_refs` for keeps. Dropped directions leave the canvas with their section, the items in it and their tray results, so the board only shows ideas you stand behind. Later bends suggest often dropped ideas less.

### 8. Search references for the shortlist

For each shortlisted direction, call `search_references` with `directionId`, `canvasId` and `count` (8 to 12 is a good default). One call searches several lanes at once and counts as one search:

- `fidelity`: real screens for the brief. `taste`: the user's style on the brief's screen. `hero`: one clean screen.
- `bridge`: the idea already applied to UI ("vending machine ui design"). The server keeps a bridge result only when its title names the idea, so this lane is often empty. That is fine; its places go to the other UI lanes.
- `inspiration`: the raw idea (material, craft, object). Useful for the mood, but it is not UI.
- `locale`: Arabic UI, for Arabic or right to left briefs.

Leave `mix` at the default (`"ui"`): UI references come first and about 20% are raw inspiration. Use `mix: "balanced"` or `mix: "wild"` only when the user asks for a wilder, more abstract or more moodboard-like mix ("go wilder on the references", "more raw inspiration", "less UI"). Do not pass a direction's `searchQuery` as `query` when you have its id. Leave `sources` at the default (Pinterest and Dribbble) unless the user wants Behance or Awwwards.

### 9. Audit and rate every search

The server does not look at images. You do. After each `search_references`:

1. **Judge every result** against the brief and the user's style words, from its title, source site and URL, and from the image when you can see it. Each result line shows `[referenceId, lane]`.
2. **Call `rate_references`** with the `canvasId` and one rating per judged result. It is free. Always rate the junk, so it leaves the tray and never comes back:
   - `bad` for shops and product listings, fashion and clothing, home decor, DIY and crafts, and any product unrelated to the brief (a car air freshener on a flight checkout board is junk). Also bad: stock, UI kit sales, cluttered sheets, duplicates, and anything not UI in a UI lane (taste, fidelity, bridge, hero, locale). Add `reasons` (`off_topic`, `stock_or_shop`, `not_ui`, `cluttered`, `duplicate`, `low_craft`, `wrong_style`).
   - `great` for standouts only: about the top 10 to 20%. Add `great_craft`, `on_style` or `on_brief`.
3. **Retry a weak lane.** If more than 40% of one lane is bad, search that lane once more: `search_references` with `directionId`, `canvasId`, `lane` and a new `query`. Describe the visual, not the object: "35mm film strip macro", not "oversized film frames". For the bridge lane keep the idea's main word in the query. Use the hint `rate_references` returns. At most 2 retries per lane, and each retry counts toward the quota.
4. **Count what is left** per direction for triage test (b): usable UI and bridge references, not inspiration.

### 10. Place UI first, then present only the kept ideas

- **Placement:** if you add references to the board (`add_to_canvas`), put UI references (fidelity, taste, bridge, hero, locale) first in each section, then at most 2 inspiration images per section. Allow more inspiration only when the user asked for a wilder mix (and then search with `mix`).
- **Present** only the kept directions, as a numbered list. One line each: a bold title, the move in brackets, and a half-sentence on the UI pattern it gives this screen. Example:

> 1. **Checkout as a frosted vinyl sleeve** (transplant + material). Fare summary slides out like a record.
> 2. **Boarding pass printed on risograph** (era). Two inks, misregistered on purpose, on the e-ticket.
> 3. **One color, no cards** (constraint). Hierarchy from type alone.

- Then **one line** on what you dropped and why, for example: "Dropped 5 of 8 ideas: 3 had no clear screen idea, 1 found too few usable references, 1 repeated another." Never list the dropped ideas one by one.
- Per kept direction: what each lane searched (the `lanes` field) and 2 or 3 highlights as `[title](sourceUrl) (site)`, UI references first. Tell the user in one line what you rejected from the results and why, for example: "Removed 4 results (2 shop listings, 2 off topic)."

### 11. Offer next steps

End with a short menu, for example:

- **Moodboard:** arrange the tray into sections on the canvas, or build it in FigJam (banana-moodboard).
- **Palette:** pull colors from the references you like, with WCAG checks (banana-palette).
- **DESIGN.md:** turn the board into a design system file your coding agent can follow (banana-design-md).
- **Turn it up or down:** rerun at wildness N+1 or N-1, or try a lens.
- **Wilder references:** search again with `mix: "balanced"` or `"wild"` for more raw inspiration.
- **Change the look:** search again with other `taste` words.

## When things go wrong

- **Quota or plan message** (for example "You have used your 30 free searches this month. Upgrade: <link>"): show the message to the user as is, with the link, once. Do not retry, do not loop, do not try other sources to get around it. `bend_brief` is still free, so the directions stay useful; offer to keep refining them.
- **Canvas limit** on `open_canvas`: relay the message, and offer to reuse an existing canvas by id.
- **Tool error or timeout:** retry once at most. Then tell the user in one line and continue with what you have.
- **GoBanana tools missing:** the GoBanana MCP server is not connected. Tell the user to enable the GoBanana connector (or run `/mcp` in Claude Code and log in), then try again.
