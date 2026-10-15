# Taste exemplars

The Atlas judge (docs/next-step-plan.md, P1-J7 and J10) compares results against 20 to 40 exemplar
pictures that show the bar in docs/taste-bar.md. This folder holds the candidates and the picks.

## Files

- `candidates.json`: 270 candidates, URLs only (no image bytes).
  - 94 "From your boards" (`origin: "owner-board"`): the owner's own pins from the mobile and
    dashboard boards, collected once with the owner's approval. Five exact repeats were left out.
  - 176 "Search finds" (`origin: "search"`): found with Serper image search (`site:` queries on
    pinterest.com/pin, dribbble.com/shots and 60fps.design/shots, using the Round 13 wordings in
    docs/search-quality-experiment.md), then judged by eye against the bar. Each has a `score`
    (1 to 5), a one-line `why` and the `query` that found it. About 60% mobile, 40% web app.
- `picker.html`: the page you pick in.
- `picks.default.json`: 40 default picks (30 board pins chosen to vary page, platform and colour,
  plus the 10 best search finds). Used when `picks.json` does not exist.
- `picks.json`: your picks, once you save them. Not in the repo until you add it.

## How to pick

1. Open `picker.html` in a browser (double click it; it needs the internet for the images).
2. 40 pictures start picked (the defaults). Click a picture to pick or unpick it. With the
   keyboard, press Tab to move between pictures and Space or Enter to toggle.
3. Narrow the grid with the Group, Platform and Page filters, or tick "Picked only" to review your
   set. The counter at the top shows how many you have; aim for 20 to 40.
4. "Reset to my defaults" goes back to the 40 defaults. "Clear all" starts from zero. Your choices
   are kept in this browser while you work, so you can close the page and come back.
5. Press "Download picks.json" and save the file as `banana-server/bench/taste/picks.json`.

## picks.json shape

```json
{
  "version": 1,
  "source": "owner",
  "pickedAt": "2026-10-16T10:00:00.000Z",
  "count": 32,
  "picks": [
    { "id": "b004", "origin": "owner-board", "imageUrl": "https://i.pinimg.com/...", "sourceUrl": "https://www.pinterest.com/pin/...", "platform": "mobile", "page": "health" }
  ]
}
```

`picks.default.json` has the same shape with `"source": "default"`. Readers take `picks.json` when
it exists and fall back to `picks.default.json`.
