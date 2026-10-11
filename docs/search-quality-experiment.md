# Search quality experiment (2026-10-11)

Live Serper image search, 51 queries, 10 results each. A result counts as **hi-fi** only when it is a
single item page (Dribbble `/shots/`, Pinterest `/pin/`, Behance `/gallery/`, Awwwards `/sites/`), not stock
or marketplace, larger side at least 600 px, and has a UI-sounding title.

## Query wording (Pinterest + Dribbble, 4 wild topics: Sadu pattern, car dashboard gauges, clothing care label, passport stamp)

| Variant | Hi-fi | Item pages | Clean | Big | UI title |
| --- | --- | --- | --- | --- | --- |
| `{topic} app concept` | 22% | 30% | 85% | 38% | 40% |
| `{topic} dashboard ui` | 15% | 25% | 80% | 45% | 48% |
| `{topic} app ui` | 8% | 22% | 82% | 35% | 38% |
| `{topic} mobile app ui design` | 8% | 18% | 82% | 32% | 40% |
| `{topic} design` | 5% | 68% | 65% | 50% | 8% |
| `{topic}` (raw) | 2% | 92% | 75% | 65% | 12% |
| `{topic} ui ux case study` | 2% | 8% | 82% | 32% | 55% |
| `{topic} app ui` + studio names (Tubik, Ramotion, Halo Lab, Outcrowd) | 0% | 0% | 93% | 37% | 27% |

## Plain screen-type queries (from the brief, no wild ingredient)

| Query | Site | Hi-fi |
| --- | --- | --- |
| flight booking app ui | dribbble | 8/10 |
| flight booking app ui | pinterest | 7/10 |
| airline app design | pinterest | 7/10 |
| airline checkout mobile app | dribbble | 5/10 |
| travel app dashboard ui | dribbble | 5/10 |
| boarding pass app ui | dribbble | 4/10 |
| flight checkout app concept | dribbble | 3/10 |

## Conclusions

1. Wild idea + UI words fails: those applied combinations barely exist online, and Google answers with tag and search pages. Studio and creator names do not help.
2. Raw wild ingredients return real item pages (92%) with strong visuals: good for an **inspiration lane**, after stock and size filters.
3. Common screen-type wording from the brief (`<domain> <product> app ui`, `... app design` on Pinterest) returns polished UI shots 50 to 80% of the time: the **fidelity lane**.
4. Behance returned 0 item pages through Google image search (search pages only): keep it opt-in.
5. Dribbble image URLs carry `?resize=` params; the original is larger. Pinterest `236x`/`474x` paths have a `736x` twin.
