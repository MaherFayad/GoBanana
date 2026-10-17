---
type: llm
---

Look at the first reply and any AskUserQuestion call.
PASS if it asks the user one question about how far to take the work, offering four options that match: Explore directions (marked Recommended), Explore then draft my picks, Finished from the first go, and Just references. A request for style words or a reference board in the same turn is fine.
FAIL if the mode question is missing, if Explore is not marked as recommended, if it asks several separate questions in a list, or if it presents directions, references or a board before the user answers.
