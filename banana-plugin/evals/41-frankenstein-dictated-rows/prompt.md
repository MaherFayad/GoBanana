---
description: "The user dictates which part comes from which reference: the agent cuts those parts and stitches one page with explicit rows, not a recipe."
expected_outcome: "get_canvas on cv_stitch, cut_parts for nav (it_205), hero (it_202), cards (it_203) and footer (it_208), then frankenstein_page with rows of those part ids in that order, then a numbered skeleton with each source linked and the board link."
tags: [frankenstein]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

On canvas cv_stitch, frankenstein this for me: nav from the AI startup hero (it_205), hero from the coffee roaster homepage (it_202), cards from the fintech pricing page (it_203), and the footer from the agency footer (it_208). One page, in that order. Don't ask me anything.
