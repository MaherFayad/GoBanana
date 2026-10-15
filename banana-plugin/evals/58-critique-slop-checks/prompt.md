---
description: "Critique grades the REVIEW.md Distance from slop items from the server and says how many the page matched."
expected_outcome: "export_kit review, a pass or fix row for each Slop item with evidence from app/checkout/page.tsx (or not checked), and one line saying how many slop rules the page matched, with 2 or more called out as reading like a default page."
tags: [critique, atlas]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Critique our checkout page against the frosted sleeve direction on canvas cv_demo, from the code. I mostly want to know if it looks like every other AI made page. Don't apply fixes. Don't ask me anything.
