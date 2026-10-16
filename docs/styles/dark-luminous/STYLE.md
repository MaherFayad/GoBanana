---
name: style-dark-luminous
description: Dark luminous. A near-black screen where one glow, gradient bloom, lit object or AI orb is the only light. Load when a direction, brief or board uses the dark-luminous style, to search, place, judge or build in it.
---

# Dark luminous (`dark-luminous`)

Part of the GoBanana style index (docs/styles/INDEX.md). The general skill that reads a style from a
thumbnail is `gobanana-taste` in banana-plugin. Load this file when a direction names `dark-luminous`.

## Definition

A near-black screen where one glow, gradient bloom, lit object or AI orb is the only light.

## Visual signals

Check these in the thumbnail. Three or more yes means the reference is this style.

- Near-black ground (lightness under about 12%).
- One luminous focal area: a glow rim, a gradient bloom, a lit object or an orb.
- Thin, small grey labels around it.
- A single accent hue (lime, orange, electric blue), never a rainbow.

Genres: Mobile, Web (apps and dashboards), Web showcase, Deck.

## Great versus cheap (the owner's bar, docs/taste-bar.md)

- **Great:** One focal glow and everything else quiet, real data and tight type. An AI orb, when there is one, has a real state (listening, thinking) and is the only effect.
- **Cheap:** Glow everywhere, neon on every control, purple to blue on every surface, glow used as a background wash, a generic purple blob with sparkle icons.

## Do

- Keep one light source per screen and let it lead the eye to the main action or number.
- Use one accent hue and repeat it at most twice.
- Keep body text at real contrast (4.5:1) even when the glow is soft.

## Don't

- Do not glow every button, border and icon.
- Do not default to an indigo to violet bloom (the J8 default look).
- Do not put an orb on a screen that is not an AI or voice feature.

## Nearest neighbour: `dark-quiet-matte` (Dark quiet matte)

Look for the light. Dark luminous has a glow, bloom or orb you notice first; dark quiet matte has none, only surface tone steps and one hairline.

## Keywords per genre

Plain words for search queries and brief matching. Search adds "-template -kit -free" on core
sites itself.

| Genre | Keywords |
|---|---|
| Mobile | "dark mode glow app ui", "near black app ui neon accent", "ai assistant orb app ui" |
| Web (apps and dashboards) | "dark dashboard glow accent ui", "dark web app ui gradient glow" |
| Web showcase | "dark glow landing page", "dark luminous website" |
| Deck | "dark keynote slide glow", "dark presentation gradient accent" |
| Brand | not used |

Words in a brief or taste that name this style: "glow", "glowing", "luminous", "neon glow", "ai orb", "orb", "ambient glow", "dark luminous", "dark", "dark mode", "dark ui", "night mode", "siri style".

## Judge rubric

Use it in rate_references, the Bench judge and critique. A reference is rated against the brief's
page first, then against this style.

1. **Is it this style?** Yes when 3 or more signals above show in the thumbnail. If it is closer to
   `dark-quiet-matte`, tag it that way instead.
2. **great:** on the brief's page, could sit on the owner's boards, one focal idea, real content,
   and none of the cheap marks.
3. **good:** on style and on page, but generic.
4. **bad:** off page, off style when the style was asked, or any cheap mark: Glow everywhere, neon on every control, purple to blue on every surface, glow used as a background wash, a generic purple blob with sparkle icons.
5. **Slop flags (J8 default AI look), each lowers the grade one step:** a centred hero over three
   rounded 12 to 29 px cards, a soft indigo or violet gradient, system-ui plus a Georgia accent,
   gradient text.

## Lens notes

Najdi night skies and dhow lantern light work as the one light source; keep Sadu or Talli to a thin band so the glow stays the focus.

## Merged into this style

- `ai-orb-glow` (draft 1) was folded in here (owner decision, 2026-10-16). It lives in: Signals (the orb as a focal light), Great vs cheap (the orb has a real state) and the Don'ts (no orb outside AI or voice features). Keywords: "ai assistant orb app ui".

## Exemplars

See `exemplars.json`: owner pick ids from banana-server/bench/taste/picks.json. Craftwork, Best
Designs on X and x.com picks are never listed here: they are private references, never a model input.
