---
description: "HTML board export written to disk by the agent."
expected_outcome: "export_kit html_board, then the agent writes the HTML file with hotlinked images and a Sources list."
tags: [moodboard, files]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

Give me an HTML moodboard file for canvas cv_demo that I can open in my browser.
