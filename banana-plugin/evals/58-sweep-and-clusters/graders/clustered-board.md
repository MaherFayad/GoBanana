---
type: llm
---

Look at the search_references, rate_references and add_to_canvas calls and the reply. PASS if all of these hold:
- A section titled "Space" is placed with sweep results, and those items carry a `cluster` (category, adjacent or outliers).
- Every kept direction gets references placed in its own section in at least 3 different clusters (for example layout, component: <part>, type, color, motion, art), each with a note that starts with "steal:".
- No result that a rate_references call rated `bad` is placed with add_to_canvas.
FAIL if there is no Space section or its items have no clusters, if any kept direction has references in fewer than 3 clusters, or if any result rated `bad` is placed.
