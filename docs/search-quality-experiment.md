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

## Round 2: the owner's taste (boards `maherfayad55/mobile` and `/dashboard`, read via Pinterest's official public RSS feeds)

51 pins. Titles are empty or useless on most (31 of 51 have no title; others read "X", "(1) Instagram", Xiaohongshu titles), so **title words cannot carry this taste**. Sources are designer social posts (X, Instagram #50UIchallenge, Muzli, Dribbble, Xiaohongshu, Spline). Named creators: Gleb Kuznetsov, Robin Holesinsky, Basit A. Khan, Felix Haas, Halo Lab, SlabPixel, nickpylll.

Visual traits: single widget or card close-ups more than full screens; giant numerals as hero; airy off-white or soft grey studio staging; one floating phone; frosted glass, soft 3D, glowing orbs and aurora gradients; a dark set with orange or lime accents. Domains: fintech, crypto, AI assistants, productivity, health.

Query tests judged visually against the boards (pages of 10, Pinterest + Dribbble):

| Query | Clean single items | Visual match to the boards |
| --- | --- | --- |
| flight booking app ui | 9/10 | Competent, generic three-phone Dribbble shots |
| travel wallet app ui | 9/10 | Mixed |
| travel app card ui minimal | 8/10 | Closest of the domain queries (single card on off-white) |
| flight app ui dark | 9/10 | Moody, decent |
| travel app ui glassmorphism | 8/10 | Decent, staged scenes |
| soft 3d ui card | 6/10 | **Strongest craft match** (studio-lit 3D cards) |
| glassmorphism widget ui | 5/10 | Good on widgets |
| fintech app ui minimal | 7/10 | Close-up hand-held crops match well |
| ai assistant app ui | 10/10 | High metrics, **weak taste** (mascots, busy screens) |
| ui card widget minimal | 0/10 | Tag pages only |
| site:muz.li, site:x.com | 0 usable | Google does not index these as image items |

Conclusions: metadata scores do not equal taste; style words ("soft 3d", "glassmorphism", "minimal", "dark", "card", "widget") combined with a domain noun move results toward the owner's bar; creator names and social sources are not reachable through Google image search. Since the server may not analyze images (hard rule 1), taste has to come in as words: from a saved taste profile, or from the user's own agent, which can look at boards and pass style terms.
