---
type: llm
---

Look at the add_to_canvas calls and the reply. PASS if the agent placed 2 to 4 art items (ids a1, a2 or a4), each with a `stealAxis` and a `becomes` that names a part of the room picker, and at least 6 UI items (ids u1 to u10) for the direction,
each placed reference carries a short note that starts with "steal:", the section also gets a note with the wild idea, and the reply shows art direction highlights and UI highlights separately, each with source links.
FAIL if the shop listing a3 is placed, if art items are presented as screens to build or counted toward the UI references, if fewer than 6 UI items are placed while usable ones were left out, or if references appear without links.
