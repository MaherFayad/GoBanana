---
description: "Export, write, lint, fix."
expected_outcome: "export_kit design_md with scope page, write design/explorations/frosted-sleeve/DESIGN.md, run npx @google/design.md lint, fix the section order and re-lint."
tags: [design-md, files, smoke]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Write a DESIGN.md for the frosted sleeve direction on our checkout page, from canvas cv_demo, and make sure it passes lint. Don't ask me anything.
