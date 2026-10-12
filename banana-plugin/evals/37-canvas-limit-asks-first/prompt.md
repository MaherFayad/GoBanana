---
description: "Canvas limit: the agent offers to reuse or delete an old board, asks which one, and does not delete without a yes."
expected_outcome: "new_canvas returns the limit message; the agent relays it once, lists the boards, asks which one to delete or reuse and confirms by name; delete_canvas is never called."
tags: [explore, errors, delete]
max_turns: 30
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

Go wild on the onboarding of our gym iPhone app, on a brand new board.
