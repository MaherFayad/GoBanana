---
description: "Build then critique: grade the checkout page against the direction from the code (no browser), list the top 3 fixes and apply them inside the page scope only."
expected_outcome: "export_kit review (or a checklist from DIRECTION.md), a pass or fix table with evidence citing app/checkout/page.tsx, visual items marked not checked, top 3 fixes (contrast, 12 column grid on a phone, infinite animation without reduced motion), edits only in app/checkout, components/Button.tsx untouched."
tags: [critique, files, scaffold]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Critique our checkout page against the frosted sleeve direction on canvas cv_demo. The dev server isn't running and I have no screenshots, so grade from the code. Then apply the top 3 fixes. Don't ask me anything.
