---
type: llm
---

PASS if the agent re-searched the inspiration lane with search_references (directionId, lane "inspiration" and a query), and the new query describes
what the picture looks like (for example a material, texture, print or photo technique such as "35mm film strip macro") instead of repeating "oversized film frames" or naming frames for sale,
and the reply tells the user in about one line what was rejected and that the lane was retried.
FAIL if the retry repeats the original words, adds a site: operator, or the reply presents the frame shop or decor results as highlights.
