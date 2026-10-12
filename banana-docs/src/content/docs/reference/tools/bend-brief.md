---
title: bend_brief
description: Turn a design brief into wild directions for one page or two, each with a visual spec for the platform, art queries and a prompt. Without pages it returns wildSpots.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All, unlimited | None | Only with `canvasId`: saves the directions | idempotent |

Bending is deterministic: the same brief, wildness, platform, pages, moves and lens give the same directions with the same ids. Your own `rate_directions` history and the ideas on your last 3 boards shift the odds, so you do not see the same idea on every new brief.

## Inputs

| Name | Type | Required | Limits and default | What it does |
| --- | --- | --- | --- | --- |
| `brief` | string | Yes | 1 to 500 characters | What is being designed, in a few words: "flight checkout screen" |
| `wildness` | integer | Yes | 1 to 5 | 1 Fresh, 2 Bold, 3 Weird, 4 Wild, 5 Bananas. Higher combines more moves |
| `count` | integer | No | 1 to 8, default 6 | How many directions. The skill asks for 8 |
| `platform` | enum | No | `mobile`, `tablet`, `website`, `webapp`, `any` | Leave out to detect it from the brief. [Rules](/docs/reference/platforms/) |
| `pages` | string[] | No | 1 to 3, each up to 60 characters | The pages the idea is for. Leave out to get `wildSpots` |
| `moves` | enum[] | No | `transplant`, `material`, `era`, `constraint`, `scale`, `lens` | Limit which moves are used. Default all six |
| `lens` | enum | No | `sadu`, `najdi`, `kufic`, `mashrabiya`, `desert-modern`, `memphis`, `swiss-international`, `japanese-ma` | Every direction pulls from that tradition |
| `taste` | string[] | No | 1 to 5 words, each up to 40 characters | Style words, saved on the canvas with `canvasId` |
| `canvasId` | string | No | 1 to 100 characters | Saves the directions to that board, so `search_references` can take a `directionId` |

## Output

Per direction: `id`, `title`, `twist` (always from wildness 3), `move`, `searchQuery`, `platform`, `pages`, `artQueries` (1 to 3 raw words for the art zone), `prompt` and `spec`:

| Spec field | Example |
| --- | --- |
| `typeVoice`, `typography` | mono: a monospace for display at clamp(48px, 8vw, 120px), the same mono for body at 18px |
| `color` | Chalky terracotta, sage and bone, no gloss; text at 4.5 to 1 or more |
| `layout` | 12 column grid, fluid type, a scroll story that opens on a hero with one clear action |
| `imagery`, `texture`, `iconography` | Close-up sandstone renders; layered sandstone bands; emoji stand in for every icon |
| `motion` | Slow 300ms fades, nothing loops, none with reduced motion on |
| `density` | Airy sections, one message per screen height |
| `signature`, `pattern` | The hero section rendered in sandstone; layered panels as the section divider |
| `steal[]`, `avoid[]` | How light sits on sandstone; text over sandstone without a solid backing |
| `styleWords[]`, `whyItFits` | minimal; "A dusty matte mood suits hungry people deciding fast" |

Plus `platform`, `pages`, `wildness`, `wildnessLabel`, `lens` and `wildSpots` (5 spots, empty when `pages` was given). With `canvasId`: `canvasId` and `saved`.

## Example call

```json
{
  "name": "bend_brief",
  "arguments": {
    "brief": "launch page for a specialty coffee roaster",
    "wildness": 3,
    "count": 2,
    "platform": "website",
    "pages": ["launch page"],
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f"
  }
}
```

## Example output

Real output from the bend engine, shortened:

```text
2 directions for "launch page for a specialty coffee roaster" (wildness 3, Weird):
Platform: website (website). Each direction is for one wild page or two, not the product's main design.
Pages: launch page.

1. Specialty coffee launch in sandstone, rewound to Fluxus 1962 (Twist: emoji instead of icons) [material + era] query: sandstone
   id: bd-z0y2y96z. Prompt: Redesign the specialty coffee launch page. Render every surface as sandstone...
   Spec: type mono: A monospace for display at clamp(48px, 8vw, 120px)... | color: Chalky terracotta, sage and bone...
   Signature: The hero section rendered in sandstone, with real light and shadow. Pattern: Layered sandstone panels...
   Art queries: sandstone texture; Fluxus graphic design
2. Specialty coffee launch as a spa-like cereal box (Twist: giant sparklines everywhere) [scale + transplant] query: cereal box
   id: bd-mob5pq35. ...
   Art queries: cereal box; oversized sparklines poster

Saved to canvas c3f1a0d2-.... Pass a direction id as directionId (with this canvasId) to search_references.
```

## Wild spots

Call it with no `pages` (and no `canvasId` if you do not want to save anything):

```json
{ "name": "bend_brief", "arguments": { "brief": "personal finance app", "wildness": 3, "count": 1, "platform": "mobile" } }
```

```text
Pages: none given. Where weirdness pays off (wildSpots):
- onboarding: Seen once, sets the tone, and nobody has learned the layout yet.
- empty state: Nothing to read yet, so the screen has room for a strong idea.
- achievement or streak moment: A reward should feel special, not like every other screen.
- paywall: A memorable paywall sells the feeling, not just the feature list.
- splash screen: A second of brand with no task to get in the way.
```

## Messages

| Message | Fix |
| --- | --- |
| "brief must be 1 to 500 characters, for example "flight checkout screen"." | Shorten the brief |
| "wildness must be a whole number from 1 (Fresh) to 5 (Bananas)." | Pass 1 to 5 |
| "pages must be 1 to 3 page names, each up to 60 characters." | Fewer, shorter pages |
| "canvasId must be an id from open_canvas." | Use a real canvas id |
| "The directions were not saved: that canvas was not found or could not be reached..." | Directions still come back; search with their query text, or bend again with a valid id |

Related: [Go wild on a screen](/docs/guides/go-wild/), [Wildness, moves and lenses](/docs/reference/wildness/).
