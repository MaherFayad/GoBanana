---
title: Wildness, moves and lenses
description: The five wildness levels, the six moves bend_brief combines, and the eight culture lenses.
---

## Wildness

| Level | Label | Moves per direction | Layout words kept | Closing line of each prompt |
| --- | --- | --- | --- | --- |
| 1 | Fresh | 1 | Yes | "Keep the familiar layout and controls, change only the surface." |
| 2 | Bold | 1 | No | "Keep it usable, but let the layout bend." |
| 3 | Weird | 2 | No | "Let the two ideas collide in one screen." **Default** |
| 4 | Wild | 2 or 3, alternating | No | "Push further than feels safe." |
| 5 | Bananas | 3 | No | "Ignore usability rules for this pass and make it unforgettable." |

From level 3 every direction carries a **twist** (one short rule, like "emoji instead of icons"). At level 5 usability words (easy, clean, intuitive) are stripped from the subject. Even at Bananas, the platform's avoid list and WCAG text contrast stay in the spec.

## Moves

| Move | Borrows | Query shape | Example title |
| --- | --- | --- | --- |
| `transplant` | The format, print details and wear of an object | `{object} packaging design {mood}` | "Checkout as a spa-like cereal box" |
| `material` | A material with real light and shadow | `{material} texture ui design` | "Launch page in sandstone" |
| `era` | Type, color and grid of a period or movement | `{era} graphic design {subject}` | "Rewound to Fluxus 1962" |
| `constraint` | One hard rule | `{constraint} web design` | "Flat color, no gradients, no exceptions" |
| `scale` | One element made enormous, the rest small | | "Giant sparklines everywhere" |
| `lens` | A visual tradition | | "Woven like a Sadu tent band" |

Pass `moves` to `bend_brief` to limit them, for example `["material", "era"]`.

## Culture lenses

| Id | Tradition | Arabic name |
| --- | --- | --- |
| `sadu` | Sadu weaving | نسيج السدو |
| `najdi` | Najdi architecture | العمارة النجدية |
| `kufic` | Square Kufic geometry | الزخرفة الكوفية الهندسية |
| `mashrabiya` | Mashrabiya | المشربية |
| `desert-modern` | Desert modern | الحداثة الصحراوية |
| `memphis` | Memphis design | تصميم ممفيس |
| `swiss-international` | Swiss International Style | الأسلوب السويسري الدولي |
| `japanese-ma` | Japanese ma (negative space) | الفراغ الياباني |

A lens makes every direction pull from that tradition. The skills suggest a lens when you mention Saudi, Gulf, Arabic or regional heritage, and never use sacred text or religious verses.

## Learning

Bends are fixed for the same input, but two things shift the odds of an ingredient:

- **Your direction ratings.** Ideas you often drop with `rate_directions` come up less. Ratings from other people count only once at least 3 different users agree.
- **Variety.** Ideas from your last 3 boards are made rare (not impossible) on a new board, so you do not see the same suzani on every brief.
