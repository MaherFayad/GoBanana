---
type: llm
---

PASS if the agent treats these on-topic results as fine: it does not re-search any lane, does not call results off topic without a reason (rating a shop listing bad as stock_or_shop is fine),
and if it rates anything great it picks only a few standouts, about 1 to 3 per search, never every usable result.
The reply shows highlights with their source links.
FAIL if the agent rates every usable result great, rates on-topic results bad, or searches a lane again.
