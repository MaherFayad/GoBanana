---
name: banana-explore
description: Turn a vague design ask into wild, unexpected directions and pull linked visual references for them into a Banana moodboard canvas. Use when the user says "go wild", "push this design", "crazy ideas for", "make it weird", "make it bananas", "something nobody has done", "unexpected directions", "get me out of the box", "fresh take on", "inspire me", "this looks like every other app", or asks for bold visual concepts, art directions or references for a screen, page, brand or product. Runs bend_brief, open_canvas and search_references from the Banana MCP server. Use banana-moodboard to arrange an existing canvas, banana-palette for colors, banana-design-md for DESIGN.md.
---

# Banana explore

Turn a fuzzy "make it cooler" into 6 sharp directions, then pull real references for the 2 or 3 the user likes into a moodboard canvas. Mobbin shows what works. Banana shows what's next.

The Banana server does no thinking. It bends the brief with word lists and templates, then runs a web image search. You do the thinking: shape the brief, pick the wildness, sell the directions, choose what to search.

## Ground rules

- **Source links, always.** Every reference you mention gets its source link, like `[Title](sourceUrl) (dribbble.com)`. No link, no mention.
- **Never download, save or copy reference images.** Not into the repo, not into a temp folder, not as base64. Link to them. Images load from their source on the canvas.
- **Do not describe images you have not seen.** Search results give titles, sites and links. Talk about the direction, not about pixels you cannot see.
- **Plain words.** Short sentences. No em dashes.

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

### 4. Bend the brief

Call `bend_brief` with `brief`, `wildness`, `count: 6`, plus `lens` and `moves` if chosen. It is free and unlimited, so it is fine to run it again with a different wildness.

### 5. Present the directions: short and punchy

A numbered list. One line each: a bold title, the move in brackets, and a half-sentence on why it is interesting for this brief. No paragraphs. Example:

> 1. **Checkout as a frosted vinyl sleeve** (transplant + material). Payment slides out like a record.
> 2. **Boarding pass printed on risograph** (era). Two inks, misregistered on purpose.
> 3. **One color, no cards** (constraint). Hierarchy from type alone.

Then recommend 2 or 3 to search: one that could ship soon and one or two that stretch. Ask the user to pick, or to say "go" to take your picks. If they already said "just go", take your picks and say which.

### 6. Open a canvas

Call `open_canvas` with a short `title` (max 80) and the `brief`. If a canvas already exists in this conversation, pass its `canvasId` instead of making a new one (free plans have 3 canvases).

- If the client shows the canvas inline, say it is open above.
- **Always** give the web link too (`webUrl`), because many clients cannot show the inline canvas. If you cannot tell whether it rendered, say: "Open the board here: <webUrl>".

### 7. Search references into the tray

For each picked direction, call `search_references` with `directionId`, `canvasId` and `count` (8 to 12 is a good default). Leave `sources` at the default (Pinterest and Dribbble) unless the user wants Behance or Awwwards, for example for web and brand work. To steer, pass `query` with your own wording instead of `directionId`.

Then report per direction: how many references landed in the tray, and 2 or 3 highlights as `[title](sourceUrl) (site)`. If a direction returns few results, say so and offer a reworded `query` or other sources. Do not call search again on your own more than once per direction; each search counts toward the user's quota.

### 8. Offer next steps

End with a short menu, for example:

- **Moodboard:** arrange the tray into sections on the canvas, or build it in FigJam (banana-moodboard).
- **Palette:** pull colors from the references you like, with WCAG checks (banana-palette).
- **DESIGN.md:** turn the board into a design system file your coding agent can follow (banana-design-md).
- **Turn it up or down:** rerun at wildness N+1 or N-1, or try a lens.

## When things go wrong

- **Quota or plan message** (for example "You have used your 30 free searches this month. Upgrade: <link>"): show the message to the user as is, with the link, once. Do not retry, do not loop, do not try other sources to get around it. `bend_brief` is still free, so the directions stay useful; offer to keep refining them.
- **Canvas limit** on `open_canvas`: relay the message, and offer to reuse an existing canvas by id.
- **Tool error or timeout:** retry once at most. Then tell the user in one line and continue with what you have.
- **Banana tools missing:** the Banana MCP server is not connected. Tell the user to enable the Banana connector (or run `/mcp` in Claude Code and log in), then try again.
