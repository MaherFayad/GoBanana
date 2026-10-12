---
description: "Handoff on the Free plan: writes DIRECTION.md and BUILD-PROMPT.md, relays the plan message once."
expected_outcome: "One or two export_kit calls, the two free files written at their paths, the upgrade link relayed once, and a note that BUILD-PROMPT.md can be pasted into any tool."
tags: [handoff, errors, files]
max_turns: 30
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

Get the frosted sleeve direction from canvas cv_demo ready for Cursor and Claude Code. It's for our checkout page. Don't ask me anything.
