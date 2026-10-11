---
description: "DESIGN.md exists; write AGENTS.md pointing to it."
expected_outcome: "export_kit agents_md, AGENTS.md written, points to DESIGN.md."
tags: [agents-md, files, scaffold]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

Set up an AGENTS.md so Cursor and Claude Code follow our design system from canvas cv_demo.
