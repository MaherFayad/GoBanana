---
description: "In Claude Code the explore skill runs the deep search through gb-scout agents in parallel (never more than 4 at once), each with a full input packet, then one gb-curator places and arranges the board. The harness sees the main thread's Agent calls and their prompts; tool calls made inside the subagents may not show in the trace, and the llm judge sees only the first 12 and last 12 trace messages, so the scout prompts are graded from the Agent call inputs."
expected_outcome: "No mode or taste question; light Stage 0; the sweep, bend_brief and the first triage pass run in the main thread; at least 2 Agent calls to gobanana:gb-scout sent together, never more than 4 at once, each prompt carrying the canvas id, platform webapp, the empty state page, the taste words and its direction ids; then exactly one Agent call to gobanana:gb-curator with the scouts' kept lists; then open_canvas and a reply that ends asking whether to draft any."
tags: [explore, agents, parallel]
max_turns: 45
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Agent]
---

Explore directions for the empty state of our B2B logistics dashboard (web app). Style: swiss style, monochrome, big typography.
