---
description: "Export defaults to page scope: files go under design/explorations/<slug>/ and the project's root files are left alone."
expected_outcome: "export_kit with directionId d2, pages naming checkout, no scope system; DIRECTION.md and BUILD-PROMPT.md written under design/explorations/; one line saying they apply only to the checkout page."
tags: [handoff, export, files]
max_turns: 30
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

Export the brutalist receipt direction from canvas cv_demo as a direction file and a build prompt for our checkout page. Don't ask me anything.
