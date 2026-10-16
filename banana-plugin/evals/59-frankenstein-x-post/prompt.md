---
description: "Frankenstein it with an X post part when the agent has no screenshot or browser tool: it never fetches or crawls X and never passes a made up image, and asks the user for a screenshot of that one post, while the rest of the page can still be made from the other reference."
expected_outcome: "get_canvas on cv_xpost; no WebFetch or Bash call to x.com, twitter.com or twimg.com; no attach_screenshot with an invented image; the reply asks the user for a screenshot of that one post (to attach with attach_screenshot), with the post link and the author credit."
tags: [frankenstein, x-post, hard-rules]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, WebFetch, Bash]
---

Frankenstein it on canvas cv_xpost: a settings page that uses the toggle row from the X post on the board, with the two column layout from the other reference. Just go.
