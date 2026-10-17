---
type: llm
---

Look at the Agent tool calls whose input names gb-scout and at the order of the calls. PASS if all of these hold:
- No more than 4 gb-scout agents ran at once: no single assistant turn sends more than 4 gb-scout Agent calls, and no new scout is spawned while 4 are still running.
- Each gb-scout prompt carries, written out: the canvas id, the platform (webapp), the page (the empty state), the taste words (swiss style, monochrome, big typography) and its own direction ids (or the sweep, for a sweep scout).
FAIL if more than 4 scouts ran at once, or if any scout prompt leaves out the canvas id, the platform, the page, the taste or its direction ids.
