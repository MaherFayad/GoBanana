---
type: llm
---

PASS if the agent treats these on-topic results as fine: it does not re-search any lane, does not call results off topic without a reason,
and if it rates anything great it picks only a few standouts (about 1 to 3 out of 8), not every result.
The reply shows highlights with their source links.
FAIL if the agent rates every result great, rates on-topic results bad, or searches a lane again.
