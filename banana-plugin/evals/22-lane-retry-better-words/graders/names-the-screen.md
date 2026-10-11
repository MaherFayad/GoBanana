---
type: llm
---

PASS if the agent re-searched the bridge lane with search_references (directionId, lane "bridge" and a query), and the new query keeps the idea's main word (frame or film)
and names a screen or component of a cinema ticket checkout (for example "film frame ticket checkout ui" or "film strip seat picker ui") instead of repeating "oversized film frames ui design" or naming frames for sale,
and the reply tells the user in about one line what was rejected and that the lane was retried.
FAIL if the retry repeats the original words, adds a site: operator, asks for raw images that are not UI, or the reply presents the frame shop, store, kit or marketplace results as highlights.
