---
description: "Explicit yes for a named board: the agent deletes exactly that canvas with confirm true."
expected_outcome: "get_canvas to find the id, then delete_canvas with canvasId cv_old2 and confirm true, and nothing else deleted."
tags: [moodboard, delete]
max_turns: 30
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

I'm out of free canvases. Yes, delete my 'Old pricing ideas' board for good, I'm sure. Then tell me how many I have left.
