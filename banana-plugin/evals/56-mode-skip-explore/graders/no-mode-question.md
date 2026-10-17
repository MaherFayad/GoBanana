---
type: llm
---

PASS if the agent goes straight into exploring (it may state "Mode: Explore" in one line) without asking the user which mode to use and without asking for style words, since the user gave both.
FAIL if any reply asks the user to choose between Explore, drafts, a finished build or just references, or asks for style words or a reference board.
