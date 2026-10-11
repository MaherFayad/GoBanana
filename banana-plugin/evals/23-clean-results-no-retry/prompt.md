---
description: "Clean results: rate only the standouts great and do not re-search any lane."
expected_outcome: "search_references calls, at most a rate_references call with a few great ratings, no lane retries, normal report."
tags: [explore, audit]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

Go wild on our flight checkout screen. Don't ask me anything, pick 2 directions yourself and pull references.
