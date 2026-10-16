# Taste exemplars

The Atlas judge (docs/next-step-plan.md, P1-J7 and J10) compares results against 20 to 40 exemplar
pictures per kind of work that show the bar in docs/taste-bar.md. This folder holds the candidates
and the picks.

## Genres

Every candidate and pick belongs to one genre, listed once in `genres.mjs`: Mobile UI, Web UI, Web
showcase, Presentation and Branding. The first 270 candidates and the owner's first 120 picks have no
`genre` field: they count as Mobile UI or Web UI by their `platform`. Newer ones carry `genre`.
Readers filter with `genreOf` from `genres.mjs` (atlas-build `j7-taste.ts --genre <id>`, the J7
judge prompt).

To add candidates for a genre, append them to `candidates.json` with `genre` set (and an id prefix
no other genre uses), then run `node bench/taste/build-picker.mjs`, which embeds the data in
`picker.html`. To add a genre, add it to `genres.mjs` first.

## Files

- `candidates.json`: 530 candidates, URLs only (no image bytes).
  - 94 "From your boards" (`origin: "owner-board"`): the owner's own pins from the mobile and
    dashboard boards, collected once with the owner's approval. Five exact repeats were left out.
  - 176 "Search finds" (`origin: "search"`): found with Serper image search (`site:` queries on
    pinterest.com/pin, dribbble.com/shots and 60fps.design/shots, using the Round 13 wordings in
    docs/search-quality-experiment.md), then judged by eye against the bar. Each has a `score`
    (1 to 5), a one-line `why` and the `query` that found it. About 60% mobile, 40% web app.
  - 73 web showcase sites (`genre: "web-showcase"`, ids `w001` to `w073`, added 2026-10-16):
    playful, 3D, WebGL, motion-led and award-level websites from Awwwards (Sites of the Year, 3D,
    WebGL, Experimental, Colorful) and Craftwork's website inspiration, judged by eye in contact
    sheets. Each has `liveUrl` (the site itself), `tags` and `foundOn` (the listing page). The
    showcase item page is `sourceUrl`.
  - 65 Presentation (`genre: "presentation"`, ids `pr001` to `pr065`): 43 from Pitch's template
    gallery (`origin: "showcase"`, og:image of each public page, robots.txt allows) and 22 Serper
    finds on Dribbble, Behance and Pinterest.
  - 64 Branding (`genre: "branding"`, ids `br001` to `br064`): 58 from The Brand Identity, BP&O,
    Mindsparkle, Brand New and Fonts In Use (`origin: "showcase"`, og:image or the first use image,
    Fonts In Use at its 10 second crawl delay) and 6 Serper finds.
  - Every Presentation and Branding candidate was looked at in contact sheets before it went in,
    scored 1 to 5 against the Presentation and Branding sections of docs/taste-bar.md.
  - 58 from Best Designs on X (ids `bx001` to `bx058`, `group: "Best Designs on X"`, added
    2026-10-16): design posts from X that bestdesignsonx.com curates, read once from its own
    component tag feeds and judged by eye in contact sheets. Mostly components (cards, widgets,
    buttons, charts, toggles, sliders, inputs, empty states, navigation, notifications), some full
    screens and heroes, filed under Mobile UI, Web UI or Web showcase. Each has `component` (the
    part), `media` (up to 8 `{ type: "video" | "image", url, poster?, label? }` items, 33 of 58
    with a clip), `creator` and `creatorUrl` (the designer on X), `sourceUrl` (the original X
    post) and `foundOn` (the post on Best Designs on X). Link out only: these are never sent to a
    model (no j7-taste notes, no judge), even when picked.
- `genres.mjs` (types in `genres.d.mts`): the genres and `genreOf`.
- `picker.html`: the page you pick in. `build-picker.mjs` rebuilds its data line.
- `picks.default.json`: 95 default picks: the first 40 (30 board pins chosen to vary page, platform
  and colour, plus the 10 best search finds), 15 each for Presentation and Branding, 15 web
  showcase sites and the 10 best Best Designs on X components. Used when `picks.json` does not
  exist.
- `picks.json`: your picks.

## How to pick

1. Open `picker.html` in a browser (double click it; it needs the internet for the images).
2. Pick a tab: Mobile UI, Web UI, Web showcase, Presentation or Branding. Each tab shows its own
   count ("12 picked, aim for 20 to 40"). Arrow keys move between tabs.
3. Your saved picks (`picks.json`) start checked; a tab with no saved picks starts with the defaults.
   Click a picture to pick or unpick it. With the keyboard, press Tab to move between pictures and
   Space or Enter to toggle.
4. Narrow the grid with the Group and Page filters, or tick "Picked only" to review the tab.
5. "Reset this tab to defaults" and "Clear this tab" change only the open tab. "Load my picks.json"
   reopens a file you saved, so you can add to it. Your choices are kept in this browser while you
   work, so you can close the page and come back.
6. Press "Download picks.json" and save the file as `banana-server/bench/taste/picks.json`.

## picks.json shape

```json
{
  "version": 1,
  "source": "owner",
  "pickedAt": "2026-10-16T10:00:00.000Z",
  "count": 32,
  "picks": [
    { "id": "b004", "origin": "owner-board", "genre": "mobile-ui", "imageUrl": "https://i.pinimg.com/...", "sourceUrl": "https://www.pinterest.com/pin/...", "platform": "mobile", "page": "health" }
  ]
}
```

`genre` is new and optional for readers: a pick without it is Mobile UI or Web UI by `platform`.
`picks.default.json` has the same shape with `"source": "default"`. Readers take `picks.json` when
it exists and fall back to `picks.default.json`.
