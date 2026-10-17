---
description: "No mode words in the ask: the first reply asks the four-mode question, Explore recommended, before any work."
expected_outcome: "One question (in chat or one AskUserQuestion call) with the four modes: Explore directions (Recommended), Explore then draft my picks, Finished from the first go, Just references; the missing taste folded into the same turn; no bend_brief and no search_references yet."
tags: [explore, clarify, mode]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, AskUserQuestion]
---

Help me design the booking flow for our clinic app.
