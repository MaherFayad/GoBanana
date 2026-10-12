---
description: "Handoff: detects Claude Code, Cursor and AGENTS.md, exports a page scoped pack, writes files at their paths and merges into AGENTS.md and CLAUDE.md."
expected_outcome: "export_kit with directionId, pages app/checkout, scope page and formats including direction_md, build_prompt, review, cursor_rules, agents_md and claude_md; files written under design/explorations/<slug>/ and .cursor/rules/; AGENTS.md and CLAUDE.md keep their text and gain a marked section; one line on scope."
tags: [handoff, files, scaffold]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Hand off the frosted sleeve direction from canvas cv_demo to my coding tools. It's for the checkout page in app/checkout. Don't ask me anything.
