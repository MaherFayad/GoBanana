---
description: "Finished mode in an empty repo: Stage 0, space, spec and wireframes first, then exactly two user gates (spec and wireframes, then the Pick page), and no component or page code before the second gate."
expected_outcome: "No mode question (the ask says build the whole app); says Mode: Finished; writes design/gobanana/PROBLEM.md, CHALLENGE.md, SPACE.md, SPEC.md, WIREFRAMES.md and HTML wireframes; asks Gate 1 with AskUserQuestion (approve spec and wireframes, which challenges to accept); runs the explore flow for the pages marked Bananas and Stretch with Calm pages held to Ship; shows a Pick page and asks Gate 2 with AskUserQuestion last; writes no component, page, token or theme code and runs no shadcn init before the second gate; PDPL consent is never challenged."
tags: [finish, gates, stage0]
max_turns: 120
timeout_seconds: 3600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash, AskUserQuestion, Agent]
---

Build the whole booking app for our Riyadh clinic from scratch in this empty repo. Style: calm, editorial, warm.
