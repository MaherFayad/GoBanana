# GoBanana styles

19 visual styles, one folder each. Each `<id>/STYLE.md` holds the definition, visual
signals, great versus cheap at the owner's bar, dos and don'ts, the nearest neighbour and how to
tell them apart, keywords per genre and the judge rubric; it doubles as a mini skill, loaded when a
direction uses that style. `<id>/exemplars.json` lists owner pick ids. `styles.json` is the same
list in machine form; banana-server reads its mirror in `banana-server/lib/styles/styles.json`
(keep the two equal: `tests/styles.test.ts` checks).

The general skill is `gobanana-taste` in banana-plugin/skills: how to read a style from a
thumbnail, and the diversity rule. Draft 1 and how the list was made: `DRAFT.md`.

## The styles

Counts are the owner's 211 picks tagged by eye (196 tagged; the 15 Craftwork and Best Designs on X picks are never looked at): any tag, then main tag.

| Style | Name | Genres | Nearest neighbour | Picks tagged | Main |
|---|---|---|---|---|---|
| [`dark-luminous`](dark-luminous/STYLE.md) | Dark luminous | Mobile, Web, Showcase, Deck | `dark-quiet-matte` | 35 | 23 |
| [`dark-quiet-matte`](dark-quiet-matte/STYLE.md) | Dark quiet matte | Mobile, Web, Deck | `dark-luminous` | 52 | 29 |
| [`data-dense-dashboard`](data-dense-dashboard/STYLE.md) | Data dense dashboard | Web, Mobile, Deck | `hero-numeral` | 20 | 15 |
| [`glass-frosted`](glass-frosted/STYLE.md) | Glass and frosted | Mobile, Web, Showcase | `soft-3d-objects` | 14 | 9 |
| [`soft-3d-objects`](soft-3d-objects/STYLE.md) | Soft 3D objects | Mobile, Web, Deck, Brand | `webgl-3d-scene` | 15 | 10 |
| [`vivid-gradient`](vivid-gradient/STYLE.md) | Vivid gradient field | Mobile, Web, Deck, Brand | `dark-luminous` | 15 | 10 |
| [`photographic-hero`](photographic-hero/STYLE.md) | Photographic hero | Mobile, Web, Showcase, Deck, Brand | `editorial-serif` | 40 | 20 |
| [`big-type-display`](big-type-display/STYLE.md) | Big type display | Deck, Brand, Showcase, Mobile | `editorial-serif` | 18 | 9 |
| [`hero-numeral`](hero-numeral/STYLE.md) | Hero numeral | Mobile, Web, Deck | `big-type-display` | 21 | 10 |
| [`editorial-serif`](editorial-serif/STYLE.md) | Editorial serif | Deck, Brand, Showcase, Web, Mobile | `minimal-mono-light` | 14 | 11 |
| [`minimal-mono-light`](minimal-mono-light/STYLE.md) | Minimal mono light | Mobile, Web, Deck, Brand | `flat-color-field` | 27 | 11 |
| [`flat-color-field`](flat-color-field/STYLE.md) | Flat colour field | Deck, Brand, Web, Showcase, Mobile | `playful-too-fun` | 20 | 7 |
| [`retro-pixel-halftone`](retro-pixel-halftone/STYLE.md) | Retro, raw, pixel and halftone | Brand, Showcase, Deck, Mobile, Web | `type-led-brand-system` | 6 | 4 |
| [`playful-too-fun`](playful-too-fun/STYLE.md) | Playful, too fun | Showcase, Brand, Deck, Mobile | `illustrative-handmade` | 12 | 5 |
| [`illustrative-handmade`](illustrative-handmade/STYLE.md) | Illustrative and handmade | Brand, Showcase, Mobile, Deck | `playful-too-fun` | 10 | 5 |
| [`webgl-3d-scene`](webgl-3d-scene/STYLE.md) | WebGL 3D scene | Showcase, Web | `soft-3d-objects` | 7 | 7 |
| [`motion-first`](motion-first/STYLE.md) | Motion first | Mobile, Showcase, Web, Deck | `webgl-3d-scene` | 9 | 0 |
| [`type-led-brand-system`](type-led-brand-system/STYLE.md) | Type-led brand system | Brand, Deck, Showcase | `flat-color-field` | 16 | 11 |
| [`gulf-arabic-first`](gulf-arabic-first/STYLE.md) | Gulf and Arabic first | Mobile, Web, Showcase, Deck, Brand | `type-led-brand-system` | 0 | 0 |

## Owner decisions (2026-10-16)

- **Merged:** `packaging-product-shot` into `photographic-hero`, `brutalist-raw` into
  `retro-pixel-halftone`, `ai-orb-glow` into `dark-luminous`. Each STYLE.md says where the
  merged style lives.
- **Kept the dark split:** `dark-luminous` and `dark-quiet-matte`.
- **No extra styles** for now (no Y2K, neumorphic or cyberpunk).
- **Gulf and Arabic:** the picker has a Gulf/Arabic tab so the owner can pick exemplars for
  `gulf-arabic-first`.

## Diversity rule (as built, banana-server/lib/styles/diversity.ts)

A board is one direction's UI references; the art row is not counted. A reference's main style is
its first style tag. Untagged references are not counted; the board check lists them so the agent
can tag them with rate_references.

1. At most **3** references of one main style per direction, or **2** when the board has 6 or
   fewer.
2. At most **60%** of a board carries any one tag (all tags counted). `dark-luminous` and
   `dark-quiet-matte` count as one tag (dark) unless the brief asks for dark.
3. At least **3** main styles per board when no style is asked, or **4** at 8 or more.
4. When a style is asked: at least **60%** of the board is that style or its nearest neighbour.
5. Each direction names its style id, and no two directions of one brief share a main style.
6. At most **1** `vivid-gradient` reference per board unless asked.

Search applies rules 1 and 6 when it orders results (over-cap results go to the end), and uses a
style's keywords when the brief or taste names that style. `get_canvas` with `summary: true`
reports the whole rule per direction.

## Showcase styles map

The 8 web showcase ids (banana-server/lib/sources/showcase.ts) keep working and map to styles:

| Showcase id | Style ids |
|---|---|
| `playful` | `playful-too-fun`, `illustrative-handmade` |
| `webgl` | `webgl-3d-scene` |
| `3d` | `webgl-3d-scene`, `soft-3d-objects` |
| `storytelling` | `motion-first` |
| `kinetic typography` | `big-type-display`, `motion-first` |
| `animation` | `motion-first` |
| `interactive` | `motion-first` |
| `experimental` | `retro-pixel-halftone`, `webgl-3d-scene` |
