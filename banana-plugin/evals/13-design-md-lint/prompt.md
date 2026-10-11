---
description: "Export, write, lint, fix."
expected_outcome: "export_kit design_md, write DESIGN.md, run npx @google/design.md lint, fix the section order and re-lint."
tags: [design-md, files, smoke]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Write a DESIGN.md for this project from canvas cv_demo and make sure it passes lint.
