# Style list, draft 1 (for the owner to trim)

Status: draft for review, 2026-10-16. Step 1 only: nothing here is built. No folders, no code, no
search changes yet.

The owner asked for a way to "assess visual direction or styles" so GoBanana has taste skills for
every kind of work and can tell dark UI, big typography, 3D, motion, flat design and so on apart,
with one directory per style, so results stay controlled and diverse and every direction knows
which style it is.

## How this list was made

- **Looked first.** The owner's 211 picks (`banana-server/bench/taste/picks.json`) were loaded in
  memory and looked at in 14 contact sheets of 15 images each. The sheets were composed locally
  and are not kept in the repo.
- **15 picks were never looked at.** Their source or image host is on `noModelInputHosts()`
  (Craftwork and Best Designs on X, including x.com), so they were skipped and no text about them
  was read either: `w049 w050 w054 w062 w063 w064 w066 w068 w070 w071 w073 bx025 bx026 bx027
  bx054`. All counts below use the other **196** picks. Those 15 are web showcase and Mobile UI
  picks, so the web showcase counts are the least reliable (19 of 34 seen).
- **Each pick carries 2 to 3 style tags**, the dominant one first (the primary). A style is
  something you can see in a thumbnail, and one pick usually shows more than one. 4 picks have 1
  tag, 47 have 2, 145 have 3.
- **Also read:** `docs/taste-bar.md`, the tags and notes in `candidates.json`, the 8 web styles in
  `banana-server/lib/sources/showcase.ts`, `atlas-build/data/lens-list.json`, and a light pass over
  the 300 default pages in `atlas-build/raw/j8-pages-*.jsonl` for the default-AI looks.
- Pick ids below are the owner's ids: `b` and `c` and `d` are board and search finds (Mobile UI and
  Web UI), `pr` Presentation, `br` Branding, `w` Web showcase.

## Default-AI looks to avoid (J8 slop)

The J8 slop output (`atlas-build/out/v1/slop`) has not been built, so this is a text pass over the
300 default pages (Sonnet and Opus) in `atlas-build/raw/j8-pages-*.jsonl`, counted by regex on the
generated HTML. Treat the shares as rough.

| Default look | Share of 300 default pages |
|---|---|
| Rounded corners of 12 to 29 px on cards and buttons | 83% |
| Centred text blocks and a centred hero | 72% |
| A linear gradient somewhere | 57% |
| Dark-ish ground | 49% |
| `system-ui` or `-apple-system` as the first font | about 48% |
| Georgia as the serif accent | 30% |
| Helvetica Neue or Arial as the first font | about 12% |
| Inter | 6% |
| `backdrop-filter` blur | 6% |
| Gradient clipped to text | 4% |
| Indigo or violet accent (`#6366f1`, `#8b5cf6` family) | 3% |

What it means for styles: the default is a centred hero, soft 16 px cards, a gentle gradient, a
system font and one Georgia heading. Every style below must be visibly not that. A style that reads
as the default (a purple gradient, three rounded cards under a centred headline) is `cheap` in
every style.

## The 22 styles

Genres: **M** mobile, **W** web (apps and dashboards), **S** web showcase, **D** deck, **B** brand.
Counts are picks tagged with the style (any tag), then picks where it is the primary tag.

### 1. `dark-luminous` Dark luminous (76 tagged, 40 primary)

- **Definition:** a near-black screen where one glow, gradient or photograph is the only light.
- **Signals:** near-black ground; one luminous focal area (a glow rim, a gradient bloom, a lit
  object); thin small grey labels; a single accent (lime, orange, electric blue, one hue).
- **Genres:** M, W, S, D.
- **Owner picks:** b004 b005 b016 b027 b029 b034 b039 b058 b089 c105 c137 c246 c252 d014 d045 c292
  pr005 pr034 pr059 w001 w044.
- **Great vs cheap:** great has one focal glow and everything else quiet, with real data and tight
  type. Cheap has glow everywhere, neon on every control, purple to blue everywhere, glow used as a
  background wash.
- **Nearest neighbour:** `dark-quiet-matte`. Tell apart by the light: luminous has a glow or
  gradient you notice first; quiet-matte has none, only surface tone steps and one hairline.

### 2. `dark-quiet-matte` Dark quiet and matte (19 tagged, 13 primary)

- **Definition:** a flat, matte, near-black product UI with no glow, built from tone steps and
  hairlines.
- **Signals:** matte black or charcoal; surfaces differ by 2 to 4% lightness; 1 px borders; one
  small accent (a green or blue dot, a status chip); small grey labels.
- **Genres:** M, W, D.
- **Owner picks:** b035 b048 b071 b091 c005 c021 c080 c103 c311 c380 c425 c423 c452 c540 c550
  pr048 pr061.
- **Great vs cheap:** great reads as a real tool, with dense but calm tables, thin charts and one
  accent. Cheap is a black skin on a light layout, grey on grey with no hierarchy, or default
  chart colours on black.
- **Nearest neighbour:** `data-dense-dashboard`. Tell apart by intent: quiet-matte is about the
  surface and works for sparse screens (login, paywall); data-dense is about information load and
  also exists in light.

### 3. `data-dense-dashboard` Data dense dashboard (31 tagged, 9 primary)

- **Definition:** many real numbers, tables and thin charts in one calm grid.
- **Signals:** 4 or more widgets in view; thin bar and line charts; status chips; a table with
  small type; one hero metric among small ones.
- **Genres:** W, M (stats screens), D (one chart slide).
- **Owner picks:** b018 b064 b078 b079 c380 c413 c423 c452 c550 d168 c425 b058 pr060.
- **Great vs cheap:** great has real, believable data, a quiet palette, and one number that wins.
  Cheap is rainbow pies, every card a different chart, lorem numbers, icons in rows.
- **Nearest neighbour:** `hero-numeral`. Tell apart by count: data-dense has many figures with
  one dominant; hero-numeral has one figure and little else.

### 4. `glass-frosted` Glass and frosted (23 tagged, 6 primary)

- **Definition:** frosted translucent panels layered over a colourful or photographic backdrop.
- **Signals:** blurred backdrop showing through a panel; soft white edge highlight; layered cards
  with soft shadow; a landscape or colour field behind a window.
- **Genres:** M, W, S.
- **Owner picks:** b045 b046 b049 b075 b076 b077 b082 b086 c124 d222 d143 c457.
- **Great vs cheap:** great uses glass lightly, over one rich backdrop, with the text still
  sharp. Cheap blurs everything, uses glass on a flat grey ground (it has nothing to show), or
  stacks five glass cards.
- **Nearest neighbour:** `soft-3d-objects`. Tell apart by material: glass is a flat translucent
  sheet; soft-3d is a lit object with volume and a cast shadow.

### 5. `soft-3d-objects` Soft 3D objects (20 tagged, 8 primary)

- **Definition:** UI widgets and cards rendered as lit, glossy or tactile 3D objects, in the
  Spline and Blender style.
- **Signals:** rounded squircle slab with visible thickness; glossy gradient glass or rubber;
  cast shadow on a light or dark floor; one object per frame.
- **Genres:** M, W, D (cover slide), B (rarely).
- **Owner picks:** b012 b028 b044 b050 b051 b063 b070 b087 c312 c538 pr016.
- **Great vs cheap:** great is one object, believable light, a real number on it. Cheap is stock
  3D people, plastic icon packs, floating coins and lock icons.
- **Nearest neighbour:** `webgl-3d-scene`. Tell apart by scale: soft-3d is an object inside a UI;
  webgl-3d-scene is a whole navigable world that is the page.

### 6. `ai-orb-glow` AI orb and ambient glow (8 tagged, 5 primary)

- **Definition:** an iridescent orb or soft ambient glow as the face of an AI or voice feature.
- **Signals:** a single glowing sphere or ribbon centred on a quiet field; blue to violet to
  warm gradient inside the orb; one line of prompt text under it.
- **Genres:** M (mainly), W (chat hero).
- **Owner picks:** b034 b039 c246 c248 c252 d014 b036 b047.
- **Great vs cheap:** great has a restrained palette, a real state (listening, thinking), and the
  orb is the one effect. Cheap is a generic purple blob with sparkle icons.
- **Nearest neighbour:** `dark-luminous`. Tell apart by subject: ai-orb has a drawn orb as hero;
  dark-luminous has no object, only light.

### 7. `vivid-gradient` Vivid gradient field (40 tagged, 9 primary)

- **Definition:** a saturated, smooth gradient or mesh is the main surface of the screen or slide.
- **Signals:** a full-bleed colour gradient; blue to violet or orange to red; white type on it;
  often one glassy card on top.
- **Genres:** M, W, D, B.
- **Owner picks:** b015 b042 b052 c002 d055 c360 c534 pr051 pr053 pr059 br063.
- **Great vs cheap:** great stays in one hue family with luminous depth, and the gradient has a
  job (a mood, a plan colour). Cheap is the default AI look: indigo to violet gradient, gradient
  text, a gradient button on a gradient card.
- **Nearest neighbour:** `dark-luminous`. Tell apart by area: vivid-gradient is colour across most
  of the frame; dark-luminous keeps the glow to one spot on black.
- **Watch:** this is the style closest to the J8 slop look. Gate it hardest in the judge.

### 8. `photographic-hero` Photographic hero (45 tagged, 15 primary)

- **Definition:** a real photograph is the material: a phone in a hand, a window over a mountain,
  a face, a product on a surface.
- **Signals:** full-bleed photo or a device held in a photographed hand; a UI window over a
  landscape; natural light and shallow depth; type laid over the photo.
- **Genres:** M, W, S, D, B.
- **Owner picks:** b003 b031 b047 b053 b057 b075 b086 b092 c010 c124 c301 c457 pr021 pr026 pr043
  pr055 br001 br046 w005 w010.
- **Great vs cheap:** great has one photo with a clear subject and a UI or type that fits it.
  Cheap is stock handshake photos, a lone laptop on a desk with nothing on screen, a photo under a
  coloured wash.
- **Nearest neighbour:** `editorial-serif`. Tell apart by lead: in photographic-hero the picture
  leads; in editorial-serif the type leads and the photo supports.

### 9. `big-type-display` Big type display (33 tagged, 13 primary)

- **Definition:** one word or short line set huge, in a condensed, bold or oversized sans, is the
  image.
- **Signals:** letters cropped by the frame or filling it; one or two words ("KPI REPORT",
  "WAKE UP WORLD"); tight leading; small grey meta text in a corner.
- **Genres:** D, B, S, M (onboarding).
- **Owner picks:** pr007 pr016 pr021 pr024 pr027 pr035 pr043 pr057 br017 br018 br023 br025 w025
  w026 w030 b013 b072.
- **Great vs cheap:** great has one idea, a real typeface with character, and a calm margin.
  Cheap is a big default sans plus three bullets, mixed display fonts, huge text that wraps badly.
- **Nearest neighbour:** `editorial-serif`. Tell apart by the letterform: big-type is a heavy or
  condensed sans shouting; editorial-serif is a refined serif speaking.

### 10. `hero-numeral` Hero numeral (33 tagged, 9 primary)

- **Definition:** one huge figure carries the screen or slide, with small grey labels around it.
- **Signals:** a number at 5 to 10 times the label size ("$63,000", "13,143", "11,170", "$100b");
  a thin line or bar chart at most; large empty space.
- **Genres:** M, W, D.
- **Owner picks:** b007 b040 b079 b093 b089 c374 pr057 pr058 pr060 pr061 pr062 b013.
- **Great vs cheap:** great has one real-feeling figure and unit, one supporting label row, and
  nothing else. Cheap is four equal KPI cards, icons beside each number, a donut with a number in
  it.
- **Nearest neighbour:** `big-type-display`. Tell apart by content: hero-numeral is a number
  with data meaning; big-type is words.

### 11. `editorial-serif` Editorial serif (18 tagged, 8 primary)

- **Definition:** a well cut serif and a calm grid, the way a magazine or annual report is set.
- **Signals:** a serif display line ("Pick your Plan", "Persepolis Reimagined"); pull quotes;
  generous margins; small caps labels; muted paper or cream grounds.
- **Genres:** D, B, S, W (marketing), M (rare).
- **Owner picks:** b042 c052 pr026 pr036 pr054 pr055 pr056 pr063 br012 w010 w038.
- **Great vs cheap:** great has a serif with real contrast and optical spacing, a visible grid and
  one image. Cheap is Georgia or Times as the only serif, a serif heading on a gradient SaaS page.
- **Nearest neighbour:** `minimal-mono-light`. Tell apart by the type: editorial has a serif as
  voice; minimal-mono is sans or mono and almost silent.

### 12. `minimal-mono-light` Minimal mono light (56 tagged, 13 primary)

- **Definition:** a quiet light product UI in one tone with one accent and tight, real type.
- **Signals:** white or light grey ground; black text; one accent colour; thin dividers; one
  screen shown clean.
- **Genres:** M, W, D, B.
- **Owner picks:** b008 b025 b032 b065 b093 c053 c096 pr015 pr035 pr046 br025.
- **Great vs cheap:** great is shipped-grade: real data, tight type, every state resolved.
  Cheap is a pastel concept with stock illustration and lorem, or an empty wireframe.
- **Nearest neighbour:** `flat-color-field`. Tell apart by ground: minimal-mono is neutral with an
  accent; flat-color-field commits the whole frame to one bold colour.

### 13. `flat-color-field` Flat colour field (35 tagged, 9 primary)

- **Definition:** flat, shadowless blocks of solid colour, with one bold ground and no gradients.
- **Signals:** a solid saturated ground (lime, orange, red, cobalt, green); flat shapes with hard
  edges; no shadow, no blur; black or white type.
- **Genres:** D, B, W (marketing), S, M (rare).
- **Owner picks:** pr007 pr024 pr057 pr060 pr062 br006 br016 br018 br023 br025 b069 b081 w030.
- **Great vs cheap:** great limits itself to 2 or 3 flat colours and a strong type or mark. Cheap
  is six pastels, drop shadows creeping in, flat stock illustration characters.
- **Nearest neighbour:** `playful-too-fun`. Tell apart by energy: flat-color-field is confident and
  static; playful adds character, bounce and surprise.

### 14. `brutalist-raw` Brutalist raw (7 tagged, 4 primary)

- **Definition:** deliberately rough: system type, visible grid, harsh contrast, no polish.
- **Signals:** monospace or default type used loud; stark black and one hard colour; cut-off or
  overlapping text; visible borders and table lines; noise or glitch.
- **Genres:** B, D, S, W (tools).
- **Owner picks:** pr042 br006 br008 w038 d168 b072 b038.
- **Great vs cheap:** great is rough on purpose and exact underneath (alignment is tight). Cheap
  is just messy, or "neo-brutalist" cards with thick black borders and a pastel shadow.
- **Nearest neighbour:** `retro-pixel-halftone`. Tell apart by source: brutalist is raw modern
  and unstyled; retro-pixel quotes an older medium (print, pixel, CRT).

### 15. `retro-pixel-halftone` Retro, pixel and halftone (8 tagged, 6 primary)

- **Definition:** a deliberate older look: halftone, dither, pixel, Art Deco or vintage badge.
- **Signals:** dot-screen or dither texture; pixelated image; deco display letters or a round
  badge; limited ink colours; paper grain.
- **Genres:** B, S, M (accent), D.
- **Owner picks:** b038 b072 br007 br011 br016 br017 br044 w033.
- **Great vs cheap:** great uses texture as a second voice on one element (the "BUDGET" card), not
  as a wash. Cheap is a retro filter on everything, 80s neon grid, fake worn textures.
- **Nearest neighbour:** `type-led-brand-system`. Tell apart by cue: retro is about the era look;
  type-led-brand is about the mark and its system, any era.

### 16. `playful-too-fun` Playful, "too fun" (22 tagged, 5 primary)

- **Definition:** character, colour and bounce first; the page is a toy.
- **Signals:** big rounded or bubble letters; a character or mascot; saturated colour blocks;
  tilted elements; hand-drawn or toy-like 3D props.
- **Genres:** S, B, D (rare), M (games, kids).
- **Owner picks:** w002 w004 w007 w014 w017 w018 w026 br018 br023 br027 br038 br031 d047.
- **Great vs cheap:** great is joyful and still clear: one idea, tight craft, the content still
  readable. Cheap is clip-art mascots, rainbow everything, comic fonts, stock cartoon people.
- **Nearest neighbour:** `illustrative-handmade`. Tell apart by feel: playful is loud and
  energetic; illustrative-handmade can be calm, quiet or literary.

### 17. `illustrative-handmade` Illustrative and handmade (11 tagged, 7 primary)

- **Definition:** drawn, printed or collaged artwork carries the identity.
- **Signals:** visible line or brush; limited ink palette; flat figures with texture; botanical or
  folk drawing; a collage of cut shapes.
- **Genres:** B, S, M (onboarding), D.
- **Owner picks:** w004 w007 w014 w021 br007 br011 br012 br014 br026 br046 c082.
- **Great vs cheap:** great has a recognisable hand and a system (one line weight, one palette).
  Cheap is flat vector stock people, Corporate Memphis, AI illustration with six-fingered hands.
- **Nearest neighbour:** `playful-too-fun`. See style 16.

### 18. `webgl-3d-scene` WebGL and 3D scene (8 tagged, 7 primary)

- **Definition:** a real-time 3D object or world is the website itself, moved by scroll or mouse.
- **Signals:** a rendered object centred in the frame (helmet, igloo, planet, isometric town);
  depth and light effects; sparse UI chrome on top; often a loader or "enter".
- **Genres:** S (always), W (rare hero), D (no).
- **Owner picks:** w001 w002 w003 w006 w017 w018 w033 w044.
- **Great vs cheap:** great has a bespoke object, a clear single interaction, and fast load.
  Cheap is a stock 3D blob over a SaaS headline, heavy scenes with no content, a model that is
  not the product.
- **Nearest neighbour:** `soft-3d-objects`. See style 5.
- **Note:** a thumbnail can show the object but not that it moves, so this sits next to
  `motion-first` for judging.

### 19. `motion-first` Motion first (21 tagged, 1 primary)

- **Definition:** the design is the movement (scrub, drag, morph, kinetic type), and the still is
  the least of it.
- **Signals:** a slider, dial or scrubber with a visible state; motion blur or a trail; a
  mid-transition frame; a before and after pair; a "0:07" or 60fps mark on the shot.
- **Genres:** M, S, W, D (builds).
- **Owner picks:** b004 b005 b010 b012 b014 b016 b027 c137 c252 c292 d045 d143 w006 w017 w021.
- **Great vs cheap:** great has one rehearsed gesture with a clear start and end state and a
  reason. Cheap is fades on everything, bouncing icons, parallax for its own sake.
- **Nearest neighbour:** `webgl-3d-scene`. Tell apart by carrier: motion-first is a UI gesture
  or type move; webgl-3d is a rendered world.
- **Limit:** stills cannot show motion. It is a tag layered on a base style (almost always
  `dark-luminous` or `minimal-mono-light`), so it needs a motion exemplar (video or gif) beside
  the still, and the judge reads the note.

### 20. `type-led-brand-system` Type-led brand system (15 tagged, 6 primary)

- **Definition:** an identity built from one mark, one move and a pattern, applied to posters,
  signage and sets.
- **Signals:** a wordmark or monogram; a repeating pattern or wall of the wordmark; one ground
  and one accent; the mark on a banner, bag or billboard; a poster set in one palette.
- **Genres:** B (mainly), D (brand slides), S.
- **Owner picks:** br005 br006 br007 br008 br014 br027 br028 br038 br049 br060 b030.
- **Great vs cheap:** great carries one idea through many applications. Cheap is a logo floating
  on a mockup, twelve logo options on a page, a guideline template.
- **Nearest neighbour:** `flat-color-field`. Tell apart by scope: type-led-brand is the system
  and the mark; flat-color-field is the surface treatment.

### 21. `packaging-product-shot` Packaging and product shot (4 tagged, 3 primary)

- **Definition:** a small packaging family lit like a studio product shot.
- **Signals:** 3 to 6 packs in one palette; seamless backdrop; hard or soft studio light;
  one hero product with a clean label.
- **Genres:** B, D (product slide).
- **Owner picks:** br009 br022 br024 br044.
- **Great vs cheap:** great is a family with one system, lit to feel real. Cheap is a shelf of
  generic bottles, a flat label pasted on a bottle render.
- **Nearest neighbour:** `photographic-hero`. Tell apart by subject: packaging is the product and
  its system; photographic-hero is a UI or scene on a photo.

### 22. `gulf-arabic-first` Gulf and Arabic first (0 tagged, 0 primary: a gap)

- **Definition:** Arabic type and Gulf craft lead the layout, written right to left, with the
  pattern or material taken from a named Gulf craft.
- **Signals (to confirm with owner picks):** Arabic display or Naskh and Kufic type set large;
  right-to-left layout with mirrored flow; Sadu, Talli, Najdi or roshan pattern used as a band or
  field, not a stamp; warm sand, indigo, saffron and black grounds.
- **Genres:** M, W, S, D, B.
- **Owner picks:** none. The 211 picks contain no Arabic or Gulf work. This is a coverage gap in
  the owner's taste set, not a finding about taste.
- **Source of meaning:** the existing lenses in `atlas-build/data/lens-list.json` (Gulf: sadu,
  talli, qatt-asiri, najdi, hejazi-roshan, kufic, diwani, alula-strata, dhow; also zellige and
  azulejo and block-print as world craft). A lens is a modifier (pattern, colour, rule) that works
  inside any style, while `gulf-arabic-first` is the style where Arabic and the craft lead.
- **Great vs cheap:** great credits the craft, uses the real grammar, sets Arabic by a native
  eye and mirrors the layout. Cheap is a mosque silhouette, gold crescents, a pattern as
  wallpaper, Arabic letters in a Latin layout, fake letterforms.
- **Nearest neighbour:** `type-led-brand-system`. Tell apart by direction: gulf-arabic-first
  changes the layout and script; the brand system only changes the mark.
- **Needs from the owner:** 15 to 20 picks of Arabic and Gulf work before the style can be judged.

## Merged and split calls, and what was left out

- **Split:** dark UI into `dark-luminous` (a glow) and `dark-quiet-matte` (no glow). One dark
  style would hold 95 of 196 picks (48%) and tell the agent nothing.
- **Split:** `big-type-display` (words) from `hero-numeral` (a figure). They get different
  exemplars and different search words.
- **Merged:** orb, Siri-style and ambient AI looks into `ai-orb-glow`; Art Deco, halftone, pixel
  and dither into `retro-pixel-halftone`; paper and ink brand posters into `type-led-brand-system`.
- **Layered, not a style:** `motion-first` has 1 primary pick because a still cannot show motion.
  Keep it, but as a second tag on a base style.
- **Left out for now:** a deck-only style ("keynote dark with a gradient accent") is already
  `dark-luminous` plus `vivid-gradient`. Skeuomorphic and neumorphic have no picks. Cyberpunk and
  Y2K have no picks. Pastel Dribbble concept is a fail pattern, not a style.
- **Lenses stay lenses:** Swiss International leans to `minimal-mono-light`, `editorial-serif`
  and `big-type-display`; Memphis to `playful-too-fun` and `flat-color-field`; Bauhaus to
  `flat-color-field`; Japanese ma to `minimal-mono-light`.

## Showcase styles map

`banana-server/lib/sources/showcase.ts` has 8 web styles. Proposed mapping, so the old words keep
working when styles move into the new directory:

| Showcase id | Style id |
|---|---|
| `playful` | `playful-too-fun` (and `illustrative-handmade` for "illustration") |
| `webgl` | `webgl-3d-scene` |
| `3d` | `webgl-3d-scene` (soft-3d-objects for non-web) |
| `storytelling` | `motion-first` |
| `kinetic typography` | `big-type-display` + `motion-first` |
| `animation` | `motion-first` |
| `interactive` | `motion-first` |
| `experimental` | `brutalist-raw` or `webgl-3d-scene`, owner to choose |

## Coverage

196 picks were looked at (15 skipped). Every viewed pick has at least one style, and 98% have two
or three.

| Style | Tagged | Primary | Mobile UI | Web UI | Web showcase | Presentation | Branding |
|---|---|---|---|---|---|---|---|
| dark-luminous | 76 | 40 | 35 | 21 | 5 | 14 | 1 |
| minimal-mono-light | 56 | 13 | 29 | 10 | 5 | 9 | 3 |
| photographic-hero | 45 | 15 | 12 | 10 | 5 | 11 | 7 |
| vivid-gradient | 40 | 9 | 16 | 13 | 2 | 5 | 4 |
| flat-color-field | 35 | 9 | 4 | 4 | 4 | 10 | 13 |
| hero-numeral | 33 | 9 | 11 | 13 | 0 | 9 | 0 |
| big-type-display | 33 | 13 | 5 | 1 | 5 | 15 | 7 |
| data-dense-dashboard | 31 | 9 | 10 | 20 | 0 | 1 | 0 |
| glass-frosted | 23 | 6 | 9 | 14 | 0 | 0 | 0 |
| playful-too-fun | 22 | 5 | 3 | 0 | 9 | 1 | 9 |
| motion-first | 21 | 1 | 16 | 1 | 4 | 0 | 0 |
| soft-3d-objects | 20 | 8 | 8 | 8 | 0 | 3 | 1 |
| dark-quiet-matte | 19 | 13 | 7 | 10 | 0 | 2 | 0 |
| editorial-serif | 18 | 8 | 2 | 3 | 2 | 9 | 2 |
| type-led-brand-system | 15 | 6 | 1 | 1 | 0 | 0 | 13 |
| illustrative-handmade | 11 | 7 | 1 | 0 | 4 | 0 | 6 |
| ai-orb-glow | 8 | 5 | 8 | 0 | 0 | 0 | 0 |
| retro-pixel-halftone | 8 | 6 | 1 | 1 | 1 | 0 | 5 |
| webgl-3d-scene | 8 | 7 | 0 | 0 | 8 | 0 | 0 |
| brutalist-raw | 7 | 4 | 1 | 2 | 1 | 1 | 2 |
| packaging-product-shot | 4 | 3 | 0 | 0 | 0 | 0 | 4 |
| gulf-arabic-first | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Per-genre columns count tagged picks and sum to more than the pick total by design.

What the owner leans to:

- **Dark first, by a lot.** `dark-luminous` plus `dark-quiet-matte` tag 95 of 196 picks (48%); 42
  of the 71 Mobile UI picks and 31 of the 49 Web UI picks are dark.
- **Light minimal is the other half of Mobile UI**, in a quiet shipped-grade form.
- **Big type and big numbers carry decks and brand.** `big-type-display` is the top Presentation
  style (15 tagged) and `hero-numeral` the next (9).
- **Photography is a quiet constant** (45 picks, 23%), in all five genres.
- **Dark and gradient travel together** (24 picks carry both), so `vivid-gradient` picks are
  mostly dark with a coloured bloom, not full-colour gradients.
- **Thin ends:** `ai-orb-glow`, `retro-pixel-halftone`, `webgl-3d-scene`, `brutalist-raw` and
  `packaging-product-shot` have 4 to 8 picks each. `webgl-3d-scene` is thin partly because 15
  web showcase picks were skipped. `gulf-arabic-first` has none.
- **Missing from the picks entirely:** light data dashboards, web apps in a light editorial
  style, and any Arabic or RTL work.

## Diversity rule proposal

The picks lean dark (48%), so left alone a board of references drifts to dark luminous with a
gradient. The rule keeps range without ignoring taste.

Per board (a direction's 6 to 8 UI references; an art strip counts separately):

1. **At most 3 references share one primary style** (at most 2 when the board has 6 or fewer).
2. **At most 50% of a board carries any one tag**, counting all tags. Dark counts as one tag:
   `dark-luminous` and `dark-quiet-matte` together stay at 50% or under unless the brief asks
   for dark.
3. **At least 3 distinct primary styles per board** when no style is asked, and at least 4 when
   the board has 8 or more references.
4. **When a style is asked** (the user says "dark UI" or "big typography"): at least 60% of the
   board comes from that style or its nearest neighbour, and the rest from at least 2 other
   styles, so a style request is a lean and not a monoculture.
5. **Across the 3 directions of one brief,** no two directions share a primary style. Each
   direction names its style id, so the agent and the user always know the style of the direction.
6. **At most 1 `vivid-gradient` reference per board** unless asked, since it is the closest to the
   J8 default look.
7. **Genre fit:** only styles that list the genre can be picked for it (for example,
   `webgl-3d-scene` is not a deck style).
8. **Search spread:** when no style is asked, query one style per search lane, picked at random
   from the styles that fit the genre, weighted by pick coverage but with each style capped at 25%
   of the picks for that genre.

Checks the Bench can run: count of distinct primary styles per board, the largest share of one
tag, and whether two directions share a primary. These need each reference to carry style tags,
which the judge pass assigns from the rubric.

## Proposed directory layout

Describe only. Nothing here is created in step 1.

```
docs/styles/
  INDEX.md                 one table: id, name, genres, nearest neighbour, pick counts
  styles.json              the same table in machine form (server and Atlas read this)
  <id>/
    STYLE.md
    exemplars.json         owner pick ids (and Mobbin screen ids), plus 1 to 3 anti-exemplars
```

One folder per style id in this list (22 folders in this draft). `STYLE.md` holds:

1. **Definition** (one line) and the **3 to 5 signals** as above.
2. **Keywords per genre.** Five short lists, one each for `mobile`, `web`, `showcase`, `deck`,
   `brand`: plain words for search queries and brief matching (for example `dark-luminous` mobile:
   "dark mode glow", "near-black accent lime"; showcase: "dark 3d landing page"). Genres the
   style does not apply to say "not used". These replace the 8-style `SHOWCASE_STYLES` table and
   feed the Atlas query recipes.
3. **Exemplars.** The owner pick ids that show the style, graded `core` (the cleanest 5 to 8) and
   `edge` (shows it with another style). Picks from Craftwork and Best Designs on X stay private
   references: they are listed by id only and are never sent to a model.
4. **Judge rubric.** The questions the judge asks of a candidate, in the taste-bar wording:
   - Is it this style (3 to 5 yes or no checks from the signals)?
   - **great:** could sit on the owner's boards, one focal idea, real content.
   - **good:** on style and on page but generic.
   - **bad:** off style, off page, or any of the cheap marks in this draft.
   - Slop flags from J8 (centred hero, 12 to 29 px cards on a soft gradient, system font plus
     Georgia, violet accent) that downgrade a result one grade.
5. **Nearest neighbour and how to tell apart**, and the **lens notes** (which lenses sit well with
   the style, for Gulf briefs especially).

Wiring, for later steps and not part of this draft: `bend_brief` names a style id per direction;
`search_references` and the genre lanes read the keywords for that style and genre; `rate_references`
and the Bench judge read the rubric; the diversity rule runs on the style tags of a board.

## Questions for the owner

1. Trim the list: which styles are not worth a folder? The thin ones (`packaging-product-shot`,
   `brutalist-raw`, `ai-orb-glow`) are the first candidates to merge.
2. Is the dark split right (`dark-luminous` and `dark-quiet-matte`), or one dark style?
3. Gulf and Arabic: can you pick 15 to 20 references so the style has exemplars?
4. Do you want any style that is not in the picks (for example Y2K, neumorphic, cyberpunk)?
5. Is the 50% cap on any one tag too strict for the dark lean?
