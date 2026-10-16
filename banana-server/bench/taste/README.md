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

- `candidates.json`: 472 candidates, URLs only (no image bytes).
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
  - `media` (Web showcase, Presentation and Branding, added 2026-10-16): up to 8 hotlinked items,
    `{ type: "video" | "image", url, poster?, label? }`, the main picture (`imageUrl`) first, so a
    candidate shows more than its hero or cover. Read once from each item's own showcase page, one
    page at a time, with robots.txt and crawl delays respected; every URL was loaded in Chrome and
    every list checked by eye in contact sheets. Nothing was downloaded. What each source gives:
    - Awwwards: the site's gallery and its own elements (`/inspiration/<element>-<site>`), many of
      them screen recordings: 21 of 47 have video, 42 have extra frames, 5.1 items on average.
    - Craftwork: the item's video preview (19 of 26) and its cover; it exposes no other frames.
    - Pitch: the template's slide preview video (42 of 43; one file is missing at Pitch), which walks
      through the inner slides (contents, key points, big-number data slides). Pitch has no
      per-slide images (its pages draw slides live), so the video is how the inner slides show.
    - The Brand Identity (7.9 items), BP&O (7.0) and Mindsparkle (5.2): the article's own images,
      motion loops and GIFs, logo to applications. Fonts In Use (6.9): the use's own images.
    - One frame only: Brand New (post bodies are for subscribers), Dribbble (shot pages answer
      automated requests with a challenge), Behance (robots.txt disallows Claude agents) and
      Pinterest (never scraped).
  - Craftwork's license allows saving references and sharing links, but not testing or training AI
    models on its previews. So no Craftwork candidate, pick or media may reach a model input:
    atlas-build's thumbnail fetch leaves out every Craftwork host (`noModelInputHosts` in
    lib/sources/registry.ts) and `j7-taste.ts` drops Craftwork picks (atlas-build
    tests/licence.test.ts). Craftwork's video host is picker-only, not on the image allowlist.
- `genres.mjs` (types in `genres.d.mts`): the genres and `genreOf`.
- `picker.html`: the page you pick in. `build-picker.mjs` rebuilds its data line.
- `picks.default.json`: 85 default picks: the first 40 (30 board pins chosen to vary page, platform
  and colour, plus the 10 best search finds) and 15 each for Web showcase, Presentation and Branding. Used when
  `picks.json` does not exist.
- `picks.json`: your picks.

## How to pick

1. Open `picker.html` in a browser (double click it; it needs the internet for the images and
   videos). Every video host played from a file in Chrome on 2026-10-16. If a video ever stays
   blank, serve the folder instead: from the repo root run
   `python -m http.server 8123 --directory banana-server/bench/taste` and open
   `http://localhost:8123/picker.html`.
2. Pick a tab: Mobile UI, Web UI, Web showcase, Presentation or Branding. Each tab shows its own
   count ("12 picked, aim for 20 to 40"). Arrow keys move between tabs.
3. Your saved picks (`picks.json`) start checked; a tab with no saved picks starts with the defaults.
   Click a picture to pick or unpick it. With the keyboard, press Tab to move between pictures and
   Space or Enter to toggle.
4. Hover a picture, or Tab to it, to see it move: its video plays muted on a loop, or its frames run
   in turn. The chip on the picture counts its items (a play mark when one is a video).
5. Press "View all" under a picture (Tab to it and press Enter) to see every frame and video large:
   Left and Right move between them, Esc closes, videos have controls, and "Open live site" and the
   source page link out. Opening it never changes a pick; the viewer's own Pick button does.
   With reduced motion set on your system nothing plays by itself and videos wait for "Play video".
6. Narrow the grid with the Group and Page filters, or tick "Picked only" to review the tab.
7. "Reset this tab to defaults" and "Clear this tab" change only the open tab. "Load my picks.json"
   reopens a file you saved, so you can add to it. Your choices are kept in this browser while you
   work, so you can close the page and come back.
8. Press "Download picks.json" and save the file as `banana-server/bench/taste/picks.json`.

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

The download never carries `media`: picks keep this shape. `genre` is new and optional for readers: a pick without it is Mobile UI or Web UI by `platform`.
`picks.default.json` has the same shape with `"source": "default"`. Readers take `picks.json` when
it exists and fall back to `picks.default.json`.
