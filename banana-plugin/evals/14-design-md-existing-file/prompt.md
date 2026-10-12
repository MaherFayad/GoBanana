---
description: "The project already has its own DESIGN.md; the scoped export must leave it alone."
expected_outcome: "Writes design/explorations/frosted-sleeve/DESIGN.md, leaves the root DESIGN.md untouched, and says the new file inherits the project's system."
tags: [design-md, files, scaffold]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Make a DESIGN.md for the frosted sleeve direction on our checkout page, from canvas cv_demo.
