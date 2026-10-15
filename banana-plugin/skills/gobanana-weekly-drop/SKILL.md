---
name: gobanana-weekly-drop
description: Set up a weekly wild drop for a saved product brief - a scheduled task in the user's own agent that runs one GoBanana bend a week on one page, fills a new board with linked references, and posts the board link. Use when the user says "weekly drop", "every week send me new directions", "schedule a bend", "a new idea for my pricing page every Monday", "recurring inspiration", or "remind me with fresh references". Sets up the schedule only after an explicit yes. The scheduled run uses get_canvas, new_canvas, bend_brief, search_references, rate_references, add_to_canvas, arrange_canvas and open_canvas from the GoBanana MCP server. To run a bend once, use gobanana-explore.
---

# GoBanana weekly drop

One saved brief, one bend a week, one board link. The schedule lives in the user's own agent (a Claude Code scheduled routine, a Claude Desktop or Cowork scheduled task, or a cron job that starts their agent). GoBanana has no scheduler and does nothing between runs.

## Ground rules

- **Ask before you schedule.** Show the brief and the schedule in plain words and wait for a yes. Never create a scheduled task on a guess.
- **Taste comes from the user.** The brief needs 3 to 5 style words or a reference board. Never invent them (see gobanana-explore).
- **One page, one bend a week.** One brief, one page, 3 directions kept. A drop is an idea over a page or two, not a redesign.
- **A drop costs searches.** One bend is free, but 3 kept directions need about 3 searches. Say so once at setup. If a run hits a quota or plan message, post it as is, with its link, and stop. Never retry in a loop.
- **Links only.** Every reference keeps its source link. Never download or save images.
- **Delete nothing.** A scheduled run never deletes a board. Old drops stay until the user asks to remove one.
- Plain words, no em dashes.

## Set it up

1. **Collect the brief.** Ask for what is missing, one short message:
   - the product and the page ("flight checkout for a budget airline"), and the platform (mobile, website, web app);
   - 3 to 5 style words, or a board to copy the taste from (`get_canvas` with `summary: true`);
   - wildness (default 3 of 5) and a culture lens if it applies (see gobanana-culture);
   - where to post the link: in the chat that the task opens, or through a connector the user already has (Slack, email). Use a connector only if it is connected and the user named it.
2. **Pick the schedule.** Default: Monday morning in the user's time zone. Ask the time zone once.
3. **Write the task prompt.** It must stand alone, because the scheduled run has no memory of this chat. Use this shape, filled in:

```text
Weekly GoBanana drop for "{product}", page "{page}", platform {platform}.
Style words: {words}. Wildness: {1-5}. Lens: {lens or none}.
1. get_canvas (summary) and find a board titled "Weekly drop: {product}". Reuse it if it exists, else new_canvas with that title.
2. bend_brief with the brief, platform, page, wildness and lens. Keep the 3 directions that are furthest from the ones already on the board, and drop any that only restyle the baseline.
3. For each kept direction: search_references once, rate_references (bad for junk, great for 1 to 3 standouts), then add_to_canvas 6 to 8 UI and 2 to 4 art references, each with a "steal:" note and its source link. Put them in a new section titled with this week's date.
4. arrange_canvas, then open_canvas and post the web link with one line per direction.
If any tool returns a quota or plan message, post it once and stop. Do not retry.
```

4. **Create the task** with the host's own scheduler. Claude Code: a scheduled routine (`/schedule`) or `CronCreate`. Claude Desktop or Cowork: a scheduled task. If the host has none, give the user the prompt and a one-line cron or Task Scheduler recipe that starts their agent with it, and say you did not install anything.
5. **Confirm.** Tell the user the schedule, where the link will be posted, how to pause it (delete the scheduled task) and that a first run now is available. Offer to run it once now so they see what a drop looks like.

## Change or stop

- **Change the brief, style words or day:** edit the scheduled task's prompt or schedule, show the new version and wait for a yes.
- **Stop:** delete the scheduled task. The boards stay on GoBanana.
- **Too samey after a few weeks:** raise the wildness by one, or swap one style word. The server already steers away from the user's recent queries.

## When things go wrong

- **GoBanana tools missing in the scheduled run:** the run needs the GoBanana connector signed in. Ask the user to enable it (or `/mcp` in Claude Code) and run the task once by hand.
- **Quota or plan message:** relay it once, as is. The next week's run tries again on its own; do not loop inside one run.
- **Tool error or timeout:** retry once at most, then post one line saying the drop failed and why.
