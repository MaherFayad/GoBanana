---
description: "The user wants wild directions that stay on brand, with their DESIGN.md pasted in."
expected_outcome: "Calls bend_brief with brand { designMd, stretch: keep-logo-and-primary }, keeps the brand primary #1A56DB and the logo rules in the directions it shows, never invents another brand color."
tags: [explore, brand]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

Go wild on our checkout screen for the Acme Pay app, but our brand team has to approve it: keep our logo and our primary color. Don't ask me anything else, pick the strongest 2 directions and pull references. Here is our DESIGN.md:

# Acme Pay design

## Colors
- Primary: #1A56DB (buttons, links, focus)
- Surface: #FFFFFF

## Logo
- Keep clear space of 16px around the logo.
- Never recolor or stretch the logo.
